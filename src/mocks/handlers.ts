import { http, HttpResponse, type JsonBodyType } from "msw";

import { db, MockHttpError } from "./db";

const api = (path: string) => `*/api${path}`;

type Handler = (args: {
  request: Request;
  params: Record<string, string | readonly string[] | undefined>;
}) => JsonBodyType | Response | Promise<JsonBodyType | Response>;

/** Maps MockHttpError to the API's `{ error: { code, message } }` shape. */
function wrap(handler: Handler) {
  return async (args: Parameters<Handler>[0]) => {
    try {
      const result = await handler(args);
      return result instanceof Response ? result : HttpResponse.json(result);
    } catch (error) {
      if (error instanceof MockHttpError) {
        return HttpResponse.json(
          { error: { code: error.code, message: error.message } },
          { status: error.status },
        );
      }
      throw error;
    }
  };
}

const validationError = (field: string, msg: string) =>
  HttpResponse.json(
    { detail: [{ loc: ["body", field], msg, type: "value_error" }] },
    { status: 422 },
  );

const int = (value: string | null, fallback: number) => (value === null ? fallback : Number(value));
const page = (request: Request) => {
  const url = new URL(request.url);
  return {
    url,
    limit: Math.min(int(url.searchParams.get("limit"), 50), 200),
    offset: int(url.searchParams.get("offset"), 0),
  };
};
const id = (params: Record<string, unknown>, key: string) => Number(params[key]);

export const handlers = [
  http.get(api("/health"), () => HttpResponse.json({ status: "ok", database: "ok" })),

  http.get(
    api("/demo/info"),
    wrap(() => {
      if (!db.demoMode) throw new MockHttpError(404, "not_found", "not found");
      return db.demoInfo();
    }),
  ),

  http.post(
    api("/auth/login"),
    wrap(async ({ request }) => {
      const body = (await request.json()) as { username?: string; password?: string };
      return db.login(body.username ?? "", body.password ?? "");
    }),
  ),
  http.post(
    api("/auth/logout"),
    wrap(() => {
      db.logout();
      return new HttpResponse(null, { status: 204 });
    }),
  ),
  http.get(
    api("/auth/me"),
    wrap(() => db.currentUser()),
  ),

  http.get(
    api("/products"),
    wrap(({ request }) => {
      const user = db.currentUser();
      const { url, limit, offset } = page(request);
      return db
        .listProducts(user, url.searchParams.get("q") ?? "", limit, offset)
        .map((p) => db.productOut(p));
    }),
  ),
  http.post(
    api("/products"),
    wrap(async ({ request }) => {
      const user = db.requireRole("admin", "manager");
      const body = (await request.json()) as { sku: string; name: string; price: string };
      if (!/^[A-Za-z0-9._-]{1,64}$/.test(body.sku))
        return validationError("sku", "String should match pattern");
      return HttpResponse.json(db.productOut(db.createProduct(user, body)), { status: 201 });
    }),
  ),
  http.patch(
    api("/products/:productId"),
    wrap(async ({ request, params }) => {
      const user = db.requireRole("admin", "manager");
      const body = (await request.json()) as { sku?: string; name?: string; price?: string };
      return db.productOut(db.updateProduct(user, id(params, "productId"), body));
    }),
  ),
  http.delete(
    api("/products/:productId"),
    wrap(({ params }) => {
      const user = db.requireRole("admin");
      const productId = id(params, "productId");
      return { id: productId, mode: db.deleteProduct(user, productId) };
    }),
  ),

  http.get(
    api("/stock-movements"),
    wrap(({ request }) => {
      const user = db.requireRole("admin", "manager");
      const { url, limit, offset } = page(request);
      const productId = url.searchParams.get("product_id");
      return db
        .listMovements(user, productId ? Number(productId) : null, limit, offset)
        .map((m) => db.movementOut(m));
    }),
  ),
  http.post(
    api("/stock-movements"),
    wrap(async ({ request }) => {
      const user = db.requireRole("admin", "manager");
      const body = (await request.json()) as {
        product_id: number;
        quantity: number;
        reason: "purchase" | "adjustment";
        note?: string;
      };
      return HttpResponse.json(db.movementOut(db.createMovement(user, body)), { status: 201 });
    }),
  ),
  http.delete(
    api("/stock-movements/:movementId"),
    wrap(({ params }) => {
      const user = db.requireRole("admin", "manager");
      return db.movementOut(db.reverseMovement(user, id(params, "movementId")));
    }),
  ),

  http.post(
    api("/sales"),
    wrap(async ({ request }) => {
      const user = db.currentUser();
      const body = (await request.json()) as { items?: { product_id: number; quantity: number }[] };
      if (!body.items?.length) return validationError("items", "List should have at least 1 item");
      return HttpResponse.json(db.saleOut(db.createSale(user, body.items)), { status: 201 });
    }),
  ),
  http.get(
    api("/sales"),
    wrap(({ request }) => {
      const user = db.currentUser();
      const { limit, offset } = page(request);
      return db.listSales(user, limit, offset).map((s) => db.saleOut(s, false));
    }),
  ),
  http.get(
    api("/reports/sales"),
    wrap(({ request }) => {
      const user = db.requireRole("admin", "manager");
      const url = new URL(request.url);
      return db.report(
        user,
        url.searchParams.get("date_from") ?? "",
        url.searchParams.get("date_to") ?? "",
      );
    }),
  ),
  http.get(
    api("/audit-log"),
    wrap(({ request }) => {
      const user = db.requireRole("admin");
      const { url, limit, offset } = page(request);
      return db.listAudit(user, url.searchParams.get("entity_type"), limit, offset);
    }),
  ),
  http.get(
    api("/users"),
    wrap(() => db.listUsers(db.requireRole("admin", "manager"))),
  ),
];
