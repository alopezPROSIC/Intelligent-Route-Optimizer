import { useState, useEffect, useCallback } from 'react';
import { loadStripe } from '@stripe/stripe-js';
import { Elements, PaymentElement, useStripe, useElements } from '@stripe/react-stripe-js';
import { X, ArrowRight, ArrowLeft, ShieldCheck, ShieldAlert, CheckCircle2, Loader2, MapPin, CreditCard, Phone, Mail, User, FileText, Building2, AlertTriangle } from 'lucide-react';
import { useListPostalZones } from '@workspace/api-client-react';
import { toast } from 'sonner';

const API_BASE = import.meta.env.BASE_URL.replace(/\/$/, '');
const STRIPE_PK = import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY as string | undefined;
const stripePromise = STRIPE_PK ? loadStripe(STRIPE_PK) : null;

// ─── Tarifa base por tipo ─────────────────────────────────────────────────────
const RATES: Record<string, number> = {
  MONTACARGAS: 1_800, PLATAFORMA: 2_200, TELEHANDLER: 2_800, GRUA: 1_500,
};
function getRentalRate(modelo: string): number {
  const u = modelo.toUpperCase();
  for (const [k, v] of Object.entries(RATES)) { if (u.includes(k)) return v; }
  return 1_500;
}

// ─── Score badge ──────────────────────────────────────────────────────────────
function ScoreBadge({ score, aprobado }: { score: number; aprobado: boolean }) {
  const color = aprobado ? 'text-green-700 bg-green-50 border-green-200'
    : score >= 40 ? 'text-amber-700 bg-amber-50 border-amber-200'
    : 'text-red-700 bg-red-50 border-red-200';
  const Icon = aprobado ? ShieldCheck : score >= 40 ? ShieldAlert : AlertTriangle;
  return (
    <div className={`flex items-center gap-2 rounded-xl border px-4 py-3 text-sm font-semibold ${color}`}>
      <Icon className="h-5 w-5 shrink-0" />
      <div>
        <p className="font-bold">{aprobado ? 'Identidad Verificada' : score >= 40 ? 'Revisión de Director Requerida' : 'Datos Insuficientes'}</p>
        <p className="text-xs font-normal mt-0.5">Score: {score}/100 · {aprobado ? 'Pago habilitado' : score >= 40 ? 'Podrás pagar; un director aprobará tu renta' : 'Completa RFC y CURP para continuar'}</p>
      </div>
      <span className={`ml-auto text-2xl font-black ${aprobado ? 'text-green-600' : score >= 40 ? 'text-amber-600' : 'text-red-500'}`}>{score}</span>
    </div>
  );
}

// ─── Step indicator ───────────────────────────────────────────────────────────
const STEPS = ['Cotización', 'Identidad', 'Pago', 'Confirmación'];
function StepBar({ current }: { current: number }) {
  return (
    <div className="flex items-center gap-0 mb-6">
      {STEPS.map((label, i) => (
        <div key={label} className="flex items-center flex-1 last:flex-none">
          <div className="flex flex-col items-center gap-1">
            <div className={`h-7 w-7 rounded-full flex items-center justify-center text-xs font-bold transition-colors ${i < current ? 'bg-[#006d77] text-white' : i === current ? 'bg-[#33e989] text-[#154046]' : 'bg-gray-100 text-gray-400'}`}>
              {i < current ? <CheckCircle2 className="h-4 w-4" /> : i + 1}
            </div>
            <span className={`text-[10px] font-semibold whitespace-nowrap ${i === current ? 'text-[#006d77]' : 'text-gray-400'}`}>{label}</span>
          </div>
          {i < STEPS.length - 1 && (
            <div className={`flex-1 h-0.5 mb-4 mx-1 transition-colors ${i < current ? 'bg-[#006d77]' : 'bg-gray-200'}`} />
          )}
        </div>
      ))}
    </div>
  );
}

