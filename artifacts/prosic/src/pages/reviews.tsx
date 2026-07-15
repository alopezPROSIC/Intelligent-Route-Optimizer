import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import {
  ShieldAlert, ShieldCheck, ShieldX, User, Building2, Loader2,
  RefreshCw, CheckCircle2, XCircle, Clock, FileText,
} from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

const API_BASE = import.meta.env.BASE_URL.replace(/\/$/, '');

interface ReviewRequest {
  id: number;
  rental_id: number;
  folio: string | null;
  tipo_persona: string;
  nombre: string;
  rfc: string | null;
  identity_score: number;
  identity_details: Record<string, unknown> | null;
  estatus: 'pendiente' | 'aprobado' | 'rechazado';
  notas_director: string | null;
  created_at: string | null;
  reviewed_at: string | null;
}

function ScoreMeter({ score }: { score: number }) {
  const pct = Math.min(100, score);
  const color = score >= 60 ? 'bg-green-500' : score >= 40 ? 'bg-amber-400' : 'bg-red-500';
  return (
    <div className="space-y-1">
      <div className="flex justify-between text-xs">
        <span className="text-muted-foreground">Score de Identidad</span>
        <span className="font-bold">{score}/100</span>
      </div>
      <div className="h-2 bg-muted rounded-full overflow-hidden">
        <div className={cn('h-full rounded-full transition-all', color)} style={{ width: `${pct}%` }} />
      </div>
      <p className="text-[10px] text-muted-foreground">
        {score >= 60 ? 'Aprobación automática' : score >= 40 ? 'Requiere revisión manual' : 'Bloqueado por score bajo'}
      </p>
    </div>
  );
}

interface ReviewDialogProps {
  review: ReviewRequest;
  onClose: () => void;
  onDone: () => void;
}

