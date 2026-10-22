import type { Product } from "@/api/schemas";
import { cartReducer, cartTotals, lineTotal, quantityInCart, toSaleItems, type Cart } from "./cart";

const product = (id: number, price: number, stock: number): Product => ({
  id,
  sku: `SKU-${id}`,
  name: `Producto ${id}`,
  price,
  stock_quantity: stock,
  created_at: "2026-10-01T00:00:00Z",
  updated_at: "2026-10-01T00:00:00Z",
});

const yerba = product(1, 18500, 3);
const chipa = product(2, 15000, 10);

function apply(...actions: Parameters<typeof cartReducer>[1][]): Cart {
  return actions.reduce<Cart>(cartReducer, []);
}

describe("cart", () => {
  it("adds products and increments repeated ones", () => {
    const cart = apply(
      { type: "add", product: yerba },
      { type: "add", product: yerba },
      { type: "add", product: chipa },
    );
    expect(cart.map((l) => [l.productId, l.quantity])).toEqual([
      [1, 2],
      [2, 1],
    ]);
    expect(quantityInCart(cart, 1)).toBe(2);
    expect(quantityInCart(cart, 99)).toBe(0);
  });

  it("never exceeds the known stock", () => {
    const cart = apply(
      { type: "add", product: yerba },
      { type: "add", product: yerba },
      { type: "add", product: yerba },
      { type: "add", product: yerba },
      { type: "setQuantity", productId: 1, quantity: 50 },
    );
    expect(cart[0]?.quantity).toBe(3);
  });

  it("ignores products without stock", () => {
    expect(apply({ type: "add", product: product(3, 1000, 0) })).toEqual([]);
  });

  it("removes a line when its quantity drops to zero or it is removed", () => {
    expect(
      apply({ type: "add", product: chipa }, { type: "setQuantity", productId: 2, quantity: 0 }),
    ).toEqual([]);
    expect(apply({ type: "add", product: chipa }, { type: "remove", productId: 2 })).toEqual([]);
    expect(apply({ type: "add", product: chipa }, { type: "clear" })).toEqual([]);
  });

  it("ignores invalid quantities and floors fractions", () => {
    const cart = apply(
      { type: "add", product: chipa },
      { type: "setQuantity", productId: 2, quantity: Number.NaN },
    );
    expect(cart[0]?.quantity).toBe(1);
    expect(
      cartReducer(cart, { type: "setQuantity", productId: 2, quantity: 2.7 })[0]?.quantity,
    ).toBe(2);
  });

  it("keeps stock in sync with fresh product data", () => {
    const cart = apply({ type: "add", product: chipa }, { type: "add", product: chipa });
    const synced = cartReducer(cart, {
      type: "syncStock",
      products: [{ ...chipa, stock_quantity: 1 }, yerba],
    });
    expect(synced[0]).toMatchObject({ available: 1, quantity: 1 });
    expect(
      cartReducer(cart, { type: "syncStock", products: [{ ...chipa, stock_quantity: 0 }] }),
    ).toEqual([]);
    expect(cartReducer(cart, { type: "syncStock", products: [] })).toEqual(cart);
  });

  it("computes line and cart totals in whole guaraníes", () => {
    const cart = apply(
      { type: "add", product: yerba },
      { type: "add", product: yerba },
      { type: "add", product: chipa },
    );
    expect(lineTotal(cart[0]!)).toBe(37000);
    expect(cartTotals(cart)).toEqual({ items: 3, total: 52000 });
    expect(cartTotals([])).toEqual({ items: 0, total: 0 });
    expect(toSaleItems(cart)).toEqual([
      { product_id: 1, quantity: 2 },
      { product_id: 2, quantity: 1 },
    ]);
  });
});
