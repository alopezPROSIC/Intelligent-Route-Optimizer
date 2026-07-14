import { useState } from 'react';
import { 
  useListServices, 
  useListDrivers, 
  useListVehicles,
  useUpdateService,
  ServiceEstatus
} from '@workspace/api-client-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Calendar as CalendarIcon, ChevronLeft, ChevronRight, User, Truck, Clock } from 'lucide-react';
import { format, addDays, subDays, isSameDay } from 'date-fns';
import { es } from 'date-fns/locale';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';

export default function Schedule() {
  const [currentDate, setCurrentDate] = useState(new Date());
  
  // Get week bounds
  const startDate = currentDate;
  const endDate = addDays(currentDate, 6);
  
  const { data: services, refetch } = useListServices({
    fecha_desde: format(startDate, 'yyyy-MM-dd'),
    fecha_hasta: format(endDate, 'yyyy-MM-dd')
  });

  const { data: drivers } = useListDrivers();
  const { data: vehicles } = useListVehicles();
  const updateService = useUpdateService();

  const days = Array.from({ length: 7 }).map((_, i) => addDays(startDate, i));

  const handleAssign = (serviceId: number, field: 'conductor_id' | 'vehiculo_id', value: string) => {
    updateService.mutate({
      id: serviceId,
      data: { [field]: value === 'unassigned' ? null : parseInt(value) }
    }, {
      onSuccess: () => {
        toast.success('Asignación actualizada');
        refetch();
      }
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-black tracking-tight">Programación</h1>
          <p className="text-muted-foreground">Vista semanal de operaciones y asignación de recursos.</p>
        </div>
        
        <div className="flex items-center gap-2 bg-card p-1 rounded-lg border border-border/50 shadow-sm">
          <Button variant="ghost" size="icon" onClick={() => setCurrentDate(subDays(currentDate, 7))}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <div className="flex items-center gap-2 px-4 font-bold text-sm">
            <CalendarIcon className="h-4 w-4 text-primary" />
            {format(startDate, 'dd MMM', { locale: es })} - {format(endDate, 'dd MMM', { locale: es })}
          </div>
          <Button variant="ghost" size="icon" onClick={() => setCurrentDate(addDays(currentDate, 7))}>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-7 gap-4">
        {days.map((day) => {
          const dayServices = services?.filter(s => 
            s.fecha_programacion && isSameDay(new Date(s.fecha_programacion), day)
          ) || [];

          const isToday = isSameDay(day, new Date());

          return (
            <Card key={day.toString()} className={`flex flex-col border-border/50 shadow-sm overflow-hidden ${isToday ? 'ring-2 ring-primary border-transparent' : ''}`}>
              <div className={`p-3 text-center border-b ${isToday ? 'bg-primary text-primary-foreground' : 'bg-muted/50'}`}>
                <p className="text-xs font-bold uppercase tracking-wider">{format(day, 'EEEE', { locale: es })}</p>
                <p className="text-2xl font-black">{format(day, 'dd')}</p>
                <p className="text-[10px] opacity-80">{format(day, 'MMM', { locale: es })}</p>
              </div>
              
              <div className="flex-1 p-2 bg-background min-h-[400px] flex flex-col gap-3">
                {dayServices.length === 0 ? (
                  <div className="flex-1 flex items-center justify-center text-center p-4">
                    <span className="text-xs text-muted-foreground opacity-50">Sin servicios</span>
                  </div>
                ) : (
                  dayServices.map(service => (
                    <div key={service.id} className="bg-card border border-border/60 rounded-md p-3 shadow-sm flex flex-col gap-3 hover:border-primary/50 transition-colors">
                      <div>
                        <div className="flex justify-between items-start mb-1">
                          <Badge variant="outline" className={`text-[10px] px-1 py-0 h-4 border-0 ${service.operacion === 'E' ? 'bg-blue-100 text-blue-800' : 'bg-amber-100 text-amber-800'}`}>
                            {service.operacion === 'E' ? 'ENTREGA' : 'RETIRO'}
                          </Badge>
                          <span className="text-xs font-mono text-muted-foreground">#{service.id}</span>
                        </div>
                        <p className="font-bold text-sm leading-tight line-clamp-1" title={service.cliente || ''}>{service.cliente}</p>
                        <p className="text-xs text-primary font-medium mt-1 truncate">{service.modelo}</p>
                      </div>

                      <div className="flex items-center gap-1 text-xs text-muted-foreground font-medium bg-muted/30 p-1 rounded">
                        <Clock className="h-3 w-3" />
                        {service.hora_programada || service.horario || 'Sin hora'}
                      </div>

                      <div className="space-y-2 pt-2 border-t border-border/50">
                        <div className="flex items-center gap-2">
                          <User className="h-3 w-3 text-muted-foreground shrink-0" />
                          <Select 
                            value={service.conductor_id?.toString() || 'unassigned'} 
                            onValueChange={(val) => handleAssign(service.id, 'conductor_id', val)}
                          >
                            <SelectTrigger className="h-7 text-xs px-2 border-0 bg-transparent hover:bg-muted focus:ring-0">
                              <SelectValue placeholder="Conductor" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="unassigned" className="text-muted-foreground italic">Sin asignar</SelectItem>
                              {drivers?.filter(d => d.activo !== false).map(d => (
                                <SelectItem key={d.id} value={d.id.toString()}>{d.nombre}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="flex items-center gap-2">
                          <Truck className="h-3 w-3 text-muted-foreground shrink-0" />
                          <Select 
                            value={service.vehiculo_id?.toString() || 'unassigned'} 
                            onValueChange={(val) => handleAssign(service.id, 'vehiculo_id', val)}
                          >
                            <SelectTrigger className="h-7 text-xs px-2 border-0 bg-transparent hover:bg-muted focus:ring-0">
                              <SelectValue placeholder="Vehículo" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="unassigned" className="text-muted-foreground italic">Sin asignar</SelectItem>
                              {vehicles?.filter(v => v.disponible !== false).map(v => (
                                <SelectItem key={v.id} value={v.id.toString()}>{v.placa}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
