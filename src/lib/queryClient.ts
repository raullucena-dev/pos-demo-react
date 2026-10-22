import { QueryClient } from "@tanstack/react-query";

import { isApiError } from "@/api/errors";

export function createQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 30_000,
        refetchOnWindowFocus: false,
        // Only transient server/network failures are worth retrying; 4xx never are.
        retry: (failureCount, error) =>
          failureCount < 2 &&
          isApiError(error) &&
          (error.status >= 500 || error.code === "network_error"),
      },
      mutations: { retry: false },
    },
  });
}
