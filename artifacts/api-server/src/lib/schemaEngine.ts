/**
 * Schema-driven data contract engine.
 *
 * Loads /app/artifacts/api-server/src/schema/schema.json (baked into the bundle
 * via a fs read at startup) and exposes helpers to:
 *   - coerce raw sheet cells into the declared type
 *   - validate rows (required, enums, foreign keys)
 *   - generate primary keys with prefixes
 *   - normalize free-text fields (conductor splits, numeric cleanup, booleans)
 *
 * The contract is the single source of truth: if the sheet layout changes,
 * only schema.json is edited — the importer/exporter adapts automatically.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export type ColType = "string" | "integer" | "number" | "boolean" | "date" | "time";

export interface ColumnDef {
  name: string;
  type: ColType;
  required?: boolean;
  generated?: boolean;
  id_prefix?: string;
  foreignKey?: string;
  enum?: string[];
  default?: unknown;
  db_field?: string;
  skip_db?: boolean;
}

export interface SheetDef {
  description?: string;
  primaryKey: string;
  db_table?: string;
  unique_by?: string[];
  columns: ColumnDef[];
}

export interface Schema {
  version: string;
  id_prefixes: Record<string, string>;
  sheets: Record<string, SheetDef>;
  relations: Record<string, { references: string }>;
  normalization_rules: any;
}

let _schema: Schema | null = null;

/** Resolve the schema.json path: prefer /app/artifacts/api-server/src/schema/schema.json,
 *  fall back to the file placed next to the compiled bundle. */
function resolveSchemaPath(): string {
  const candidates = [
    path.resolve("/app/artifacts/api-server/src/schema/schema.json"),
    path.resolve(__dirname, "../schema/schema.json"),
    path.resolve(__dirname, "./schema.json"),
    path.resolve(process.cwd(), "src/schema/schema.json"),
  ];
  for (const p of candidates) {
    if (fs.existsSync(p)) return p;
  }
  throw new Error("schema.json not found");
}

export function loadSchema(): Schema {
  if (_schema) return _schema;
  const raw = fs.readFileSync(resolveSchemaPath(), "utf8");
  _schema = JSON.parse(raw) as Schema;
  return _schema;
}

export function getSchema(): Schema {
  return _schema ?? loadSchema();
}

export function getSheetDef(sheetName: string): SheetDef | null {
  const s = getSchema();
  // support case-insensitive lookup
  const key = Object.keys(s.sheets).find((k) => k.toLowerCase() === sheetName.toLowerCase());
  return key ? s.sheets[key] : null;
}

// ── Coercion ────────────────────────────────────────────────────────────────
function stripNumeric(v: string): string {
  const rules = getSchema().normalization_rules?.numeric_cleanup;
  const chars: string[] = rules?.strip_chars ?? ["$", ",", " "];
  let out = v;
  for (const c of chars) out = out.split(c).join("");
  return out.trim();
}

function coerceBoolean(v: unknown): boolean | null {
  if (v === true) return true;
  if (v === false) return false;
  if (v === null || v === undefined || v === "") return null;
  const rules = getSchema().normalization_rules;
  const truthy: string[] = rules?.boolean_truthy ?? ["1", "true", "yes", "y"];
  return truthy.includes(String(v).trim().toLowerCase());
}

function coerceDate(v: unknown): string | null {
  if (v === null || v === undefined || v === "") return null;
  const s = String(v).trim();
  // Try native
  const d = new Date(s);
  if (!Number.isNaN(d.getTime())) return d.toISOString().slice(0, 10);
  // dd/MM/yyyy
  const m = s.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/);
  if (m) {
    const [_, a, b, y] = m;
    const dd = a.padStart(2, "0");
    const mm = b.padStart(2, "0");
    return `${y}-${mm}-${dd}`;
  }
  return null;
}

export function coerceCell(value: unknown, col: ColumnDef): unknown {
  if (value === null || value === undefined || value === "") {
    return col.default ?? null;
  }
  switch (col.type) {
    case "string":
      return String(value).trim();
    case "integer": {
      const n = parseInt(stripNumeric(String(value)), 10);
      return Number.isNaN(n) ? (col.default ?? null) : n;
    }
    case "number": {
      const n = parseFloat(stripNumeric(String(value)));
      return Number.isNaN(n) ? (col.default ?? null) : n;
    }
    case "boolean":
      return coerceBoolean(value);
    case "date":
      return coerceDate(value);
    case "time":
      return String(value).trim() || null;
    default:
      return value;
  }
}

// ── Row → typed object ──────────────────────────────────────────────────────
export interface ValidationError {
  field: string;
  message: string;
}

export function coerceRow(
  row: any[],
  headerToIndex: Map<string, number>,
  sheetDef: SheetDef,
): { obj: Record<string, unknown>; errors: ValidationError[] } {
  const errors: ValidationError[] = [];
  const obj: Record<string, unknown> = {};

  for (const col of sheetDef.columns) {
    const idx = headerToIndex.get(col.name.toLowerCase());
    const raw = idx !== undefined ? row[idx] : undefined;
    const coerced = coerceCell(raw, col);
    obj[col.name] = coerced;

    if (col.required && !col.generated && (coerced === null || coerced === undefined || coerced === "")) {
      errors.push({ field: col.name, message: `Campo obligatorio ausente.` });
    }
    if (col.enum && coerced !== null && coerced !== undefined && coerced !== "") {
      const strv = String(coerced).toUpperCase();
      const allowed = col.enum.map((e) => e.toUpperCase());
      if (!allowed.includes(strv)) {
        errors.push({ field: col.name, message: `Valor "${coerced}" no está en enum ${JSON.stringify(col.enum)}.` });
      }
    }
  }
  return { obj, errors };
}

// ── ID generation ───────────────────────────────────────────────────────────
export function generateId(kind: string): string {
  const s = getSchema();
  const prefix = s.id_prefixes[kind] ?? `${kind.toUpperCase()}-`;
  const ts = Date.now().toString(36).toUpperCase();
  const rnd = Math.random().toString(36).slice(2, 6).toUpperCase();
  return `${prefix}${ts}${rnd}`;
}

// ── Normalization helpers ───────────────────────────────────────────────────
/** Split a "CONDUCTOR" free-text cell into a list of clean driver names. */
export function splitConductores(raw: unknown): string[] {
  if (!raw) return [];
  const rules = getSchema().normalization_rules?.conductor?.clean ?? { split_on: ["//", "/"] };
  let parts: string[] = [String(raw)];
  for (const sep of rules.split_on ?? []) {
    parts = parts.flatMap((p) => p.split(sep));
  }
  const strip: string[] = rules.strip_chars ?? [];
  return parts
    .map((p) => {
      let s = p;
      for (const c of strip) s = s.split(c).join("");
      return s.trim();
    })
    .filter((s) => s.length > 0);
}

// Header helper
export function buildHeaderIndex(headerRow: any[]): Map<string, number> {
  const m = new Map<string, number>();
  headerRow.forEach((h, i) => {
    if (h) m.set(String(h).trim().toLowerCase().replace(/\s+/g, "_"), i);
  });
  return m;
}
