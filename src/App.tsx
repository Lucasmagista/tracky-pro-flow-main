import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, useLocation } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import { ThemeProvider } from "@/contexts/ThemeContext";
import ProtectedRoute from "@/components/ProtectedRoute";
import ErrorBoundary from "@/components/ErrorBoundary";
import { lazy, Suspense } from "react";
import { Loader2 } from "lucide-react";

// Eager loading para páginas de autenticação (críticas)
import Landing from "./pages/Landing";
import Login from "./pages/Login";
import Cadastro from "./pages/Cadastro";
import RecuperarSenha from "./pages/RecuperarSenha";
import ResetPassword from "./pages/ResetPassword";

// Lazy loading para páginas internas (otimização de performance)
const Dashboard = lazy(() => import("./pages/Dashboard"));
const ImportOrders = lazy(() => import("./pages/ImportOrders"));
const Profile = lazy(() => import("./pages/Profile"));
const Settings = lazy(() => import("./pages/Settings"));
const NotificationSettings = lazy(() => import("./pages/NotificationSettings"));
const WhatsAppConfig = lazy(() => import("./pages/WhatsAppConfig"));
const Onboarding = lazy(() => import("./pages/Onboarding"));
const Analytics = lazy(() => import("./pages/Analytics"));
const Subscription = lazy(() => import("./pages/Subscription"));
const NotFound = lazy(() => import("./pages/NotFound"));

// OAuth Callbacks
const NuvemshopCallback = lazy(() => import("./pages/callbacks/NuvemshopCallback"));
const MercadoLivreCallback = lazy(() => import("./pages/callbacks/MercadoLivreCallback"));
const ShopifyCallback = lazy(() => import("./pages/callbacks/ShopifyCallback"));

// Admin Pages
const AdminDashboard = lazy(() => import("./pages/admin/AdminDashboard"));
const AdminUsers = lazy(() => import("./pages/admin/AdminUsers"));
const AdminLogs = lazy(() => import("./pages/admin/AdminLogs"));
const AdminSubscriptions = lazy(() => import("./pages/admin/AdminSubscriptions"));
const AdminSettings = lazy(() => import("./pages/admin/AdminSettings"));
const AdminAnalytics = lazy(() => import("./pages/admin/AdminAnalytics"));
const AdminOrders = lazy(() => import("./pages/admin/AdminOrders"));
const AdminDatabase = lazy(() => import("./pages/admin/AdminDatabase"));
const AdminFeatureFlags = lazy(() => import("./pages/admin/AdminFeatureFlags"));
const AdminNotifications = lazy(() => import("./pages/admin/AdminNotifications"));
const AdminSecurity = lazy(() => import("./pages/admin/AdminSecurity"));
const AdminMFA = lazy(() => import("./pages/admin/AdminMFA"));
const AdminPermissions = lazy(() => import("./pages/admin/AdminPermissions"));
const AdminProfile = lazy(() => import("./pages/admin/AdminProfile"));
const AdminStripe = lazy(() => import("./pages/admin/AdminStripe"));
const AdminProtectedRoute = lazy(() => import("./components/AdminProtectedRoute"));

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000, // 5 minutos
      gcTime: 10 * 60 * 1000, // 10 minutos (antes cacheTime)
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
});

// Loading spinner para Suspense
const PageLoader = () => (
  <div className="flex items-center justify-center min-h-screen">
    <div className="flex flex-col items-center gap-4">
      <Loader2 className="h-8 w-8 animate-spin text-primary" />
      <p className="text-sm text-muted-foreground">Carregando...</p>
    </div>
  </div>
);

const pageVariants = {
  initial: { 
    opacity: 0, 
    y: 20,
    scale: 0.98
  },
  in: { 
    opacity: 1, 
    y: 0,
    scale: 1
  },
  out: { 
    opacity: 0, 
    y: -20,
    scale: 0.98
  }
};

const pageTransition = {
  type: "tween" as const,
  ease: "easeOut" as const,
  duration: 0.5
};

// Variantes específicas para diferentes tipos de página
const landingVariants = {
  initial: { opacity: 0, y: 30 },
  in: { opacity: 1, y: 0 },
  out: { opacity: 0, y: -30 }
};

const dashboardVariants = {
  initial: { opacity: 0, x: 30 },
  in: { opacity: 1, x: 0 },
  out: { opacity: 0, x: -30 }
};

const formVariants = {
  initial: { opacity: 0, scale: 0.95 },
  in: { opacity: 1, scale: 1 },
  out: { opacity: 0, scale: 0.95 }
};

