import { db, appSettingsTable } from "@workspace/db";
import { eq } from "drizzle-orm";

/** Keys stored in the `app_settings` table. */
export const SETTING_KEYS = [
  "stripe_secret_key",
  "stripe_publishable_key",
  "stripe_webhook_secret",
  "google_sheets_id",
  "google_service_account_key", // raw JSON (or base64) of the service-account
] as const;
export type SettingKey = (typeof SETTING_KEYS)[number];

const SECRET_KEYS: SettingKey[] = ["stripe_secret_key", "stripe_webhook_secret", "google_service_account_key"];

// tiny in-memory cache to avoid a DB round-trip on every request
const cache: Partial<Record<SettingKey, string | null>> = {};
let cacheAt = 0;
const CACHE_TTL_MS = 5_000;

async function loadAll(): Promise<void> {
  const rows = await db.select().from(appSettingsTable);
  for (const k of SETTING_KEYS) cache[k] = null;
  for (const row of rows) {
    if ((SETTING_KEYS as readonly string[]).includes(row.key)) {
      cache[row.key as SettingKey] = row.value ?? null;
    }
  }
  cacheAt = Date.now();
}

async function ensureFresh(): Promise<void> {
  if (Date.now() - cacheAt > CACHE_TTL_MS) await loadAll();
}

export async function getSetting(key: SettingKey): Promise<string | null> {
  await ensureFresh();
  const dbVal = cache[key];
  if (dbVal && dbVal.trim().length > 0) return dbVal;

  // Fallback to env var (uppercased)
  const envVal = process.env[key.toUpperCase()];
  return envVal && envVal.trim().length > 0 ? envVal : null;
}

export async function setSetting(key: SettingKey, value: string | null, updatedBy: string): Promise<void> {
  await db
    .insert(appSettingsTable)
    .values({ key, value: value ?? "", updated_by: updatedBy })
    .onConflictDoUpdate({
      target: appSettingsTable.key,
      set: { value: value ?? "", updated_by: updatedBy, updated_at: new Date() },
    });
  cache[key] = value ?? "";
  cacheAt = Date.now();
}

export async function getAllSettings(): Promise<Record<SettingKey, { configured: boolean; masked: string | null }>> {
  const result: Record<string, { configured: boolean; masked: string | null }> = {};
  for (const k of SETTING_KEYS) {
    const v = await getSetting(k);
    const configured = !!v;
    let masked: string | null = null;
    if (v) {
      if (SECRET_KEYS.includes(k)) {
        // Mask secrets: show first 6 and last 4 chars
        masked = v.length > 12 ? `${v.slice(0, 6)}…${v.slice(-4)}` : "••••••";
      } else {
        masked = v;
      }
    }
    result[k] = { configured, masked };
  }
  return result as Record<SettingKey, { configured: boolean; masked: string | null }>;
}
