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

const SCOPES = ["https://www.googleapis.com/auth/spreadsheets"];

let _sheets: sheets_v4.Sheets | null = null;
let _spreadsheetId: string | null = null;
let _lastError: string | null = null;

function readServiceAccount(): Record<string, unknown> | null {
  const raw = process.env.GOOGLE_SERVICE_ACCOUNT_KEY;
  if (raw) {
    try {
      // Support both raw JSON and base64-encoded JSON
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

export function getSpreadsheetId(): string | null {
  return process.env.GOOGLE_SHEETS_ID ?? null;
}

export function getLastError(): string | null {
  return _lastError;
}

export function isConfigured(): boolean {
  return !!getSpreadsheetId() && !!readServiceAccount();
}

export async function getSheetsClient(): Promise<sheets_v4.Sheets | null> {
  if (_sheets) return _sheets;
  const key = readServiceAccount();
  const spreadsheetId = getSpreadsheetId();
  if (!key || !spreadsheetId) return null;

  const auth = new JWT({
    email: key.client_email as string,
    key: key.private_key as string,
    scopes: SCOPES,
  });
  _sheets = google.sheets({ version: "v4", auth });
  _spreadsheetId = spreadsheetId;
  return _sheets;
}

export async function listSheetTabs(): Promise<string[]> {
  const sheets = await getSheetsClient();
  if (!sheets || !_spreadsheetId) return [];
  const meta = await sheets.spreadsheets.get({ spreadsheetId: _spreadsheetId });
  return (meta.data.sheets ?? [])
    .map((s) => s.properties?.title)
    .filter((t): t is string => !!t);
}

export async function getSpreadsheetName(): Promise<string | null> {
  const sheets = await getSheetsClient();
  if (!sheets || !_spreadsheetId) return null;
  const meta = await sheets.spreadsheets.get({ spreadsheetId: _spreadsheetId, fields: "properties(title)" });
  return meta.data.properties?.title ?? null;
}

export async function readSheet(sheetName: string, range?: string): Promise<any[][]> {
  const sheets = await getSheetsClient();
  if (!sheets || !_spreadsheetId) throw new Error("Google Sheets no configurado");
  const r = range ?? `${sheetName}!A:ZZ`;
  const resp = await sheets.spreadsheets.values.get({
    spreadsheetId: _spreadsheetId,
    range: r,
  });
  return resp.data.values ?? [];
}

/** Overwrite the entire tab starting at A1 with `rows`. Sheet is cleared first. */
export async function writeSheet(sheetName: string, rows: any[][]): Promise<number> {
  const sheets = await getSheetsClient();
  if (!sheets || !_spreadsheetId) throw new Error("Google Sheets no configurado");

  // Ensure the tab exists (create if not)
  const existing = await listSheetTabs();
  if (!existing.includes(sheetName)) {
    await sheets.spreadsheets.batchUpdate({
      spreadsheetId: _spreadsheetId,
      requestBody: {
        requests: [{ addSheet: { properties: { title: sheetName } } }],
      },
    });
  }

  await sheets.spreadsheets.values.clear({
    spreadsheetId: _spreadsheetId,
    range: `${sheetName}!A:ZZ`,
  });
  const resp = await sheets.spreadsheets.values.update({
    spreadsheetId: _spreadsheetId,
    range: `${sheetName}!A1`,
    valueInputOption: "RAW",
    requestBody: { values: rows },
  });
  return resp.data.updatedRows ?? 0;
}
