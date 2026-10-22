import { QueryClientProvider, type QueryClient } from "@tanstack/react-query";
import { lazy, Suspense } from "react";
import { Navigate, Route, Routes } from "react-router";

import { AuthProvider } from "@/auth/AuthProvider";
import { RequireAuth, RequirePermission } from "@/auth/guards";
import { Layout } from "@/components/Layout";
import { Spinner } from "@/components/ui/misc";
import { ToastProvider } from "@/components/ui/Toast";
import { AboutPage } from "@/features/about/AboutPage";
import { LoginPage } from "@/features/login/LoginPage";
import { PosPage } from "@/features/pos/PosPage";

// Back-office screens are split out of the initial (cashier) bundle.
const ProductsPage = lazy(() => import("@/features/products/ProductsPage"));
const StockPage = lazy(() => import("@/features/stock/StockPage"));
const ReportsPage = lazy(() => import("@/features/reports/ReportsPage"));
const AuditPage = lazy(() => import("@/features/audit/AuditPage"));

export function AppRoutes() {
  return (
    <Suspense fallback={<Spinner />}>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route
          element={
            <RequireAuth>
              <Layout />
            </RequireAuth>
          }
        >
          <Route index element={<Navigate to="/pos" replace />} />
          <Route path="/pos" element={<PosPage />} />
          <Route
            path="/productos"
            element={
              <RequirePermission permission="products:read">
                <ProductsPage />
              </RequirePermission>
            }
          />
          <Route
            path="/stock"
            element={
              <RequirePermission permission="stock">
                <StockPage />
              </RequirePermission>
            }
          />
          <Route
            path="/reportes"
            element={
              <RequirePermission permission="reports">
                <ReportsPage />
              </RequirePermission>
            }
          />
          <Route
            path="/auditoria"
            element={
              <RequirePermission permission="audit">
                <AuditPage />
              </RequirePermission>
            }
          />
          <Route path="/acerca" element={<AboutPage />} />
        </Route>
        <Route path="*" element={<Navigate to="/pos" replace />} />
      </Routes>
    </Suspense>
  );
}

export function AppProviders({
  queryClient,
  children,
}: {
  queryClient: QueryClient;
  children: React.ReactNode;
}) {
  return (
    <QueryClientProvider client={queryClient}>
      <ToastProvider>
        <AuthProvider>{children}</AuthProvider>
      </ToastProvider>
    </QueryClientProvider>
  );
}
