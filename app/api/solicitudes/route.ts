import { NextResponse } from "next/server";
import { createServerSupabase, createAdminSupabase } from "@/lib/supabase/server";
import { getAlias, getRol, esStaff } from "@/lib/auth";
import {
  isMock,
  MOCK_FEED_USER,
  mockCreateSolicitud,
  mockListSolicitudes,
} from "@/lib/mock-db";

// GET /api/solicitudes — solo staff: todas las solicitudes con su publicación
// (la bandeja del panel admin).
// POST — cualquier usuario: "quiero comprarla" sobre una publicación ajena.

export async function GET() {
  if (isMock()) {
    return NextResponse.json({ solicitudes: mockListSolicitudes() });
  }

  const supabase = createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user || !esStaff(getRol(user))) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const admin = createAdminSupabase();
  const { data, error } = await admin
    .from("solicitudes")
    .select("*, publicacion:publicaciones(*)")
    .order("created_at", { ascending: false })
    .limit(200);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ solicitudes: data });
}

export async function POST(request: Request) {
  let body: any;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }

  const publicacion_id = String(body.publicacion_id ?? "");
  const mensaje = body.mensaje ? String(body.mensaje).trim().slice(0, 500) : null;
  if (!publicacion_id) {
    return NextResponse.json({ error: "Falta la publicación" }, { status: 400 });
  }

  if (isMock()) {
    const res = mockCreateSolicitud({
      publicacion_id,
      comprador_id: MOCK_FEED_USER.id,
      comprador_alias: MOCK_FEED_USER.alias,
      mensaje,
    });
    if (!res.ok) return NextResponse.json({ error: res.error }, { status: res.status });
    return NextResponse.json(res.sol, { status: 201 });
  }

  const supabase = createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const admin = createAdminSupabase();
  const { data: pub, error: readErr } = await admin
    .from("publicaciones")
    .select("id, user_id, estado")
    .eq("id", publicacion_id)
    .maybeSingle();

  if (readErr) {
    return NextResponse.json({ error: readErr.message }, { status: 500 });
  }
  if (!pub) {
    return NextResponse.json({ error: "Publicación no encontrada" }, { status: 404 });
  }
  if (pub.estado !== "activa") {
    return NextResponse.json({ error: "La publicación ya no está disponible" }, { status: 409 });
  }
  if (pub.user_id === user.id) {
    return NextResponse.json({ error: "No podés solicitar tu propia publicación" }, { status: 409 });
  }

  const { data, error } = await admin
    .from("solicitudes")
    .insert({
      publicacion_id,
      comprador_id: user.id,
      comprador_alias: getAlias(user),
      mensaje,
    })
    .select("*")
    .single();

  if (error) {
    // 23505: ya existe una solicitud de este usuario para esta publicación.
    if ((error as any).code === "23505") {
      return NextResponse.json(
        { error: "Ya enviaste una solicitud para esta publicación" },
        { status: 409 }
      );
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json(data, { status: 201 });
}
