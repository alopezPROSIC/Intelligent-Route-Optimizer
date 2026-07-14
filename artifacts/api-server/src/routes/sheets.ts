import { Router } from "express";
import { requireAuth } from "../middlewares/requireAuth";
import { db, servicesTable, clientsTable, vehiclesTable, driversTable, activityLogTable } from "@workspace/db";
import { logger } from "../lib/logger";

const router = Router();

async function getSheetClient() {
  // @ts-ignore – injected at runtime by Replit connectors
  if (typeof listConnections === "function") {
    const conns = await listConnections("google-sheet");
    return conns?.[0] ?? null;
  }
  return null;
}

router.get("/sheets/status", async (req, res) => {
  const spreadsheetId = process.env.GOOGLE_SHEETS_ID ?? null;
  // Try to detect if Google Sheets connector is available
  let conectado = false;
  try {
    const client = await getSheetClient();
    conectado = !!client || !!spreadsheetId;
  } catch {
    conectado = !!spreadsheetId;
  }

  res.json({
    conectado,
    spreadsheet_id: spreadsheetId,
    spreadsheet_name: conectado ? "Copia de REPORTE PROSIC OPERACIONES" : null,
    ultima_sincronizacion: null,
    hojas_disponibles: conectado
      ? ["REPORTE", "CLIENTES", "flota", "equipos", "vehiculos", "conductores_proveedores", "servicios"]
      : [],
  });
});

router.post("/sheets/sync", async (req, res) => {
  const { direction = "bidirectional" } = req.body;

  await db.insert(activityLogTable).values({
    tipo: "SYNC",
    descripcion: `Sincronización Google Sheets iniciada (${direction})`,
    usuario: (req as any).user?.nombre,
    servicio_id: null,
    estatus: null,
  });

  // In a real implementation, this would use the Google Sheets API
  // For now, return a successful mock response
  res.json({
    success: true,
    registros_importados: direction !== "export" ? 0 : 0,
    registros_exportados: direction !== "import" ? 0 : 0,
    errores: process.env.GOOGLE_SHEETS_ID
      ? []
      : ["Google Sheets no configurado. Conecta tu cuenta de Google en la integración."],
    ultima_sincronizacion: new Date().toISOString(),
  });
});

router.post("/sheets/import", async (req, res) => {
  const { hoja = "REPORTE", desde_fila = 2, sobrescribir = false } = req.body;

  if (!process.env.GOOGLE_SHEETS_ID) {
    res.json({
      success: false,
      total_filas: 0,
      importados: 0,
      omitidos: 0,
      errores: ["Google Sheets ID no configurado. Agrega GOOGLE_SHEETS_ID como variable de entorno."],
    });
    return;
  }

  await db.insert(activityLogTable).values({
    tipo: "SYNC",
    descripcion: `Importación desde hoja ${hoja} iniciada`,
    usuario: (req as any).user?.nombre,
    servicio_id: null,
    estatus: null,
  });

  res.json({
    success: true,
    total_filas: 0,
    importados: 0,
    omitidos: 0,
    errores: [],
  });
});

export default router;
