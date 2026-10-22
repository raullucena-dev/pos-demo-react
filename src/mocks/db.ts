/**
 * In-memory stand-in for the fastapi-multitenant-rls API, used by tests (MSW in Node)
 * and by the e2e/offline build (MSW in the browser). It reproduces the contract that the
 * UI depends on: tenant scoping by session, role checks, error shapes and status codes.
 */

export type Role = "admin" | "manager" | "cashier";

interface MockUser {
  id: number;
  tenant_id: number;
  username: string;
  full_name: string;
  role: Role;
  is_active: boolean;
  created_at: string;
}

interface MockProduct {
  id: number;
  tenant_id: number;
  sku: string;
  name: string;
  price: number;
  stock_quantity: number;
  created_at: string;
  updated_at: string;
  deleted: boolean;
}

interface MockMovement {
  id: number;
  tenant_id: number;
  product_id: number;
  quantity: number;
  reason: "purchase" | "adjustment" | "sale" | "reversal";
  note: string | null;
  created_by_id: number;
  sale_id: number | null;
  reversal_of_id: number | null;
  reversed_at: string | null;
  created_at: string;
}

interface MockSale {
  id: number;
  tenant_id: number;
  cashier_id: number;
  total: number;
  created_at: string;
  items: { product_id: number; quantity: number; unit_price: number; line_total: number }[];
}

interface MockAudit {
  id: number;
  tenant_id: number;
  actor_user_id: number;
  action: string;
  entity_type: string;
  entity_id: number | null;
  details: Record<string, unknown>;
  created_at: string;
}

export class MockHttpError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
  ) {
    super(message);
  }
}

export const DEMO_PASSWORD = "demo1234";
export const STORES = [
  { tenantId: 1, name: "Demo Store North", slug: "north" },
  { tenantId: 2, name: "Demo Store South", slug: "south" },
] as const;

const SEED_PRODUCTS: Record<number, [string, string, number, number][]> = {
  1: [
    ["ALM-001", "Yerba mate 500 g", 18500, 80],
    ["ALM-002", "Chipa (docena)", 15000, 40],
    ["ALM-003", "Mandioca 1 kg", 5000, 120],
    ["ALM-004", "Queso Paraguay 1 kg", 42000, 3],
    ["ALM-005", "Leche entera 1 L", 6800, 60],
    ["ALM-006", "Gaseosa cola 2 L", 12500, 0],
  ],
  2: [
    ["FER-001", "Termo de acero 1 L", 120000, 15],
    ["FER-002", "Guampa de palo santo", 45000, 25],
    ["FER-003", "Martillo de carpintero 16 oz", 58000, 20],
    ["FER-004", "Cinta métrica 5 m", 32000, 30],
  ],
};

const money = (value: number) => `${Math.round(value)}.00`;
const STORAGE_KEY = "pos-demo-mock-session";

function readStoredSession(): number | null {
  try {
    const value = globalThis.sessionStorage.getItem(STORAGE_KEY);
    return value ? Number(value) : null;
  } catch {
    return null;
  }
}

function writeStoredSession(userId: number | null): void {
  try {
    if (userId === null) globalThis.sessionStorage.removeItem(STORAGE_KEY);
    else globalThis.sessionStorage.setItem(STORAGE_KEY, String(userId));
  } catch {
    // No storage (tests): the session lives in memory only.
  }
}

export class MockDb {
  users: MockUser[] = [];
  products: MockProduct[] = [];
  movements: MockMovement[] = [];
  sales: MockSale[] = [];
  audit: MockAudit[] = [];
  demoMode = true;
  private sessionUserId: number | null = null;
  private seq = 1;

  constructor() {
    this.reset();
  }

  private nextId(): number {
    return this.seq++;
  }

