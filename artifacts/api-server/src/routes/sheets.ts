import { Router } from "express";
import {
  db,
  servicesTable,
  clientsTable,
  vehiclesTable,
  driversTable,
  equipmentTable,
  activityLogTable,
  sheetsSyncLogTable,
} from "@workspace/db";
import {
  isConfigured,
  getSpreadsheetId,
  getSpreadsheetName,
  listSheetTabs,
  readSheet,
  writeSheet,
  getLastError,
} from "../lib/googleSheets";
import { logger } from "../lib/logger";
import { desc } from "drizzle-orm";

const router = Router();

// GET /api/sheets/status -----------------------------------------------------
router.get("/sheets/status", async (_req, res) => {
  const spreadsheetId = getSpreadsheetId();
  const configured = isConfigured();
  let hojas: string[] = [];
  let spreadsheet_name: string | null = null;
  let last_error: string | null = getLastError();
  if (configured) {
    try {
      hojas = await listSheetTabs();
      spreadsheet_name = await getSpreadsheetName();
    } catch (e: any) {
      last_error = e.message;
      logger.warn({ err: e }, "Sheets status failed");
    }
  }
  const [last] = await db
    .select()
    .from(sheetsSyncLogTable)
    .orderBy(desc(sheetsSyncLogTable.created_at))
    .limit(1);
  res.json({
    conectado: configured && !last_error,
    spreadsheet_id: spreadsheetId,
    spreadsheet_name,
    ultima_sincronizacion: last?.created_at ?? null,
    hojas_disponibles: hojas,
    last_error,
  });
});

// ── Row builders (Postgres → Google Sheet rows) ─────────────────────────────
async function buildExportRows() {
  const services = await db.select().from(servicesTable);
  const clients = await db.select().from(clientsTable);
  const vehicles = await db.select().from(vehiclesTable);
  const drivers = await db.select().from(driversTable);
  const equipment = await db.select().from(equipmentTable);

  const svcHeader = [
    "id",
    "fecha_solicitud",
    "fecha_programacion",
    "cliente",
    "obra",
    "direccion",
    "modelo",
    "serie",
    "operacion",
    "estatus",
    "conductor",
    "tipo_servicio",
    "costo_remision",
    "costo_flete_ext",
    "kms_recorridos",
  ];
  const svcRows = [
    svcHeader,
    ...services.map((s: any) => [
      s.id,
      s.fecha_solicitud ?? "",
      s.fecha_programacion ?? "",
      s.cliente ?? "",
      s.obra ?? "",
      s.direccion ?? "",
      s.modelo ?? "",
      s.serie ?? "",
      s.operacion,
      s.estatus,
      s.conductor ?? "",
      s.tipo_servicio ?? "",
      s.costo_remision ?? "",
      s.costo_flete_ext ?? "",
      s.kms_recorridos ?? "",
    ]),
  ];

  const cliRows = [
    ["id", "cliente", "obra", "calificacion", "comentarios_operaciones"],
    ...clients.map((c: any) => [c.id, c.cliente, c.obra, c.calificacion ?? "", c.comentarios_operaciones ?? ""]),
  ];

  const vehRows = [
    ["id", "placa", "capacidad", "tipo_vehiculo", "ubicacion", "conductor_asignado", "disponible"],
    ...vehicles.map((v: any) => [
      v.id,
      v.placa,
      v.capacidad,
      v.tipo_vehiculo,
      v.ubicacion ?? "",
      v.conductor_asignado ?? "",
      v.disponible,
    ]),
  ];

  const drvRows = [
    ["id", "id_conductor", "nombre", "tipo", "activo"],
    ...drivers.map((d: any) => [d.id, d.id_conductor ?? "", d.nombre, d.tipo, d.activo]),
  ];

  const equipRows = [
    ["id", "id_equipo", "modelo", "serie", "tipo", "status"],
    ...equipment.map((e: any) => [e.id, e.id_equipo ?? "", e.modelo, e.serie, e.tipo ?? "", e.status ?? "disponible"]),
  ];

  return {
    servicios: svcRows,
    CLIENTES: cliRows,
    flota: vehRows,
    conductores_proveedores: drvRows,
    equipos: equipRows,
  } as const;
}

