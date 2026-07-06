import { NextResponse } from "next/server";
import { createServerSupabase, createAdminSupabase } from "@/lib/supabase/server";
import { getRol } from "@/lib/auth";
import { isMock, mockDeleteManual } from "@/lib/mock-db";

// DELETE /api/tickets/[id] — borra una entrada MANUAL del catálogo.
// Las del portal las gestiona el worker; no se tocan desde acá.
export async function DELETE(
  _request: Request,
  { params }: { params: { id: string } }
) {
  if (!isMock()) {
    const supabase = createServerSupabase();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user || getRol(user) !== "administrador") {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }
  }

  const id = decodeURIComponent(params.id);

  if (isMock()) {
    if (!mockDeleteManual(id)) {
      return NextResponse.json({ error: "No encontrada" }, { status: 404 });
    }
    return NextResponse.json({ ok: true });
  }
  const admin = createAdminSupabase();
  const { error } = await admin
    .from("tickets")
    .delete()
    .eq("id", id)
    .eq("source", "manual");
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
  return NextResponse.json({ ok: true });
}
