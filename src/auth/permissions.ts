import type { Role } from "@/api/schemas";

export type Permission =
  "pos" | "products:read" | "products:write" | "products:delete" | "stock" | "reports" | "audit";

/** Mirrors the API's require_role() checks; the server remains the authority (403). */
const PERMISSIONS: Record<Role, readonly Permission[]> = {
  admin: ["pos", "products:read", "products:write", "products:delete", "stock", "reports", "audit"],
  manager: ["pos", "products:read", "products:write", "stock", "reports"],
  cashier: ["pos", "products:read"],
};

export function can(role: Role | undefined, permission: Permission): boolean {
  return role !== undefined && PERMISSIONS[role].includes(permission);
}

export const ROLE_LABELS: Record<Role, string> = {
  admin: "Administrador",
  manager: "Encargado",
  cashier: "Cajero",
};
