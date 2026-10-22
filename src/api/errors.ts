export interface FieldIssue {
  field: string;
  message: string;
}

/** Any non-2xx response, network failure or malformed payload from the API. */
export class ApiError extends Error {
  readonly status: number;
  readonly code: string;
  readonly issues: FieldIssue[];
  readonly retryAfterSeconds: number | undefined;

  constructor(
    status: number,
    code: string,
    message: string,
    options: { issues?: FieldIssue[]; retryAfterSeconds?: number | undefined } = {},
  ) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
    this.issues = options.issues ?? [];
    this.retryAfterSeconds = options.retryAfterSeconds;
  }
}

export const isApiError = (error: unknown): error is ApiError => error instanceof ApiError;

export interface StockShortage {
  productId: number;
  available: number;
  requested: number;
}

/** Extracts details from the API's insufficient-stock message, when present. */
export function parseStockShortage(error: ApiError): StockShortage | null {
  if (error.code !== "insufficient_stock") return null;
  const match = /product (\d+): have (-?\d+), (?:requested|change) (-?\d+)/.exec(error.message);
  if (!match) return null;
  return {
    productId: Number(match[1]),
    available: Number(match[2]),
    requested: Math.abs(Number(match[3])),
  };
}

/** User-facing Spanish message for an API error. */
export function errorMessage(error: unknown): string {
  if (!isApiError(error)) return "Ocurrió un error inesperado. Intentá de nuevo.";
  switch (error.code) {
    case "network_error":
      return "No se pudo conectar con el servidor. Revisá tu conexión.";
    case "invalid_response":
      return "El servidor respondió con datos inesperados.";
    case "not_authenticated":
      return "Tu sesión no es válida. Iniciá sesión de nuevo.";
    case "forbidden":
      return "No tenés permiso para realizar esta acción.";
    case "not_found":
      return "El recurso no existe o pertenece a otra tienda.";
    case "insufficient_stock":
      return "No hay stock suficiente para completar la operación.";
    case "account_locked":
      return "Demasiados intentos fallidos. Esperá un momento e intentá de nuevo.";
    case "rate_limited":
      return `Demasiadas solicitudes. Esperá ${error.retryAfterSeconds ?? 60} segundos.`;
    case "validation_error":
      return "Revisá los datos ingresados.";
    case "conflict":
      return "La operación entra en conflicto con datos existentes.";
    default:
      return error.status >= 500
        ? "El servidor tuvo un problema. Intentá de nuevo en unos segundos."
        : "No se pudo completar la operación.";
  }
}
