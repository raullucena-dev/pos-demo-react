import { zodResolver } from "@hookform/resolvers/zod";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { useForm } from "react-hook-form";

import { queryKeys, salesApi } from "@/api/endpoints";
import { Button } from "@/components/ui/Button";
import { TextField } from "@/components/ui/Field";
import {
  Card,
  EmptyState,
  ErrorState,
  PageHeader,
  Spinner,
  tableClasses,
} from "@/components/ui/misc";
import { downloadCsv } from "@/lib/csv";
import { addDays, todayInParaguay } from "@/lib/dates";
import { formatNumber, formatPYG } from "@/lib/money";
import { dailySeries, rangeSchema, reportCsvRows, type Range } from "./reportData";
import { RevenueChart } from "./RevenueChart";

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <Card>
      <p className="text-muted text-xs font-medium tracking-wide uppercase">{label}</p>
      <p className="mt-1 text-2xl font-semibold">{value}</p>
    </Card>
  );
}

export default function ReportsPage() {
  const today = todayInParaguay();
  const [range, setRange] = useState<Range>({ dateFrom: addDays(today, -13), dateTo: today });
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<Range>({ resolver: zodResolver(rangeSchema), defaultValues: range });

  const report = useQuery({
    queryKey: queryKeys.report(range.dateFrom, range.dateTo),
    queryFn: () => salesApi.report(range.dateFrom, range.dateTo),
    placeholderData: keepPreviousData,
  });

  const data = report.data;
  const average = data && data.sales_count > 0 ? data.revenue / data.sales_count : 0;

  return (
    <>
      <PageHeader
        title="Reporte de ventas"
        description="Totales por rango de fechas (hora de Paraguay)."
        actions={
          data && (
            <Button
              variant="secondary"
              onClick={() =>
                downloadCsv(`ventas_${data.date_from}_${data.date_to}.csv`, reportCsvRows(data))
              }
            >
              Exportar CSV
            </Button>
          )
        }
      />
      <form
        noValidate
        onSubmit={(event) => void handleSubmit(setRange)(event)}
        className="mb-6 flex flex-wrap items-end gap-3"
      >
        <TextField
          label="Desde"
          type="date"
          error={errors.dateFrom?.message}
          {...register("dateFrom")}
        />
        <TextField
          label="Hasta"
          type="date"
          error={errors.dateTo?.message}
          {...register("dateTo")}
        />
        <Button type="submit">Actualizar</Button>
      </form>

      {report.isPending ? (
        <Spinner />
      ) : report.isError ? (
        <ErrorState error={report.error} onRetry={() => void report.refetch()} />
      ) : data ? (
        <div className="flex flex-col gap-6">
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <Stat label="Ingresos" value={formatPYG(data.revenue)} />
            <Stat label="Ventas" value={formatNumber(data.sales_count)} />
            <Stat label="Artículos" value={formatNumber(data.items_sold)} />
            <Stat label="Ticket promedio" value={formatPYG(average)} />
          </div>
          <Card>
            <h2 className="mb-3 text-base font-semibold">Ingresos por día</h2>
            {data.sales_count === 0 ? (
              <EmptyState>No hubo ventas en este período.</EmptyState>
            ) : (
              <RevenueChart points={dailySeries(data)} />
            )}
          </Card>
          <section>
            <h2 className="mb-3 text-base font-semibold">Productos más vendidos</h2>
            {data.top_products.length === 0 ? (
              <EmptyState>Sin datos.</EmptyState>
            ) : (
              <div className={tableClasses.wrapper}>
                <table className={tableClasses.table}>
                  <thead>
                    <tr>
                      <th className={tableClasses.th} scope="col">
                        Producto
                      </th>
                      <th className={tableClasses.th} scope="col">
                        SKU
                      </th>
                      <th className={`${tableClasses.th} text-right`} scope="col">
                        Cantidad
                      </th>
                      <th className={`${tableClasses.th} text-right`} scope="col">
                        Ingresos
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.top_products.map((p) => (
                      <tr key={p.product_id}>
                        <td className={tableClasses.td}>{p.name}</td>
                        <td className={`${tableClasses.td} font-mono text-xs`}>{p.sku}</td>
                        <td className={`${tableClasses.td} text-right`}>
                          {formatNumber(p.quantity)}
                        </td>
                        <td className={`${tableClasses.td} text-right`}>{formatPYG(p.revenue)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </div>
      ) : null}
    </>
  );
}
