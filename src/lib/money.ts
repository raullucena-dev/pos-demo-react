/** Guaraníes have no fractional unit in practice: amounts are handled as integers. */
const pyg = new Intl.NumberFormat("es-PY", {
  style: "currency",
  currency: "PYG",
  maximumFractionDigits: 0,
  minimumFractionDigits: 0,
});

const plain = new Intl.NumberFormat("es-PY", { maximumFractionDigits: 0 });

/** `18500` → `"Gs. 18.500"`. */
export function formatPYG(amount: number): string {
  return pyg.format(Math.round(amount));
}

/** `1234567` → `"1.234.567"`. */
export function formatNumber(value: number): string {
  return plain.format(value);
}

/**
 * Parses an API decimal string (`"18500.00"`) into whole guaraníes. The API stores
 * NUMERIC(12,2); for PYG the fractional part is always zero, but it is rounded anyway.
 */
export function parseMoney(value: string): number {
  if (!/^-?\d+(\.\d+)?$/.test(value)) {
    throw new TypeError(`not a decimal amount: ${JSON.stringify(value)}`);
  }
  return Math.round(Number(value));
}

/** Parses user input such as `"18.500"`, `"18500"` or `"Gs. 18.500"`; null if invalid. */
export function parseGuaraniesInput(input: string): number | null {
  const digits = input.replace(/gs\.?/i, "").replace(/[\s.]/g, "");
  if (!/^\d+$/.test(digits)) return null;
  const value = Number(digits);
  return Number.isSafeInteger(value) ? value : null;
}
