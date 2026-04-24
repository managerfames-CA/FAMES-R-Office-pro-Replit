import { Switch, Route, Router as WouterRouter } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster as SonnerToaster } from "sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ThemeProvider } from "@/components/theme-provider";

import { ProtectedRoute } from "@/components/layout/ProtectedRoute";
import { AppLayout } from "@/components/layout/AppLayout";

import Login from "@/pages/login";
import ChangePassword from "@/pages/changePassword";
import Dashboard from "@/pages/dashboard";
import Staff from "@/pages/staff";
import Clients from "@/pages/clients";
import Tasks from "@/pages/tasks";
import Attendance from "@/pages/attendance";
import WorkLogs from "@/pages/workLogs";
import PendingApprovals from "@/pages/pendingApprovals";
import Invoices from "@/pages/invoices";
import InvoiceDetail from "@/pages/invoiceDetail";
import Reports from "@/pages/reports";
import Notifications from "@/pages/notifications";
import Settings from "@/pages/settings";
import NotFound from "@/pages/not-found";

const queryClient = new QueryClient();

function ProtectedRoutes() {
  return (
    <ProtectedRoute>
      <AppLayout>
        <Switch>
          <Route path="/" component={Dashboard} />
          <Route path="/staff" component={Staff} />
          <Route path="/clients" component={Clients} />
          <Route path="/tasks" component={Tasks} />
          <Route path="/attendance" component={Attendance} />
          <Route path="/work-logs" component={WorkLogs} />
          <Route path="/pending-approvals" component={PendingApprovals} />
          <Route path="/invoices" component={Invoices} />
          <Route path="/invoices/:id" component={InvoiceDetail} />
          <Route path="/reports" component={Reports} />
          <Route path="/notifications" component={Notifications} />
          <Route path="/settings" component={Settings} />
          <Route component={NotFound} />
        </Switch>
      </AppLayout>
    </ProtectedRoute>
  );
}

function ChangePasswordRoute() {
  return (
    <ProtectedRoute>
      <ChangePassword />
    </ProtectedRoute>
  );
}

function Router() {
  return (
    <Switch>
      <Route path="/login" component={Login} />
      <Route path="/change-password" component={ChangePasswordRoute} />
      <Route component={ProtectedRoutes} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider attribute="class" defaultTheme="light" enableSystem disableTransitionOnChange>
        <TooltipProvider>
          <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
            <Router />
          </WouterRouter>
          <Toaster />
          <SonnerToaster position="top-right" />
        </TooltipProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}

export default App;
