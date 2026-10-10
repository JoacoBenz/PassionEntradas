import { redirect } from "next/navigation";
import { createAdminSupabase } from "@/lib/supabase/server";
import { getRol } from "@/lib/auth";
import AppHeader from "@/components/AppHeader";
import BottomNav from "@/components/BottomNav";
import AccesosTabs from "@/components/admin/AccesosTabs";
import EquipoPanel, { type CambioRegistrado } from "@/components/admin/EquipoPanel";
import { leerUsuarios, listarMiembros, type MiembroEquipo } from "@/lib/equipo";
import { isMock, MOCK_USER, mockListCambiosEquipo, mockListUsuarios } from "@/lib/mock-db";
import { usuarioVerificado } from "@/lib/usuario-verificado";

export const dynamic = "force-dynamic";

// Pantalla Equipo (SOLO administrador): quiénes usan el panel y con qué rol.
export default async function EquipoPage() {
  let email: string | null | undefined;
  let yoId: string;
  let miembros: MiembroEquipo[];
  let cambios: CambioRegistrado[];
  let error: string | null = null;

  if (isMock()) {
    email = MOCK_USER.email;
    yoId = MOCK_USER.id;
    miembros = listarMiembros(mockListUsuarios());
    cambios = mockListCambiosEquipo();
  } else {
    const user = await usuarioVerificado();
    if (!user) redirect("/ingresar");
    if (getRol(user) !== "administrador") redirect("/moderador");
    email = user.email;
    yoId = user.id;

    const admin = createAdminSupabase();
    try {
      miembros = listarMiembros(await leerUsuarios(admin));
    } catch (e) {
      miembros = [];
      error = `No se pudo leer el equipo: ${(e as Error).message}`;
    }
    const { data } = await admin
      .from("equipo_cambios")
      .select("id, email, accion, rol_antes, rol_despues, por, created_at")
      .order("created_at", { ascending: false })
      .limit(30);
    cambios = (data ?? []) as CambioRegistrado[];
  }

  return (
    <main className="min-h-svh pb-16 md:pb-10">
      <AppHeader subtitle="Equipo" email={email} nav />
      <div className="mx-auto w-full max-w-5xl px-4 py-5">
        <AccesosTabs activa="equipo" />
        {error && <p className="mb-3 rounded-lg bg-red-50 px-3 py-2 text-sm font-medium text-red-700">{error}</p>}
        <EquipoPanel miembros={miembros} cambios={cambios} yoId={yoId} />
      </div>
      <BottomNav />
    </main>
  );
}
