import "@testing-library/jest-dom/vitest";

import { cleanup } from "@testing-library/react";
import { afterAll, afterEach, beforeAll } from "vitest";

import { db } from "@/mocks/db";
import { server } from "@/mocks/server";

beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
afterEach(() => {
  cleanup();
  server.resetHandlers();
  db.reset();
  db.expireSession();
  window.sessionStorage.clear();
  window.localStorage.clear();
});
afterAll(() => server.close());
