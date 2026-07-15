"""PROSIC – Schema-driven contract endpoint tests.

Covers:
- GET /api/schema (public, no token) → 200 with {version, id_prefixes, sheets, relations, normalization_rules}
- GET /api/schema/servicios (public) → primaryKey='id_servicio', db_table='services', >=40 columns
- GET /api/schema/no_existe (public) → 404 error='sheet_no_declarada'
- GET /api/schema/generate-id/servicio (auth) → {id:'SRV-...'}
- GET /api/schema/generate-id/conductor (auth) → {id:'COND-...'}
- POST /api/schema/import without auth → 401
- POST /api/schema/import,import-all,normalize with admin & no Sheets → 400 sheets_no_configurado
- POST /api/schema/validate hoja='no_existe' → 400 sheet_no_declarada
- POST /api/schema/validate hoja='servicios' no sheets → 400 sheets_no_configurado
- GET /api/schema/preview/servicios no sheets → 400 sheets_no_configurado
- Regressions: /api/auth/login, /api/settings (5 keys), /api/sheets/status, /api/rentals/create-payment-intent
"""
from __future__ import annotations

import os

import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "http://127.0.0.1:8001").rstrip("/")
API = f"{BASE_URL}/api"

ADMIN_EMAIL = "admin@prosic.mx"
ADMIN_PASSWORD = "prosic123"

EXPECTED_SHEETS = {"servicios", "conductores_proveedores", "equipos", "vehiculos", "clientes"}
EXPECTED_ID_PREFIXES = {"servicio": "SRV-", "conductor": "COND-", "equipo": "EQ-", "vehiculo": "VEH-"}


# ─── Fixtures ────────────────────────────────────────────────────────────────
@pytest.fixture(scope="module")
def api_client() -> requests.Session:
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    return s


@pytest.fixture(scope="module")
def admin_token(api_client) -> str:
    r = api_client.post(
        f"{API}/auth/login",
        json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD},
        timeout=15,
    )
    assert r.status_code == 200, f"admin login failed: {r.status_code} {r.text}"
    return r.json()["token"]


@pytest.fixture
def admin_headers(admin_token) -> dict:
    return {"Authorization": f"Bearer {admin_token}", "Content-Type": "application/json"}


# ─── Public contract endpoint (GET /api/schema) ──────────────────────────────
class TestSchemaContractPublic:
    def test_get_schema_is_public_and_returns_full_contract(self, api_client):
        # No Authorization header at all
        r = requests.get(f"{API}/schema", timeout=15)
        assert r.status_code == 200, f"expected 200, got {r.status_code}: {r.text[:200]}"
        data = r.json()

        # Top-level shape
        assert data.get("version") == "1.0"
        assert isinstance(data.get("id_prefixes"), dict)
        assert isinstance(data.get("sheets"), dict)
        assert isinstance(data.get("relations"), dict)
        assert isinstance(data.get("normalization_rules"), dict)

        # id_prefixes must at least contain servicio/conductor/equipo/vehiculo
        for k, v in EXPECTED_ID_PREFIXES.items():
            assert data["id_prefixes"].get(k) == v, f"id_prefix['{k}'] should be '{v}'"

        # 5 declared sheets
        assert EXPECTED_SHEETS.issubset(set(data["sheets"].keys())), (
            f"missing sheets: {EXPECTED_SHEETS - set(data['sheets'].keys())}"
        )

    def test_get_schema_servicios_shape(self, api_client):
        r = requests.get(f"{API}/schema/servicios", timeout=15)
        assert r.status_code == 200, r.text
        d = r.json()
        assert d.get("primaryKey") == "id_servicio"
        assert d.get("db_table") == "services"
        cols = d.get("columns")
        assert isinstance(cols, list)
        assert len(cols) >= 40, f"expected >=40 columns, got {len(cols)}"

        # every column has at least name + type
        for c in cols:
            assert isinstance(c.get("name"), str) and c["name"]
            assert isinstance(c.get("type"), str) and c["type"]

    def test_get_schema_unknown_sheet_returns_404(self, api_client):
        r = requests.get(f"{API}/schema/no_existe", timeout=15)
        assert r.status_code == 404
        assert r.json().get("error") == "sheet_no_declarada"


