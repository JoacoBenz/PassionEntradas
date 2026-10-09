import { NextResponse } from "next/server";
import { createServerSupabase, createAdminSupabase } from "@/lib/supabase/server";
import { esStaff, getRol, puedeVerTienda } from "@/lib/auth";
import type { AvisoGuardado } from "@/lib/avisos";
import { estadoWhatsappAviso } from "@/lib/recordatorios";
import { isMock, MOCK_USER, mockActualizarAviso, mockListAvisos } from "@/lib/mock-db";

// La campana. GET: los últimos avisos de quien pregunta y cuántos no leyó.
// POST: los marca leídos (todos, o los `ids` que mande).
//
// ?audiencia=cliente (la tienda): los avisos de sus pedidos, por su usuario o
// por su email (operaciones cargadas a mano sin vincular la cuenta).
// ?audiencia=equipo (el panel): los avisos de esa persona del equipo.
export const dynamic = "force-dynamic";

const LIMITE = 30;
// Id del cliente demo (el de los pedidos de ejemplo en mock-db).
const MOCK_CLIENTE = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";

type Quien = { id: string; email: string | null; audiencia: "cliente" | "equipo" };

async function quien(request: Request): Promise<Quien | { error: string; status: number }> {
  const audiencia = new URL(request.url).searchParams.get("audiencia") === "equipo" ? "equipo" : "cliente";
  if (isMock()) {
    return audiencia === "equipo"
      ? { id: MOCK_USER.id, email: MOCK_USER.email, audiencia }
      : { id: MOCK_CLIENTE, email: MOCK_USER.email, audiencia };
  }
  const supabase = createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "No autorizado", status: 401 };
  const rol = getRol(user);
  if (audiencia === "equipo" ? !esStaff(rol) : !puedeVerTienda(rol)) {
    return { error: "No autorizado", status: 403 };
  }
  return { id: user.id, email: user.email?.toLowerCase() ?? null, audiencia };
}

const esDe = (q: Quien) => (a: AvisoGuardado) =>
  a.audiencia === q.audiencia &&
  (a.destinatario_id === q.id ||
    (q.audiencia === "cliente" && !a.destinatario_id && !!q.email && a.destinatario_email?.toLowerCase() === q.email));

const COLUMNAS = "id, tipo, datos, url, leida_at, created_at";
// El equipo ve además cómo salió el WhatsApp de cada aviso.
const COLUMNAS_EQUIPO = "id, tipo, datos, url, leida_at, created_at, whatsapp_estado, whatsapp_error, whatsapp_destino";

type Fila = Pick<
  AvisoGuardado,
  "id" | "tipo" | "datos" | "url" | "leida_at" | "created_at" | "whatsapp_estado" | "whatsapp_error" | "whatsapp_destino"
>;

export async function GET(request: Request) {
  const q = await quien(request);
  if ("error" in q) return NextResponse.json({ error: q.error }, { status: q.status });

  let filas: Fila[];
  if (isMock()) {
    filas = mockListAvisos(esDe(q), LIMITE);
  } else {
    const admin = createAdminSupabase();
    const columnas: string = q.audiencia === "equipo" ? COLUMNAS_EQUIPO : COLUMNAS;
    const consultas = [
      admin
        .from("notificaciones")
        .select(columnas)
        .eq("audiencia", q.audiencia)
        .eq("destinatario_id", q.id)
        .order("created_at", { ascending: false })
        .limit(LIMITE),
    ];
    if (q.audiencia === "cliente" && q.email) {
      consultas.push(
        admin
          .from("notificaciones")
          .select(columnas)
          .eq("audiencia", "cliente")
          .is("destinatario_id", null)
          .ilike("destinatario_email", q.email.replace(/[%_\\]/g, "\\$&"))
          .order("created_at", { ascending: false })
          .limit(LIMITE)
      );
    }
    const res = await Promise.all(consultas);
    // Sin la tabla (migración sin aplicar) la campana queda vacía, sin error.
    filas = res
      .flatMap((r) => (r.data ?? []) as unknown as Fila[])
      .sort((a, b) => b.created_at.localeCompare(a.created_at))
      .slice(0, LIMITE);
  }

  return NextResponse.json({
    noLeidas: filas.filter((f) => !f.leida_at).length,
    avisos: filas.map((f) => ({
      id: f.id,
      tipo: f.tipo,
      datos: f.datos,
      url: f.url,
      leida: !!f.leida_at,
      created_at: f.created_at,
      ...(q.audiencia === "equipo"
        ? { whatsapp: estadoWhatsappAviso(f) }
        : {}),
    })),
  });
}

export async function POST(request: Request) {
  const q = await quien(request);
  if ("error" in q) return NextResponse.json({ error: q.error }, { status: q.status });
  let body: any = {};
  try {
    body = await request.json();
  } catch {
    /* sin body = todos */
  }
  const ids: string[] | null = Array.isArray(body?.ids) ? body.ids.filter((x: unknown) => typeof x === "string").slice(0, 100) : null;
  const ahora = new Date().toISOString();

  if (isMock()) {
    for (const a of mockListAvisos(esDe(q), 1000)) {
      if (!a.leida_at && (!ids || ids.includes(a.id))) mockActualizarAviso(a.id, { leida_at: ahora });
    }
    return NextResponse.json({ ok: true });
  }

  const admin = createAdminSupabase();
  // Solo filas propias: el filtro por destinatario va siempre.
  let porId = admin
    .from("notificaciones")
    .update({ leida_at: ahora })
    .eq("audiencia", q.audiencia)
    .eq("destinatario_id", q.id)
    .is("leida_at", null);
  if (ids) porId = porId.in("id", ids);
  const tareas: PromiseLike<unknown>[] = [porId];
  if (q.audiencia === "cliente" && q.email) {
    let porEmail = admin
      .from("notificaciones")
      .update({ leida_at: ahora })
      .eq("audiencia", "cliente")
      .is("destinatario_id", null)
      .ilike("destinatario_email", q.email.replace(/[%_\\]/g, "\\$&"))
      .is("leida_at", null);
    if (ids) porEmail = porEmail.in("id", ids);
    tareas.push(porEmail);
  }
  await Promise.all(tareas);
  return NextResponse.json({ ok: true });
}
