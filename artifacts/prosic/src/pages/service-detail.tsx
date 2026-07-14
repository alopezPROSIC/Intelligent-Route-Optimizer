import { useState } from 'react';
import { useParams, Link } from 'wouter';
import {
  useGetService,
  useUpdateServiceStatus,
  useUpdateService,
  useListDrivers,
  useListVehicles,
  useGetServiceActivity,
  ServiceStatusInputEstatus,
} from '@workspace/api-client-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Loader as Loader2, ArrowLeft, Truck, MapPin, Calendar, Clock, User, Phone, CircleCheck as CheckCircle2, PenTool, FileText, TriangleAlert as AlertTriangle, Activity, Navigation, Package, RotateCcw, Ban, CheckCheck, Circle } from 'lucide-react';
import { format, formatDistanceToNow } from 'date-fns';
import { es } from 'date-fns/locale';
import { toast } from 'sonner';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';

// ─── Status config ────────────────────────────────────────────────────────────
const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string; Icon: React.ElementType }> = {
  PENDIENTE:   { label: 'Pendiente',   color: 'text-yellow-700', bg: 'bg-yellow-50 border-yellow-200', Icon: Circle },
  PROGRAMADO:  { label: 'Programado',  color: 'text-blue-700',   bg: 'bg-blue-50 border-blue-200',     Icon: Calendar },
  EN_TRANSITO: { label: 'En Tránsito', color: 'text-orange-700', bg: 'bg-orange-50 border-orange-200', Icon: Navigation },
  ENTREGADO:   { label: 'Entregado',   color: 'text-green-700',  bg: 'bg-green-50 border-green-200',   Icon: CheckCheck },
  CANCELADO:   { label: 'Cancelado',   color: 'text-red-700',    bg: 'bg-red-50 border-red-200',       Icon: Ban },
  TERMINADO:   { label: 'Terminado',   color: 'text-gray-700',   bg: 'bg-gray-50 border-gray-200',     Icon: Package },
};

const STATUS_FLOW: Record<string, ServiceStatusInputEstatus[]> = {
  PENDIENTE:   ['PROGRAMADO', 'CANCELADO'],
  PROGRAMADO:  ['EN_TRANSITO', 'PENDIENTE', 'CANCELADO'],
  EN_TRANSITO: ['ENTREGADO', 'CANCELADO'],
  ENTREGADO:   ['TERMINADO'],
  CANCELADO:   ['PENDIENTE'],
  TERMINADO:   [],
};

const OPERACION_LABELS: Record<string, string> = {
  E: 'ENTREGA',
  R: 'RETIRO',
  CF: 'CAMBIO FÍSICO',
  RU: 'REUBICACIÓN',
};

// ─── Status badge ─────────────────────────────────────────────────────────────
function StatusBadge({ estatus }: { estatus: string }) {
  const cfg = STATUS_CONFIG[estatus] ?? STATUS_CONFIG['PENDIENTE'];
  const { Icon } = cfg;
  return (
    <span className={cn('inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-sm font-semibold', cfg.bg, cfg.color)}>
      <Icon className="h-3.5 w-3.5" />
      {cfg.label}
    </span>
  );
}

