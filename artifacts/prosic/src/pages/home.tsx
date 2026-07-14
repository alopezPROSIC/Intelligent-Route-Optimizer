import { useState, useMemo, useEffect } from 'react';
import { Link } from 'wouter';
import { useListPostalZones, useCreateQuote, useValidateIdentity, QuoteRequestTipoPersona, IdentityValidationRequestTipoPersona } from '@workspace/api-client-react';
import { Search, ShoppingCart, LayoutGrid, List, ChevronDown, X, Loader as Loader2, ArrowRight, CircleCheck as CheckCircle2, ShieldCheck, MapPin } from 'lucide-react';

const API_BASE = import.meta.env.BASE_URL.replace(/\/$/, '');
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';

// ─── Equipment catalog data (type-based images) ───────────────────────────────
const EQUIPMENT_IMAGES: Record<string, string> = {
  MONTACARGAS: 'https://images.unsplash.com/photo-1504328345606-18bbc8c9d7d1?w=400&q=80',
  PLATAFORMA: 'https://images.unsplash.com/photo-1581092580497-e0d23cbdf1dc?w=400&q=80',
  TELEHANDLER: 'https://images.unsplash.com/photo-1504328345606-18bbc8c9d7d1?w=400&q=80',
  GRUA: 'https://images.unsplash.com/photo-1555436169-f48aea197c34?w=400&q=80',
};

const CATALOG: {
  categoria: string;
  subcategorias?: { nombre: string; count: number }[];
  count: number;
}[] = [
  {
    categoria: 'Plataformas de Elevación',
    count: 60,
    subcategorias: [
      { nombre: 'Plataformas de Brazo Articulado', count: 12 },
      { nombre: 'Plataformas de Brazo Telescópico', count: 8 },
      { nombre: 'Plataformas de Tijera', count: 7 },
      { nombre: 'Plataformas Unipersonales', count: 2 },
      { nombre: 'Plataformas Toucan', count: 1 },
    ],
  },
  { categoria: 'Montacargas', count: 11 },
  { categoria: 'Manipuladores Telescópicos', count: 5 },
  { categoria: 'Torres de Iluminación', count: 1 },
];

const HEIGHTS = [
  { label: '10 ft (3.0 m)', count: 0 },
  { label: '11 ft (3.3 m)', count: 0 },
  { label: '12 ft (3.6 m)', count: 0 },
  { label: '13 ft (4.0 m)', count: 2 },
  { label: '14 ft (4.2 m)', count: 2 },
  { label: '16 ft (4.8 m)', count: 2 },
  { label: '19 ft (5.7 m)', count: 2 },
  { label: '23 ft (7.1 m)', count: 1 },
  { label: '26 ft (7.9 m)', count: 2 },
  { label: '30 ft (9.1 m)', count: 1 },
  { label: '32 ft (9.7 m)', count: 2 },
];

const REACHES = [
  { label: '11 ft (3.3 m)', count: 1 },
  { label: '18 ft (5.5 m)', count: 2 },
  { label: '19 ft (5.7 m)', count: 2 },
];

// ─── Product card images — reliable industrial machinery photos ───────────────
// Using specific Unsplash photo IDs that show actual heavy equipment
const EQUIP_PHOTO_POOL: Record<string, string[]> = {
  MONTACARGAS: [
    'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=400&q=80',  // forklift warehouse
    'https://images.unsplash.com/photo-1601584115197-04ecc0da31d7?w=400&q=80', // forklift loading
    'https://images.unsplash.com/photo-1553290322-a5f7e4faa15a?w=400&q=80',  // industrial forklift
  ],
  PLATAFORMA: [
    'https://images.unsplash.com/photo-1504917595217-d4dc5ebe6122?w=400&q=80', // aerial work platform
    'https://images.unsplash.com/photo-1504328345606-18bbc8c9d7d1?w=400&q=80', // scissor lift
    'https://images.unsplash.com/photo-1581092580497-e0d23cbdf1dc?w=400&q=80', // boom lift
  ],
  TELEHANDLER: [
    'https://images.unsplash.com/photo-1581092918056-0c4c3acd3789?w=400&q=80', // telescopic handler
    'https://images.unsplash.com/photo-1504917595217-d4dc5ebe6122?w=400&q=80', // construction lift
  ],
  GRUA: [
    'https://images.unsplash.com/photo-1541888081635-4674f7d3a01d?w=400&q=80', // crane/tower
    'https://images.unsplash.com/photo-1565814329452-e1efa11c5b89?w=400&q=80', // tower light
  ],
};

