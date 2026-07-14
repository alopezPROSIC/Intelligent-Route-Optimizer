import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { 
  useListPostalZones, 
  useValidateIdentity, 
  useCreateQuote, 
  QuoteRequestTipoPersona,
  IdentityValidationRequestTipoPersona
} from '@workspace/api-client-react';
import { Button } from '@/components/ui/button';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { Container, Calculator, ShieldCheck, MapPin, Loader2, ArrowRight, CheckCircle2 } from 'lucide-react';
import { toast } from 'sonner';

const quoteSchema = z.object({
  codigo_postal: z.string().length(5, 'Código postal debe tener 5 dígitos'),
  modelo: z.string().min(1, 'Selecciona un equipo'),
  dias_renta: z.coerce.number().min(1, 'Mínimo 1 día'),
  tipo_persona: z.enum([QuoteRequestTipoPersona.FISICA, QuoteRequestTipoPersona.MORAL]),
  nombre_empresa: z.string().optional(),
  rfc: z.string().optional(),
  nombre_contacto: z.string().min(1, 'Requerido'),
  telefono: z.string().min(10, 'Teléfono inválido'),
  email: z.string().email('Email inválido'),
  direccion_entrega: z.string().min(1, 'Requerido'),
  notas: z.string().optional()
});

