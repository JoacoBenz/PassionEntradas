import { NextResponse } from "next/server";
import { createServerSupabase, createAdminSupabase } from "@/lib/supabase/server";
import { getRol, esStaff } from "@/lib/auth";
import { isMock, MOCK_FEED_USER, mockPatchPublicacion } from "@/lib/mock-db";
import type { PublicacionEstado } from "@/lib/comunidad";

// PATCH /api/publicaciones/[id] — cambia el estado de una publicación.
// El dueño puede retirarla o reactivarla mientras no haya operación en curso;
// el staff puede además marcarla vendida o en proceso.
export async function PATCH(
  request: Request,
  { params }: { params: { id: string } }
) {
  let body: any;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }

  const estado = body.estado as PublicacionEstado;
  const DE_DUENO: PublicacionEstado[] = ["activa", "retirada"];
  const DE_STAFF: PublicacionEstado[] = ["activa", "retirada", "vendida", "en_proceso"];

  if (isMock()) {
    // En mock el usuario demo es dueño de su publicación y también admin.
    if (!DE_STAFF.includes(estado)) {
      return NextResponse.json({ error: "Estado inválido" }, { status: 400 });
    }
    const res = mockPatchPublicacion(params.id, MOCK_FEED_USER.id, true, estado);
    if (!res.ok) return NextResponse.json({ error: res.error }, { status: res.status });
    return NextResponse.json(res.pub);
  }

  const supabase = createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }
  const staff = esStaff(getRol(user));

  const permitidos = staff ? DE_STAFF : DE_DUENO;
  if (!permitidos.includes(estado)) {
    return NextResponse.json({ error: "Estado inválido" }, { status: 400 });
  }

  const admin = createAdminSupabase();
  const { data: pub, error: readErr } = await admin
    .from("publicaciones")
    .select("id, user_id, estado")
    .eq("id", params.id)
    .maybeSingle();

  if (readErr) {
    return NextResponse.json({ error: readErr.message }, { status: 500 });
  }
  if (!pub) {
    return NextResponse.json({ error: "Publicación no encontrada" }, { status: 404 });
  }
  if (!staff && pub.user_id !== user.id) {
    return NextResponse.json(
      { error: "Solo el dueño puede modificar su publicación" },
      { status: 403 }
    );
  }
  if (!staff && pub.estado === "en_proceso") {
    return NextResponse.json(
      { error: "Hay una operación en curso sobre esta publicación; hablá con el administrador" },
      { status: 409 }
    );
  }

  const { data, error } = await admin
    .from("publicaciones")
    .update({ estado })
    .eq("id", params.id)
    .select("*")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json(data);
}
