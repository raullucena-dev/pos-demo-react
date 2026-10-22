import { z } from "zod";

import type { SalesReport } from "@/api/schemas";
import type { CsvValue } from "@/lib/csv";
import { dateRange, daysBetween } from "@/lib/dates";
import type { DailyPoint } from "./RevenueChart";

const MAX_RANGE_DAYS = 366;

export const rangeSchema = z
  .object({
    dateFrom: z.iso.date({ message: "Fecha inválida" }),
    dateTo: z.iso.date({ message: "Fecha inválida" }),
  })
  .refine((v) => v.dateFrom <= v.dateTo, {
    path: ["dateTo"],
    message: "La fecha final no puede ser anterior a la inicial",
  })
  .refine((v) => daysBetween(v.dateFrom, v.dateTo) < MAX_RANGE_DAYS, {
    path: ["dateTo"],
    message: "El rango no puede superar 366 días",
  });
export type Range = z.infer<typeof rangeSchema>;

/** Fills days without sales so the chart has one bar per calendar day. */
export function dailySeries(report: SalesReport): DailyPoint[] {
  const byDay = new Map(report.daily.map((d) => [d.day, d]));
  return dateRange(report.date_from, report.date_to).map((day) => ({
    day,
    revenue: byDay.get(day)?.revenue ?? 0,
    salesCount: byDay.get(day)?.sales_count ?? 0,
  }));
}

export function reportCsvRows(report: SalesReport): CsvValue[][] {
  return [
    ["Reporte de ventas", `${report.date_from} a ${report.date_to}`],
    ["Ventas", report.sales_count],
    ["Ingresos (Gs.)", report.revenue],
    ["Artículos vendidos", report.items_sold],
    [],
    ["Día", "Ventas", "Ingresos (Gs.)"],
    ...dailySeries(report).map((d) => [d.day, d.salesCount, d.revenue]),
    [],
    ["Producto", "SKU", "Cantidad", "Ingresos (Gs.)"],
    ...report.top_products.map((p) => [p.name, p.sku, p.quantity, p.revenue]),
  ];
}