# ─── Protected: generate-id ─────────────────────────────────────────────────
class TestSchemaGenerateId:
    def test_generate_id_servicio_returns_srv_prefix(self, api_client, admin_headers):
        r = api_client.get(f"{API}/schema/generate-id/servicio", headers=admin_headers, timeout=15)
        assert r.status_code == 200, r.text
        d = r.json()
        assert "id" in d
        assert isinstance(d["id"], str)
        assert d["id"].startswith("SRV-"), f"expected SRV- prefix, got {d['id']!r}"
        # Must have a non-trivial suffix (not just the prefix)
        assert len(d["id"]) > len("SRV-")

    def test_generate_id_conductor_returns_cond_prefix(self, api_client, admin_headers):
        r = api_client.get(f"{API}/schema/generate-id/conductor", headers=admin_headers, timeout=15)
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["id"].startswith("COND-")
        assert len(d["id"]) > len("COND-")

    def test_generate_id_without_auth_returns_401(self, api_client):
        r = requests.get(f"{API}/schema/generate-id/servicio", timeout=15)
        assert r.status_code == 401


# ─── Protected: import / import-all / normalize (no Sheets) ─────────────────
class TestSchemaMutationsNoSheets:
    def test_import_without_auth_returns_401(self, api_client):
        r = requests.post(
            f"{API}/schema/import",
            json={"hoja": "servicios"},
            headers={"Content-Type": "application/json"},
            timeout=15,
        )
        assert r.status_code == 401

    def test_import_admin_no_sheets_returns_400_sheets_no_configurado(
        self, api_client, admin_headers
    ):
        r = api_client.post(
            f"{API}/schema/import",
            headers=admin_headers,
            json={"hoja": "servicios"},
            timeout=15,
        )
        assert r.status_code == 400, r.text
        assert r.json().get("error") == "sheets_no_configurado"

    def test_import_all_admin_no_sheets_returns_400(self, api_client, admin_headers):
        r = api_client.post(f"{API}/schema/import-all", headers=admin_headers, json={}, timeout=15)
        assert r.status_code == 400, r.text
        assert r.json().get("error") == "sheets_no_configurado"

    def test_normalize_admin_no_sheets_returns_400(self, api_client, admin_headers):
        r = api_client.post(f"{API}/schema/normalize", headers=admin_headers, json={}, timeout=15)
        assert r.status_code == 400, r.text
        assert r.json().get("error") == "sheets_no_configurado"


# ─── Protected: validate ────────────────────────────────────────────────────
class TestSchemaValidate:
    def test_validate_unknown_sheet_returns_400_sheet_no_declarada(
        self, api_client, admin_headers
    ):
        r = api_client.post(
            f"{API}/schema/validate",
            headers=admin_headers,
            json={"hoja": "no_existe"},
            timeout=15,
        )
        assert r.status_code == 400
        d = r.json()
        assert d.get("error") == "sheet_no_declarada"

    def test_validate_servicios_no_sheets_returns_400_sheets_no_configurado(
        self, api_client, admin_headers
    ):
        r = api_client.post(
            f"{API}/schema/validate",
            headers=admin_headers,
            json={"hoja": "servicios"},
            timeout=15,
        )
        assert r.status_code == 400
        assert r.json().get("error") == "sheets_no_configurado"


# ─── Protected: preview ─────────────────────────────────────────────────────
class TestSchemaPreview:
    def test_preview_servicios_no_sheets_returns_400_sheets_no_configurado(
        self, api_client, admin_headers
    ):
        r = api_client.get(
            f"{API}/schema/preview/servicios", headers=admin_headers, timeout=15
        )
        assert r.status_code == 400
        assert r.json().get("error") == "sheets_no_configurado"


# ─── Regressions ────────────────────────────────────────────────────────────
class TestRegressions:
    def test_auth_login_admin_still_works(self, api_client):
        r = api_client.post(
            f"{API}/auth/login",
            json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD},
            timeout=15,
        )
        assert r.status_code == 200
        d = r.json()
        assert d.get("token")
        assert d["user"]["email"] == ADMIN_EMAIL

    def test_get_settings_admin_still_returns_five_keys(self, api_client, admin_headers):
        r = api_client.get(f"{API}/settings", headers=admin_headers, timeout=15)
        assert r.status_code == 200
        keys = set(r.json().keys())
        expected = {
            "stripe_secret_key",
            "stripe_publishable_key",
            "stripe_webhook_secret",
            "google_sheets_id",
            "google_service_account_key",
        }
        assert keys == expected, f"unexpected keys: {keys}"

    def test_sheets_status_still_not_configured(self, api_client, admin_headers):
        r = api_client.get(f"{API}/sheets/status", headers=admin_headers, timeout=15)
        assert r.status_code == 200
        assert r.json().get("conectado") is False

    def test_create_payment_intent_still_returns_503_stripe_not_configured(self, api_client):
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
        assert r.json().get("error") == "STRIPE_NOT_CONFIGURED"
