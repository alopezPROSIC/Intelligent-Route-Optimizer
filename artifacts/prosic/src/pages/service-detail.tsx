import { useState } from 'react';
import { useParams, Link } from 'wouter';
import { 
  useGetService, 
  useUpdateServiceStatus,
  ServiceStatusInputEstatus,
  useListDrivers,
  useListVehicles,
  useUpdateService
} from '@workspace/api-client-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, ArrowLeft, Truck, MapPin, Calendar, Clock, User, Phone, CheckCircle2, FileText, PenTool } from 'lucide-react';
import { format } from 'date-fns';
import { toast } from 'sonner';
import { Textarea } from '@/components/ui/textarea';

export default function ServiceDetail() {
  const { id } = useParams<{ id: string }>();
  const serviceId = parseInt(id, 10);
  
  const { data: service, isLoading, refetch } = useGetService(serviceId, { query: { enabled: !!serviceId } });
  const updateStatus = useUpdateServiceStatus();
  const updateService = useUpdateService();
  
  const { data: drivers } = useListDrivers({}, { query: { enabled: !!serviceId }});
  const { data: vehicles } = useListVehicles({ query: { enabled: !!serviceId }});

  const [statusDialogOpen, setStatusDialogOpen] = useState(false);
  const [newStatus, setNewStatus] = useState<ServiceStatusInputEstatus | ''>('');
  const [statusComment, setStatusComment] = useState('');

  const [assignDialogOpen, setAssignDialogOpen] = useState(false);
  const [selectedDriver, setSelectedDriver] = useState<string>('');
  const [selectedVehicle, setSelectedVehicle] = useState<string>('');

  if (isLoading) {
    return (
      <div className="flex h-[80vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!service) {
    return (
      <div className="text-center py-20">
        <h2 className="text-2xl font-bold">Servicio no encontrado</h2>
        <Button asChild className="mt-4">
          <Link href="/services">Volver a Servicios</Link>
        </Button>
      </div>
    );
  }

  const handleStatusUpdate = () => {
    if (!newStatus) return;
    updateStatus.mutate({ 
      id: serviceId, 
      data: { estatus: newStatus as ServiceStatusInputEstatus, comentario: statusComment } 
    }, {
      onSuccess: () => {
        toast.success('Estatus actualizado correctamente');
        setStatusDialogOpen(false);
        refetch();
      },
      onError: () => toast.error('Error al actualizar estatus')
    });
  };

  const handleAssign = () => {
    if (!selectedDriver && !selectedVehicle) return;
    
    updateService.mutate({
      id: serviceId,
      data: {
        conductor_id: selectedDriver ? parseInt(selectedDriver) : undefined,
        vehiculo_id: selectedVehicle ? parseInt(selectedVehicle) : undefined,
      }
    }, {
      onSuccess: () => {
        toast.success('Asignación actualizada');
        setAssignDialogOpen(false);
        refetch();
      },
      onError: () => toast.error('Error al actualizar asignación')
    });
  };

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      <div className="flex items-center gap-4">
        <Button variant="outline" size="icon" asChild className="shrink-0">
          <Link href="/services"><ArrowLeft className="h-4 w-4" /></Link>
        </Button>
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl sm:text-3xl font-black tracking-tight">Servicio #{service.id}</h1>
            <Badge variant="outline" className="text-sm border-primary text-primary bg-primary/5">
              {service.operacion === 'E' ? 'ENTREGA' : service.operacion === 'R' ? 'RETIRO' : service.operacion}
            </Badge>
            <Badge className="text-sm bg-accent text-accent-foreground hover:bg-accent/90">
              {service.estatus}
            </Badge>
          </div>
          <p className="text-muted-foreground mt-1">Creado: {service.created_at ? format(new Date(service.created_at), 'dd/MM/yyyy HH:mm') : 'N/A'}</p>
        </div>
        <div className="ml-auto flex gap-2">
          <Dialog open={statusDialogOpen} onOpenChange={setStatusDialogOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" className="border-primary text-primary hover:bg-primary/5">
                <CheckCircle2 className="mr-2 h-4 w-4" />
                Actualizar Estatus
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Actualizar Estatus de Servicio</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 pt-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Nuevo Estatus</label>
                  <Select value={newStatus} onValueChange={(v) => setNewStatus(v as ServiceStatusInputEstatus)}>
                    <SelectTrigger>
                      <SelectValue placeholder="Seleccionar..." />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.values(ServiceStatusInputEstatus).map(s => (
                        <SelectItem key={s} value={s}>{s}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Comentarios (Opcional)</label>
                  <Textarea 
                    value={statusComment} 
                    onChange={e => setStatusComment(e.target.value)} 
                    placeholder="Detalles sobre el cambio de estatus..."
                  />
                </div>
                <Button className="w-full" onClick={handleStatusUpdate} disabled={!newStatus || updateStatus.isPending}>
                  {updateStatus.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                  Confirmar Cambio
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Main Details */}
        <div className="md:col-span-2 space-y-6">
          <Card className="shadow-sm border-border/50">
            <CardHeader className="bg-muted/30 pb-4 border-b border-border/50">
              <CardTitle className="text-lg flex items-center gap-2">
                <MapPin className="h-5 w-5 text-primary" />
                Destino y Contacto
              </CardTitle>
            </CardHeader>
            <CardContent className="p-6">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                <div>
                  <p className="text-sm font-bold text-muted-foreground uppercase tracking-widest mb-1">Cliente</p>
                  <p className="text-lg font-bold">{service.cliente}</p>
                  <p className="text-muted-foreground mt-1">Obra: {service.obra || 'N/A'}</p>
                </div>
                <div>
                  <p className="text-sm font-bold text-muted-foreground uppercase tracking-widest mb-1">Dirección</p>
                  <p className="font-medium text-foreground">{service.direccion}</p>
                </div>
                <div className="sm:col-span-2 pt-4 border-t border-border/50">
                  <p className="text-sm font-bold text-muted-foreground uppercase tracking-widest mb-2">Contacto en sitio</p>
                  <div className="flex items-center gap-6">
                    <div className="flex items-center gap-2">
                      <User className="h-4 w-4 text-muted-foreground" />
                      <span className="font-medium">{service.contacto_nombre || 'No especificado'}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Phone className="h-4 w-4 text-muted-foreground" />
                      <span className="font-medium">{service.contacto_telefono || 'No especificado'}</span>
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="shadow-sm border-border/50">
            <CardHeader className="bg-muted/30 pb-4 border-b border-border/50">
              <CardTitle className="text-lg flex items-center gap-2">
                <Truck className="h-5 w-5 text-primary" />
                Equipo a {service.operacion === 'E' ? 'Entregar' : 'Retirar'}
              </CardTitle>
            </CardHeader>
            <CardContent className="p-6">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-2xl font-black text-primary">{service.modelo}</p>
                  <p className="text-lg font-medium text-muted-foreground mt-1">Serie: <span className="text-foreground">{service.serie}</span></p>
                </div>
                <div className="bg-primary/10 p-4 rounded-xl text-center">
                  <p className="text-sm text-primary font-bold uppercase">Días Renta</p>
                  <p className="text-3xl font-black text-primary">{service.dias_renta || '-'}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Sidebar Info */}
        <div className="space-y-6">
          <Card className="shadow-sm border-border/50 bg-sidebar text-sidebar-foreground">
            <CardHeader className="pb-2">
              <CardTitle className="text-lg flex items-center gap-2 text-sidebar-primary-foreground">
                <Calendar className="h-5 w-5" />
                Programación
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <p className="text-sidebar-foreground/60 text-sm mb-1">Fecha Programada</p>
                <p className="font-bold text-lg">
                  {service.fecha_programacion ? format(new Date(service.fecha_programacion), 'dd/MM/yyyy') : 'Pendiente'}
                </p>
              </div>
              <div>
                <p className="text-sidebar-foreground/60 text-sm mb-1">Horario Objetivo</p>
                <div className="flex items-center gap-2 font-bold text-lg">
                  <Clock className="h-5 w-5 text-sidebar-ring" />
                  {service.hora_programada || service.horario || 'Abierto'}
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="shadow-sm border-border/50">
            <CardHeader className="flex flex-row items-center justify-between pb-2 border-b border-border/50 bg-muted/30">
              <CardTitle className="text-sm font-bold uppercase tracking-widest text-muted-foreground">Asignación Logística</CardTitle>
              <Dialog open={assignDialogOpen} onOpenChange={setAssignDialogOpen}>
                <DialogTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-8 w-8 text-primary">
                    <PenTool className="h-4 w-4" />
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Asignar Recursos Logísticos</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-4 pt-4">
                    <div className="space-y-2">
                      <label className="text-sm font-medium">Conductor</label>
                      <Select value={selectedDriver} onValueChange={setSelectedDriver}>
                        <SelectTrigger>
                          <SelectValue placeholder="Seleccionar conductor..." />
                        </SelectTrigger>
                        <SelectContent>
                          {drivers?.map(d => (
                            <SelectItem key={d.id} value={d.id.toString()}>{d.nombre}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-medium">Vehículo</label>
                      <Select value={selectedVehicle} onValueChange={setSelectedVehicle}>
                        <SelectTrigger>
                          <SelectValue placeholder="Seleccionar vehículo..." />
                        </SelectTrigger>
                        <SelectContent>
                          {vehicles?.map(v => (
                            <SelectItem key={v.id} value={v.id.toString()}>{v.placa} - {v.tipo_vehiculo}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <Button className="w-full" onClick={handleAssign} disabled={updateService.isPending}>
                      {updateService.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                      Guardar Asignación
                    </Button>
                  </div>
                </DialogContent>
              </Dialog>
            </CardHeader>
            <CardContent className="p-4 space-y-4">
              <div>
                <p className="text-xs text-muted-foreground mb-1">Conductor</p>
                <p className="font-semibold">{service.conductor || 'Sin asignar'}</p>
              </div>
              <Separator />
              <div>
                <p className="text-xs text-muted-foreground mb-1">Vehículo / Transporte</p>
                <p className="font-semibold">
                  {service.transporte === 'EXTERNO' ? 'Transporte Externo' : 
                   vehicles?.find(v => v.id === service.vehiculo_id)?.placa || 'Sin asignar'}
                </p>
              </div>
            </CardContent>
          </Card>
          
          <Card className="shadow-sm border-border/50">
             <CardHeader className="pb-2 border-b border-border/50 bg-muted/30">
               <CardTitle className="text-sm font-bold uppercase tracking-widest text-muted-foreground">Documentación</CardTitle>
             </CardHeader>
             <CardContent className="p-4 space-y-3">
               <div className="flex justify-between items-center">
                 <span className="text-sm">Pedido</span>
                 <span className="font-mono text-sm">{service.pedido || '-'}</span>
               </div>
               <div className="flex justify-between items-center">
                 <span className="text-sm">Remisión</span>
                 <span className="font-mono text-sm font-bold text-primary">{service.remision || '-'}</span>
               </div>
               <div className="flex justify-between items-center">
                 <span className="text-sm">Factura</span>
                 <span className="font-mono text-sm">{service.factura || '-'}</span>
               </div>
             </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
