import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { NavLink, Outlet } from "react-router";

import { demoApi, queryKeys } from "@/api/endpoints";
import { useAuth } from "@/auth/AuthProvider";
import { can, ROLE_LABELS, type Permission } from "@/auth/permissions";
import { ThemeToggle } from "./ThemeToggle";

const NAV: { to: string; label: string; permission?: Permission }[] = [
  { to: "/pos", label: "Caja", permission: "pos" },
  { to: "/productos", label: "Productos", permission: "products:read" },
  { to: "/stock", label: "Stock", permission: "stock" },
  { to: "/reportes", label: "Reportes", permission: "reports" },
  { to: "/auditoria", label: "Auditoría", permission: "audit" },
  { to: "/acerca", label: "Cómo funciona" },
];

/** The demo exposes store names; outside demo mode we fall back to the tenant id. */
function useStoreName(username: string | undefined, tenantId: number | undefined) {
  const info = useQuery({
    queryKey: queryKeys.demoInfo,
    queryFn: demoApi.info,
    retry: false,
    staleTime: Infinity,
  });
  const store = info.data?.stores.find((s) => s.users.some((u) => u.username === username));
  return store?.name ?? (tenantId ? `Tienda #${tenantId}` : "");
}

export function Layout() {
  const { user, logout } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);
  const storeName = useStoreName(user?.username, user?.tenant_id);
  const links = NAV.filter((item) => !item.permission || can(user?.role, item.permission));

  return (
    <div className="flex min-h-dvh flex-col">
      <a
        href="#main"
        className="focus:bg-surface sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-50 focus:rounded focus:px-3 focus:py-2"
      >
        Saltar al contenido
      </a>
      <header className="border-border bg-surface/95 sticky top-0 z-30 border-b backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center gap-3 px-4 py-3">
          <button
            type="button"
            className="border-border inline-flex size-9 items-center justify-center rounded-md border md:hidden"
            aria-expanded={menuOpen}
            aria-controls="main-nav"
            aria-label="Menú"
            onClick={() => setMenuOpen((open) => !open)}
          >
            <span aria-hidden="true">☰</span>
          </button>
          <div className="min-w-0 flex-1 md:flex-none">
            <p className="text-fg truncate text-sm font-semibold">{storeName}</p>
            {user && (
              <p className="text-muted truncate text-xs">
                {user.full_name} · {ROLE_LABELS[user.role]}
              </p>
            )}
          </div>
          <nav
            id="main-nav"
            aria-label="Principal"
            className={`${menuOpen ? "flex" : "hidden"} border-border bg-surface absolute top-full right-0 left-0 flex-col gap-1 border-b p-3 md:static md:flex md:flex-1 md:flex-row md:justify-center md:border-0 md:p-0`}
          >
            {links.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                onClick={() => setMenuOpen(false)}
                className={({ isActive }) =>
                  `focus-visible:outline-focus rounded-md px-3 py-2 text-sm font-medium focus-visible:outline-2 ${
                    isActive
                      ? "bg-primary-soft text-primary-strong"
                      : "text-muted hover:bg-surface-2 hover:text-fg"
                  }`
                }
              >
                {item.label}
              </NavLink>
            ))}
          </nav>
          <ThemeToggle />
          <button
            type="button"
            onClick={() => void logout()}
            className="text-muted hover:bg-surface-2 hover:text-fg focus-visible:outline-focus rounded-md px-3 py-2 text-sm font-medium focus-visible:outline-2"
          >
            Salir
          </button>
        </div>
      </header>
      <main id="main" className="mx-auto w-full max-w-7xl flex-1 px-4 pt-6 pb-24 lg:pb-6">
        <Outlet />
      </main>
    </div>
  );
}
