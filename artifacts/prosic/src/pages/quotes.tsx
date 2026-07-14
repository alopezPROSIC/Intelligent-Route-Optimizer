import { useState } from 'react';
import { useListQuotes, QuoteEstatus } from '@workspace/api-client-react';
import { Card, CardContent } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Search, FileText, Download, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { format } from 'date-fns';

export default function Quotes() {
  const [estatusFilter, setEstatusFilter] = useState<string>('ALL');
  
  const queryParams = estatusFilter !== 'ALL' 
    ? { estatus: estatusFilter as typeof QuoteEstatus[keyof typeof QuoteEstatus] } 
    : undefined;
    
  const { data: quotes, isLoading } = useListQuotes(queryParams);

  const getEstatusBadge = (estatus: string) => {
    switch(estatus) {
      case 'BORRADOR': return <Badge variant="outline">Borrador</Badge>;
      case 'ENVIADA': return <Badge variant="secondary" className="bg-blue-100 text-blue-800 hover:bg-blue-100">Enviada</Badge>;
      case 'ACEPTADA': return <Badge variant="default" className="bg-green-600 hover:bg-green-700">Aceptada</Badge>;
      case 'RECHAZADA': return <Badge variant="destructive">Rechazada</Badge>;
      case 'EXPIRADA': return <Badge variant="outline" className="text-muted-foreground border-muted-foreground/30">Expirada</Badge>;
      default: return <Badge variant="outline">{estatus}</Badge>;
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-black tracking-tight">Cotizaciones</h1>
        <p className="text-muted-foreground">Gestión de cotizaciones solicitadas vía web y manuales.</p>
      </div>

      <Card className="border-border/50 shadow-sm">
        <CardContent className="p-4 flex flex-col sm:flex-row gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Buscar por folio, cliente o RFC..." className="pl-9 bg-background" />
          </div>
          <Select value={estatusFilter} onValueChange={setEstatusFilter}>
            <SelectTrigger className="w-full sm:w-[200px] bg-background">
              <SelectValue placeholder="Filtrar por estatus" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">Todos los estatus</SelectItem>
              {Object.values(QuoteEstatus).map(status => (
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
                  <TableHead className="w-[120px]">Folio</TableHead>
                  <TableHead>Cliente</TableHead>
                  <TableHead>Equipo (Renta)</TableHead>
                  <TableHead>Monto Total</TableHead>
                  <TableHead>Fecha</TableHead>
                  <TableHead>Estatus</TableHead>
                  <TableHead className="text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {quotes?.map((quote) => (
                  <TableRow key={quote.id} className="hover:bg-muted/30 transition-colors">
                    <TableCell className="font-mono font-bold text-primary">
                      {quote.folio || `#${quote.id}`}
                    </TableCell>
                    <TableCell>
                      <div className="font-bold">{quote.nombre_empresa || quote.nombre_contacto || 'Cliente'}</div>
                      {quote.identidad_verificada && (
                        <Badge variant="outline" className="text-[10px] h-4 mt-1 border-green-200 text-green-700 bg-green-50">
                          Identidad Verificada
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="font-medium">{quote.modelo}</div>
                      <div className="text-xs text-muted-foreground">{quote.dias_renta} días • Z: {quote.zona}</div>
                    </TableCell>
                    <TableCell>
                      <div className="font-bold">${quote.monto_total.toLocaleString()}</div>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {quote.created_at ? format(new Date(quote.created_at), 'dd/MM/yyyy') : '-'}
                    </TableCell>
                    <TableCell>
                      {getEstatusBadge(quote.estatus)}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button variant="ghost" size="icon" title="Ver Detalle">
                        <FileText className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" title="Descargar PDF">
                        <Download className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
                
                {quotes?.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-12 text-muted-foreground">
                      <FileText className="h-8 w-8 mx-auto mb-3 opacity-20" />
                      <p>No se encontraron cotizaciones.</p>
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
