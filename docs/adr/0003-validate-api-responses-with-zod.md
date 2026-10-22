# ADR 0003: Validate API responses with zod

**Status:** Accepted

## Context

TypeScript types for API responses are promises the compiler cannot check at run time.
If the API changes a field or returns an error page from a proxy, the UI would fail
later and far from the cause. A typical example is `undefined.toFixed`. Money adds a
specific trap: the API returns `NUMERIC` amounts as strings (`"18500.00"`), and doing
arithmetic on them as strings fails silently.

## Decision

- Every response is parsed with a **zod schema** in `src/api/schemas.ts`. The TypeScript
  types are inferred from those schemas, so there is a single source of truth.
- Money is converted once, at the boundary: decimal strings become whole guaraníes
  (`number`). Guaraníes have no fractional unit, so integer arithmetic is exact. Values
  are formatted only when shown (`Intl.NumberFormat("es-PY", { currency: "PYG" })` →
  `Gs. 18.500`).
- A payload that fails validation becomes an `ApiError` with code `invalid_response`,
  shown as a normal error state rather than a crash.
- Forms use zod as well (via react-hook-form), mirroring the API's rules (SKU pattern,
  name length, whole-guaraní prices, valid date ranges), so most errors never reach the
  server. Server-side 409/422 errors are still mapped back onto the fields.

## Consequences

- Contract drift is detected at the edge, with a precise message.
- The bundle includes zod (shared with the forms). That was judged worth it for a
  money-handling UI.
- The schemas have to be kept in step with the API. The MSW mock follows the same
  contract, so the tests catch most mismatches.
