import { screen, waitFor, within } from "@testing-library/react";

import { renderApp } from "@/test/render";
import { describeAction } from "./actions";

describe("audit log", () => {
  it("translates known actions and keeps unknown ones", () => {
    expect(describeAction("sale.create")).toBe("Venta");
    expect(describeAction("custom.thing")).toBe("custom.thing");
  });

  it("shows the tenant's entries with usernames and filters by entity", async () => {
    const { user } = renderApp("/auditoria", { username: "north.admin" });
    expect(await screen.findByText("Inicio de sesión")).toBeInTheDocument();
    const rows = screen.getAllByRole("row");
    expect(within(rows[1]!).getByText("north.admin")).toBeInTheDocument();

    await user.selectOptions(screen.getByLabelText("Entidad"), "sale");
    expect(await screen.findByText("Sin registros.")).toBeInTheDocument();
    await user.selectOptions(screen.getByLabelText("Entidad"), "");
    await waitFor(() => expect(screen.getByText("Inicio de sesión")).toBeInTheDocument());
  });
});
