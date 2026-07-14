import { Router } from "express";
import { db, servicesTable, vehiclesTable, driversTable, activityLogTable } from "@workspace/db";
import { eq, inArray } from "drizzle-orm";
import { requireAuth } from "../middlewares/requireAuth";
import { logger } from "../lib/logger";

const router = Router();

interface Stop {
  orden: number;
  tipo: "ENTREGA" | "RETIRO" | "BASE";
  servicio_id: number | null;
  cliente: string | null;
  direccion: string | null;
  latitud: number;
  longitud: number;
  hora_estimada: string | null;
  es_retorno_base: boolean;
}

function calcDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a = Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

async function callGroqAI(prompt: string): Promise<string> {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) return "Groq AI no configurado – usando optimización básica por distancia.";

  try {
    const resp = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model: "llama-3.3-70b-versatile",
        messages: [{ role: "user", content: prompt }],
        max_tokens: 800,
        temperature: 0.2,
      }),
    });
    const data = await resp.json() as any;
    return data.choices?.[0]?.message?.content ?? "Sin respuesta de IA.";
  } catch (err) {
    logger.error({ err }, "Groq AI error");
    return "Error al conectar con Groq AI.";
  }
}

router.post("/routes/optimize", async (req, res) => {
  const { fecha, vehicle_ids, service_ids, base_latitud = 19.4326, base_longitud = -99.1332, incluir_retornos = true } = req.body;

  const [vehicles, services] = await Promise.all([
    db.select().from(vehiclesTable).where(inArray(vehiclesTable.id, vehicle_ids)),
    db.select().from(servicesTable).where(inArray(servicesTable.id, service_ids)),
  ]);

  const drivers = await db.select().from(driversTable);

  // Simple greedy TSP assignment: distribute services evenly across vehicles
  const validServices = services.filter(s => !s.es_retorno_base);
  const perVehicle = Math.ceil(validServices.length / Math.max(vehicles.length, 1));

  const rutas = vehicles.map((vehicle, vIdx) => {
    const assigned = validServices.slice(vIdx * perVehicle, (vIdx + 1) * perVehicle);
    const driver = drivers.find(d => d.nombre === vehicle.conductor_asignado);

    let lat = base_latitud, lng = base_longitud, totalKm = 0, orden = 0;
    const paradas: Stop[] = [];
    let currentTime = 7 * 60; // 7:00 AM in minutes

    for (const svc of assigned) {
      const sLat = svc.latitud ?? base_latitud + (Math.random() - 0.5) * 0.5;
      const sLng = svc.longitud ?? base_longitud + (Math.random() - 0.5) * 0.5;
      const dist = calcDistance(lat, lng, sLat, sLng);
      totalKm += dist;
      currentTime += (dist / 50) * 60 + 30; // 50km/h avg + 30min service
      const hrs = Math.floor(currentTime / 60) % 24;
      const mins = Math.floor(currentTime % 60);

      paradas.push({
        orden: ++orden,
        tipo: svc.operacion === "E" || svc.operacion === "CF" || svc.operacion === "RU" ? "ENTREGA" : "RETIRO",
        servicio_id: svc.id,
        cliente: svc.cliente,
        direccion: svc.direccion,
        latitud: sLat,
        longitud: sLng,
        hora_estimada: `${String(hrs).padStart(2, "0")}:${String(mins).padStart(2, "0")}`,
        es_retorno_base: false,
      });
      lat = sLat; lng = sLng;
    }

    if (incluir_retornos && assigned.length > 0) {
      const retDist = calcDistance(lat, lng, base_latitud, base_longitud);
      totalKm += retDist;
      currentTime += (retDist / 50) * 60;
      const hrs = Math.floor(currentTime / 60) % 24;
      const mins = Math.floor(currentTime % 60);
      paradas.push({
        orden: ++orden,
        tipo: "BASE",
        servicio_id: null,
        cliente: null,
        direccion: "Base PROSIC",
        latitud: base_latitud,
        longitud: base_longitud,
        hora_estimada: `${String(hrs).padStart(2, "0")}:${String(mins).padStart(2, "0")}`,
        es_retorno_base: true,
      });
    }

    return {
      vehiculo_id: vehicle.id,
      conductor: vehicle.conductor_asignado ?? driver?.nombre ?? "Sin asignar",
      placa: vehicle.placa,
      paradas,
      distancia_total_km: Math.round(totalKm * 10) / 10,
      tiempo_estimado_min: paradas.length > 0 ? Math.round((currentTime - 7 * 60)) : 0,
      incluye_retorno: incluir_retornos,
    };
  });

  const totalKm = rutas.reduce((s, r) => s + r.distancia_total_km, 0);
  const retornos = rutas.reduce((s, r) => s + r.paradas.filter(p => p.es_retorno_base).length, 0);

  const prompt = `Eres un experto en logística de última milla en México. Se han calculado las siguientes rutas para ${fecha}:
- ${vehicles.length} vehículos
- ${validServices.length} servicios (entregas y retiros de equipo industrial)
- Distancia total estimada: ${Math.round(totalKm)} km
- Retornos a base: ${retornos} (NO contados como servicios de renta)

Proporciona en 3-4 oraciones un análisis y recomendación de optimización para estas rutas. Considera: ventanas de tiempo, eficiencia de combustible, carga de trabajo por conductor.`;

  const ai_reasoning = await callGroqAI(prompt);

  await db.insert(activityLogTable).values({
    tipo: "SERVICIO",
    descripcion: `Optimización de rutas para ${fecha}: ${vehicles.length} vehículos, ${validServices.length} servicios`,
    usuario: (req as any).user?.nombre,
    servicio_id: null,
    estatus: null,
  });

  res.json({
    rutas,
    resumen: {
      total_servicios: validServices.length,
      total_vehiculos: vehicles.length,
      distancia_total_km: Math.round(totalKm * 10) / 10,
      tiempo_total_min: rutas.reduce((s, r) => s + r.tiempo_estimado_min, 0),
      retornos_excluidos_de_servicios: retornos,
    },
    ai_reasoning,
  });
});

router.get("/routes/active", async (req, res) => {
  const vehicles = await db.select().from(vehiclesTable);
  const services = await db.select().from(servicesTable)
    .where(eq(servicesTable.estatus, "EN_TRANSITO"));

  const routes = vehicles
    .filter(v => !v.disponible || services.some(s => s.vehiculo_id === v.id))
    .map(v => {
      const svcComplete = services.filter(s => s.vehiculo_id === v.id && s.estatus === "ENTREGADO").length;
      const svcPending = services.filter(s => s.vehiculo_id === v.id && s.estatus !== "ENTREGADO").length;
      return {
        vehiculo_id: v.id,
        placa: v.placa,
        conductor: v.conductor_asignado ?? "Sin asignar",
        estatus: svcPending > 0 ? "EN_RUTA" : "DISPONIBLE",
        servicios_pendientes: svcPending,
        servicios_completados: svcComplete,
        posicion_actual_lat: null,
        posicion_actual_lng: null,
      };
    });

  res.json(routes);
});

export default router;