export default function Home() {
  const [cpInput, setCpInput] = useState('');
  const { data: zones } = useListPostalZones({ cp: cpInput }, { query: { enabled: cpInput.length === 5 } });
  
  const validateIdentity = useValidateIdentity();
  const createQuote = useCreateQuote();
  const [quoteResult, setQuoteResult] = useState<{folio: string, monto_total: number} | null>(null);

  const form = useForm<z.infer<typeof quoteSchema>>({
    resolver: zodResolver(quoteSchema),
    defaultValues: {
      codigo_postal: '',
      modelo: '',
      dias_renta: 1,
      tipo_persona: QuoteRequestTipoPersona.FISICA,
      nombre_contacto: '',
      telefono: '',
      email: '',
      direccion_entrega: '',
      notas: ''
    }
  });

  const tipoPersona = form.watch('tipo_persona');
  const selectedModelo = form.watch('modelo');
  const diasRenta = form.watch('dias_renta');

  // Hardcoded prices for demonstration as API doesn't expose prices in listEquipment directly
  const equipos = [
    { id: '1', modelo: 'Montacargas 5000 lbs', renta_diaria: 1500 },
    { id: '2', modelo: 'Plataforma Articulada 45ft', renta_diaria: 2200 },
    { id: '3', modelo: 'Retroexcavadora', renta_diaria: 3500 },
  ];

  const equipoSeleccionado = equipos.find(e => e.modelo === selectedModelo);
  const zona = zones?.[0];

  const costoRenta = (equipoSeleccionado?.renta_diaria || 0) * (diasRenta || 0);
  const costoFlete = zona?.tarifa_flete || 0;
  const subtotal = costoRenta + costoFlete;
  const iva = subtotal * 0.16;
  const total = subtotal + iva;

  const handleValidateIdentity = async () => {
    const rfc = form.getValues('rfc');
    if (!rfc) {
      toast.error('Ingresa tu RFC para validar');
      return;
    }
    
    validateIdentity.mutate({
      data: {
        tipo_persona: tipoPersona === 'FISICA' ? IdentityValidationRequestTipoPersona.FISICA : IdentityValidationRequestTipoPersona.MORAL,
        rfc: rfc,
        nombre: form.getValues(tipoPersona === 'FISICA' ? 'nombre_contacto' : 'nombre_empresa')
      }
    }, {
      onSuccess: (data) => {
        if (data.valido) {
          toast.success('Identidad validada correctamente', { description: data.nombre_registrado });
        } else {
          toast.error('Validación fallida', { description: data.observaciones || 'Revisa tus datos' });
        }
      }
    });
  };

  const onSubmit = (values: z.infer<typeof quoteSchema>) => {
    createQuote.mutate({ data: values }, {
      onSuccess: (data) => {
        setQuoteResult({
          folio: data.folio || String(data.id),
          monto_total: data.monto_total
        });
        toast.success('Cotización generada exitosamente');
      },
      onError: () => toast.error('Error al generar la cotización')
    });
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Hero Section */}
      <header className="bg-sidebar text-sidebar-foreground py-20 px-4 relative overflow-hidden">
        <div className="absolute inset-0 opacity-10 bg-[url('https://images.unsplash.com/photo-1541888081635-4674f7d3a01d?q=80&w=2940&auto=format&fit=crop')] bg-cover bg-center" />
        <div className="max-w-6xl mx-auto relative z-10 flex flex-col md:flex-row items-center justify-between gap-12">
          <div className="flex-1 text-center md:text-left">
            <div className="inline-flex items-center gap-3 bg-white/10 px-4 py-2 rounded-full mb-6 text-accent backdrop-blur-sm border border-white/20">
              <Container className="h-5 w-5" />
              <span className="font-bold tracking-widest text-sm">PROSIC RENTALS</span>
            </div>
            <h1 className="text-4xl md:text-6xl font-black mb-6 leading-tight text-white">
              Precisión y potencia<br/>en cada entrega.
            </h1>
            <p className="text-xl text-sidebar-foreground/80 mb-8 max-w-xl">
              Cotiza al instante el equipo industrial que necesitas. Con nuestra red de logística inteligente, tu equipo llega a tiempo, siempre.
            </p>
          </div>
          
          <div className="flex-1 w-full max-w-md">
            {!quoteResult ? (
              <Card className="border-0 shadow-2xl bg-white text-foreground">
                <CardHeader className="bg-primary/5 border-b border-primary/10">
                  <CardTitle className="text-2xl font-bold flex items-center gap-2">
                    <Calculator className="h-6 w-6 text-primary" />
                    Cotizador en Línea
                  </CardTitle>
                  <CardDescription>Obtén un precio exacto y reserva en minutos.</CardDescription>
                </CardHeader>
                <CardContent className="p-6">
                  <Form {...form}>
                    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                      
                      <div className="grid grid-cols-2 gap-4">
                        <FormField
                          control={form.control}
                          name="modelo"
                          render={({ field }) => (
                            <FormItem className="col-span-2">
                              <FormLabel>Equipo requerido</FormLabel>
                              <Select onValueChange={field.onChange} defaultValue={field.value}>
                                <FormControl>
                                  <SelectTrigger>
                                    <SelectValue placeholder="Selecciona el equipo" />
                                  </SelectTrigger>
                                </FormControl>
                                <SelectContent>
                                  {equipos.map(e => (
                                    <SelectItem key={e.id} value={e.modelo}>{e.modelo}</SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        
                        <FormField
                          control={form.control}
                          name="dias_renta"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Días de renta</FormLabel>
                              <FormControl>
                                <Input type="number" min="1" {...field} />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />

                        <FormField
                          control={form.control}
                          name="codigo_postal"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Código Postal</FormLabel>
                              <FormControl>
                                <div className="relative">
                                  <Input 
                                    {...field} 
                                    maxLength={5} 
                                    onChange={(e) => {
                                      field.onChange(e);
                                      if (e.target.value.length === 5) setCpInput(e.target.value);
                                    }}
                                  />
                                  {zona && <MapPin className="absolute right-3 top-2.5 h-4 w-4 text-green-600" />}
                                </div>
                              </FormControl>
                              {zona && <p className="text-xs text-green-600 font-medium">Zona detectada: {zona.zona}</p>}
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>

                      <div className="bg-muted p-4 rounded-xl space-y-2 border border-primary/10">
                        <div className="flex justify-between text-sm">
                          <span className="text-muted-foreground">Renta Diaria ({diasRenta} días)</span>
                          <span className="font-semibold">${costoRenta.toLocaleString()}</span>
                        </div>
                        <div className="flex justify-between text-sm">
                          <span className="text-muted-foreground">Flete Logística</span>
                          <span className="font-semibold">{zona ? `$${costoFlete.toLocaleString()}` : 'Calculando...'}</span>
                        </div>
                        <div className="flex justify-between text-sm">
                          <span className="text-muted-foreground">Subtotal</span>
                          <span className="font-semibold">${subtotal.toLocaleString()}</span>
                        </div>
                        <div className="flex justify-between text-sm">
                          <span className="text-muted-foreground">IVA (16%)</span>
                          <span className="font-semibold">${iva.toLocaleString()}</span>
                        </div>
                        <div className="flex justify-between font-bold text-lg pt-2 border-t border-border">
                          <span className="text-primary">Total Estimado</span>
                          <span className="text-primary">${total.toLocaleString()}</span>
                        </div>
                      </div>

                      <div className="space-y-4 pt-4 border-t border-border">
                        <h3 className="font-bold text-lg">Datos de Contacto</h3>
                        
                        <FormField
                          control={form.control}
                          name="tipo_persona"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Tipo de Persona</FormLabel>
                              <Select onValueChange={field.onChange} defaultValue={field.value}>
                                <FormControl>
                                  <SelectTrigger>
                                    <SelectValue placeholder="Selecciona tipo" />
                                  </SelectTrigger>
                                </FormControl>
                                <SelectContent>
                                  <SelectItem value="FISICA">Persona Física</SelectItem>
                                  <SelectItem value="MORAL">Persona Moral</SelectItem>
                                </SelectContent>
                              </Select>
                              <FormMessage />
                            </FormItem>
                          )}
                        />

                        {tipoPersona === 'MORAL' && (
                          <FormField
                            control={form.control}
                            name="nombre_empresa"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Razón Social</FormLabel>
                                <FormControl>
                                  <Input {...field} />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                        )}

                        <div className="grid grid-cols-2 gap-4">
                          <FormField
                            control={form.control}
                            name="nombre_contacto"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Nombre Contacto</FormLabel>
                                <FormControl>
                                  <Input {...field} />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                          <FormField
                            control={form.control}
                            name="rfc"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>RFC (Opcional)</FormLabel>
                                <FormControl>
                                  <Input {...field} placeholder="Para facturación" />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                        </div>

                        {form.getValues('rfc') && form.getValues('rfc').length > 10 && (
                          <Button 
                            type="button" 
                            variant="secondary" 
                            className="w-full bg-accent/20 text-primary hover:bg-accent/30"
                            onClick={handleValidateIdentity}
                            disabled={validateIdentity.isPending}
                          >
                            {validateIdentity.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <ShieldCheck className="h-4 w-4 mr-2" />}
                            Validar Identidad (SAT)
                          </Button>
                        )}

                        <div className="grid grid-cols-2 gap-4">
                          <FormField
                            control={form.control}
                            name="telefono"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Teléfono</FormLabel>
                                <FormControl>
                                  <Input {...field} />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                          <FormField
                            control={form.control}
                            name="email"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Email</FormLabel>
                                <FormControl>
                                  <Input type="email" {...field} />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                        </div>

                        <FormField
                          control={form.control}
                          name="direccion_entrega"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Dirección de Entrega</FormLabel>
                              <FormControl>
                                <Textarea className="resize-none h-20" {...field} />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>

                      <Button 
                        type="submit" 
                        className="w-full h-14 text-lg font-bold" 
                        disabled={createQuote.isPending || !zona || !selectedModelo}
                      >
                        {createQuote.isPending ? <Loader2 className="h-5 w-5 animate-spin mr-2" /> : <ArrowRight className="h-5 w-5 mr-2" />}
                        Generar Cotización Oficial
                      </Button>
                    </form>
                  </Form>
                </CardContent>
              </Card>
            ) : (
              <Card className="border-0 shadow-2xl bg-white text-center py-12 px-6">
                <CardContent className="flex flex-col items-center space-y-6">
                  <div className="h-24 w-24 bg-green-100 rounded-full flex items-center justify-center">
                    <CheckCircle2 className="h-12 w-12 text-green-600" />
                  </div>
                  <div className="space-y-2">
                    <h2 className="text-3xl font-black text-foreground">¡Cotización Creada!</h2>
                    <p className="text-muted-foreground">Un asesor se comunicará contigo en breve para confirmar la disponibilidad y el horario de entrega.</p>
                  </div>
                  <div className="bg-muted w-full p-6 rounded-xl">
                    <p className="text-sm font-bold text-muted-foreground uppercase tracking-widest mb-1">Folio de Seguimiento</p>
                    <p className="text-4xl font-black text-primary">{quoteResult.folio}</p>
                    <div className="mt-4 pt-4 border-t border-border flex justify-between font-bold text-lg">
                      <span>Total:</span>
                      <span>${quoteResult.monto_total.toLocaleString()}</span>
                    </div>
                  </div>
                  <Button variant="outline" className="w-full" onClick={() => {
                    setQuoteResult(null);
                    form.reset();
                  }}>
                    Nueva Cotización
                  </Button>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </header>
    </div>
  );
}
