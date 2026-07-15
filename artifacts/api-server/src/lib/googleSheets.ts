/**
 * Google Sheets service (Service Account auth).
 *
 * Env vars:
 *   GOOGLE_SHEETS_ID                  – target spreadsheet id (required)
 *   GOOGLE_SERVICE_ACCOUNT_KEY        – JSON string with service account credentials
 *                                       OR
 *   GOOGLE_SERVICE_ACCOUNT_KEY_PATH   – path to a service-account JSON file
 *   GOOGLE_SHEETS_NAME (optional)     – human name shown in status endpoint
 */
import { google, sheets_v4 } from "googleapis";
import { JWT } from "google-auth-library";
import { getSetting } from "./settings";

const SCOPES = ["https://www.googleapis.com/auth/spreadsheets"];

let _sheetsCache: { sheets: sheets_v4.Sheets; spreadsheetId: string; signature: string } | null = null;
let _lastError: string | null = null;

async function readServiceAccount(): Promise<Record<string, unknown> | null> {
  const raw = (await getSetting("google_service_account_key")) ?? undefined;
  if (raw) {
    try {
      const decoded = raw.trim().startsWith("{")
        ? raw
        : Buffer.from(raw, "base64").toString("utf8");
      return JSON.parse(decoded);
    } catch (e: any) {
      _lastError = `GOOGLE_SERVICE_ACCOUNT_KEY parse error: ${e.message}`;
      return null;
    }
  }
  const path = process.env.GOOGLE_SERVICE_ACCOUNT_KEY_PATH;
  if (path) {
    try {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const fs = require("node:fs");
      return JSON.parse(fs.readFileSync(path, "utf8"));
    } catch (e: any) {
      _lastError = `GOOGLE_SERVICE_ACCOUNT_KEY_PATH read error: ${e.message}`;
      return null;
    }
  }
  return null;
}

export async function getSpreadsheetId(): Promise<string | null> {
  return (await getSetting("google_sheets_id")) ?? null;
}

export function getLastError(): string | null {
  return _lastError;
}

export async function isConfigured(): Promise<boolean> {
  return !!(await getSpreadsheetId()) && !!(await readServiceAccount());
}

export async function getSheetsClient(): Promise<{ sheets: sheets_v4.Sheets; spreadsheetId: string } | null> {
  const key = await readServiceAccount();
  const spreadsheetId = await getSpreadsheetId();
  if (!key || !spreadsheetId) return null;

  const signature = `${spreadsheetId}::${(key.private_key_id as string) ?? ""}`;
  if (_sheetsCache && _sheetsCache.signature === signature) {
    return { sheets: _sheetsCache.sheets, spreadsheetId: _sheetsCache.spreadsheetId };
  }
  const auth = new JWT({
    email: key.client_email as string,
    key: key.private_key as string,
    scopes: SCOPES,
  });
  const sheets = google.sheets({ version: "v4", auth });
  _sheetsCache = { sheets, spreadsheetId, signature };
  _lastError = null;
  return { sheets, spreadsheetId };
}

export async function listSheetTabs(): Promise<string[]> {
  const c = await getSheetsClient();
  if (!c) return [];
  const meta = await c.sheets.spreadsheets.get({ spreadsheetId: c.spreadsheetId });
  return (meta.data.sheets ?? [])
    .map((s) => s.properties?.title)
    .filter((t): t is string => !!t);
}

export async function getSpreadsheetName(): Promise<string | null> {
  const c = await getSheetsClient();
  if (!c) return null;
  const meta = await c.sheets.spreadsheets.get({ spreadsheetId: c.spreadsheetId, fields: "properties(title)" });
  return meta.data.properties?.title ?? null;
}

export async function readSheet(sheetName: string, range?: string): Promise<any[][]> {
  const c = await getSheetsClient();
  if (!c) throw new Error("Google Sheets no configurado");
  const r = range ?? `${sheetName}!A:ZZ`;
  const resp = await c.sheets.spreadsheets.values.get({ spreadsheetId: c.spreadsheetId, range: r });
  return resp.data.values ?? [];
}

export async function writeSheet(sheetName: string, rows: any[][]): Promise<number> {
  const c = await getSheetsClient();
  if (!c) throw new Error("Google Sheets no configurado");

  const existing = await listSheetTabs();
  if (!existing.includes(sheetName)) {
    await c.sheets.spreadsheets.batchUpdate({
      spreadsheetId: c.spreadsheetId,
      requestBody: { requests: [{ addSheet: { properties: { title: sheetName } } }] },
    });
  }
  await c.sheets.spreadsheets.values.clear({
    spreadsheetId: c.spreadsheetId,
    range: `${sheetName}!A:ZZ`,
  });
  const resp = await c.sheets.spreadsheets.values.update({
    spreadsheetId: c.spreadsheetId,
    range: `${sheetName}!A1`,
    valueInputOption: "RAW",
    requestBody: { values: rows },
  });
  return resp.data.updatedRows ?? 0;
}
