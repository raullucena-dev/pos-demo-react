import { screen, waitFor, within } from "@testing-library/react";

import type { SalesReport } from "@/api/schemas";
import { db } from "@/mocks/db";
import { todayInParaguay } from "@/lib/dates";
import { renderApp } from "@/test/render";
import { dailySeries, rangeSchema, reportCsvRows } from "./reportData";

const report: SalesReport = {
  date_from: "2026-10-01",
  date_to: "2026-10-03",
  sales_count: 2,
  revenue: 30000,
  items_sold: 3,
  daily: [{ day: "2026-10-02", sales_count: 2, revenue: 30000 }],
  top_products: [
    { product_id: 1, sku: "ALM-001", name: "Yerba, 500 g", quantity: 3, revenue: 30000 },
  ],
};

describe("report helpers", () => {
  it("fills days without sales", () => {
    expect(dailySeries(report)).toEqual([
      { day: "2026-10-01", revenue: 0, salesCount: 0 },
      { day: "2026-10-02", revenue: 30000, salesCount: 2 },
      { day: "2026-10-03", revenue: 0, salesCount: 0 },
    ]);
  });

  it("builds CSV rows for totals, days and top products", () => {
    const rows = reportCsvRows(report);
    expect(rows[0]).toEqual(["Reporte de ventas", "2026-10-01 a 2026-10-03"]);
    expect(rows).toContainEqual(["2026-10-02", 2, 30000]);
    expect(rows.at(-1)).toEqual(["Yerba, 500 g", "ALM-001", 3, 30000]);
  });

  it("validates the date range", () => {
    expect(rangeSchema.safeParse({ dateFrom: "2026-10-05", dateTo: "2026-10-01" }).success).toBe(
      false,
    );
    expect(rangeSchema.safeParse({ dateFrom: "2024-01-01", dateTo: "2026-01-01" }).success).toBe(
      false,
    );
    expect(rangeSchema.safeParse({ dateFrom: "x", dateTo: "2026-01-01" }).success).toBe(false);
    expect(rangeSchema.safeParse({ dateFrom: "2026-01-01", dateTo: "2026-12-31" }).success).toBe(
      true,
    );
  });
});

describe("reports page", () => {
  it("shows totals, a chart and top products for today's sales", async () => {
    db.login("north.cashier", "demo1234");
    const cashier = db.currentUser();
    const yerba = db.products.find((p) => p.sku === "ALM-001")!;
    db.createSale(cashier, [{ product_id: yerba.id, quantity: 2 }]);
    db.expireSession();

    renderApp("/reportes", { username: "north.manager" });
    const revenue = await screen.findByText("Ingresos", { selector: "p" });
    expect(revenue.nextSibling?.textContent?.replace(/\s/g, " ")).toBe("Gs. 37.000");
    expect(screen.getByRole("img", { name: /Ingresos por día/ })).toBeInTheDocument();
    const table = screen.getAllByRole("table").at(-1)!;
    expect(within(table).getByText("Yerba mate 500 g")).toBeInTheDocument();
  });

  it("shows an empty state for a period without sales and validates the form", async () => {
    const { user } = renderApp("/reportes", { username: "north.admin" });
    expect(await screen.findByText("No hubo ventas en este período.")).toBeInTheDocument();
    const to = screen.getByLabelText("Hasta");
    await user.clear(to);
    await user.type(to, "2000-01-01");
    await user.click(screen.getByRole("button", { name: "Actualizar" }));
    expect(
      await screen.findByText("La fecha final no puede ser anterior a la inicial"),
    ).toBeInTheDocument();
  });

  it("queries the selected range", async () => {
    const { user } = renderApp("/reportes", { username: "north.admin" });
    await screen.findByText("No hubo ventas en este período.");
    const today = todayInParaguay();
    const from = screen.getByLabelText("Desde");
    await user.clear(from);
    await user.type(from, today);
    await user.click(screen.getByRole("button", { name: "Actualizar" }));
    await waitFor(() => expect(screen.getByLabelText("Desde")).toHaveValue(today));
  });

  it("exports the report as CSV", async () => {
    const createObjectURL = vi.fn(() => "blob:report");
    vi.stubGlobal("URL", Object.assign(URL, { createObjectURL, revokeObjectURL: vi.fn() }));
    const click = vi
      .spyOn(HTMLAnchorElement.prototype, "click")
      .mockImplementation(() => undefined);
    const { user } = renderApp("/reportes", { username: "north.admin" });
    await user.click(await screen.findByRole("button", { name: "Exportar CSV" }));
    expect(createObjectURL).toHaveBeenCalledOnce();
    expect(click).toHaveBeenCalledOnce();
    click.mockRestore();
    vi.unstubAllGlobals();
  });
});
