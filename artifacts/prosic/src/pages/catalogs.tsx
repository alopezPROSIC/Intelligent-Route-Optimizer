import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card } from '@/components/ui/card';
import {
  useListClients, useCreateClient, useUpdateClient, useDeleteClient,
  useListVehicles, useCreateVehicle, useUpdateVehicle, useDeleteVehicle,
  useListEquipment, useCreateEquipment, useUpdateEquipment, useDeleteEquipment,
  useListDrivers, useCreateDriver, useUpdateDriver, useDeleteDriver,
  useListBranches, useCreateBranch,
  type Client, type Vehicle, type Equipment, type Driver,
} from '@workspace/api-client-react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Loader2, Users, Truck, Wrench, HardHat, Building2, Plus, Pencil, Trash2 } from 'lucide-react';
import { toast } from 'sonner';

// ─── Schema definitions ────────────────────────────────────────────────────────

const clientSchema = z.object({
  cliente: z.string().min(1, 'Requerido'),
  obra: z.string().min(1, 'Requerido'),
  comentarios_operaciones: z.string().optional(),
  calificacion: z.enum(['bueno', 'regular', 'malo']).optional(),
  sector_alimenticio: z.boolean().optional(),
  sector_automotriz: z.boolean().optional(),
  sector_construccion: z.boolean().optional(),
});

const vehicleSchema = z.object({
  placa: z.string().min(1, 'Requerido'),
  capacidad: z.coerce.number().min(0, 'Requerido'),
  tipo_vehiculo: z.string().min(1, 'Requerido'),
  ubicacion: z.string().optional(),
  conductor_asignado: z.string().optional(),
  disponible: z.boolean().optional(),
});

const equipmentSchema = z.object({
  modelo: z.string().min(1, 'Requerido'),
  serie: z.string().min(1, 'Requerido'),
  tipo: z.string().optional(),
  disponible: z.boolean().optional(),
});

const driverSchema = z.object({
  nombre: z.string().min(1, 'Requerido'),
  tipo: z.enum(['PROPIO', 'EXTERNO']),
  activo: z.boolean().optional(),
});

const branchSchema = z.object({
  nombre: z.string().min(1, 'Requerido'),
  ciudad: z.string().optional(),
  latitud: z.coerce.number().optional(),
  longitud: z.coerce.number().optional(),
});

// ─── Generic confirm delete dialog ────────────────────────────────────────────

function DeleteConfirm({
  open, onOpenChange, label, onConfirm, isPending,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  label: string;
  onConfirm: () => void;
  isPending: boolean;
}) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>¿Eliminar {label}?</AlertDialogTitle>
          <AlertDialogDescription>
            Esta acción no se puede deshacer. El registro se eliminará permanentemente.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancelar</AlertDialogCancel>
          <AlertDialogAction
            onClick={onConfirm}
            disabled={isPending}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Eliminar
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

// ─── CLIENTS TAB ──────────────────────────────────────────────────────────────

