# ADR 0002: TanStack Query for server state

**Status:** Accepted

## Context

Almost all state in this UI is server state: products and stock, the ledger, sales,
reports, the audit log and the session. It must be fetched, cached, invalidated after
writes and dropped entirely when the session ends. Hand-written `useEffect` fetching
tends to get races, duplicated requests, missing loading and error states, and stale data
after mutations wrong.

## Decision

- **TanStack Query** owns server state. Query keys live in one place
  (`src/api/endpoints.ts` → `queryKeys`), so invalidations stay consistent: a sale
  invalidates products, sales, reports and stock.
- **Local UI state stays local.** The POS cart is a pure reducer (`cart.ts`), and forms
  use react-hook-form.
- **Retries** happen only for network errors and 5xx, never for 4xx.
- **401 is global.** The API client emits an event, and the auth provider clears the
  whole cache and redirects to login with a "session expired" message.
- **Optimistic updates where safe.** At checkout the stock in every cached product list
  is decremented immediately and restored if the API rejects the sale (for example,
  insufficient stock). Other writes wait for the server, because the server decides
  outcomes such as whether a delete is soft or hard.

## Consequences

- Loading, error and refetch states are uniform across screens.
- Logging out or a 401 can never leave another user's data in memory.
- Adds one dependency (about 13 kB gzipped). It also has to be configured for tests;
  each test creates its own `QueryClient`.
