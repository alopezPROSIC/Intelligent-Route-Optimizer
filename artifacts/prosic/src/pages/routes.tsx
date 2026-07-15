import { useState, useMemo } from 'react';
import {
  useOptimizeRoutes,
  useListActiveRoutes,
  useListServices,
  useListVehicles,
  useListDrivers,
  useListBranches,
  type RouteOptimizationResult,
  type OptimizedVehicleRoute,
  type ActiveRoute,
} from '@workspace/api-client-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Progress } from '@/components/ui/progress';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@/components/ui/tabs';
import { Map, Truck, MapPin, BrainCircuit, Loader as Loader2, ArrowRight, Navigation, Timer, Route as RouteIcon, Activity, CircleCheck as CheckCircle2, Clock, ChevronDown, ChevronUp, RefreshCw, Zap, CircleAlert as AlertCircle, Hop as Home, Package, PackageOpen } from 'lucide-react';
import { format } from 'date-fns';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

// ─── Helpers ──────────────────────────────────────────────────────────────────
const STOP_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  ENTREGA: Package,
  RETIRO: PackageOpen,
  BASE: Home,
};
const STOP_COLORS: Record<string, string> = {
  ENTREGA: 'bg-blue-500 text-white',
  RETIRO:  'bg-orange-500 text-white',
  BASE:    'bg-sidebar text-sidebar-foreground',
};
const STOP_BORDER: Record<string, string> = {
  ENTREGA: 'border-blue-200 bg-blue-50/50',
  RETIRO:  'border-orange-200 bg-orange-50/50',
  BASE:    'border-muted bg-muted/20',
};

const VEHICLE_PALETTE = [
  'bg-blue-500', 'bg-green-500', 'bg-violet-500', 'bg-amber-500',
  'bg-teal-500', 'bg-rose-500', 'bg-indigo-500', 'bg-orange-500',
];

