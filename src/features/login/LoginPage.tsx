import { zodResolver } from "@hookform/resolvers/zod";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { Navigate, useLocation, useNavigate } from "react-router";
import { z } from "zod";

import { demoApi, queryKeys } from "@/api/endpoints";
import { errorMessage, isApiError } from "@/api/errors";
import { useAuth } from "@/auth/AuthProvider";
import { ROLE_LABELS } from "@/auth/permissions";
import { ThemeToggle } from "@/components/ThemeToggle";
import { Button } from "@/components/ui/Button";
import { TextField } from "@/components/ui/Field";
import { Card } from "@/components/ui/misc";

const loginSchema = z.object({
  username: z.string().trim().min(1, "Ingresá tu usuario"),
  password: z.string().min(1, "Ingresá tu contraseña"),
});
type LoginForm = z.infer<typeof loginSchema>;

function loginErrorMessage(error: unknown): string {
  if (isApiError(error)) {
    if (error.status === 401) return "Usuario o contraseña incorrectos.";
    if (error.status === 423)
      return "Demasiados intentos fallidos. Esperá un minuto e intentá de nuevo.";
  }
  return errorMessage(error);
}

interface LocationState {
  expired?: boolean;
  from?: string;
}

export function LoginPage() {
  const { user, login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const state = (location.state ?? {}) as LocationState;
  const [formError, setFormError] = useState<string | null>(null);
  const demo = useQuery({
    queryKey: queryKeys.demoInfo,
    queryFn: demoApi.info,
    retry: false,
    staleTime: Infinity,
  });

  const {
    register,
    handleSubmit,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<LoginForm>({
    resolver: zodResolver(loginSchema),
    defaultValues: { username: "", password: "" },
  });

  if (user) return <Navigate to={state.from ?? "/pos"} replace />;

  const onSubmit = handleSubmit(async ({ username, password }) => {
    setFormError(null);
    try {
      await login(username, password);
      void navigate(state.from ?? "/pos", { replace: true });
    } catch (error) {
      setFormError(loginErrorMessage(error));
    }
  });

  const fillCredentials = (username: string) => {
    if (!demo.data) return;
    setValue("username", username, { shouldValidate: true });
    setValue("password", demo.data.password, { shouldValidate: true });
  };

  return (
    <div className="mx-auto flex min-h-dvh max-w-5xl flex-col justify-center gap-6 px-4 py-10">
      <div className="flex justify-end">
        <ThemeToggle />
      </div>
      <div className="grid gap-6 md:grid-cols-2">
        <Card className="p-6">
          <h1 className="text-2xl font-semibold tracking-tight">Iniciar sesión</h1>
          <p className="text-muted mt-1 text-sm">Punto de venta multi-tienda.</p>
          {state.expired && (
            <p
              role="alert"
              className="bg-warning-soft text-warning-strong mt-4 rounded-md px-3 py-2 text-sm"
            >
              Tu sesión expiró. Iniciá sesión de nuevo para continuar.
            </p>
          )}
          <form
            onSubmit={(event) => void onSubmit(event)}
            className="mt-5 flex flex-col gap-4"
            noValidate
          >
            <TextField
              label="Usuario"
              autoComplete="username"
              autoCapitalize="none"
              error={errors.username?.message}
              {...register("username")}
            />
            <TextField
              label="Contraseña"
              type="password"
              autoComplete="current-password"
              error={errors.password?.message}
              {...register("password")}
            />
            {formError && (
              <p
                role="alert"
                className="bg-danger-soft text-danger-strong rounded-md px-3 py-2 text-sm"
              >
                {formError}
              </p>
            )}
            <Button type="submit" size="lg" loading={isSubmitting}>
              Ingresar
            </Button>
          </form>
        </Card>

        {demo.data && (
          <Card className="p-6">
            <h2 className="text-lg font-semibold">Credenciales de demostración</h2>
            <p className="text-muted mt-1 text-sm">
              Contraseña para todos los usuarios:{" "}
              <code className="bg-surface-2 text-fg rounded px-1.5 py-0.5 font-mono">
                {demo.data.password}
              </code>
            </p>
            <div className="mt-4 flex flex-col gap-4">
              {demo.data.stores.map((store) => (
                <div key={store.slug}>
                  <h3 className="text-sm font-semibold">{store.name}</h3>
                  <ul className="mt-2 flex flex-col gap-1.5">
                    {store.users.map((demoUser) => (
                      <li
                        key={demoUser.username}
                        className="flex items-center justify-between gap-2 text-sm"
                      >
                        <span>
                          <code className="font-mono">{demoUser.username}</code>{" "}
                          <span className="text-muted">· {ROLE_LABELS[demoUser.role]}</span>
                        </span>
                        <Button
                          size="sm"
                          variant="secondary"
                          onClick={() => fillCredentials(demoUser.username)}
                          aria-label={`Usar ${demoUser.username}`}
                        >
                          Usar
                        </Button>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
            <ul className="text-muted mt-4 list-disc pl-5 text-xs">
              <li>
                Cada tienda es un tenant separado: al ingresar a una nunca ves datos de la otra.
              </li>
              <li>Todos los datos son ficticios y se restablecen cada noche.</li>
            </ul>
          </Card>
        )}
      </div>
    </div>
  );
}
