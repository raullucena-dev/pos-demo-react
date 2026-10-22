import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";

import { renderApp } from "@/test/render";
import { ThemeToggle } from "./ThemeToggle";
import { Button } from "./ui/Button";
import { Dialog } from "./ui/Dialog";

function DialogHarness() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button onClick={() => setOpen(true)}>Abrir</Button>
      <Dialog
        open={open}
        title="Prueba"
        onClose={() => setOpen(false)}
        footer={<Button>Aceptar</Button>}
      >
        <input aria-label="Campo" />
      </Dialog>
    </>
  );
}

describe("UI components", () => {
  it("toggles and remembers the theme", async () => {
    document.documentElement.dataset.theme = "light";
    const user = userEvent.setup();
    render(<ThemeToggle />);
    await user.click(screen.getByRole("button", { name: "Activar tema oscuro" }));
    expect(document.documentElement.dataset.theme).toBe("dark");
    expect(localStorage.getItem("theme")).toBe("dark");
    await user.click(screen.getByRole("button", { name: "Activar tema claro" }));
    expect(document.documentElement.dataset.theme).toBe("light");
  });

  it("moves focus into the dialog, traps Tab, closes on Escape and restores focus", async () => {
    const user = userEvent.setup();
    render(<DialogHarness />);
    const opener = screen.getByRole("button", { name: "Abrir" });
    await user.click(opener);
    expect(screen.getByRole("dialog", { name: "Prueba" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Cerrar" })).toHaveFocus();

    await user.tab();
    expect(screen.getByLabelText("Campo")).toHaveFocus();
    await user.tab();
    expect(screen.getByRole("button", { name: "Aceptar" })).toHaveFocus();
    await user.tab();
    expect(screen.getByRole("button", { name: "Cerrar" })).toHaveFocus();
    await user.tab({ shift: true });
    expect(screen.getByRole("button", { name: "Aceptar" })).toHaveFocus();

    await user.keyboard("{Escape}");
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(opener).toHaveFocus();
  });

  it("opens the mobile menu and shows the about page", async () => {
    const { user } = renderApp("/pos", { username: "north.cashier" });
    const menu = await screen.findByRole("button", { name: "Menú" });
    expect(menu).toHaveAttribute("aria-expanded", "false");
    await user.click(menu);
    expect(menu).toHaveAttribute("aria-expanded", "true");
    await user.click(screen.getByRole("link", { name: "Cómo funciona" }));
    expect(
      await screen.findByRole("heading", { name: "Cómo funciona esta demo" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "fastapi-multitenant-rls" })).toHaveAttribute(
      "href",
      "https://github.com/raullucena-dev/fastapi-multitenant-rls",
    );
  });

  it("closes toasts on demand", async () => {
    const { user } = renderApp("/productos", { username: "north.admin" });
    await user.click(await screen.findByRole("button", { name: "Eliminar Gaseosa cola 2 L" }));
    await user.click(screen.getByRole("button", { name: "Eliminar" }));
    await screen.findByText("«Gaseosa cola 2 L» se eliminó.");
    await user.click(screen.getByRole("button", { name: "Cerrar notificación" }));
    expect(screen.queryByText("«Gaseosa cola 2 L» se eliminó.")).not.toBeInTheDocument();
  });
});
