import { screen, waitFor } from "@testing-library/react";
import { http, HttpResponse } from "msw";

import { server } from "@/mocks/server";
import { renderApp } from "@/test/render";

describe("login", () => {
  it("shows demo credentials and logs in with them", async () => {
    const { user } = renderApp("/pos");
    expect(await screen.findByRole("heading", { name: "Iniciar sesión" })).toBeInTheDocument();
    expect(await screen.findByText("Demo Store North")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Usar north.cashier" }));
    expect(screen.getByLabelText("Usuario")).toHaveValue("north.cashier");
    await user.click(screen.getByRole("button", { name: "Ingresar" }));

    expect(await screen.findByRole("heading", { name: "Caja" })).toBeInTheDocument();
    expect(screen.getByTestId("location")).toHaveTextContent("/pos");
    expect(await screen.findByText("Demo Store North")).toBeInTheDocument();
  });

  it("validates required fields before calling the API", async () => {
    const { user } = renderApp("/login");
    await user.click(await screen.findByRole("button", { name: "Ingresar" }));
    expect(await screen.findByText("Ingresá tu usuario")).toBeInTheDocument();
    expect(screen.getByText("Ingresá tu contraseña")).toBeInTheDocument();
  });

  it("shows a clear message for wrong credentials", async () => {
    const { user } = renderApp("/login");
    await user.type(await screen.findByLabelText("Usuario"), "north.cashier");
    await user.type(screen.getByLabelText("Contraseña"), "wrong");
    await user.click(screen.getByRole("button", { name: "Ingresar" }));
    expect(await screen.findByText("Usuario o contraseña incorrectos.")).toBeInTheDocument();
  });

  it.each([
    [
      423,
      { error: { code: "account_locked", message: "locked" } },
      {},
      /Demasiados intentos fallidos/,
    ],
    [
      429,
      { error: { code: "rate_limited", message: "too many" } },
      { "Retry-After": "30" },
      /Esperá 30 segundos/,
    ],
    [
      500,
      { error: { code: "internal_error", message: "boom" } },
      {},
      /El servidor tuvo un problema/,
    ],
  ])("maps HTTP %i to a friendly message", async (status, body, headers, message) => {
    server.use(http.post("*/api/auth/login", () => HttpResponse.json(body, { status, headers })));
    const { user } = renderApp("/login");
    await user.type(await screen.findByLabelText("Usuario"), "north.cashier");
    await user.type(screen.getByLabelText("Contraseña"), "x");
    await user.click(screen.getByRole("button", { name: "Ingresar" }));
    expect(await screen.findByText(message)).toBeInTheDocument();
  });

  it("hides the demo panel when the API is not in demo mode", async () => {
    server.use(
      http.get("*/api/demo/info", () =>
        HttpResponse.json({ error: { code: "not_found", message: "not found" } }, { status: 404 }),
      ),
    );
    renderApp("/login");
    expect(await screen.findByRole("heading", { name: "Iniciar sesión" })).toBeInTheDocument();
    await waitFor(() =>
      expect(screen.queryByText("Credenciales de demostración")).not.toBeInTheDocument(),
    );
  });

  it("redirects a logged-in user away from the login page", async () => {
    renderApp("/login", { username: "south.manager" });
    expect(await screen.findByRole("heading", { name: "Caja" })).toBeInTheDocument();
  });
});
