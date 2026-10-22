import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createContext, useCallback, useContext, useEffect, useMemo, type ReactNode } from "react";
import { useNavigate } from "react-router";

import { onUnauthorized } from "@/api/client";
import { authApi, queryKeys } from "@/api/endpoints";
import { isApiError } from "@/api/errors";
import type { User } from "@/api/schemas";

interface AuthState {
  user: User | null;
  isLoading: boolean;
  login: (username: string, password: string) => Promise<User>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthState | null>(null);

/** Probes the cookie session; a 401 here simply means "not logged in". */
async function fetchSession(): Promise<User | null> {
  try {
    return await authApi.me();
  } catch (error) {
    if (isApiError(error) && error.status === 401) return null;
    throw error;
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const session = useQuery({ queryKey: queryKeys.me, queryFn: fetchSession, staleTime: Infinity });
  const user = session.data ?? null;

  // Any 401 on an authenticated request: drop all cached data and go to login.
  useEffect(
    () =>
      onUnauthorized(() => {
        const hadUser = queryClient.getQueryData<User | null>(queryKeys.me) != null;
        queryClient.clear();
        queryClient.setQueryData(queryKeys.me, null);
        if (hadUser) void navigate("/login", { replace: true, state: { expired: true } });
      }),
    [queryClient, navigate],
  );

  const loginMutation = useMutation({
    mutationFn: ({ username, password }: { username: string; password: string }) =>
      authApi.login(username, password),
    onSuccess: (loggedIn) => {
      queryClient.clear();
      queryClient.setQueryData(queryKeys.me, loggedIn);
    },
  });

  const login = useCallback(
    (username: string, password: string) => loginMutation.mutateAsync({ username, password }),
    [loginMutation],
  );

  const logout = useCallback(async () => {
    try {
      await authApi.logout();
    } finally {
      queryClient.clear();
      queryClient.setQueryData(queryKeys.me, null);
      void navigate("/login", { replace: true });
    }
  }, [queryClient, navigate]);

  const value = useMemo(
    () => ({ user, isLoading: session.isPending, login, logout }),
    [user, session.isPending, login, logout],
  );
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used inside AuthProvider");
  return context;
}
