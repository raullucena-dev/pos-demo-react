import { http, HttpResponse } from "msw";
import { z } from "zod";

import { server } from "@/mocks/server";
import { can } from "@/auth/permissions";
import { apiRequest, onUnauthorized } from "./client";
import { ApiError, errorMessage, parseStockShortage } from "./errors";

const schema = z.object({ value: z.number() });

describe("apiRequest", () => {
  it("sends cookies, JSON and query parameters", async () => {
    let seen: Request | undefined;
    server.use(
      http.post("*/api/things", ({ request }) => {
        seen = request;
        return HttpResponse.json({ value: 1 });
      }),
    );
    await apiRequest("/things", schema, {
      method: "POST",
      body: { a: 1 },
      query: { q: "x", empty: "", none: undefined },
    });
    expect(seen?.credentials).toBe("include");
    expect(seen?.headers.get("Content-Type")).toBe("application/json");
    const url = new URL(seen!.url);
    expect(url.pathname).toBe("/api/things");
    expect([...url.searchParams.keys()]).toEqual(["q"]);
    expect(await seen?.json()).toEqual({ a: 1 });
  });

  it("maps the API error shape", async () => {
    server.use(
      http.get("*/api/things", () =>
        HttpResponse.json(
          {
            error: {
              code: "insufficient_stock",
              message: "insufficient stock for product 7: have 2, requested 5",
            },
          },
          { status: 409 },
        ),
      ),
    );
    const error = await apiRequest("/things", schema).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(ApiError);
    expect(error).toMatchObject({ status: 409, code: "insufficient_stock" });
    expect(parseStockShortage(error as ApiError)).toEqual({
      productId: 7,
      available: 2,
      requested: 5,
    });
  });

  it("maps FastAPI 422 validation errors to field issues", async () => {
    server.use(
      http.get("*/api/things", () =>
        HttpResponse.json(
          {
            detail: [
              { loc: ["body", "price"], msg: "too large" },
              { loc: ["query"], msg: 3 },
            ],
          },
          { status: 422 },
        ),
      ),
    );
    const error = (await apiRequest("/things", schema).catch((e: unknown) => e)) as ApiError;
    expect(error.code).toBe("validation_error");
    expect(error.issues).toEqual([
      { field: "price", message: "too large" },
      { field: "query", message: "inválido" },
    ]);
  });

  it("reads Retry-After and tolerates non-JSON bodies", async () => {
    server.use(
      http.get(
        "*/api/things",
        () => new HttpResponse("Too Many", { status: 429, headers: { "Retry-After": "12" } }),
      ),
    );
    const error = (await apiRequest("/things", schema).catch((e: unknown) => e)) as ApiError;
    expect(error).toMatchObject({ status: 429, code: "http_429", retryAfterSeconds: 12 });
  });

  it("rejects responses that do not match the schema", async () => {
    server.use(http.get("*/api/things", () => HttpResponse.json({ value: "not a number" })));
    await expect(apiRequest("/things", schema)).rejects.toMatchObject({ code: "invalid_response" });
  });

  it("turns network failures into ApiError", async () => {
    server.use(http.get("*/api/things", () => HttpResponse.error()));
    await expect(apiRequest("/things", schema)).rejects.toMatchObject({
      code: "network_error",
      status: 0,
    });
  });

  it("rethrows aborts untouched", async () => {
    server.use(http.get("*/api/things", () => HttpResponse.json({ value: 1 })));
    const controller = new AbortController();
    controller.abort();
    await expect(
      apiRequest("/things", schema, { signal: controller.signal }),
    ).rejects.toMatchObject({ name: "AbortError" });
  });

  it("notifies 401 listeners unless the caller opts out", async () => {
    server.use(
      http.get("*/api/things", () =>
        HttpResponse.json({ error: { code: "not_authenticated", message: "x" } }, { status: 401 }),
      ),
    );
    const listener = vi.fn();
    const unsubscribe = onUnauthorized(listener);
    await apiRequest("/things", schema).catch(() => undefined);
    await apiRequest("/things", schema, { skipUnauthorizedEvent: true }).catch(() => undefined);
    unsubscribe();
    await apiRequest("/things", schema).catch(() => undefined);
    expect(listener).toHaveBeenCalledTimes(1);
  });
});

describe("error messages", () => {
  it.each([
    ["network_error", 0, /No se pudo conectar/],
    ["invalid_response", 200, /datos inesperados/],
    ["not_authenticated", 401, /sesión no es válida/],
    ["forbidden", 403, /No tenés permiso/],
    ["not_found", 404, /otra tienda/],
    ["insufficient_stock", 409, /stock suficiente/],
    ["account_locked", 423, /Demasiados intentos/],
    ["validation_error", 422, /Revisá los datos/],
    ["conflict", 409, /conflicto/],
    ["http_418", 418, /No se pudo completar/],
    ["internal_error", 503, /servidor tuvo un problema/],
  ])("%s", (code, status, message) => {
    expect(errorMessage(new ApiError(status, code, "x"))).toMatch(message);
  });

  it("handles unknown errors and messages without stock details", () => {
    expect(errorMessage(new Error("x"))).toMatch(/inesperado/);
    expect(parseStockShortage(new ApiError(409, "insufficient_stock", "no details"))).toBeNull();
    expect(parseStockShortage(new ApiError(409, "conflict", "x"))).toBeNull();
  });
});

describe("permissions", () => {
  it("mirrors the API's role checks", () => {
    expect(can("cashier", "pos")).toBe(true);
    expect(can("cashier", "products:write")).toBe(false);
    expect(can("manager", "reports")).toBe(true);
    expect(can("manager", "products:delete")).toBe(false);
    expect(can("manager", "audit")).toBe(false);
    expect(can("admin", "audit")).toBe(true);
    expect(can(undefined, "pos")).toBe(false);
  });
});