  reset(): void {
    this.seq = 1;
    this.users = [];
    this.products = [];
    this.movements = [];
    this.sales = [];
    this.audit = [];
    this.demoMode = true;
    const created = new Date(Date.now() - 14 * 86_400_000).toISOString();
    for (const store of STORES) {
      for (const role of ["admin", "manager", "cashier"] as const) {
        this.users.push({
          id: this.nextId(),
          tenant_id: store.tenantId,
          username: `${store.slug}.${role}`,
          full_name: `${role} ${store.slug}`,
          role,
          is_active: true,
          created_at: created,
        });
      }
      for (const [sku, name, price, stock] of SEED_PRODUCTS[store.tenantId] ?? []) {
        const product: MockProduct = {
          id: this.nextId(),
          tenant_id: store.tenantId,
          sku,
          name,
          price,
          stock_quantity: stock,
          created_at: created,
          updated_at: created,
          deleted: false,
        };
        this.products.push(product);
        if (stock > 0) {
          const manager = this.users.find(
            (u) => u.tenant_id === store.tenantId && u.role === "manager",
          );
          this.movements.push(this.movement(product, stock, "purchase", manager?.id ?? 0, created));
        }
      }
    }
    this.sessionUserId = readStoredSession();
  }

  private movement(
    product: MockProduct,
    quantity: number,
    reason: MockMovement["reason"],
    userId: number,
    createdAt = new Date().toISOString(),
    extra: Partial<MockMovement> = {},
  ): MockMovement {
    return {
      id: this.nextId(),
      tenant_id: product.tenant_id,
      product_id: product.id,
      quantity,
      reason,
      note: null,
      created_by_id: userId,
      sale_id: null,
      reversal_of_id: null,
      reversed_at: null,
      created_at: createdAt,
      ...extra,
    };
  }

  private record(
    user: MockUser,
    action: string,
    entityType: string,
    entityId: number | null,
    details = {},
  ) {
    this.audit.push({
      id: this.nextId(),
      tenant_id: user.tenant_id,
      actor_user_id: user.id,
      action,
      entity_type: entityType,
      entity_id: entityId,
      details,
      created_at: new Date().toISOString(),
    });
  }

  // --- Session -------------------------------------------------------------------------

  login(username: string, password: string): MockUser {
    const user = this.users.find((u) => u.username === username.trim().toLowerCase());
    if (!user || password !== DEMO_PASSWORD || !user.is_active) {
      throw new MockHttpError(401, "not_authenticated", "invalid username or password");
    }
    this.sessionUserId = user.id;
    writeStoredSession(user.id);
    this.record(user, "auth.login", "user", user.id);
    return user;
  }

  logout(): void {
    const user = this.currentUser();
    this.record(user, "auth.logout", "user", user.id);
    this.expireSession();
  }

  /** Simulates the server revoking or expiring the session. */
  expireSession(): void {
    this.sessionUserId = null;
    writeStoredSession(null);
  }

  currentUser(): MockUser {
    const user = this.users.find((u) => u.id === this.sessionUserId);
    if (!user) throw new MockHttpError(401, "not_authenticated", "not_authenticated");
    return user;
  }

  requireRole(...roles: Role[]): MockUser {
    const user = this.currentUser();
    if (!roles.includes(user.role)) {
      throw new MockHttpError(403, "forbidden", "insufficient role for this operation");
    }
    return user;
  }

  // --- Serialisers ---------------------------------------------------------------------

  productOut(p: MockProduct) {
    const { tenant_id: _tenant, deleted: _deleted, ...rest } = p;
    return { ...rest, price: money(p.price) };
  }

  movementOut(m: MockMovement) {
    const { tenant_id: _tenant, ...rest } = m;
    return rest;
  }

  saleOut(s: MockSale, withItems = true) {
    const base = {
      id: s.id,
      cashier_id: s.cashier_id,
      total: money(s.total),
      created_at: s.created_at,
    };
    if (!withItems) return base;
    return {
      ...base,
      items: s.items.map((i) => ({
        product_id: i.product_id,
        quantity: i.quantity,
        unit_price: money(i.unit_price),
        line_total: money(i.line_total),
      })),
    };
  }

  // --- Products ------------------------------------------------------------------------

  listProducts(user: MockUser, q: string, limit: number, offset: number) {
    const needle = q.toLowerCase();
    return this.products
      .filter((p) => p.tenant_id === user.tenant_id && !p.deleted)
      .filter(
        (p) =>
          !needle || p.name.toLowerCase().includes(needle) || p.sku.toLowerCase().includes(needle),
      )
      .slice(offset, offset + limit);
  }

  private findProduct(user: MockUser, id: number): MockProduct {
    const product = this.products.find(
      (p) => p.id === id && p.tenant_id === user.tenant_id && !p.deleted,
    );
    if (!product) throw new MockHttpError(404, "not_found", "product not found");
    return product;
  }