function ClientsTab() {
  const { data: clients, isLoading, refetch } = useListClients();
  const createClient = useCreateClient();
  const updateClient = useUpdateClient();
  const deleteClient = useDeleteClient();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editItem, setEditItem] = useState<Client | null>(null);
  const [deleteId, setDeleteId] = useState<number | null>(null);

  const form = useForm<z.infer<typeof clientSchema>>({ resolver: zodResolver(clientSchema) });

  const openCreate = () => {
    setEditItem(null);
    form.reset({ cliente: '', obra: '', comentarios_operaciones: '', sector_alimenticio: false, sector_automotriz: false, sector_construccion: false });
    setDialogOpen(true);
  };

  const openEdit = (item: NonNullable<typeof editItem>) => {
    setEditItem(item);
    form.reset({
      cliente: item.cliente,
      obra: item.obra,
      comentarios_operaciones: item.comentarios_operaciones ?? '',
      calificacion: (item.calificacion as any) ?? undefined,
      sector_alimenticio: item.sector_alimenticio,
      sector_automotriz: item.sector_automotriz,
      sector_construccion: item.sector_construccion,
    });
    setDialogOpen(true);
  };

  const onSubmit = (values: z.infer<typeof clientSchema>) => {
    if (editItem) {
      updateClient.mutate({ id: editItem.id, data: values }, {
        onSuccess: () => { toast.success('Cliente actualizado'); setDialogOpen(false); refetch(); },
        onError: () => toast.error('Error al actualizar'),
      });
    } else {
      createClient.mutate({ data: values }, {
        onSuccess: () => { toast.success('Cliente creado'); setDialogOpen(false); refetch(); },
        onError: () => toast.error('Error al crear'),
      });
    }
  };

  const confirmDelete = () => {
    if (!deleteId) return;
    deleteClient.mutate({ id: deleteId }, {
      onSuccess: () => { toast.success('Cliente eliminado'); setDeleteId(null); refetch(); },
      onError: () => toast.error('Error al eliminar'),
    });
  };

  if (isLoading) return <LoadingTab />;

  return (
    <>
      <div className="flex justify-end mb-4">
        <Button onClick={openCreate} className="font-bold"><Plus className="mr-2 h-4 w-4" />Nuevo Cliente</Button>
      </div>
      <Card className="border-border/50 shadow-sm">
        <Table>
          <TableHeader className="bg-muted/50">
            <TableRow>
              <TableHead>ID</TableHead>
              <TableHead>Cliente</TableHead>
              <TableHead>Obra Principal</TableHead>
              <TableHead>Sectores</TableHead>
              <TableHead className="text-right">Acciones</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {clients?.map(c => (
              <TableRow key={c.id}>
                <TableCell className="font-mono text-muted-foreground">{c.id}</TableCell>
                <TableCell className="font-bold">{c.cliente}</TableCell>
                <TableCell>{c.obra}</TableCell>
                <TableCell>
                  <div className="flex gap-1 flex-wrap">
                    {c.sector_construccion && <Badge variant="outline" className="text-[10px] h-4">Construcción</Badge>}
                    {c.sector_automotriz && <Badge variant="outline" className="text-[10px] h-4">Auto</Badge>}
                    {c.sector_alimenticio && <Badge variant="outline" className="text-[10px] h-4">Alimentos</Badge>}
                  </div>
                </TableCell>
                <TableCell className="text-right">
                  <Button variant="ghost" size="icon" onClick={() => openEdit(c)}><Pencil className="h-4 w-4" /></Button>
                  <Button variant="ghost" size="icon" className="text-destructive hover:text-destructive" onClick={() => setDeleteId(c.id)}><Trash2 className="h-4 w-4" /></Button>
                </TableCell>
              </TableRow>
            ))}
            {!clients?.length && <EmptyRow colSpan={5} label="clientes" />}
          </TableBody>
        </Table>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editItem ? 'Editar Cliente' : 'Nuevo Cliente'}</DialogTitle>
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField control={form.control} name="cliente" render={({ field }) => (
                <FormItem><FormLabel>Empresa / Cliente *</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
              )} />
              <FormField control={form.control} name="obra" render={({ field }) => (
                <FormItem><FormLabel>Obra / Proyecto *</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
              )} />
              <FormField control={form.control} name="comentarios_operaciones" render={({ field }) => (
                <FormItem><FormLabel>Comentarios de Operaciones</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
              )} />
              <FormField control={form.control} name="calificacion" render={({ field }) => (
                <FormItem>
                  <FormLabel>Calificación</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value ?? ''}>
                    <FormControl><SelectTrigger><SelectValue placeholder="Seleccionar..." /></SelectTrigger></FormControl>
                    <SelectContent>
                      <SelectItem value="bueno">Bueno</SelectItem>
                      <SelectItem value="regular">Regular</SelectItem>
                      <SelectItem value="malo">Malo</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )} />
              <div className="flex gap-4 flex-wrap">
                {([['sector_alimenticio', 'Alimenticio'], ['sector_automotriz', 'Automotriz'], ['sector_construccion', 'Construcción']] as const).map(([name, label]) => (
                  <FormField key={name} control={form.control} name={name} render={({ field }) => (
                    <FormItem className="flex items-center gap-2">
                      <FormControl><input type="checkbox" checked={!!field.value} onChange={e => field.onChange(e.target.checked)} className="accent-primary" /></FormControl>
                      <FormLabel className="!mt-0">{label}</FormLabel>
                    </FormItem>
                  )} />
                ))}
              </div>
              <div className="flex justify-end gap-3">
                <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
                <Button type="submit" disabled={createClient.isPending || updateClient.isPending}>
                  {(createClient.isPending || updateClient.isPending) && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  {editItem ? 'Guardar' : 'Crear'}
                </Button>
              </div>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      <DeleteConfirm
        open={!!deleteId}
        onOpenChange={v => !v && setDeleteId(null)}
        label="cliente"
        onConfirm={confirmDelete}
        isPending={deleteClient.isPending}
      />
    </>
  );
}

