import { screen, waitFor, within } from "@testing-library/react";
import { http, HttpResponse } from "msw";

import { db } from "@/mocks/db";
import { server } from "@/mocks/server";
import { renderApp } from "@/test/render";
import { productFormSchema } from "./productForm";

describe("product form validation", () => {
  it.each([
    [{ sku: "", name: "x", price: "1" }, "El SKU es obligatorio"],
    [{ sku: "con espacio", name: "x", price: "1" }, "Solo letras"],
    [{ sku: "OK", name: " ", price: "1" }, "El nombre es obligatorio"],
    [{ sku: "OK", name: "x", price: "" }, "El precio es obligatorio"],
    [{ sku: "OK", name: "x", price: "18,5" }, "sin decimales"],
    [{ sku: "OK", name: "x", price: "99999999999" }, "demasiado alto"],
  ])("rejects %j", (input, message) => {
    const result = productFormSchema.safeParse(input);
    expect(result.success).toBe(false);
    expect(JSON.stringify(result.error?.issues)).toContain(message);
  });

  it("accepts formatted guaraníes", () => {
    expect(productFormSchema.parse({ sku: " A-1 ", name: "Yerba", price: "18.500" })).toEqual({
      sku: "A-1",
      name: "Yerba",
      price: 18500,
    });
  });
});

async function openProducts(username = "north.admin") {
  const utils = renderApp("/productos", { username });
  await screen.findByText("Yerba mate 500 g");
  return utils;
}

describe("products page", () => {
  it("creates a product, showing field errors first", async () => {
    const { user } = await openProducts("north.manager");
    await user.click(screen.getByRole("button", { name: "Nuevo producto" }));
    const dialog = within(screen.getByRole("dialog", { name: "Nuevo producto" }));
    await user.click(dialog.getByRole("button", { name: "Crear producto" }));
    expect(await dialog.findByText("El SKU es obligatorio")).toBeInTheDocument();

    await user.type(dialog.getByLabelText("SKU"), "ALM-100");
    await user.type(dialog.getByLabelText("Nombre"), "Cocido quemado");
    await user.type(dialog.getByLabelText("Precio (Gs.)"), "4.500");
    await user.click(dialog.getByRole("button", { name: "Crear producto" }));

    expect(await screen.findByText("Producto «Cocido quemado» creado.")).toBeInTheDocument();
    expect(await screen.findByText("Cocido quemado")).toBeInTheDocument();
    expect(db.products.find((p) => p.sku === "ALM-100")?.price).toBe(4500);
  });

  it("maps a duplicate SKU (409) to the SKU field", async () => {
    const { user } = await openProducts();
    await user.click(screen.getByRole("button", { name: "Nuevo producto" }));
    const dialog = within(screen.getByRole("dialog"));
    await user.type(dialog.getByLabelText("SKU"), "ALM-001");
    await user.type(dialog.getByLabelText("Nombre"), "Duplicado");
    await user.type(dialog.getByLabelText("Precio (Gs.)"), "1000");
    await user.click(dialog.getByRole("button", { name: "Crear producto" }));
    expect(await dialog.findByText("Ya existe un producto activo con ese SKU")).toBeInTheDocument();
  });

  it("maps API 422 field issues to the form", async () => {
    server.use(
      http.post("*/api/products", () =>
        HttpResponse.json(
          { detail: [{ loc: ["body", "name"], msg: "demasiado largo" }] },
          { status: 422 },
        ),
      ),
    );
    const { user } = await openProducts();
    await user.click(screen.getByRole("button", { name: "Nuevo producto" }));
    const dialog = within(screen.getByRole("dialog"));
    await user.type(dialog.getByLabelText("SKU"), "X-1");
    await user.type(dialog.getByLabelText("Nombre"), "Nombre");
    await user.type(dialog.getByLabelText("Precio (Gs.)"), "1000");
    await user.click(dialog.getByRole("button", { name: "Crear producto" }));
    expect(await dialog.findByText("demasiado largo")).toBeInTheDocument();
    expect(dialog.getByText("Revisá los datos ingresados.")).toBeInTheDocument();
  });

  it("edits a product", async () => {
    const { user } = await openProducts("north.manager");
    await user.click(screen.getByRole("button", { name: "Editar Mandioca 1 kg" }));
    const dialog = within(screen.getByRole("dialog", { name: "Editar producto" }));
    expect(dialog.getByLabelText("Precio (Gs.)")).toHaveValue("5000");
    await user.clear(dialog.getByLabelText("Precio (Gs.)"));
    await user.type(dialog.getByLabelText("Precio (Gs.)"), "5500");
    await user.click(dialog.getByRole("button", { name: "Guardar cambios" }));
    expect(await screen.findByText("Producto «Mandioca 1 kg» actualizado.")).toBeInTheDocument();
    expect(db.products.find((p) => p.name === "Mandioca 1 kg")?.price).toBe(5500);
  });

  it("archives products with history and deletes the rest", async () => {
    const { user } = await openProducts();
    await user.click(screen.getByRole("button", { name: "Eliminar Mandioca 1 kg" }));
    await user.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Eliminar" }));
    expect(await screen.findByText(/«Mandioca 1 kg» se archivó/)).toBeInTheDocument();

    // A product without sales or movements is removed for good.
    await user.click(screen.getByRole("button", { name: "Eliminar Gaseosa cola 2 L" }));
    await user.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Eliminar" }));
    expect(await screen.findByText("«Gaseosa cola 2 L» se eliminó.")).toBeInTheDocument();
    await waitFor(() => expect(screen.queryByText("Gaseosa cola 2 L")).not.toBeInTheDocument());
  });

  it("hides delete from managers and reports server-side 403s", async () => {
    server.use(
      http.patch("*/api/products/:id", () =>
        HttpResponse.json(
          { error: { code: "forbidden", message: "insufficient role" } },
          { status: 403 },
        ),
      ),
    );
    const { user } = await openProducts("north.manager");
    expect(screen.queryByRole("button", { name: /Eliminar/ })).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Editar Mandioca 1 kg" }));
    await user.click(
      within(screen.getByRole("dialog")).getByRole("button", { name: "Guardar cambios" }),
    );
    expect(
      await screen.findByText("No tenés permiso para realizar esta acción."),
    ).toBeInTheDocument();
  });

  it("paginates and searches", async () => {
    for (let i = 0; i < 30; i++) {
      db.products.push({
        ...db.products[0]!,
        id: 1000 + i,
        sku: `PAG-${i}`,
        name: `Producto paginado ${i}`,
      });
    }
    const { user } = await openProducts();
    await user.click(screen.getByRole("button", { name: "Siguiente" }));
    expect(await screen.findByText("Página 2")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Anterior" })).toBeEnabled();
    await user.type(screen.getByLabelText("Buscar productos"), "chipa");
    expect(await screen.findByText("Página 1")).toBeInTheDocument();
    await waitFor(() => expect(screen.getAllByRole("row")).toHaveLength(2));
  });
});