  private assertSkuFree(user: MockUser, sku: string, exceptId?: number) {
    if (
      this.products.some(
        (p) => p.tenant_id === user.tenant_id && !p.deleted && p.sku === sku && p.id !== exceptId,
      )
    ) {
      throw new MockHttpError(409, "conflict", "a product with this SKU already exists");
    }
  }

  createProduct(user: MockUser, input: { sku: string; name: string; price: string }) {
    this.assertSkuFree(user, input.sku);
    const now = new Date().toISOString();
    const product: MockProduct = {
      id: this.nextId(),
      tenant_id: user.tenant_id,
      sku: input.sku,
      name: input.name,
      price: Number(input.price),
      stock_quantity: 0,
      created_at: now,
      updated_at: now,
      deleted: false,
    };
    this.products.push(product);
    this.record(user, "product.create", "product", product.id, { sku: product.sku });
    return product;
  }

  updateProduct(
    user: MockUser,
    id: number,
    input: { sku?: string; name?: string; price?: string },
  ) {
    const product = this.findProduct(user, id);
    if (input.sku !== undefined) this.assertSkuFree(user, input.sku, id);
    if (input.sku !== undefined) product.sku = input.sku;
    if (input.name !== undefined) product.name = input.name;
    if (input.price !== undefined) product.price = Number(input.price);
    product.updated_at = new Date().toISOString();
    this.record(user, "product.update", "product", id, input);
    return product;
  }

  deleteProduct(user: MockUser, id: number): "soft" | "hard" {
    const product = this.findProduct(user, id);
    const referenced = this.movements.some((m) => m.product_id === id);
    if (referenced) product.deleted = true;
    else this.products = this.products.filter((p) => p.id !== id);
    const mode = referenced ? "soft" : "hard";
    this.record(user, "product.delete", "product", id, { mode });
    return mode;
  }

  // --- Stock ---------------------------------------------------------------------------

  listMovements(user: MockUser, productId: number | null, limit: number, offset: number) {
    return this.movements
      .filter(
        (m) => m.tenant_id === user.tenant_id && (productId === null || m.product_id === productId),
      )
      .sort((a, b) => b.id - a.id)
      .slice(offset, offset + limit);
  }

  private applyDelta(product: MockProduct, delta: number) {
    if (product.stock_quantity + delta < 0) {
      throw new MockHttpError(
        409,
        "insufficient_stock",
        `insufficient stock for product ${product.id}: have ${product.stock_quantity}, change ${delta}`,
      );
    }
    product.stock_quantity += delta;
  }

  createMovement(
    user: MockUser,
    input: {
      product_id: number;
      quantity: number;
      reason: "purchase" | "adjustment";
      note?: string;
    },
  ) {
    const product = this.findProduct(user, input.product_id);
    this.applyDelta(product, input.quantity);
    const movement = this.movement(product, input.quantity, input.reason, user.id, undefined, {
      note: input.note ?? null,
    });
    this.movements.push(movement);
    this.record(user, "stock.create", "stock_movement", movement.id);
    return movement;
  }

  reverseMovement(user: MockUser, id: number) {
    const original = this.movements.find((m) => m.id === id && m.tenant_id === user.tenant_id);
    if (!original) throw new MockHttpError(404, "not_found", "stock movement not found");
    if (original.reason === "sale" || original.reason === "reversal") {
      throw new MockHttpError(409, "conflict", `${original.reason} movements cannot be reversed`);
    }
    if (original.reversed_at)
      throw new MockHttpError(409, "conflict", "stock movement already reversed");
    const product = this.products.find((p) => p.id === original.product_id);
    if (!product) throw new MockHttpError(404, "not_found", "product not found");
    this.applyDelta(product, -original.quantity);
    original.reversed_at = new Date().toISOString();
    const reversal = this.movement(product, -original.quantity, "reversal", user.id, undefined, {
      reversal_of_id: original.id,
      note: `reversal of movement ${original.id}`,
    });
    this.movements.push(reversal);
    this.record(user, "stock.reverse", "stock_movement", original.id);
    return reversal;
  }

  // --- Sales ---------------------------------------------------------------------------

