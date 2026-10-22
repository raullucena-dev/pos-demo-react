import { render } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, useLocation } from "react-router";

import { AppProviders, AppRoutes } from "@/App";
import { db } from "@/mocks/db";
import { createQueryClient } from "@/lib/queryClient";

function LocationProbe() {
  const location = useLocation();
  return <output data-testid="location">{location.pathname}</output>;
}

/** Renders the whole app at `path`, optionally already logged in as `username`. */
export function renderApp(path = "/", { username }: { username?: string } = {}) {
  if (username) db.login(username, "demo1234");
  const queryClient = createQueryClient();
  const user = userEvent.setup();
  const utils = render(
    <MemoryRouter initialEntries={[path]}>
      <AppProviders queryClient={queryClient}>
        <AppRoutes />
        <LocationProbe />
      </AppProviders>
    </MemoryRouter>,
  );
  return { user, queryClient, ...utils };
}
