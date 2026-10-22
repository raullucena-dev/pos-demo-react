import { zodResolver } from "@hookform/resolvers/zod";
import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useForm } from "react-hook-form";

import { productsApi, queryKeys, stockApi } from "@/api/endpoints";
import { errorMessage, isApiError, parseStockShortage } from "@/api/errors";
import type { MovementReason, Product, StockMovement } from "@/api/schemas";
import { Button } from "@/components/ui/Button";
import { Dialog } from "@/components/ui/Dialog";
import { SelectField, TextAreaField, TextField } from "@/components/ui/Field";
import {
  Badge,
  EmptyState,
  ErrorState,
  PageHeader,
  Pager,
  Spinner,
  tableClasses,
} from "@/components/ui/misc";
import { useToast } from "@/components/ui/Toast";
import { formatDateTime } from "@/lib/dates";
import {
  movementFormSchema,
  type MovementFormInput,
  type MovementFormOutput,
} from "./movementForm";

const PAGE_SIZE = 25;

const REASONS: Record<
  MovementReason,
  { label: string; tone: "success" | "warning" | "info" | "neutral" }
> = {
  purchase: { label: "Compra", tone: "success" },
  adjustment: { label: "Ajuste", tone: "warning" },
  sale: { label: "Venta", tone: "info" },
  reversal: { label: "Reversión", tone: "neutral" },
};

function MovementForm({ products, onDone }: { products: Product[]; onDone: () => void }) {
  const queryClient = useQueryClient();
  const { notify } = useToast();
  const [formError, setFormError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<MovementFormInput, unknown, MovementFormOutput>({
    resolver: zodResolver(movementFormSchema),
    defaultValues: { product_id: "", reason: "purchase", quantity: "", note: "" },
  });

  const create = useMutation({
    mutationFn: (values: MovementFormOutput) =>
      stockApi.create({ ...values, note: values.note || undefined }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.stockAll });
      void queryClient.invalidateQueries({ queryKey: queryKeys.productsAll });
      notify("Movimiento registrado.", "success");
      onDone();
    },
    onError: (error) => {
      const shortage = isApiError(error) ? parseStockShortage(error) : null;
      setFormError(
        shortage
          ? `El ajuste dejaría el stock en negativo (disponible: ${shortage.available}).`
          : errorMessage(error),
      );
    },
  });

  return (
    <form
      noValidate
      onSubmit={(event) => void handleSubmit((values) => create.mutate(values))(event)}
      className="flex flex-col gap-4"
    >
      <SelectField label="Producto" error={errors.product_id?.message} {...register("product_id")}>
        <option value="">Elegí un producto…</option>
        {products.map((p) => (
          <option key={p.id} value={p.id}>
            {p.name} ({p.sku}) · stock {p.stock_quantity}
          </option>
        ))}
      </SelectField>
      <SelectField label="Tipo" {...register("reason")}>
        <option value="purchase">Compra (suma stock)</option>
        <option value="adjustment">Ajuste (positivo o negativo)</option>
      </SelectField>
      <TextField
        label="Cantidad"
        inputMode="numeric"
        hint="Para ajustes negativos usá un signo menos, por ejemplo -2"
        error={errors.quantity?.message}
        {...register("quantity")}
      />
      <TextAreaField label="Nota (opcional)" error={errors.note?.message} {...register("note")} />
      {formError && (
        <p role="alert" className="text-danger-strong text-sm">
          {formError}
        </p>
      )}
      <div className="flex justify-end">
        <Button type="submit" loading={create.isPending}>
          Registrar movimiento
        </Button>
      </div>
    </form>
  );
}

