import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Settings as SettingsIcon,
  CreditCard,
  FileSpreadsheet,
  CheckCircle2,
  XCircle,
  Loader2,
  Save,
  Eye,
  EyeOff,
  Zap,
  Copy,
  ExternalLink,
} from 'lucide-react';
import { toast } from 'sonner';

const API_BASE = import.meta.env.BASE_URL.replace(/\/$/, '');

type SettingKey =
  | 'stripe_secret_key'
  | 'stripe_publishable_key'
  | 'stripe_webhook_secret'
  | 'google_sheets_id'
  | 'google_service_account_key';

interface SettingsMap {
  [key: string]: { configured: boolean; masked: string | null };
}

function authHeaders(): Record<string, string> {
  const token = localStorage.getItem('prosic_token');
  return token ? { Authorization: `Bearer ${token}` } : {};
}

function StatusPill({ ok }: { ok: boolean }) {
  return ok ? (
    <Badge className="bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 gap-1" data-testid="setting-status-configured">
      <CheckCircle2 className="h-3 w-3" />
      Configurado
    </Badge>
  ) : (
    <Badge className="bg-zinc-500/15 text-zinc-400 border border-zinc-500/30 gap-1" data-testid="setting-status-empty">
      <XCircle className="h-3 w-3" />
      Sin configurar
    </Badge>
  );
}

