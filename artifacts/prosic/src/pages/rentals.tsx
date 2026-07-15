import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Search, Loader2, ShieldCheck, ShieldAlert, ShieldX, ClipboardList, RefreshCw } from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

const API_BASE = import.meta.env.BASE_URL.replace(/\/$/, '');

interface Rental {
  id: number;
  folio: string;
  nombre_contacto: string | null;
  nombre_empresa: string | null;
  modelo: string;
  dias_renta: number;
  monto_total: number;
  identity_score: number | null;
  requires_review: boolean;
  estatus: string;
  stripe_payment_status: string | null;
  created_at: string | null;
}

const ESTATUS_CONFIG: Record<string, { label: string; color: string }> = {
  pendiente:   { label: 'Pendiente',   color: 'bg-amber-100 text-amber-800 border-amber-300' },
  pagado:      { label: 'Pagado',      color: 'bg-blue-100 text-blue-800 border-blue-300' },
  en_renta:    { label: 'En Renta',    color: 'bg-primary/10 text-primary border-primary/30' },
  completado:  { label: 'Completado',  color: 'bg-green-100 text-green-800 border-green-300' },
  cancelado:   { label: 'Cancelado',   color: 'bg-red-100 text-red-800 border-red-300' },
};

function IdentityBadge({ score, requires_review }: { score: number | null; requires_review: boolean }) {
  if (score === null) return <span className="text-muted-foreground text-xs">—</span>;
  if (score < 40)  return <Badge variant="outline" className="gap-1 text-[10px] border-red-300 text-red-700 bg-red-50"><ShieldX className="h-2.5 w-2.5" />{score}</Badge>;
  if (requires_review) return <Badge variant="outline" className="gap-1 text-[10px] border-amber-300 text-amber-700 bg-amber-50"><ShieldAlert className="h-2.5 w-2.5" />{score} Rev.</Badge>;
  return <Badge variant="outline" className="gap-1 text-[10px] border-green-300 text-green-700 bg-green-50"><ShieldCheck className="h-2.5 w-2.5" />{score}</Badge>;
}

