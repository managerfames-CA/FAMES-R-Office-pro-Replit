import { useEffect } from "react";
import { Link, useLocation, Redirect } from "wouter";
import { useAuth, useLogoutAction, type PermissionKey } from "@/hooks/use-auth";
import { useFirmBranding } from "@/hooks/use-firm-branding";
import { FirmLogo } from "@/components/FirmLogo";
import { useListNotifications, useListPendingWorkLogs, getListPendingWorkLogsQueryKey } from "@workspace/api-client-react";
import {
  LayoutDashboard,
  CheckSquare,
  Clock,
  CalendarDays,
  Users,
  FileText,
  BarChart3,
  UserSquare2,
  Bell,
  Settings,
  LogOut,
  ChevronDown,
  Inbox,
} from "lucide-react";

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
  SidebarMenuItem,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";

type NavItem = {
  title: string;
  url: string;
  icon: React.ComponentType<{ className?: string }>;
  permission?: PermissionKey;
  adminOnly?: boolean;
  badge?: number;
};

function buildNav(opts: {
  isAdmin: boolean;
  can: (p: PermissionKey) => boolean;
  pendingCount: number;
}): { primary: NavItem[]; admin: NavItem[] } {
  const { isAdmin, can, pendingCount } = opts;

  const primary: NavItem[] = [
    { title: "Dashboard", url: "/", icon: LayoutDashboard },
    { title: "My Tasks", url: "/tasks", icon: CheckSquare },
    { title: "Attendance", url: "/attendance", icon: CalendarDays },
    { title: "Work Logs", url: "/work-logs", icon: Clock },
    { title: "Notifications", url: "/notifications", icon: Bell },
  ];

  const admin: NavItem[] = [];
  if (isAdmin) {
    admin.push(
      { title: "Pending Approvals", url: "/pending-approvals", icon: Inbox, badge: pendingCount },
      { title: "Staff", url: "/staff", icon: UserSquare2 },
    );
  }
  if (isAdmin || can("manage_clients")) {
    admin.push({ title: "Clients", url: "/clients", icon: Users });
  }
  if (isAdmin || can("view_invoices") || can("manage_invoices")) {
    admin.push({ title: "Invoices", url: "/invoices", icon: FileText });
  }
  if (isAdmin || can("view_reports")) {
    admin.push({ title: "Reports", url: "/reports", icon: BarChart3 });
  }
  admin.push({ title: "Settings", url: "/settings", icon: Settings });

  return { primary, admin };
}