function SecretField({
  label,
  fieldKey,
  placeholder,
  masked,
  configured,
  onSave,
  saving,
  help,
  multiline = false,
  helpUrl,
}: {
  label: string;
  fieldKey: SettingKey;
  placeholder: string;
  masked: string | null;
  configured: boolean;
  onSave: (key: SettingKey, value: string) => Promise<void>;
  saving: boolean;
  help?: string;
  multiline?: boolean;
  helpUrl?: string;
}) {
  const [value, setValue] = useState('');
  const [reveal, setReveal] = useState(false);

  const save = async () => {
    if (!value.trim()) {
      toast.error('El valor no puede estar vacío.');
      return;
    }
    await onSave(fieldKey, value.trim());
    setValue('');
  };

  return (
    <div className="space-y-2 rounded-lg border border-border/60 bg-card/40 p-4" data-testid={`setting-block-${fieldKey}`}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <Label className="text-sm font-semibold">{label}</Label>
          {help && (
            <p className="text-xs text-muted-foreground mt-1">
              {help}
              {helpUrl && (
                <a href={helpUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 ml-2 text-emerald-400 hover:underline">
                  <ExternalLink className="h-3 w-3" />
                  Docs
                </a>
              )}
            </p>
          )}
        </div>
        <StatusPill ok={configured} />
      </div>

      {configured && masked && (
        <div className="flex items-center gap-2 text-xs text-muted-foreground font-mono bg-background/60 border border-border/40 rounded px-2 py-1" data-testid={`setting-masked-${fieldKey}`}>
          <span className="truncate">{reveal ? masked : masked.replace(/[^\s]/g, '•')}</span>
          <Button size="icon" variant="ghost" className="h-6 w-6 shrink-0" onClick={() => setReveal((r) => !r)} data-testid={`setting-reveal-${fieldKey}`}>
            {reveal ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
          </Button>
        </div>
      )}

      <div className="flex gap-2">
        {multiline ? (
          <Textarea
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder={placeholder}
            className="font-mono text-xs min-h-[120px]"
            data-testid={`setting-input-${fieldKey}`}
          />
        ) : (
          <Input
            type="text"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder={placeholder}
            className="font-mono text-xs"
            data-testid={`setting-input-${fieldKey}`}
          />
        )}
        <Button onClick={save} disabled={saving || !value.trim()} data-testid={`setting-save-${fieldKey}`}>
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
        </Button>
      </div>
    </div>
  );
}

export default function SettingsPage() {
  const [settings, setSettings] = useState<SettingsMap>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testingStripe, setTestingStripe] = useState(false);
  const [testingSheets, setTestingSheets] = useState(false);
  const [stripeResult, setStripeResult] = useState<any>(null);
  const [sheetsResult, setSheetsResult] = useState<any>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await fetch(`${API_BASE}/api/settings`, { headers: authHeaders() });
      const data = await r.json();
      setSettings(data);
    } catch (e: any) {
      toast.error('No se pudieron cargar los ajustes');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const saveSetting = async (key: SettingKey, value: string) => {
    setSaving(true);
    try {
      const r = await fetch(`${API_BASE}/api/settings/${key}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', ...authHeaders() },
        body: JSON.stringify({ value }),
      });
      const data = await r.json();
      if (!r.ok) {
        toast.error(data.message ?? data.error ?? 'Error al guardar');
        return;
      }
      toast.success('Guardado');
      await load();
    } finally {
      setSaving(false);
    }
  };

  const testStripe = async () => {
    setTestingStripe(true);
    setStripeResult(null);
    try {
      const r = await fetch(`${API_BASE}/api/settings/test/stripe`, { method: 'POST', headers: authHeaders() });
      const data = await r.json();
      setStripeResult(data);
      if (data.ok) toast.success('Stripe conectado correctamente');
      else toast.error(`Stripe: ${data.error}`);
    } finally {
      setTestingStripe(false);
    }
  };

  const testSheets = async () => {
    setTestingSheets(true);
    setSheetsResult(null);
    try {
      const r = await fetch(`${API_BASE}/api/settings/test/sheets`, { method: 'POST', headers: authHeaders() });
      const data = await r.json();
      setSheetsResult(data);
      if (data.ok) toast.success(`Sheets conectado: ${data.spreadsheet_name}`);
      else toast.error(`Sheets: ${data.error}`);
    } finally {
      setTestingSheets(false);
    }
  };

  const s = (k: SettingKey) => settings[k] ?? { configured: false, masked: null };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6" data-testid="settings-page">
      <header className="flex items-center gap-3">
        <SettingsIcon className="h-7 w-7 text-primary" />
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Ajustes de integración</h1>
          <p className="text-sm text-muted-foreground">
            Configura tus llaves de Stripe y Google Sheets. Los valores se guardan cifrados en la base de datos y sobrescriben las variables de entorno.
          </p>
        </div>
      </header>

      {/* STRIPE ─────────────────────────────────────────────────────────────── */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <CreditCard className="h-5 w-5 text-purple-400" />
              Stripe – Pagos en línea (MXN)
            </CardTitle>
            <Button
              variant="outline"
              size="sm"
              onClick={testStripe}
              disabled={testingStripe || !s('stripe_secret_key').configured}
              data-testid="test-stripe-btn"
            >
              {testingStripe ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Zap className="h-4 w-4 mr-2" />}
              Probar conexión
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {stripeResult && (
            <div
              className={`rounded-md border p-3 text-xs font-mono ${stripeResult.ok ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-300' : 'border-red-500/40 bg-red-500/10 text-red-300'}`}
              data-testid="stripe-test-result"
            >
              {stripeResult.ok
                ? `✓ Stripe OK — livemode=${stripeResult.livemode} — currencies: ${stripeResult.currencies?.join(', ') ?? 'n/a'}`
                : `✗ ${stripeResult.error}`}
            </div>
          )}
          <SecretField
            label="Secret Key (backend)"
            fieldKey="stripe_secret_key"
            placeholder="sk_test_51ABC..."
            masked={s('stripe_secret_key').masked}
            configured={s('stripe_secret_key').configured}
            onSave={saveSetting}
            saving={saving}
            help="Debe empezar con sk_test_ o sk_live_. Consíguela en Stripe Dashboard → Developers → API keys."
            helpUrl="https://dashboard.stripe.com/test/apikeys"
          />
          <SecretField
            label="Publishable Key (frontend)"
            fieldKey="stripe_publishable_key"
            placeholder="pk_test_51ABC..."
            masked={s('stripe_publishable_key').masked}
            configured={s('stripe_publishable_key').configured}
            onSave={saveSetting}
            saving={saving}
            help="Debe empezar con pk_test_ o pk_live_. Se expone al navegador."
          />
          <SecretField
            label="Webhook Secret (opcional)"
            fieldKey="stripe_webhook_secret"
            placeholder="whsec_..."
            masked={s('stripe_webhook_secret').masked}
            configured={s('stripe_webhook_secret').configured}
            onSave={saveSetting}
            saving={saving}
            help="Para verificar firma de webhooks. Endpoint: POST /api/webhook/stripe"
          />
        </CardContent>
      </Card>

      {/* GOOGLE SHEETS ──────────────────────────────────────────────────────── */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <FileSpreadsheet className="h-5 w-5 text-emerald-400" />
              Google Sheets – Sincronización
            </CardTitle>
            <Button
              variant="outline"
              size="sm"
              onClick={testSheets}
              disabled={testingSheets || !s('google_sheets_id').configured || !s('google_service_account_key').configured}
              data-testid="test-sheets-btn"
            >
              {testingSheets ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Zap className="h-4 w-4 mr-2" />}
              Probar conexión
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {sheetsResult && (
            <div
              className={`rounded-md border p-3 text-xs font-mono ${sheetsResult.ok ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-300' : 'border-red-500/40 bg-red-500/10 text-red-300'}`}
              data-testid="sheets-test-result"
            >
              {sheetsResult.ok ? (
                <>
                  ✓ {sheetsResult.spreadsheet_name} <br />
                  Hojas: {sheetsResult.hojas?.join(', ') ?? 'ninguna'}
                </>
              ) : (
                <>✗ {sheetsResult.error}</>
              )}
            </div>
          )}

          <SecretField
            label="Spreadsheet ID"
            fieldKey="google_sheets_id"
            placeholder="1abc...XYZ (ID en la URL entre /d/ y /edit)"
            masked={s('google_sheets_id').masked}
            configured={s('google_sheets_id').configured}
            onSave={saveSetting}
            saving={saving}
            help="Copia la parte entre /d/ y /edit en la URL de tu hoja de Google Sheets."
          />

          <SecretField
            label="Service Account JSON"
            fieldKey="google_service_account_key"
            placeholder='{"type":"service_account","project_id":"...","private_key":"..."}'
            masked={s('google_service_account_key').masked}
            configured={s('google_service_account_key').configured}
            onSave={saveSetting}
            saving={saving}
            multiline
            help='Pega el JSON completo o codificado en base64. Recuerda compartir la hoja con el "client_email" del service account con permisos de editor.'
            helpUrl="https://cloud.google.com/iam/docs/service-account-overview"
          />

          <div className="mt-4 rounded-md border border-emerald-500/30 bg-emerald-500/5 p-3 text-xs text-emerald-200/80">
            <p className="font-semibold text-emerald-300 mb-1">Cómo obtener tu Service Account:</p>
            <ol className="list-decimal ml-5 space-y-1">
              <li>Ve a Google Cloud Console → IAM & Admin → Service Accounts.</li>
              <li>Crea una cuenta de servicio y genera una llave JSON.</li>
              <li>Copia el <code>client_email</code> del JSON.</li>
              <li>En tu hoja de Sheets, comparte con ese email como <b>Editor</b>.</li>
              <li>Pega el JSON completo aquí y guarda.</li>
            </ol>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
