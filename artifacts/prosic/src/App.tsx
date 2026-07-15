import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from '@/components/ui/toaster';
import { TooltipProvider } from '@/components/ui/tooltip';
import { Route, Switch, Router as WouterRouter, Redirect } from 'wouter';
import { useGetMe, setAuthTokenGetter } from '@workspace/api-client-react';
import { SidebarProvider, SidebarTrigger, SidebarInset } from '@/components/ui/sidebar';
import AppSidebar from '@/components/app-sidebar';
import { Loader as Loader2 } from 'lucide-react';

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
import Rentals from '@/pages/rentals';
import Reviews from '@/pages/reviews';
import Settings from '@/pages/settings';

setAuthTokenGetter(() => localStorage.getItem('prosic_token'));

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

      <Route path="/dashboard">{() => <ProtectedRoute component={Dashboard} />}</Route>
      <Route path="/services">{() => <ProtectedRoute component={Services} />}</Route>
      <Route path="/services/:id">{() => <ProtectedRoute component={ServiceDetail} />}</Route>
      <Route path="/schedule">{() => <ProtectedRoute component={Schedule} />}</Route>
      <Route path="/routes">{() => <ProtectedRoute component={RoutesPage} />}</Route>
      <Route path="/quotes">{() => <ProtectedRoute component={Quotes} />}</Route>
      <Route path="/catalogs">{() => <ProtectedRoute component={Catalogs} />}</Route>
      <Route path="/reports">{() => <ProtectedRoute component={Reports} />}</Route>
      <Route path="/sheets">{() => <ProtectedRoute component={Sheets} />}</Route>
      <Route path="/rentals">{() => <ProtectedRoute component={Rentals} />}</Route>
      <Route path="/reviews">{() => <ProtectedRoute component={Reviews} />}</Route>
      <Route path="/settings">{() => <ProtectedRoute component={Settings} />}</Route>

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
