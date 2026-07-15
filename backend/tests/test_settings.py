"""PROSIC – Settings (app_settings) endpoint tests.

Covers:
- GET /api/settings without token → 401
- GET /api/settings with admin token → 5 keys with {configured, masked}
- PUT /api/settings/:key validation for stripe/google/invalid key
- Role restrictions (OPERACIONES → 403)
- POST /api/settings/test/{stripe,sheets} without configuration → {ok:false, error:'no_configurado'}
- Regressions: rentals create-payment-intent 503, sheets/status conectado=false, auth/login OK
"""
from __future__ import annotations

import json
import os
import time

import psycopg2
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "http://127.0.0.1:8001").rstrip("/")
API = f"{BASE_URL}/api"

ADMIN_EMAIL = "admin@prosic.mx"
ADMIN_PASSWORD = "prosic123"
OP_EMAIL = "operaciones@prosic.mx"
OP_PASSWORD = "prosic123"

PG_DSN = "postgres://prosic:prosic@127.0.0.1:5432/prosic"


# ─── DB helpers ──────────────────────────────────────────────────────────────
def _reset_settings() -> None:
    """Truncate app_settings so getSetting returns null (env vars are empty)."""
    conn = psycopg2.connect(PG_DSN)
    try:
        with conn, conn.cursor() as cur:
            cur.execute("DELETE FROM app_settings;")
    finally:
        conn.close()
    # Cache TTL is 5s → wait for cache to expire in the running server.
    time.sleep(5.2)


# ─── Fixtures ────────────────────────────────────────────────────────────────
@pytest.fixture(scope="module")
def api_client() -> requests.Session:
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    return s


def _login(api_client: requests.Session, email: str, password: str) -> str:
    r = api_client.post(f"{API}/auth/login", json={"email": email, "password": password}, timeout=15)
    assert r.status_code == 200, f"login {email} failed: {r.status_code} {r.text}"
    return r.json()["token"]


@pytest.fixture(scope="module")
def admin_token(api_client) -> str:
    return _login(api_client, ADMIN_EMAIL, ADMIN_PASSWORD)


@pytest.fixture(scope="module")
def op_token(api_client) -> str:
    return _login(api_client, OP_EMAIL, OP_PASSWORD)


@pytest.fixture
def admin_headers(admin_token) -> dict:
    return {"Authorization": f"Bearer {admin_token}", "Content-Type": "application/json"}


@pytest.fixture
def op_headers(op_token) -> dict:
    return {"Authorization": f"Bearer {op_token}", "Content-Type": "application/json"}


@pytest.fixture
def clean_settings():
    """Reset DB before AND after the test."""
    _reset_settings()
    yield
    _reset_settings()


# ─── Auth & permissions ──────────────────────────────────────────────────────
class TestSettingsAuth:
    def test_get_settings_without_token_returns_401(self, api_client):
        r = api_client.get(f"{API}/settings", timeout=15)
        assert r.status_code == 401
        data = r.json()
        assert "error" in data or "message" in data

    def test_get_settings_with_admin_returns_five_keys(self, api_client, admin_headers, clean_settings):
        r = api_client.get(f"{API}/settings", headers=admin_headers, timeout=15)
        assert r.status_code == 200
        data = r.json()
        expected = {
            "stripe_secret_key",
            "stripe_publishable_key",
            "stripe_webhook_secret",
            "google_sheets_id",
            "google_service_account_key",
        }
        assert set(data.keys()) == expected, f"unexpected keys: {set(data.keys())}"
        for k in expected:
            assert "configured" in data[k]
            assert "masked" in data[k]
            assert data[k]["configured"] is False
            assert data[k]["masked"] is None

    def test_put_requires_admin_operaciones_gets_403(self, api_client, op_headers):
        r = api_client.put(
            f"{API}/settings/stripe_publishable_key",
            headers=op_headers,
            json={"value": "pk_test_" + "a" * 30},
            timeout=15,
        )
        assert r.status_code == 403
        data = r.json()
        assert data.get("error") == "requiere_admin"

    def test_post_test_stripe_requires_admin(self, api_client, op_headers):
        r = api_client.post(f"{API}/settings/test/stripe", headers=op_headers, timeout=15)
        assert r.status_code == 403

    def test_post_test_sheets_requires_admin(self, api_client, op_headers):
        r = api_client.post(f"{API}/settings/test/sheets", headers=op_headers, timeout=15)
        assert r.status_code == 403


