/**
 * Schema-driven importer.
 *
 * Reads any tab from Google Sheets, validates rows against schema.json,
 * coerces types, applies normalization rules, and upserts into the mapped
 * database table using raw SQL (so it stays generic).
 *
 * The DB column list is derived from Postgres information_schema at first use,
 * so schemas can evolve without redeploying.
 */
import { pool } from "@workspace/db";
import {
  getSchema,
  getSheetDef,
  coerceRow,
  buildHeaderIndex,
  generateId,
  splitConductores,
  type ColumnDef,
  type SheetDef,
} from "./schemaEngine";
import { readSheet } from "./googleSheets";

const dbColsCache = new Map<string, Set<string>>();

async function getDbColumns(table: string): Promise<Set<string>> {
  if (dbColsCache.has(table)) return dbColsCache.get(table)!;
  const r = await pool.query<{ column_name: string }>(
    `SELECT column_name FROM information_schema.columns WHERE table_schema='public' AND table_name = $1`,
    [table],
  );
  const set = new Set(r.rows.map((x) => x.column_name));
  dbColsCache.set(table, set);
  return set;
}

/** Return the effective DB column name for a schema column, or null to skip. */
function toDbField(col: ColumnDef, dbCols: Set<string>): string | null {
  if (col.skip_db) return null;
  const candidate = col.db_field ?? col.name;
  return dbCols.has(candidate) ? candidate : null;
}

export interface ImportResult {
  hoja: string;
  db_table: string;
  total_filas: number;
  insertados: number;
  actualizados: number;
  omitidos: number;
  errores: { fila: number; campo?: string; message: string }[];
}

/** Upsert one row into `db_table` respecting unique_by clause. */
async function upsertRow(
  sheetDef: SheetDef,
  obj: Record<string, unknown>,
  dbCols: Set<string>,
): Promise<{ inserted: boolean; updated: boolean }> {
  const table = sheetDef.db_table!;
  const cols: string[] = [];
  const vals: unknown[] = [];
  for (const col of sheetDef.columns) {
    const dbField = toDbField(col, dbCols);
    if (!dbField) continue;
    let v = obj[col.name];
    // Special case: schema `activo` boolean but null → default true handled by coerce; keep null → skip
    if (v === undefined) continue;
    // For enum-constrained DB fields, uppercase strings
    if (col.enum && typeof v === "string") v = v.toUpperCase();
    cols.push(dbField);
    vals.push(v);
  }
  if (cols.length === 0) return { inserted: false, updated: false };

  const placeholders = cols.map((_, i) => `$${i + 1}`).join(",");
  const uniqueBy = sheetDef.unique_by ?? [];
  const conflictCols = uniqueBy
    .map((f) => {
      const c = sheetDef.columns.find((x) => x.name === f);
      const dbf = c ? toDbField(c, dbCols) : null;
      return dbf;
    })
    .filter((x): x is string => !!x);

  if (conflictCols.length === 0) {
    const q = `INSERT INTO "${table}" (${cols.map((c) => `"${c}"`).join(",")}) VALUES (${placeholders}) RETURNING id`;
    const r = await pool.query(q, vals);
    return { inserted: r.rowCount === 1, updated: false };
  }

  const updateSet = cols
    .filter((c) => !conflictCols.includes(c))
    .map((c) => `"${c}" = EXCLUDED."${c}"`)
    .join(",");
  const q = `INSERT INTO "${table}" (${cols.map((c) => `"${c}"`).join(",")}) VALUES (${placeholders})
             ON CONFLICT (${conflictCols.map((c) => `"${c}"`).join(",")})
             ${updateSet ? `DO UPDATE SET ${updateSet}` : "DO NOTHING"}
             RETURNING (xmax = 0) AS inserted`;
  const r = await pool.query<{ inserted: boolean }>(q, vals);
  if (r.rowCount === 0) return { inserted: false, updated: false };
  return { inserted: r.rows[0].inserted, updated: !r.rows[0].inserted };
}

/** Import one sheet into its mapped DB table using the schema contract. */
export async function importSheetBySchema(sheetName: string): Promise<ImportResult> {
  const sheetDef = getSheetDef(sheetName);
  if (!sheetDef) throw new Error(`Sheet "${sheetName}" no está en schema.json`);
  if (!sheetDef.db_table) throw new Error(`Sheet "${sheetName}" no tiene db_table en el schema`);
  const dbCols = await getDbColumns(sheetDef.db_table);

  const values = await readSheet(sheetName);
  const result: ImportResult = {
    hoja: sheetName,
    db_table: sheetDef.db_table,
    total_filas: Math.max(0, values.length - 1),
    insertados: 0,
    actualizados: 0,
    omitidos: 0,
    errores: [],
  };
  if (values.length < 2) return result;

  const header = values[0];
  const headerIdx = buildHeaderIndex(header);
  const rows = values.slice(1);

  for (let i = 0; i < rows.length; i++) {
    const { obj, errors } = coerceRow(rows[i], headerIdx, sheetDef);

    // Auto-generate primary key if declared as generated and missing
    for (const col of sheetDef.columns) {
      if (col.generated && col.id_prefix && (obj[col.name] === null || obj[col.name] === "" || obj[col.name] === undefined)) {
        obj[col.name] = generateId(col.id_prefix);
      }
    }

    if (errors.length) {
      result.errores.push({ fila: i + 2, message: errors.map((e) => `${e.field}: ${e.message}`).join("; ") });
      result.omitidos += 1;
      continue;
    }
    try {
      const { inserted, updated } = await upsertRow(sheetDef, obj, dbCols);
      if (inserted) result.insertados += 1;
      else if (updated) result.actualizados += 1;
      else result.omitidos += 1;
    } catch (e: any) {
      result.errores.push({ fila: i + 2, message: e.message });
      result.omitidos += 1;
    }
  }
  return result;
}

