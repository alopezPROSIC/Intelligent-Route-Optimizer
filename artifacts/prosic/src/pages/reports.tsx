import { useState } from 'react';
import {
  useGetKpis,
  useGetDelayReport,
  useGetCostReport,
  useGetDriverProductivity,
} from '@workspace/api-client-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Loader as Loader2, TrendingUp, TrendingDown, Minus, Award, Star } from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  LineChart, Line, AreaChart, Area, PieChart, Pie, Cell,
} from 'recharts';

const CHART_COLORS = [
  'hsl(var(--chart-1))',
  'hsl(var(--chart-2))',
  'hsl(var(--chart-3))',
  'hsl(var(--chart-4))',
  'hsl(var(--chart-5))',
];

type KpiPeriod = 'hoy' | 'semana' | 'mes' | 'trimestre';
type CostPeriod = 'mes' | 'trimestre' | 'anio';
type ProductivityPeriod = 'semana' | 'mes' | 'trimestre';

function KpiCard({
  label,
  value,
  sub,
  trend,
  color = 'default',
}: {
  label: string;
  value: string | number;
  sub?: string;
  trend?: 'up' | 'down' | 'neutral';
  color?: 'default' | 'success' | 'danger' | 'accent';
}) {
  const TrendIcon = trend === 'up' ? TrendingUp : trend === 'down' ? TrendingDown : Minus;
  const trendColor =
    trend === 'up' ? 'text-green-600' : trend === 'down' ? 'text-destructive' : 'text-muted-foreground';

  const borderColors: Record<string, string> = {
    default: 'border-l-primary',
    success: 'border-l-green-500',
    danger: 'border-l-destructive',
    accent: 'border-l-accent',
  };

  return (
    <Card className={`border-l-4 ${borderColors[color]} shadow-sm`}>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">{label}</CardTitle>
        {trend && <TrendIcon className={`h-4 w-4 ${trendColor}`} />}
      </CardHeader>
      <CardContent>
        <div className="text-3xl font-black text-foreground">{value}</div>
        {sub && <p className="text-xs text-muted-foreground mt-1">{sub}</p>}
      </CardContent>
    </Card>
  );
}