function AppSidebar({ pendingCount }: { pendingCount: number }) {
  const [location] = useLocation();
  const { user, isAdmin, can } = useAuth();
  const { name: firmName, tagline, logoUrl } = useFirmBranding();
  const { primary, admin } = buildNav({ isAdmin, can, pendingCount });

  return (
    <Sidebar>
      <SidebarHeader className="p-4">
        <div className="flex items-center gap-3 p-2 rounded-md">
          <FirmLogo name={firmName} logoUrl={logoUrl} size="md" />
          <div className="overflow-hidden">
            <div className="text-sm font-semibold truncate">{firmName}</div>
            <div className="text-[11px] text-muted-foreground truncate">{tagline}</div>
          </div>
        </div>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>{isAdmin ? "Workspace" : "My Day"}</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {primary.map((item) => (
                <NavLink key={item.title} item={item} location={location} />
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {admin.length > 0 && (
          <SidebarGroup>
            <SidebarGroupLabel>{isAdmin ? "Oversight" : "Tools"}</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {admin.map((item) => (
                  <NavLink key={item.title} item={item} location={location} />
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}
      </SidebarContent>
      <SidebarFooter className="p-4">
        <div className="flex items-center gap-3 overflow-hidden rounded-md bg-sidebar-accent p-2">
          <Avatar className="h-9 w-9">
            <AvatarImage src={user?.avatarUrl || ""} />
            <AvatarFallback>{user?.name?.substring(0, 2).toUpperCase() || "U"}</AvatarFallback>
          </Avatar>
          <div className="flex flex-col overflow-hidden">
            <span className="truncate text-sm font-medium">{user?.name}</span>
            <span className="truncate text-xs text-muted-foreground">
              {user?.role === "admin" ? "Administrator" : user?.position || "Team member"}
            </span>
          </div>
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}

function NavLink({ item, location }: { item: NavItem; location: string }) {
  const isActive = location === item.url || (item.url !== "/" && location.startsWith(item.url));
  return (
    <SidebarMenuItem>
      <SidebarMenuButton asChild isActive={isActive}>
        <Link href={item.url}>
          <item.icon className="h-4 w-4" />
          <span className="flex-1">{item.title}</span>
          {item.badge != null && item.badge > 0 && (
            <Badge variant="secondary" className="ml-auto h-5 px-1.5 text-[10px] bg-amber-100 text-amber-700">
              {item.badge}
            </Badge>
          )}
        </Link>
      </SidebarMenuButton>
    </SidebarMenuItem>
  );
}

function Topbar({ pendingCount }: { pendingCount: number }) {
  const { user, isAdmin } = useAuth();
  const logout = useLogoutAction();
  const [location] = useLocation();

  const { data: notifications } = useListNotifications({ unreadOnly: true });
  const unreadCount = notifications?.filter((n) => !n.read).length || 0;

  const getPageTitle = () => {
    if (location === "/") return isAdmin ? "Control Center" : "My Day";
    const path = location.split("/")[1];
    if (!path) return "Dashboard";
    return path
      .split("-")
      .map((p) => p.charAt(0).toUpperCase() + p.slice(1))
      .join(" ");
  };

  return (
    <header className="sticky top-0 z-30 flex h-16 shrink-0 items-center gap-4 border-b bg-background px-4 shadow-sm md:px-6">
      <SidebarTrigger className="-ml-2" />
      <div className="flex flex-1 items-center gap-4">
        <h1 className="text-xl font-semibold tracking-tight hidden md:block">
          {getPageTitle()}
        </h1>
        <div className="ml-auto flex items-center space-x-3">
          {isAdmin && pendingCount > 0 && (
            <Button variant="outline" size="sm" asChild className="hidden sm:flex bg-amber-50 border-amber-200 text-amber-800 hover:bg-amber-100">
              <Link href="/pending-approvals">
                <Inbox className="h-4 w-4 mr-1.5" />
                {pendingCount} to review
              </Link>
            </Button>
          )}

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="relative rounded-full">
                <Bell className="h-5 w-5" />
                {unreadCount > 0 && (
                  <span className="absolute top-1.5 right-1.5 h-2 w-2 rounded-full bg-destructive" />
                )}
                <span className="sr-only">Notifications</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-80">
              <DropdownMenuLabel>Notifications</DropdownMenuLabel>
              <DropdownMenuSeparator />
              {notifications && notifications.length > 0 ? (
                <div className="max-h-[300px] overflow-y-auto">
                  {notifications.slice(0, 5).map((n) => (
                    <DropdownMenuItem key={n.id} className="flex flex-col items-start p-3 cursor-pointer" asChild>
                      <Link href={n.link || "/notifications"}>
                        <div className="font-medium text-sm">{n.title}</div>
                        <div className="text-xs text-muted-foreground line-clamp-2">{n.message}</div>
                      </Link>
                    </DropdownMenuItem>
                  ))}
                  {notifications.length > 5 && (
                    <DropdownMenuItem className="justify-center text-primary" asChild>
                      <Link href="/notifications">View all</Link>
                    </DropdownMenuItem>
                  )}
                </div>
              ) : (
                <div className="p-4 text-center text-sm text-muted-foreground">No new notifications</div>
              )}
            </DropdownMenuContent>
          </DropdownMenu>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="relative h-9 rounded-full pl-2 pr-4 gap-2 border bg-muted/30">
                <Avatar className="h-6 w-6">
                  <AvatarImage src={user?.avatarUrl || ""} alt={user?.name} />
                  <AvatarFallback>{user?.name?.substring(0, 2).toUpperCase()}</AvatarFallback>
                </Avatar>
                <span className="text-sm font-medium hidden md:block">{user?.name}</span>
                <ChevronDown className="h-4 w-4 text-muted-foreground" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" forceMount>
              <DropdownMenuLabel className="font-normal">
                <div className="flex flex-col space-y-1">
                  <p className="text-sm font-medium leading-none">{user?.name}</p>
                  <p className="text-xs leading-none text-muted-foreground">{user?.email}</p>
                  <div className="mt-2">
                    <Badge variant={user?.role === "admin" ? "default" : "secondary"} className="text-[10px] uppercase">
                      {user?.role}
                    </Badge>
                  </div>
                </div>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem asChild>
                <Link href="/settings" className="w-full cursor-pointer flex items-center">
                  <Settings className="mr-2 h-4 w-4" />
                  <span>Settings</span>
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <Link href="/change-password" className="w-full cursor-pointer flex items-center">
                  <span className="ml-6">Change password</span>
                </Link>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={logout}
                className="text-destructive focus:bg-destructive/10 focus:text-destructive cursor-pointer"
              >
                <LogOut className="mr-2 h-4 w-4" />
                <span>Log out</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </header>
  );
}

export function AppLayout({ children }: { children: React.ReactNode }) {
  const { isAdmin, mustChangePassword } = useAuth();
  const [location, setLocation] = useLocation();

  const { data: pending } = useListPendingWorkLogs({
    query: {
      queryKey: getListPendingWorkLogsQueryKey(),
      enabled: isAdmin,
      refetchInterval: 60_000,
    },
  });
  const pendingCount = pending?.length ?? 0;

  useEffect(() => {
    if (mustChangePassword && location !== "/change-password") {
      setLocation("/change-password");
    }
  }, [mustChangePassword, location, setLocation]);

  if (mustChangePassword && location !== "/change-password") {
    return <Redirect to="/change-password" />;
  }

  return (
    <SidebarProvider>
      <div className="grid min-h-screen w-full md:grid-cols-[auto_1fr]">
        <AppSidebar pendingCount={pendingCount} />
        <div className="flex flex-col h-screen overflow-hidden">
          <Topbar pendingCount={pendingCount} />
          <main className="flex-1 overflow-y-auto bg-muted/20 p-4 md:p-6 lg:p-8">
            <div className="mx-auto max-w-6xl w-full">{children}</div>
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}