# ─── PUT validation ──────────────────────────────────────────────────────────
class TestSettingsPutValidation:
    def test_put_invalid_key_name_returns_400(self, api_client, admin_headers):
        r = api_client.put(
            f"{API}/settings/some_random_key_name",
            headers=admin_headers,
            json={"value": "anything"},
            timeout=15,
        )
        assert r.status_code == 400
        data = r.json()
        assert data.get("error") == "invalid_key"
        assert "allowed" in data
        assert isinstance(data["allowed"], list)

    def test_put_stripe_secret_invalid_value_returns_400(self, api_client, admin_headers):
        r = api_client.put(
            f"{API}/settings/stripe_secret_key",
            headers=admin_headers,
            json={"value": "invalid_key"},
            timeout=15,
        )
        assert r.status_code == 400
        data = r.json()
        assert data.get("error") == "stripe_key_invalido"

    def test_put_stripe_secret_valid_value_returns_success(self, api_client, admin_headers, clean_settings):
        valid = "sk_test_" + "a" * 30
        r = api_client.put(
            f"{API}/settings/stripe_secret_key",
            headers=admin_headers,
            json={"value": valid},
            timeout=15,
        )
        assert r.status_code == 200, r.text
        data = r.json()
        assert data.get("success") is True
        assert data.get("key") == "stripe_secret_key"

        # GET → masked with first 6 + ellipsis + last 4
        g = api_client.get(f"{API}/settings", headers=admin_headers, timeout=15)
        assert g.status_code == 200
        entry = g.json()["stripe_secret_key"]
        assert entry["configured"] is True
        masked = entry["masked"]
        assert masked is not None
        assert masked.startswith(valid[:6])
        assert masked.endswith(valid[-4:])
        # It must NOT contain the full raw value
        assert valid not in masked

    def test_put_stripe_publishable_invalid_returns_400(self, api_client, admin_headers):
        r = api_client.put(
            f"{API}/settings/stripe_publishable_key",
            headers=admin_headers,
            json={"value": "invalid"},
            timeout=15,
        )
        assert r.status_code == 400
        assert r.json().get("error") == "stripe_pk_invalido"

    def test_put_stripe_publishable_valid_returns_success(self, api_client, admin_headers):
        valid = "pk_test_" + "b" * 30
        r = api_client.put(
            f"{API}/settings/stripe_publishable_key",
            headers=admin_headers,
            json={"value": valid},
            timeout=15,
        )
        assert r.status_code == 200
        assert r.json().get("success") is True

    def test_put_google_service_account_not_json_returns_400(self, api_client, admin_headers):
        r = api_client.put(
            f"{API}/settings/google_service_account_key",
            headers=admin_headers,
            json={"value": "not-json"},
            timeout=15,
        )
        assert r.status_code == 400
        assert r.json().get("error") == "service_account_invalido"

    def test_put_google_service_account_valid_json_returns_success(self, api_client, admin_headers):
        sa = {
            "type": "service_account",
            "client_email": "x@y.iam.gserviceaccount.com",
            "private_key": "-----BEGIN PRIVATE KEY-----\nMIIBOw\n-----END PRIVATE KEY-----\n",
        }
        r = api_client.put(
            f"{API}/settings/google_service_account_key",
            headers=admin_headers,
            json={"value": json.dumps(sa)},
            timeout=15,
        )
        assert r.status_code == 200, r.text
        assert r.json().get("success") is True

    def test_put_google_sheets_id_returns_success(self, api_client, admin_headers):
        r = api_client.put(
            f"{API}/settings/google_sheets_id",
            headers=admin_headers,
            json={"value": "1abc123XYZ"},
            timeout=15,
        )
        assert r.status_code == 200
        assert r.json().get("success") is True