// ─── Evidence checklist ───────────────────────────────────────────────────────
function EvidenceChecklist({
  serviceId,
  carta_porte,
  correo_programacion,
  correo_confirmacion,
  evidencia,
  onUpdate,
}: {
  serviceId: number;
  carta_porte: boolean;
  correo_programacion: boolean;
  correo_confirmacion: boolean;
  evidencia: boolean;
  onUpdate: () => void;
}) {
  const updateService = useUpdateService();

  const toggle = (field: string, current: boolean) => {
    updateService.mutate(
      { id: serviceId, data: { [field]: !current } },
      {
        onSuccess: () => {
          toast.success('Actualizado');
          onUpdate();
        },
        onError: () => toast.error('Error al actualizar'),
      },
    );
  };

  const items = [
    { field: 'carta_porte', label: 'Carta Porte', value: carta_porte },
    { field: 'correo_programacion', label: 'Correo Programación', value: correo_programacion },
    { field: 'correo_confirmacion', label: 'Correo Confirmación', value: correo_confirmacion },
    { field: 'evidencia', label: 'Evidencia Fotográfica', value: evidencia },
  ];

  return (
    <div className="grid grid-cols-2 gap-2">
      {items.map(({ field, label, value }) => (
        <button
          key={field}
          onClick={() => toggle(field, value)}
          disabled={updateService.isPending}
          className={cn(
            'flex items-center gap-2 rounded-lg border p-3 text-sm font-medium transition-all text-left hover:shadow-sm',
            value
              ? 'bg-green-50 border-green-200 text-green-800'
              : 'bg-muted/40 border-border/50 text-muted-foreground',
          )}
        >
          {value ? (
            <CheckCircle2 className="h-4 w-4 text-green-600 shrink-0" />
          ) : (
            <Circle className="h-4 w-4 shrink-0 opacity-40" />
          )}
          {label}
        </button>
      ))}
    </div>
  );
}

