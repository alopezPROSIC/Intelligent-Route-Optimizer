import { useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card } from '@/components/ui/card';
import {
  useListClients, useListVehicles, useListDrivers
} from '@workspace/api-client-react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, Users, Truck, Wrench, HardHat, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';

const API_BASE = import.meta.env.BASE_URL.replace(/\/$/, '');

// ─── Equipment status config ──────────────────────────────────────────────────
const STATUS_CFG: Record<string, { label: string; class: string }> = {
  disponible:  { label: 'Disponible',   class: 'bg-green-100 text-green-800 border-green-200' },
  rentado:     { label: 'Rentado',      class: 'bg-blue-100 text-blue-800 border-blue-200' },
  en_servicio: { label: 'En Servicio',  class: 'bg-amber-100 text-amber-800 border-amber-200' },
  en_venta:    { label: 'En Venta',     class: 'bg-purple-100 text-purple-800 border-purple-200' },
};

function EquipStatusBadge({ status }: { status: string }) {
  const cfg = STATUS_CFG[status] ?? { label: status, class: 'bg-gray-100 text-gray-700' };
  return <Badge className={`${cfg.class} border text-[11px] font-semibold`}>{cfg.label}</Badge>;
}

export default function Catalogs() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-black tracking-tight">Catálogos</h1>
        <p className="text-muted-foreground">Administración de datos maestros del sistema.</p>
      </div>

      <Tabs defaultValue="equipment" className="w-full">
        <TabsList className="w-full justify-start border-b rounded-none h-auto p-0 bg-transparent gap-4">
          {[
            { value: 'equipment', icon: Wrench, label: 'Equipos' },
            { value: 'clients',   icon: Users,  label: 'Clientes' },
            { value: 'vehicles',  icon: Truck,  label: 'Vehículos' },
            { value: 'drivers',   icon: HardHat, label: 'Conductores' },
          ].map(({ value, icon: Icon, label }) => (
            <TabsTrigger key={value} value={value}
              className="data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none px-4 py-3">
              <Icon className="h-4 w-4 mr-2" /> {label}
            </TabsTrigger>
          ))}
        </TabsList>

        <div className="mt-6">
          <TabsContent value="equipment"><EquipmentTab /></TabsContent>
          <TabsContent value="clients"><ClientsTab /></TabsContent>
          <TabsContent value="vehicles"><VehiclesTab /></TabsContent>
          <TabsContent value="drivers"><DriversTab /></TabsContent>
        </div>
      </Tabs>
    </div>
  );
}

// ─── Equipment tab (with inline status change) ────────────────────────────────
interface EquipRow { id: number; id_equipo: string; modelo: string; serie: string; tipo: string | null; status: string; }

