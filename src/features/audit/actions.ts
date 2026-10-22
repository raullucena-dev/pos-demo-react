const ACTIONS: Record<string, string> = {
  "auth.login": "Inicio de sesión",
  "auth.logout": "Cierre de sesión",
  "auth.login_failed": "Login fallido",
  "auth.account_locked": "Cuenta bloqueada",
  "product.create": "Producto creado",
  "product.update": "Producto modificado",
  "product.delete": "Producto eliminado",
  "stock.create": "Movimiento de stock",
  "stock.reverse": "Movimiento revertido",
  "sale.create": "Venta",
  "user.create": "Usuario creado",
  "user.update": "Usuario modificado",
};

export function describeAction(action: string): string {
  return ACTIONS[action] ?? action;
}
