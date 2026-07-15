import { useState, useMemo } from 'react';
import { useListServices, ServiceEstatus } from '@workspace/api-client-react';
import { Link } from 'wouter';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus, Search, Truck, Loader as Loader2, ArrowRight, Clock } from 'lucide-react';
import { format } from 'date-fns';
import { ServiceFormDialog } from '@/components/service-form-dialog';

export default function Services() {
  const [estatusFilter, setEstatusFilter] = useState<string>('ALL');
  const [search, setSearch] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);

  const queryParams = estatusFilter !== 'ALL'
    ? { estatus: estatusFilter as typeof ServiceEstatus[keyof typeof ServiceEstatus] }
    : undefined;

  const { data: services, isLoading, refetch } = useListServices(queryParams);

  const filtered = useMemo(() => {
    if (!search.trim()) return services ?? [];
    const q = search.toLowerCase();
    return (services ?? []).filter(
      s =>
        s.cliente?.toLowerCase().includes(q) ||
        s.obra?.toLowerCase().includes(q) ||
        s.modelo?.toLowerCase().includes(q) ||
        s.remision?.toLowerCase().includes(q) ||
        String(s.id).includes(q),
    );
  }, [services, search]);

  const getStatusVariant = (status: string) => {
    switch (status) {
      case 'PENDIENTE': return 'outline';
      case 'PROGRAMADO': return 'secondary';
      case 'EN_TRANSITO': return 'default';
      case 'ENTREGADO':
      case 'TERMINADO': return 'outline';
      case 'CANCELADO': return 'destructive';
      default: return 'outline';
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'ENTREGADO':
      case 'TERMINADO': return 'bg-green-100 text-green-800 hover:bg-green-100 border-green-200';
      case 'EN_TRANSITO': return 'bg-blue-100 text-blue-800 hover:bg-blue-100 border-blue-200';
      default: return '';
    }
  };

  const opLabel = (op: string) => {
    switch (op) {
      case 'E': return 'ENTREGA';
      case 'R': return 'RETIRO';
      case 'CF': return 'CAMBIO';
      case 'RU': return 'REUBICACIÓN';
      default: return op;
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-black tracking-tight">Servicios Logísticos</h1>
          <p className="text-muted-foreground">Gestión de entregas, retiros y cambios físicos.</p>
        </div>
        <Button className="font-bold shadow-md" onClick={() => setDialogOpen(true)}>
          <Plus className="mr-2 h-4 w-4" /> Nuevo Servicio
        </Button>
      </div>

      <Card className="border-border/50 shadow-sm">
        <CardContent className="p-4 flex flex-col sm:flex-row gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por cliente, remisión o equipo..."
              className="pl-9 bg-background"
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>
          <Select value={estatusFilter} onValueChange={setEstatusFilter}>
            <SelectTrigger className="w-full sm:w-[200px] bg-background">
              <SelectValue placeholder="Filtrar por estatus" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">Todos los estatus</SelectItem>
              {Object.values(ServiceEstatus).map(status => (
                <SelectItem key={status} value={status}>{status}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      {isLoading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : (
        <Card className="overflow-hidden border-border/50 shadow-sm">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader className="bg-muted/50">
                <TableRow>
                  <TableHead className="w-[100px]">ID / Op</TableHead>
                  <TableHead>Cliente / Obra</TableHead>
                  <TableHead>Equipo</TableHead>
                  <TableHead>Fecha/Hora Prog.</TableHead>
                  <TableHead>Estatus</TableHead>
                  <TableHead className="text-right">Acción</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map(service => (
                  <TableRow key={service.id} className="hover:bg-muted/30 transition-colors">
                    <TableCell>
                      <div className="font-bold">#{service.id}</div>
                      <Badge variant="outline" className="mt-1 font-bold text-[10px] px-1 py-0 h-4">
                        {opLabel(service.operacion)}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="font-bold truncate max-w-[200px]" title={service.cliente ?? ''}>
                        {service.cliente}
                      </div>
                      <div className="text-xs text-muted-foreground truncate max-w-[200px]">{service.obra}</div>
                    </TableCell>
                    <TableCell>
                      <div className="font-medium text-primary">{service.modelo}</div>
                      <div className="text-xs text-muted-foreground">Serie: {service.serie || 'N/A'}</div>
                    </TableCell>
                    <TableCell>
                      <div className="font-medium">
                        {service.fecha_programacion
                          ? format(new Date(service.fecha_programacion), 'dd/MM/yyyy')
                          : 'Sin fecha'}
                      </div>
                      <div className="text-xs text-muted-foreground flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {service.hora_programada || service.horario || 'Sin horario'}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={getStatusVariant(service.estatus)}
                        className={getStatusColor(service.estatus)}
                      >
                        {service.estatus}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="ghost"
                        size="sm"
                        asChild
                        className="hover:bg-primary/10 hover:text-primary"
                      >
                        <Link href={`/services/${service.id}`}>
                          Ver detalle <ArrowRight className="ml-2 h-4 w-4" />
                        </Link>
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}

                {filtered.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-12 text-muted-foreground">
                      <Truck className="h-8 w-8 mx-auto mb-3 opacity-20" />
                      <p>No se encontraron servicios que coincidan con los filtros.</p>
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </Card>
      )}

      <ServiceFormDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        service={null}
        onSuccess={refetch}
      />
    </div>
  );
}
