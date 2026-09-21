import { redirect } from "next/navigation";
import { createServerSupabase, createAdminSupabase } from "@/lib/supabase/server";
import { esStaff, getRol } from "@/lib/auth";
import AppHeader from "@/components/AppHeader";
import BottomNav from "@/components/BottomNav";
import ConsultasPanel from "@/components/admin/ConsultasPanel";
import type { Consulta } from "@/lib/operaciones";
import { isMock, MOCK_USER, mockListConsultas } from "@/lib/mock-db";

export const dynamic = "force-dynamic";

// Cola de consultas: pedidos sin precio cerrado. Se les carga el monto
// acordado y ahí se convierten en operación.
export default async function ConsultasPage() {
  let email: string | null | undefined;
  let consultas: Consulta[];

  if (isMock()) {
    email = MOCK_USER.email;
    consultas = mockListConsultas();
  } else {
    const supabase = createServerSupabase();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) redirect("/ingresar");
    // Staff: el moderador también atiende la cola, igual que en el panel.
    if (!esStaff(getRol(user))) redirect("/entradas");
    email = user.email;

    // Lectura con service role (tabla RLS deny-all). El rol ya fue validado.
    const { data } = await createAdminSupabase()
      .from("consultas")
      .select(
        "id, code, envio_id, cliente_id, cliente_email, comprador_alias, ticket_id, evento, sector, fecha_evento, cantidad, notas, estado, operacion_id, resuelta_por, resuelta_at, created_at, updated_at"
      )
      .order("created_at", { ascending: false })
      .limit(500);
    consultas = (data ?? []) as Consulta[];
  }

  return (
    <main className="min-h-svh pb-16 md:pb-10">
      <AppHeader subtitle="Consultas" email={email} nav />
      <ConsultasPanel initial={consultas} />
      <BottomNav />
    </main>
  );
}
