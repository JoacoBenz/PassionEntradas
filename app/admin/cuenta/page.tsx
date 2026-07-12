import { redirect } from "next/navigation";
import { createServerSupabase } from "@/lib/supabase/server";
import AppHeader from "@/components/AppHeader";
import BottomNav from "@/components/BottomNav";
import CambiarClave from "@/components/admin/CambiarClave";
import { isMock, MOCK_USER } from "@/lib/mock-db";

export const dynamic = "force-dynamic";

// Mi cuenta: cambio de contraseña con la sesión activa. Cualquier usuario
// del panel (admin o moderador llegando por URL) puede cambiar la suya.
export default async function CuentaPage() {
  let email: string | null | undefined;

  if (isMock()) {
    email = MOCK_USER.email;
  } else {
    const supabase = createServerSupabase();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) redirect("/admin/login");
    email = user.email;
  }

  return (
    <main className="min-h-svh pb-16 md:pb-10">
      <AppHeader subtitle="Mi cuenta" email={email} nav />
      <CambiarClave mock={isMock()} />
      <BottomNav />
    </main>
  );
}
