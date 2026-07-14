import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  useCreateService,
  useUpdateService,
  useListClients,
  useListEquipment,
  useListDrivers,
  useListVehicles,
  useListBranches,
  ServiceInputOperacion,
  ServiceInputEstatus,
  ServiceInputTransporte,
  ServiceInputTipoServicio,
} from '@workspace/api-client-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Loader as Loader2 } from 'lucide-react';
import { toast } from 'sonner';

const serviceSchema = z.object({
  operacion: z.enum(['E', 'R', 'CF', 'RU']),
  estatus: z.enum(['PENDIENTE', 'PROGRAMADO', 'EN_TRANSITO', 'ENTREGADO', 'CANCELADO', 'TERMINADO']),
  fecha_solicitud: z.string().optional(),
  fecha_programacion: z.string().optional(),
  horario: z.string().optional(),
  sucursal_salida: z.string().optional(),
  sucursal_vendedor: z.string().optional(),
  vendedor: z.string().optional(),
  pedido: z.string().optional(),
  remision: z.string().optional(),
  cliente: z.string().optional(),
  obra: z.string().optional(),
  direccion: z.string().optional(),
  modelo: z.string().optional(),
  serie: z.string().optional(),
  dias_renta: z.coerce.number().optional(),
  costo_remision: z.coerce.number().optional(),
  costo_tabulador: z.coerce.number().optional(),
  costo_flete_ext: z.coerce.number().optional(),
  transporte: z.enum(['PROPIO', 'EXTERNO']).optional(),
  conductor_id: z.coerce.number().optional(),
  vehiculo_id: z.coerce.number().optional(),
  hora_programada: z.string().optional(),
  contacto_nombre: z.string().optional(),
  contacto_telefono: z.string().optional(),
  tipo_servicio: z.enum(['LOCAL', 'FORANEO']).optional(),
});

type ServiceFormValues = z.infer<typeof serviceSchema>;

interface ServiceFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  service?: {
    id: number;
    operacion: string;
    estatus: string;
    cliente?: string | null;
    obra?: string | null;
    direccion?: string | null;
    modelo?: string | null;
    serie?: string | null;
    pedido?: string | null;
    remision?: string | null;
    vendedor?: string | null;
    sucursal_salida?: string | null;
    sucursal_vendedor?: string | null;
    fecha_solicitud?: string | null;
    fecha_programacion?: string | null;
    horario?: string | null;
    hora_programada?: string | null;
    dias_renta?: number | null;
    costo_remision?: number | null;
    costo_tabulador?: number | null;
    costo_flete_ext?: number | null;
    transporte?: string | null;
    conductor_id?: number | null;
    vehiculo_id?: number | null;
    contacto_nombre?: string | null;
    contacto_telefono?: string | null;
    tipo_servicio?: string | null;
  } | null;
  onSuccess?: () => void;
}

