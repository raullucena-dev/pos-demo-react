import { z } from "zod";

import { apiRequest } from "./client";
import {
  auditEntrySchema,
  demoInfoSchema,
  noContent,
  productDeletedSchema,
  productSchema,
  saleSchema,
  saleSummarySchema,
  salesReportSchema,
  stockMovementSchema,
  userSchema,
} from "./schemas";

export interface Page {
  limit?: number;
  offset?: number;
}

/** Amounts are sent as decimal strings, matching the API's NUMERIC type. */
const toDecimal = (amount: number) => `${Math.round(amount)}.00`;

export const authApi = {
  login: (username: string, password: string) =>
    apiRequest("/auth/login", userSchema, {
      method: "POST",
      body: { username, password },
      skipUnauthorizedEvent: true,
    }),
  logout: () => apiRequest("/auth/logout", noContent, { method: "POST" }),
  me: () => apiRequest("/auth/me", userSchema, { skipUnauthorizedEvent: true }),
};

export const demoApi = {
  info: () => apiRequest("/demo/info", demoInfoSchema, { skipUnauthorizedEvent: true }),
};

export interface ProductInput {
  sku: string;
  name: string;
  price: number;
}

export const productsApi = {
  list: (params: Page & { q?: string } = {}, signal?: AbortSignal) =>
    apiRequest("/products", z.array(productSchema), {
      query: { limit: params.limit ?? 50, offset: params.offset ?? 0, q: params.q },
      signal,
    }),
  create: (input: ProductInput) =>
    apiRequest("/products", productSchema, {
      method: "POST",
      body: { ...input, price: toDecimal(input.price) },
    }),
  update: (id: number, input: Partial<ProductInput>) =>
    apiRequest(`/products/${id}`, productSchema, {
      method: "PATCH",
      body: { ...input, ...(input.price !== undefined && { price: toDecimal(input.price) }) },
    }),
  remove: (id: number) => apiRequest(`/products/${id}`, productDeletedSchema, { method: "DELETE" }),
};

export interface MovementInput {
  product_id: number;
  quantity: number;
  reason: "purchase" | "adjustment";
  note?: string | undefined;
}

export const stockApi = {
  list: (params: Page & { productId?: number | undefined } = {}) =>
    apiRequest("/stock-movements", z.array(stockMovementSchema), {
      query: {
        limit: params.limit ?? 50,
        offset: params.offset ?? 0,
        product_id: params.productId,
      },
    }),
  create: (input: MovementInput) =>
    apiRequest("/stock-movements", stockMovementSchema, { method: "POST", body: input }),
  reverse: (id: number) =>
    apiRequest(`/stock-movements/${id}`, stockMovementSchema, { method: "DELETE" }),
};

export interface SaleLineInput {
  product_id: number;
  quantity: number;
}

export const salesApi = {
  create: (items: SaleLineInput[]) =>
    apiRequest("/sales", saleSchema, { method: "POST", body: { items } }),
  list: (params: Page = {}) =>
    apiRequest("/sales", z.array(saleSummarySchema), {
      query: { limit: params.limit ?? 50, offset: params.offset ?? 0 },
    }),
  report: (dateFrom: string, dateTo: string) =>
    apiRequest("/reports/sales", salesReportSchema, {
      query: { date_from: dateFrom, date_to: dateTo },
    }),
};

export const auditApi = {
  list: (params: Page & { entityType?: string | undefined } = {}) =>
    apiRequest("/audit-log", z.array(auditEntrySchema), {
      query: {
        limit: params.limit ?? 50,
        offset: params.offset ?? 0,
        entity_type: params.entityType,
      },
    }),
};

export const usersApi = {
  list: () => apiRequest("/users", z.array(userSchema), { query: { limit: 200 } }),
};

/** Query keys in one place so invalidation stays consistent. */
export const queryKeys = {
  me: ["auth", "me"] as const,
  demoInfo: ["demo", "info"] as const,
  products: (params: object = {}) => ["products", params] as const,
  productsAll: ["products"] as const,
  stock: (params: object = {}) => ["stock", params] as const,
  stockAll: ["stock"] as const,
  sales: ["sales"] as const,
  report: (from: string, to: string) => ["reports", "sales", from, to] as const,
  reportsAll: ["reports"] as const,
  audit: (params: object = {}) => ["audit", params] as const,
  users: ["users"] as const,
};
