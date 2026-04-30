import { lazy, Suspense } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster } from 'sonner';
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/context/AuthContext";
import { NotificationProvider } from "@/context/NotificationContext";
import { OrderProvider } from "@/context/OrderContext";
import { AppLayout } from "@/components/AppLayout";
import { Skeleton } from "@/components/ui/skeleton";

// Lazy loading components for performance
const Index = lazy(() => import("./pages/Index"));
const Login = lazy(() => import("./pages/Login"));
const Kiosko = lazy(() => import("./pages/Kiosko"));
const Caja = lazy(() => import("./pages/Caja"));
const Cocina = lazy(() => import("./pages/Cocina"));
const Dashboard = lazy(() => import("./pages/Dashboard"));
const Reporteria = lazy(() => import("./pages/Reporteria"));
const Inventario = lazy(() => import("./pages/Inventario"));
const Usuarios = lazy(() => import("./pages/Usuarios"));
const NotFound = lazy(() => import("./pages/NotFound"));

const PageLoading = () => (
  <div className="p-8 space-y-4">
    <Skeleton className="h-12 w-full max-w-md" />
    <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
      {[1, 2, 3, 4, 5, 6].map(i => <Skeleton key={i} className="aspect-square w-full" />)}
    </div>
  </div>
);

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5, // 5 minutes
      gcTime: 1000 * 60 * 30, // 30 minutes
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster position="top-center" richColors/>
      <AuthProvider>
        <NotificationProvider>
          <OrderProvider>
            <BrowserRouter>
              <Suspense fallback={<PageLoading />}>
                <Routes>
                  <Route path="/login" element={<Login />} />
                  <Route element={<AppLayout />}>
                    <Route path="/" element={<Index />} />
                    <Route path="/dashboard" element={<Dashboard />} />
                    <Route path="/kiosko" element={<Kiosko />} />
                    <Route path="/caja" element={<Caja />} />
                    <Route path="/cocina" element={<Cocina />} />
                    <Route path="/reporteria" element={<Reporteria />} />
                    <Route path="/inventario" element={<Inventario />} />
                    <Route path="/usuarios" element={<Usuarios />} />
                  </Route>
                  <Route path="*" element={<NotFound />} />
                </Routes>
              </Suspense>
            </BrowserRouter>
          </OrderProvider>
        </NotificationProvider>
      </AuthProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
