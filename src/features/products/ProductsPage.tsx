import { zodResolver } from "@hookform/resolvers/zod";
import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useForm } from "react-hook-form";

import { productsApi, queryKeys, type ProductInput } from "@/api/endpoints";
import { errorMessage, isApiError } from "@/api/errors";
import type { Product } from "@/api/schemas";
import { useAuth } from "@/auth/AuthProvider";
import { can } from "@/auth/permissions";
import { Button } from "@/components/ui/Button";
import { Dialog } from "@/components/ui/Dialog";
import { TextField } from "@/components/ui/Field";
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
import { formatNumber, formatPYG } from "@/lib/money";
import { useDebouncedValue } from "@/lib/useDebouncedValue";
import { productFormSchema, type ProductFormInput, type ProductFormOutput } from "./productForm";

const PAGE_SIZE = 25;
function ProductForm({
  product,
  onDone,
}: {
  product: Product | null;
  onDone: (message: string) => void;
}) {
  const queryClient = useQueryClient();
  const [formError, setFormError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors },
  } = useForm<ProductFormInput, unknown, ProductFormOutput>({
    resolver: zodResolver(productFormSchema),
    defaultValues: {
      sku: product?.sku ?? "",
      name: product?.name ?? "",
      price: product ? String(product.price) : "",
    },
  });

  const save = useMutation({
    mutationFn: (input: ProductInput) =>
      product ? productsApi.update(product.id, input) : productsApi.create(input),
    onSuccess: (saved) => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.productsAll });
      onDone(
        product ? `Producto «${saved.name}» actualizado.` : `Producto «${saved.name}» creado.`,
      );
    },
    onError: (error) => {
      if (isApiError(error) && error.status === 409) {
        setError("sku", { message: "Ya existe un producto activo con ese SKU" });
        return;
      }
      if (isApiError(error) && error.code === "validation_error") {
        for (const issue of error.issues) {
          if (issue.field === "sku" || issue.field === "name" || issue.field === "price") {
            setError(issue.field, { message: issue.message });
          }
        }
      }
      setFormError(errorMessage(error));
    },
  });

  return (
    <form
      id="product-form"
      noValidate
      onSubmit={(event) => void handleSubmit((values) => save.mutate(values))(event)}
      className="flex flex-col gap-4"
    >
      <TextField label="SKU" autoComplete="off" error={errors.sku?.message} {...register("sku")} />
      <TextField
        label="Nombre"
        autoComplete="off"
        error={errors.name?.message}
        {...register("name")}
      />
      <TextField
        label="Precio (Gs.)"
        inputMode="numeric"
        hint="Sin decimales, por ejemplo 18500 o 18.500"
        error={errors.price?.message}
        {...register("price")}
      />
      {formError && (
        <p role="alert" className="text-danger-strong text-sm">
          {formError}
        </p>
      )}
      <div className="flex justify-end gap-2">
        <Button type="submit" loading={save.isPending}>
          {product ? "Guardar cambios" : "Crear producto"}
        </Button>
      </div>
    </form>
  );
}