// ─── Step 1: Cotización ───────────────────────────────────────────────────────
function StepCotizacion({ equipo, onNext }: {
  equipo?: { modelo: string; tipo: string | null; id_equipo?: string; serie?: string } | null;
  onNext: (data: QuoteData) => void;
}) {
  const [modelo, setModelo] = useState(equipo?.modelo ?? '');
  const [dias, setDias] = useState(7);
  const [cp, setCp] = useState('');

  const { data: zona } = useListPostalZones(
    { cp }, { query: { queryKey: ['postal', cp], enabled: cp.length === 5 } }
  );

  const rate = getRentalRate(modelo);
  const costoRenta = rate * dias;
  const costoFlete = zona?.tarifa_flete ?? 0;
  const subtotal = costoRenta + costoFlete;
  const iva = subtotal * 0.16;
  const total = subtotal + iva;

  return (
    <div className="space-y-5">
      <div>
        <label className="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-1.5">Equipo a Rentar</label>
        <input
          className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#006d77] bg-gray-50"
          value={modelo}
          onChange={e => setModelo(e.target.value)}
          placeholder="Ej: Plataforma Tijera 26 Pies"
          required
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-1.5">Días de renta</label>
          <input type="number" min="1"
            className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#006d77] bg-gray-50"
            value={dias} onChange={e => setDias(Math.max(1, Number(e.target.value)))}
          />
        </div>
        <div>
          <label className="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-1.5">Código Postal</label>
          <div className="relative">
            <input maxLength={5}
              className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#006d77] bg-gray-50"
              value={cp} onChange={e => setCp(e.target.value)} placeholder="Ej: 06600" required
            />
            {zona && <MapPin className="absolute right-3 top-3 h-4 w-4 text-green-500" />}
          </div>
          {zona && <p className="text-xs text-green-600 mt-1 font-medium">{zona.municipio}, {zona.estado}</p>}
        </div>
      </div>

      {/* Desglose */}
      <div className="bg-gradient-to-br from-[#f4fff3] to-[#edfff7] rounded-2xl p-5 border border-[#33e989]/30 space-y-2.5">
        <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-1">Desglose de Cotización</p>
        {[
          [`Renta (${dias} día${dias !== 1 ? 's' : ''} × $${rate.toLocaleString()}/día)`, `$${costoRenta.toLocaleString()}`],
          ['Flete Logística', zona ? `$${costoFlete.toLocaleString()}` : '— ingresa CP'],
          ['Subtotal', `$${subtotal.toLocaleString()}`],
          ['IVA (16%)', `$${Math.round(iva).toLocaleString()}`],
        ].map(([l, v]) => (
          <div key={l} className="flex justify-between text-sm text-gray-600">
            <span>{l}</span><span className="font-semibold text-gray-900">{v}</span>
          </div>
        ))}
        <div className="flex justify-between font-black text-lg pt-3 border-t border-[#33e989]/40 text-[#006d77]">
          <span>Total Estimado</span>
          <span>${Math.round(total).toLocaleString()} MXN</span>
        </div>
      </div>

      <button
        disabled={!modelo || cp.length !== 5}
        onClick={() => onNext({ modelo, dias_renta: dias, cp, costo_renta: costoRenta, costo_flete: costoFlete, subtotal, iva, monto_total: Math.round(total), id_equipo: equipo?.id_equipo, serie: equipo?.serie })}
        className="w-full flex items-center justify-center gap-2 py-3.5 rounded-2xl font-bold text-[#154046] transition-all hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed"
        style={{ background: '#33e989' }}
      >
        Continuar a Validación de Identidad <ArrowRight className="h-4 w-4" />
      </button>
    </div>
  );
}

// ─── Step 2: Identidad ────────────────────────────────────────────────────────
interface QuoteData { modelo: string; dias_renta: number; cp: string; costo_renta: number; costo_flete: number; subtotal: number; iva: number; monto_total: number; id_equipo?: string; serie?: string; }
interface IdentityData { tipo_persona: 'FISICA' | 'MORAL'; nombre: string; razon_social: string; rfc: string; curp: string; email: string; telefono: string; direccion: string; score: number; aprobado: boolean; }

