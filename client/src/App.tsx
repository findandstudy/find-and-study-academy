import { useEffect } from 'react';
import { Switch, Route, Redirect } from 'wouter';
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
        </div>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}