// ─── VEHICLES TAB ─────────────────────────────────────────────────────────────

function VehiclesTab() {
  const { data: vehicles, isLoading, refetch } = useListVehicles();
  const createVehicle = useCreateVehicle();
  const updateVehicle = useUpdateVehicle();
  const deleteVehicle = useDeleteVehicle();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editItem, setEditItem] = useState<Vehicle | null>(null);
  const [deleteId, setDeleteId] = useState<number | null>(null);

  const form = useForm<z.infer<typeof vehicleSchema>>({ resolver: zodResolver(vehicleSchema) });

  const openCreate = () => {
    setEditItem(null);
    form.reset({ placa: '', capacidad: 0, tipo_vehiculo: '', ubicacion: '', conductor_asignado: '', disponible: true });
    setDialogOpen(true);
  };

  const openEdit = (item: NonNullable<typeof editItem>) => {
    setEditItem(item);
    form.reset({
      placa: item.placa,
      capacidad: item.capacidad,
      tipo_vehiculo: item.tipo_vehiculo,
      ubicacion: item.ubicacion ?? '',
      conductor_asignado: item.conductor_asignado ?? '',
      disponible: item.disponible,
    });
    setDialogOpen(true);
  };

  const onSubmit = (values: z.infer<typeof vehicleSchema>) => {
    if (editItem) {
      updateVehicle.mutate({ id: editItem.id, data: values }, {
        onSuccess: () => { toast.success('Vehículo actualizado'); setDialogOpen(false); refetch(); },
        onError: () => toast.error('Error al actualizar'),
      });
    } else {
      createVehicle.mutate({ data: values }, {
        onSuccess: () => { toast.success('Vehículo creado'); setDialogOpen(false); refetch(); },
        onError: () => toast.error('Error al crear'),
      });
    }
  };

  const confirmDelete = () => {
    if (!deleteId) return;
    deleteVehicle.mutate({ id: deleteId }, {
      onSuccess: () => { toast.success('Vehículo eliminado'); setDeleteId(null); refetch(); },
      onError: () => toast.error('Error al eliminar'),
    });
  };

  if (isLoading) return <LoadingTab />;

  return (
    <>
      <div className="flex justify-end mb-4">
        <Button onClick={openCreate} className="font-bold"><Plus className="mr-2 h-4 w-4" />Nuevo Vehículo</Button>
      </div>
      <Card className="border-border/50 shadow-sm">
        <Table>
          <TableHeader className="bg-muted/50">
            <TableRow>
              <TableHead>Placa</TableHead>
              <TableHead>Tipo</TableHead>
              <TableHead>Capacidad (Ton)</TableHead>
              <TableHead>Conductor Asignado</TableHead>
              <TableHead>Estado</TableHead>
              <TableHead className="text-right">Acciones</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {vehicles?.map(v => (
              <TableRow key={v.id}>
                <TableCell className="font-bold font-mono">{v.placa}</TableCell>
                <TableCell>{v.tipo_vehiculo}</TableCell>
                <TableCell>{v.capacidad}</TableCell>
                <TableCell>{v.conductor_asignado ?? '—'}</TableCell>
                <TableCell>
                  {v.disponible !== false
                    ? <Badge className="bg-green-100 text-green-800 hover:bg-green-100 border-0">Disponible</Badge>
                    : <Badge variant="destructive">Ocupado</Badge>}
                </TableCell>
                <TableCell className="text-right">
                  <Button variant="ghost" size="icon" onClick={() => openEdit(v)}><Pencil className="h-4 w-4" /></Button>
                  <Button variant="ghost" size="icon" className="text-destructive hover:text-destructive" onClick={() => setDeleteId(v.id)}><Trash2 className="h-4 w-4" /></Button>
                </TableCell>
              </TableRow>
            ))}
            {!vehicles?.length && <EmptyRow colSpan={6} label="vehículos" />}
          </TableBody>
        </Table>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editItem ? 'Editar Vehículo' : 'Nuevo Vehículo'}</DialogTitle>
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <FormField control={form.control} name="placa" render={({ field }) => (
                  <FormItem><FormLabel>Placa *</FormLabel><FormControl><Input placeholder="ABC-123" {...field} /></FormControl><FormMessage /></FormItem>
                )} />
                <FormField control={form.control} name="capacidad" render={({ field }) => (
                  <FormItem><FormLabel>Capacidad (Ton) *</FormLabel><FormControl><Input type="number" step="0.1" {...field} /></FormControl><FormMessage /></FormItem>
                )} />
              </div>
              <FormField control={form.control} name="tipo_vehiculo" render={({ field }) => (
                <FormItem><FormLabel>Tipo de Vehículo *</FormLabel><FormControl><Input placeholder="Ej: Torton, Rabon, Camioneta" {...field} /></FormControl><FormMessage /></FormItem>
              )} />
              <FormField control={form.control} name="ubicacion" render={({ field }) => (
                <FormItem><FormLabel>Ubicación</FormLabel><FormControl><Input placeholder="Ej: Sucursal Norte" {...field} /></FormControl><FormMessage /></FormItem>
              )} />
              <FormField control={form.control} name="conductor_asignado" render={({ field }) => (
                <FormItem><FormLabel>Conductor Asignado</FormLabel><FormControl><Input placeholder="Nombre del conductor" {...field} /></FormControl><FormMessage /></FormItem>
              )} />
              {editItem && (
                <FormField control={form.control} name="disponible" render={({ field }) => (
                  <FormItem className="flex items-center gap-2">
                    <FormControl><input type="checkbox" checked={!!field.value} onChange={e => field.onChange(e.target.checked)} className="accent-primary" /></FormControl>
                    <FormLabel className="!mt-0">Disponible</FormLabel>
                  </FormItem>
                )} />
              )}
              <div className="flex justify-end gap-3">
                <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
                <Button type="submit" disabled={createVehicle.isPending || updateVehicle.isPending}>
                  {(createVehicle.isPending || updateVehicle.isPending) && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  {editItem ? 'Guardar' : 'Crear'}
                </Button>
              </div>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      <DeleteConfirm
        open={!!deleteId}
        onOpenChange={v => !v && setDeleteId(null)}
        label="vehículo"
        onConfirm={confirmDelete}
        isPending={deleteVehicle.isPending}
      />
    </>
  );
}

