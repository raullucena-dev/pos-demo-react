import { Card, PageHeader } from "@/components/ui/misc";

const API_REPO = "https://github.com/raullucena-dev/fastapi-multitenant-rls";
const FRONTEND_REPO = "https://github.com/raullucena-dev/pos-demo-react";

const linkClass =
  "font-medium text-primary-strong underline underline-offset-2 hover:text-primary focus-visible:outline-2 focus-visible:outline-focus";

export function AboutPage() {
  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader
        title="Cómo funciona esta demo"
        description="Un punto de venta multi-tenant donde cada tienda está aislada a nivel de aplicación y de base de datos."
      />
      <div className="flex flex-col gap-4 text-sm leading-relaxed">
        <Card>
          <h2 className="mb-2 text-base font-semibold">Dos tiendas, cero datos compartidos</h2>
          <p>
            La demo tiene dos tiendas ficticias, <strong>Demo Store North</strong> (almacén) y{" "}
            <strong>Demo Store South</strong> (ferretería). Cada una es un <em>tenant</em>: si
            ingresás con un usuario de North nunca vas a ver productos, ventas ni auditoría de
            South, aunque compartan la misma base de datos.
          </p>
        </Card>
        <Card>
          <h2 className="mb-2 text-base font-semibold">Aislamiento en dos capas</h2>
          <ol className="list-decimal space-y-2 pl-5">
            <li>
              <strong>Aplicación:</strong> la tienda se deduce solo de la sesión firmada, nunca de
              lo que envía el navegador. Si pedís un id de otra tienda, la API responde 404.
            </li>
            <li>
              <strong>Base de datos:</strong> PostgreSQL aplica Row-Level Security con{" "}
              <code>FORCE</code>. Una consulta sin tienda definida devuelve cero filas, no un error
              ni todos los datos.
            </li>
          </ol>
        </Card>
        <Card>
          <h2 className="mb-2 text-base font-semibold">Arquitectura</h2>
          <p>
            El navegador habla con un único origen: nginx sirve esta aplicación y reenvía{" "}
            <code>/api/*</code> a la API FastAPI. Por eso la cookie de sesión es{" "}
            <code>HttpOnly</code> y no hace falta CORS. Los datos se restablecen cada noche.
          </p>
        </Card>
        <Card>
          <h2 className="mb-2 text-base font-semibold">Código fuente</h2>
          <ul className="list-disc space-y-1 pl-5">
            <li>
              <a className={linkClass} href={API_REPO} target="_blank" rel="noreferrer">
                fastapi-multitenant-rls
              </a>{" "}
              — API, RLS y tests de aislamiento.
            </li>
            <li>
              <a className={linkClass} href={FRONTEND_REPO} target="_blank" rel="noreferrer">
                pos-demo-react
              </a>{" "}
              — esta interfaz.
            </li>
          </ul>
        </Card>
      </div>
    </div>
  );
}
