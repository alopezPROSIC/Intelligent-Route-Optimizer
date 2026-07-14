import { useState } from 'react';
import {
  useGetSheetsStatus,
  useSyncSheets,
  useImportFromSheets,
} from '@workspace/api-client-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import { FileSpreadsheet, RefreshCw, Download, Upload, CircleCheck as CheckCircle2, CircleAlert as AlertCircle, Loader as Loader2, Link2, Link2Off, ArrowLeftRight, ArrowDownToLine, ArrowUpFromLine, Clock, Table2, TriangleAlert as AlertTriangle, Info, Zap } from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { cn } from '@/lib/utils';

// ─── Sheet catalog from the JSON spec ────────────────────────────────────────
const SHEET_CATALOG = [
  { name: 'REPORTE', type: 'input', description: 'Hoja principal de servicios ingresados por usuarios' },
  { name: 'CLIENTES', type: 'master', description: 'Catálogo maestro de clientes y obras' },
  { name: 'equipos', type: 'master', description: 'Catálogo de equipos con tipo' },
  { name: 'vehiculos', type: 'master', description: 'Catálogo de vehículos de transporte' },
  { name: 'conductores_proveedores', type: 'master', description: 'Conductores propios y proveedores externos' },
  { name: 'servicios', type: 'normalized', description: 'Hoja normalizada de servicios (auto-generada)' },
];

const SHEET_TYPE_COLORS: Record<string, string> = {
  input:      'bg-blue-100 text-blue-800 border-blue-200',
  master:     'bg-green-100 text-green-800 border-green-200',
  normalized: 'bg-amber-100 text-amber-800 border-amber-200',
  auxiliary:  'bg-muted text-muted-foreground',
};

// ─── History store (in-memory for session) ───────────────────────────────────
type HistoryEntry = {
  ts: Date;
  type: 'sync' | 'import' | 'export';
  label: string;
  imported?: number;
  exported?: number;
  errors?: string[];
  ok: boolean;
};

const historyStore: HistoryEntry[] = [];

// ─── Status indicator ─────────────────────────────────────────────────────────
function ConnectionBadge({ connected }: { connected?: boolean }) {
  return connected ? (
    <div className="flex items-center gap-1.5 text-green-700 bg-green-50 border border-green-200 px-3 py-1 rounded-full text-sm font-bold">
      <CheckCircle2 className="h-3.5 w-3.5" />
      Conectado
    </div>
  ) : (
    <div className="flex items-center gap-1.5 text-destructive bg-destructive/10 border border-destructive/20 px-3 py-1 rounded-full text-sm font-bold">
      <AlertCircle className="h-3.5 w-3.5" />
      Desconectado
    </div>
  );
}

