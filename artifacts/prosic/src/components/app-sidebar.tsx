import { Link, useLocation } from 'wouter';
import { User, useLogout } from '@workspace/api-client-react';
import { 
  Sidebar, 
  SidebarContent, 
  SidebarFooter, 
  SidebarGroup, 
  SidebarGroupContent, 
  SidebarGroupLabel, 
  SidebarHeader, 
  SidebarMenu, 
  SidebarMenuButton, 
  SidebarMenuItem 
} from '@/components/ui/sidebar';
import { 
  LayoutDashboard, 
  Truck, 
  Calendar, 
  Map, 
  FileText, 
  Database, 
  BarChart2, 
  FileSpreadsheet, 
  LogOut,
  Container,
  ClipboardList,
  ShieldAlert,
  Settings as SettingsIcon,
} from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function AppSidebar({ user }: { user: User }) {
  const [location, setLocation] = useLocation();
  const logout = useLogout();

  const handleLogout = () => {
    logout.mutate(undefined, {
      onSuccess: () => setLocation('/login')
    });
  };

  const navItems = [
    { label: 'Control Center', icon: LayoutDashboard, path: '/dashboard' },
    { label: 'Servicios', icon: Truck, path: '/services' },
    { label: 'Programación', icon: Calendar, path: '/schedule' },
    { label: 'Optimización', icon: Map, path: '/routes' },
    { label: 'Cotizaciones', icon: FileText, path: '/quotes' },
    { label: 'Rentas en Línea', icon: ClipboardList, path: '/rentals' },
    { label: 'Revisiones', icon: ShieldAlert, path: '/reviews' },
    { label: 'Catálogos', icon: Database, path: '/catalogs' },
    { label: 'Reportes', icon: BarChart2, path: '/reports' },
    { label: 'Sync Sheets', icon: FileSpreadsheet, path: '/sheets' },
    { label: 'Ajustes', icon: SettingsIcon, path: '/settings' },
  ];

  return (
    <Sidebar variant="inset">
      <SidebarHeader className="h-16 flex items-center px-4 justify-center">
        <div className="flex items-center gap-2 font-bold text-xl tracking-tight text-sidebar-primary-foreground w-full">
          <Container className="h-6 w-6 text-sidebar-ring" />
          <span>PROSIC</span>
        </div>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel className="text-sidebar-foreground/50 uppercase text-xs tracking-wider">Operaciones</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {navItems.map((item) => (
                <SidebarMenuItem key={item.path}>
                  <SidebarMenuButton 
                    asChild 
                    isActive={location.startsWith(item.path)}
                    tooltip={item.label}
                  >
                    <Link href={item.path} className="flex items-center gap-3">
                      <item.icon className="h-4 w-4" />
                      <span>{item.label}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter className="p-4">
        <div className="flex flex-col gap-4">
          <div className="flex items-center gap-3 px-2">
            <div className="h-8 w-8 rounded-full bg-sidebar-accent flex items-center justify-center text-sidebar-accent-foreground font-bold">
              {user.nombre.charAt(0)}
            </div>
            <div className="flex flex-col overflow-hidden">
              <span className="text-sm font-medium truncate">{user.nombre}</span>
              <span className="text-xs text-sidebar-foreground/60 truncate">{user.rol}</span>
            </div>
          </div>
          <Button 
            variant="ghost" 
            className="w-full justify-start text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground" 
            onClick={handleLogout}
            disabled={logout.isPending}
          >
            <LogOut className="h-4 w-4 mr-2" />
            Cerrar Sesión
          </Button>
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}
