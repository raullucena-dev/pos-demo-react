import type { ReactNode } from "react";
import { Navigate, useLocation } from "react-router";

import { Spinner } from "@/components/ui/misc";
import { useAuth } from "./AuthProvider";
import { can, type Permission } from "./permissions";

export function RequireAuth({ children }: { children: ReactNode }) {
  const { user, isLoading } = useAuth();
  const location = useLocation();
  if (isLoading) return <Spinner label="Verificando sesión…" />;
  if (!user) return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  return children;
}

export function RequirePermission({
  permission,
  children,
}: {
  permission: Permission;
  children: ReactNode;
}) {
  const { user } = useAuth();
  if (!can(user?.role, permission)) return <Forbidden />;
  return children;
}

export function Forbidden() {
  return (
    <div className="mx-auto max-w-md py-12 text-center">
      <h1 className="text-xl font-semibold">Acceso restringido</h1>
      <p className="text-muted mt-2 text-sm">
        Tu rol no tiene permiso para ver esta sección. Pedile acceso a un administrador.
      </p>
    </div>
  );
}