/**
 * Bootstrap: import ALL sheets declared in schema.json in dependency order
 * (catalogs first: equipos, conductores_proveedores, vehiculos, clientes; then servicios).
 */
export async function importAllBySchema(): Promise<ImportResult[]> {
  const s = getSchema();
  const order = ["equipos", "conductores_proveedores", "vehiculos", "clientes", "servicios"];
  const all: ImportResult[] = [];
  for (const name of order) {
    if (!s.sheets[name]) continue;
    try {
      const r = await importSheetBySchema(name);
      all.push(r);
    } catch (e: any) {
      all.push({
        hoja: name,
        db_table: s.sheets[name].db_table ?? "",
        total_filas: 0,
        insertados: 0,
        actualizados: 0,
        omitidos: 0,
        errores: [{ fila: 0, message: e.message }],
      });
    }
  }
  return all;
}

/**
 * Normalize a raw REPORTE tab: read the CONDUCTOR column, split, deduplicate
 * and upsert into conductores_proveedores. Also splits equipos by (modelo, serie).
 * Returns the counts.
 */
export async function normalizeFromReporte(sheetName: string = "REPORTE"): Promise<{
  conductores_nuevos: number;
  equipos_nuevos: number;
  errores: string[];
}> {
  const values = await readSheet(sheetName);
  const errores: string[] = [];
  if (values.length < 2) return { conductores_nuevos: 0, equipos_nuevos: 0, errores: ["REPORTE vacío"] };

  const headerIdx = buildHeaderIndex(values[0]);
  const iConductor = headerIdx.get("conductor");
  const iModelo = headerIdx.get("modelo");
  const iSerie = headerIdx.get("serie");
  const iTipoTransporte = headerIdx.get("transporte") ?? headerIdx.get("tipo_transporte");

  const drvCols = await getDbColumns("drivers");
  const eqCols = await getDbColumns("equipment");

  const drvSet = new Set<string>();
  const eqSet = new Set<string>();

  for (const row of values.slice(1)) {
    if (iConductor !== undefined) {
      for (const nombre of splitConductores(row[iConductor])) {
        if (!nombre || drvSet.has(nombre)) continue;
        drvSet.add(nombre);
        const tipoRaw = iTipoTransporte !== undefined ? String(row[iTipoTransporte] ?? "").toUpperCase() : "";
        const tipo = tipoRaw.includes("EXT") || tipoRaw.includes("TERC") ? "EXTERNO" : "PROPIO";
        try {
          const cols: string[] = [];
          const vals: unknown[] = [];
          if (drvCols.has("id_conductor")) { cols.push("id_conductor"); vals.push(generateId("conductor")); }
          if (drvCols.has("nombre")) { cols.push("nombre"); vals.push(nombre); }
          if (drvCols.has("tipo")) { cols.push("tipo"); vals.push(tipo); }
          if (drvCols.has("activo")) { cols.push("activo"); vals.push(true); }
          const ph = cols.map((_, i) => `$${i + 1}`).join(",");
          await pool.query(
            `INSERT INTO "drivers" (${cols.map((c) => `"${c}"`).join(",")}) VALUES (${ph}) ON CONFLICT DO NOTHING`,
            vals,
          );
        } catch (e: any) {
          errores.push(`Conductor "${nombre}": ${e.message}`);
        }
      }
    }
    if (iModelo !== undefined && iSerie !== undefined) {
      const modelo = String(row[iModelo] ?? "").trim();
      const serie = String(row[iSerie] ?? "").trim();
      if (!modelo || !serie) continue;
      const key = `${modelo}||${serie}`;
      if (eqSet.has(key)) continue;
      eqSet.add(key);
      try {
        const cols: string[] = [];
        const vals: unknown[] = [];
        if (eqCols.has("id_equipo")) { cols.push("id_equipo"); vals.push(generateId("equipo")); }
        if (eqCols.has("modelo")) { cols.push("modelo"); vals.push(modelo); }
        if (eqCols.has("serie")) { cols.push("serie"); vals.push(serie); }
        if (eqCols.has("status")) { cols.push("status"); vals.push("disponible"); }
        const ph = cols.map((_, i) => `$${i + 1}`).join(",");
        await pool.query(
          `INSERT INTO "equipment" (${cols.map((c) => `"${c}"`).join(",")}) VALUES (${ph}) ON CONFLICT DO NOTHING`,
          vals,
        );
      } catch (e: any) {
        errores.push(`Equipo "${modelo}/${serie}": ${e.message}`);
      }
    }
  }

  return { conductores_nuevos: drvSet.size, equipos_nuevos: eqSet.size, errores };
}
