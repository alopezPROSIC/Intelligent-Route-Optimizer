import { useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { 
  useListClients, 
  useListVehicles, 
  useListEquipment, 
  useListDrivers 
} from '@workspace/api-client-react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Loader2, Users, Truck, Wrench, HardHat } from 'lucide-react';

export default function Catalogs() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-black tracking-tight">Catálogos</h1>
        <p className="text-muted-foreground">Administración de datos maestros del sistema.</p>
      </div>

      <Tabs defaultValue="clients" className="w-full">
        <TabsList className="w-full justify-start border-b rounded-none h-auto p-0 bg-transparent gap-4">
          <TabsTrigger value="clients" className="data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none px-4 py-3">
            <Users className="h-4 w-4 mr-2" /> Clientes
          </TabsTrigger>
          <TabsTrigger value="vehicles" className="data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none px-4 py-3">
            <Truck className="h-4 w-4 mr-2" /> Vehículos
          </TabsTrigger>
          <TabsTrigger value="equipment" className="data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none px-4 py-3">
            <Wrench className="h-4 w-4 mr-2" /> Equipos
          </TabsTrigger>
          <TabsTrigger value="drivers" className="data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none px-4 py-3">
            <HardHat className="h-4 w-4 mr-2" /> Conductores
          </TabsTrigger>
        </TabsList>

        <div className="mt-6">
          <TabsContent value="clients"><ClientsTab /></TabsContent>
          <TabsContent value="vehicles"><VehiclesTab /></TabsContent>
          <TabsContent value="equipment"><EquipmentTab /></TabsContent>
          <TabsContent value="drivers"><DriversTab /></TabsContent>
        </div>
      </Tabs>
    </div>
  );
}

function ClientsTab() {
  const { data: clients, isLoading } = useListClients();
  
  if (isLoading) return <LoadingTab />;

  return (
    <Card className="border-border/50 shadow-sm">
      <Table>
        <TableHeader className="bg-muted/50">
          <TableRow>
            <TableHead>ID</TableHead>
            <TableHead>Cliente</TableHead>
            <TableHead>Obra Principal</TableHead>
            <TableHead>Sectores</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {clients?.map(c => (
            <TableRow key={c.id}>
              <TableCell className="font-mono text-muted-foreground">{c.id}</TableCell>
              <TableCell className="font-bold">{c.cliente}</TableCell>
              <TableCell>{c.obra}</TableCell>
              <TableCell>
                <div className="flex gap-1">
                  {c.sector_construccion && <Badge variant="outline" className="text-[10px] h-4">Construcción</Badge>}
                  {c.sector_automotriz && <Badge variant="outline" className="text-[10px] h-4">Auto</Badge>}
                  {c.sector_alimenticio && <Badge variant="outline" className="text-[10px] h-4">Alimentos</Badge>}
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </Card>
  );
}

function VehiclesTab() {
  const { data: vehicles, isLoading } = useListVehicles();
  
  if (isLoading) return <LoadingTab />;

  return (
    <Card className="border-border/50 shadow-sm">
      <Table>
        <TableHeader className="bg-muted/50">
          <TableRow>
            <TableHead>Placa</TableHead>
            <TableHead>Tipo</TableHead>
            <TableHead>Capacidad (Ton)</TableHead>
            <TableHead>Estado</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {vehicles?.map(v => (
            <TableRow key={v.id}>
              <TableCell className="font-bold font-mono">{v.placa}</TableCell>
              <TableCell>{v.tipo_vehiculo}</TableCell>
              <TableCell>{v.capacidad}</TableCell>
              <TableCell>
                {v.disponible !== false 
                  ? <Badge className="bg-green-100 text-green-800 hover:bg-green-100 border-0">Disponible</Badge>
                  : <Badge variant="destructive">Ocupado</Badge>}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </Card>
  );
}

function EquipmentTab() {
  const { data: equipment, isLoading } = useListEquipment();
  
  if (isLoading) return <LoadingTab />;

  return (
    <Card className="border-border/50 shadow-sm">
      <Table>
        <TableHeader className="bg-muted/50">
          <TableRow>
            <TableHead>Modelo</TableHead>
            <TableHead>Serie</TableHead>
            <TableHead>Tipo</TableHead>
            <TableHead>Estado</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {equipment?.map(e => (
            <TableRow key={e.id}>
              <TableCell className="font-bold text-primary">{e.modelo}</TableCell>
              <TableCell className="font-mono">{e.serie}</TableCell>
              <TableCell>{e.tipo}</TableCell>
              <TableCell>
                {e.disponible !== false 
                  ? <Badge className="bg-green-100 text-green-800 hover:bg-green-100 border-0">Disponible</Badge>
                  : <Badge variant="secondary">En Renta</Badge>}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </Card>
  );
}

function DriversTab() {
  const { data: drivers, isLoading } = useListDrivers();
  
  if (isLoading) return <LoadingTab />;

  return (
    <Card className="border-border/50 shadow-sm">
      <Table>
        <TableHeader className="bg-muted/50">
          <TableRow>
            <TableHead>Nombre</TableHead>
            <TableHead>Tipo</TableHead>
            <TableHead>Servicios Mes</TableHead>
            <TableHead>Estado</TableHead>
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
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </Card>
  );
}

function LoadingTab() {
  return (
    <div className="flex h-40 items-center justify-center">
      <Loader2 className="h-6 w-6 animate-spin text-primary" />
    </div>
  );
}
