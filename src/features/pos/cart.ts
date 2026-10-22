import type { Product } from "@/api/schemas";

export interface CartLine {
  productId: number;
  sku: string;
  name: string;
  unitPrice: number;
  quantity: number;
  /** Stock known when the product was added; the API stays authoritative. */
  available: number;
}

export type Cart = CartLine[];

export type CartAction =
  | { type: "add"; product: Product }
  | { type: "setQuantity"; productId: number; quantity: number }
  | { type: "remove"; productId: number }
  | { type: "syncStock"; products: Product[] }
  | { type: "clear" };

const clamp = (value: number, max: number) => Math.max(0, Math.min(Math.floor(value), max));

export function cartReducer(cart: Cart, action: CartAction): Cart {
  switch (action.type) {
    case "add": {
      const { product } = action;
      const existing = cart.find((line) => line.productId === product.id);
      if (existing) {
        return cart.map((line) =>
          line.productId === product.id
            ? { ...line, quantity: clamp(line.quantity + 1, line.available) }
            : line,
        );
      }
      if (product.stock_quantity < 1) return cart;
      return [
        ...cart,
        {
          productId: product.id,
          sku: product.sku,
          name: product.name,
          unitPrice: product.price,
          quantity: 1,
          available: product.stock_quantity,
        },
      ];
    }
    case "setQuantity": {
      if (!Number.isFinite(action.quantity)) return cart;
      return cart
        .map((line) =>
          line.productId === action.productId
            ? { ...line, quantity: clamp(action.quantity, line.available) }
            : line,
        )
        .filter((line) => line.quantity > 0);
    }
    case "remove":
      return cart.filter((line) => line.productId !== action.productId);
    case "syncStock": {
      const stock = new Map(action.products.map((p) => [p.id, p.stock_quantity]));
      return cart.map((line) => {
        const available = stock.get(line.productId);
        return available === undefined ? line : { ...line, available };
      });
    }
    case "clear":
      return [];
  }
}

export const lineTotal = (line: CartLine) => line.unitPrice * line.quantity;

export function cartTotals(cart: Cart): { items: number; total: number } {
  return cart.reduce(
    (acc, line) => ({ items: acc.items + line.quantity, total: acc.total + lineTotal(line) }),
    { items: 0, total: 0 },
  );
}

export function toSaleItems(cart: Cart): { product_id: number; quantity: number }[] {
  return cart
    .filter((l) => l.quantity > 0)
    .map((l) => ({ product_id: l.productId, quantity: l.quantity }));
}

export function quantityInCart(cart: Cart, productId: number): number {
  return cart.find((line) => line.productId === productId)?.quantity ?? 0;
}
