import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router";

import { AppProviders, AppRoutes } from "./App";
import { createQueryClient } from "./lib/queryClient";
import "./styles/index.css";

async function enableMocking(): Promise<void> {
  // Only in `vite --mode mock` (e2e and offline demos). Statically false in production,
  // so the mock backend is tree-shaken out of the real bundle.
  if (import.meta.env.VITE_API_MOCKING !== "true") return;
  const { worker } = await import("./mocks/browser");
  await worker.start({ onUnhandledRequest: "bypass", quiet: true });
}

void enableMocking().then(() => {
  const root = document.getElementById("root");
  if (!root) throw new Error("missing #root");
  createRoot(root).render(
    <StrictMode>
      <BrowserRouter>
        <AppProviders queryClient={createQueryClient()}>
          <AppRoutes />
        </AppProviders>
      </BrowserRouter>
    </StrictMode>,
  );
});