// ─── Status update dialog ─────────────────────────────────────────────────────
function StatusUpdateDialog({
  serviceId,
  currentStatus,
  onSuccess,
}: {
  serviceId: number;
  currentStatus: string;
  onSuccess: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [newStatus, setNewStatus] = useState<ServiceStatusInputEstatus | ''>('');
  const [comment, setComment] = useState('');
  const updateStatus = useUpdateServiceStatus();

  const available = STATUS_FLOW[currentStatus] ?? [];

  const handleSubmit = () => {
    if (!newStatus) return;
    updateStatus.mutate(
      { id: serviceId, data: { estatus: newStatus, comentario: comment || undefined } },
      {
        onSuccess: () => {
          toast.success(`Estatus actualizado a ${STATUS_CONFIG[newStatus]?.label ?? newStatus}`);
          setOpen(false);
          setNewStatus('');
          setComment('');
          onSuccess();
        },
        onError: () => toast.error('Error al actualizar estatus'),
      },
    );
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" className="border-primary text-primary hover:bg-primary/5" disabled={available.length === 0}>
          <CheckCircle2 className="mr-2 h-4 w-4" />
          Cambiar Estatus
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Actualizar Estatus de Servicio</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 pt-2">
          <div className="flex items-center gap-3 text-sm">
            <span className="text-muted-foreground">Estado actual:</span>
            <StatusBadge estatus={currentStatus} />
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-medium">Nuevo estatus</label>
            <Select value={newStatus} onValueChange={(v) => setNewStatus(v as ServiceStatusInputEstatus)}>
              <SelectTrigger>
                <SelectValue placeholder="Seleccionar..." />
              </SelectTrigger>
              <SelectContent>
                {available.map((s) => (
                  <SelectItem key={s} value={s}>{STATUS_CONFIG[s]?.label ?? s}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-medium">Comentario (opcional)</label>
            <Textarea
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder="Observaciones sobre el cambio..."
              rows={3}
            />
          </div>
          <Button className="w-full" onClick={handleSubmit} disabled={!newStatus || updateStatus.isPending}>
            {updateStatus.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Confirmar Cambio
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ─── Assign dialog ────────────────────────────────────────────────────────────
function AssignDialog({
  serviceId,
  currentDriverId,
  currentVehicleId,
  onSuccess,
}: {
  serviceId: number;
  currentDriverId?: number | null;
  currentVehicleId?: number | null;
  onSuccess: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [driverId, setDriverId] = useState(currentDriverId?.toString() ?? '');
  const [vehicleId, setVehicleId] = useState(currentVehicleId?.toString() ?? '');
  const { data: drivers } = useListDrivers({}, { query: { queryKey: ['drivers'], enabled: open } });
  const { data: vehicles } = useListVehicles({ query: { queryKey: ['vehicles'], enabled: open } });
  const updateService = useUpdateService();

  const handleSave = () => {
    updateService.mutate(
      {
        id: serviceId,
        data: {
          conductor_id: driverId ? parseInt(driverId) : undefined,
          vehiculo_id: vehicleId ? parseInt(vehicleId) : undefined,
        },
      },
      {
        onSuccess: () => {
          toast.success('Asignación guardada');
          setOpen(false);
          onSuccess();
        },
        onError: () => toast.error('Error al guardar asignación'),
      },
    );
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="icon" className="h-8 w-8 text-primary">
          <PenTool className="h-4 w-4" />
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Asignar Recursos Logísticos</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 pt-2">
          <div className="space-y-1.5">
            <label className="text-sm font-medium">Conductor</label>
            <Select value={driverId} onValueChange={setDriverId}>
              <SelectTrigger>
                <SelectValue placeholder="Seleccionar conductor..." />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Sin asignar</SelectItem>
                {drivers?.filter(d => d.activo !== false).map(d => (
                  <SelectItem key={d.id} value={d.id.toString()}>{d.nombre}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-medium">Vehículo</label>
            <Select value={vehicleId} onValueChange={setVehicleId}>
              <SelectTrigger>
                <SelectValue placeholder="Seleccionar vehículo..." />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Sin asignar</SelectItem>
                {vehicles?.map(v => (
                  <SelectItem key={v.id} value={v.id.toString()}>{v.placa} — {v.tipo_vehiculo}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Button className="w-full" onClick={handleSave} disabled={updateService.isPending}>
            {updateService.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Guardar
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────
export default function ServiceDetail() {
  const { id } = useParams<{ id: string }>();
  const serviceId = parseInt(id, 10);

  const { data: service, isLoading, refetch } = useGetService(serviceId, {
    query: { queryKey: ['service', serviceId], enabled: !!serviceId && !isNaN(serviceId) },
  });
  const { data: activity } = useGetServiceActivity();

  const serviceActivity = activity?.filter(a => a.servicio_id === serviceId) ?? [];

  const { data: vehicles } = useListVehicles();
  const assignedVehicle = vehicles?.find(v => v.id === service?.vehiculo_id);

  if (isLoading) {
    return (
      <div className="flex h-[80vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!service) {
    return (
      <div className="flex h-[60vh] flex-col items-center justify-center gap-4 text-center">
        <AlertTriangle className="h-12 w-12 text-muted-foreground opacity-40" />
        <div>
          <h2 className="text-xl font-bold">Servicio no encontrado</h2>
          <p className="text-muted-foreground text-sm mt-1">El servicio #{id} no existe o fue eliminado.</p>
        </div>
        <Button asChild variant="outline">
          <Link href="/services">Volver a Servicios</Link>
        </Button>
      </div>
    );
  }

  const retrasoHrs = service.horas_retraso ?? 0;
  const retrasoTotal = service.retraso_total ?? 0;

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      {/* ── Header ── */}
      <div className="flex flex-wrap items-start gap-4">
        <Button variant="outline" size="icon" asChild className="shrink-0 mt-0.5">
          <Link href="/services"><ArrowLeft className="h-4 w-4" /></Link>
        </Button>
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2 mb-1">
            <h1 className="text-2xl sm:text-3xl font-black tracking-tight">Servicio #{service.id}</h1>
            <Badge variant="outline" className="border-primary text-primary bg-primary/5 font-bold">
              {OPERACION_LABELS[service.operacion] ?? service.operacion}
            </Badge>
            <StatusBadge estatus={service.estatus} />
          </div>
          <p className="text-sm text-muted-foreground">
            Creado:{' '}
            {service.created_at
              ? format(new Date(service.created_at), "dd 'de' MMMM yyyy 'a las' HH:mm", { locale: es })
              : 'N/A'}
          </p>
        </div>
        <div className="flex gap-2 shrink-0">
          <StatusUpdateDialog
            serviceId={serviceId}
            currentStatus={service.estatus}
            onSuccess={refetch}
          />
        </div>
      </div>

      {/* ── Time metrics alert ── */}
      {(retrasoHrs > 0 || retrasoTotal > 0) && (
        <div className="flex items-start gap-3 rounded-xl border border-destructive/30 bg-destructive/5 p-4">
          <AlertTriangle className="h-5 w-5 text-destructive shrink-0 mt-0.5" />
          <div className="text-sm">
            <p className="font-bold text-destructive">Servicio con retraso detectado</p>
            <p className="text-muted-foreground mt-0.5">
              Retraso en el día: <strong>{retrasoHrs.toFixed(1)} hrs</strong>
              {retrasoTotal > 0 && <> · Retraso acumulado: <strong>{retrasoTotal.toFixed(1)} hrs</strong></>}
              {(service.dias_retraso ?? 0) > 0 && <> · Días de retraso: <strong>{service.dias_retraso}</strong></>}
            </p>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* ── Left column (2/3) ── */}
        <div className="lg:col-span-2 space-y-6">

          {/* Client / Destination */}
          <Card className="shadow-sm border-border/50">
            <CardHeader className="bg-muted/30 pb-3 border-b border-border/50">
              <CardTitle className="text-sm font-bold uppercase tracking-widest text-muted-foreground flex items-center gap-2">
                <MapPin className="h-4 w-4" /> Destino y Cliente
              </CardTitle>
            </CardHeader>
            <CardContent className="p-5 grid grid-cols-1 sm:grid-cols-2 gap-5">
              <div>
                <p className="text-xs text-muted-foreground mb-1">Cliente</p>
                <p className="font-bold text-lg leading-tight">{service.cliente ?? '—'}</p>
                <p className="text-muted-foreground text-sm mt-0.5">{service.obra ?? '—'}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground mb-1">Dirección</p>
                <p className="font-medium">{service.direccion ?? '—'}</p>
                {service.latitud && service.longitud && (
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {service.latitud.toFixed(6)}, {service.longitud.toFixed(6)}
                  </p>
                )}
              </div>
              <div>
                <p className="text-xs text-muted-foreground mb-1">Contacto en Sitio</p>
                <div className="flex items-center gap-2">
                  <User className="h-4 w-4 text-muted-foreground" />
                  <span className="font-medium">{service.contacto_nombre ?? '—'}</span>
                </div>
                {service.contacto_telefono && (
                  <div className="flex items-center gap-2 mt-1">
                    <Phone className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm">{service.contacto_telefono}</span>
                  </div>
                )}
              </div>
              <div>
                <p className="text-xs text-muted-foreground mb-1">Vendedor / Sucursal</p>
                <p className="font-medium">{service.vendedor ?? '—'}</p>
                {service.sucursal_vendedor && (
                  <p className="text-sm text-muted-foreground">{service.sucursal_vendedor}</p>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Equipment */}
          <Card className="shadow-sm border-border/50">
            <CardHeader className="bg-muted/30 pb-3 border-b border-border/50">
              <CardTitle className="text-sm font-bold uppercase tracking-widest text-muted-foreground flex items-center gap-2">
                <Package className="h-4 w-4" /> Equipo
              </CardTitle>
            </CardHeader>
            <CardContent className="p-5">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-2xl font-black text-primary">{service.modelo ?? '—'}</p>
                  <p className="text-base font-medium text-muted-foreground mt-0.5">
                    Serie: <span className="text-foreground font-semibold">{service.serie ?? '—'}</span>
                  </p>
                </div>
                {service.dias_renta && (
                  <div className="bg-primary/10 px-5 py-3 rounded-xl text-center shrink-0">
                    <p className="text-xs font-bold text-primary uppercase mb-0.5">Días Renta</p>
                    <p className="text-3xl font-black text-primary">{service.dias_renta}</p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Evidence & Checklist */}
          <Card className="shadow-sm border-border/50">
            <CardHeader className="bg-muted/30 pb-3 border-b border-border/50">
              <CardTitle className="text-sm font-bold uppercase tracking-widest text-muted-foreground flex items-center gap-2">
                <CheckCheck className="h-4 w-4" /> Seguimiento y Evidencias
              </CardTitle>
            </CardHeader>
            <CardContent className="p-5">
              <EvidenceChecklist
                serviceId={serviceId}
                carta_porte={service.carta_porte ?? false}
                correo_programacion={service.correo_programacion ?? false}
                correo_confirmacion={service.correo_confirmacion ?? false}
                evidencia={service.evidencia ?? false}
                onUpdate={refetch}
              />
              {(service.comentarios_op || service.comentarios_traf) && (
                <div className="mt-5 pt-5 border-t border-border/50 space-y-3">
                  {service.comentarios_op && (
                    <div>
                      <p className="text-xs font-bold text-muted-foreground uppercase mb-1">Comentarios Operaciones</p>
                      <p className="text-sm bg-muted/30 rounded-lg p-3">{service.comentarios_op}</p>
                    </div>
                  )}
                  {service.comentarios_traf && (
                    <div>
                      <p className="text-xs font-bold text-muted-foreground uppercase mb-1">Comentarios Tráfico</p>
                      <p className="text-sm bg-muted/30 rounded-lg p-3">{service.comentarios_traf}</p>
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Activity feed */}
          {serviceActivity.length > 0 && (
            <Card className="shadow-sm border-border/50">
              <CardHeader className="bg-muted/30 pb-3 border-b border-border/50">
                <CardTitle className="text-sm font-bold uppercase tracking-widest text-muted-foreground flex items-center gap-2">
                  <Activity className="h-4 w-4" /> Historial de Actividad
                </CardTitle>
              </CardHeader>
              <CardContent className="p-5">
                <ScrollArea className="h-[240px]">
                  <div className="space-y-5">
                    {serviceActivity.map((item, i) => (
                      <div key={item.id ?? i} className="relative pl-6 before:absolute before:left-[10px] before:top-2 before:bottom-[-20px] before:w-[2px] before:bg-border last:before:hidden">
                        <div className="absolute left-0 top-1 h-5 w-5 rounded-full border-2 border-background bg-primary/20 flex items-center justify-center">
                          <div className="h-1.5 w-1.5 rounded-full bg-primary" />
                        </div>
                        <p className="text-sm font-medium">{item.descripcion}</p>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className="text-xs text-muted-foreground">{item.usuario ?? 'Sistema'}</span>
                          {item.created_at && (
                            <>
                              <span className="text-xs text-muted-foreground/50">·</span>
                              <span className="text-xs text-muted-foreground">
                                {formatDistanceToNow(new Date(item.created_at), { addSuffix: true, locale: es })}
                              </span>
                            </>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>
          )}
        </div>

        {/* ── Right column (1/3) ── */}
        <div className="space-y-6">

          {/* Scheduling */}
          <Card className="shadow-sm border-0 bg-sidebar text-sidebar-foreground">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-bold uppercase tracking-widest opacity-70 flex items-center gap-2">
                <Calendar className="h-4 w-4" /> Programación
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <p className="text-xs opacity-60 mb-0.5">Solicitud</p>
                <p className="font-bold">
                  {service.fecha_solicitud ? format(new Date(service.fecha_solicitud), 'dd/MM/yyyy') : '—'}
                </p>
              </div>
              <div>
                <p className="text-xs opacity-60 mb-0.5">Programación</p>
                <p className="font-bold text-lg">
                  {service.fecha_programacion ? format(new Date(service.fecha_programacion), 'dd/MM/yyyy') : 'Pendiente'}
                </p>
              </div>
              <div>
                <p className="text-xs opacity-60 mb-0.5">Horario Objetivo</p>
                <div className="flex items-center gap-2 font-bold text-lg">
                  <Clock className="h-4 w-4 text-sidebar-ring" />
                  {service.hora_programada ?? service.horario ?? 'Abierto'}
                </div>
              </div>
              {service.hora_reprogramada && (
                <div>
                  <p className="text-xs opacity-60 mb-0.5">Hora Reprogramada</p>
                  <div className="flex items-center gap-2 font-medium">
                    <RotateCcw className="h-4 w-4 text-sidebar-ring" />
                    {service.hora_reprogramada}
                  </div>
                </div>
              )}
              {service.fecha_entrega && (
                <div>
                  <p className="text-xs opacity-60 mb-0.5">Fecha Entrega Real</p>
                  <p className="font-bold text-green-300">
                    {format(new Date(service.fecha_entrega), 'dd/MM/yyyy')}
                  </p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Assignment */}
          <Card className="shadow-sm border-border/50">
            <CardHeader className="pb-2 border-b border-border/50 bg-muted/30 flex flex-row items-center justify-between">
              <CardTitle className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
                Asignación Logística
              </CardTitle>
              <AssignDialog
                serviceId={serviceId}
                currentDriverId={service.conductor_id}
                currentVehicleId={service.vehiculo_id}
                onSuccess={refetch}
              />
            </CardHeader>
            <CardContent className="p-4 space-y-4">
              <div className="flex items-start gap-3">
                <User className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
                <div>
                  <p className="text-xs text-muted-foreground">Conductor</p>
                  <p className="font-semibold">{service.conductor ?? 'Sin asignar'}</p>
                  {service.transporte && (
                    <Badge variant="outline" className="text-[10px] mt-0.5">{service.transporte}</Badge>
                  )}
                </div>
              </div>
              <Separator />
              <div className="flex items-start gap-3">
                <Truck className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
                <div>
                  <p className="text-xs text-muted-foreground">Vehículo</p>
                  <p className="font-semibold">
                    {assignedVehicle?.placa ?? 'Sin asignar'}
                  </p>
                  {assignedVehicle && (
                    <p className="text-xs text-muted-foreground">{assignedVehicle.tipo_vehiculo}</p>
                  )}
                </div>
              </div>
              {service.tipo_servicio && (
                <>
                  <Separator />
                  <div>
                    <p className="text-xs text-muted-foreground">Tipo Servicio</p>
                    <Badge variant={service.tipo_servicio === 'FORANEO' ? 'secondary' : 'outline'} className="mt-0.5">
                      {service.tipo_servicio}
                    </Badge>
                  </div>
                </>
              )}
              {(service.kms_recorridos ?? 0) > 0 && (
                <>
                  <Separator />
                  <div>
                    <p className="text-xs text-muted-foreground">KMs Recorridos</p>
                    <p className="font-bold">{service.kms_recorridos} km</p>
                  </div>
                </>
              )}
            </CardContent>
          </Card>

          {/* Costs */}
          <Card className="shadow-sm border-border/50">
            <CardHeader className="pb-2 border-b border-border/50 bg-muted/30">
              <CardTitle className="text-xs font-bold uppercase tracking-widest text-muted-foreground flex items-center gap-2">
                <FileText className="h-4 w-4" /> Costos y Documentación
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4 space-y-3 text-sm">
              {[
                { label: 'Pedido', value: service.pedido },
                { label: 'Remisión', value: service.remision },
                { label: 'Factura', value: service.factura },
              ].map(({ label, value }) => (
                <div key={label} className="flex justify-between">
                  <span className="text-muted-foreground">{label}</span>
                  <span className="font-mono font-semibold">{value ?? '—'}</span>
                </div>
              ))}
              <Separator />
              {[
                { label: 'Costo Remisión', value: service.costo_remision },
                { label: 'Tabulador PROSIC', value: service.costo_tabulador },
                { label: 'Flete Externo', value: service.costo_flete_ext },
              ].map(({ label, value }) => (
                <div key={label} className="flex justify-between">
                  <span className="text-muted-foreground">{label}</span>
                  <span className="font-semibold">
                    {value != null ? `$${value.toLocaleString()}` : '—'}
                  </span>
                </div>
              ))}
              {service.diferencia != null && (
                <>
                  <Separator />
                  <div className="flex justify-between font-bold">
                    <span>Diferencia</span>
                    <span className={service.diferencia >= 0 ? 'text-green-600' : 'text-destructive'}>
                      {service.diferencia >= 0 ? '+' : ''}${service.diferencia.toLocaleString()}
                    </span>
                  </div>
                </>
              )}
              <Separator />
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>Última actualización</span>
                <span>
                  {service.updated_at
                    ? formatDistanceToNow(new Date(service.updated_at), { addSuffix: true, locale: es })
                    : '—'}
                </span>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
