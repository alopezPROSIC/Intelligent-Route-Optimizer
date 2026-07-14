import { useGetSheetsStatus, useSyncSheets, useImportFromSheets } from '@workspace/api-client-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { FileSpreadsheet, RefreshCw, Download, CheckCircle2, AlertCircle, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

export default function Sheets() {
  const { data: status, isLoading, refetch } = useGetSheetsStatus();
  const syncSheets = useSyncSheets();
  const importSheets = useImportFromSheets();

  const handleSync = () => {
    syncSheets.mutate({ data: { direction: 'bidirectional' } }, {
      onSuccess: (data) => {
        toast.success('Sincronización completada', {
          description: `Importados: ${data.registros_importados} | Exportados: ${data.registros_exportados}`
        });
        refetch();
      },
      onError: () => toast.error('Error al sincronizar con Google Sheets')
    });
  };

  const handleImport = () => {
    importSheets.mutate({ data: { sobrescribir: true } }, {
      onSuccess: (data) => {
        toast.success('Importación completada', {
          description: `${data.importados} filas importadas correctamente.`
        });
        refetch();
      },
      onError: () => toast.error('Error en la importación')
    });
  };

  if (isLoading) {
    return (
      <div className="flex h-[80vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <div>
        <h1 className="text-3xl font-black tracking-tight">Google Sheets Sync</h1>
        <p className="text-muted-foreground">Sincroniza catálogos y reportes con tu hoja de cálculo maestra.</p>
      </div>

      <Card className="border-border/50 shadow-sm overflow-hidden">
        <div className={`h-2 w-full ${status?.conectado ? 'bg-green-500' : 'bg-destructive'}`} />
        <CardHeader className="pb-4">
          <div className="flex items-start justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <FileSpreadsheet className={`h-6 w-6 ${status?.conectado ? 'text-green-600' : 'text-destructive'}`} />
                Estado de Conexión
              </CardTitle>
              <CardDescription className="mt-1">
                {status?.conectado 
                  ? `Conectado al documento: ${status.spreadsheet_name || 'PROSIC_Master'}` 
                  : 'Falta configurar credenciales de API en el backend'}
              </CardDescription>
            </div>
            {status?.conectado ? (
              <div className="flex items-center gap-1 text-sm font-bold text-green-700 bg-green-50 px-3 py-1 rounded-full border border-green-200">
                <CheckCircle2 className="h-4 w-4" /> Conectado
              </div>
            ) : (
              <div className="flex items-center gap-1 text-sm font-bold text-destructive bg-destructive/10 px-3 py-1 rounded-full border border-destructive/20">
                <AlertCircle className="h-4 w-4" /> Desconectado
              </div>
            )}
          </div>
        </CardHeader>
        <CardContent className="bg-muted/30 pt-6 border-t border-border/50 space-y-6">
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card className="border-border bg-background shadow-sm">
              <CardContent className="p-4 flex flex-col items-center text-center space-y-4">
                <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center text-primary">
                  <RefreshCw className="h-6 w-6" />
                </div>
                <div>
                  <h3 className="font-bold">Sync Bidireccional</h3>
                  <p className="text-sm text-muted-foreground mt-1">Sincroniza cambios recientes entre la plataforma y Google Sheets.</p>
                </div>
                <Button 
                  className="w-full mt-auto" 
                  onClick={handleSync}
                  disabled={!status?.conectado || syncSheets.isPending}
                >
                  {syncSheets.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                  Ejecutar Sincronización
                </Button>
              </CardContent>
            </Card>

            <Card className="border-border bg-background shadow-sm">
              <CardContent className="p-4 flex flex-col items-center text-center space-y-4">
                <div className="h-12 w-12 rounded-full bg-accent/20 flex items-center justify-center text-accent-foreground">
                  <Download className="h-6 w-6" />
                </div>
                <div>
                  <h3 className="font-bold">Importación Completa</h3>
                  <p className="text-sm text-muted-foreground mt-1">Fuerza la lectura de todos los datos desde Google Sheets hacia la base de datos.</p>
                </div>
                <Button 
                  variant="outline"
                  className="w-full mt-auto border-accent text-accent-foreground hover:bg-accent/10" 
                  onClick={handleImport}
                  disabled={!status?.conectado || importSheets.isPending}
                >
                  {importSheets.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                  Importar Todo
                </Button>
              </CardContent>
            </Card>
          </div>

          {status?.ultima_sincronizacion && (
            <p className="text-sm text-center text-muted-foreground">
              Última sincronización: <span className="font-medium">{new Date(status.ultima_sincronizacion).toLocaleString()}</span>
            </p>
          )}

        </CardContent>
      </Card>
    </div>
  );
}
