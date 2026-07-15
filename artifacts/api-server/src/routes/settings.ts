import { Router } from "express";
import { getAllSettings, setSetting, SETTING_KEYS, type SettingKey, getSetting } from "../lib/settings";
import Stripe from "stripe";
import { google } from "googleapis";
import { JWT } from "google-auth-library";

const router = Router();

function requireAdmin(req: any, res: any, next: any) {
  const rol = req.user?.rol;
  if (rol !== "ADMIN" && rol !== "GERENCIA") {
    res.status(403).json({ error: "requiere_admin", message: "Solo ADMIN o GERENCIA pueden modificar la configuración." });
    return;
  }
  next();
}

// GET /api/settings  – masked view of every setting (admin/gerencia only)
router.get("/settings", requireAdmin, async (_req, res) => {
  const all = await getAllSettings();
  res.json(all);
});

// PUT /api/settings/:key  – { value: string }
router.put("/settings/:key", requireAdmin, async (req, res) => {
  const key = req.params.key as SettingKey;
  if (!(SETTING_KEYS as readonly string[]).includes(key)) {
    res.status(400).json({ error: "invalid_key", allowed: SETTING_KEYS });
    return;
  }
  const value = typeof req.body?.value === "string" ? req.body.value : "";
  const updatedBy = (req as any).user?.nombre ?? "sistema";

  // Light validation on Stripe/Google keys
  if (key === "stripe_secret_key" && value && !/^sk_(test|live)_[A-Za-z0-9]{20,}$/.test(value)) {
    res.status(400).json({ error: "stripe_key_invalido", message: "Debe comenzar con sk_test_ o sk_live_ y tener al menos 24 caracteres." });
    return;
  }
  if (key === "stripe_publishable_key" && value && !/^pk_(test|live)_[A-Za-z0-9]{20,}$/.test(value)) {
    res.status(400).json({ error: "stripe_pk_invalido", message: "Debe comenzar con pk_test_ o pk_live_." });
    return;
  }
  if (key === "stripe_webhook_secret" && value && !/^whsec_[A-Za-z0-9]{20,}$/.test(value)) {
    res.status(400).json({ error: "stripe_whsec_invalido", message: "Debe comenzar con whsec_ y tener al menos 26 caracteres." });
    return;
  }
  if (key === "google_service_account_key" && value) {
    try {
      const decoded = value.trim().startsWith("{") ? value : Buffer.from(value, "base64").toString("utf8");
      const parsed = JSON.parse(decoded);
      if (!parsed.client_email || !parsed.private_key) {
        throw new Error("Falta client_email o private_key en el JSON.");
      }
    } catch (e: any) {
      res.status(400).json({ error: "service_account_invalido", message: e.message });
      return;
    }
  }

  await setSetting(key, value, updatedBy);
  res.json({ success: true, key, updated_by: updatedBy });
});

// POST /api/settings/test/stripe  – call Stripe API to validate the key
router.post("/settings/test/stripe", requireAdmin, async (_req, res) => {
  const key = await getSetting("stripe_secret_key");
  if (!key) { res.json({ ok: false, error: "no_configurado" }); return; }
  try {
    const stripe = new Stripe(key);
    const balance = await stripe.balance.retrieve();
    res.json({
      ok: true,
      livemode: balance.livemode,
      currencies: (balance.available ?? []).map((b) => b.currency),
    });
  } catch (e: any) {
    res.status(400).json({ ok: false, error: e.message });
  }
});

// POST /api/settings/test/sheets  – open the spreadsheet & list tabs
router.post("/settings/test/sheets", requireAdmin, async (_req, res) => {
  const spreadsheetId = await getSetting("google_sheets_id");
  const rawKey = await getSetting("google_service_account_key");
  if (!spreadsheetId || !rawKey) { res.json({ ok: false, error: "no_configurado" }); return; }
  try {
    const decoded = rawKey.trim().startsWith("{") ? rawKey : Buffer.from(rawKey, "base64").toString("utf8");
    const parsed = JSON.parse(decoded);
    const auth = new JWT({
      email: parsed.client_email,
      key: parsed.private_key,
      scopes: ["https://www.googleapis.com/auth/spreadsheets"],
    });
    const sheets = google.sheets({ version: "v4", auth });
    const meta = await sheets.spreadsheets.get({ spreadsheetId });
    res.json({
      ok: true,
      spreadsheet_name: meta.data.properties?.title ?? null,
      hojas: (meta.data.sheets ?? []).map((s) => s.properties?.title).filter(Boolean),
    });
  } catch (e: any) {
    res.status(400).json({ ok: false, error: e.message });
  }
});

export default router;
