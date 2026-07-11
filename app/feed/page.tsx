import { redirect } from "next/navigation";
import { createServerSupabase } from "@/lib/supabase/server";
import { getAlias, getRol, esStaff } from "@/lib/auth";
import Feed from "@/components/comunidad/Feed";
import { isMock, MOCK_FEED_USER } from "@/lib/mock-db";

export const dynamic = "force-dynamic";

// Feed de la comunidad: entradas publicadas por los propios usuarios.
// Los datos los trae el cliente de /api/publicaciones; acá solo se
// resuelve la identidad para el header.
export default async function FeedPage() {
  let alias: string;
  let staff = false;

  if (isMock()) {
    alias = MOCK_FEED_USER.alias;
    staff = true;
  } else {
    const supabase = createServerSupabase();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) redirect("/ingresar");
    alias = getAlias(user);
    staff = esStaff(getRol(user));
  }

  return <Feed alias={alias} staff={staff} mock={isMock()} />;
}
