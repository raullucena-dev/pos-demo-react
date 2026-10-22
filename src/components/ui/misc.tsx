import type { ReactNode } from "react";

import { errorMessage, isApiError } from "@/api/errors";

export function Card({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <section className={`border-border bg-surface rounded-xl border p-4 shadow-sm ${className}`}>
      {children}
    </section>
  );
}

type BadgeTone = "neutral" | "success" | "warning" | "danger" | "info";
const BADGE: Record<BadgeTone, string> = {
  neutral: "bg-surface-2 text-fg",
  success: "bg-success-soft text-success-strong",
  warning: "bg-warning-soft text-warning-strong",
  danger: "bg-danger-soft text-danger-strong",
  info: "bg-primary-soft text-primary-strong",
};

export function Badge({ tone = "neutral", children }: { tone?: BadgeTone; children: ReactNode }) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${BADGE[tone]}`}
    >
      {children}
    </span>
  );
}

export function Spinner({ label = "Cargando…" }: { label?: string }) {
  return (
    <div role="status" className="text-muted flex items-center justify-center gap-2 p-6 text-sm">
      <span
        aria-hidden="true"
        className="size-5 animate-spin rounded-full border-2 border-current border-t-transparent"
      />
      {label}
    </div>
  );
}

export function EmptyState({ children }: { children: ReactNode }) {
  return (
    <p className="border-border text-muted rounded-lg border border-dashed p-6 text-center text-sm">
      {children}
    </p>
  );
}

export function ErrorState({ error, onRetry }: { error: unknown; onRetry?: () => void }) {
  const forbidden = isApiError(error) && error.status === 403;
  return (
    <div
      role="alert"
      className="border-danger/40 bg-danger-soft text-danger-strong rounded-lg border p-4 text-sm"
    >
      <p>{forbidden ? "No tenés permiso para ver esta información." : errorMessage(error)}</p>
      {onRetry && !forbidden && (
        <button type="button" onClick={onRetry} className="mt-2 font-medium underline">
          Reintentar
        </button>
      )}
    </div>
  );
}

export function PageHeader({
  title,
  description,
  actions,
}: {
  title: string;
  description?: string;
  actions?: ReactNode;
}) {
  return (
    <header className="mb-5 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="text-fg text-2xl font-semibold tracking-tight">{title}</h1>
        {description && <p className="text-muted mt-1 text-sm">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </header>
  );
}

export function Pager({
  page,
  hasNext,
  onPage,
}: {
  page: number;
  hasNext: boolean;
  onPage: (page: number) => void;
}) {
  return (
    <nav aria-label="Paginación" className="mt-4 flex items-center justify-end gap-2 text-sm">
      <button
        type="button"
        className="border-border rounded-md border px-3 py-1.5 disabled:opacity-40"
        disabled={page === 0}
        onClick={() => onPage(page - 1)}
      >
        Anterior
      </button>
      <span className="text-muted">Página {page + 1}</span>
      <button
        type="button"
        className="border-border rounded-md border px-3 py-1.5 disabled:opacity-40"
        disabled={!hasNext}
        onClick={() => onPage(page + 1)}
      >
        Siguiente
      </button>
    </nav>
  );
}

export const tableClasses = {
  wrapper: "overflow-x-auto rounded-xl border border-border bg-surface",
  table: "w-full min-w-[36rem] text-left text-sm",
  th: "border-b border-border bg-surface-2 px-3 py-2 text-xs font-semibold uppercase tracking-wide text-muted",
  td: "border-b border-border px-3 py-2 align-top text-fg",
};
