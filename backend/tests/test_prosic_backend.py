"""PROSIC backend regression tests.

Covers:
- Auth (login OK / invalid credentials / /auth/me)
- Google Sheets endpoints when NOT configured (status/sync/import/history)
- Rentals public: identity scoring + Stripe payment intent (503 when placeholder) + payment-status 404
- Quotes: postal-zones, create quote, list quotes (auth), equipment public list
"""
from __future__ import annotations

import os
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "http://127.0.0.1:8001").rstrip("/")
API = f"{BASE_URL}/api"

ADMIN_EMAIL = "admin@prosic.mx"
ADMIN_PASSWORD = "prosic123"


# ─── Fixtures ────────────────────────────────────────────────────────────────
@pytest.fixture(scope="session")
def api_client() -> requests.Session:
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    return s


@pytest.fixture(scope="session")
def auth_token(api_client) -> str:
    r = api_client.post(
        f"{API}/auth/login",
        json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD},
        timeout=15,
    )
    assert r.status_code == 200, f"login failed: {r.status_code} {r.text}"
    data = r.json()
    assert "token" in data and data["token"]
    return data["token"]


@pytest.fixture(scope="session")
def auth_headers(auth_token) -> dict:
    return {"Authorization": f"Bearer {auth_token}", "Content-Type": "application/json"}


# ─── Auth ────────────────────────────────────────────────────────────────────
class TestAuth:
    def test_login_success(self, api_client):
        r = api_client.post(
            f"{API}/auth/login",
            json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD},
            timeout=15,
        )
        assert r.status_code == 200
        data = r.json()
        assert "token" in data and isinstance(data["token"], str) and data["token"]
        assert "user" in data
        assert data["user"]["email"] == ADMIN_EMAIL
        assert data["user"]["rol"] == "ADMIN"

    def test_login_invalid_credentials(self, api_client):
        r = api_client.post(
            f"{API}/auth/login",
            json={"email": ADMIN_EMAIL, "password": "wrongpass"},
            timeout=15,
        )
        assert r.status_code == 401
        data = r.json()
        assert "error" in data or "message" in data

    def test_me_with_token(self, api_client, auth_headers):
        r = api_client.get(f"{API}/auth/me", headers=auth_headers, timeout=15)
        assert r.status_code == 200
        data = r.json()
        assert data["email"] == ADMIN_EMAIL
        assert data["rol"] == "ADMIN"


# ─── Google Sheets (not configured) ──────────────────────────────────────────
class TestSheets:
    def test_status_not_configured(self, api_client, auth_headers):
        r = api_client.get(f"{API}/sheets/status", headers=auth_headers, timeout=15)
        assert r.status_code == 200, f"unexpected: {r.status_code} {r.text[:200]}"
        data = r.json()
        assert data.get("conectado") is False
        # Contract fields
        for k in ("spreadsheet_id", "hojas_disponibles", "ultima_sincronizacion"):
            assert k in data

    def test_sync_export_400_when_unconfigured(self, api_client, auth_headers):
        r = api_client.post(
            f"{API}/sheets/sync",
            headers=auth_headers,
            json={"direction": "export"},
            timeout=15,
        )
        assert r.status_code == 400
        data = r.json()
        assert data.get("success") is False
        assert data.get("errores") and len(data["errores"]) > 0

    def test_import_400_when_unconfigured(self, api_client, auth_headers):
        r = api_client.post(
            f"{API}/sheets/import",
            headers=auth_headers,
            json={"hoja": "REPORTE"},
            timeout=15,
        )
        assert r.status_code == 400
        data = r.json()
        assert data.get("success") is False
        assert data.get("errores") and len(data["errores"]) > 0

    def test_history_returns_array(self, api_client, auth_headers):
        r = api_client.get(f"{API}/sheets/history", headers=auth_headers, timeout=15)
        assert r.status_code == 200
        data = r.json()
        assert isinstance(data, list)