# ─── POST /settings/test/* ───────────────────────────────────────────────────
class TestSettingsConnectionTests:
    def test_stripe_test_without_config_returns_no_configurado(self, api_client, admin_headers, clean_settings):
        r = api_client.post(f"{API}/settings/test/stripe", headers=admin_headers, timeout=15)
        assert r.status_code == 200, r.text
        data = r.json()
        assert data.get("ok") is False
        assert data.get("error") == "no_configurado"

    def test_sheets_test_without_config_returns_no_configurado(self, api_client, admin_headers, clean_settings):
        r = api_client.post(f"{API}/settings/test/sheets", headers=admin_headers, timeout=15)
        assert r.status_code == 200, r.text
        data = r.json()
        assert data.get("ok") is False
        assert data.get("error") == "no_configurado"

    def test_sheets_test_with_fake_credentials_does_not_crash(self, api_client, admin_headers, clean_settings):
        """With bogus SA JSON + spreadsheet id, endpoint must respond with 4xx/error, never crash."""
        sa = {
            "type": "service_account",
            "client_email": "fake@fake.iam.gserviceaccount.com",
            "private_key": "-----BEGIN PRIVATE KEY-----\nMIIBOwIBAAJBAKj\n-----END PRIVATE KEY-----\n",
        }
        # Configure both required keys
        r1 = api_client.put(
            f"{API}/settings/google_service_account_key",
            headers=admin_headers,
            json={"value": json.dumps(sa)},
            timeout=15,
        )
        assert r1.status_code == 200
        r2 = api_client.put(
            f"{API}/settings/google_sheets_id",
            headers=admin_headers,
            json={"value": "1abc123XYZ"},
            timeout=15,
        )
        assert r2.status_code == 200

        time.sleep(5.2)  # wait for cache TTL
        r = api_client.post(f"{API}/settings/test/sheets", headers=admin_headers, timeout=30)
        # Must respond with a JSON error (never 500 stack)
        assert r.status_code in (200, 400), f"unexpected: {r.status_code} {r.text[:200]}"
        data = r.json()
        assert data.get("ok") is False
        assert isinstance(data.get("error"), str) and len(data["error"]) > 0


# ─── Regressions ─────────────────────────────────────────────────────────────
class TestRegressions:
    def test_login_still_works(self, api_client):
        r = api_client.post(
            f"{API}/auth/login",
            json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD},
            timeout=15,
        )
        assert r.status_code == 200
        d = r.json()
        assert d.get("token")
        assert d["user"]["email"] == ADMIN_EMAIL

    def test_sheets_status_not_configured(self, api_client, admin_headers, clean_settings):
        r = api_client.get(f"{API}/sheets/status", headers=admin_headers, timeout=15)
        assert r.status_code == 200
        d = r.json()
        assert d.get("conectado") is False

    def test_create_payment_intent_without_stripe_returns_503(self, api_client, clean_settings):
        payload = {
            "equipo_id_equipo": "EQ-1",
            "equipo_modelo": "MONTACARGAS HYSTER H80",
            "equipo_serie": "SN123",
            "cliente_nombre": "Mario Lopez",
            "cliente_tipo": "FISICA",
            "cliente_rfc": "MELM8305281H0",
            "cliente_email": "mario@example.com",
            "cliente_telefono": "5551234567",
            "direccion_entrega": "Av Reforma 123, CDMX",
            "codigo_postal": "06000",
            "dias_renta": 3,
            "costo_renta": 350,
            "costo_flete": 1800,
            "subtotal": 2850,
            "iva": 456,
            "monto_total": 3306,
            "identity_score": 100,
        }
        r = api_client.post(f"{API}/rentals/create-payment-intent", json=payload, timeout=20)
        assert r.status_code == 503, f"expected 503, got {r.status_code}: {r.text[:200]}"
        d = r.json()
        assert d.get("error") == "STRIPE_NOT_CONFIGURED"
