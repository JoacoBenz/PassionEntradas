import { NextResponse } from "next/server";
import { createServerSupabase, createAdminSupabase } from "@/lib/supabase/server";
import { getAlias } from "@/lib/auth";
import {
  isMock,
  MOCK_FEED_USER,
  mockListPublicaciones,
  mockMisSolicitudes,
  mockCreatePublicacion,
} from "@/lib/mock-db";

// GET /api/publicaciones — el feed: publicaciones de todos los usuarios,
// más las solicitudes propias (para pintar "ya la pediste").
// POST — publica una entrada propia.
// Cualquier usuario autenticado; las escrituras van con service role.

async function currentUser() {
  if (isMock()) {
    return { id: MOCK_FEED_USER.id, alias: MOCK_FEED_USER.alias };
  }
  const supabase = createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  return { id: user.id, alias: getAlias(user) };
}

export async function GET() {
  const user = await currentUser();
  if (!user) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  if (isMock()) {
    return NextResponse.json({
      publicaciones: mockListPublicaciones(),
      mis_solicitudes: mockMisSolicitudes(user.id),
      yo: user,
    });
  }

  const admin = createAdminSupabase();
  const [pubs, sols] = await Promise.all([
    admin
      .from("publicaciones")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(200),
    admin
      .from("solicitudes")
      .select("*")
      .eq("comprador_id", user.id),
  ]);

  if (pubs.error) {
    return NextResponse.json({ error: pubs.error.message }, { status: 500 });
  }
  return NextResponse.json({
    publicaciones: pubs.data,
    mis_solicitudes: sols.data ?? [],
    yo: user,
  });
}

export async function POST(request: Request) {
  const user = await currentUser();
  if (!user) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  let body: any;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }

  const evento = String(body.evento ?? "").trim().slice(0, 200);
  const descripcion = body.descripcion
    ? String(body.descripcion).trim().slice(0, 1000)
    : null;
  const fecha_evento = body.fecha_evento ? String(body.fecha_evento) : null;
  const precio = Math.trunc(Number(body.precio));
  const cantidad = Math.trunc(Number(body.cantidad ?? 1));

  if (!evento) {
    return NextResponse.json({ error: "El evento es obligatorio" }, { status: 400 });
  }
  if (fecha_evento && !/^\d{4}-\d{2}-\d{2}$/.test(fecha_evento)) {
    return NextResponse.json({ error: "Fecha inválida" }, { status: 400 });
  }
  if (!Number.isFinite(precio) || precio <= 0) {
    return NextResponse.json({ error: "Precio inválido" }, { status: 400 });
  }
  if (!Number.isFinite(cantidad) || cantidad < 1 || cantidad > 10) {
    return NextResponse.json({ error: "Cantidad inválida (1 a 10)" }, { status: 400 });
  }

  if (isMock()) {
    const pub = mockCreatePublicacion({
      user_id: user.id,
      vendedor_alias: user.alias,
      evento,
      descripcion,
      fecha_evento,
      precio,
      cantidad,
    });
    return NextResponse.json(pub, { status: 201 });
  }

  const admin = createAdminSupabase();
  const { data, error } = await admin
    .from("publicaciones")
    .insert({
      user_id: user.id,
      vendedor_alias: user.alias,
      evento,
      descripcion,
      fecha_evento,
      precio,
      cantidad,
    })
    .select("*")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json(data, { status: 201 });
}