// ─── EQUIPMENT TAB ────────────────────────────────────────────────────────────

function EquipmentTab() {
  const { data: equipment, isLoading, refetch } = useListEquipment();
  const createEquipment = useCreateEquipment();
  const updateEquipment = useUpdateEquipment();
  const deleteEquipment = useDeleteEquipment();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editItem, setEditItem] = useState<Equipment | null>(null);
  const [deleteId, setDeleteId] = useState<number | null>(null);

  const form = useForm<z.infer<typeof equipmentSchema>>({ resolver: zodResolver(equipmentSchema) });

  const openCreate = () => {
    setEditItem(null);
    form.reset({ modelo: '', serie: '', tipo: '', disponible: true });
    setDialogOpen(true);
  };

  const openEdit = (item: NonNullable<typeof editItem>) => {
    setEditItem(item);
    form.reset({ modelo: item.modelo, serie: item.serie, tipo: item.tipo ?? '', disponible: item.disponible });
    setDialogOpen(true);
  };

  const onSubmit = (values: z.infer<typeof equipmentSchema>) => {
    if (editItem) {
      updateEquipment.mutate({ id: editItem.id, data: values }, {
        onSuccess: () => { toast.success('Equipo actualizado'); setDialogOpen(false); refetch(); },
        onError: () => toast.error('Error al actualizar'),
      });
    } else {
      createEquipment.mutate({ data: values }, {
        onSuccess: () => { toast.success('Equipo creado'); setDialogOpen(false); refetch(); },
        onError: () => toast.error('Error al crear'),
      });
    }
  };

  const confirmDelete = () => {
    if (!deleteId) return;
    deleteEquipment.mutate({ id: deleteId }, {
      onSuccess: () => { toast.success('Equipo eliminado'); setDeleteId(null); refetch(); },
      onError: () => toast.error('Error al eliminar'),
    });
  };

  if (isLoading) return <LoadingTab />;

  return (
    <>
      <div className="flex justify-end mb-4">
        <Button onClick={openCreate} className="font-bold"><Plus className="mr-2 h-4 w-4" />Nuevo Equipo</Button>
      </div>
      <Card className="border-border/50 shadow-sm">
        <Table>
          <TableHeader className="bg-muted/50">
            <TableRow>
              <TableHead>Modelo</TableHead>
              <TableHead>Serie</TableHead>
              <TableHead>Tipo</TableHead>
              <TableHead>Estado</TableHead>
              <TableHead className="text-right">Acciones</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {equipment?.map(e => (
              <TableRow key={e.id}>
                <TableCell className="font-bold text-primary">{e.modelo}</TableCell>
                <TableCell className="font-mono">{e.serie}</TableCell>
                <TableCell>{e.tipo ?? '—'}</TableCell>
                <TableCell>
                  {e.disponible !== false
                    ? <Badge className="bg-green-100 text-green-800 hover:bg-green-100 border-0">Disponible</Badge>
                    : <Badge variant="secondary">En Renta</Badge>}
                </TableCell>
                <TableCell className="text-right">
                  <Button variant="ghost" size="icon" onClick={() => openEdit(e)}><Pencil className="h-4 w-4" /></Button>
                  <Button variant="ghost" size="icon" className="text-destructive hover:text-destructive" onClick={() => setDeleteId(e.id)}><Trash2 className="h-4 w-4" /></Button>
                </TableCell>
              </TableRow>
            ))}
            {!equipment?.length && <EmptyRow colSpan={5} label="equipos" />}
          </TableBody>
        </Table>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editItem ? 'Editar Equipo' : 'Nuevo Equipo'}</DialogTitle>
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField control={form.control} name="modelo" render={({ field }) => (
                <FormItem><FormLabel>Modelo *</FormLabel><FormControl><Input placeholder="Ej: Plataforma Tijera 26 Pies" {...field} /></FormControl><FormMessage /></FormItem>
              )} />
              <FormField control={form.control} name="serie" render={({ field }) => (
                <FormItem><FormLabel>Número de Serie *</FormLabel><FormControl><Input placeholder="Serie única del equipo" {...field} /></FormControl><FormMessage /></FormItem>
              )} />
              <FormField control={form.control} name="tipo" render={({ field }) => (
                <FormItem>
                  <FormLabel>Tipo de Equipo</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value ?? ''}>
                    <FormControl><SelectTrigger><SelectValue placeholder="Seleccionar tipo..." /></SelectTrigger></FormControl>
                    <SelectContent>
                      <SelectItem value="MONTACARGAS">Montacargas</SelectItem>
                      <SelectItem value="PLATAFORMA">Plataforma de Elevación</SelectItem>
                      <SelectItem value="TELEHANDLER">Manipulador Telescópico</SelectItem>
                      <SelectItem value="GRUA">Grúa / Torre de Iluminación</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )} />
              {editItem && (
                <FormField control={form.control} name="disponible" render={({ field }) => (
                  <FormItem className="flex items-center gap-2">
                    <FormControl><input type="checkbox" checked={!!field.value} onChange={e => field.onChange(e.target.checked)} className="accent-primary" /></FormControl>
                    <FormLabel className="!mt-0">Disponible para renta</FormLabel>
                  </FormItem>
                )} />
              )}
              <div className="flex justify-end gap-3">
                <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
                <Button type="submit" disabled={createEquipment.isPending || updateEquipment.isPending}>
                  {(createEquipment.isPending || updateEquipment.isPending) && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  {editItem ? 'Guardar' : 'Crear'}
                </Button>
              </div>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      <DeleteConfirm
        open={!!deleteId}
        onOpenChange={v => !v && setDeleteId(null)}
        label="equipo"
        onConfirm={confirmDelete}
        isPending={deleteEquipment.isPending}
      />
    </>
  );
}

