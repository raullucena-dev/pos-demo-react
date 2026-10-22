import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { useState } from "react";

import { auditApi, queryKeys, usersApi } from "@/api/endpoints";
import { SelectField } from "@/components/ui/Field";
import {
  Badge,
  EmptyState,
  ErrorState,
  PageHeader,
  Pager,
  Spinner,
  tableClasses,
} from "@/components/ui/misc";
import { formatDateTime } from "@/lib/dates";
import { describeAction } from "./actions";

const PAGE_SIZE = 25;

const ENTITY_TYPES: Record<string, string> = {
  "": "Todas",
  sale: "Ventas",
  product: "Productos",
  stock_movement: "Stock",
  user: "Usuarios",
};

export default function AuditPage() {
  const [entityType, setEntityType] = useState("");
  const [page, setPage] = useState(0);
  const params = {
    entityType: entityType || undefined,
    limit: PAGE_SIZE + 1,
    offset: page * PAGE_SIZE,
  };

  const entries = useQuery({
    queryKey: queryKeys.audit(params),
    queryFn: () => auditApi.list(params),
    placeholderData: keepPreviousData,
  });
  const users = useQuery({ queryKey: queryKeys.users, queryFn: usersApi.list, staleTime: 300_000 });
  const usernames = new Map((users.data ?? []).map((u) => [u.id, u.username]));
  const rows = entries.data?.slice(0, PAGE_SIZE) ?? [];

  return (
    <>
      <PageHeader
        title="Auditoría"
        description="Registro inmutable de las operaciones de escritura de esta tienda."
      />
      <div className="mb-4 max-w-xs">
        <SelectField
          label="Entidad"
          value={entityType}
          onChange={(event) => {
            setEntityType(event.target.value);
            setPage(0);
          }}
        >
          {Object.entries(ENTITY_TYPES).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </SelectField>
      </div>
      {entries.isPending ? (
        <Spinner />
      ) : entries.isError ? (
        <ErrorState error={entries.error} onRetry={() => void entries.refetch()} />
      ) : rows.length === 0 ? (
        <EmptyState>Sin registros.</EmptyState>
      ) : (
        <div className={tableClasses.wrapper}>
          <table className={tableClasses.table}>
            <thead>
              <tr>
                <th className={tableClasses.th} scope="col">
                  Fecha
                </th>
                <th className={tableClasses.th} scope="col">
                  Usuario
                </th>
                <th className={tableClasses.th} scope="col">
                  Acción
                </th>
                <th className={tableClasses.th} scope="col">
                  Entidad
                </th>
                <th className={tableClasses.th} scope="col">
                  Detalles
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map((entry) => (
                <tr key={entry.id}>
                  <td className={`${tableClasses.td} whitespace-nowrap`}>
                    {formatDateTime(entry.created_at)}
                  </td>
                  <td className={tableClasses.td}>
                    {entry.actor_user_id === null
                      ? "—"
                      : (usernames.get(entry.actor_user_id) ?? `#${entry.actor_user_id}`)}
                  </td>
                  <td className={tableClasses.td}>
                    <Badge
                      tone={
                        entry.action.includes("failed") || entry.action.includes("locked")
                          ? "danger"
                          : "neutral"
                      }
                    >
                      {describeAction(entry.action)}
                    </Badge>
                  </td>
                  <td className={`${tableClasses.td} whitespace-nowrap`}>
                    {entry.entity_type}
                    {entry.entity_id !== null && ` #${entry.entity_id}`}
                  </td>
                  <td className={tableClasses.td}>
                    {Object.keys(entry.details).length > 0 ? (
                      <code
                        className="text-muted block max-w-xs truncate font-mono text-xs"
                        title={JSON.stringify(entry.details)}
                      >
                        {JSON.stringify(entry.details)}
                      </code>
                    ) : (
                      "—"
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <Pager page={page} hasNext={(entries.data?.length ?? 0) > PAGE_SIZE} onPage={setPage} />
    </>
  );
}