function OverviewTab({ period }: { period: KpiPeriod }) {
  const { data: kpis, isLoading } = useGetKpis({ periodo: period });

  if (isLoading) {
    return (
      <div className="flex h-40 items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const cumplimiento = kpis?.tasa_cumplimiento ?? 0;
  const cumplimientoTrend = cumplimiento >= 85 ? 'up' : cumplimiento >= 70 ? 'neutral' : 'down';

  const completadosVsPendientes = [
    { name: 'Completados', value: kpis?.servicios_completados ?? 0 },
    { name: 'Pendientes', value: kpis?.servicios_pendientes ?? 0 },
    { name: 'Otros', value: Math.max(0, (kpis?.total_servicios ?? 0) - (kpis?.servicios_completados ?? 0) - (kpis?.servicios_pendientes ?? 0)) },
  ];

  const localVsForaneo = [
    { name: 'Local', value: kpis?.servicios_locales ?? 0 },
    { name: 'Foráneo', value: kpis?.servicios_foraneos ?? 0 },
  ];

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <KpiCard
          label="Total Servicios"
          value={(kpis?.total_servicios ?? 0).toLocaleString()}
          sub={`Local: ${kpis?.servicios_locales ?? 0} · Foráneo: ${kpis?.servicios_foraneos ?? 0}`}
          color="default"
        />
        <KpiCard
          label="Tasa Cumplimiento"
          value={`${cumplimiento.toFixed(1)}%`}
          sub={`${kpis?.servicios_completados ?? 0} de ${kpis?.total_servicios ?? 0} servicios`}
          trend={cumplimientoTrend}
          color={cumplimientoTrend === 'up' ? 'success' : 'danger'}
        />
        <KpiCard
          label="Retraso Promedio"
          value={`${(kpis?.horas_retraso_promedio ?? 0).toFixed(1)} hrs`}
          sub="Por servicio con retraso"
          trend={(kpis?.horas_retraso_promedio ?? 0) <= 1 ? 'up' : 'down'}
          color={(kpis?.horas_retraso_promedio ?? 0) <= 1 ? 'success' : 'danger'}
        />
        <KpiCard
          label="Diferencia Neta"
          value={`$${((kpis?.diferencia_neta ?? 0)).toLocaleString()}`}
          sub="Ingreso − Costo fletes"
          trend={(kpis?.diferencia_neta ?? 0) >= 0 ? 'up' : 'down'}
          color={(kpis?.diferencia_neta ?? 0) >= 0 ? 'success' : 'danger'}
        />
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <KpiCard
          label="Ingresos Logística"
          value={`$${(kpis?.ingreso_total ?? 0).toLocaleString()}`}
          sub="Por remisiones"
          color="accent"
        />
        <KpiCard
          label="Costo Total Fletes"
          value={`$${(kpis?.costo_total_fletes ?? 0).toLocaleString()}`}
          sub="Propio + Externo"
        />
        <KpiCard
          label="Conductores Activos"
          value={kpis?.conductores_activos ?? 0}
          sub="En el período"
        />
        <KpiCard
          label="Cotizaciones Aceptadas"
          value={kpis?.cotizaciones_aceptadas ?? 0}
          sub={`De ${kpis?.cotizaciones_enviadas ?? 0} enviadas`}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="border-border/50 shadow-sm">
          <CardHeader>
            <CardTitle className="text-base">Distribución de Servicios</CardTitle>
            <CardDescription>Completados vs Pendientes</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-[220px]">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={completadosVsPendientes}
                    cx="50%"
                    cy="50%"
                    innerRadius={55}
                    outerRadius={90}
                    paddingAngle={3}
                    dataKey="value"
                    label={({ name, value }) => value > 0 ? `${name}: ${value}` : ''}
                    labelLine={false}
                  >
                    {completadosVsPendientes.map((_, idx) => (
                      <Cell key={idx} fill={CHART_COLORS[idx % CHART_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(v) => [v, 'Servicios']} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <Card className="border-border/50 shadow-sm">
          <CardHeader>
            <CardTitle className="text-base">Local vs Foráneo</CardTitle>
            <CardDescription>Tipo de servicio</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-[220px]">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={localVsForaneo}
                    cx="50%"
                    cy="50%"
                    innerRadius={55}
                    outerRadius={90}
                    paddingAngle={3}
                    dataKey="value"
                    label={({ name, value }) => value > 0 ? `${name}: ${value}` : ''}
                    labelLine={false}
                  >
                    <Cell fill="hsl(var(--chart-1))" />
                    <Cell fill="hsl(var(--chart-3))" />
                  </Pie>
                  <Tooltip formatter={(v) => [v, 'Servicios']} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function CostsTab({ period, setCostPeriod }: { period: CostPeriod; setCostPeriod: (v: CostPeriod) => void }) {
  const { data: costData, isLoading } = useGetCostReport({ periodo: period });

  if (isLoading) {
    return (
      <div className="flex h-40 items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const monthlyData = costData?.por_mes ?? [];

  return (
    <div className="space-y-6">
      <div className="flex justify-end">
        <Select value={period} onValueChange={(v) => setCostPeriod(v as CostPeriod)}>
          <SelectTrigger className="w-[160px] bg-background">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="mes">Este Mes</SelectItem>
            <SelectItem value="trimestre">Trimestre</SelectItem>
            <SelectItem value="anio">Año</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <KpiCard
          label="Ingreso Remisiones"
          value={`$${(costData?.ingreso_remisiones ?? 0).toLocaleString()}`}
          color="success"
        />
        <KpiCard
          label="Flete Propio"
          value={`$${(costData?.costo_flete_propio ?? 0).toLocaleString()}`}
        />
        <KpiCard
          label="Flete Externo"
          value={`$${(costData?.costo_flete_externo ?? 0).toLocaleString()}`}
        />
        <KpiCard
          label="Diferencia Neta"
          value={`$${(costData?.diferencia_neta ?? 0).toLocaleString()}`}
          color={(costData?.diferencia_neta ?? 0) >= 0 ? 'success' : 'danger'}
          trend={(costData?.diferencia_neta ?? 0) >= 0 ? 'up' : 'down'}
        />
      </div>

      <Card className="border-border/50 shadow-sm">
        <CardHeader>
          <CardTitle className="text-base">Costos vs Ingresos por Mes</CardTitle>
          <CardDescription>Evolución financiera mensual</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="h-[320px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={monthlyData} margin={{ top: 10, right: 20, left: 20, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                <XAxis dataKey="mes" stroke="hsl(var(--muted-foreground))" fontSize={11} tickLine={false} axisLine={false} />
                <YAxis stroke="hsl(var(--muted-foreground))" fontSize={11} tickLine={false} axisLine={false} tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`} />
                <Tooltip
                  cursor={{ fill: 'hsl(var(--muted))' }}
                  contentStyle={{ borderRadius: '8px', border: '1px solid hsl(var(--border))', background: 'hsl(var(--background))' }}
                  formatter={(v: number) => [`$${v.toLocaleString()}`, '']}
                />
                <Legend />
                <Bar dataKey="ingreso" name="Ingreso" fill={CHART_COLORS[0]} radius={[4, 4, 0, 0]} />
                <Bar dataKey="costo" name="Costo Flete" fill={CHART_COLORS[1]} radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      <Card className="border-border/50 shadow-sm">
        <CardHeader>
          <CardTitle className="text-base">Diferencia Neta por Mes</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-[240px]">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={monthlyData} margin={{ top: 10, right: 20, left: 20, bottom: 5 }}>
                <defs>
                  <linearGradient id="gradDiff" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={CHART_COLORS[2]} stopOpacity={0.3} />
                    <stop offset="95%" stopColor={CHART_COLORS[2]} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                <XAxis dataKey="mes" stroke="hsl(var(--muted-foreground))" fontSize={11} tickLine={false} axisLine={false} />
                <YAxis stroke="hsl(var(--muted-foreground))" fontSize={11} tickLine={false} axisLine={false} tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`} />
                <Tooltip
                  contentStyle={{ borderRadius: '8px', border: '1px solid hsl(var(--border))', background: 'hsl(var(--background))' }}
                  formatter={(v: number) => [`$${v.toLocaleString()}`, 'Diferencia']}
                />
                <Area type="monotone" dataKey="diferencia" stroke={CHART_COLORS[2]} fill="url(#gradDiff)" strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function DelaysTab() {
  const { data: delayData, isLoading } = useGetDelayReport();

  if (isLoading) {
    return (
      <div className="flex h-40 items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const rows = Array.isArray(delayData) ? delayData : (delayData ? [delayData] : []);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <KpiCard
          label="Sucursales con Datos"
          value={rows.length}
          color="default"
        />
        <KpiCard
          label="Total Servicios (suma)"
          value={(rows.reduce((s, r) => s + (r.total_servicios ?? 0), 0)).toLocaleString()}
          color="default"
        />
        <KpiCard
          label="Servicios con Retraso"
          value={(rows.reduce((s, r) => s + (r.con_retraso ?? 0), 0)).toLocaleString()}
          color="danger"
        />
      </div>

      <Card className="border-border/50 shadow-sm">
        <CardHeader>
          <CardTitle className="text-base">Servicios con Retraso por Sucursal</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-[280px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={rows} layout="vertical" margin={{ top: 5, right: 30, left: 80, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="hsl(var(--border))" />
                <XAxis type="number" stroke="hsl(var(--muted-foreground))" fontSize={11} tickLine={false} axisLine={false} />
                <YAxis type="category" dataKey="sucursal" stroke="hsl(var(--muted-foreground))" fontSize={11} tickLine={false} axisLine={false} />
                <Tooltip
                  cursor={{ fill: 'hsl(var(--muted))' }}
                  contentStyle={{ borderRadius: '8px', border: '1px solid hsl(var(--border))', background: 'hsl(var(--background))' }}
                />
                <Legend />
                <Bar dataKey="total_servicios" name="Total Servicios" fill={CHART_COLORS[0]} radius={[0, 4, 4, 0]} />
                <Bar dataKey="con_retraso" name="Con Retraso" fill="hsl(var(--destructive))" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      <Card className="border-border/50 shadow-sm overflow-hidden">
        <CardHeader className="bg-muted/30 border-b">
          <CardTitle className="text-base">Detalle por Sucursal</CardTitle>
        </CardHeader>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/20">
                <th className="text-left p-3 font-semibold text-muted-foreground">Sucursal</th>
                <th className="text-right p-3 font-semibold text-muted-foreground">Total</th>
                <th className="text-right p-3 font-semibold text-muted-foreground">Con Retraso</th>
                <th className="text-right p-3 font-semibold text-muted-foreground">% Retraso</th>
                <th className="text-right p-3 font-semibold text-muted-foreground">Hrs Promedio</th>
                <th className="text-right p-3 font-semibold text-muted-foreground">Peor Retraso</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row, i) => {
                const pct = row.total_servicios ? ((row.con_retraso ?? 0) / row.total_servicios) * 100 : 0;
                return (
                  <tr key={i} className="border-b hover:bg-muted/20 transition-colors">
                    <td className="p-3 font-medium">{row.sucursal ?? 'Sin Sucursal'}</td>
                    <td className="p-3 text-right">{row.total_servicios ?? 0}</td>
                    <td className="p-3 text-right">
                      <span className={`font-bold ${(row.con_retraso ?? 0) > 0 ? 'text-destructive' : 'text-green-600'}`}>
                        {row.con_retraso ?? 0}
                      </span>
                    </td>
                    <td className="p-3 text-right">
                      <Badge variant={pct > 20 ? 'destructive' : pct > 10 ? 'secondary' : 'outline'} className="text-xs">
                        {pct.toFixed(1)}%
                      </Badge>
                    </td>
                    <td className="p-3 text-right">{(row.horas_retraso_promedio ?? 0).toFixed(1)} h</td>
                    <td className="p-3 text-right">{(row.peor_retraso_hrs ?? 0).toFixed(1)} h</td>
                  </tr>
                );
              })}
              {rows.length === 0 && (
                <tr>
                  <td colSpan={6} className="p-8 text-center text-muted-foreground">Sin datos de retrasos</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}

function ProductivityTab({ period, setPeriod }: { period: ProductivityPeriod; setPeriod: (v: ProductivityPeriod) => void }) {
  const { data: drivers, isLoading } = useGetDriverProductivity({ periodo: period });

  if (isLoading) {
    return (
      <div className="flex h-40 items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const sorted = [...(drivers ?? [])].sort((a, b) => (b.calificacion ?? 0) - (a.calificacion ?? 0));
  const chartData = sorted.slice(0, 10).map(d => ({
    nombre: d.nombre ?? 'N/A',
    servicios: d.total_servicios ?? 0,
    puntual: d.servicios_puntual ?? 0,
    km: Math.round(d.km_recorridos ?? 0),
  }));

  return (
    <div className="space-y-6">
      <div className="flex justify-end">
        <Select value={period} onValueChange={(v) => setPeriod(v as ProductivityPeriod)}>
          <SelectTrigger className="w-[160px] bg-background">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="semana">Semana</SelectItem>
            <SelectItem value="mes">Mes</SelectItem>
            <SelectItem value="trimestre">Trimestre</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <Card className="border-border/50 shadow-sm">
        <CardHeader>
          <CardTitle className="text-base">Servicios por Conductor</CardTitle>
          <CardDescription>Puntuales vs con retraso (Top 10)</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} layout="vertical" margin={{ top: 5, right: 30, left: 100, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="hsl(var(--border))" />
                <XAxis type="number" stroke="hsl(var(--muted-foreground))" fontSize={11} tickLine={false} axisLine={false} />
                <YAxis type="category" dataKey="nombre" stroke="hsl(var(--muted-foreground))" fontSize={11} tickLine={false} axisLine={false} width={95} />
                <Tooltip
                  cursor={{ fill: 'hsl(var(--muted))' }}
                  contentStyle={{ borderRadius: '8px', border: '1px solid hsl(var(--border))', background: 'hsl(var(--background))' }}
                />
                <Legend />
                <Bar dataKey="servicios" name="Total" fill={CHART_COLORS[0]} radius={[0, 4, 4, 0]} />
                <Bar dataKey="puntual" name="Puntual" fill={CHART_COLORS[1]} radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      <Card className="border-border/50 shadow-sm overflow-hidden">
        <CardHeader className="bg-muted/30 border-b">
          <CardTitle className="text-base flex items-center gap-2">
            <Award className="h-4 w-4 text-primary" /> Ranking de Conductores
          </CardTitle>
        </CardHeader>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/20">
                <th className="text-left p-3 font-semibold text-muted-foreground">#</th>
                <th className="text-left p-3 font-semibold text-muted-foreground">Conductor</th>
                <th className="text-left p-3 font-semibold text-muted-foreground">Tipo</th>
                <th className="text-right p-3 font-semibold text-muted-foreground">Servicios</th>
                <th className="text-right p-3 font-semibold text-muted-foreground">Puntuales</th>
                <th className="text-right p-3 font-semibold text-muted-foreground">KMs</th>
                <th className="text-right p-3 font-semibold text-muted-foreground">Hrs Retraso</th>
                <th className="text-right p-3 font-semibold text-muted-foreground">Calificación</th>
              </tr>
            </thead>
            <tbody>
              {sorted.map((d, i) => {
                const cal = d.calificacion ?? 0;
                const calColor = cal >= 4.5 ? 'text-green-600' : cal >= 3.5 ? 'text-yellow-600' : 'text-destructive';
                return (
                  <tr key={d.conductor_id ?? i} className="border-b hover:bg-muted/20 transition-colors">
                    <td className="p-3">
                      {i === 0 ? <Star className="h-4 w-4 text-yellow-500 fill-yellow-400" /> : <span className="text-muted-foreground">{i + 1}</span>}
                    </td>
                    <td className="p-3 font-bold">{d.nombre ?? '–'}</td>
                    <td className="p-3">
                      <Badge variant={d.tipo === 'PROPIO' ? 'default' : 'outline'} className="text-xs">{d.tipo ?? '–'}</Badge>
                    </td>
                    <td className="p-3 text-right font-medium">{d.total_servicios ?? 0}</td>
                    <td className="p-3 text-right">
                      <span className="text-green-600 font-medium">{d.servicios_puntual ?? 0}</span>
                    </td>
                    <td className="p-3 text-right">{(d.km_recorridos ?? 0).toFixed(0)}</td>
                    <td className="p-3 text-right">
                      <span className={(d.horas_retraso_total ?? 0) > 0 ? 'text-destructive' : 'text-green-600'}>
                        {(d.horas_retraso_total ?? 0).toFixed(1)} h
                      </span>
                    </td>
                    <td className="p-3 text-right">
                      <span className={`font-black text-base ${calColor}`}>{cal.toFixed(1)}</span>
                      <span className="text-muted-foreground text-xs ml-0.5">/5</span>
                    </td>
                  </tr>
                );
              })}
              {sorted.length === 0 && (
                <tr>
                  <td colSpan={8} className="p-8 text-center text-muted-foreground">Sin datos de conductores</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}

export default function Reports() {
  const [kpiPeriod, setKpiPeriod] = useState<KpiPeriod>('mes');
  const [costPeriod, setCostPeriod] = useState<CostPeriod>('mes');
  const [productivityPeriod, setProductivityPeriod] = useState<ProductivityPeriod>('mes');

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-black tracking-tight">Reportes Analíticos</h1>
          <p className="text-muted-foreground">KPIs, costos, retrasos y productividad de la operación logística.</p>
        </div>
        <Select value={kpiPeriod} onValueChange={(v) => setKpiPeriod(v as KpiPeriod)}>
          <SelectTrigger className="w-[180px] bg-background">
            <SelectValue placeholder="Período global" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="hoy">Hoy</SelectItem>
            <SelectItem value="semana">Última Semana</SelectItem>
            <SelectItem value="mes">Este Mes</SelectItem>
            <SelectItem value="trimestre">Este Trimestre</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <Tabs defaultValue="overview" className="w-full">
        <TabsList className="w-full justify-start border-b rounded-none h-auto p-0 bg-transparent gap-4 mb-6">
          {[
            { value: 'overview', label: 'Resumen KPIs' },
            { value: 'costos', label: 'Costos e Ingresos' },
            { value: 'retrasos', label: 'Retrasos' },
            { value: 'productividad', label: 'Productividad' },
          ].map(tab => (
            <TabsTrigger
              key={tab.value}
              value={tab.value}
              className="data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none px-4 py-3"
            >
              {tab.label}
            </TabsTrigger>
          ))}
        </TabsList>

        <TabsContent value="overview">
          <OverviewTab period={kpiPeriod} />
        </TabsContent>
        <TabsContent value="costos">
          <CostsTab period={costPeriod} setCostPeriod={setCostPeriod} />
        </TabsContent>
        <TabsContent value="retrasos">
          <DelaysTab />
        </TabsContent>
        <TabsContent value="productividad">
          <ProductivityTab period={productivityPeriod} setPeriod={setProductivityPeriod} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