// ─── DRIVERS TAB ──────────────────────────────────────────────────────────────

function DriversTab() {
  const { data: drivers, isLoading, refetch } = useListDrivers();
  const createDriver = useCreateDriver();
  const updateDriver = useUpdateDriver();
  const deleteDriver = useDeleteDriver();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editItem, setEditItem] = useState<Driver | null>(null);
  const [deleteId, setDeleteId] = useState<number | null>(null);

  const form = useForm<z.infer<typeof driverSchema>>({ resolver: zodResolver(driverSchema) });

  const openCreate = () => {
    setEditItem(null);
    form.reset({ nombre: '', tipo: 'PROPIO', activo: true });
    setDialogOpen(true);
  };

  const openEdit = (item: NonNullable<typeof editItem>) => {
    setEditItem(item);
    form.reset({ nombre: item.nombre, tipo: item.tipo, activo: item.activo });
    setDialogOpen(true);
  };

  const onSubmit = (values: z.infer<typeof driverSchema>) => {
    if (editItem) {
      updateDriver.mutate({ id: editItem.id, data: values }, {
        onSuccess: () => { toast.success('Conductor actualizado'); setDialogOpen(false); refetch(); },
        onError: () => toast.error('Error al actualizar'),
      });
    } else {
      createDriver.mutate({ data: values }, {
        onSuccess: () => { toast.success('Conductor creado'); setDialogOpen(false); refetch(); },
        onError: () => toast.error('Error al crear'),
      });
    }
  };

  const confirmDelete = () => {
    if (!deleteId) return;
    deleteDriver.mutate({ id: deleteId }, {
      onSuccess: () => { toast.success('Conductor eliminado'); setDeleteId(null); refetch(); },
      onError: () => toast.error('Error al eliminar'),
    });
  };

  if (isLoading) return <LoadingTab />;

  return (
    <>
      <div className="flex justify-end mb-4">
        <Button onClick={openCreate} className="font-bold"><Plus className="mr-2 h-4 w-4" />Nuevo Conductor</Button>
      </div>
      <Card className="border-border/50 shadow-sm">
        <Table>
          <TableHeader className="bg-muted/50">
            <TableRow>
              <TableHead>Nombre</TableHead>
              <TableHead>Tipo</TableHead>
              <TableHead>Servicios Mes</TableHead>
              <TableHead>Estado</TableHead>
              <TableHead className="text-right">Acciones</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {drivers?.map(d => (
              <TableRow key={d.id}>
                <TableCell className="font-bold">{d.nombre}</TableCell>
                <TableCell>
                  <Badge variant={d.tipo === 'PROPIO' ? 'default' : 'outline'}>{d.tipo}</Badge>
                </TableCell>
                <TableCell>{d.servicios_mes || 0}</TableCell>
                <TableCell>
                  {d.activo !== false
                    ? <Badge className="bg-green-100 text-green-800 hover:bg-green-100 border-0">Activo</Badge>
                    : <Badge variant="destructive">Inactivo</Badge>}
                </TableCell>
                <TableCell className="text-right">
                  <Button variant="ghost" size="icon" onClick={() => openEdit(d)}><Pencil className="h-4 w-4" /></Button>
                  <Button variant="ghost" size="icon" className="text-destructive hover:text-destructive" onClick={() => setDeleteId(d.id)}><Trash2 className="h-4 w-4" /></Button>
                </TableCell>
              </TableRow>
            ))}
            {!drivers?.length && <EmptyRow colSpan={5} label="conductores" />}
          </TableBody>
        </Table>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editItem ? 'Editar Conductor' : 'Nuevo Conductor'}</DialogTitle>
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField control={form.control} name="nombre" render={({ field }) => (
                <FormItem><FormLabel>Nombre Completo *</FormLabel><FormControl><Input placeholder="Nombre del conductor / proveedor" {...field} /></FormControl><FormMessage /></FormItem>
              )} />
              <FormField control={form.control} name="tipo" render={({ field }) => (
                <FormItem>
                  <FormLabel>Tipo *</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                    <SelectContent>
                      <SelectItem value="PROPIO">Propio (empleado)</SelectItem>
                      <SelectItem value="EXTERNO">Externo (proveedor)</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )} />
              {editItem && (
                <FormField control={form.control} name="activo" render={({ field }) => (
                  <FormItem className="flex items-center gap-2">
                    <FormControl><input type="checkbox" checked={!!field.value} onChange={e => field.onChange(e.target.checked)} className="accent-primary" /></FormControl>
                    <FormLabel className="!mt-0">Activo</FormLabel>
                  </FormItem>
                )} />
              )}
              <div className="flex justify-end gap-3">
                <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
                <Button type="submit" disabled={createDriver.isPending || updateDriver.isPending}>
                  {(createDriver.isPending || updateDriver.isPending) && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  {editItem ? 'Guardar' : 'Crear'}
                </Button>
              </div>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      <DeleteConfirm
        open={!!deleteId}
        onOpenChange={v => !v && setDeleteId(null)}
        label="conductor"
        onConfirm={confirmDelete}
        isPending={deleteDriver.isPending}
      />
    </>
  );
}