// ─── Operation card ───────────────────────────────────────────────────────────
function OpCard({
  icon: Icon,
  title,
  description,
  buttonLabel,
  buttonVariant = 'default',
  onExecute,
  loading,
  disabled,
  accentClass,
  note,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  description: string;
  buttonLabel: string;
  buttonVariant?: 'default' | 'outline' | 'secondary';
  onExecute: () => void;
  loading: boolean;
  disabled: boolean;
  accentClass?: string;
  note?: string;
}) {
  return (
    <Card className="border-border/50 shadow-sm flex flex-col">
      <CardContent className="p-5 flex flex-col gap-4 flex-1">
        <div className={cn('h-12 w-12 rounded-xl flex items-center justify-center', accentClass ?? 'bg-muted/50')}>
          <Icon className="h-6 w-6" />
        </div>
        <div className="flex-1">
          <h3 className="font-bold text-foreground">{title}</h3>
          <p className="text-sm text-muted-foreground mt-1 leading-snug">{description}</p>
          {note && (
            <p className="text-xs text-muted-foreground/60 mt-2 italic flex items-center gap-1">
              <Info className="h-3 w-3 shrink-0" />
              {note}
            </p>
          )}
        </div>
        <Button
          variant={buttonVariant}
          className="w-full"
          onClick={onExecute}
          disabled={disabled || loading}
        >
          {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
          {buttonLabel}
        </Button>
      </CardContent>
    </Card>
  );
}

// ─── History row ──────────────────────────────────────────────────────────────
function HistoryRow({ entry }: { entry: HistoryEntry }) {
  const Icon = entry.type === 'import' ? ArrowDownToLine : entry.type === 'export' ? ArrowUpFromLine : ArrowLeftRight;
  const color = entry.ok ? 'text-green-600' : 'text-destructive';
  const label = entry.type === 'import' ? 'Importación' : entry.type === 'export' ? 'Exportación' : 'Sync bidireccional';

  return (
    <div className="flex items-center gap-3 py-2.5 border-b border-border/50 last:border-0">
      <div className={cn('h-7 w-7 rounded-full flex items-center justify-center shrink-0', entry.ok ? 'bg-green-50' : 'bg-destructive/10')}>
        <Icon className={cn('h-3.5 w-3.5', color)} />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium">{label} — {entry.label}</p>
        <p className="text-xs text-muted-foreground flex items-center gap-1">
          <Clock className="h-3 w-3" />
          {format(entry.ts, "dd/MM HH:mm", { locale: es })}
          {entry.imported != null && ` · ${entry.imported} importados`}
          {entry.exported != null && ` · ${entry.exported} exportados`}
        </p>
        {entry.errors?.map((e, i) => (
          <p key={i} className="text-xs text-destructive mt-0.5">{e}</p>
        ))}
      </div>
      <Badge variant={entry.ok ? 'outline' : 'destructive'} className={cn('text-[10px]', entry.ok ? 'border-green-200 text-green-700 bg-green-50' : '')}>
        {entry.ok ? 'OK' : 'Error'}
      </Badge>
    </div>
  );
}

// ─── Import settings ──────────────────────────────────────────────────────────
function ImportSettings({
  sheet, setSheet,
  desdeRow, setDesdeRow,
  sobrescribir, setSobrescribir,
  availableSheets,
}: {
  sheet: string; setSheet: (s: string) => void;
  desdeRow: number; setDesdeRow: (n: number) => void;
  sobrescribir: boolean; setSobrescribir: (b: boolean) => void;
  availableSheets: string[];
}) {
  const sheets = availableSheets.length > 0 ? availableSheets : SHEET_CATALOG.map(s => s.name);
  return (
    <div className="space-y-4 pt-2">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="space-y-1.5">
          <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Hoja a importar</Label>
          <Select value={sheet} onValueChange={setSheet}>
            <SelectTrigger>
              <SelectValue placeholder="Seleccionar hoja..." />
            </SelectTrigger>
            <SelectContent>
              {sheets.map(s => (
                <SelectItem key={s} value={s}>{s}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Desde fila</Label>
          <Input
            type="number"
            min={1}
            value={desdeRow}
            onChange={e => setDesdeRow(parseInt(e.target.value) || 2)}
            placeholder="2"
          />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Sobrescribir existentes</Label>
          <div className="flex items-center gap-2 mt-2">
            <Switch id="overwrite" checked={sobrescribir} onCheckedChange={setSobrescribir} />
            <label htmlFor="overwrite" className="text-sm cursor-pointer">
              {sobrescribir ? 'Sí, actualizar' : 'Solo nuevos'}
            </label>
          </div>
        </div>
      </div>
      {sobrescribir && (
        <div className="flex items-center gap-2 p-3 bg-amber-50 border border-amber-200 rounded-lg text-sm text-amber-800">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          Los registros existentes serán sobreescritos con los valores de Google Sheets.
        </div>
      )}
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────
export default function Sheets() {
  const [history, setHistory] = useState<HistoryEntry[]>([...historyStore]);
  const [importSheet, setImportSheet] = useState('REPORTE');
  const [desdeRow, setDesdeRow] = useState(2);
  const [sobrescribir, setSobrescribir] = useState(false);
  const [showImportSettings, setShowImportSettings] = useState(false);

  const { data: status, isLoading: statusLoading, refetch: refetchStatus } = useGetSheetsStatus();
  const syncSheets = useSyncSheets();
  const importSheets = useImportFromSheets();

  const connected = status?.conectado ?? false;
  const sheets = status?.hojas_disponibles ?? [];

  const addHistory = (entry: HistoryEntry) => {
    historyStore.unshift(entry);
    setHistory([...historyStore]);
  };

  // ── Sync bidireccional ──
  const handleSync = (direction: 'bidirectional' | 'import' | 'export') => {
    const labels: Record<string, string> = {
      bidirectional: 'Bidireccional',
      import: 'Google Sheets → DB',
      export: 'DB → Google Sheets',
    };
    syncSheets.mutate({ data: { direction } }, {
      onSuccess: (data) => {
        const ok = data.success ?? false;
        const entry: HistoryEntry = {
          ts: new Date(),
          type: direction === 'export' ? 'export' : direction === 'import' ? 'import' : 'sync',
          label: labels[direction],
          imported: data.registros_importados,
          exported: data.registros_exportados,
          errors: data.errores?.length ? data.errores : undefined,
          ok,
        };
        addHistory(entry);
        if (ok) {
          toast.success(`Sincronización ${labels[direction]} completada`, {
            description: `↓ ${data.registros_importados ?? 0} importados · ↑ ${data.registros_exportados ?? 0} exportados`,
          });
        } else {
          toast.error('Sincronización con advertencias', {
            description: data.errores?.join(', ') ?? 'Verifica la configuración',
          });
        }
        refetchStatus();
      },
      onError: () => toast.error('Error al sincronizar con Google Sheets'),
    });
  };

  // ── Import específico ──
  const handleImport = () => {
    importSheets.mutate({ data: { hoja: importSheet, desde_fila: desdeRow, sobrescribir } }, {
      onSuccess: (data) => {
        const ok = data.success ?? false;
        addHistory({
          ts: new Date(),
          type: 'import',
          label: importSheet,
          imported: data.importados,
          errors: data.errores?.length ? data.errores : undefined,
          ok,
        });
        if (ok) {
          toast.success(`Importación completada — hoja "${importSheet}"`, {
            description: `${data.importados}/${data.total_filas} filas importadas · ${data.omitidos} omitidas`,
          });
        } else {
          toast.error('Importación con errores', {
            description: data.errores?.join(', '),
          });
        }
        refetchStatus();
      },
      onError: () => toast.error('Error en la importación'),
    });
  };

  const anyMutating = syncSheets.isPending || importSheets.isPending;

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      {/* ── Header ── */}
      <div>
        <h1 className="text-3xl font-black tracking-tight">Google Sheets</h1>
        <p className="text-muted-foreground">Sincronización bidireccional con la hoja maestra PROSIC OPERACIONES.</p>
      </div>

      {/* ── Connection status card ── */}
      <Card className="overflow-hidden border-border/50 shadow-sm">
        <div className={cn('h-1.5 w-full', connected ? 'bg-green-500' : 'bg-destructive')} />
        <CardHeader className="pb-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-start gap-3">
              <div className={cn('h-12 w-12 rounded-xl flex items-center justify-center shrink-0', connected ? 'bg-green-50' : 'bg-destructive/10')}>
                {connected ? (
                  <Link2 className="h-6 w-6 text-green-600" />
                ) : (
                  <Link2Off className="h-6 w-6 text-destructive" />
                )}
              </div>
              <div>
                <CardTitle className="flex items-center gap-2">
                  {status?.spreadsheet_name ?? 'Google Sheets'}
                  {statusLoading && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
                </CardTitle>
                <CardDescription className="mt-0.5">
                  {connected
                    ? `ID: ${status?.spreadsheet_id ?? '—'}`
                    : 'Configura las credenciales de API para conectar tu Google Sheet.'}
                </CardDescription>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <ConnectionBadge connected={connected} />
              <Button variant="outline" size="sm" onClick={() => refetchStatus()} disabled={statusLoading}>
                <RefreshCw className={cn('h-4 w-4', statusLoading && 'animate-spin')} />
              </Button>
            </div>
          </div>
        </CardHeader>

        {connected && (
          <CardContent className="border-t border-border/50 pt-4 pb-5">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 text-center">
              <div>
                <p className="text-2xl font-black text-foreground">{sheets.length}</p>
                <p className="text-xs text-muted-foreground">Hojas disponibles</p>
              </div>
              <div>
                <p className="text-2xl font-black text-foreground">
                  {status?.ultima_sincronizacion
                    ? format(new Date(status.ultima_sincronizacion), 'dd/MM HH:mm', { locale: es })
                    : '—'}
                </p>
                <p className="text-xs text-muted-foreground">Última sincronización</p>
              </div>
              <div>
                <p className="text-2xl font-black text-primary">Activo</p>
                <p className="text-xs text-muted-foreground">Estado de la conexión</p>
              </div>
            </div>
          </CardContent>
        )}

        {!connected && (
          <CardContent className="border-t border-border/50 pt-4 pb-5 bg-muted/20">
            <div className="flex items-start gap-3 text-sm text-muted-foreground">
              <Info className="h-4 w-4 mt-0.5 shrink-0" />
              <p>
                Para conectar Google Sheets, configura <code className="text-xs bg-muted px-1 rounded">GOOGLE_SHEETS_ID</code> como variable de entorno en el servidor API. También asegúrate de que las credenciales de la cuenta de servicio tengan permisos de edición en el Spreadsheet.
              </p>
            </div>
          </CardContent>
        )}
      </Card>

      {/* ── Operations ── */}
      <div>
        <h2 className="text-sm font-bold uppercase tracking-wider text-muted-foreground mb-3">Operaciones de Sincronización</h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <OpCard
            icon={ArrowLeftRight}
            title="Sync Bidireccional"
            description="Sincroniza cambios recientes entre la plataforma y Google Sheets en ambas direcciones."
            buttonLabel="Ejecutar Sync"
            onExecute={() => handleSync('bidirectional')}
            loading={syncSheets.isPending}
            disabled={!connected || anyMutating}
            accentClass="bg-primary/10 text-primary"
          />
          <OpCard
            icon={ArrowDownToLine}
            title="Importar desde Sheets"
            description="Lee los datos de Google Sheets y los vuelca en la base de datos de PROSIC."
            buttonLabel="Importar"
            buttonVariant="outline"
            onExecute={() => { setShowImportSettings(true); }}
            loading={false}
            disabled={!connected}
            accentClass="bg-green-50 text-green-600"
            note="Incluye configuración avanzada por hoja"
          />
          <OpCard
            icon={ArrowUpFromLine}
            title="Exportar a Sheets"
            description="Envía los datos actuales de PROSIC hacia el Google Sheet maestro."
            buttonLabel="Exportar"
            buttonVariant="secondary"
            onExecute={() => handleSync('export')}
            loading={syncSheets.isPending}
            disabled={!connected || anyMutating}
            accentClass="bg-accent/20 text-accent-foreground"
          />
        </div>
      </div>

      {/* ── Import settings panel ── */}
      {showImportSettings && (
        <Card className="border-primary/20 shadow-sm bg-primary/[0.02]">
          <CardHeader className="pb-3 border-b border-border/50">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base flex items-center gap-2">
                <ArrowDownToLine className="h-4 w-4 text-green-600" />
                Configurar Importación
              </CardTitle>
              <Button variant="ghost" size="sm" onClick={() => setShowImportSettings(false)}>
                Cancelar
              </Button>
            </div>
          </CardHeader>
          <CardContent className="pt-4 pb-5">
            <ImportSettings
              sheet={importSheet} setSheet={setImportSheet}
              desdeRow={desdeRow} setDesdeRow={setDesdeRow}
              sobrescribir={sobrescribir} setSobrescribir={setSobrescribir}
              availableSheets={sheets}
            />
            <div className="flex justify-end gap-2 mt-5">
              <Button variant="outline" onClick={() => setShowImportSettings(false)}>
                Cancelar
              </Button>
              <Button
                onClick={() => { handleImport(); setShowImportSettings(false); }}
                disabled={!connected || importSheets.isPending}
                className="bg-green-600 hover:bg-green-700 text-white"
              >
                {importSheets.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <ArrowDownToLine className="mr-2 h-4 w-4" />}
                Iniciar Importación
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* ── Sheet catalog ── */}
        <Card className="border-border/50 shadow-sm">
          <CardHeader className="pb-3 border-b border-border/50 bg-muted/30">
            <CardTitle className="text-base flex items-center gap-2">
              <Table2 className="h-4 w-4" />
              Catálogo de Hojas
            </CardTitle>
            <CardDescription>Estructura de la hoja maestra PROSIC OPERACIONES</CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            <Accordion type="single" collapsible className="w-full">
              {SHEET_CATALOG.map((sheet) => (
                <AccordionItem key={sheet.name} value={sheet.name} className="border-b border-border/50 last:border-0">
                  <AccordionTrigger className="px-4 py-3 hover:bg-muted/30 transition-colors [&[data-state=open]]:bg-muted/30">
                    <div className="flex items-center gap-2 text-sm">
                      <FileSpreadsheet className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                      <span className="font-bold">{sheet.name}</span>
                      <Badge variant="outline" className={cn('text-[9px] h-4 ml-1', SHEET_TYPE_COLORS[sheet.type] ?? '')}>
                        {sheet.type}
                      </Badge>
                      {sheets.includes(sheet.name) && (
                        <CheckCircle2 className="h-3 w-3 text-green-500 shrink-0" />
                      )}
                    </div>
                  </AccordionTrigger>
                  <AccordionContent className="px-4 pb-3 pt-0">
                    <p className="text-xs text-muted-foreground">{sheet.description}</p>
                    {!connected && (
                      <p className="text-[10px] text-muted-foreground/60 mt-1 italic">Conecta para ver el estado en vivo</p>
                    )}
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          </CardContent>
        </Card>

        {/* ── Activity history ── */}
        <Card className="border-border/50 shadow-sm">
          <CardHeader className="pb-3 border-b border-border/50 bg-muted/30">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-base flex items-center gap-2">
                  <Clock className="h-4 w-4" />
                  Historial de Actividad
                </CardTitle>
                <CardDescription>Registro de sincronizaciones en esta sesión</CardDescription>
              </div>
              {history.length > 0 && (
                <Badge variant="secondary" className="text-xs">{history.length}</Badge>
              )}
            </div>
          </CardHeader>
          <CardContent className="p-4">
            {history.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <Clock className="h-8 w-8 mx-auto mb-2 opacity-20" />
                <p className="text-sm">Sin actividad registrada en esta sesión.</p>
                <p className="text-xs mt-1">Las sincronizaciones ejecutadas aparecerán aquí.</p>
              </div>
            ) : (
              <div className="divide-y divide-border/50">
                {history.map((entry, idx) => (
                  <HistoryRow key={idx} entry={entry} />
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* ── Tips / config guide ── */}
      <Card className="border-border/50 shadow-sm">
        <CardHeader className="pb-3 border-b border-border/50 bg-muted/30">
          <CardTitle className="text-base flex items-center gap-2">
            <Zap className="h-4 w-4 text-amber-500" />
            Configuración y Guía de Uso
          </CardTitle>
        </CardHeader>
        <CardContent className="p-5">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 text-sm">
            <div className="space-y-3">
              <h4 className="font-bold text-foreground">Requisitos</h4>
              <ul className="space-y-2 text-muted-foreground">
                {[
                  'Variable de entorno GOOGLE_SHEETS_ID con el ID del Spreadsheet.',
                  'Cuenta de servicio con rol Editor en el Spreadsheet.',
                  'Archivo credentials.json en el servidor API.',
                  'Hoja REPORTE con la estructura de columnas documentada.',
                ].map((item, i) => (
                  <li key={i} className="flex items-start gap-2">
                    <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground mt-2 shrink-0" />
                    {item}
                  </li>
                ))}
              </ul>
            </div>
            <div className="space-y-3">
              <h4 className="font-bold text-foreground">Flujo Recomendado</h4>
              <ol className="space-y-2 text-muted-foreground list-decimal list-inside">
                {[
                  'Conecta la cuenta de servicio al Spreadsheet.',
                  'Ejecuta una Importación desde REPORTE para cargar datos históricos.',
                  'Usa Sync Bidireccional periódicamente para mantener todo actualizado.',
                  'Configura un trigger onEdit en Google Apps Script para sync automático.',
                ].map((item, i) => (
                  <li key={i}>{item}</li>
                ))}
              </ol>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
