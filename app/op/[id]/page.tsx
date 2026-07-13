import { notFound } from "next/navigation";
import { createServerSupabase } from "@/lib/supabase/server";
import StatusStub from "@/components/StatusStub";
import AutoRefresh from "@/components/AutoRefresh";
import type { OperacionPublica, Status } from "@/lib/operaciones";
import { isMock, mockOpPublica } from "@/lib/mock-db";

// Página pública read-only. Se accede por el uuid (impredecible).
// Lee vía el RPC `operacion_publica`, que exige el uuid exacto y devuelve
// SOLO campos seguros: evento, monto, estado, aliases y fecha.
export const dynamic = "force-dynamic";

// Validación básica de uuid v4/genérico para no consultar con basura.
const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function OperacionPublicaPage({
  params,
}: {
  params: { id: string };
}) {
  if (!UUID_RE.test(params.id)) {
    notFound();
  }

  let op: OperacionPublica;

  if (isMock()) {
    const mock = mockOpPublica(params.id);
    if (!mock) notFound();
    op = mock;
  } else {
    const supabase = createServerSupabase();

    const { data, error } = await supabase
      .rpc("operacion_publica", { op_id: params.id })
      .maybeSingle();

    if (error || !data) {
      notFound();
    }

    op = {
      ...(data as Omit<OperacionPublica, "status"> & { status: string }),
      status: (data as { status: string }).status as Status,
    };
  }

  return (
    <main className="flex min-h-dvh flex-col items-center justify-center px-4 py-8">
      {/* Repolea una versión mínima y solo re-baja la página si la operación
          cambió: este link vive abierto en los grupos, es el tráfico grande. */}
      <AutoRefresh versionUrl={`/api/op/${params.id}/version`} />
      <StatusStub op={op} />
      <footer className="mt-6 text-center text-xs text-muted">
        AdminTickets · Custodia de operaciones
      </footer>
    </main>
  );
}
