import { expect, test } from "@playwright/test";

const normalize = (s: string | null) => (s ?? "").replace(/\s/g, " ");

test("login → sell → report", async ({ page, isMobile }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Iniciar sesión" })).toBeVisible();

  // Demo credentials come from GET /demo/info.
  await page.getByRole("button", { name: "Usar north.manager" }).click();
  await page.getByRole("button", { name: "Ingresar" }).click();
  await expect(page.getByRole("heading", { name: "Caja" })).toBeVisible();

  await page.getByRole("button", { name: /Agregar Yerba mate 500 g/ }).click();
  await page.getByRole("button", { name: /Agregar Yerba mate 500 g/ }).click();
  await page.getByRole("button", { name: /Agregar Chipa/ }).click();
  expect(normalize(await page.getByTestId("cart-total").textContent())).toBe("Gs. 52.000");

  await page.getByRole("button", { name: /Cobrar/ }).click();
  await expect(page.getByText(/Venta #\d+ registrada/)).toBeVisible();
  await expect(page.getByText("El carrito está vacío.")).toBeVisible();

  if (isMobile) await page.getByRole("button", { name: "Menú" }).click();
  await page.getByRole("link", { name: "Reportes" }).click();
  await expect(page.getByRole("heading", { name: "Reporte de ventas" })).toBeVisible();
  const revenue = page.locator("p", { hasText: "Ingresos" }).locator("xpath=following-sibling::p");
  await expect(revenue).toHaveText(/Gs\.\s52\.000/);
  await expect(page.getByRole("img", { name: /Ingresos por día/ })).toBeVisible();
});

test("a cashier cannot reach back-office screens", async ({ page }) => {
  await page.goto("/login");
  await page.getByRole("button", { name: "Usar south.cashier" }).click();
  await page.getByRole("button", { name: "Ingresar" }).click();
  await expect(page.getByRole("heading", { name: "Caja" })).toBeVisible();
  await expect(page.getByText("Termo de acero 1 L")).toBeVisible();
  await expect(page.getByText("Yerba mate 500 g")).toHaveCount(0);

  await page.goto("/auditoria");
  await expect(page.getByRole("heading", { name: "Acceso restringido" })).toBeVisible();
});

test("the page has no horizontal scroll at 360px", async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 780 });
  await page.goto("/login");
  await page.getByRole("button", { name: "Usar north.admin" }).click();
  await page.getByRole("button", { name: "Ingresar" }).click();
  await expect(page.getByRole("heading", { name: "Caja" })).toBeVisible();
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - window.innerWidth,
  );
  expect(overflow).toBeLessThanOrEqual(0);
});
