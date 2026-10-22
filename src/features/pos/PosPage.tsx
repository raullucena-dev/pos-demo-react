import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useReducer, useState } from "react";

import { productsApi, queryKeys, salesApi } from "@/api/endpoints";
import { errorMessage, isApiError, parseStockShortage } from "@/api/errors";
import type { Product, Sale } from "@/api/schemas";
import { Button } from "@/components/ui/Button";
import { Badge, Card, EmptyState, ErrorState, PageHeader, Spinner } from "@/components/ui/misc";
import { formatPYG } from "@/lib/money";
import { useDebouncedValue } from "@/lib/useDebouncedValue";
import { cartReducer, cartTotals, lineTotal, quantityInCart, toSaleItems, type Cart } from "./cart";

type ProductList = Product[];

/** Optimistically subtracts sold quantities from every cached product list. */
function applyStockDelta(queryClient: ReturnType<typeof useQueryClient>, cart: Cart): void {
  const sold = new Map(cart.map((line) => [line.productId, line.quantity]));
  queryClient.setQueriesData<ProductList>({ queryKey: queryKeys.productsAll }, (list) =>
    list?.map((p) =>
      sold.has(p.id) ? { ...p, stock_quantity: p.stock_quantity - (sold.get(p.id) ?? 0) } : p,
    ),
  );
}

