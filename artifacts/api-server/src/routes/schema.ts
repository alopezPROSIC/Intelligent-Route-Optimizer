import { Router } from "express";
import {
  getSchema,
  getSheetDef,
  coerceRow,
  buildHeaderIndex,
  generateId,
} from "../lib/schemaEngine";
import {
  importSheetBySchema,
  importAllBySchema,
  normalizeFromReporte,
} from "../lib/schemaImporter";
import { readSheet, isConfigured } from "../lib/googleSheets";
import { db, sheetsSyncLogTable, activityLogTable } from "@workspace/db";

const router = Router();
export const schemaPublicRouter = Router();

// PUBLIC (contract): GET /api/schema  – return the full contract
schemaPublicRouter.get("/schema", (_req, res) => {
  res.json(getSchema());
});
schemaPublicRouter.get("/schema/:sheet", (req, res) => {
  const def = getSheetDef(req.params.sheet);
  if (!def) { res.status(404).json({ error: "sheet_no_declarada" }); return; }
  res.json(def);
});

// POST /api/schema/validate  – dry-run: read a tab, coerce rows, return
// per-row errors WITHOUT touching the DB. Very useful for pre-flight checks.
router.post("/schema/validate", async (req, res) => {
  const { hoja, sample_size = 200 } = req.body ?? {};
  const def = getSheetDef(hoja);
  if (!def) { res.status(400).json({ error: "sheet_no_declarada", hoja }); return; }
  if (!(await isConfigured())) { res.status(400).json({ error: "sheets_no_configurado" }); return; }

  const values = await readSheet(hoja);
  if (values.length < 2) {
    res.json({ hoja, total: 0, validas: 0, con_errores: 0, errores: [] });
    return;
  }
  const headerIdx = buildHeaderIndex(values[0]);
  const rows = values.slice(1, 1 + Number(sample_size));
  const errores: any[] = [];
  let validas = 0;
  rows.forEach((row, i) => {
    const { errors } = coerceRow(row, headerIdx, def);
    if (errors.length) errores.push({ fila: i + 2, errors });
    else validas += 1;
  });
  res.json({ hoja, total: rows.length, validas, con_errores: rows.length - validas, errores });
});

// POST /api/schema/import  – import ONE sheet by schema (upsert)
router.post("/schema/import", async (req, res) => {
  const { hoja } = req.body ?? {};
  const usuario = (req as any).user?.nombre ?? "sistema";
  if (!hoja) { res.status(400).json({ error: "falta_hoja" }); return; }
  if (!(await isConfigured())) { res.status(400).json({ error: "sheets_no_configurado" }); return; }

  try {
    const r = await importSheetBySchema(hoja);
    await db.insert(sheetsSyncLogTable).values({
      direction: "import",
      hoja: r.hoja,
      registros_importados: r.insertados + r.actualizados,
      registros_exportados: 0,
      errores: r.errores.slice(0, 20).map((e) => `Fila ${e.fila}: ${e.message}`),
      usuario,
      estatus: r.errores.length ? (r.insertados + r.actualizados > 0 ? "partial" : "error") : "ok",
    });
    await db.insert(activityLogTable).values({
      tipo: "SYNC",
      descripcion: `Schema-import ${r.hoja}: ${r.insertados} nuevos, ${r.actualizados} actualizados, ${r.omitidos} omitidos`,
      usuario,
      estatus: r.errores.length ? "warning" : "ok",
    });
    res.json({ success: r.errores.length === 0, ...r });
  } catch (e: any) {
    res.status(500).json({ error: "import_error", message: e.message });
  }
});

// POST /api/schema/import-all  – import EVERY sheet in dependency order
router.post("/schema/import-all", async (req, res) => {
  const usuario = (req as any).user?.nombre ?? "sistema";
  if (!(await isConfigured())) { res.status(400).json({ error: "sheets_no_configurado" }); return; }
  try {
    const results = await importAllBySchema();
    const totalInsertados = results.reduce((a, r) => a + r.insertados, 0);
    const totalActualizados = results.reduce((a, r) => a + r.actualizados, 0);
    const totalErrores = results.reduce((a, r) => a + r.errores.length, 0);
    await db.insert(activityLogTable).values({
      tipo: "SYNC",
      descripcion: `Bootstrap schema-import completo: ${totalInsertados} nuevos, ${totalActualizados} actualizados, ${totalErrores} errores`,
      usuario,
      estatus: totalErrores ? "warning" : "ok",
    });
    res.json({ success: totalErrores === 0, resumen: { totalInsertados, totalActualizados, totalErrores }, results });
  } catch (e: any) {
    res.status(500).json({ error: "import_all_error", message: e.message });
  }
});

// POST /api/schema/normalize  – normalize REPORTE (split conductores + dedupe equipos)
router.post("/schema/normalize", async (req, res) => {
  const { hoja = "REPORTE" } = req.body ?? {};
  const usuario = (req as any).user?.nombre ?? "sistema";
  if (!(await isConfigured())) { res.status(400).json({ error: "sheets_no_configurado" }); return; }
  try {
    const r = await normalizeFromReporte(hoja);
    await db.insert(activityLogTable).values({
      tipo: "SYNC",
      descripcion: `Normalización de ${hoja}: ${r.conductores_nuevos} conductores, ${r.equipos_nuevos} equipos`,
      usuario,
      estatus: r.errores.length ? "warning" : "ok",
    });
    res.json({ success: r.errores.length === 0, ...r });
  } catch (e: any) {
    res.status(500).json({ error: "normalize_error", message: e.message });
  }
});

// GET /api/schema/preview/:sheet  – peek at first N rows raw
router.get("/schema/preview/:sheet", async (req, res) => {
  const sheet = req.params.sheet;
  const limit = Number(req.query.limit ?? 5);
  if (!(await isConfigured())) { res.status(400).json({ error: "sheets_no_configurado" }); return; }
  try {
    const values = await readSheet(sheet);
    res.json({
      hoja: sheet,
      total_filas: Math.max(0, values.length - 1),
      header: values[0] ?? [],
      rows: values.slice(1, 1 + limit),
    });
  } catch (e: any) {
    res.status(400).json({ error: e.message });
  }
});

// GET /api/schema/generate-id/:kind  – helper for the frontend
router.get("/schema/generate-id/:kind", (req, res) => {
  try {
    res.json({ id: generateId(req.params.kind) });
  } catch (e: any) {
    res.status(400).json({ error: e.message });
  }
});

export default router;
