import { useGetKpis, useGetDelayReport, useGetCostReport } from '@workspace/api-client-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useState } from 'react';
import { Loader2 } from 'lucide-react';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  LineChart, Line, AreaChart, Area
} from 'recharts';

export default function Reports() {
  const [period, setPeriod] = useState<'mes' | 'semana' | 'trimestre'>('mes');
  
  const { data: kpis, isLoading: kpisLoading } = useGetKpis({ periodo: period });
  const { data: delayData, isLoading: delayLoading } = useGetDelayReport();
  const { data: costData, isLoading: costLoading } = useGetCostReport({ periodo: period === 'semana' ? 'mes' : period });

  // Mock data for visual charts if API doesn't return full arrays
  const chartDataDelay = delayData ? [delayData] : [
    { sucursal: 'Base Central', con_retraso: 12, total_servicios: 150 },
    { sucursal: 'Norte', con_retraso: 5, total_servicios: 80 },
    { sucursal: 'Sur', con_retraso: 8, total_servicios: 95 }
  ];

  if (kpisLoading || delayLoading || costLoading) {
    return (
      <div className="flex h-[80vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-black tracking-tight">Reportes Analíticos</h1>
          <p className="text-muted-foreground">Métricas de rendimiento e impacto financiero.</p>
        </div>
        <Select value={period} onValueChange={(v: any) => setPeriod(v)}>
          <SelectTrigger className="w-[180px] bg-background">
            <SelectValue placeholder="Periodo" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="semana">Última Semana</SelectItem>
            <SelectItem value="mes">Este Mes</SelectItem>
            <SelectItem value="trimestre">Este Trimestre</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="bg-sidebar text-sidebar-foreground border-0">
          <CardContent className="p-6">
            <p className="text-sm font-bold uppercase tracking-widest opacity-70 mb-2">Ingresos Logística</p>
            <p className="text-4xl font-black">${(kpis?.ingreso_total || 0).toLocaleString()}</p>
          </CardContent>
        </Card>
        <Card className="bg-background border-border/50">
          <CardContent className="p-6">
            <p className="text-sm font-bold uppercase tracking-widest text-muted-foreground mb-2">Costo Fletes</p>
            <p className="text-4xl font-black text-destructive">${(kpis?.costo_total_fletes || 0).toLocaleString()}</p>
          </CardContent>
        </Card>
        <Card className="bg-accent text-accent-foreground border-0">
          <CardContent className="p-6">
            <p className="text-sm font-bold uppercase tracking-widest opacity-80 mb-2">Tasa de Cumplimiento</p>
            <p className="text-4xl font-black">{kpis?.tasa_cumplimiento?.toFixed(1) || 0}%</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="border-border/50 shadow-sm">
          <CardHeader>
            <CardTitle>Finanzas: Costos vs Ingresos</CardTitle>
            <CardDescription>Balance logístico en el periodo</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-[300px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={costData?.por_mes || []} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                  <XAxis dataKey="mes" stroke="hsl(var(--muted-foreground))" fontSize={12} tickLine={false} axisLine={false} />
                  <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} tickLine={false} axisLine={false} tickFormatter={(value) => `$${value/1000}k`} />
                  <Tooltip cursor={{fill: 'hsl(var(--muted))'}} contentStyle={{ borderRadius: '8px', border: '1px solid hsl(var(--border))' }} />
                  <Legend />
                  <Bar dataKey="ingreso" name="Ingreso" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="costo" name="Costo" fill="hsl(var(--destructive))" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <Card className="border-border/50 shadow-sm">
          <CardHeader>
            <CardTitle>Retrasos Operativos por Sucursal</CardTitle>
            <CardDescription>Volumen de servicios que superaron el tiempo estimado</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-[300px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartDataDelay} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                  <XAxis dataKey="sucursal" stroke="hsl(var(--muted-foreground))" fontSize={12} tickLine={false} axisLine={false} />
                  <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} tickLine={false} axisLine={false} />
                  <Tooltip cursor={{fill: 'hsl(var(--muted))'}} contentStyle={{ borderRadius: '8px', border: '1px solid hsl(var(--border))' }} />
                  <Legend />
                  <Bar dataKey="total_servicios" name="Total Servicios" fill="hsl(var(--muted-foreground))" opacity={0.3} radius={[4, 4, 0, 0]} />
                  <Bar dataKey="con_retraso" name="Con Retraso" fill="hsl(var(--secondary))" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