function StepIdentidad({ onNext, onBack }: { onNext: (d: IdentityData) => void; onBack: () => void }) {
  const [tipo, setTipo] = useState<'FISICA' | 'MORAL'>('FISICA');
  const [nombre, setNombre] = useState('');
  const [razonSocial, setRazonSocial] = useState('');
  const [rfc, setRfc] = useState('');
  const [curp, setCurp] = useState('');
  const [email, setEmail] = useState('');
  const [telefono, setTelefono] = useState('');
  const [direccion, setDireccion] = useState('');
  const [scoreResult, setScoreResult] = useState<{ score: number; aprobado: boolean } | null>(null);
  const [validating, setValidating] = useState(false);

  const validate = async () => {
    setValidating(true);
    try {
      const r = await fetch(`${API_BASE}/api/rentals/validate-identity`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rfc, curp, nombre, email, telefono, direccion }),
      });
      const d = await r.json();
      setScoreResult(d);
    } catch { toast.error('Error al validar. Intenta de nuevo.'); }
    setValidating(false);
  };

  const canProceed = scoreResult && scoreResult.score >= 40;

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        {(['FISICA', 'MORAL'] as const).map(t => (
          <button key={t} type="button"
            onClick={() => setTipo(t)}
            className={`flex-1 py-2.5 rounded-xl text-sm font-bold transition-colors ${tipo === t ? 'text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
            style={tipo === t ? { background: '#006d77' } : {}}
          >
            <span className="flex items-center justify-center gap-1.5">
              {t === 'FISICA' ? <User className="h-3.5 w-3.5" /> : <Building2 className="h-3.5 w-3.5" />}
              Persona {t === 'FISICA' ? 'Física' : 'Moral'}
            </span>
          </button>
        ))}
      </div>

      {tipo === 'MORAL' && (
        <input className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm bg-gray-50 focus:outline-none focus:ring-2 focus:ring-[#006d77]"
          placeholder="Razón Social" value={razonSocial} onChange={e => setRazonSocial(e.target.value)} />
      )}

      <div className="grid grid-cols-2 gap-3">
        <div className="relative">
          <User className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
          <input className="w-full border border-gray-200 rounded-xl pl-9 pr-3 py-3 text-sm bg-gray-50 focus:outline-none focus:ring-2 focus:ring-[#006d77]"
            placeholder="Nombre completo" value={nombre} onChange={e => setNombre(e.target.value)} />
        </div>
        <div className="relative">
          <Phone className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
          <input className="w-full border border-gray-200 rounded-xl pl-9 pr-3 py-3 text-sm bg-gray-50 focus:outline-none focus:ring-2 focus:ring-[#006d77]"
            placeholder="Teléfono (10 dígitos)" value={telefono} onChange={e => setTelefono(e.target.value)} />
        </div>
      </div>

      <div className="relative">
        <Mail className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
        <input type="email" className="w-full border border-gray-200 rounded-xl pl-9 pr-3 py-3 text-sm bg-gray-50 focus:outline-none focus:ring-2 focus:ring-[#006d77]"
          placeholder="Correo electrónico" value={email} onChange={e => setEmail(e.target.value)} />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="relative">
          <FileText className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
          <input className="w-full border border-gray-200 rounded-xl pl-9 pr-3 py-3 text-sm bg-gray-50 focus:outline-none focus:ring-2 focus:ring-[#006d77] uppercase"
            placeholder="RFC" maxLength={13} value={rfc} onChange={e => setRfc(e.target.value.toUpperCase())} />
        </div>
        <div className="relative">
          <ShieldCheck className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
          <input className="w-full border border-gray-200 rounded-xl pl-9 pr-3 py-3 text-sm bg-gray-50 focus:outline-none focus:ring-2 focus:ring-[#006d77] uppercase"
            placeholder="CURP" maxLength={18} value={curp} onChange={e => setCurp(e.target.value.toUpperCase())} />
        </div>
      </div>

      <input className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm bg-gray-50 focus:outline-none focus:ring-2 focus:ring-[#006d77]"
        placeholder="Dirección de entrega completa" value={direccion} onChange={e => setDireccion(e.target.value)} />

      {!scoreResult ? (
        <button
          disabled={validating || !nombre || !email || !telefono}
          onClick={validate}
          className="w-full flex items-center justify-center gap-2 py-3 rounded-2xl font-bold text-[#154046] transition-all hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed"
          style={{ background: '#33e989' }}
        >
          {validating ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />}
          Validar Identidad
        </button>
      ) : (
        <div className="space-y-3">
          <ScoreBadge score={scoreResult.score} aprobado={scoreResult.aprobado} />
          {!canProceed && (
            <p className="text-xs text-red-600 text-center">Añade RFC y CURP válidos para aumentar tu puntuación y continuar.</p>
          )}
          <div className="flex gap-2">
            <button onClick={() => setScoreResult(null)} className="flex-1 py-2.5 rounded-xl text-sm font-bold border border-gray-200 text-gray-600 hover:bg-gray-50 transition-colors">
              Corregir datos
            </button>
            <button
              disabled={!canProceed}
              onClick={() => onNext({ tipo_persona: tipo, nombre, razon_social: razonSocial, rfc, curp, email, telefono, direccion, score: scoreResult.score, aprobado: scoreResult.aprobado })}
              className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl font-bold text-white transition-all disabled:opacity-40 disabled:cursor-not-allowed"
              style={{ background: '#006d77' }}
            >
              Ir a Pago <ArrowRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}

      <button onClick={onBack} className="w-full text-sm text-gray-400 hover:text-gray-700 flex items-center justify-center gap-1 transition-colors">
        <ArrowLeft className="h-3.5 w-3.5" /> Volver a cotización
      </button>
    </div>
  );
}

// ─── Stripe payment form (inner) ──────────────────────────────────────────────
function StripeForm({ rentalId, paymentIntentId, folio, onSuccess }: {
  rentalId: number; paymentIntentId: string; folio: string; onSuccess: () => void;
}) {
  const stripe = useStripe();
  const elements = useElements();
  const [paying, setPaying] = useState(false);

  const handlePay = async () => {
    if (!stripe || !elements) return;
    setPaying(true);
    const { error, paymentIntent } = await stripe.confirmPayment({
      elements,
      redirect: 'if_required',
    });

    if (error) {
      toast.error(error.message ?? 'Error al procesar el pago');
      setPaying(false);
      return;
    }

    if (paymentIntent?.status === 'succeeded') {
      try {
        await fetch(`${API_BASE}/api/rentals/confirm/${rentalId}`, {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ payment_intent_id: paymentIntentId }),
        });
      } catch { /* non-critical */ }
      toast.success('¡Pago confirmado!');
      onSuccess();
    }
    setPaying(false);
  };

  return (
    <div className="space-y-4">
      <PaymentElement options={{ layout: 'tabs' }} />
      <button
        onClick={handlePay}
        disabled={!stripe || paying}
        className="w-full flex items-center justify-center gap-2 py-3.5 rounded-2xl font-bold text-white transition-all hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed"
        style={{ background: '#006d77' }}
      >
        {paying ? <Loader2 className="h-4 w-4 animate-spin" /> : <CreditCard className="h-4 w-4" />}
        {paying ? 'Procesando...' : `Pagar y Confirmar Renta`}
      </button>
    </div>
  );
}

// ─── Step 3: Pago ─────────────────────────────────────────────────────────────
function StepPago({ quote, identity, onSuccess, onBack }: {
  quote: QuoteData; identity: IdentityData;
  onSuccess: (folio: string) => void; onBack: () => void;
}) {
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [rentalId, setRentalId] = useState<number | null>(null);
  const [paymentIntentId, setPaymentIntentId] = useState<string>('');
  const [folio, setFolio] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [requiresReview, setRequiresReview] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const r = await fetch(`${API_BASE}/api/rentals/create-payment-intent`, {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            equipo_id_equipo: quote.id_equipo ?? 'N/A',
            equipo_modelo: quote.modelo,
            equipo_serie: quote.serie,
            cliente_nombre: identity.nombre,
            cliente_tipo: identity.tipo_persona,
            cliente_razon_social: identity.razon_social,
            cliente_rfc: identity.rfc,
            cliente_curp: identity.curp,
            cliente_email: identity.email,
            cliente_telefono: identity.telefono,
            direccion_entrega: identity.direccion,
            codigo_postal: quote.cp,
            dias_renta: quote.dias_renta,
            costo_renta: quote.costo_renta,
            costo_flete: quote.costo_flete,
            subtotal: quote.subtotal,
            iva: quote.iva,
            monto_total: quote.monto_total,
            identity_score: identity.score,
          }),
        });
        const d = await r.json();
        if (!r.ok) {
          if (d.error === 'STRIPE_NOT_CONFIGURED') setError('STRIPE_NOT_CONFIGURED');
          else setError(d.error ?? 'Error al iniciar el pago');
          return;
        }
        setClientSecret(d.client_secret);
        setRentalId(d.rental_id);
        setPaymentIntentId(d.client_secret?.split('_secret_')[0] ?? '');
        setFolio(d.folio);
        setRequiresReview(d.requires_review ?? false);
      } catch {
        setError('Error de conexión. Intenta de nuevo.');
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const stripeOpts = { clientSecret: clientSecret ?? '', appearance: { theme: 'stripe' as const, variables: { colorPrimary: '#006d77', borderRadius: '12px' } } };

  return (
    <div className="space-y-5">
      {/* Order summary */}
      <div className="bg-gray-50 rounded-2xl p-4 space-y-2 border border-gray-100">
        <p className="text-xs font-bold text-gray-400 uppercase tracking-widest">Resumen</p>
        <p className="font-bold text-gray-900">{quote.modelo}</p>
        <p className="text-sm text-gray-500">{quote.dias_renta} día{quote.dias_renta !== 1 ? 's' : ''} · {identity.nombre}</p>
        <div className="flex justify-between font-black text-lg text-[#006d77] pt-2 border-t border-gray-200">
          <span>Total</span>
          <span>${quote.monto_total.toLocaleString()} MXN</span>
        </div>
      </div>

      {requiresReview && (
        <div className="flex items-start gap-2 bg-amber-50 border border-amber-200 rounded-xl p-3 text-xs text-amber-800">
          <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
          <span>Tu renta requiere revisión de un director. Puedes pagar ahora; la confirmación llegará por correo en 24 hrs.</span>
        </div>
      )}

      {loading && (
        <div className="flex items-center justify-center py-8 gap-2 text-gray-400">
          <Loader2 className="h-5 w-5 animate-spin" />
          <span className="text-sm">Preparando pago seguro...</span>
        </div>
      )}

      {error === 'STRIPE_NOT_CONFIGURED' && (
        <div className="text-center py-4 space-y-3">
          <div className="h-14 w-14 bg-amber-100 rounded-full flex items-center justify-center mx-auto">
            <CreditCard className="h-7 w-7 text-amber-500" />
          </div>
          <p className="font-bold text-gray-800">Pago en línea próximamente</p>
          <p className="text-sm text-gray-500">Tu folio quedó registrado. Un asesor se comunicará en menos de 2 horas hábiles para coordinar el pago.</p>
          <button
            onClick={() => onSuccess(folio || 'PENDIENTE')}
            className="w-full py-3 rounded-2xl font-bold text-white transition-all"
            style={{ background: '#006d77' }}
          >
            Entendido — Ver Confirmación
          </button>
        </div>
      )}

      {error && error !== 'STRIPE_NOT_CONFIGURED' && (
        <p className="text-sm text-red-600 text-center bg-red-50 rounded-xl p-3">{error}</p>
      )}

      {!loading && !error && clientSecret && stripePromise && (
        <Elements stripe={stripePromise} options={stripeOpts}>
          <StripeForm
            rentalId={rentalId!}
            paymentIntentId={paymentIntentId}
            folio={folio}
            onSuccess={() => onSuccess(folio)}
          />
        </Elements>
      )}

      <button onClick={onBack} className="w-full text-sm text-gray-400 hover:text-gray-700 flex items-center justify-center gap-1 transition-colors">
        <ArrowLeft className="h-3.5 w-3.5" /> Volver
      </button>
    </div>
  );
}

// ─── Step 4: Confirmación ─────────────────────────────────────────────────────
function StepConfirmacion({ folio, modelo, total, email, onClose }: {
  folio: string; modelo: string; total: number; email: string; onClose: () => void;
}) {
  return (
    <div className="flex flex-col items-center text-center space-y-5 py-4">
      <div className="h-24 w-24 rounded-full flex items-center justify-center" style={{ background: '#e8fff4' }}>
        <CheckCircle2 className="h-12 w-12" style={{ color: '#006d77' }} />
      </div>
      <div>
        <h3 className="text-2xl font-black text-gray-900">¡Renta Confirmada!</h3>
        <p className="text-gray-500 mt-1 text-sm">Recibirás los detalles en <span className="font-semibold text-gray-700">{email}</span></p>
      </div>

      <div className="w-full rounded-2xl p-5 border" style={{ background: 'linear-gradient(135deg,#f4fff3,#edfff7)', borderColor: '#33e989' }}>
        <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-2">Folio de Renta</p>
        <p className="text-3xl font-black tracking-widest" style={{ color: '#006d77' }}>{folio}</p>
        <div className="mt-3 pt-3 border-t border-[#33e989]/40">
          <p className="text-sm text-gray-600">{modelo}</p>
          <p className="text-xl font-black text-gray-900 mt-1">${total.toLocaleString()} MXN</p>
        </div>
      </div>

      <div className="w-full bg-[#154046]/5 rounded-xl p-4 text-sm text-left space-y-2">
        <p className="font-bold text-[#154046]">Próximos pasos</p>
        <ul className="space-y-1 text-gray-600 text-xs">
          <li>✅ Confirmación por correo en los próximos minutos</li>
          <li>📞 Un asesor coordinará la fecha de entrega</li>
          <li>🚛 El equipo llega al lugar de obra acordado</li>
          <li>📋 Presenta tu folio al operador al recibir</li>
        </ul>
      </div>

      <button
        onClick={onClose}
        className="w-full py-3 rounded-2xl font-bold border border-gray-200 text-gray-700 hover:bg-gray-50 transition-colors"
      >
        Cerrar
      </button>
    </div>
  );
}

// ─── CotizadorModal (orchestrator) ────────────────────────────────────────────
export interface CotizadorEquipo {
  modelo: string;
  tipo: string | null;
  id_equipo?: string;
  serie?: string;
}

export default function CotizadorModal({ equipo, onClose }: { equipo?: CotizadorEquipo | null; onClose: () => void }) {
  const [step, setStep] = useState(0);
  const [quote, setQuote] = useState<QuoteData | null>(null);
  const [identity, setIdentity] = useState<IdentityData | null>(null);
  const [folio, setFolio] = useState('');

  // Close on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(4px)' }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md max-h-[92vh] overflow-y-auto relative">
        {/* Header */}
        <div className="sticky top-0 bg-white z-10 px-6 pt-6 pb-4 border-b border-gray-100 rounded-t-3xl">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-lg font-black text-gray-900">Renta en Línea</h2>
              <p className="text-xs text-gray-400">PROSIC — Plataforma de Logística</p>
            </div>
            <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-full transition-colors">
              <X className="h-5 w-5 text-gray-500" />
            </button>
          </div>
          {step < 3 && <StepBar current={step} />}
        </div>

        {/* Body */}
        <div className="px-6 py-5">
          {step === 0 && (
            <StepCotizacion equipo={equipo} onNext={d => { setQuote(d); setStep(1); }} />
          )}
          {step === 1 && (
            <StepIdentidad onNext={d => { setIdentity(d); setStep(2); }} onBack={() => setStep(0)} />
          )}
          {step === 2 && quote && identity && (
            <StepPago
              quote={quote}
              identity={identity}
              onSuccess={f => { setFolio(f); setStep(3); }}
              onBack={() => setStep(1)}
            />
          )}
          {step === 3 && quote && identity && (
            <StepConfirmacion
              folio={folio}
              modelo={quote.modelo}
              total={quote.monto_total}
              email={identity.email}
              onClose={onClose}
            />
          )}
        </div>
      </div>
    </div>
  );
}
