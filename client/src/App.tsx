import { useEffect, useState } from 'react';
import { Switch, Route, Redirect, useLocation } from 'wouter';
import { QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from '@/components/ui/toaster';
import { TooltipProvider } from '@/components/ui/tooltip';
import { queryClient } from './lib/queryClient';
import { useAuthStore } from './store/auth';
import { useDataStore } from './store/data';

// Layouts
import { AdminLayout } from './components/layouts/AdminLayout';
import { AgentLayout } from './components/layouts/AgentLayout';

// Auth Pages
import Login from './pages/Login';
import Signup from './pages/Signup';
import ForgotPassword from './pages/ForgotPassword';
import ResetPassword from './pages/ResetPassword';

// Agent Pages  
import AgentDashboard from './pages/agent/Dashboard';
import AgentCourses from './pages/agent/Courses';
import AgentCertificates from './pages/agent/Certificates';
import AgentProfile from './pages/agent/Profile';
import AgentAgency from './pages/agent/Agency';
import AgentExamsOrders from './pages/agent/ExamsOrders';
import AgentSubscriptions from './pages/agent/Subscriptions';
import AgentLeaderboard from './pages/agent/Leaderboard';

// Admin Pages
import AdminDashboard from './pages/admin/Dashboard';
import AdminProfile from './pages/admin/Profile';
import AdminContentCountries from './pages/admin/ContentCountries';
import AdminQuizzes from './pages/admin/Quizzes';
import AdminCertificates from './pages/admin/Certificates';
import AdminAgencies from './pages/admin/Agencies';
import AdminUsers from './pages/admin/Users';
import AdminReports from './pages/admin/Reports';
import AdminAnnouncements from './pages/admin/Announcements';
import AdminPopups from './pages/admin/Popups';
import AdminSettingsPayments from './pages/admin/SettingsPayments';
import AdminIntegrations from './pages/admin/Integrations';
import AdminMenuManagement from './pages/admin/MenuManagement';
import AdminSidebarLinks from './pages/admin/SidebarLinks';
import AdminFindyAI from './pages/admin/FindyAI';
import AdminPartnerZone from './pages/admin/PartnerZoneAdmin';

// Agent Extra Pages
import AgentPartnerZone from './pages/agent/PartnerZone';

// Public Pages
import VerifyCertificate from './pages/VerifyCertificate';
import Home from './pages/Home';

// Components
import { PopupRenderer } from './components/PopupRenderer';
import AgentAnnouncements from './pages/agent/Announcements';

// Error Pages
import NotFound404 from './pages/errors/NotFound404';
import Forbidden403 from './pages/errors/Forbidden403';

// The Findy chat launcher is mounted statically in client/index.html with
// `display:none` by default. It is only revealed by FindyLauncherGate when an
// authenticated user is on a panel route (/admin or /agent and any nested path).
const FINDY_PANEL_BASES = ['/admin', '/agent'];

function FindyLauncherGate() {
  const [location] = useLocation();
  const { user, role } = useAuthStore();
  const [findyEnabled, setFindyEnabled] = useState<boolean>(() => {
    // Optimistically use cached value to avoid a flash of "hidden" on first paint.
    try {
      const cached = localStorage.getItem('agent-menu-visibility');
      if (cached) {
        const parsed = JSON.parse(cached);
        return parsed?.findy !== false;
      }
    } catch {
      // ignore
    }
    return true;
  });

  // Re-fetch the visibility setting whenever the auth state changes (login/logout).
  useEffect(() => {
    let cancelled = false;
    if (!user || !role) return;
    (async () => {
      try {
        const res = await fetch('/api/menu-visibility', {
          headers: {
            'x-user-id': user.id || '',
            'x-user-role': role || '',
          },
        });
        if (!res.ok) return;
        const data = await res.json();
        if (cancelled) return;
        const enabled = data?.findy !== false;
        setFindyEnabled(enabled);
        try {
          const cached = localStorage.getItem('agent-menu-visibility');
          const parsed = cached ? JSON.parse(cached) : {};
          localStorage.setItem(
            'agent-menu-visibility',
            JSON.stringify({ ...parsed, ...data })
          );
        } catch {
          // ignore
        }
      } catch {
        // network error: keep optimistic value
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [user, role]);

  useEffect(() => {
    const launcher = document.getElementById('findy-launcher');
    if (!launcher) return;

    const onPanelRoute = FINDY_PANEL_BASES.some(
      (p) => location === p || location.startsWith(p + '/')
    );
    const shouldShow = !!user && !!role && onPanelRoute && findyEnabled;

    launcher.style.display = shouldShow ? '' : 'none';

    if (!shouldShow) {
      // If the chat panel was open, dispatch its own close button so the
      // widget's internal isChatOpen flag stays in sync with the DOM.
      const chat = document.getElementById('findy-chat') as HTMLElement | null;
      if (chat && chat.style.display !== 'none') {
        const closeBtn = document.getElementById('findy-close') as HTMLButtonElement | null;
        if (closeBtn) {
          closeBtn.click();
        } else {
          chat.style.display = 'none';
        }
      }
    }
  }, [location, user, role, findyEnabled]);

  return null;
}

// Route Guards
function ProtectedRoute({ 
  children, 
  requiredRole 
}: { 
  children: React.ReactNode; 
  requiredRole?: string | string[];
}) {
  const { user, role } = useAuthStore();
  
  if (!user || !role) {
    return <Redirect to="/login" />;
  }
  
  if (requiredRole) {
    const allowed = Array.isArray(requiredRole) ? requiredRole : [requiredRole];
    if (!allowed.includes(role)) {
      return <Forbidden403 />;
    }
  }
  
  return <>{children}</>;
}

function PublicRoute({ children }: { children: React.ReactNode }) {
  const { user, role } = useAuthStore();
  
  if (user && role) {
    const dashboardPath = (role === 'admin' || role === 'staff') ? '/admin/dashboard' : '/agent/dashboard';
    return <Redirect to={dashboardPath} />;
  }
  
  return <>{children}</>;
}

function Router() {
  return (
    <Switch>
      {/* Public Routes */}
      <Route path="/login">
        <PublicRoute>
          <Login />
        </PublicRoute>
      </Route>
      
      <Route path="/signup">
        <PublicRoute>
          <Signup />
        </PublicRoute>
      </Route>
      
      <Route path="/forgot-password">
        <PublicRoute>
          <ForgotPassword />
        </PublicRoute>
      </Route>
      
      <Route path="/reset-password">
        <PublicRoute>
          <ResetPassword />
        </PublicRoute>
      </Route>
      
      <Route path="/verify">
        <VerifyCertificate />
      </Route>

      {/* Admin + Staff Routes */}
      <Route path="/admin/dashboard">
        <ProtectedRoute requiredRole={["admin", "staff"]}>
          <AdminLayout>
            <AdminDashboard />
          </AdminLayout>
        </ProtectedRoute>
      </Route>

      <Route path="/admin/profile">
        <ProtectedRoute requiredRole={["admin", "staff"]}>
          <AdminLayout>
            <AdminProfile />
          </AdminLayout>
        </ProtectedRoute>
      </Route>

      <Route path="/admin/content/countries">
        <ProtectedRoute requiredRole={["admin", "staff"]}>
          <AdminLayout>
            <AdminContentCountries />
          </AdminLayout>
        </ProtectedRoute>
      </Route>

      <Route path="/admin/quizzes">
        <ProtectedRoute requiredRole={["admin", "staff"]}>
          <AdminLayout>
            <AdminQuizzes />
          </AdminLayout>
        </ProtectedRoute>
      </Route>

      <Route path="/admin/certificates">
        <ProtectedRoute requiredRole={["admin", "staff"]}>
          <AdminLayout>
            <AdminCertificates />
          </AdminLayout>
        </ProtectedRoute>
      </Route>

      <Route path="/admin/agencies">
        <ProtectedRoute requiredRole={["admin", "staff"]}>
          <AdminLayout>
            <AdminAgencies />
          </AdminLayout>
        </ProtectedRoute>
      </Route>

      <Route path="/admin/users">
        <ProtectedRoute requiredRole={["admin", "staff"]}>
          <AdminLayout>
            <AdminUsers />
          </AdminLayout>
        </ProtectedRoute>
      </Route>

      <Route path="/admin/reports">
        <ProtectedRoute requiredRole={["admin", "staff"]}>
          <AdminLayout>
            <AdminReports />
          </AdminLayout>
        </ProtectedRoute>
      </Route>

      <Route path="/admin/announcements">
        <ProtectedRoute requiredRole={["admin", "staff"]}>
          <AdminLayout>
            <AdminAnnouncements />
          </AdminLayout>
        </ProtectedRoute>
      </Route>

      <Route path="/admin/popups">
        <ProtectedRoute requiredRole="admin">
          <AdminLayout>
            <AdminPopups />
          </AdminLayout>
        </ProtectedRoute>
      </Route>

      <Route path="/admin/findy-ai">
        <ProtectedRoute requiredRole={["admin", "staff"]}>
          <AdminLayout>
            <AdminFindyAI />
          </AdminLayout>
        </ProtectedRoute>
      </Route>

      <Route path="/admin/partner-zone">
        <ProtectedRoute requiredRole={["admin", "staff"]}>
          <AdminLayout>
            <AdminPartnerZone />
          </AdminLayout>
        </ProtectedRoute>
      </Route>

      <Route path="/admin/partner-zone/:folderId">
        <ProtectedRoute requiredRole={["admin", "staff"]}>
          <AdminLayout>
            <AdminPartnerZone />
          </AdminLayout>
        </ProtectedRoute>
      </Route>

      {/* Admin-only Routes */}
      <Route path="/admin/settings/payments">
        <ProtectedRoute requiredRole="admin">
          <AdminLayout>
            <AdminSettingsPayments />
          </AdminLayout>
        </ProtectedRoute>
      </Route>

      <Route path="/admin/integrations">
        <ProtectedRoute requiredRole="admin">
          <AdminLayout>
            <AdminIntegrations />
          </AdminLayout>
        </ProtectedRoute>
      </Route>

      <Route path="/admin/menu-management">
        <ProtectedRoute requiredRole="admin">
          <AdminLayout>
            <AdminMenuManagement />
          </AdminLayout>
        </ProtectedRoute>
      </Route>

      <Route path="/admin/sidebar-links">
        <ProtectedRoute requiredRole="admin">
          <AdminLayout>
            <AdminSidebarLinks />
          </AdminLayout>
        </ProtectedRoute>
      </Route>

      {/* Agent Routes */}
      <Route path="/agent/dashboard">
        <ProtectedRoute requiredRole="agent">
          <AgentLayout>
            <AgentDashboard />
          </AgentLayout>
        </ProtectedRoute>
      </Route>

      <Route path="/agent/announcements">
        <ProtectedRoute requiredRole="agent">
          <AgentLayout>
            <AgentAnnouncements />
          </AgentLayout>
        </ProtectedRoute>
      </Route>
      
      <Route path="/agent/courses">
        <ProtectedRoute requiredRole="agent">
          <AgentLayout>
            <AgentCourses />
          </AgentLayout>
        </ProtectedRoute>
      </Route>
      
      <Route path="/agent/certificates">
        <ProtectedRoute requiredRole="agent">
          <AgentLayout>
            <AgentCertificates />
          </AgentLayout>
        </ProtectedRoute>
      </Route>
      
      <Route path="/agent/leaderboard">
        <ProtectedRoute requiredRole="agent">
          <AgentLayout>
            <AgentLeaderboard />
          </AgentLayout>
        </ProtectedRoute>
      </Route>
      
      <Route path="/agent/profile">
        <ProtectedRoute requiredRole="agent">
          <AgentLayout>
            <AgentProfile />
          </AgentLayout>
        </ProtectedRoute>
      </Route>
      
      <Route path="/agent/agency">
        <ProtectedRoute requiredRole="agent">
          <AgentLayout>
            <AgentAgency />
          </AgentLayout>
        </ProtectedRoute>
      </Route>
      
      <Route path="/agent/exams-orders">
        <ProtectedRoute requiredRole="agent">
          <AgentLayout>
            <AgentExamsOrders />
          </AgentLayout>
        </ProtectedRoute>
      </Route>
      
      <Route path="/agent/subscriptions">
        <ProtectedRoute requiredRole="agent">
          <AgentLayout>
            <AgentSubscriptions />
          </AgentLayout>
        </ProtectedRoute>
      </Route>

      <Route path="/agent/partner-zone">
        <ProtectedRoute requiredRole="agent">
          <AgentLayout>
            <AgentPartnerZone />
          </AgentLayout>
        </ProtectedRoute>
      </Route>

      <Route path="/agent/partner-zone/:folderId">
        <ProtectedRoute requiredRole="agent">
          <AgentLayout>
            <AgentPartnerZone />
          </AgentLayout>
        </ProtectedRoute>
      </Route>

      {/* Public Landing */}
      <Route path="/">
        <Home />
      </Route>

      {/* 404 - Must be last */}
      <Route>
        <NotFound404 />
      </Route>
    </Switch>
  );
}

export default function App() {
  const { initialize: initializeAuth } = useAuthStore();
  const { initialize: initializeData } = useDataStore();

  useEffect(() => {
    // Initialize stores on app startup
    initializeAuth();
    initializeData();
  }, [initializeAuth, initializeData]);

  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <div className="min-h-screen bg-background">
          <Router />
          <PopupRenderer />
          <FindyLauncherGate />
        </div>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}