export default function Rentals() {
  const [rentals, setRentals] = useState<Rental[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [estatusFilter, setEstatusFilter] = useState('ALL');
  const [updatingId, setUpdatingId] = useState<number | null>(null);

  const fetchRentals = useCallback(async () => {
    setIsLoading(true);
    const token = localStorage.getItem('prosic_token');
    try {
      const r = await fetch(`${API_BASE}/api/rentals`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (!r.ok) throw new Error();
      const data = await r.json();
      setRentals(data);
    } catch {
      toast.error('Error al cargar rentas');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => { fetchRentals(); }, [fetchRentals]);

  const updateStatus = async (id: number, estatus: string) => {
    setUpdatingId(id);
    const token = localStorage.getItem('prosic_token');
    try {
      const r = await fetch(`${API_BASE}/api/rentals/${id}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify({ estatus }),
      });
      if (!r.ok) throw new Error();
      toast.success('Estatus actualizado');
      fetchRentals();
    } catch {
      toast.error('Error al actualizar estatus');
    } finally {
      setUpdatingId(null);
    }
  };

  const filtered = rentals.filter(r => {
    const q = search.toLowerCase();
    const matchSearch = !q || r.folio?.toLowerCase().includes(q)
      || r.nombre_contacto?.toLowerCase().includes(q)
      || r.nombre_empresa?.toLowerCase().includes(q)
      || r.modelo?.toLowerCase().includes(q);
    const matchEstatus = estatusFilter === 'ALL' || r.estatus === estatusFilter;
    return matchSearch && matchEstatus;
  });

  const reviewPending = rentals.filter(r => r.requires_review && r.estatus === 'pendiente').length;

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-3xl font-black tracking-tight">Rentas en Línea</h1>
          <p className="text-muted-foreground">Solicitudes de renta generadas desde el portal web.</p>
        </div>
        <div className="flex items-center gap-2">
          {reviewPending > 0 && (
            <Badge variant="outline" className="border-amber-300 text-amber-700 bg-amber-50 gap-1.5">
              <ShieldAlert className="h-3 w-3" />
              {reviewPending} requiere revisión
            </Badge>
          )}
          <Button variant="outline" size="sm" onClick={fetchRentals} disabled={isLoading}>
            <RefreshCw className={cn('h-4 w-4', isLoading && 'animate-spin')} />
          </Button>
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        {[
          { key: 'ALL',       label: 'Total',      color: 'text-foreground' },
          { key: 'pendiente', label: 'Pendiente',   color: 'text-amber-600' },
          { key: 'pagado',    label: 'Pagado',      color: 'text-blue-600' },
          { key: 'en_renta',  label: 'En Renta',    color: 'text-primary' },
          { key: 'completado',label: 'Completado',  color: 'text-green-600' },
        ].map(({ key, label, color }) => (
          <Card
            key={key}
            className={cn('border-border/50 shadow-sm cursor-pointer transition-all hover:shadow-md', estatusFilter === key && 'ring-2 ring-primary border-transparent')}
            onClick={() => setEstatusFilter(key)}
          >
            <CardContent className="p-4 text-center">
              <p className={cn('text-2xl font-black', color)}>
                {key === 'ALL' ? rentals.length : rentals.filter(r => r.estatus === key).length}
              </p>
              <p className="text-xs text-muted-foreground mt-0.5">{label}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Filters */}
      <Card className="border-border/50 shadow-sm">
        <CardContent className="p-4 flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por folio, cliente o equipo..."
              className="pl-9 bg-background"
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>
          <Select value={estatusFilter} onValueChange={setEstatusFilter}>
            <SelectTrigger className="w-full sm:w-[180px] bg-background">
              <SelectValue placeholder="Estatus" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">Todos los estatus</SelectItem>
              {Object.entries(ESTATUS_CONFIG).map(([k, v]) => (
                <SelectItem key={k} value={k}>{v.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      {/* Table */}
      {isLoading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : (
        <Card className="overflow-hidden border-border/50 shadow-sm">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader className="bg-muted/50">
                <TableRow>
                  <TableHead className="w-[120px]">Folio</TableHead>
                  <TableHead>Cliente</TableHead>
                  <TableHead>Equipo</TableHead>
                  <TableHead>Identidad</TableHead>
                  <TableHead>Total</TableHead>
                  <TableHead>Fecha</TableHead>
                  <TableHead>Estatus</TableHead>
                  <TableHead className="w-[160px]">Acción</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map(rental => (
                  <TableRow key={rental.id} className={cn('hover:bg-muted/30 transition-colors', rental.requires_review && rental.estatus === 'pendiente' && 'bg-amber-50/40')}>
                    <TableCell className="font-mono font-bold text-primary text-xs">
                      {rental.folio || `#${rental.id}`}
                    </TableCell>
                    <TableCell>
                      <p className="font-semibold text-sm">{rental.nombre_empresa || rental.nombre_contacto || '—'}</p>
                      {rental.nombre_empresa && rental.nombre_contacto && (
                        <p className="text-xs text-muted-foreground">{rental.nombre_contacto}</p>
                      )}
                    </TableCell>
                    <TableCell>
                      <p className="font-medium text-sm">{rental.modelo}</p>
                      <p className="text-xs text-muted-foreground">{rental.dias_renta} día{rental.dias_renta !== 1 ? 's' : ''}</p>
                    </TableCell>
                    <TableCell>
                      <IdentityBadge score={rental.identity_score} requires_review={rental.requires_review} />
                    </TableCell>
                    <TableCell className="font-bold">
                      ${rental.monto_total?.toLocaleString('es-MX')}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground whitespace-nowrap">
                      {rental.created_at ? format(new Date(rental.created_at), 'dd MMM yyyy', { locale: es }) : '—'}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className={cn('text-xs', ESTATUS_CONFIG[rental.estatus]?.color ?? '')}>
                        {ESTATUS_CONFIG[rental.estatus]?.label ?? rental.estatus}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Select
                        value={rental.estatus}
                        onValueChange={val => updateStatus(rental.id, val)}
                        disabled={updatingId === rental.id}
                      >
                        <SelectTrigger className="h-7 text-xs w-[140px]">
                          {updatingId === rental.id
                            ? <Loader2 className="h-3 w-3 animate-spin" />
                            : <SelectValue />}
                        </SelectTrigger>
                        <SelectContent>
                          {Object.entries(ESTATUS_CONFIG).map(([k, v]) => (
                            <SelectItem key={k} value={k} className="text-xs">{v.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </TableCell>
                  </TableRow>
                ))}

                {filtered.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center py-16 text-muted-foreground">
                      <ClipboardList className="h-10 w-10 mx-auto mb-3 opacity-15" />
                      <p className="font-medium">No hay rentas registradas.</p>
                      <p className="text-sm mt-1">Las solicitudes del portal web aparecerán aquí.</p>
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </Card>
      )}
    </div>
  );
}