# ─── Rentals public (identity + Stripe) ──────────────────────────────────────
class TestRentalsPublic:
    def test_validate_identity_ok(self, api_client):
        payload = {
            "rfc": "MELM8305281H0",           # RFC física válido: 4 letras + 6 dig + 3 alfanum
            "curp": "MELM830528HDFRRR09",     # CURP formato válido
            "nombre": "Mario Lopez Perez",
            "email": "mario@example.com",
            "telefono": "5551234567",
            "direccion": "Av Reforma 123, CDMX",
        }
        r = api_client.post(f"{API}/rentals/validate-identity", json=payload, timeout=15)
        assert r.status_code == 200
        data = r.json()
        assert "score" in data and "aprobado" in data
        # With RFC(35)+CURP(30)+nombre(10)+email(10)+telefono(10)+direccion(5) = 100
        assert data["score"] >= 95, f"score too low: {data}"
        assert data["aprobado"] is True

    def test_create_payment_intent_stripe_placeholder(self, api_client):
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
        r = api_client.post(
            f"{API}/rentals/create-payment-intent", json=payload, timeout=20
        )
        # Placeholder key: 503 STRIPE_NOT_CONFIGURED (if key empty) OR 500 with Stripe error
        assert r.status_code in (500, 503), f"unexpected: {r.status_code} {r.text[:200]}"
        data = r.json()
        assert "error" in data
        if r.status_code == 503:
            assert data["error"] == "STRIPE_NOT_CONFIGURED"
        else:
            # Stripe SDK error – message should mention Api Key / auth
            msg = str(data["error"]).lower()
            assert (
                "api key" in msg
                or "authentication" in msg
                or "invalid" in msg
                or "stripe" in msg
            ), f"unexpected error message: {data['error']}"

    def test_payment_status_not_found(self, api_client):
        r = api_client.get(
            f"{API}/rentals/payment-status/pi_does_not_exist_123", timeout=15
        )
        assert r.status_code == 404
        data = r.json()
        assert "error" in data


# ─── Quotes ──────────────────────────────────────────────────────────────────
class TestQuotes:
    def test_postal_zone_06000(self, api_client):
        r = api_client.get(f"{API}/quotes/postal-zones", params={"cp": "06000"}, timeout=15)
        assert r.status_code == 200
        data = r.json()
        assert data["zona"] == "ZONA_1"
        assert float(data["tarifa_flete"]) == 1800

    def test_create_quote(self, api_client):
        payload = {
            "codigo_postal": "06000",
            "modelo": "MONTACARGAS HYSTER H80",
            "dias_renta": 3,
            "tipo_persona": "FISICA",
            "nombre_contacto": "Mario Test",
            "email": "mario@example.com",
            "telefono": "5551234567",
        }
        r = api_client.post(f"{API}/quotes", json=payload, timeout=15)
        assert r.status_code == 201, f"{r.status_code} {r.text[:200]}"
        q = r.json()
        assert q.get("folio")
        assert float(q["subtotal"]) > 0
        assert float(q["iva"]) > 0
        assert float(q["monto_total"]) > 0
        # subtotal = flete(1800) + rate(350)*3 = 2850  → total = 2850 * 1.16 = 3306
        assert abs(float(q["subtotal"]) - 2850) < 1
        assert abs(float(q["monto_total"]) - 3306) < 1

    def test_list_quotes_with_token(self, api_client, auth_headers):
        r = api_client.get(f"{API}/quotes", headers=auth_headers, timeout=15)
        assert r.status_code == 200
        data = r.json()
        assert isinstance(data, list)


# ─── Equipment public ────────────────────────────────────────────────────────
class TestEquipmentPublic:
    def test_equipment_public_list(self, api_client):
        # Real public endpoint is /equipment/catalog (see equipment_public.ts)
        r = api_client.get(f"{API}/equipment/catalog", timeout=15)
        assert r.status_code == 200, f"{r.status_code} {r.text[:200]}"
        data = r.json()
        assert isinstance(data, list)
        # At least some equipment should be 'disponible' (may be empty if no seed)
        if data:
            statuses = {e.get("status") for e in data}
            assert "disponible" in statuses or all(
                e.get("status") in ("disponible", None) for e in data
            )
