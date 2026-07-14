import {
  useGetKpis,
  useGetServiceActivity,
  useGetTodayServices,
  useListPendingCollection
} from '@workspace/api-client-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Truck, CheckCircle, Clock, AlertTriangle, Activity, MapPin, Loader2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';

export default function Dashboard() {
  const { data: kpis, isLoading: kpisLoading } = useGetKpis();
  const { data: activity, isLoading: actLoading } = useGetServiceActivity();
  const { data: todayServices, isLoading: tsLoading } = useGetTodayServices();
  const { data: pending, isLoading: pendingLoading } = useListPendingCollection();

  if (kpisLoading || actLoading || tsLoading || pendingLoading) {
    return (
      <div className="flex h-[80vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-black tracking-tight">Control Center</h1>
        <p className="text-muted-foreground">Resumen operativo y estado de la logística en tiempo real.</p>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="border-l-4 border-l-primary shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Servicios Totales</CardTitle>
            <Truck className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{kpis?.total_servicios || 0}</div>
            <p className="text-xs text-muted-foreground mt-1">En periodo actual</p>
          </CardContent>
        </Card>
        
        <Card className="border-l-4 border-l-secondary shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Completados</CardTitle>
            <CheckCircle className="h-4 w-4 text-secondary" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{kpis?.servicios_completados || 0}</div>
            <p className="text-xs text-muted-foreground mt-1">Tasa de cumplimiento: {kpis?.tasa_cumplimiento?.toFixed(1) || 0}%</p>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-accent shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Pendientes</CardTitle>
            <Clock className="h-4 w-4 text-accent" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{kpis?.servicios_pendientes || 0}</div>
            <p className="text-xs text-muted-foreground mt-1">Por entregar o retirar</p>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-destructive shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Retraso Promedio</CardTitle>
            <AlertTriangle className="h-4 w-4 text-destructive" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{kpis?.horas_retraso_promedio?.toFixed(1) || 0} hrs</div>
            <p className="text-xs text-muted-foreground mt-1">Promedio por servicio</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Today's Schedule */}
        <Card className="lg:col-span-2 shadow-sm border-border/50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <MapPin className="h-5 w-5 text-primary" />
              Rutas de Hoy
            </CardTitle>
            <CardDescription>Servicios programados para ejecutar en el día actual.</CardDescription>
          </CardHeader>
          <CardContent>
            {todayServices && todayServices.length > 0 ? (
              <div className="space-y-4">
                {todayServices.map((service) => (
                  <div key={service.id} className="flex items-start justify-between p-4 bg-muted/50 rounded-lg border border-border/50">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <Badge variant={service.operacion === 'E' ? 'default' : 'secondary'} className="font-bold">
                          {service.operacion === 'E' ? 'ENTREGA' : service.operacion === 'R' ? 'RETIRO' : service.operacion}
                        </Badge>
                        <span className="font-bold">{service.cliente}</span>
                      </div>
                      <p className="text-sm text-muted-foreground">{service.direccion}</p>
                      <p className="text-sm font-medium mt-2 text-primary">{service.modelo} (Serie: {service.serie})</p>
                    </div>
                    <div className="text-right">
                      <div className="text-lg font-black text-foreground">{service.hora_programada || service.horario || 'S/H'}</div>
                      <Badge variant="outline" className="mt-1">{service.estatus}</Badge>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-12 text-muted-foreground bg-muted/20 rounded-lg border border-dashed border-border">
                <Truck className="h-8 w-8 mx-auto mb-2 opacity-50" />
                <p>No hay servicios programados para hoy</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Activity Feed */}
        <Card className="shadow-sm border-border/50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Activity className="h-5 w-5 text-primary" />
              Activity Feed
            </CardTitle>
            <CardDescription>Cambios recientes</CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            <ScrollArea className="h-[400px] px-6 pb-6">
              <div className="space-y-6 pt-2">
                {activity?.map((item, i) => (
                  <div key={item.id || i} className="relative pl-6 before:absolute before:left-[11px] before:top-2 before:bottom-[-24px] before:w-[2px] before:bg-border last:before:hidden">
                    <div className="absolute left-0 top-1 h-6 w-6 rounded-full border-2 border-background bg-primary/20 flex items-center justify-center">
                      <div className="h-2 w-2 rounded-full bg-primary" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-foreground">{item.descripcion}</p>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-xs text-muted-foreground">{item.usuario || 'Sistema'}</span>
                        <span className="text-xs text-muted-foreground/50">•</span>
                        <span className="text-xs text-muted-foreground">{item.created_at ? new Date(item.created_at).toLocaleTimeString() : 'Ahora'}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>
      </div>

      {/* Pending Collection Warning */}
      {pending && pending.length > 0 && (
        <Card className="border-destructive/50 bg-destructive/5 shadow-sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="h-5 w-5" />
              Atención: Equipos Pendientes de Retiro
            </CardTitle>
            <CardDescription>Servicios marcados para retiro que no han sido ejecutados.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {pending.map((p) => (
                <div key={p.id} className="p-4 bg-background rounded-lg border border-destructive/20 shadow-sm flex flex-col">
                  <div className="flex justify-between items-start mb-2">
                    <span className="font-bold text-sm truncate pr-2">{p.cliente}</span>
                    <Badge variant="destructive" className="shrink-0">{p.dias_retraso} días retraso</Badge>
                  </div>
                  <span className="text-xs text-muted-foreground mb-4 line-clamp-2">{p.direccion}</span>
                  <div className="mt-auto flex justify-between items-center text-sm font-medium">
                    <span>{p.modelo}</span>
                    <span className="text-destructive">ID: {p.id}</span>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