// ─── BRANCHES TAB ─────────────────────────────────────────────────────────────

function BranchesTab() {
  const { data: branches, isLoading, refetch } = useListBranches();
  const createBranch = useCreateBranch();

  const [dialogOpen, setDialogOpen] = useState(false);

  const form = useForm<z.infer<typeof branchSchema>>({ resolver: zodResolver(branchSchema) });

  const onSubmit = (values: z.infer<typeof branchSchema>) => {
    createBranch.mutate({ data: values }, {
      onSuccess: () => { toast.success('Sucursal creada'); form.reset(); setDialogOpen(false); refetch(); },
      onError: () => toast.error('Error al crear sucursal'),
    });
  };

  if (isLoading) return <LoadingTab />;

  return (
    <>
      <div className="flex justify-end mb-4">
        <Button onClick={() => setDialogOpen(true)} className="font-bold"><Plus className="mr-2 h-4 w-4" />Nueva Sucursal</Button>
      </div>
      <Card className="border-border/50 shadow-sm">
        <Table>
          <TableHeader className="bg-muted/50">
            <TableRow>
              <TableHead>Nombre</TableHead>
              <TableHead>Ciudad</TableHead>
              <TableHead>Latitud</TableHead>
              <TableHead>Longitud</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {branches?.map(b => (
              <TableRow key={b.id}>
                <TableCell className="font-bold">{b.nombre}</TableCell>
                <TableCell>{b.ciudad ?? '—'}</TableCell>
                <TableCell className="font-mono text-sm">{b.latitud ?? '—'}</TableCell>
                <TableCell className="font-mono text-sm">{b.longitud ?? '—'}</TableCell>
              </TableRow>
            ))}
            {!branches?.length && <EmptyRow colSpan={4} label="sucursales" />}
          </TableBody>
        </Table>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Nueva Sucursal</DialogTitle></DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField control={form.control} name="nombre" render={({ field }) => (
                <FormItem><FormLabel>Nombre *</FormLabel><FormControl><Input placeholder="Ej: Sucursal Norte" {...field} /></FormControl><FormMessage /></FormItem>
              )} />
              <FormField control={form.control} name="ciudad" render={({ field }) => (
                <FormItem><FormLabel>Ciudad</FormLabel><FormControl><Input placeholder="Ej: Monterrey, NL" {...field} /></FormControl><FormMessage /></FormItem>
              )} />
              <div className="grid grid-cols-2 gap-4">
                <FormField control={form.control} name="latitud" render={({ field }) => (
                  <FormItem><FormLabel>Latitud</FormLabel><FormControl><Input type="number" step="0.000001" placeholder="19.432608" {...field} /></FormControl><FormMessage /></FormItem>
                )} />
                <FormField control={form.control} name="longitud" render={({ field }) => (
                  <FormItem><FormLabel>Longitud</FormLabel><FormControl><Input type="number" step="0.000001" placeholder="-99.133209" {...field} /></FormControl><FormMessage /></FormItem>
                )} />
              </div>
              <div className="flex justify-end gap-3">
                <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
                <Button type="submit" disabled={createBranch.isPending}>
                  {createBranch.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Crear
                </Button>
              </div>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </>
  );
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function LoadingTab() {
  return (
    <div className="flex h-40 items-center justify-center">
      <Loader2 className="h-6 w-6 animate-spin text-primary" />
    </div>
  );
}

function EmptyRow({ colSpan, label }: { colSpan: number; label: string }) {
  return (
    <TableRow>
      <TableCell colSpan={colSpan} className="text-center py-10 text-muted-foreground">
        No hay {label} registrados aún.
      </TableCell>
    </TableRow>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function Catalogs() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-black tracking-tight">Catálogos</h1>
        <p className="text-muted-foreground">Administración de datos maestros del sistema.</p>
      </div>

      <Tabs defaultValue="clients" className="w-full">
        <TabsList className="w-full justify-start border-b rounded-none h-auto p-0 bg-transparent gap-4">
          {([
            ['clients', Users, 'Clientes'],
            ['vehicles', Truck, 'Vehículos'],
            ['equipment', Wrench, 'Equipos'],
            ['drivers', HardHat, 'Conductores'],
            ['branches', Building2, 'Sucursales'],
          ] as const).map(([value, Icon, label]) => (
            <TabsTrigger
              key={value}
              value={value}
              className="data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none px-4 py-3"
            >
              <Icon className="h-4 w-4 mr-2" /> {label}
            </TabsTrigger>
          ))}
        </TabsList>

        <div className="mt-6">
          <TabsContent value="clients"><ClientsTab /></TabsContent>
          <TabsContent value="vehicles"><VehiclesTab /></TabsContent>
          <TabsContent value="equipment"><EquipmentTab /></TabsContent>
          <TabsContent value="drivers"><DriversTab /></TabsContent>
          <TabsContent value="branches"><BranchesTab /></TabsContent>
        </div>
      </Tabs>
    </div>
  );
}
