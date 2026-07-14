import { useState } from 'react';
import { 
  useOptimizeRoutes, 
  useListActiveRoutes,
  useListServices,
  useListVehicles,
  RouteOptimizationResult
} from '@workspace/api-client-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Map, Zap, Route as RouteIcon, Truck, MapPin, BrainCircuit, Loader2, ArrowRight } from 'lucide-react';
import { format } from 'date-fns';
import { toast } from 'sonner';
import { ScrollArea } from '@/components/ui/scroll-area';

export default function RoutesPage() {
  const [selectedDate, setSelectedDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [selectedVehicles, setSelectedVehicles] = useState<number[]>([]);
  const [selectedServices, setSelectedServices] = useState<number[]>([]);
  const [optResult, setOptResult] = useState<RouteOptimizationResult | null>(null);

  const { data: services } = useListServices({ fecha_desde: selectedDate, fecha_hasta: selectedDate });
  const { data: vehicles } = useListVehicles();
  const optimizeRoutes = useOptimizeRoutes();

  const handleOptimize = () => {
    if (selectedVehicles.length === 0 || selectedServices.length === 0) {
      toast.error('Selecciona al menos un vehículo y un servicio');
      return;
    }

    optimizeRoutes.mutate({
      data: {
        fecha: selectedDate,
        vehicle_ids: selectedVehicles,
        service_ids: selectedServices,
        incluir_retornos: true
      }
    }, {
      onSuccess: (data) => {
        setOptResult(data);
        toast.success('Rutas optimizadas con IA correctamente');
      },
      onError: () => toast.error('Error al optimizar rutas')
    });
  };

  const toggleVehicle = (id: number) => {
    setSelectedVehicles(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  };

  const toggleService = (id: number) => {
    setSelectedServices(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-black tracking-tight">Optimización con IA</h1>
        <p className="text-muted-foreground">Generación automática de rutas eficientes basadas en ubicación y prioridad.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Setup Column */}
        <div className="space-y-6">
          <Card className="shadow-sm border-border/50">
            <CardHeader className="pb-3 border-b border-border/50 bg-muted/30">
              <CardTitle className="text-lg">Configuración de Ruta</CardTitle>
            </CardHeader>
            <CardContent className="p-4 space-y-6">
              <div>
                <label className="text-sm font-bold text-muted-foreground uppercase tracking-widest mb-3 block">1. Vehículos Disponibles</label>
                <div className="space-y-2">
                  {vehicles?.map(v => (
                    <div key={v.id} className="flex items-center space-x-3 bg-background p-2 rounded border border-border/50">
                      <Checkbox 
                        id={`v-${v.id}`} 
                        checked={selectedVehicles.includes(v.id)} 
                        onCheckedChange={() => toggleVehicle(v.id)}
                      />
                      <label htmlFor={`v-${v.id}`} className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 flex-1 cursor-pointer">
                        {v.placa} <span className="text-muted-foreground ml-1 font-normal">- {v.conductor_asignado || 'Sin asignar'}</span>
                      </label>
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <label className="text-sm font-bold text-muted-foreground uppercase tracking-widest mb-3 block">2. Servicios a Enrutar</label>
                <ScrollArea className="h-[250px] rounded border border-border/50 bg-background p-2">
                  <div className="space-y-2">
                    {services?.filter(s => s.estatus !== 'ENTREGADO' && s.estatus !== 'TERMINADO').map(s => (
                      <div key={s.id} className="flex items-start space-x-3 p-2 rounded hover:bg-muted/50">
                        <Checkbox 
                          id={`s-${s.id}`} 
                          checked={selectedServices.includes(s.id)} 
                          onCheckedChange={() => toggleService(s.id)}
                          className="mt-1"
                        />
                        <label htmlFor={`s-${s.id}`} className="text-sm leading-none cursor-pointer flex-1">
                          <div className="font-bold flex items-center gap-2 mb-1">
                            {s.cliente}
                            <Badge variant="outline" className="text-[10px] h-4 px-1">{s.operacion}</Badge>
                          </div>
                          <div className="text-xs text-muted-foreground line-clamp-1">{s.direccion}</div>
                        </label>
                      </div>
                    ))}
                    {(!services || services.length === 0) && (
                      <p className="text-sm text-center text-muted-foreground p-4">No hay servicios pendientes hoy.</p>
                    )}
                  </div>
                </ScrollArea>
              </div>

              <Button 
                onClick={handleOptimize} 
                className="w-full h-12 text-base font-bold shadow-md bg-accent hover:bg-accent/90 text-accent-foreground border-accent-foreground/20 border"
                disabled={optimizeRoutes.isPending}
              >
                {optimizeRoutes.isPending ? (
                  <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                ) : (
                  <BrainCircuit className="mr-2 h-5 w-5" />
                )}
                Generar Rutas Optimizadas
              </Button>
            </CardContent>
          </Card>
        </div>

        {/* Results Column */}
        <div className="lg:col-span-2">
          {optResult ? (
            <div className="space-y-6">
              <div className="grid grid-cols-3 gap-4">
                <Card className="bg-primary text-primary-foreground border-0 shadow-sm">
                  <CardContent className="p-4 text-center">
                    <p className="text-xs uppercase tracking-widest opacity-80 mb-1">Distancia Total</p>
                    <p className="text-3xl font-black">{optResult.resumen.distancia_total_km?.toFixed(1)} km</p>
                  </CardContent>
                </Card>
                <Card className="bg-secondary text-secondary-foreground border-0 shadow-sm">
                  <CardContent className="p-4 text-center">
                    <p className="text-xs uppercase tracking-widest opacity-80 mb-1">Tiempo Est.</p>
                    <p className="text-3xl font-black">{Math.floor((optResult.resumen.tiempo_total_min || 0) / 60)}h {(optResult.resumen.tiempo_total_min || 0) % 60}m</p>
                  </CardContent>
                </Card>
                <Card className="bg-sidebar text-sidebar-foreground border-0 shadow-sm">
                  <CardContent className="p-4 text-center">
                    <p className="text-xs uppercase tracking-widest opacity-80 mb-1">Vehículos</p>
                    <p className="text-3xl font-black">{optResult.resumen.total_vehiculos}</p>
                  </CardContent>
                </Card>
              </div>

              {optResult.ai_reasoning && (
                <Card className="border-accent/30 bg-accent/5 shadow-sm">
                  <CardContent className="p-4 flex gap-4 items-start">
                    <div className="p-2 bg-accent/20 rounded-lg text-accent-foreground shrink-0">
                      <BrainCircuit className="h-5 w-5" />
                    </div>
                    <div>
                      <h4 className="font-bold text-sm text-foreground mb-1">Análisis de IA (Groq)</h4>
                      <p className="text-sm text-muted-foreground italic leading-relaxed">{optResult.ai_reasoning}</p>
                    </div>
                  </CardContent>
                </Card>
              )}

              <div className="space-y-4">
                {optResult.rutas.map((ruta, idx) => (
                  <Card key={idx} className="shadow-sm border-border/50 overflow-hidden">
                    <div className="bg-muted/50 p-4 border-b border-border/50 flex justify-between items-center">
                      <div className="flex items-center gap-3">
                        <div className="h-8 w-8 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold">
                          <Truck className="h-4 w-4" />
                        </div>
                        <div>
                          <h3 className="font-bold text-foreground">Ruta Vehículo {ruta.placa}</h3>
                          <p className="text-xs text-muted-foreground">Conductor: {ruta.conductor || 'No especificado'}</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <Badge variant="outline" className="font-bold">
                          {ruta.paradas.length} paradas
                        </Badge>
                      </div>
                    </div>
                    <CardContent className="p-0">
                      <div className="relative p-6">
                        {/* Timeline line */}
                        <div className="absolute left-[39px] top-8 bottom-8 w-0.5 bg-border z-0"></div>
                        
                        <div className="space-y-6 relative z-10">
                          {ruta.paradas.map((parada, stopIdx) => (
                            <div key={stopIdx} className="flex gap-4 items-start">
                              <div className={`h-8 w-8 rounded-full flex items-center justify-center shrink-0 border-2 border-background shadow-sm text-xs font-bold
                                ${parada.tipo === 'BASE' ? 'bg-sidebar text-sidebar-foreground' : 'bg-primary text-primary-foreground'}`}>
                                {stopIdx + 1}
                              </div>
                              <div className="flex-1 pt-1">
                                <div className="flex items-center gap-2 mb-1">
                                  <Badge variant={parada.tipo === 'BASE' ? 'secondary' : 'default'} className="text-[10px] h-5">
                                    {parada.tipo}
                                  </Badge>
                                  <span className="font-bold text-sm text-foreground">{parada.cliente || 'Central PROSIC'}</span>
                                  <span className="ml-auto text-xs font-medium text-muted-foreground">{parada.hora_estimada}</span>
                                </div>
                                {parada.direccion && (
                                  <p className="text-sm text-muted-foreground flex items-start gap-1 mt-1">
                                    <MapPin className="h-3.5 w-3.5 mt-0.5 shrink-0" />
                                    <span>{parada.direccion}</span>
                                  </p>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          ) : (
            <div className="h-full flex flex-col items-center justify-center text-center p-12 border-2 border-dashed border-border/50 rounded-xl bg-muted/10">
              <div className="h-20 w-20 bg-muted rounded-full flex items-center justify-center mb-6">
                <Map className="h-10 w-10 text-muted-foreground opacity-50" />
              </div>
              <h3 className="text-xl font-bold text-foreground mb-2">Sin Rutas Generadas</h3>
              <p className="text-muted-foreground max-w-sm">
                Selecciona los vehículos y los servicios pendientes en el panel lateral, luego haz clic en "Generar Rutas Optimizadas" para que la IA diseñe el mejor recorrido.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