function EquipmentTab() {
  const [equipment, setEquipment] = useState<EquipRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState<number | null>(null);

  const fetchEquipment = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('prosic_token');
      const r = await fetch(`${API_BASE}/api/equipment`, { headers: token ? { Authorization: `Bearer ${token}` } : {} });
      if (r.ok) setEquipment(await r.json());
    } finally { setLoading(false); }
  };

  // Fetch on mount
  useState(() => { fetchEquipment(); });

  const updateStatus = async (id: number, status: string) => {
    setUpdating(id);
    try {
      const token = localStorage.getItem('prosic_token');
      const r = await fetch(`${API_BASE}/api/equipment/${id}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify({ status }),
      });
      if (r.ok) {
        const updated = await r.json();
        setEquipment(prev => prev.map(e => e.id === id ? { ...e, status: updated.status } : e));
        toast.success(`Estado actualizado: ${STATUS_CFG[status]?.label ?? status}`);
      } else {
        toast.error('Error al actualizar estado');
      }
    } catch { toast.error('Error de conexión'); }
    setUpdating(null);
  };

  if (loading) return <div className="flex items-center justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>;

  const counts = Object.fromEntries(Object.keys(STATUS_CFG).map(k => [k, equipment.filter(e => e.status === k).length]));

  return (
    <div className="space-y-4">
      {/* Summary chips */}
      <div className="flex flex-wrap gap-2">
        {Object.entries(STATUS_CFG).map(([key, cfg]) => (
          <div key={key} className={`flex items-center gap-1.5 px-3 py-1 rounded-full border text-xs font-semibold ${cfg.class}`}>
            <span>{cfg.label}</span>
            <span className="font-black">{counts[key] ?? 0}</span>
          </div>
        ))}
        <Button variant="ghost" size="sm" className="ml-auto h-7 text-xs" onClick={fetchEquipment}>
          <RefreshCw className="h-3 w-3 mr-1" /> Actualizar
        </Button>
      </div>

      <Card className="border-border/50 shadow-sm overflow-hidden">
        <Table>
          <TableHeader className="bg-muted/50">
            <TableRow>
              <TableHead className="font-bold">ID Equipo</TableHead>
              <TableHead className="font-bold">Modelo</TableHead>
              <TableHead className="font-bold">Serie</TableHead>
              <TableHead className="font-bold">Tipo</TableHead>
              <TableHead className="font-bold">Estado Actual</TableHead>
              <TableHead className="font-bold">Cambiar Estado</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {equipment.map(e => (
              <TableRow key={e.id} className="hover:bg-muted/20">
                <TableCell className="font-mono text-xs text-muted-foreground">{e.id_equipo}</TableCell>
                <TableCell className="font-semibold text-primary">{e.modelo}</TableCell>
                <TableCell className="font-mono text-xs">{e.serie}</TableCell>
                <TableCell className="text-sm">{e.tipo ?? '—'}</TableCell>
                <TableCell><EquipStatusBadge status={e.status} /></TableCell>
                <TableCell>
                  <div className="flex items-center gap-2">
                    <Select
                      value={e.status}
                      onValueChange={v => updateStatus(e.id, v)}
                      disabled={updating === e.id}
                    >
                      <SelectTrigger className="h-8 text-xs w-36 border-border/50">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {Object.entries(STATUS_CFG).map(([key, cfg]) => (
                          <SelectItem key={key} value={key} className="text-xs">{cfg.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {updating === e.id && <Loader2 className="h-3 w-3 animate-spin text-primary" />}
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}

// ─── Clients tab ──────────────────────────────────────────────────────────────
function ClientsTab() {
  const { data: clients, isLoading } = useListClients();
  if (isLoading) return <LoadingTab />;
  return (
    <Card className="border-border/50 shadow-sm">
      <Table>
        <TableHeader className="bg-muted/50">
          <TableRow>
            <TableHead>ID</TableHead><TableHead>Cliente</TableHead>
            <TableHead>Obra Principal</TableHead><TableHead>Sectores</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {clients?.map(c => (
            <TableRow key={c.id}>
              <TableCell className="font-mono text-muted-foreground text-xs">{c.id}</TableCell>
              <TableCell className="font-bold">{c.cliente}</TableCell>
              <TableCell className="text-sm">{c.obra}</TableCell>
              <TableCell>
                <div className="flex gap-1 flex-wrap">
                  {c.sector_construccion && <Badge variant="outline" className="text-[10px]">Construcción</Badge>}
                  {c.sector_automotriz && <Badge variant="outline" className="text-[10px]">Auto</Badge>}
                  {c.sector_alimenticio && <Badge variant="outline" className="text-[10px]">Alimentos</Badge>}
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </Card>
  );
}

// ─── Vehicles tab ─────────────────────────────────────────────────────────────
function VehiclesTab() {
  const { data: vehicles, isLoading } = useListVehicles();
  if (isLoading) return <LoadingTab />;
  return (
    <Card className="border-border/50 shadow-sm">
      <Table>
        <TableHeader className="bg-muted/50">
          <TableRow>
            <TableHead>Placa</TableHead><TableHead>Tipo</TableHead>
            <TableHead>Capacidad</TableHead><TableHead>Estado</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {vehicles?.map(v => (
            <TableRow key={v.id}>
              <TableCell className="font-bold font-mono">{v.placa}</TableCell>
              <TableCell>{v.tipo_vehiculo}</TableCell>
              <TableCell>{v.capacidad} ton</TableCell>
              <TableCell>
                {v.disponible !== false
                  ? <Badge className="bg-green-100 text-green-800 border-green-200 border">Disponible</Badge>
                  : <Badge variant="destructive">En Uso</Badge>}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </Card>
  );
}

// ─── Drivers tab ──────────────────────────────────────────────────────────────
function DriversTab() {
  const { data: drivers, isLoading } = useListDrivers();
  if (isLoading) return <LoadingTab />;
  return (
    <Card className="border-border/50 shadow-sm">
      <Table>
        <TableHeader className="bg-muted/50">
          <TableRow>
            <TableHead>Nombre</TableHead><TableHead>Tipo</TableHead>
            <TableHead>Servicios / Mes</TableHead><TableHead>Estado</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {drivers?.map(d => (
            <TableRow key={d.id}>
              <TableCell className="font-bold">{d.nombre}</TableCell>
              <TableCell>
                <Badge variant={d.tipo === 'PROPIO' ? 'default' : 'outline'}>{d.tipo}</Badge>
              </TableCell>
              <TableCell>{d.servicios_mes ?? 0}</TableCell>
              <TableCell>
                {d.activo !== false
                  ? <Badge className="bg-green-100 text-green-800 border-green-200 border">Activo</Badge>
                  : <Badge variant="secondary">Inactivo</Badge>}
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
    <div className="flex items-center justify-center py-16">
      <Loader2 className="h-6 w-6 animate-spin text-primary" />
    </div>
  );
}