  createSale(user: MockUser, items: { product_id: number; quantity: number }[]): MockSale {
    const products = items.map((item) => {
      const product = this.products.find(
        (p) => p.id === item.product_id && p.tenant_id === user.tenant_id && !p.deleted,
      );
      if (!product)
        throw new MockHttpError(404, "not_found", `product not found: ${item.product_id}`);
      return product;
    });
    items.forEach((item, i) => {
      const product = products[i]!;
      if (product.stock_quantity < item.quantity) {
        throw new MockHttpError(
          409,
          "insufficient_stock",
          `insufficient stock for product ${product.id}: have ${product.stock_quantity}, requested ${item.quantity}`,
        );
      }
    });
    const sale: MockSale = {
      id: this.nextId(),
      tenant_id: user.tenant_id,
      cashier_id: user.id,
      total: 0,
      created_at: new Date().toISOString(),
      items: [],
    };
    items.forEach((item, i) => {
      const product = products[i]!;
      product.stock_quantity -= item.quantity;
      const line = product.price * item.quantity;
      sale.total += line;
      sale.items.push({
        product_id: product.id,
        quantity: item.quantity,
        unit_price: product.price,
        line_total: line,
      });
      this.movements.push(
        this.movement(product, -item.quantity, "sale", user.id, sale.created_at, {
          sale_id: sale.id,
        }),
      );
    });
    this.sales.push(sale);
    this.record(user, "sale.create", "sale", sale.id, { total: money(sale.total) });
    return sale;
  }

  listSales(user: MockUser, limit: number, offset: number) {
    return this.sales
      .filter(
        (s) =>
          s.tenant_id === user.tenant_id && (user.role !== "cashier" || s.cashier_id === user.id),
      )
      .sort((a, b) => b.id - a.id)
      .slice(offset, offset + limit);
  }

  report(user: MockUser, from: string, to: string) {
    if (to < from)
      throw new MockHttpError(400, "bad_request", "date_to must not be before date_from");
    const inRange = this.sales.filter((s) => {
      const day = s.created_at.slice(0, 10);
      return s.tenant_id === user.tenant_id && day >= from && day <= to;
    });
    const daily = new Map<string, { sales_count: number; revenue: number }>();
    const top = new Map<number, { quantity: number; revenue: number }>();
    let itemsSold = 0;
    for (const sale of inRange) {
      const day = sale.created_at.slice(0, 10);
      const entry = daily.get(day) ?? { sales_count: 0, revenue: 0 };
      entry.sales_count += 1;
      entry.revenue += sale.total;
      daily.set(day, entry);
      for (const item of sale.items) {
        itemsSold += item.quantity;
        const t = top.get(item.product_id) ?? { quantity: 0, revenue: 0 };
        t.quantity += item.quantity;
        t.revenue += item.line_total;
        top.set(item.product_id, t);
      }
    }
    return {
      date_from: from,
      date_to: to,
      sales_count: inRange.length,
      revenue: money(inRange.reduce((sum, s) => sum + s.total, 0)),
      items_sold: itemsSold,
      daily: [...daily.entries()]
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([day, d]) => ({ day, sales_count: d.sales_count, revenue: money(d.revenue) })),
      top_products: [...top.entries()]
        .sort((a, b) => b[1].quantity - a[1].quantity)
        .slice(0, 5)
        .map(([productId, t]) => {
          const p = this.products.find((x) => x.id === productId);
          return {
            product_id: productId,
            sku: p?.sku ?? "",
            name: p?.name ?? "",
            quantity: t.quantity,
            revenue: money(t.revenue),
          };
        }),
    };
  }

  listAudit(user: MockUser, entityType: string | null, limit: number, offset: number) {
    return this.audit
      .filter(
        (a) => a.tenant_id === user.tenant_id && (!entityType || a.entity_type === entityType),
      )
      .sort((a, b) => b.id - a.id)
      .slice(offset, offset + limit)
      .map(({ tenant_id: _tenant, ...rest }) => rest);
  }

  listUsers(user: MockUser) {
    return this.users.filter((u) => u.tenant_id === user.tenant_id);
  }

  demoInfo() {
    return {
      password: DEMO_PASSWORD,
      stores: STORES.map((store) => ({
        name: store.name,
        slug: store.slug,
        users: (["admin", "manager", "cashier"] as const).map((role) => ({
          username: `${store.slug}.${role}`,
          role,
        })),
      })),
      notes: ["Mock backend"],
    };
  }
}

export const db = new MockDb();
