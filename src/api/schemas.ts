import { z } from "zod";

import { parseMoney } from "@/lib/money";

/** Decimal strings from the API (NUMERIC(12,2)) become whole guaraníes. */
const money = z
  .string()
  .regex(/^-?\d+(\.\d+)?$/, "expected a decimal string")
  .transform(parseMoney);

const isoDateTime = z.string().refine((v) => !Number.isNaN(Date.parse(v)), "invalid date-time");
const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

export const roleSchema = z.enum(["admin", "manager", "cashier"]);
export type Role = z.infer<typeof roleSchema>;

export const userSchema = z.object({
  id: z.number().int(),
  tenant_id: z.number().int(),
  username: z.string(),
  full_name: z.string(),
  role: roleSchema,
  is_active: z.boolean(),
  created_at: isoDateTime,
});
export type User = z.infer<typeof userSchema>;

export const productSchema = z.object({
  id: z.number().int(),
  sku: z.string(),
  name: z.string(),
  price: money,
  stock_quantity: z.number().int(),
  created_at: isoDateTime,
  updated_at: isoDateTime,
});
export type Product = z.infer<typeof productSchema>;

export const productDeletedSchema = z.object({
  id: z.number().int(),
  mode: z.enum(["soft", "hard"]),
});
export type ProductDeleted = z.infer<typeof productDeletedSchema>;

export const movementReasonSchema = z.enum(["purchase", "adjustment", "sale", "reversal"]);
export type MovementReason = z.infer<typeof movementReasonSchema>;

export const stockMovementSchema = z.object({
  id: z.number().int(),
  product_id: z.number().int(),
  quantity: z.number().int(),
  reason: movementReasonSchema,
  note: z.string().nullable(),
  created_by_id: z.number().int(),
  sale_id: z.number().int().nullable(),
  reversal_of_id: z.number().int().nullable(),
  reversed_at: isoDateTime.nullable(),
  created_at: isoDateTime,
});
export type StockMovement = z.infer<typeof stockMovementSchema>;

export const saleItemSchema = z.object({
  product_id: z.number().int(),
  quantity: z.number().int(),
  unit_price: money,
  line_total: money,
});

export const saleSchema = z.object({
  id: z.number().int(),
  cashier_id: z.number().int(),
  total: money,
  created_at: isoDateTime,
  items: z.array(saleItemSchema),
});
export type Sale = z.infer<typeof saleSchema>;

export const saleSummarySchema = saleSchema.omit({ items: true });
export type SaleSummary = z.infer<typeof saleSummarySchema>;

export const salesReportSchema = z.object({
  date_from: isoDate,
  date_to: isoDate,
  sales_count: z.number().int(),
  revenue: money,
  items_sold: z.number().int(),
  daily: z.array(z.object({ day: isoDate, sales_count: z.number().int(), revenue: money })),
  top_products: z.array(
    z.object({
      product_id: z.number().int(),
      sku: z.string(),
      name: z.string(),
      quantity: z.number().int(),
      revenue: money,
    }),
  ),
});
export type SalesReport = z.infer<typeof salesReportSchema>;

export const auditEntrySchema = z.object({
  id: z.number().int(),
  actor_user_id: z.number().int().nullable(),
  action: z.string(),
  entity_type: z.string(),
  entity_id: z.number().int().nullable(),
  details: z.record(z.string(), z.unknown()),
  created_at: isoDateTime,
});
export type AuditEntry = z.infer<typeof auditEntrySchema>;

export const demoInfoSchema = z.object({
  password: z.string(),
  stores: z.array(
    z.object({
      name: z.string(),
      slug: z.string(),
      users: z.array(z.object({ username: z.string(), role: roleSchema })),
    }),
  ),
  notes: z.array(z.string()).default([]),
});
export type DemoInfo = z.infer<typeof demoInfoSchema>;

export const noContent = z.unknown().transform(() => undefined);
