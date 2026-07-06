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
    <button
      onClick={logout}
      className="rounded-lg border border-white/25 px-3 py-1.5 text-xs font-medium text-white/85 transition-colors hover:bg-white/10"
    >
      Salir
    </button>
  );
}
