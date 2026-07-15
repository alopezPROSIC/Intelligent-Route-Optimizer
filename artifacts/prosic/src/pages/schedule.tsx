import { useState, useMemo } from 'react';
import {
  useListServices,
  useListDrivers,
  useListVehicles,
  useUpdateService,
  type Service,
} from '@workspace/api-client-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Calendar as CalendarIcon, ChevronLeft, ChevronRight, User, Truck, Clock, Loader as Loader2, CircleAlert as AlertCircle, CircleCheck as CheckCircle2, Plus, Eye, Settings2 } from 'lucide-react';
import { format, addDays, subDays, startOfWeek, isSameDay, isToday, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

// ─── Status config ────────────────────────────────────────────────────────────
const STATUS_CONFIG: Record<string, { label: string; color: string; dot: string }> = {
  PENDIENTE:   { label: 'Pendiente',   color: 'bg-amber-100 text-amber-800 border-amber-200',   dot: 'bg-amber-400' },
  PROGRAMADO:  { label: 'Programado',  color: 'bg-blue-100 text-blue-800 border-blue-200',       dot: 'bg-blue-500' },
  EN_TRANSITO: { label: 'En Tránsito', color: 'bg-primary/10 text-primary border-primary/20',   dot: 'bg-primary' },
  ENTREGADO:   { label: 'Entregado',   color: 'bg-green-100 text-green-800 border-green-200',    dot: 'bg-green-500' },
  CANCELADO:   { label: 'Cancelado',   color: 'bg-red-100 text-red-800 border-red-200',          dot: 'bg-red-400' },
  TERMINADO:   { label: 'Terminado',   color: 'bg-muted text-muted-foreground border-border',    dot: 'bg-muted-foreground' },
};

const OPERACION_LABELS: Record<string, string> = {
  E: 'Entrega', R: 'Retiro', CF: 'Cambio Físico', RU: 'Reubicación',
};
const OPERACION_COLORS: Record<string, string> = {
  E: 'bg-blue-500', R: 'bg-orange-500', CF: 'bg-violet-500', RU: 'bg-teal-500',
};

// ─── Quick-schedule dialog ────────────────────────────────────────────────────
interface ScheduleDialogProps {
  service: Service;
  drivers: { id: number; nombre: string; activo?: boolean }[];
  vehicles: { id: number; placa: string; tipo_vehiculo: string; disponible?: boolean }[];
  targetDate: Date;
  onClose: () => void;
  onSaved: () => void;
}

function ScheduleDialog({ service, drivers, vehicles, targetDate, onClose, onSaved }: ScheduleDialogProps) {
  const update = useUpdateService();
  const [date, setDate] = useState(
    service.fecha_programacion
      ? (typeof service.fecha_programacion === 'string' ? service.fecha_programacion : format(service.fecha_programacion as Date, 'yyyy-MM-dd'))
      : format(targetDate, 'yyyy-MM-dd')
  );
  const [hora, setHora] = useState(service.hora_programada ?? '');
  const [driverId, setDriverId] = useState(service.conductor_id?.toString() ?? '');
  const [vehicleId, setVehicleId] = useState(service.vehiculo_id?.toString() ?? '');

  const handleSave = () => {
    const payload: Record<string, unknown> = {};
    if (date) payload.fecha_programacion = date;
    if (hora) payload.hora_programada = hora;
    if (driverId && driverId !== 'none') payload.conductor_id = parseInt(driverId);
    if (vehicleId && vehicleId !== 'none') payload.vehiculo_id = parseInt(vehicleId);
    if (driverId && driverId !== 'none') payload.estatus = 'PROGRAMADO';

    update.mutate({ id: service.id, data: payload as any }, {
      onSuccess: () => {
        toast.success('Servicio programado');
        onSaved();
        onClose();
      },
      onError: () => toast.error('Error al programar servicio'),
    });
  };

  return (
    <DialogContent className="max-w-md">
      <DialogHeader>
        <DialogTitle className="flex items-center gap-2">
          <Settings2 className="h-5 w-5 text-primary" />
          Programar Servicio #{service.id}
        </DialogTitle>
      </DialogHeader>

      <div className="space-y-1 p-3 rounded-lg bg-muted/40 border border-border/50">
        <div className="flex items-center gap-2">
          <span className={cn('h-2 w-2 rounded-full', OPERACION_COLORS[service.operacion])} />
          <span className="font-bold text-sm">{OPERACION_LABELS[service.operacion]}</span>
          <Badge variant="outline" className="ml-auto text-[10px]">{service.estatus}</Badge>
        </div>
        <p className="text-sm font-medium">{service.cliente}</p>
        {service.modelo && <p className="text-xs text-muted-foreground">{service.modelo}</p>}
        {service.direccion && <p className="text-xs text-muted-foreground truncate">{service.direccion}</p>}
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Fecha</Label>
          <Input type="date" value={date} onChange={e => setDate(e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Hora</Label>
          <Input type="time" value={hora} onChange={e => setHora(e.target.value)} />
        </div>
      </div>

      <Separator />

      <div className="space-y-1.5">
        <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1">
          <User className="h-3 w-3" /> Conductor
        </Label>
        <Select value={driverId} onValueChange={setDriverId}>
          <SelectTrigger><SelectValue placeholder="Sin asignar" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="none">Sin asignar</SelectItem>
            {drivers.filter(d => d.activo !== false).map(d => (
              <SelectItem key={d.id} value={d.id.toString()}>{d.nombre}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-1.5">
        <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1">
          <Truck className="h-3 w-3" /> Vehículo
        </Label>
        <Select value={vehicleId} onValueChange={setVehicleId}>
          <SelectTrigger><SelectValue placeholder="Sin asignar" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="none">Sin asignar</SelectItem>
            {vehicles.map(v => (
              <SelectItem key={v.id} value={v.id.toString()}>
                {v.placa} — {v.tipo_vehiculo}
                {v.disponible === false && ' (ocupado)'}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="flex gap-2 pt-1">
        <Button variant="outline" className="flex-1" onClick={onClose}>Cancelar</Button>
        <Button className="flex-1" onClick={handleSave} disabled={update.isPending}>
          {update.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Guardar
        </Button>
      </div>
    </DialogContent>
  );
}

// ─── Service card inside calendar cell ───────────────────────────────────────
interface ServiceCardProps {
  service: Service;
  onSchedule: (s: Service) => void;
  compact?: boolean;
}

function ServiceCard({ service, onSchedule, compact }: ServiceCardProps) {
  const cfg = STATUS_CONFIG[service.estatus] ?? STATUS_CONFIG.PENDIENTE;
  return (
    <div
      className={cn(
        'group rounded-md border p-2 cursor-pointer transition-all hover:shadow-sm hover:scale-[1.01]',
        cfg.color,
        compact ? 'text-[10px]' : 'text-xs',
      )}
      onClick={() => onSchedule(service)}
    >
      <div className="flex items-start justify-between gap-1 mb-0.5">
        <span className={cn('h-1.5 w-1.5 rounded-full mt-0.5 shrink-0', OPERACION_COLORS[service.operacion])} />
        <span className="font-bold leading-tight flex-1 truncate">{service.cliente ?? `#${service.id}`}</span>
        <Settings2 className="h-2.5 w-2.5 opacity-0 group-hover:opacity-60 shrink-0" />
      </div>
      {!compact && (
        <>
          <p className="truncate opacity-80">{OPERACION_LABELS[service.operacion]}</p>
          {service.hora_programada && (
            <div className="flex items-center gap-0.5 mt-0.5 opacity-70">
              <Clock className="h-2.5 w-2.5" />
              {service.hora_programada}
            </div>
          )}
          {service.modelo && <p className="truncate opacity-60 mt-0.5">{service.modelo}</p>}
        </>
      )}
    </div>
  );
}

// ─── Resource utilisation sidebar ─────────────────────────────────────────────
interface ResourcePanelProps {
  date: Date;
  services: Service[];
  drivers: { id: number; nombre: string; tipo: string }[];
  vehicles: { id: number; placa: string; tipo_vehiculo: string }[];
}

function ResourcePanel({ date, services, drivers, vehicles }: ResourcePanelProps) {
  const dayServices = services.filter(s => {
    const fp = s.fecha_programacion;
    if (!fp) return false;
    const d = typeof fp === 'string' ? parseISO(fp) : (fp as Date);
    return isSameDay(d, date);
  });

  const usedDriverIds = new Set(dayServices.map(s => s.conductor_id).filter(Boolean));
  const usedVehicleIds = new Set(dayServices.map(s => s.vehiculo_id).filter(Boolean));

  return (
    <div className="space-y-4">
      <div>
        <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-2">
          Conductores — {format(date, 'dd MMM', { locale: es })}
        </p>
        <div className="space-y-1.5">
          {drivers.slice(0, 8).map(d => {
            const busy = usedDriverIds.has(d.id);
            const count = dayServices.filter(s => s.conductor_id === d.id).length;
            return (
              <div key={d.id} className={cn('flex items-center gap-2 p-2 rounded-md text-xs', busy ? 'bg-primary/5 border border-primary/20' : 'bg-muted/30')}>
                <div className={cn('h-2 w-2 rounded-full', busy ? 'bg-primary' : 'bg-muted-foreground/30')} />
                <span className="flex-1 truncate font-medium">{d.nombre}</span>
                {busy && <Badge variant="outline" className="text-[9px] h-4 px-1 border-primary/30 text-primary">{count}x</Badge>}
              </div>
            );
          })}
          {drivers.length === 0 && <p className="text-xs text-muted-foreground italic">Sin conductores registrados</p>}
        </div>
      </div>

      <Separator />

      <div>
        <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-2">Vehículos</p>
        <div className="space-y-1.5">
          {vehicles.slice(0, 6).map(v => {
            const busy = usedVehicleIds.has(v.id);
            return (
              <div key={v.id} className={cn('flex items-center gap-2 p-2 rounded-md text-xs', busy ? 'bg-amber-50 border border-amber-200' : 'bg-muted/30')}>
                <Truck className={cn('h-3 w-3', busy ? 'text-amber-600' : 'text-muted-foreground/40')} />
                <span className="flex-1 font-mono font-medium">{v.placa}</span>
                <span className="text-muted-foreground">{v.tipo_vehiculo}</span>
              </div>
            );
          })}
          {vehicles.length === 0 && <p className="text-xs text-muted-foreground italic">Sin vehículos registrados</p>}
        </div>
      </div>
    </div>
  );
}

// ─── Day summary tooltip / mini card ─────────────────────────────────────────
interface DayCellProps {
  day: Date;
  services: Service[];
  onSchedule: (s: Service, day: Date) => void;
  isExpanded: boolean;
  onToggle: () => void;
}

function DayCell({ day, services, onSchedule, isExpanded, onToggle }: DayCellProps) {
  const dayServices = services.filter(s => {
    const fp = s.fecha_programacion;
    if (!fp) return false;
    const d = typeof fp === 'string' ? parseISO(fp) : (fp as Date);
    return isSameDay(d, day);
  });

  const todayClass = isToday(day);
  const VISIBLE = isExpanded ? dayServices.length : 3;
  const hidden = Math.max(0, dayServices.length - VISIBLE);

  const statusCounts = dayServices.reduce<Record<string, number>>((acc, s) => {
    acc[s.estatus] = (acc[s.estatus] ?? 0) + 1;
    return acc;
  }, {});

  return (
    <Card className={cn('flex flex-col border border-border/50 shadow-sm overflow-hidden h-full', todayClass && 'ring-2 ring-primary border-transparent')}>
      {/* Day header */}
      <div
        className={cn('px-3 py-2 border-b border-border/50 flex items-center justify-between cursor-pointer select-none',
          todayClass ? 'bg-primary text-primary-foreground' : 'bg-muted/40')}
        onClick={onToggle}
      >
        <div>
          <p className={cn('text-[10px] font-bold uppercase tracking-widest', todayClass ? 'opacity-80' : 'text-muted-foreground')}>
            {format(day, 'EEEE', { locale: es })}
          </p>
          <p className="text-lg font-black leading-none">{format(day, 'dd')}</p>
        </div>
        <div className="flex flex-col items-end gap-1">
          {dayServices.length > 0 && (
            <Badge variant={todayClass ? 'outline' : 'default'} className={cn('text-[9px] h-4 px-1', todayClass && 'border-white/40 text-white')}>
              {dayServices.length}
            </Badge>
          )}
          {Object.keys(statusCounts).length > 0 && (
            <div className="flex gap-0.5">
              {Object.entries(statusCounts).slice(0, 3).map(([st]) => (
                <div key={st} className={cn('h-1.5 w-1.5 rounded-full', STATUS_CONFIG[st]?.dot ?? 'bg-muted-foreground')} />
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Services */}
      <ScrollArea className="flex-1 min-h-[140px]">
        <div className="p-2 space-y-1.5">
          {dayServices.slice(0, VISIBLE).map(s => (
            <ServiceCard key={s.id} service={s} onSchedule={srv => onSchedule(srv, day)} />
          ))}
          {hidden > 0 && (
            <button
              onClick={onToggle}
              className="w-full text-center text-[10px] text-muted-foreground hover:text-foreground py-1 rounded hover:bg-muted/50 transition-colors"
            >
              +{hidden} más
            </button>
          )}
          {dayServices.length === 0 && (
            <div className="flex items-center justify-center h-16 text-muted-foreground/40">
              <p className="text-[11px]">Sin servicios</p>
            </div>
          )}
        </div>
      </ScrollArea>
    </Card>
  );
}

// ─── Unscheduled queue ────────────────────────────────────────────────────────
interface UnscheduledPanelProps {
  services: Service[];
  onSchedule: (s: Service) => void;
}

function UnscheduledPanel({ services, onSchedule }: UnscheduledPanelProps) {
  const unscheduled = services.filter(s =>
    !s.fecha_programacion && (s.estatus === 'PENDIENTE' || s.estatus === 'PROGRAMADO'),
  );

  return (
    <Card className="border-amber-200 bg-amber-50/30 shadow-sm">
      <CardHeader className="pb-3 border-b border-amber-200/60">
        <CardTitle className="text-sm flex items-center gap-2 text-amber-800">
          <AlertCircle className="h-4 w-4" />
          Sin Programar ({unscheduled.length})
        </CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <ScrollArea className="h-[240px]">
          <div className="p-3 space-y-2">
            {unscheduled.length === 0 && (
              <div className="flex items-center justify-center h-20 text-muted-foreground gap-2">
                <CheckCircle2 className="h-4 w-4 text-green-500" />
                <p className="text-xs">Todo programado</p>
              </div>
            )}
            {unscheduled.map(s => (
              <div
                key={s.id}
                className="flex items-center gap-3 p-2 rounded-lg bg-background border border-amber-200/40 hover:border-amber-300 transition-colors cursor-pointer group"
                onClick={() => onSchedule(s)}
              >
                <div className={cn('h-2.5 w-2.5 rounded-full shrink-0', OPERACION_COLORS[s.operacion])} />
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-bold truncate">{s.cliente ?? `#${s.id}`}</p>
                  <p className="text-[10px] text-muted-foreground">{OPERACION_LABELS[s.operacion]} · {s.modelo}</p>
                </div>
                <Button variant="ghost" size="icon" className="h-6 w-6 opacity-0 group-hover:opacity-100 text-amber-700">
                  <Plus className="h-3.5 w-3.5" />
                </Button>
              </div>
            ))}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────
export default function Schedule() {
  const [weekStart, setWeekStart] = useState(() => startOfWeek(new Date(), { weekStartsOn: 1 }));
  const [selectedService, setSelectedService] = useState<Service | null>(null);
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [expandedDays, setExpandedDays] = useState<Set<string>>(new Set());
  const [filterOp, setFilterOp] = useState<string>('ALL');
  const [filterStatus, setFilterStatus] = useState<string>('ALL');

  const endDate = addDays(weekStart, 6);

  const { data: rawServices, isLoading: svcsLoading, refetch } = useListServices({
    fecha_desde: format(subDays(weekStart, 1), 'yyyy-MM-dd'),
    fecha_hasta: format(addDays(endDate, 1), 'yyyy-MM-dd'),
  });
  const { data: pendingServices } = useListServices({ estatus: 'PENDIENTE' as any });
  const { data: drivers = [] } = useListDrivers();
  const { data: vehicles = [] } = useListVehicles();

  const services: Service[] = useMemo(() => {
    const all = rawServices ?? [];
    return all.filter(s => {
      if (filterOp !== 'ALL' && s.operacion !== filterOp) return false;
      if (filterStatus !== 'ALL' && s.estatus !== filterStatus) return false;
      return true;
    });
  }, [rawServices, filterOp, filterStatus]);

  const days = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));

  // Aggregate all services for resource panel (unfiltered)
  const allWeekServices: Service[] = rawServices ?? [];

  const weekStats = useMemo(() => {
    const total = (rawServices ?? []).length;
    const programado = (rawServices ?? []).filter(s => s.estatus === 'PROGRAMADO').length;
    const pendiente = (rawServices ?? []).filter(s => s.estatus === 'PENDIENTE').length;
    const entregado = (rawServices ?? []).filter(s => s.estatus === 'ENTREGADO').length;
    return { total, programado, pendiente, entregado };
  }, [rawServices]);

  const toggleDay = (dateStr: string) => {
    setExpandedDays(prev => {
      const next = new Set(prev);
      if (next.has(dateStr)) next.delete(dateStr); else next.add(dateStr);
      return next;
    });
  };

  const openSchedule = (service: Service, day?: Date) => {
    setSelectedService(service);
    setSelectedDate(day ?? new Date());
  };

  return (
    <div className="space-y-4">
      {/* ── Header ── */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-black tracking-tight">Programación</h1>
          <p className="text-muted-foreground">Calendario semanal de operaciones logísticas.</p>
        </div>

        <div className="flex items-center gap-2 bg-card border border-border/50 rounded-lg p-1 shadow-sm">
          <Button variant="ghost" size="icon" onClick={() => setWeekStart(d => subDays(d, 7))}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <div className="flex items-center gap-2 px-3 text-sm font-bold">
            <CalendarIcon className="h-4 w-4 text-primary" />
            {format(weekStart, 'dd MMM', { locale: es })} – {format(endDate, 'dd MMM yyyy', { locale: es })}
          </div>
          <Button variant="ghost" size="icon" onClick={() => setWeekStart(d => addDays(d, 7))}>
            <ChevronRight className="h-4 w-4" />
          </Button>
          <Separator orientation="vertical" className="h-6" />
          <Button variant="ghost" size="sm" className="text-xs" onClick={() => setWeekStart(startOfWeek(new Date(), { weekStartsOn: 1 }))}>
            Hoy
          </Button>
        </div>
      </div>

      {/* ── Week stats ── */}
      <div className="grid grid-cols-4 gap-3">
        {[
          { label: 'Total semana', value: weekStats.total, color: 'text-foreground' },
          { label: 'Programados', value: weekStats.programado, color: 'text-blue-600' },
          { label: 'Pendientes', value: weekStats.pendiente, color: 'text-amber-600' },
          { label: 'Entregados', value: weekStats.entregado, color: 'text-green-600' },
        ].map(({ label, value, color }) => (
          <Card key={label} className="border-border/50 shadow-sm">
            <CardContent className="p-4 text-center">
              <p className={cn('text-3xl font-black', color)}>{value}</p>
              <p className="text-xs text-muted-foreground mt-0.5">{label}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* ── Filters ── */}
      <div className="flex items-center gap-3 flex-wrap">
        <Select value={filterOp} onValueChange={setFilterOp}>
          <SelectTrigger className="w-[140px] h-8 text-xs bg-background">
            <SelectValue placeholder="Operación" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">Todas las ops.</SelectItem>
            {Object.entries(OPERACION_LABELS).map(([k, v]) => (
              <SelectItem key={k} value={k}>{v}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={filterStatus} onValueChange={setFilterStatus}>
          <SelectTrigger className="w-[150px] h-8 text-xs bg-background">
            <SelectValue placeholder="Estatus" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">Todos los estatus</SelectItem>
            {Object.entries(STATUS_CONFIG).map(([k, v]) => (
              <SelectItem key={k} value={k}>{v.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        {(filterOp !== 'ALL' || filterStatus !== 'ALL') && (
          <Button variant="ghost" size="sm" className="h-8 text-xs text-muted-foreground" onClick={() => { setFilterOp('ALL'); setFilterStatus('ALL'); }}>
            Limpiar
          </Button>
        )}
        <div className="ml-auto text-xs text-muted-foreground">
          {svcsLoading ? 'Cargando...' : `${services.length} servicio(s)`}
        </div>
      </div>

      {/* ── Main grid ── */}
      <div className="grid grid-cols-1 xl:grid-cols-[1fr_220px] gap-4">
        {/* Calendar */}
        <div className="space-y-3">
          {svcsLoading ? (
            <div className="flex items-center justify-center h-64">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-7 gap-2" style={{ minHeight: 480 }}>
              {days.map(day => {
                const dateStr = format(day, 'yyyy-MM-dd');
                return (
                  <DayCell
                    key={dateStr}
                    day={day}
                    services={services}
                    onSchedule={openSchedule}
                    isExpanded={expandedDays.has(dateStr)}
                    onToggle={() => toggleDay(dateStr)}
                  />
                );
              })}
            </div>
          )}

          {/* Unscheduled queue */}
          {(pendingServices?.length ?? 0) > 0 && (
            <UnscheduledPanel
              services={pendingServices ?? []}
              onSchedule={s => openSchedule(s, new Date())}
            />
          )}
        </div>

        {/* Resource sidebar */}
        <div className="hidden xl:block">
          <Card className="border-border/50 shadow-sm sticky top-4">
            <CardHeader className="pb-3 border-b border-border/50 bg-muted/30">
              <CardTitle className="text-sm">Disponibilidad</CardTitle>
            </CardHeader>
            <CardContent className="p-4">
              <ResourcePanel
                date={new Date()}
                services={allWeekServices}
                drivers={drivers}
                vehicles={vehicles}
              />
            </CardContent>
          </Card>
        </div>
      </div>

      {/* ── Schedule dialog ── */}
      <Dialog open={!!selectedService} onOpenChange={open => { if (!open) setSelectedService(null); }}>
        {selectedService && (
          <ScheduleDialog
            service={selectedService}
            drivers={drivers}
            vehicles={vehicles}
            targetDate={selectedDate}
            onClose={() => setSelectedService(null)}
            onSaved={refetch}
          />
        )}
      </Dialog>
    </div>
  );
}