export default function StockPage() {
  const queryClient = useQueryClient();
  const { notify } = useToast();
  const [productId, setProductId] = useState<number | undefined>(undefined);
  const [page, setPage] = useState(0);
  const [adding, setAdding] = useState(false);
  const [reversing, setReversing] = useState<StockMovement | null>(null);

  const products = useQuery({
    queryKey: queryKeys.products({ limit: 200 }),
    queryFn: ({ signal }) => productsApi.list({ limit: 200 }, signal),
  });
  const params = { productId, limit: PAGE_SIZE + 1, offset: page * PAGE_SIZE };
  const movements = useQuery({
    queryKey: queryKeys.stock(params),
    queryFn: () => stockApi.list(params),
    placeholderData: keepPreviousData,
  });

  const reverse = useMutation({
    mutationFn: (movement: StockMovement) => stockApi.reverse(movement.id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.stockAll });
      void queryClient.invalidateQueries({ queryKey: queryKeys.productsAll });
      notify("Movimiento revertido con un asiento compensatorio.", "success");
    },
    onError: (error) => {
      const shortage = isApiError(error) ? parseStockShortage(error) : null;
      notify(
        shortage
          ? `No se puede revertir: el stock quedaría negativo (disponible: ${shortage.available}).`
          : errorMessage(error),
        "error",
      );
    },
    onSettled: () => setReversing(null),
  });

  const names = new Map((products.data ?? []).map((p) => [p.id, p.name]));
  const rows = movements.data?.slice(0, PAGE_SIZE) ?? [];

  return (
    <>
      <PageHeader
        title="Stock"
        description="Libro de movimientos. Nada se borra: revertir agrega un asiento compensatorio."
        actions={<Button onClick={() => setAdding(true)}>Nuevo movimiento</Button>}
      />
      <div className="mb-4 max-w-sm">
        <SelectField
          label="Filtrar por producto"
          value={productId ?? ""}
          onChange={(event) => {
            setProductId(event.target.value ? Number(event.target.value) : undefined);
            setPage(0);
          }}
        >
          <option value="">Todos los productos</option>
          {(products.data ?? []).map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </SelectField>
      </div>
      {movements.isPending ? (
        <Spinner />
      ) : movements.isError ? (
        <ErrorState error={movements.error} onRetry={() => void movements.refetch()} />
      ) : rows.length === 0 ? (
        <EmptyState>No hay movimientos.</EmptyState>
      ) : (
        <div className={tableClasses.wrapper}>
          <table className={tableClasses.table}>
            <thead>
              <tr>
                <th className={tableClasses.th} scope="col">
                  Fecha
                </th>
                <th className={tableClasses.th} scope="col">
                  Producto
                </th>
                <th className={tableClasses.th} scope="col">
                  Tipo
                </th>
                <th className={`${tableClasses.th} text-right`} scope="col">
                  Cantidad
                </th>
                <th className={tableClasses.th} scope="col">
                  Nota
                </th>
                <th className={`${tableClasses.th} text-right`} scope="col">
                  <span className="sr-only">Acciones</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map((m) => {
                const reversible =
                  (m.reason === "purchase" || m.reason === "adjustment") && !m.reversed_at;
                return (
                  <tr key={m.id}>
                    <td className={`${tableClasses.td} whitespace-nowrap`}>
                      {formatDateTime(m.created_at)}
                    </td>
                    <td className={tableClasses.td}>
                      {names.get(m.product_id) ?? `Producto #${m.product_id}`}
                    </td>
                    <td className={tableClasses.td}>
                      <Badge tone={REASONS[m.reason].tone}>{REASONS[m.reason].label}</Badge>
                      {m.reversed_at && <span className="text-muted ml-2 text-xs">revertido</span>}
                    </td>
                    <td
                      className={`${tableClasses.td} text-right font-mono ${m.quantity > 0 ? "text-success-strong" : "text-danger-strong"}`}
                    >
                      {m.quantity > 0 ? `+${m.quantity}` : m.quantity}
                    </td>
                    <td className={`${tableClasses.td} text-muted`}>
                      {m.note ?? (m.sale_id ? `Venta #${m.sale_id}` : "—")}
                    </td>
                    <td className={`${tableClasses.td} text-right`}>
                      {reversible && (
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => setReversing(m)}
                          aria-label={`Revertir movimiento ${m.id}`}
                        >
                          Revertir
                        </Button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      <Pager page={page} hasNext={(movements.data?.length ?? 0) > PAGE_SIZE} onPage={setPage} />

      <Dialog open={adding} title="Nuevo movimiento de stock" onClose={() => setAdding(false)}>
        <MovementForm products={products.data ?? []} onDone={() => setAdding(false)} />
      </Dialog>

      <Dialog
        open={reversing !== null}
        title="Revertir movimiento"
        onClose={() => setReversing(null)}
        footer={
          <>
            <Button variant="secondary" onClick={() => setReversing(null)}>
              Cancelar
            </Button>
            <Button
              loading={reverse.isPending}
              onClick={() => reversing && reverse.mutate(reversing)}
            >
              Revertir
            </Button>
          </>
        }
      >
        <p className="text-sm">
          Se registrará un movimiento de {reversing ? -reversing.quantity : 0} unidades para «
          {reversing ? (names.get(reversing.product_id) ?? `#${reversing.product_id}`) : ""}».
        </p>
      </Dialog>
    </>
  );
}
