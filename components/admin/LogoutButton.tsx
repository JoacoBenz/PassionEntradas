"use client";

import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function LogoutButton() {
  const router = useRouter();

  async function logout() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.replace("/admin/login");
    router.refresh();
  }

  return (
    // Mismas medidas que las otras acciones del header (40px táctil / 36px
    // desktop); min-h-0 para que el global táctil no lo agrande de más.
    <button
      onClick={logout}
      className="inline-flex h-10 min-h-0 items-center justify-center rounded-xl border border-white/15 bg-white/5 px-3.5 text-xs font-medium text-white/85 transition-colors hover:bg-white/15 md:h-9"
    >
      Salir
    </button>
  );
}