export function ServiceFormDialog({ open, onOpenChange, service, onSuccess }: ServiceFormDialogProps) {
  const isEdit = !!service;

  const { data: clients } = useListClients();
  const { data: equipment } = useListEquipment();
  const { data: drivers } = useListDrivers();
  const { data: vehicles } = useListVehicles();
  const { data: branches } = useListBranches();

  const createService = useCreateService();
  const updateService = useUpdateService();

  const form = useForm<ServiceFormValues>({
    resolver: zodResolver(serviceSchema),
    defaultValues: {
      operacion: (service?.operacion as ServiceFormValues['operacion']) ?? 'E',
      estatus: (service?.estatus as ServiceFormValues['estatus']) ?? 'PENDIENTE',
      fecha_solicitud: service?.fecha_solicitud
        ? String(service.fecha_solicitud).slice(0, 10)
        : new Date().toISOString().slice(0, 10),
      fecha_programacion: service?.fecha_programacion
        ? String(service.fecha_programacion).slice(0, 10)
        : '',
      horario: service?.horario ?? '',
      sucursal_salida: service?.sucursal_salida ?? '',
      sucursal_vendedor: service?.sucursal_vendedor ?? '',
      vendedor: service?.vendedor ?? '',
      pedido: service?.pedido ?? '',
      remision: service?.remision ?? '',
      cliente: service?.cliente ?? '',
      obra: service?.obra ?? '',
      direccion: service?.direccion ?? '',
      modelo: service?.modelo ?? '',
      serie: service?.serie ?? '',
      dias_renta: service?.dias_renta ?? undefined,
      costo_remision: service?.costo_remision ?? undefined,
      costo_tabulador: service?.costo_tabulador ?? undefined,
      costo_flete_ext: service?.costo_flete_ext ?? undefined,
      transporte: (service?.transporte as ServiceFormValues['transporte']) ?? undefined,
      conductor_id: service?.conductor_id ?? undefined,
      vehiculo_id: service?.vehiculo_id ?? undefined,
      hora_programada: service?.hora_programada ?? '',
      contacto_nombre: service?.contacto_nombre ?? '',
      contacto_telefono: service?.contacto_telefono ?? '',
      tipo_servicio: (service?.tipo_servicio as ServiceFormValues['tipo_servicio']) ?? undefined,
    },
  });

  const watchedCliente = form.watch('cliente');
  const clienteObras = clients
    ?.filter(c => c.cliente === watchedCliente)
    .map(c => c.obra) ?? [];

  const onSubmit = (values: ServiceFormValues) => {
    const payload = {
      ...values,
      fecha_solicitud: values.fecha_solicitud || undefined,
      fecha_programacion: values.fecha_programacion || undefined,
    };

    if (isEdit) {
      updateService.mutate(
        { id: service!.id, data: payload },
        {
          onSuccess: () => {
            toast.success('Servicio actualizado');
            onOpenChange(false);
            onSuccess?.();
          },
          onError: () => toast.error('Error al actualizar servicio'),
        },
      );
    } else {
      createService.mutate(
        { data: payload },
        {
          onSuccess: () => {
            toast.success('Servicio creado');
            form.reset();
            onOpenChange(false);
            onSuccess?.();
          },
          onError: () => toast.error('Error al crear servicio'),
        },
      );
    }
  };

  const isPending = createService.isPending || updateService.isPending;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-xl font-black">
            {isEdit ? `Editar Servicio #${service!.id}` : 'Nuevo Servicio'}
          </DialogTitle>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-0">
            <Tabs defaultValue="general">
              <TabsList className="w-full grid grid-cols-4 mb-4">
                <TabsTrigger value="general">General</TabsTrigger>
                <TabsTrigger value="equipo">Equipo</TabsTrigger>
                <TabsTrigger value="logistica">Logística</TabsTrigger>
                <TabsTrigger value="costos">Costos</TabsTrigger>
              </TabsList>

              {/* ── GENERAL ────────────────────────────────────────────── */}
              <TabsContent value="general" className="space-y-4 mt-0">
                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="operacion"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Operación *</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Seleccionar..." />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="E">Entrega (E)</SelectItem>
                            <SelectItem value="R">Retiro (R)</SelectItem>
                            <SelectItem value="CF">Cambio Físico (CF)</SelectItem>
                            <SelectItem value="RU">Reubicación (RU)</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="estatus"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Estatus *</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Seleccionar..." />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {Object.values(ServiceInputEstatus).map(s => (
                              <SelectItem key={s} value={s}>{s}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="fecha_solicitud"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Fecha Solicitud</FormLabel>
                        <FormControl>
                          <Input type="date" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="fecha_programacion"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Fecha Programación</FormLabel>
                        <FormControl>
                          <Input type="date" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="horario"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Horario</FormLabel>
                        <FormControl>
                          <Input placeholder="Ej: MATUTINO" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="tipo_servicio"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Tipo de Servicio</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value ?? ''}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Local / Foráneo" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="LOCAL">Local</SelectItem>
                            <SelectItem value="FORANEO">Foráneo</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <FormField
                  control={form.control}
                  name="cliente"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Cliente</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value ?? ''}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Seleccionar cliente..." />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {[...new Set(clients?.map(c => c.cliente))].map(name => (
                            <SelectItem key={name} value={name}>{name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="obra"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Obra</FormLabel>
                      {clienteObras.length > 0 ? (
                        <Select onValueChange={field.onChange} value={field.value ?? ''}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Seleccionar obra..." />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {clienteObras.map(obra => (
                              <SelectItem key={obra} value={obra}>{obra}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      ) : (
                        <FormControl>
                          <Input placeholder="Nombre de la obra" {...field} />
                        </FormControl>
                      )}
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="direccion"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Dirección de Entrega</FormLabel>
                      <FormControl>
                        <Input placeholder="Calle, número, colonia, municipio, CP" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="pedido"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Pedido</FormLabel>
                        <FormControl>
                          <Input placeholder="# Pedido" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="remision"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Remisión</FormLabel>
                        <FormControl>
                          <Input placeholder="# Remisión" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="contacto_nombre"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Nombre de Contacto</FormLabel>
                        <FormControl>
                          <Input placeholder="Nombre en sitio" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="contacto_telefono"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Teléfono de Contacto</FormLabel>
                        <FormControl>
                          <Input placeholder="10 dígitos" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              </TabsContent>

              {/* ── EQUIPO ─────────────────────────────────────────────── */}
              <TabsContent value="equipo" className="space-y-4 mt-0">
                <FormField
                  control={form.control}
                  name="modelo"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Modelo de Equipo</FormLabel>
                      <Select onValueChange={v => {
                        field.onChange(v);
                        const eq = equipment?.find(e => e.modelo === v);
                        if (eq) form.setValue('serie', eq.serie);
                      }} value={field.value ?? ''}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Seleccionar modelo..." />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {equipment?.map(e => (
                            <SelectItem key={e.id} value={e.modelo}>{e.modelo}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="serie"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Número de Serie</FormLabel>
                      <FormControl>
                        <Input placeholder="Serie del equipo" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="dias_renta"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Días de Renta</FormLabel>
                      <FormControl>
                        <Input type="number" min="1" placeholder="Número de días" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </TabsContent>

              {/* ── LOGÍSTICA ──────────────────────────────────────────── */}
              <TabsContent value="logistica" className="space-y-4 mt-0">
                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="sucursal_salida"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Sucursal Salida</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value ?? ''}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Seleccionar sucursal..." />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {branches?.map(b => (
                              <SelectItem key={b.id} value={b.nombre}>{b.nombre}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="sucursal_vendedor"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Sucursal Vendedor</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value ?? ''}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Seleccionar sucursal..." />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {branches?.map(b => (
                              <SelectItem key={b.id} value={b.nombre}>{b.nombre}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <FormField
                  control={form.control}
                  name="vendedor"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Vendedor</FormLabel>
                      <FormControl>
                        <Input placeholder="Nombre del vendedor" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="transporte"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Tipo de Transporte</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value ?? ''}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Propio / Externo" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="PROPIO">Propio</SelectItem>
                          <SelectItem value="EXTERNO">Externo</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="conductor_id"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Conductor</FormLabel>
                      <Select
                        onValueChange={v => field.onChange(v === 'none' ? undefined : Number(v))}
                        value={field.value ? String(field.value) : 'none'}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Seleccionar conductor..." />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="none">Sin asignar</SelectItem>
                          {drivers?.filter(d => d.activo !== false).map(d => (
                            <SelectItem key={d.id} value={String(d.id)}>{d.nombre} ({d.tipo})</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="vehiculo_id"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Vehículo</FormLabel>
                      <Select
                        onValueChange={v => field.onChange(v === 'none' ? undefined : Number(v))}
                        value={field.value ? String(field.value) : 'none'}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Seleccionar vehículo..." />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="none">Sin asignar</SelectItem>
                          {vehicles?.filter(v => v.disponible !== false).map(v => (
                            <SelectItem key={v.id} value={String(v.id)}>{v.placa} — {v.tipo_vehiculo}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="hora_programada"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Hora Programada</FormLabel>
                      <FormControl>
                        <Input type="time" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </TabsContent>

              {/* ── COSTOS ─────────────────────────────────────────────── */}
              <TabsContent value="costos" className="space-y-4 mt-0">
                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="costo_remision"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Costo Remisión (Flete Sencillo)</FormLabel>
                        <FormControl>
                          <Input type="number" step="0.01" placeholder="0.00" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="costo_tabulador"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Costo Tabulador PROSIC</FormLabel>
                        <FormControl>
                          <Input type="number" step="0.01" placeholder="0.00" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="costo_flete_ext"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Costo Flete Externo (sin IVA)</FormLabel>
                        <FormControl>
                          <Input type="number" step="0.01" placeholder="0.00" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              </TabsContent>
            </Tabs>

            <div className="flex justify-end gap-3 pt-4 border-t border-border/50 mt-4">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={isPending} className="font-bold">
                {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {isEdit ? 'Guardar Cambios' : 'Crear Servicio'}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
