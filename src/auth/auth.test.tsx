import { screen, waitFor, within } from "@testing-library/react";
import { http, HttpResponse } from "msw";

import { db } from "@/mocks/db";
import { server } from "@/mocks/server";
import { renderApp } from "@/test/render";

const nav = () => within(screen.getByRole("navigation", { name: "Principal" }));

describe("session handling", () => {
  it("redirects anonymous visitors to the login page", async () => {
    renderApp("/reportes");
    expect(await screen.findByRole("heading", { name: "Iniciar sesión" })).toBeInTheDocument();
    expect(screen.getByTestId("location")).toHaveTextContent("/login");
  });

  it("returns to the requested page after logging in", async () => {
    const { user } = renderApp("/reportes");
    await user.type(await screen.findByLabelText("Usuario"), "north.manager");
    await user.type(screen.getByLabelText("Contraseña"), "demo1234");
    await user.click(screen.getByRole("button", { name: "Ingresar" }));
    expect(await screen.findByRole("heading", { name: "Reporte de ventas" })).toBeInTheDocument();
  });

  it("clears state and asks to log in again when any request gets a 401", async () => {
    const { user, queryClient } = renderApp("/pos", { username: "north.cashier" });
    expect(await screen.findByText("Yerba mate 500 g")).toBeInTheDocument();

    db.expireSession(); // the server revoked the session
    await user.type(screen.getByLabelText("Buscar productos"), "chipa");

    expect(await screen.findByText(/Tu sesión expiró/)).toBeInTheDocument();
    expect(screen.getByTestId("location")).toHaveTextContent("/login");
    expect(queryClient.getQueryCache().findAll({ queryKey: ["products"] })).toHaveLength(0);
  });

  it("logs out and forgets cached data", async () => {
    const { user, queryClient } = renderApp("/pos", { username: "south.admin" });
    expect(await screen.findByText("Termo de acero 1 L")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Salir" }));
    expect(await screen.findByRole("heading", { name: "Iniciar sesión" })).toBeInTheDocument();
    expect(queryClient.getQueryCache().findAll({ queryKey: ["products"] })).toHaveLength(0);
  });

  it("shows an error state when the session probe fails for other reasons", async () => {
    server.use(
      http.get("*/api/auth/me", () =>
        HttpResponse.json({ error: { code: "x", message: "x" } }, { status: 400 }),
      ),
    );
    renderApp("/pos");
    await waitFor(() => expect(screen.getByTestId("location")).toHaveTextContent("/login"));
  });
});

describe("role-aware navigation", () => {
  it("shows a cashier only what a cashier can use", async () => {
    renderApp("/pos", { username: "north.cashier" });
    await screen.findByRole("heading", { name: "Caja" });
    expect(nav().getByRole("link", { name: "Caja" })).toBeInTheDocument();
    expect(nav().getByRole("link", { name: "Productos" })).toBeInTheDocument();
    for (const hidden of ["Stock", "Reportes", "Auditoría"]) {
      expect(nav().queryByRole("link", { name: hidden })).not.toBeInTheDocument();
    }
  });

  it("gives managers stock and reports but not the audit log", async () => {
    renderApp("/pos", { username: "north.manager" });
    await screen.findByRole("heading", { name: "Caja" });
    expect(nav().getByRole("link", { name: "Stock" })).toBeInTheDocument();
    expect(nav().getByRole("link", { name: "Reportes" })).toBeInTheDocument();
    expect(nav().queryByRole("link", { name: "Auditoría" })).not.toBeInTheDocument();
  });

  it("blocks direct navigation to a forbidden route", async () => {
    renderApp("/auditoria", { username: "north.cashier" });
    expect(await screen.findByRole("heading", { name: "Acceso restringido" })).toBeInTheDocument();
  });

  it("hides write actions from cashiers on the products page", async () => {
    renderApp("/productos", { username: "north.cashier" });
    expect(await screen.findByText("Yerba mate 500 g")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Nuevo producto" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Editar/ })).not.toBeInTheDocument();
  });

  it("still handles a 403 from the API gracefully", async () => {
    // e.g. the role was changed server-side after the page loaded
    server.use(
      http.get("*/api/reports/sales", () =>
        HttpResponse.json(
          { error: { code: "forbidden", message: "insufficient role" } },
          { status: 403 },
        ),
      ),
    );
    renderApp("/reportes", { username: "north.manager" });
    expect(
      await screen.findByText("No tenés permiso para ver esta información."),
    ).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Reintentar" })).not.toBeInTheDocument();
  });
});

describe("tenant isolation", () => {
  it("never shows one store's catalogue to the other store", async () => {
    const north = renderApp("/productos", { username: "north.admin" });
    expect(await screen.findByText("Yerba mate 500 g")).toBeInTheDocument();
    expect(screen.queryByText("Termo de acero 1 L")).not.toBeInTheDocument();
    north.unmount();

    db.expireSession();
    renderApp("/productos", { username: "south.admin" });
    expect(await screen.findByText("Termo de acero 1 L")).toBeInTheDocument();
    expect(screen.queryByText("Yerba mate 500 g")).not.toBeInTheDocument();
    expect(await screen.findByText("Demo Store South")).toBeInTheDocument();
  });
});