function ReviewDialog({ review, onClose, onDone }: ReviewDialogProps) {
  const [notas, setNotas] = useState('');
  const [loading, setLoading] = useState<'aprobar' | 'rechazar' | null>(null);

  const handleAction = async (accion: 'aprobar' | 'rechazar') => {
    setLoading(accion);
    const token = localStorage.getItem('prosic_token');
    try {
      const r = await fetch(`${API_BASE}/api/rentals/reviews/${review.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify({ accion, notas: notas || undefined }),
      });
      if (!r.ok) throw new Error();
      toast.success(accion === 'aprobar' ? '✅ Identidad aprobada' : '❌ Solicitud rechazada');
      onDone();
      onClose();
    } catch {
      toast.error('Error al procesar la revisión');
    } finally {
      setLoading(null);
    }
  };

  return (
    <DialogContent className="max-w-lg">
      <DialogHeader>
        <DialogTitle className="flex items-center gap-2">
          <ShieldAlert className="h-5 w-5 text-amber-500" />
          Revisión de Identidad — {review.folio ?? `Renta #${review.rental_id}`}
        </DialogTitle>
      </DialogHeader>

      <div className="space-y-4">
        {/* Identity info */}
        <div className="grid grid-cols-2 gap-3">
          <div className="p-3 rounded-lg bg-muted/40 border border-border/50 space-y-1">
            <div className="flex items-center gap-1.5 text-xs font-bold text-muted-foreground uppercase tracking-wider">
              {review.tipo_persona === 'MORAL' ? <Building2 className="h-3 w-3" /> : <User className="h-3 w-3" />}
              {review.tipo_persona === 'MORAL' ? 'Persona Moral' : 'Persona Física'}
            </div>
            <p className="font-bold text-sm">{review.nombre}</p>
            {review.rfc && <p className="font-mono text-xs text-muted-foreground">{review.rfc}</p>}
          </div>
          <div className="p-3 rounded-lg bg-muted/40 border border-border/50">
            <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-2">Fecha solicitud</p>
            <p className="text-sm font-medium">
              {review.created_at ? format(new Date(review.created_at), "dd 'de' MMMM yyyy", { locale: es }) : '—'}
            </p>
          </div>
        </div>

        <ScoreMeter score={review.identity_score} />

        {/* Detail breakdown */}
        {review.identity_details && (
          <div className="p-3 rounded-lg bg-muted/30 border border-border/50 space-y-1.5">
            <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Detalle de score</p>
            {Object.entries(review.identity_details).map(([k, v]) => (
              <div key={k} className="flex justify-between text-xs">
                <span className="text-muted-foreground capitalize">{k.replace(/_/g, ' ')}</span>
                <span className={cn('font-semibold', Number(v) > 0 ? 'text-green-700' : 'text-red-600')}>
                  {Number(v) > 0 ? `+${v}` : v} pts
                </span>
              </div>
            ))}
          </div>
        )}

        {/* Notes */}
        <div className="space-y-1.5">
          <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1">
            <FileText className="h-3 w-3" /> Notas del director (opcional)
          </label>
          <Textarea
            placeholder="Razón de aprobación o rechazo..."
            value={notas}
            onChange={e => setNotas(e.target.value)}
            className="h-20 resize-none text-sm"
          />
        </div>
      </div>

      <DialogFooter className="gap-2 sm:gap-0">
        <Button variant="outline" onClick={onClose} disabled={!!loading}>Cancelar</Button>
        <Button
          variant="outline"
          className="border-red-300 text-red-700 hover:bg-red-50"
          onClick={() => handleAction('rechazar')}
          disabled={!!loading}
        >
          {loading === 'rechazar' ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <XCircle className="h-4 w-4 mr-2" />}
          Rechazar
        </Button>
        <Button
          className="bg-green-600 hover:bg-green-700 text-white"
          onClick={() => handleAction('aprobar')}
          disabled={!!loading}
        >
          {loading === 'aprobar' ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <CheckCircle2 className="h-4 w-4 mr-2" />}
          Aprobar
        </Button>
      </DialogFooter>
    </DialogContent>
  );
}

export default function Reviews() {
  const [reviews, setReviews] = useState<ReviewRequest[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selected, setSelected] = useState<ReviewRequest | null>(null);
  const [tab, setTab] = useState<'pendiente' | 'all'>('pendiente');

  const fetchReviews = useCallback(async () => {
    setIsLoading(true);
    const token = localStorage.getItem('prosic_token');
    try {
      const r = await fetch(`${API_BASE}/api/rentals/reviews`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (!r.ok) throw new Error();
      const data = await r.json();
      setReviews(data);
    } catch {
      toast.error('Error al cargar revisiones');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => { fetchReviews(); }, [fetchReviews]);

  const displayed = tab === 'pendiente' ? reviews.filter(r => r.estatus === 'pendiente') : reviews;
  const pendingCount = reviews.filter(r => r.estatus === 'pendiente').length;

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-3xl font-black tracking-tight">Revisiones de Identidad</h1>
          <p className="text-muted-foreground">Cola de aprobación manual para solicitudes de renta en línea.</p>
        </div>
        <Button variant="outline" size="sm" onClick={fetchReviews} disabled={isLoading}>
          <RefreshCw className={cn('h-4 w-4', isLoading && 'animate-spin')} />
        </Button>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: 'Pendientes', value: reviews.filter(r => r.estatus === 'pendiente').length, color: 'text-amber-600', icon: Clock },
          { label: 'Aprobados',  value: reviews.filter(r => r.estatus === 'aprobado').length,  color: 'text-green-600', icon: ShieldCheck },
          { label: 'Rechazados', value: reviews.filter(r => r.estatus === 'rechazado').length, color: 'text-red-600',   icon: ShieldX },
        ].map(({ label, value, color, icon: Icon }) => (
          <Card key={label} className="border-border/50 shadow-sm">
            <CardContent className="p-4 flex items-center gap-3">
              <Icon className={cn('h-8 w-8 opacity-20', color)} />
              <div>
                <p className={cn('text-2xl font-black', color)}>{value}</p>
                <p className="text-xs text-muted-foreground">{label}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-muted/40 p-1 rounded-lg w-fit">
        {([['pendiente', `Pendientes (${pendingCount})`], ['all', 'Todos']] as const).map(([key, lbl]) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={cn(
              'px-4 py-1.5 rounded-md text-sm font-medium transition-all',
              tab === key ? 'bg-white shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground'
            )}
          >
            {lbl}
          </button>
        ))}
      </div>

      {/* Cards */}
      {isLoading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : displayed.length === 0 ? (
        <Card className="border-border/50 shadow-sm">
          <CardContent className="py-16 text-center text-muted-foreground">
            <ShieldCheck className="h-12 w-12 mx-auto mb-3 opacity-15" />
            <p className="font-medium">
              {tab === 'pendiente' ? '¡Sin revisiones pendientes!' : 'No hay revisiones registradas.'}
            </p>
            {tab === 'pendiente' && <p className="text-sm mt-1">Todas las identidades han sido procesadas.</p>}
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {displayed.map(review => (
            <Card
              key={review.id}
              className={cn(
                'border-border/50 shadow-sm transition-all hover:shadow-md',
                review.estatus === 'pendiente' && 'border-amber-200 bg-amber-50/20',
                review.estatus === 'aprobado' && 'border-green-200',
                review.estatus === 'rechazado' && 'border-red-200 bg-red-50/10',
              )}
            >
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <p className="font-bold text-sm truncate">{review.nombre}</p>
                    {review.rfc && <p className="font-mono text-xs text-muted-foreground">{review.rfc}</p>}
                  </div>
                  <Badge
                    variant="outline"
                    className={cn(
                      'text-[10px] shrink-0',
                      review.estatus === 'pendiente' && 'border-amber-300 text-amber-700 bg-amber-50',
                      review.estatus === 'aprobado' && 'border-green-300 text-green-700 bg-green-50',
                      review.estatus === 'rechazado' && 'border-red-300 text-red-700 bg-red-50',
                    )}
                  >
                    {review.estatus === 'pendiente' ? 'Pendiente' : review.estatus === 'aprobado' ? 'Aprobado' : 'Rechazado'}
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground">
                  {review.folio ?? `Renta #${review.rental_id}`} · {review.tipo_persona === 'MORAL' ? 'Moral' : 'Física'}
                </p>
              </CardHeader>
              <CardContent className="pt-0 space-y-3">
                <ScoreMeter score={review.identity_score} />
                {review.notas_director && (
                  <p className="text-xs text-muted-foreground italic border-l-2 border-border pl-2">
                    {review.notas_director}
                  </p>
                )}
                {review.estatus === 'pendiente' && (
                  <Button
                    className="w-full h-8 text-xs"
                    onClick={() => setSelected(review)}
                  >
                    Revisar Identidad
                  </Button>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Review dialog */}
      <Dialog open={!!selected} onOpenChange={open => { if (!open) setSelected(null); }}>
        {selected && (
          <ReviewDialog
            review={selected}
            onClose={() => setSelected(null)}
            onDone={fetchReviews}
          />
        )}
      </Dialog>
    </div>
  );
}
