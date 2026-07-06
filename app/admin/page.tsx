import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { createServerSupabase } from "@/lib/supabase/server";
import { getRol } from "@/lib/auth";
import AdminDashboard from "@/components/admin/AdminDashboard";
import AppHeader from "@/components/AppHeader";
import type { Operacion } from "@/lib/operaciones";
import { isMock, MOCK_USER, mockListOps } from "@/lib/mock-db";

export const dynamic = "force-dynamic";

// Deriva la URL base para armar los links públicos.
function getBaseUrl(): string {
  if (process.env.NEXT_PUBLIC_SITE_URL) {
    return process.env.NEXT_PUBLIC_SITE_URL.replace(/\/$/, "");
  }
  const h = headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  const proto = h.get("x-forwarded-proto") ?? "http";
  return `${proto}://${host}`;
}

// Módulo del administrador: chequea y actualiza los estados.
export default async function AdminPage() {
  let email: string | null | undefined;
  let ops: Operacion[];

  if (isMock()) {
    email = MOCK_USER.email;
    ops = mockListOps();
  } else {
    const supabase = createServerSupabase();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    // Refuerzo por si el middleware no corrió (defensa en profundidad).
    if (!user) {
      redirect("/admin/login");
    }
    if (getRol(user) !== "administrador") {
      redirect("/moderador");
    }
    email = user.email;

    const { data } = await supabase
      .from("operaciones")
      .select("*")
      .order("created_at", { ascending: false });
    ops = (data ?? []) as Operacion[];
  }

  return (
    <main className="min-h-dvh">
      <AppHeader
        subtitle="Administración"
        email={email}
        actions={[
          { href: "/moderador", label: "＋ Cargar operación" },
          { href: "/admin/entradas", label: "Entradas" },
        ]}
      />
      <AdminDashboard initial={ops} baseUrl={getBaseUrl()} />
    </main>
  );
}