const AnimatedRoutes = () => {
  const location = useLocation();

  return (
    <AnimatePresence mode="wait">
      <Routes location={location} key={location.pathname}>
        <Route path="/" element={
          <motion.div
            initial="initial"
            animate="in"
            exit="out"
            variants={landingVariants}
            transition={pageTransition}
          >
            <Landing />
          </motion.div>
        } />
        <Route path="/login" element={
          <motion.div
            initial="initial"
            animate="in"
            exit="out"
            variants={formVariants}
            transition={pageTransition}
          >
            <Login />
          </motion.div>
        } />
        <Route path="/cadastro" element={
          <motion.div
            initial="initial"
            animate="in"
            exit="out"
            variants={formVariants}
            transition={pageTransition}
          >
            <Cadastro />
          </motion.div>
        } />
        <Route path="/recuperar-senha" element={
          <motion.div
            initial="initial"
            animate="in"
            exit="out"
            variants={formVariants}
            transition={pageTransition}
          >
            <RecuperarSenha />
          </motion.div>
        } />
        <Route path="/reset-password" element={
          <motion.div
            initial="initial"
            animate="in"
            exit="out"
            variants={formVariants}
            transition={pageTransition}
          >
            <ResetPassword />
          </motion.div>
        } />
        <Route path="/dashboard" element={
          <ProtectedRoute>
            <motion.div
              initial="initial"
              animate="in"
              exit="out"
              variants={dashboardVariants}
              transition={pageTransition}
            >
              <Dashboard />
            </motion.div>
          </ProtectedRoute>
        } />
        <Route path="/onboarding" element={
          <ProtectedRoute>
            <motion.div
              initial="initial"
              animate="in"
              exit="out"
              variants={formVariants}
              transition={pageTransition}
            >
              <Onboarding />
            </motion.div>
          </ProtectedRoute>
        } />
        <Route path="/dashboard/importar" element={
          <ProtectedRoute>
            <motion.div
              initial="initial"
              animate="in"
              exit="out"
              variants={dashboardVariants}
              transition={pageTransition}
            >
              <ImportOrders />
            </motion.div>
          </ProtectedRoute>
        } />
        <Route path="/dashboard/perfil" element={
          <ProtectedRoute>
            <motion.div
              initial="initial"
              animate="in"
              exit="out"
              variants={formVariants}
              transition={pageTransition}
            >
              <Profile />
            </motion.div>
          </ProtectedRoute>
        } />
        <Route path="/dashboard/configuracoes" element={
          <ProtectedRoute>
            <motion.div
              initial="initial"
              animate="in"
              exit="out"
              variants={formVariants}
              transition={pageTransition}
            >
              <Settings />
            </motion.div>
          </ProtectedRoute>
        } />
        <Route path="/dashboard/notificacoes" element={
          <ProtectedRoute>
            <motion.div
              initial="initial"
              animate="in"
              exit="out"
              variants={dashboardVariants}
              transition={pageTransition}
            >
              <NotificationSettings />
            </motion.div>
          </ProtectedRoute>
        } />
        <Route path="/dashboard/analytics" element={
          <ProtectedRoute>
            <motion.div
              initial="initial"
              animate="in"
              exit="out"
              variants={dashboardVariants}
              transition={pageTransition}
            >
              <Analytics />
            </motion.div>
          </ProtectedRoute>
        } />
        <Route path="/dashboard/assinatura" element={
          <ProtectedRoute>
            <motion.div
              initial="initial"
              animate="in"
              exit="out"
              variants={formVariants}
              transition={pageTransition}
            >
              <Subscription />
            </motion.div>
          </ProtectedRoute>
        } />
        <Route path="/whatsapp-config" element={
          <ProtectedRoute>
            <motion.div
              initial="initial"
              animate="in"
              exit="out"
              variants={formVariants}
              transition={pageTransition}
            >
              <WhatsAppConfig />
            </motion.div>
          </ProtectedRoute>
        } />
        <Route path="/profile" element={
          <ProtectedRoute>
            <motion.div
              initial="initial"
              animate="in"
              exit="out"
              variants={formVariants}
              transition={pageTransition}
            >
              <Profile />
            </motion.div>
          </ProtectedRoute>
        } />
        <Route path="/settings" element={
          <ProtectedRoute>
            <motion.div
              initial="initial"
              animate="in"
              exit="out"
              variants={formVariants}
              transition={pageTransition}
            >
              <Settings />
            </motion.div>
          </ProtectedRoute>
        } />
        
        {/* OAuth Callbacks */}
        <Route path="/integrations/nuvemshop/callback" element={
          <ProtectedRoute>
            <NuvemshopCallback />
          </ProtectedRoute>
        } />
        <Route path="/integrations/mercadolivre/callback" element={
          <ProtectedRoute>
            <MercadoLivreCallback />
          </ProtectedRoute>
        } />
        <Route path="/integrations/shopify/callback" element={
          <ProtectedRoute>
            <ShopifyCallback />
          </ProtectedRoute>
        } />
        <Route path="/subscription" element={
          <ProtectedRoute>
            <motion.div
              initial="initial"
              animate="in"
              exit="out"
              variants={formVariants}
              transition={pageTransition}
            >
              <Subscription />
            </motion.div>
          </ProtectedRoute>
        } />
        
        {/* Admin Routes */}
        <Route path="/admin" element={
          <AdminProtectedRoute>
            <motion.div
              initial="initial"
              animate="in"
              exit="out"
              variants={dashboardVariants}
              transition={pageTransition}
            >
              <AdminDashboard />
            </motion.div>
          </AdminProtectedRoute>
        } />
        <Route path="/admin/users" element={
          <AdminProtectedRoute>
            <motion.div
              initial="initial"
              animate="in"
              exit="out"
              variants={dashboardVariants}
              transition={pageTransition}
            >
              <AdminUsers />
            </motion.div>
          </AdminProtectedRoute>
        } />
        <Route path="/admin/logs" element={
          <AdminProtectedRoute>
            <motion.div
              initial="initial"
              animate="in"
              exit="out"
              variants={dashboardVariants}
              transition={pageTransition}
            >
              <AdminLogs />
            </motion.div>
          </AdminProtectedRoute>
        } />
        <Route path="/admin/subscriptions" element={
          <AdminProtectedRoute>
            <motion.div
              initial="initial"
              animate="in"
              exit="out"
              variants={dashboardVariants}
              transition={pageTransition}
            >
              <AdminSubscriptions />
            </motion.div>
          </AdminProtectedRoute>
        } />
        <Route path="/admin/settings" element={
          <AdminProtectedRoute>
            <motion.div
              initial="initial"
              animate="in"
              exit="out"
              variants={dashboardVariants}
              transition={pageTransition}
            >
              <AdminSettings />
            </motion.div>
          </AdminProtectedRoute>
        } />
        <Route path="/admin/analytics" element={
          <AdminProtectedRoute>
            <motion.div
              initial="initial"
              animate="in"
              exit="out"
              variants={dashboardVariants}
              transition={pageTransition}
            >
              <AdminAnalytics />
            </motion.div>
          </AdminProtectedRoute>
        } />
        <Route path="/admin/orders" element={
          <AdminProtectedRoute>
            <motion.div
              initial="initial"
              animate="in"
              exit="out"
              variants={dashboardVariants}
              transition={pageTransition}
            >
              <AdminOrders />
            </motion.div>
          </AdminProtectedRoute>
        } />
        <Route path="/admin/database" element={
          <AdminProtectedRoute>
            <motion.div
              initial="initial"
              animate="in"
              exit="out"
              variants={dashboardVariants}
              transition={pageTransition}
            >
              <AdminDatabase />
            </motion.div>
          </AdminProtectedRoute>
        } />
        <Route path="/admin/features" element={
          <AdminProtectedRoute>
            <motion.div
              initial="initial"
              animate="in"
              exit="out"
              variants={dashboardVariants}
              transition={pageTransition}
            >
              <AdminFeatureFlags />
            </motion.div>
          </AdminProtectedRoute>
        } />
        <Route path="/admin/notifications" element={
          <AdminProtectedRoute>
            <motion.div
              initial="initial"
              animate="in"
              exit="out"
              variants={dashboardVariants}
              transition={pageTransition}
            >
              <AdminNotifications />
            </motion.div>
          </AdminProtectedRoute>
        } />
        <Route path="/admin/security" element={
          <AdminProtectedRoute>
            <motion.div
              initial="initial"
              animate="in"
              exit="out"
              variants={dashboardVariants}
              transition={pageTransition}
            >
              <AdminSecurity />
            </motion.div>
          </AdminProtectedRoute>
        } />
        <Route path="/admin/mfa" element={
          <AdminProtectedRoute>
            <motion.div
              initial="initial"
              animate="in"
              exit="out"
              variants={dashboardVariants}
              transition={pageTransition}
            >
              <AdminMFA />
            </motion.div>
          </AdminProtectedRoute>
        } />
        <Route path="/admin/permissions" element={
          <AdminProtectedRoute>
            <motion.div
              initial="initial"
              animate="in"
              exit="out"
              variants={dashboardVariants}
              transition={pageTransition}
            >
              <AdminPermissions />
            </motion.div>
          </AdminProtectedRoute>
        } />
        <Route path="/admin/profile" element={
          <AdminProtectedRoute>
            <motion.div
              initial="initial"
              animate="in"
              exit="out"
              variants={dashboardVariants}
              transition={pageTransition}
            >
              <AdminProfile />
            </motion.div>
          </AdminProtectedRoute>
        } />
        <Route path="/admin/stripe" element={
          <AdminProtectedRoute>
            <motion.div
              initial="initial"
              animate="in"
              exit="out"
              variants={dashboardVariants}
              transition={pageTransition}
            >
              <AdminStripe />
            </motion.div>
          </AdminProtectedRoute>
        } />
        
        {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
        <Route path="*" element={
          <motion.div
            initial="initial"
            animate="in"
            exit="out"
            variants={pageVariants}
            transition={pageTransition}
          >
            <NotFound />
          </motion.div>
        } />
      </Routes>
    </AnimatePresence>
  );
};

const App = () => (
  <ErrorBoundary>
    <ThemeProvider>
      <QueryClientProvider client={queryClient}>
        <TooltipProvider>
          <Toaster />
          <Sonner />
          <BrowserRouter>
            <Suspense fallback={<PageLoader />}>
              <AnimatedRoutes />
            </Suspense>
          </BrowserRouter>
        </TooltipProvider>
      </QueryClientProvider>
    </ThemeProvider>
  </ErrorBoundary>
);

export default App;
