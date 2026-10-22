import { screen, waitFor, within } from "@testing-library/react";

import { db } from "@/mocks/db";
import { renderApp } from "@/test/render";
import { movementFormSchema } from "./movementForm";

describe("movement form validation", () => {
  it.each([
    [{ product_id: "", reason: "purchase", quantity: "1" }, "Elegí un producto"],
    [{ product_id: "1", reason: "purchase", quantity: "0" }, "no puede ser cero"],
    [{ product_id: "1", reason: "purchase", quantity: "-2" }, "Una compra debe sumar stock"],
    [{ product_id: "1", reason: "adjustment", quantity: "1.5" }, "número entero"],
    [{ product_id: "1", reason: "adjustment", quantity: "200000" }, "Máximo 100.000"],
  ])("rejects %j", (input, message) => {
    const result = movementFormSchema.safeParse(input);
    expect(result.success).toBe(false);
    expect(JSON.stringify(result.error?.issues)).toContain(message);
  });

  it("accepts negative adjustments", () => {
    expect(
      movementFormSchema.parse({
        product_id: "4",
        reason: "adjustment",
        quantity: "-2",
        note: "rotura",
      }),
    ).toEqual({
      product_id: 4,
      reason: "adjustment",
      quantity: -2,
      note: "rotura",
    });
  });
});

describe("stock page", () => {
  it("lists the ledger and records a purchase", async () => {
    const { user } = renderApp("/stock", { username: "north.manager" });
    expect((await screen.findAllByText("Compra")).length).toBeGreaterThan(0);

    await user.click(screen.getByRole("button", { name: "Nuevo movimiento" }));
    const dialog = within(screen.getByRole("dialog"));
    const queso = db.products.find((p) => p.sku === "ALM-004")!;
    await user.selectOptions(dialog.getByLabelText("Producto"), String(queso.id));
    await user.type(dialog.getByLabelText("Cantidad"), "12");
    await user.type(dialog.getByLabelText("Nota (opcional)"), "Reposición");
    await user.click(dialog.getByRole("button", { name: "Registrar movimiento" }));

    expect(await screen.findByText("Movimiento registrado.")).toBeInTheDocument();
    expect(queso.stock_quantity).toBe(15);
    expect(await screen.findByText("+12")).toBeInTheDocument();
  });

  it("explains when an adjustment would leave negative stock", async () => {
    const { user } = renderApp("/stock", { username: "north.manager" });
    await screen.findAllByText("Compra");
    await user.click(screen.getByRole("button", { name: "Nuevo movimiento" }));
    const dialog = within(screen.getByRole("dialog"));
    const queso = db.products.find((p) => p.sku === "ALM-004")!;
    await user.selectOptions(dialog.getByLabelText("Producto"), String(queso.id));
    await user.selectOptions(dialog.getByLabelText("Tipo"), "adjustment");
    await user.type(dialog.getByLabelText("Cantidad"), "-10");
    await user.click(dialog.getByRole("button", { name: "Registrar movimiento" }));
    expect(
      await dialog.findByText(/dejaría el stock en negativo \(disponible: 3\)/),
    ).toBeInTheDocument();
  });

  it("reverses a movement with a compensating entry", async () => {
    const { user } = renderApp("/stock", { username: "north.admin" });
    const leche = db.products.find((p) => p.sku === "ALM-005")!;
    const movement = db.movements.find((m) => m.product_id === leche.id)!;
    await user.click(
      await screen.findByRole("button", { name: `Revertir movimiento ${movement.id}` }),
    );
    await user.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Revertir" }));
    expect(
      await screen.findByText("Movimiento revertido con un asiento compensatorio."),
    ).toBeInTheDocument();
    expect(leche.stock_quantity).toBe(0);
    expect(await screen.findByText("Reversión")).toBeInTheDocument();
    await waitFor(() =>
      expect(
        screen.queryByRole("button", { name: `Revertir movimiento ${movement.id}` }),
      ).not.toBeInTheDocument(),
    );
  });

  it("reports why a reversal is impossible", async () => {
    const yerba = db.products.find((p) => p.sku === "ALM-001")!;
    const purchase = db.movements.find((m) => m.product_id === yerba.id)!;
    yerba.stock_quantity = 5; // most of the purchase was already sold
    const { user } = renderApp("/stock", { username: "north.manager" });
    await user.click(
      await screen.findByRole("button", { name: `Revertir movimiento ${purchase.id}` }),
    );
    await user.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Revertir" }));
    expect(
      await screen.findByText(/No se puede revertir: el stock quedaría negativo \(disponible: 5\)/),
    ).toBeInTheDocument();
  });

  it("filters by product", async () => {
    const { user } = renderApp("/stock", { username: "north.manager" });
    await screen.findAllByText("Compra");
    const chipa = db.products.find((p) => p.sku === "ALM-002")!;
    await user.selectOptions(screen.getByLabelText("Filtrar por producto"), String(chipa.id));
    await waitFor(() => expect(screen.getAllByRole("row")).toHaveLength(2));
    expect(within(screen.getAllByRole("row")[1]!).getByText("Chipa (docena)")).toBeInTheDocument();
  });
});