function equipImg(tipo: string | null | undefined, modelo: string, idx: number): string {
  const t = (tipo ?? '').toUpperCase();
  // Try to detect by model name keywords
  const m = modelo.toUpperCase();
  let key = 'MONTACARGAS';
  if (m.includes('PLATAFORMA') || m.includes('TIJERA') || m.includes('ARTICULAD') || m.includes('TELESCÓP') || m.includes('MÁSTIL') || m.includes('TOUCAN')) key = 'PLATAFORMA';
  else if (m.includes('TELEHANDLER') || m.includes('MANIPULAD')) key = 'TELEHANDLER';
  else if (m.includes('GRUA') || m.includes('ILUMINAC') || m.includes('TORRE')) key = 'GRUA';
  else if (t.includes('MONTACARGAS')) key = 'MONTACARGAS';
  else if (t.includes('PLATAFORMA')) key = 'PLATAFORMA';
  else if (t.includes('TELEHANDLER')) key = 'TELEHANDLER';
  else if (t.includes('GRUA')) key = 'GRUA';
  const imgs = EQUIP_PHOTO_POOL[key];
  return imgs[idx % imgs.length];
}

// ─── Cotizador Modal ──────────────────────────────────────────────────────────
function CotizadorModal({ equipo, onClose }: { equipo?: { modelo: string; tipo: string | null } | null; onClose: () => void }) {
  const [cpInput, setCpInput] = useState('');
  const [selectedModelo, setSelectedModelo] = useState(equipo?.modelo ?? '');
  const [diasRenta, setDiasRenta] = useState(1);
  const [quoteResult, setQuoteResult] = useState<{ folio: string; monto_total: number } | null>(null);

  const { data: zones } = useListPostalZones({ cp: cpInput }, { query: { queryKey: ['postal-zones', cpInput], enabled: cpInput.length === 5 } });
  const createQuote = useCreateQuote();
  const validateIdentity = useValidateIdentity();

  const [tipoPersona, setTipoPersona] = useState<'FISICA' | 'MORAL'>('FISICA');
  const [rfc, setRfc] = useState('');
  const [nombre, setNombre] = useState('');
  const [razonSocial, setRazonSocial] = useState('');
  const [telefono, setTelefono] = useState('');
  const [email, setEmail] = useState('');
  const [direccion, setDireccion] = useState('');

  const zona = zones;
  const RATES: Record<string, number> = { MONTACARGAS: 350, PLATAFORMA: 280, TELEHANDLER: 420, GRUA: 500 };
  const getRentalRate = (m: string) => {
    const u = m.toUpperCase();
    for (const [k, v] of Object.entries(RATES)) { if (u.includes(k)) return v; }
    return 300;
  };
  const costoRenta = getRentalRate(selectedModelo) * diasRenta;
  const costoFlete = zona?.tarifa_flete ?? 0;
  const subtotal = costoRenta + costoFlete;
  const iva = subtotal * 0.16;
  const total = subtotal + iva;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedModelo || !cpInput || cpInput.length !== 5) {
      toast.error('Completa el equipo y código postal');
      return;
    }
    createQuote.mutate({
      data: {
        codigo_postal: cpInput,
        modelo: selectedModelo,
        dias_renta: diasRenta,
        tipo_persona: tipoPersona as QuoteRequestTipoPersona,
        nombre_empresa: razonSocial || undefined,
        rfc: rfc || undefined,
        nombre_contacto: nombre,
        telefono,
        email,
        direccion_entrega: direccion,
      }
    }, {
      onSuccess: (data) => {
        setQuoteResult({ folio: data.folio ?? String(data.id), monto_total: data.monto_total });
        toast.success('Cotización generada');
      },
      onError: () => toast.error('Error al generar cotización'),
    });
  };

  const handleValidate = () => {
    validateIdentity.mutate({
      data: { tipo_persona: tipoPersona as IdentityValidationRequestTipoPersona, rfc, nombre }
    }, {
      onSuccess: (d) => d.valido ? toast.success('RFC válido') : toast.error('RFC inválido: ' + d.observaciones),
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.6)' }}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto relative">
        <div className="sticky top-0 bg-white z-10 flex items-center justify-between px-6 py-4 border-b">
          <h2 className="text-xl font-bold text-gray-900">Solicitar Cotización en Línea</h2>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-full transition-colors">
            <X className="h-5 w-5 text-gray-600" />
          </button>
        </div>

        {!quoteResult ? (
          <form onSubmit={handleSubmit} className="p-6 space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Equipo requerido</label>
              <input
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#006d77]"
                value={selectedModelo}
                onChange={e => setSelectedModelo(e.target.value)}
                placeholder="Modelo del equipo"
                required
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Días de renta</label>
                <input
                  type="number" min="1"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#006d77]"
                  value={diasRenta}
                  onChange={e => setDiasRenta(Number(e.target.value))}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Código Postal</label>
                <div className="relative">
                  <input
                    maxLength={5}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#006d77]"
                    value={cpInput}
                    onChange={e => setCpInput(e.target.value)}
                    placeholder="06600"
                    required
                  />
                  {zona && <MapPin className="absolute right-2 top-2.5 h-4 w-4 text-green-500" />}
                </div>
                {zona && <p className="text-xs text-green-600 mt-0.5">{zona.municipio}, {zona.estado}</p>}
              </div>
            </div>

            <div className="bg-[#f4fff3] rounded-xl p-4 border border-[#33e989]/30 space-y-2">
              {[
                [`Renta (${diasRenta} días)`, `$${costoRenta.toLocaleString()}`],
                ['Flete Logística', zona ? `$${costoFlete.toLocaleString()}` : 'Ingresa CP'],
                ['Subtotal', `$${subtotal.toLocaleString()}`],
                ['IVA (16%)', `$${iva.toLocaleString()}`],
              ].map(([label, val]) => (
                <div key={label} className="flex justify-between text-sm text-gray-600">
                  <span>{label}</span><span className="font-semibold text-gray-900">{val}</span>
                </div>
              ))}
              <div className="flex justify-between font-bold text-base pt-2 border-t border-[#33e989]/40 text-[#006d77]">
                <span>Total Estimado</span><span>${total.toLocaleString()}</span>
              </div>
            </div>

            <div className="border-t pt-4 space-y-3">
              <h3 className="font-semibold text-gray-800">Datos de Contacto</h3>
              <div className="flex gap-3">
                {(['FISICA', 'MORAL'] as const).map(t => (
                  <label key={t} className={`flex-1 border rounded-lg px-3 py-2 text-sm font-medium cursor-pointer text-center transition-colors ${tipoPersona === t ? 'border-[#006d77] bg-[#006d77] text-white' : 'border-gray-300 text-gray-600'}`}>
                    <input type="radio" className="sr-only" checked={tipoPersona === t} onChange={() => setTipoPersona(t)} />
                    Persona {t === 'FISICA' ? 'Física' : 'Moral'}
                  </label>
                ))}
              </div>
              {tipoPersona === 'MORAL' && (
                <input className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" placeholder="Razón Social" value={razonSocial} onChange={e => setRazonSocial(e.target.value)} />
              )}
              <input className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" placeholder="Nombre de contacto" value={nombre} onChange={e => setNombre(e.target.value)} required />
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <input className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" placeholder="RFC (opcional)" value={rfc} onChange={e => setRfc(e.target.value)} />
                  {rfc.length > 10 && (
                    <button type="button" onClick={handleValidate} className="mt-1 text-xs text-[#006d77] flex items-center gap-1 hover:underline">
                      <ShieldCheck className="h-3 w-3" /> Validar SAT
                    </button>
                  )}
                </div>
                <input className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" placeholder="Teléfono" value={telefono} onChange={e => setTelefono(e.target.value)} required />
              </div>
              <input type="email" className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" placeholder="Correo electrónico" value={email} onChange={e => setEmail(e.target.value)} required />
              <textarea className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm h-16 resize-none" placeholder="Dirección de entrega" value={direccion} onChange={e => setDireccion(e.target.value)} required />
            </div>

            <button
              type="submit"
              disabled={createQuote.isPending}
              className="w-full flex items-center justify-center gap-2 py-3 rounded-xl font-bold text-white transition-opacity disabled:opacity-70"
              style={{ background: '#006d77' }}
            >
              {createQuote.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowRight className="h-4 w-4" />}
              Generar Cotización Oficial
            </button>
          </form>
        ) : (
          <div className="p-8 flex flex-col items-center space-y-5 text-center">
            <div className="h-20 w-20 bg-green-100 rounded-full flex items-center justify-center">
              <CheckCircle2 className="h-10 w-10 text-green-600" />
            </div>
            <h2 className="text-2xl font-black text-gray-900">¡Cotización Creada!</h2>
            <p className="text-gray-500">Un asesor se comunicará contigo pronto para confirmar disponibilidad.</p>
            <div className="w-full bg-[#f4fff3] rounded-xl p-5">
              <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-1">Folio de Seguimiento</p>
              <p className="text-4xl font-black text-[#006d77]">{quoteResult.folio}</p>
              <div className="mt-4 pt-4 border-t flex justify-between font-bold text-lg">
                <span>Total:</span><span>${quoteResult.monto_total.toLocaleString()}</span>
              </div>
            </div>
            <button onClick={() => { setQuoteResult(null); onClose(); }} className="w-full border border-gray-300 rounded-xl py-2.5 font-medium hover:bg-gray-50 transition-colors">
              Cerrar
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Main Home Page ───────────────────────────────────────────────────────────
export default function Home() {
  const [search, setSearch] = useState('');
  const [selectedCat, setSelectedCat] = useState<string | null>(null);
  const [selectedHeights, setSelectedHeights] = useState<string[]>([]);
  const [selectedReaches, setSelectedReaches] = useState<string[]>([]);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [sortBy, setSortBy] = useState('Destacados');
  const [cartCount] = useState(0);
  const [showCotizador, setShowCotizador] = useState(false);
  const [cotizadorEquipo, setCotizadorEquipo] = useState<{ modelo: string; tipo: string | null } | null>(null);

  const [equipmentData, setEquipmentData] = useState<{ id: number; id_equipo: string; modelo: string; tipo: string | null; disponible: boolean }[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetch(`${API_BASE}/api/equipment/catalog`)
      .then(r => r.ok ? r.json() : [])
      .then(data => { setEquipmentData(Array.isArray(data) ? data : []); setIsLoading(false); })
      .catch(() => setIsLoading(false));
  }, []);

  // Build combined catalog list (API data + static placeholders)
  const staticProducts = [
    { id: 's1', id_equipo: 'EQ-CAT-001', modelo: 'Plataforma Tijera 26 Pies, Eléctrica', serie: '', tipo: 'PLATAFORMA', disponible: true },
    { id: 's2', id_equipo: 'EQ-CAT-002', modelo: 'Plataforma Tijera 13 Pies, Eléctrica', serie: '', tipo: 'PLATAFORMA', disponible: true },
    { id: 's3', id_equipo: 'EQ-CAT-003', modelo: 'Plataforma Tijera 19 Pies, Eléctrica', serie: '', tipo: 'PLATAFORMA', disponible: true },
    { id: 's4', id_equipo: 'EQ-CAT-004', modelo: 'Plataforma de Mástil 12 Pies, Eléctrica', serie: '', tipo: 'PLATAFORMA', disponible: true },
    { id: 's5', id_equipo: 'EQ-CAT-005', modelo: 'Torre de Iluminación, Combustión', serie: '', tipo: 'GRUA', disponible: true },
    { id: 's6', id_equipo: 'EQ-CAT-006', modelo: 'Plataforma Articulada 30 Pies, Eléctrica', serie: '', tipo: 'PLATAFORMA', disponible: true },
    { id: 's7', id_equipo: 'EQ-CAT-007', modelo: 'Plataforma Tijera 32 Pies, Eléctrica', serie: '', tipo: 'PLATAFORMA', disponible: true },
    { id: 's8', id_equipo: 'EQ-CAT-008', modelo: 'Plataforma Tipo Toucan 32 Pies, Eléctrica', serie: '', tipo: 'PLATAFORMA', disponible: true },
    { id: 's9', id_equipo: 'EQ-CAT-009', modelo: 'Plataforma Articulada 46 Pies, Diésel', serie: '', tipo: 'PLATAFORMA', disponible: true },
    { id: 's10', id_equipo: 'EQ-CAT-010', modelo: 'Plataforma Telescópica 60 Pies, Diésel', serie: '', tipo: 'PLATAFORMA', disponible: true },
    { id: 's11', id_equipo: 'EQ-CAT-011', modelo: 'Montacargas Reach 35 Pies, Eléctrico', serie: '', tipo: 'MONTACARGAS', disponible: true },
    { id: 's12', id_equipo: 'EQ-CAT-012', modelo: 'Manipulador Telescópico 6T, Combustión', serie: '', tipo: 'TELEHANDLER', disponible: true },
  ];

  const apiProducts = equipmentData.map(e => ({ ...e, id: String(e.id) }));
  const allProducts = [...apiProducts, ...staticProducts];

  const filtered = useMemo(() => {
    return allProducts.filter(p => {
      if (search && !p.modelo.toLowerCase().includes(search.toLowerCase())) return false;
      if (selectedCat) {
        const cat = selectedCat.toUpperCase();
        const tipo = (p.tipo ?? '').toUpperCase();
        if (cat.includes('MONTACARGAS') && !tipo.includes('MONTACARGAS')) return false;
        if (cat.includes('PLATAFORMA') && !tipo.includes('PLATAFORMA')) return false;
        if (cat.includes('TELESCÓPI') && !tipo.includes('TELEHANDLER')) return false;
        if (cat.includes('ILUMINACI') && !tipo.includes('GRUA')) return false;
      }
      return true;
    });
  }, [allProducts.length, search, selectedCat]);

  const toggleHeight = (h: string) =>
    setSelectedHeights(prev => prev.includes(h) ? prev.filter(x => x !== h) : [...prev, h]);
  const toggleReach = (r: string) =>
    setSelectedReaches(prev => prev.includes(r) ? prev.filter(x => x !== r) : [...prev, r]);

  return (
    <div className="min-h-screen bg-white font-[Figtree,sans-serif]">

      {/* ── Navbar ─────────────────────────────────────────────────────────── */}
      <nav className="bg-white border-b border-gray-200 sticky top-0 z-40">
        <div className="max-w-[1280px] mx-auto px-4 h-14 flex items-center gap-6">
          {/* Logo */}
          <div className="flex items-center gap-2 mr-2 flex-shrink-0">
            <div className="h-8 w-8 rounded flex items-center justify-center" style={{ background: '#006d77' }}>
              <span className="text-white font-black text-xs">P</span>
            </div>
            <span className="font-black text-lg tracking-tight" style={{ color: '#154046' }}>prosic.</span>
          </div>

          {/* Nav links */}
          <div className="hidden md:flex items-center gap-5 text-sm font-medium flex-1">
            <a href="#" className="text-gray-500 hover:text-gray-900 transition-colors">Inicio</a>
            <a href="#" className="font-semibold border-b-2 pb-0.5 transition-colors" style={{ color: '#006d77', borderColor: '#33e989' }}>
              Maquinaria en Renta
            </a>
            <a href="#" className="text-gray-500 hover:text-gray-900 transition-colors">Maquinaria en Venta</a>
            <a href="#" className="text-gray-500 hover:text-gray-900 transition-colors">Refacciones y Accesorios</a>
            <span className="text-gray-300">+</span>
          </div>

          {/* Right actions */}
          <div className="flex items-center gap-3 ml-auto">
            <button className="relative p-2 text-gray-500 hover:text-gray-900 transition-colors">
              <ShoppingCart className="h-5 w-5" />
              {cartCount > 0 && (
                <span className="absolute -top-0.5 -right-0.5 h-4 w-4 text-xs flex items-center justify-center rounded-full text-white font-bold" style={{ background: '#006d77' }}>
                  {cartCount}
                </span>
              )}
            </button>
            <Link href="/login" className="text-sm font-medium text-gray-600 hover:text-gray-900 transition-colors hidden sm:inline">
              Iniciar sesión
            </Link>
            <button
              onClick={() => { setCotizadorEquipo(null); setShowCotizador(true); }}
              className="hidden sm:flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-bold text-[#154046] transition-colors hover:opacity-90"
              style={{ background: '#33e989' }}
            >
              SOLICITAR COTIZACIÓN EN LÍNEA
            </button>
          </div>
        </div>
      </nav>

      {/* ── Hero banner strip ──────────────────────────────────────────────── */}
      <div className="h-16 bg-gradient-to-r from-[#154046] to-[#006d77] flex items-center justify-center">
        <p className="text-white/80 text-sm font-medium tracking-wide">
          Plataformas de elevación · Montacargas · Manipuladores telescópicos — Entrega en todo México
        </p>
      </div>

      {/* ── Search bar ─────────────────────────────────────────────────────── */}
      <div className="py-5 px-4" style={{ background: '#33e989' }}>
        <div className="max-w-[1280px] mx-auto flex flex-col sm:flex-row items-center gap-3">
          <h2 className="text-[#154046] font-bold text-lg whitespace-nowrap">Buscar maquinaria en renta</h2>
          <div className="relative flex-1 w-full max-w-2xl flex">
            <input
              type="text"
              placeholder="Buscar..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="flex-1 border-0 rounded-l-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#006d77] text-gray-800"
              style={{ background: 'white' }}
            />
            <button className="px-4 rounded-r-lg flex items-center justify-center transition-colors hover:opacity-90" style={{ background: '#006d77' }}>
              <Search className="h-4 w-4 text-white" />
            </button>
          </div>
        </div>
      </div>

      {/* ── Catalog layout ─────────────────────────────────────────────────── */}
      <div className="max-w-[1280px] mx-auto px-4 py-6 flex gap-6">

        {/* ── Sidebar filters ────────────────────────────────────────────── */}
        <aside className="hidden md:block w-60 flex-shrink-0">
          {/* Categories */}
          <div className="mb-6">
            <h3 className="font-bold text-sm text-gray-900 mb-3">Categorías</h3>
            <div className="space-y-1.5">
              <label className="flex items-center gap-2 cursor-pointer group">
                <input
                  type="radio"
                  name="cat"
                  checked={selectedCat === null}
                  onChange={() => setSelectedCat(null)}
                  className="accent-[#006d77]"
                />
                <span className="text-sm text-gray-700 group-hover:text-gray-900">Todos los productos</span>
              </label>
              {CATALOG.map(cat => (
                <div key={cat.categoria}>
                  <label className="flex items-center gap-2 cursor-pointer group">
                    <input
                      type="radio"
                      name="cat"
                      checked={selectedCat === cat.categoria}
                      onChange={() => setSelectedCat(cat.categoria)}
                      className="accent-[#006d77]"
                    />
                    <span className="text-sm text-gray-700 group-hover:text-gray-900">
                      {cat.categoria}
                      <span className="ml-1 text-gray-400 text-xs">({cat.count})</span>
                    </span>
                  </label>
                  {cat.subcategorias && selectedCat === cat.categoria && (
                    <div className="ml-6 mt-1.5 space-y-1.5">
                      {cat.subcategorias.map(sub => (
                        <label key={sub.nombre} className="flex items-center gap-2 cursor-pointer group">
                          <input type="radio" name="cat" className="accent-[#006d77]"
                            checked={selectedCat === sub.nombre}
                            onChange={() => setSelectedCat(sub.nombre)}
                          />
                          <span className="text-xs text-gray-600 group-hover:text-gray-900">
                            {sub.nombre}
                            <span className="ml-1 text-gray-400">({sub.count})</span>
                          </span>
                        </label>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Elevation filter */}
          <div className="mb-6 border-t border-gray-100 pt-4">
            <h3 className="font-bold text-sm text-gray-900 mb-3">Elevación Máxima ft (m)</h3>
            <div className="space-y-1.5">
              {HEIGHTS.map(h => (
                <label key={h.label} className="flex items-center justify-between cursor-pointer group">
                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={selectedHeights.includes(h.label)}
                      onChange={() => toggleHeight(h.label)}
                      className="accent-[#006d77]"
                    />
                    <span className="text-xs text-gray-600 group-hover:text-gray-900">{h.label}</span>
                  </div>
                  {h.count > 0 && <span className="text-xs text-gray-400">{h.count}</span>}
                </label>
              ))}
            </div>
          </div>

          {/* Horizontal reach filter */}
          <div className="mb-6 border-t border-gray-100 pt-4">
            <h3 className="font-bold text-sm text-gray-900 mb-3">Alcance Horizontal Máximo ft (m)</h3>
            <div className="space-y-1.5">
              {REACHES.map(r => (
                <label key={r.label} className="flex items-center justify-between cursor-pointer group">
                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={selectedReaches.includes(r.label)}
                      onChange={() => toggleReach(r.label)}
                      className="accent-[#006d77]"
                    />
                    <span className="text-xs text-gray-600 group-hover:text-gray-900">{r.label}</span>
                  </div>
                  <span className="text-xs text-gray-400">{r.count}</span>
                </label>
              ))}
            </div>
          </div>
        </aside>

        {/* ── Product grid ───────────────────────────────────────────────── */}
        <div className="flex-1 min-w-0">
          {/* Toolbar */}
          <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
            <p className="text-sm text-gray-600">
              <span className="font-semibold text-gray-900">
                {selectedCat ? selectedCat : 'Todos los Productos'}
              </span>
              {' '}— <span className="font-semibold">{filtered.length}</span> items
            </p>
            <div className="flex items-center gap-3">
              {/* Sort */}
              <div className="relative">
                <button className="flex items-center gap-1.5 text-sm border border-gray-200 rounded-lg px-3 py-1.5 text-gray-700 hover:bg-gray-50 transition-colors">
                  <span>Ordenar por: <strong>{sortBy}</strong></span>
                  <ChevronDown className="h-3.5 w-3.5 text-gray-500" />
                </button>
              </div>
              {/* View toggle */}
              <div className="flex border border-gray-200 rounded-lg overflow-hidden">
                <button
                  onClick={() => setViewMode('grid')}
                  className={`p-1.5 transition-colors ${viewMode === 'grid' ? 'bg-[#006d77] text-white' : 'text-gray-500 hover:bg-gray-50'}`}
                >
                  <LayoutGrid className="h-4 w-4" />
                </button>
                <button
                  onClick={() => setViewMode('list')}
                  className={`p-1.5 transition-colors ${viewMode === 'list' ? 'bg-[#006d77] text-white' : 'text-gray-500 hover:bg-gray-50'}`}
                >
                  <List className="h-4 w-4" />
                </button>
              </div>
            </div>
          </div>

          {/* Loading */}
          {isLoading && (
            <div className="flex items-center justify-center py-20">
              <Loader2 className="h-8 w-8 animate-spin text-[#006d77]" />
            </div>
          )}

          {/* Grid */}
          {!isLoading && viewMode === 'grid' && (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
              {filtered.map((product, idx) => (
                <div
                  key={product.id_equipo + idx}
                  className="bg-white border border-gray-200 rounded-xl overflow-hidden hover:shadow-md hover:border-[#006d77]/30 transition-all cursor-pointer group"
                  onClick={() => { setCotizadorEquipo({ modelo: product.modelo, tipo: product.tipo ?? null }); setShowCotizador(true); }}
                >
                  {/* Image area */}
                  <div className="relative bg-gray-50 aspect-square overflow-hidden">
                    <img
                      src={equipImg(product.tipo, product.modelo, idx)}
                      alt={product.modelo}
                      className="w-full h-full object-contain p-3 group-hover:scale-105 transition-transform duration-300"
                      onError={e => { (e.target as HTMLImageElement).src = 'https://images.unsplash.com/photo-1504328345606-18bbc8c9d7d1?w=400&q=60'; }}
                    />
                    {/* PROSIC watermark-style badge */}
                    <span className="absolute bottom-2 right-2 text-[9px] font-bold tracking-widest opacity-30 rotate-90 origin-bottom-right text-gray-500">
                      PROSIC.COM
                    </span>
                  </div>
                  {/* Label */}
                  <div className="p-3">
                    <p className="text-xs font-semibold text-gray-800 leading-snug line-clamp-2">{product.modelo}</p>
                    <button className="mt-2 text-[11px] font-bold text-[#006d77] hover:text-[#33e989] transition-colors">
                      Solicitar cotización →
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* List view */}
          {!isLoading && viewMode === 'list' && (
            <div className="space-y-3">
              {filtered.map((product, idx) => (
                <div
                  key={product.id_equipo + idx}
                  className="bg-white border border-gray-200 rounded-xl flex items-center gap-4 p-3 hover:shadow-md hover:border-[#006d77]/30 transition-all cursor-pointer"
                  onClick={() => { setCotizadorEquipo({ modelo: product.modelo, tipo: product.tipo ?? null }); setShowCotizador(true); }}
                >
                  <div className="h-20 w-20 flex-shrink-0 bg-gray-50 rounded-lg overflow-hidden">
                    <img
                      src={equipImg(product.tipo, product.modelo, idx)}
                      alt={product.modelo}
                      className="w-full h-full object-contain p-2"
                      onError={e => { (e.target as HTMLImageElement).src = 'https://images.unsplash.com/photo-1504328345606-18bbc8c9d7d1?w=400&q=60'; }}
                    />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-gray-900">{product.modelo}</p>
                    <p className="text-xs text-gray-500 mt-0.5">{product.tipo ?? 'Equipo industrial'}</p>
                  </div>
                  <button className="flex-shrink-0 px-4 py-2 rounded-lg text-sm font-bold text-white transition-opacity hover:opacity-90" style={{ background: '#006d77' }}>
                    Cotizar
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Empty state */}
          {!isLoading && filtered.length === 0 && (
            <div className="text-center py-20 text-gray-400">
              <p className="text-lg font-semibold">Sin resultados</p>
              <p className="text-sm mt-1">Prueba con otro término o categoría</p>
            </div>
          )}
        </div>
      </div>

      {/* ── Cotizador modal ────────────────────────────────────────────────── */}
      {showCotizador && (
        <CotizadorModal
          equipo={cotizadorEquipo}
          onClose={() => setShowCotizador(false)}
        />
      )}
    </div>
  );
}