export function PosPage() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const query = useDebouncedValue(search.trim());
  const [cart, dispatch] = useReducer(cartReducer, []);
  const [lastSale, setLastSale] = useState<Sale | null>(null);
  const [checkoutError, setCheckoutError] = useState<string | null>(null);

  const products = useQuery({
    queryKey: queryKeys.products({ q: query, limit: 200 }),
    queryFn: ({ signal }) => productsApi.list({ q: query, limit: 200 }, signal),
    placeholderData: keepPreviousData,
  });

  useEffect(() => {
    if (products.data) dispatch({ type: "syncStock", products: products.data });
  }, [products.data]);

  const checkout = useMutation({
    mutationFn: (lines: Cart) => salesApi.create(toSaleItems(lines)),
    onMutate: async (lines) => {
      setCheckoutError(null);
      await queryClient.cancelQueries({ queryKey: queryKeys.productsAll });
      const snapshot = queryClient.getQueriesData<ProductList>({ queryKey: queryKeys.productsAll });
      applyStockDelta(queryClient, lines);
      return { snapshot };
    },
    onError: (error, lines, context) => {
      for (const [key, data] of context?.snapshot ?? []) queryClient.setQueryData(key, data);
      const shortage = isApiError(error) ? parseStockShortage(error) : null;
      if (shortage) {
        const name =
          lines.find((l) => l.productId === shortage.productId)?.name ?? `#${shortage.productId}`;
        setCheckoutError(
          `Stock insuficiente para «${name}»: disponible ${shortage.available}, en el carrito ${shortage.requested}. Ajustá la cantidad.`,
        );
      } else {
        setCheckoutError(errorMessage(error));
      }
    },
    onSuccess: (sale) => {
      setLastSale(sale);
      dispatch({ type: "clear" });
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.productsAll });
      void queryClient.invalidateQueries({ queryKey: queryKeys.sales });
      void queryClient.invalidateQueries({ queryKey: queryKeys.reportsAll });
      void queryClient.invalidateQueries({ queryKey: queryKeys.stockAll });
    },
  });

  const totals = cartTotals(cart);

  const addProduct = (product: Product) => {
    setLastSale(null);
    dispatch({ type: "add", product });
  };

  return (
    <>
      <PageHeader title="Caja" description="Buscá productos, armá el carrito y cobrá." />
      <div className="grid gap-6 lg:grid-cols-[1fr_22rem]">
        <section aria-labelledby="catalog-title">
          <h2 id="catalog-title" className="sr-only">
            Catálogo
          </h2>
          <label htmlFor="pos-search" className="sr-only">
            Buscar productos
          </label>
          <input
            id="pos-search"
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Buscar por nombre o SKU…"
            className="border-border bg-surface focus-visible:outline-focus mb-4 h-11 w-full rounded-md border px-3 text-sm focus-visible:outline-2"
          />
          {products.isPending ? (
            <Spinner />
          ) : products.isError ? (
            <ErrorState error={products.error} onRetry={() => void products.refetch()} />
          ) : products.data.length === 0 ? (
            <EmptyState>No hay productos que coincidan con la búsqueda.</EmptyState>
          ) : (
            <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {products.data.map((product) => {
                const inCart = quantityInCart(cart, product.id);
                const remaining = product.stock_quantity - inCart;
                return (
                  <li key={product.id}>
                    <button
                      type="button"
                      onClick={() => addProduct(product)}
                      disabled={remaining < 1}
                      aria-label={`Agregar ${product.name}, ${formatPYG(product.price)}`}
                      className="border-border bg-surface hover:border-primary focus-visible:outline-focus flex h-full w-full flex-col gap-2 rounded-xl border p-3 text-left shadow-sm transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      <span className="text-fg text-sm font-medium">{product.name}</span>
                      <span className="text-muted font-mono text-xs">{product.sku}</span>
                      <span className="mt-auto flex items-center justify-between gap-2">
                        <span className="font-semibold">{formatPYG(product.price)}</span>
                        <Badge
                          tone={remaining < 1 ? "danger" : remaining <= 5 ? "warning" : "neutral"}
                        >
                          {remaining < 1 ? "Sin stock" : `${remaining} disp.`}
                        </Badge>
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        <Card className="h-fit scroll-mt-20 lg:sticky lg:top-20">
          <h2 id="cart" className="text-lg font-semibold">
            Carrito
          </h2>
          {lastSale && (
            <div
              role="status"
              className="bg-success-soft text-success-strong mt-3 rounded-md px-3 py-2 text-sm"
            >
              Venta #{lastSale.id} registrada · Total {formatPYG(lastSale.total)}
            </div>
          )}
          {cart.length === 0 ? (
            <p className="text-muted mt-3 text-sm">El carrito está vacío.</p>
          ) : (
            <ul
              className="divide-border mt-3 flex flex-col divide-y"
              aria-label="Productos en el carrito"
            >
              {cart.map((line) => (
                <li key={line.productId} className="flex flex-col gap-2 py-3">
                  <div className="flex items-start justify-between gap-2">
                    <span className="text-sm font-medium">{line.name}</span>
                    <span className="text-sm font-semibold whitespace-nowrap">
                      {formatPYG(lineTotal(line))}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      size="sm"
                      variant="secondary"
                      aria-label={`Quitar una unidad de ${line.name}`}
                      onClick={() =>
                        dispatch({
                          type: "setQuantity",
                          productId: line.productId,
                          quantity: line.quantity - 1,
                        })
                      }
                    >
                      −
                    </Button>
                    <label className="sr-only" htmlFor={`qty-${line.productId}`}>
                      Cantidad de {line.name}
                    </label>
                    <input
                      id={`qty-${line.productId}`}
                      type="number"
                      inputMode="numeric"
                      min={1}
                      max={line.available}
                      value={line.quantity}
                      onChange={(event) => {
                        // An empty field while typing is not "zero": keep the line.
                        if (event.target.value === "") return;
                        dispatch({
                          type: "setQuantity",
                          productId: line.productId,
                          quantity: Number(event.target.value),
                        });
                      }}
                      className="border-border bg-surface h-8 w-16 rounded-md border px-2 text-center text-sm"
                    />
                    <Button
                      size="sm"
                      variant="secondary"
                      aria-label={`Agregar una unidad de ${line.name}`}
                      disabled={line.quantity >= line.available}
                      onClick={() =>
                        dispatch({
                          type: "setQuantity",
                          productId: line.productId,
                          quantity: line.quantity + 1,
                        })
                      }
                    >
                      +
                    </Button>
                    <span className="text-muted text-xs">× {formatPYG(line.unitPrice)}</span>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="ml-auto"
                      aria-label={`Eliminar ${line.name} del carrito`}
                      onClick={() => dispatch({ type: "remove", productId: line.productId })}
                    >
                      Quitar
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          )}
          <dl className="border-border mt-4 flex flex-col gap-1 border-t pt-4 text-sm">
            <div className="flex justify-between">
              <dt className="text-muted">Artículos</dt>
              <dd>{totals.items}</dd>
            </div>
            <div className="flex justify-between text-lg font-semibold">
              <dt>Total</dt>
              <dd data-testid="cart-total">{formatPYG(totals.total)}</dd>
            </div>
          </dl>
          {checkoutError && (
            <p
              role="alert"
              className="bg-danger-soft text-danger-strong mt-3 rounded-md px-3 py-2 text-sm"
            >
              {checkoutError}
            </p>
          )}
          <div className="mt-4 flex gap-2">
            <Button
              size="lg"
              className="flex-1"
              disabled={cart.length === 0}
              loading={checkout.isPending}
              onClick={() => checkout.mutate(cart)}
            >
              Cobrar {totals.total > 0 && formatPYG(totals.total)}
            </Button>
            {cart.length > 0 && (
              <Button size="lg" variant="secondary" onClick={() => dispatch({ type: "clear" })}>
                Vaciar
              </Button>
            )}
          </div>
        </Card>
      </div>
      {cart.length > 0 && (
        // On small screens the cart sits below the catalogue: keep the total in reach.
        <div className="border-border bg-surface/95 fixed inset-x-0 bottom-0 z-20 border-t px-4 py-3 shadow-lg backdrop-blur lg:hidden">
          <a
            href="#cart"
            className="focus-visible:outline-focus mx-auto flex max-w-7xl items-center justify-between gap-3 rounded-md text-sm font-medium focus-visible:outline-2"
          >
            <span>
              {totals.items} {totals.items === 1 ? "artículo" : "artículos"} ·{" "}
              <strong>{formatPYG(totals.total)}</strong>
            </span>
            <span className="bg-primary text-primary-fg rounded-md px-3 py-2">Ver carrito</span>
          </a>
        </div>
      )}
    </>
  );
}