export default function ProductsPage() {
  const { user } = useAuth();
  const { notify } = useToast();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const q = useDebouncedValue(search.trim());
  const [page, setPage] = useState(0);
  const [editing, setEditing] = useState<Product | "new" | null>(null);
  const [deleting, setDeleting] = useState<Product | null>(null);
  const canWrite = can(user?.role, "products:write");
  const canDelete = can(user?.role, "products:delete");

  const params = { q, limit: PAGE_SIZE + 1, offset: page * PAGE_SIZE };
  const products = useQuery({
    queryKey: queryKeys.products(params),
    queryFn: ({ signal }) => productsApi.list(params, signal),
    placeholderData: keepPreviousData,
  });

  const remove = useMutation({
    mutationFn: (product: Product) => productsApi.remove(product.id),
    onSuccess: (result, product) => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.productsAll });
      notify(
        result.mode === "soft"
          ? `«${product.name}» se archivó: tiene ventas o movimientos, así que se conserva el historial.`
          : `«${product.name}» se eliminó.`,
        "success",
      );
      setDeleting(null);
    },
    onError: (error) => {
      notify(errorMessage(error), "error");
      setDeleting(null);
    },
  });

  const rows = products.data?.slice(0, PAGE_SIZE) ?? [];
  const hasNext = (products.data?.length ?? 0) > PAGE_SIZE;

  return (
    <>
      <PageHeader
        title="Productos"
        description="Catálogo de la tienda. Los productos con historial se archivan en lugar de borrarse."
        actions={canWrite && <Button onClick={() => setEditing("new")}>Nuevo producto</Button>}
      />
      <label htmlFor="product-search" className="sr-only">
        Buscar productos
      </label>
      <input
        id="product-search"
        type="search"
        value={search}
        onChange={(event) => {
          setSearch(event.target.value);
          setPage(0);
        }}
        placeholder="Buscar por nombre o SKU…"
        className="border-border bg-surface focus-visible:outline-focus mb-4 h-10 w-full max-w-md rounded-md border px-3 text-sm focus-visible:outline-2"
      />
      {products.isPending ? (
        <Spinner />
      ) : products.isError ? (
        <ErrorState error={products.error} onRetry={() => void products.refetch()} />
      ) : rows.length === 0 ? (
        <EmptyState>No hay productos.</EmptyState>
      ) : (
        <div className={tableClasses.wrapper}>
          <table className={tableClasses.table}>
            <thead>
              <tr>
                <th className={tableClasses.th} scope="col">
                  SKU
                </th>
                <th className={tableClasses.th} scope="col">
                  Nombre
                </th>
                <th className={`${tableClasses.th} text-right`} scope="col">
                  Precio
                </th>
                <th className={`${tableClasses.th} text-right`} scope="col">
                  Stock
                </th>
                {(canWrite || canDelete) && (
                  <th className={`${tableClasses.th} text-right`} scope="col">
                    <span className="sr-only">Acciones</span>
                  </th>
                )}
              </tr>
            </thead>
            <tbody>
              {rows.map((product) => (
                <tr key={product.id}>
                  <td className={`${tableClasses.td} font-mono text-xs`}>{product.sku}</td>
                  <td className={tableClasses.td}>{product.name}</td>
                  <td className={`${tableClasses.td} text-right`}>{formatPYG(product.price)}</td>
                  <td className={`${tableClasses.td} text-right`}>
                    <Badge
                      tone={
                        product.stock_quantity === 0
                          ? "danger"
                          : product.stock_quantity <= 5
                            ? "warning"
                            : "neutral"
                      }
                    >
                      {formatNumber(product.stock_quantity)}
                    </Badge>
                  </td>
                  {(canWrite || canDelete) && (
                    <td className={`${tableClasses.td} text-right whitespace-nowrap`}>
                      {canWrite && (
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => setEditing(product)}
                          aria-label={`Editar ${product.name}`}
                        >
                          Editar
                        </Button>
                      )}
                      {canDelete && (
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => setDeleting(product)}
                          aria-label={`Eliminar ${product.name}`}
                        >
                          Eliminar
                        </Button>
                      )}
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <Pager page={page} hasNext={hasNext} onPage={setPage} />

      <Dialog
        open={editing !== null}
        title={editing === "new" ? "Nuevo producto" : "Editar producto"}
        onClose={() => setEditing(null)}
      >
        {editing !== null && (
          <ProductForm
            product={editing === "new" ? null : editing}
            onDone={(message) => {
              notify(message, "success");
              setEditing(null);
            }}
          />
        )}
      </Dialog>

      <Dialog
        open={deleting !== null}
        title="Eliminar producto"
        onClose={() => setDeleting(null)}
        footer={
          <>
            <Button variant="secondary" onClick={() => setDeleting(null)}>
              Cancelar
            </Button>
            <Button
              variant="danger"
              loading={remove.isPending}
              onClick={() => deleting && remove.mutate(deleting)}
            >
              Eliminar
            </Button>
          </>
        }
      >
        <p className="text-sm">
          ¿Eliminar «{deleting?.name}»? Si tiene ventas o movimientos de stock se archivará y su
          historial se conservará.
        </p>
      </Dialog>
    </>
  );
}