function fmtKm(km?: number) { return km != null ? `${km.toFixed(1)} km` : '—'; }
function fmtMin(min?: number) {
  if (min == null) return '—';
  const h = Math.floor(min / 60);
  const m = min % 60;
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

// ─── Route card (expanded single vehicle route) ───────────────────────────────
function VehicleRouteCard({
  ruta,
  index,
}: {
  ruta: OptimizedVehicleRoute;
  index: number;
}) {
  const [open, setOpen] = useState(true);
  const color = VEHICLE_PALETTE[index % VEHICLE_PALETTE.length];
  const stops = ruta.paradas ?? [];
  const deliveries = stops.filter(p => p.tipo === 'ENTREGA').length;
  const pickups = stops.filter(p => p.tipo === 'RETIRO').length;

  return (
    <Card className="border-border/50 shadow-sm overflow-hidden">
      {/* Header */}
      <div
        className="flex items-center gap-3 p-4 cursor-pointer select-none border-b border-border/50 bg-muted/30"
        onClick={() => setOpen(o => !o)}
      >
        <div className={cn('h-9 w-9 rounded-full flex items-center justify-center shrink-0 text-white font-bold text-sm', color)}>
          <Truck className="h-4 w-4" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-bold text-foreground">{ruta.placa ?? `Vehículo ${ruta.vehiculo_id}`}</span>
            <Badge variant="outline" className="text-[10px] h-4">{stops.length} paradas</Badge>
          </div>
          <p className="text-xs text-muted-foreground">{ruta.conductor ?? 'Sin conductor'}</p>
        </div>
        <div className="flex items-center gap-4 text-xs text-muted-foreground">
          <div className="flex items-center gap-1">
            <Navigation className="h-3 w-3" />
            {fmtKm(ruta.distancia_total_km)}
          </div>
          <div className="flex items-center gap-1">
            <Timer className="h-3 w-3" />
            {fmtMin(ruta.tiempo_estimado_min)}
          </div>
          <div className="flex items-center gap-1.5">
            {deliveries > 0 && (
              <Badge className="bg-blue-100 text-blue-800 border-0 text-[9px] h-4">{deliveries}E</Badge>
            )}
            {pickups > 0 && (
              <Badge className="bg-orange-100 text-orange-800 border-0 text-[9px] h-4">{pickups}R</Badge>
            )}
          </div>
        </div>
        {open ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
      </div>

      {/* Timeline */}
      {open && (
        <div className="relative p-5">
          <div className="absolute left-[38px] top-5 bottom-5 w-0.5 bg-border/60" />
          <div className="space-y-4">
            {stops.map((parada, idx) => {
              const Icon = STOP_ICONS[parada.tipo] ?? MapPin;
              return (
                <div key={idx} className="flex gap-4 items-start relative z-10">
                  <div className={cn('h-7 w-7 rounded-full flex items-center justify-center shrink-0 text-[10px] font-bold border-2 border-background shadow-sm', STOP_COLORS[parada.tipo])}>
                    {parada.orden}
                  </div>
                  <div className={cn('flex-1 p-3 rounded-lg border text-sm', STOP_BORDER[parada.tipo])}>
                    <div className="flex items-center gap-2 mb-1">
                      <Icon className="h-3.5 w-3.5" />
                      <Badge variant="outline" className="text-[9px] h-4 border-0 bg-transparent px-0 font-semibold">
                        {parada.tipo}
                      </Badge>
                      {parada.hora_estimada && (
                        <span className="ml-auto text-xs font-medium text-muted-foreground flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {parada.hora_estimada}
                        </span>
                      )}
                    </div>
                    <p className="font-bold text-foreground">{parada.cliente ?? (parada.tipo === 'BASE' ? 'Base PROSIC' : `Parada ${idx + 1}`)}</p>
                    {parada.direccion && (
                      <p className="text-xs text-muted-foreground flex items-start gap-1 mt-0.5">
                        <MapPin className="h-3 w-3 mt-0.5 shrink-0" />
                        {parada.direccion}
                      </p>
                    )}
                    {parada.servicio_id && (
                      <p className="text-[10px] text-muted-foreground mt-0.5">Servicio #{parada.servicio_id}</p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </Card>
  );
}

// ─── Active route monitor card ────────────────────────────────────────────────
function ActiveRouteCard({ route }: { route: ActiveRoute }) {
  const total = (route.servicios_pendientes ?? 0) + (route.servicios_completados ?? 0);
  const pct = total > 0 ? Math.round(((route.servicios_completados ?? 0) / total) * 100) : 0;

  return (
    <Card className="border-border/50 shadow-sm">
      <CardContent className="p-4">
        <div className="flex items-center gap-3 mb-3">
          <div className={cn('h-8 w-8 rounded-full flex items-center justify-center', route.estatus === 'EN_RUTA' ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground')}>
            <Truck className="h-4 w-4" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-bold text-sm">{route.placa ?? `Vehículo ${route.vehiculo_id}`}</p>
            <p className="text-xs text-muted-foreground truncate">{route.conductor ?? 'Sin conductor'}</p>
          </div>
          <Badge variant={route.estatus === 'EN_RUTA' ? 'default' : 'secondary'} className="text-[10px]">
            {route.estatus === 'EN_RUTA' ? 'En ruta' : 'Disponible'}
          </Badge>
        </div>
        <div className="space-y-1.5">
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>{route.servicios_completados} completados</span>
            <span>{route.servicios_pendientes} pendientes</span>
          </div>
          <Progress value={pct} className="h-1.5" />
          <p className="text-[10px] text-right text-muted-foreground">{pct}% completado</p>
        </div>
      </CardContent>
    </Card>
  );
}

// ─── AI reasoning panel ───────────────────────────────────────────────────────
function AIReasoningPanel({ reasoning }: { reasoning: string }) {
  const [expanded, setExpanded] = useState(true);
  return (
    <Card className="border-accent/30 bg-gradient-to-br from-accent/5 to-accent/10 shadow-sm">
      <CardContent className="p-4">
        <div className="flex items-start gap-3">
          <div className="p-2 bg-accent/20 rounded-lg shrink-0">
            <BrainCircuit className="h-5 w-5 text-accent-foreground" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between mb-2">
              <h4 className="font-bold text-sm text-foreground">Análisis de IA — Groq</h4>
              <Button
                variant="ghost"
                size="sm"
                className="h-6 text-xs"
                onClick={() => setExpanded(e => !e)}
              >
                {expanded ? 'Contraer' : 'Expandir'}
              </Button>
            </div>
            {expanded && (
              <p className="text-sm text-muted-foreground leading-relaxed italic">{reasoning}</p>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// ─── Summary stat card ────────────────────────────────────────────────────────
function SummaryStat({
  label, value, icon: Icon, color,
}: { label: string; value: string | number; icon: React.ComponentType<{ className?: string }>; color: string }) {
  return (
    <Card className={cn('border-0 shadow-sm', color)}>
      <CardContent className="p-4 flex items-center gap-3">
        <Icon className="h-6 w-6 opacity-80" />
        <div>
          <p className="text-2xl font-black leading-none">{value}</p>
          <p className="text-[11px] mt-0.5 opacity-75">{label}</p>
        </div>
      </CardContent>
    </Card>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────
export default function RoutesPage() {
  const today = format(new Date(), 'yyyy-MM-dd');

  // Form state
  const [fecha, setFecha] = useState(today);
  const [selectedVehicles, setSelectedVehicles] = useState<Set<number>>(new Set());
  const [selectedServices, setSelectedServices] = useState<Set<number>>(new Set());
  const [incluirRetornos, setIncluirRetornos] = useState(true);
  const [baseLat, setBaseLat] = useState('19.4326');
  const [baseLng, setBaseLng] = useState('-99.1332');
  const [expandConfig, setExpandConfig] = useState(true);

  // Result state
  const [result, setResult] = useState<RouteOptimizationResult | null>(null);

  // Data queries
  const { data: services } = useListServices({
    fecha_desde: fecha,
    fecha_hasta: fecha,
  });
  const { data: pendingServices } = useListServices({ estatus: 'PENDIENTE' as any });
  const { data: vehicles = [] } = useListVehicles();
  const { data: drivers = [] } = useListDrivers();
  const { data: activeRoutes = [], isLoading: activeLoading, refetch: refetchActive } = useListActiveRoutes();

  const optimizeRoutes = useOptimizeRoutes();

  // Combine same-day + pending for service selection
  const selectableServices = useMemo(() => {
    const byDay = services ?? [];
    const pending = (pendingServices ?? []).filter(
      s => !byDay.find(b => b.id === s.id) && !s.fecha_programacion,
    );
    return [...byDay, ...pending].filter(
      s => s.estatus !== 'ENTREGADO' && s.estatus !== 'TERMINADO' && s.estatus !== 'CANCELADO',
    );
  }, [services, pendingServices]);

  const toggleVehicle = (id: number) => {
    setSelectedVehicles(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const toggleService = (id: number) => {
    setSelectedServices(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const selectAllVehicles = () => setSelectedVehicles(new Set(vehicles.map(v => v.id)));
  const clearVehicles = () => setSelectedVehicles(new Set());
  const selectAllServices = () => setSelectedServices(new Set(selectableServices.map(s => s.id)));
  const clearServices = () => setSelectedServices(new Set());

  const handleOptimize = () => {
    if (selectedVehicles.size === 0) {
      toast.error('Selecciona al menos un vehículo');
      return;
    }
    if (selectedServices.size === 0) {
      toast.error('Selecciona al menos un servicio');
      return;
    }

    optimizeRoutes.mutate({
      data: {
        fecha,
        vehicle_ids: Array.from(selectedVehicles),
        service_ids: Array.from(selectedServices),
        base_latitud: parseFloat(baseLat) || 19.4326,
        base_longitud: parseFloat(baseLng) || -99.1332,
        incluir_retornos: incluirRetornos,
      },
    }, {
      onSuccess: (data) => {
        setResult(data);
        setExpandConfig(false);
        toast.success('Rutas optimizadas con IA');
        refetchActive();
      },
      onError: () => toast.error('Error al optimizar rutas'),
    });
  };

  return (
    <div className="space-y-6">
      {/* ── Header ── */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
        <div>
          <h1 className="text-3xl font-black tracking-tight">Optimización de Rutas IA</h1>
          <p className="text-muted-foreground">Groq AI genera rutas óptimas minimizando distancia y tiempo.</p>
        </div>
        {result && (
          <Button
            variant="outline"
            onClick={() => { setResult(null); setExpandConfig(true); setSelectedVehicles(new Set()); setSelectedServices(new Set()); }}
          >
            <RefreshCw className="mr-2 h-4 w-4" />
            Nueva optimización
          </Button>
        )}
      </div>

      <Tabs defaultValue="optimizer">
        <TabsList className="border-b rounded-none h-auto p-0 bg-transparent gap-4 w-full justify-start">
          {[
            { value: 'optimizer', label: 'Planificador', icon: BrainCircuit },
            { value: 'active', label: 'Rutas Activas', icon: Activity },
          ].map(({ value, label, icon: Icon }) => (
            <TabsTrigger
              key={value}
              value={value}
              className="data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none px-4 py-3"
            >
              <Icon className="h-4 w-4 mr-2" />
              {label}
            </TabsTrigger>
          ))}
        </TabsList>

        {/* ── OPTIMIZER TAB ── */}
        <TabsContent value="optimizer" className="mt-6">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

            {/* Config panel */}
            <div className="space-y-4">
              {/* Collapsible config */}
              <Card className="shadow-sm border-border/50">
                <CardHeader
                  className="pb-3 border-b border-border/50 bg-muted/30 cursor-pointer"
                  onClick={() => setExpandConfig(e => !e)}
                >
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-base">Configuración</CardTitle>
                    {expandConfig ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                  </div>
                </CardHeader>
                {expandConfig && (
                  <CardContent className="p-4 space-y-5">
                    {/* Date */}
                    <div className="space-y-1.5">
                      <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Fecha de servicio</Label>
                      <Input type="date" value={fecha} onChange={e => setFecha(e.target.value)} />
                    </div>

                    {/* Base coords */}
                    <div className="space-y-1.5">
                      <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Coordenadas de base</Label>
                      <div className="grid grid-cols-2 gap-2">
                        <Input placeholder="Latitud" value={baseLat} onChange={e => setBaseLat(e.target.value)} className="text-xs" />
                        <Input placeholder="Longitud" value={baseLng} onChange={e => setBaseLng(e.target.value)} className="text-xs" />
                      </div>
                    </div>

                    {/* Options */}
                    <div className="flex items-center gap-2">
                      <Checkbox
                        id="retornos"
                        checked={incluirRetornos}
                        onCheckedChange={v => setIncluirRetornos(!!v)}
                      />
                      <label htmlFor="retornos" className="text-sm cursor-pointer">
                        Calcular retornos a base
                        <span className="block text-xs text-muted-foreground">No se crean servicios adicionales</span>
                      </label>
                    </div>

                    <Separator />

                    {/* Vehicle selection */}
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                          Vehículos ({selectedVehicles.size}/{vehicles.length})
                        </Label>
                        <div className="flex gap-1">
                          <Button variant="ghost" size="sm" className="h-5 text-[10px] px-2" onClick={selectAllVehicles}>Todo</Button>
                          <Button variant="ghost" size="sm" className="h-5 text-[10px] px-2" onClick={clearVehicles}>Limpiar</Button>
                        </div>
                      </div>
                      <ScrollArea className="h-[160px] rounded border border-border/50 bg-background">
                        <div className="p-2 space-y-1.5">
                          {vehicles.map(v => {
                            const assigned = drivers.find(d => d.nombre === v.conductor_asignado);
                            return (
                              <label
                                key={v.id}
                                className={cn(
                                  'flex items-start gap-2.5 p-2 rounded-md cursor-pointer transition-colors',
                                  selectedVehicles.has(v.id) ? 'bg-primary/10 border border-primary/30' : 'hover:bg-muted/50',
                                )}
                              >
                                <Checkbox
                                  checked={selectedVehicles.has(v.id)}
                                  onCheckedChange={() => toggleVehicle(v.id)}
                                  className="mt-0.5"
                                />
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-1.5">
                                    <Truck className="h-3 w-3 text-muted-foreground" />
                                    <span className="font-mono font-bold text-xs">{v.placa}</span>
                                  </div>
                                  <p className="text-[10px] text-muted-foreground">{v.tipo_vehiculo}</p>
                                  {v.conductor_asignado && (
                                    <p className="text-[10px] text-primary">{v.conductor_asignado}</p>
                                  )}
                                </div>
                              </label>
                            );
                          })}
                          {vehicles.length === 0 && (
                            <p className="text-xs text-center text-muted-foreground p-4">Sin vehículos registrados</p>
                          )}
                        </div>
                      </ScrollArea>
                    </div>

                    {/* Service selection */}
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                          Servicios ({selectedServices.size}/{selectableServices.length})
                        </Label>
                        <div className="flex gap-1">
                          <Button variant="ghost" size="sm" className="h-5 text-[10px] px-2" onClick={selectAllServices}>Todo</Button>
                          <Button variant="ghost" size="sm" className="h-5 text-[10px] px-2" onClick={clearServices}>Limpiar</Button>
                        </div>
                      </div>
                      <ScrollArea className="h-[200px] rounded border border-border/50 bg-background">
                        <div className="p-2 space-y-1.5">
                          {selectableServices.map(s => (
                            <label
                              key={s.id}
                              className={cn(
                                'flex items-start gap-2.5 p-2 rounded-md cursor-pointer transition-colors',
                                selectedServices.has(s.id) ? 'bg-primary/10 border border-primary/30' : 'hover:bg-muted/50',
                              )}
                            >
                              <Checkbox
                                checked={selectedServices.has(s.id)}
                                onCheckedChange={() => toggleService(s.id)}
                                className="mt-0.5"
                              />
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-1.5 mb-0.5">
                                  <span className={cn('h-1.5 w-1.5 rounded-full shrink-0',
                                    s.operacion === 'E' ? 'bg-blue-500' :
                                    s.operacion === 'R' ? 'bg-orange-500' : 'bg-violet-500',
                                  )} />
                                  <span className="text-xs font-bold truncate">{s.cliente ?? `#${s.id}`}</span>
                                </div>
                                <p className="text-[10px] text-muted-foreground truncate">{s.modelo ?? 'Sin equipo'}</p>
                                {s.direccion && (
                                  <p className="text-[10px] text-muted-foreground truncate">{s.direccion}</p>
                                )}
                              </div>
                            </label>
                          ))}
                          {selectableServices.length === 0 && (
                            <div className="text-center py-4 text-muted-foreground">
                              <AlertCircle className="h-5 w-5 mx-auto mb-1 opacity-40" />
                              <p className="text-xs">Sin servicios disponibles para {fecha}</p>
                            </div>
                          )}
                        </div>
                      </ScrollArea>
                    </div>

                    {/* CTA */}
                    <Button
                      onClick={handleOptimize}
                      className="w-full h-12 text-base font-bold"
                      disabled={optimizeRoutes.isPending || selectedVehicles.size === 0 || selectedServices.size === 0}
                    >
                      {optimizeRoutes.isPending ? (
                        <>
                          <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                          Procesando con Groq AI...
                        </>
                      ) : (
                        <>
                          <BrainCircuit className="mr-2 h-5 w-5" />
                          Generar Rutas Óptimas
                        </>
                      )}
                    </Button>
                  </CardContent>
                )}
              </Card>

              {/* Selection summary (collapsed config) */}
              {!expandConfig && result && (
                <Card className="border-border/50 shadow-sm">
                  <CardContent className="p-4 space-y-2">
                    <div className="flex items-center gap-2">
                      <CheckCircle2 className="h-4 w-4 text-green-500" />
                      <span className="text-sm font-bold text-green-700">Rutas generadas</span>
                    </div>
                    <div className="text-xs text-muted-foreground space-y-1">
                      <p>{selectedVehicles.size} vehículo(s) · {selectedServices.size} servicio(s)</p>
                      <p>Fecha: {fecha}</p>
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>

            {/* Results */}
            <div className="lg:col-span-2">
              {optimizeRoutes.isPending && (
                <div className="flex flex-col items-center justify-center h-64 text-center gap-4">
                  <div className="relative">
                    <div className="h-16 w-16 rounded-full bg-accent/20 flex items-center justify-center">
                      <BrainCircuit className="h-8 w-8 text-accent-foreground animate-pulse" />
                    </div>
                    <div className="absolute inset-0 rounded-full border-2 border-accent/40 animate-spin border-t-transparent" />
                  </div>
                  <div>
                    <p className="font-bold">Analizando con Groq AI...</p>
                    <p className="text-sm text-muted-foreground">Calculando rutas óptimas para {selectedServices.size} servicio(s)</p>
                  </div>
                </div>
              )}

              {result && !optimizeRoutes.isPending && (
                <div className="space-y-5">
                  {/* Summary stats */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    <SummaryStat label="Distancia total" value={fmtKm(result.resumen.distancia_total_km)} icon={Navigation} color="bg-primary text-primary-foreground" />
                    <SummaryStat label="Tiempo estimado" value={fmtMin(result.resumen.tiempo_total_min)} icon={Timer} color="bg-secondary text-secondary-foreground" />
                    <SummaryStat label="Vehículos" value={result.resumen.total_vehiculos ?? 0} icon={Truck} color="bg-accent/20 text-accent-foreground" />
                    <SummaryStat label="Servicios" value={result.resumen.total_servicios ?? 0} icon={RouteIcon} color="bg-muted text-foreground" />
                  </div>

                  {/* AI reasoning */}
                  {result.ai_reasoning && <AIReasoningPanel reasoning={result.ai_reasoning} />}

                  {/* Route cards */}
                  <div className="space-y-4">
                    {result.rutas.map((ruta, idx) => (
                      <VehicleRouteCard key={idx} ruta={ruta} index={idx} />
                    ))}
                  </div>
                </div>
              )}

              {!result && !optimizeRoutes.isPending && (
                <div className="flex flex-col items-center justify-center border-2 border-dashed border-border/50 rounded-xl bg-muted/10 h-64 text-center gap-4 p-8">
                  <div className="h-20 w-20 bg-muted rounded-full flex items-center justify-center">
                    <Map className="h-10 w-10 text-muted-foreground opacity-40" />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold mb-1">Sin rutas generadas</h3>
                    <p className="text-sm text-muted-foreground max-w-sm">
                      Selecciona vehículos y servicios en el panel izquierdo, luego ejecuta la optimización con Groq AI.
                    </p>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Zap className="h-3 w-3 text-accent-foreground" />
                    Powered by Groq llama-3.3-70b
                  </div>
                </div>
              )}
            </div>
          </div>
        </TabsContent>

        {/* ── ACTIVE ROUTES TAB ── */}
        <TabsContent value="active" className="mt-6">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-bold">Rutas Activas</h2>
                <p className="text-sm text-muted-foreground">Seguimiento en tiempo real del estado de las unidades.</p>
              </div>
              <Button variant="outline" size="sm" onClick={() => refetchActive()} disabled={activeLoading}>
                <RefreshCw className={cn('mr-2 h-4 w-4', activeLoading && 'animate-spin')} />
                Actualizar
              </Button>
            </div>

            {activeLoading ? (
              <div className="flex justify-center py-16">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
              </div>
            ) : activeRoutes.length === 0 ? (
              <div className="flex flex-col items-center justify-center border-2 border-dashed border-border/50 rounded-xl bg-muted/10 py-16 gap-4 text-center">
                <div className="h-16 w-16 bg-muted rounded-full flex items-center justify-center">
                  <Activity className="h-8 w-8 text-muted-foreground opacity-40" />
                </div>
                <div>
                  <p className="font-bold">Sin rutas activas</p>
                  <p className="text-sm text-muted-foreground mt-1">No hay unidades en tránsito en este momento.</p>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {activeRoutes.map((route, idx) => (
                  <ActiveRouteCard key={route.vehiculo_id ?? idx} route={route} />
                ))}
              </div>
            )}

            {/* Fleet summary */}
            <Card className="border-border/50 shadow-sm mt-4">
              <CardHeader className="pb-3 border-b border-border/50 bg-muted/30">
                <CardTitle className="text-sm">Resumen de Flota</CardTitle>
                <CardDescription>Estado general de todos los vehículos registrados</CardDescription>
              </CardHeader>
              <CardContent className="p-4">
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-center">
                  <div>
                    <p className="text-2xl font-black text-foreground">{vehicles.length}</p>
                    <p className="text-xs text-muted-foreground">Total vehículos</p>
                  </div>
                  <div>
                    <p className="text-2xl font-black text-primary">{activeRoutes.filter(r => r.estatus === 'EN_RUTA').length}</p>
                    <p className="text-xs text-muted-foreground">En ruta</p>
                  </div>
                  <div>
                    <p className="text-2xl font-black text-green-600">{vehicles.filter(v => v.disponible !== false).length}</p>
                    <p className="text-xs text-muted-foreground">Disponibles</p>
                  </div>
                  <div>
                    <p className="text-2xl font-black text-amber-600">{activeRoutes.reduce((s, r) => s + (r.servicios_pendientes ?? 0), 0)}</p>
                    <p className="text-xs text-muted-foreground">Entregas pendientes</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
