import { screen, waitFor, within } from "@testing-library/react";
import { http, HttpResponse } from "msw";

import { db } from "@/mocks/db";
import { server } from "@/mocks/server";
import { renderApp } from "@/test/render";

const normalize = (s: string | null) => (s ?? "").replace(/\s/g, " ");

async function openPos() {
  const utils = renderApp("/pos", { username: "north.cashier" });
  await screen.findByText("Yerba mate 500 g");
  return utils;
}

describe("POS", () => {
  it("builds a cart and shows PYG totals without decimals", async () => {
    const { user } = await openPos();
    await user.click(screen.getByRole("button", { name: /Agregar Yerba mate 500 g/ }));
    await user.click(screen.getByRole("button", { name: /Agregar Yerba mate 500 g/ }));
    await user.click(screen.getByRole("button", { name: /Agregar Chipa/ }));

    expect(normalize(screen.getByTestId("cart-total").textContent)).toBe("Gs. 52.000");
    const cart = within(screen.getByRole("list", { name: "Productos en el carrito" }));
    expect(cart.getByLabelText("Cantidad de Yerba mate 500 g")).toHaveValue(2);

    await user.click(cart.getByRole("button", { name: "Quitar una unidad de Yerba mate 500 g" }));
    expect(normalize(screen.getByTestId("cart-total").textContent)).toBe("Gs. 33.500");
    await user.click(cart.getByRole("button", { name: "Eliminar Chipa (docena) del carrito" }));
    expect(normalize(screen.getByTestId("cart-total").textContent)).toBe("Gs. 18.500");
  });

  it("disables products without stock and caps quantities at the available stock", async () => {
    const { user } = await openPos();
    expect(screen.getByRole("button", { name: /Agregar Gaseosa cola/ })).toBeDisabled();

    const queso = screen.getByRole("button", { name: /Agregar Queso Paraguay/ });
    await user.click(queso);
    await user.click(queso);
    await user.click(queso);
    expect(queso).toBeDisabled(); // 3 in stock, 3 in the cart
    expect(
      screen.getByRole("button", { name: "Agregar una unidad de Queso Paraguay 1 kg" }),
    ).toBeDisabled();

    const input = screen.getByLabelText("Cantidad de Queso Paraguay 1 kg");
    await user.clear(input);
    await user.type(input, "9");
    expect(input).toHaveValue(3);
  });

  it("checks out, clears the cart and refreshes stock", async () => {
    const { user } = await openPos();
    await user.click(screen.getByRole("button", { name: /Agregar Mandioca/ }));
    await user.click(screen.getByRole("button", { name: /Cobrar/ }));

    expect(await screen.findByText(/Venta #\d+ registrada/)).toHaveTextContent("Gs.");
    expect(screen.getByText("El carrito está vacío.")).toBeInTheDocument();
    expect(await screen.findByText("119 disp.")).toBeInTheDocument();
    expect(db.sales).toHaveLength(1);
  });

  it("explains insufficient stock and rolls back the optimistic update", async () => {
    const { user } = await openPos();
    const yerba = db.products.find((p) => p.sku === "ALM-001")!;
    await user.click(screen.getByRole("button", { name: /Agregar Yerba mate 500 g/ }));
    await user.click(screen.getByRole("button", { name: /Agregar Yerba mate 500 g/ }));

    // Someone else sold almost everything meanwhile.
    yerba.stock_quantity = 1;
    server.use(
      http.get("*/api/products", async () => {
        await new Promise((resolve) => setTimeout(resolve, 50));
        return HttpResponse.json([db.productOut(yerba)]);
      }),
    );
    await user.click(screen.getByRole("button", { name: /Cobrar/ }));

    expect(
      await screen.findByText(
        /Stock insuficiente para «Yerba mate 500 g»: disponible 1, en el carrito 2/,
      ),
    ).toBeInTheDocument();
    expect(db.sales).toHaveLength(0);
    // The cart is kept, trimmed to the stock that is really available.
    await waitFor(() =>
      expect(screen.getByLabelText("Cantidad de Yerba mate 500 g")).toHaveValue(1),
    );
    expect(screen.getByRole("button", { name: /Agregar Yerba mate 500 g/ })).toHaveTextContent(
      "Sin stock",
    );
  });

  it("shows other checkout errors", async () => {
    server.use(http.post("*/api/sales", () => HttpResponse.error()));
    const { user } = await openPos();
    await user.click(screen.getByRole("button", { name: /Agregar Mandioca/ }));
    await user.click(screen.getByRole("button", { name: /Cobrar/ }));
    expect(await screen.findByText(/No se pudo conectar/)).toBeInTheDocument();
  });

  it("searches the catalogue", async () => {
    const { user } = await openPos();
    await user.type(screen.getByLabelText("Buscar productos"), "queso");
    await waitFor(() => expect(screen.queryByText("Yerba mate 500 g")).not.toBeInTheDocument());
    expect(screen.getByText("Queso Paraguay 1 kg")).toBeInTheDocument();
    await user.clear(screen.getByLabelText("Buscar productos"));
    await user.type(screen.getByLabelText("Buscar productos"), "zzz");
    expect(await screen.findByText(/No hay productos que coincidan/)).toBeInTheDocument();
  });

  it("can empty the cart", async () => {
    const { user } = await openPos();
    await user.click(screen.getByRole("button", { name: /Agregar Mandioca/ }));
    await user.click(screen.getByRole("button", { name: "Vaciar" }));
    expect(screen.getByText("El carrito está vacío.")).toBeInTheDocument();
  });
});