// POST /api/sheets/sync ------------------------------------------------------
router.post("/sheets/sync", async (req, res) => {
  const { direction = "bidirectional", sheets: onlySheets } = req.body ?? {};
  const user = (req as any).user?.nombre ?? "sistema";

  if (!isConfigured()) {
    const msg = getLastError() ?? "GOOGLE_SHEETS_ID o GOOGLE_SERVICE_ACCOUNT_KEY no configurados.";
    await db.insert(sheetsSyncLogTable).values({
      direction,
      hoja: null,
      estatus: "error",
      errores: [msg],
      usuario: user,
    });
    res.status(400).json({
      success: false,
      registros_importados: 0,
      registros_exportados: 0,
      errores: [msg],
      ultima_sincronizacion: new Date().toISOString(),
    });
    return;
  }

  const errores: string[] = [];
  let exported = 0;
  let imported = 0;

  try {
    if (direction === "export" || direction === "bidirectional") {
      const rowsByTab = await buildExportRows();
      const targets = onlySheets && onlySheets.length ? onlySheets : Object.keys(rowsByTab);
      for (const tab of targets) {
        const rows = (rowsByTab as any)[tab];
        if (!rows) continue;
        try {
          const written = await writeSheet(tab, rows);
          exported += Math.max(0, written - 1); // exclude header
        } catch (e: any) {
          errores.push(`Export ${tab}: ${e.message}`);
        }
      }
    }
    if (direction === "import" || direction === "bidirectional") {
      // Only auto-import a limited set of tabs to avoid destructive overwrites.
      // Deep imports happen via /sheets/import with explicit hoja.
      const importTargets = ["CLIENTES"];
      for (const tab of importTargets) {
        try {
          const values = await readSheet(tab);
          if (values.length < 2) continue;
          const [header, ...rows] = values;
          const cols = header.map((h: any) => String(h).trim().toLowerCase());
          for (const row of rows) {
            const obj: Record<string, any> = {};
            cols.forEach((c: string, i: number) => (obj[c] = row[i]));
            if (!obj.cliente) continue;
            try {
              await db
                .insert(clientsTable)
                .values({
                  cliente: String(obj.cliente),
                  obra: String(obj.obra ?? obj.cliente),
                  calificacion: obj.calificacion || null,
                  comentarios_operaciones: obj.comentarios_operaciones || null,
                } as any)
                .onConflictDoNothing?.();
              imported += 1;
            } catch (e: any) {
              errores.push(`Import CLIENTES fila: ${e.message}`);
            }
          }
        } catch (e: any) {
          errores.push(`Import ${tab}: ${e.message}`);
        }
      }
    }
  } catch (e: any) {
    errores.push(e.message);
  }

  await db.insert(sheetsSyncLogTable).values({
    direction,
    hoja: null,
    estatus: errores.length ? (exported + imported ? "partial" : "error") : "ok",
    errores,
    usuario: user,
    registros_importados: imported,
    registros_exportados: exported,
  });
  await db.insert(activityLogTable).values({
    tipo: "SYNC",
    descripcion: `Sync Google Sheets (${direction}) – ${exported} exp, ${imported} imp${errores.length ? `, ${errores.length} errores` : ""}`,
    usuario: user,
    estatus: errores.length ? "warning" : "ok",
  });

  res.json({
    success: errores.length === 0,
    registros_importados: imported,
    registros_exportados: exported,
    errores,
    ultima_sincronizacion: new Date().toISOString(),
  });
});

// POST /api/sheets/import ----------------------------------------------------
router.post("/sheets/import", async (req, res) => {
  const { hoja = "REPORTE", desde_fila = 2, sobrescribir = false } = req.body ?? {};
  const user = (req as any).user?.nombre ?? "sistema";

  if (!isConfigured()) {
    res.status(400).json({
      success: false,
      total_filas: 0,
      importados: 0,
      omitidos: 0,
      errores: [getLastError() ?? "Google Sheets no configurado. Establece GOOGLE_SHEETS_ID y GOOGLE_SERVICE_ACCOUNT_KEY."],
    });
    return;
  }

  const errores: string[] = [];
  let importados = 0;
  let omitidos = 0;
  let total = 0;

  try {
    const values = await readSheet(hoja);
    total = Math.max(0, values.length - 1);
    if (values.length < 2) {
      res.json({ success: true, total_filas: 0, importados: 0, omitidos: 0, errores: [] });
      return;
    }
    const [header, ...rows] = values;
    const cols = header.map((h: any) => String(h).trim().toLowerCase().replace(/\s+/g, "_"));
    const startIdx = Math.max(0, desde_fila - 2);

    for (let i = startIdx; i < rows.length; i++) {
      const row = rows[i];
      const obj: Record<string, any> = {};
      cols.forEach((c: string, idx: number) => (obj[c] = row[idx]));

      // Expected columns roughly match REPORTE PROSIC OPERACIONES sheet
      if (!obj.cliente && !obj.pedido) {
        omitidos += 1;
        continue;
      }
      try {
        await db.insert(servicesTable).values({
          fecha_solicitud: obj.fecha_solicitud || null,
          fecha_programacion: obj.fecha_programacion || obj.fecha_prog || null,
          cliente: obj.cliente || null,
          obra: obj.obra || null,
          direccion: obj.direccion || null,
          modelo: obj.modelo || null,
          serie: obj.serie || null,
          operacion: (obj.operacion || "E").toString().toUpperCase(),
          estatus: (obj.estatus || "PENDIENTE").toString().toUpperCase(),
          vendedor: obj.vendedor || null,
          sucursal_salida: obj.sucursal_salida || obj.sucursal || null,
          pedido: obj.pedido || null,
          remision: obj.remision || null,
          costo_remision: obj.costo_remision ? Number(String(obj.costo_remision).replace(/[$,]/g, "")) : null,
          costo_flete_ext: obj.costo_flete_ext ? Number(String(obj.costo_flete_ext).replace(/[$,]/g, "")) : null,
          transporte: obj.transporte || null,
          conductor: obj.conductor || null,
          tipo_servicio: obj.tipo_servicio || null,
        } as any);
        importados += 1;
      } catch (e: any) {
        errores.push(`Fila ${i + 2}: ${e.message}`);
        omitidos += 1;
      }
    }
  } catch (e: any) {
    errores.push(e.message);
  }

  await db.insert(sheetsSyncLogTable).values({
    direction: "import",
    hoja,
    registros_importados: importados,
    registros_exportados: 0,
    errores,
    usuario: user,
    estatus: errores.length ? (importados ? "partial" : "error") : "ok",
  });
  await db.insert(activityLogTable).values({
    tipo: "SYNC",
    descripcion: `Import Sheets ${hoja}: ${importados}/${total} importados`,
    usuario: user,
    estatus: errores.length ? "warning" : "ok",
  });

  res.json({
    success: errores.length === 0,
    total_filas: total,
    importados,
    omitidos,
    errores,
  });
});

// GET /api/sheets/history ----------------------------------------------------
router.get("/sheets/history", async (_req, res) => {
  const rows = await db
    .select()
    .from(sheetsSyncLogTable)
    .orderBy(desc(sheetsSyncLogTable.created_at))
    .limit(50);
  res.json(rows);
});

export default router;
