import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from '@/components/ui/toaster';
import { TooltipProvider } from '@/components/ui/tooltip';
import { Route, Switch, Router as WouterRouter, Redirect } from 'wouter';
import { useGetMe } from '@workspace/api-client-react';
import { SidebarProvider, SidebarTrigger, SidebarInset } from '@/components/ui/sidebar';
import AppSidebar from '@/components/app-sidebar';

import NotFound from '@/pages/not-found';
import Home from '@/pages/home';
import Login from '@/pages/login';
import Dashboard from '@/pages/dashboard';
import Services from '@/pages/services';
import ServiceDetail from '@/pages/service-detail';
import Schedule from '@/pages/schedule';
import RoutesPage from '@/pages/routes';
import Quotes from '@/pages/quotes';
import Catalogs from '@/pages/catalogs';
import Reports from '@/pages/reports';
import Sheets from '@/pages/sheets';
import { Loader2 } from 'lucide-react';

const queryClient = new QueryClient();

function ProtectedRoute({ component: Component }: { component: React.ComponentType }) {
  const { data: user, isLoading, error } = useGetMe();

  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (error || !user) {
    return <Redirect to="/login" />;
  }

  return (
    <SidebarProvider>
      <AppSidebar user={user} />
      <SidebarInset className="bg-background">
        <header className="flex h-16 shrink-0 items-center gap-2 border-b border-border/50 px-4 sm:px-6">
          <SidebarTrigger className="-ml-1" />
        </header>
        <div className="p-4 sm:p-6 lg:p-8">
          <Component />
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}

function Router() {
  return (
    <Switch>
      <Route path="/" component={Home} />
      <Route path="/login" component={Login} />
      
      <Route path="/dashboard" render={() => <ProtectedRoute component={Dashboard} />} />
      <Route path="/services" render={() => <ProtectedRoute component={Services} />} />
      <Route path="/services/:id" render={() => <ProtectedRoute component={ServiceDetail} />} />
      <Route path="/schedule" render={() => <ProtectedRoute component={Schedule} />} />
      <Route path="/routes" render={() => <ProtectedRoute component={RoutesPage} />} />
      <Route path="/quotes" render={() => <ProtectedRoute component={Quotes} />} />
      <Route path="/catalogs" render={() => <ProtectedRoute component={Catalogs} />} />
      <Route path="/reports" render={() => <ProtectedRoute component={Reports} />} />
      <Route path="/sheets" render={() => <ProtectedRoute component={Sheets} />} />

      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, '')}>
          <Router />
        </WouterRouter>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
