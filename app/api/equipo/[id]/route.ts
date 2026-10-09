import { NextResponse } from "next/server";
import { createServerSupabase, createAdminSupabase } from "@/lib/supabase/server";
import { getRol, nombreDe } from "@/lib/auth";
import {
  leerUsuarios,
  listarMiembros,
  metadataDeCambio,
  parsearCambio,
  registroDeCambio,
  validarCambioEquipo,
} from "@/lib/equipo";
import { isMock, MOCK_USER, mockCambioEquipo } from "@/lib/mock-db";

// Bloqueo de Auth para un desactivado: además del flag en app_metadata (que
// getRol lee en cada request), no puede volver a iniciar sesión.
const BLOQUEO = "876000h"; // ~100 años

// PATCH /api/equipo/[id] — SOLO administrador. Cambia el rol de un miembro o
// lo desactiva/reactiva. Guardas (lib/equipo): nadie se baja ni se desactiva
// a sí mismo, y siempre queda un administrador activo.
export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  let actorId = MOCK_USER.id;
  let por = MOCK_USER.email;
  if (!isMock()) {
    const supabase = createServerSupabase();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    if (getRol(user) !== "administrador") {
      return NextResponse.json({ error: "Solo un administrador gestiona el equipo" }, { status: 403 });
    }
    actorId = user.id;
    por = nombreDe(user) ?? user.email ?? "admin";
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }
  const cambio = parsearCambio(body);
  if (!cambio) return NextResponse.json({ error: "Cambio inválido" }, { status: 400 });

  if (isMock()) {
    const r = mockCambioEquipo(params.id, cambio, actorId, por);
    if (!r.ok) return NextResponse.json({ error: r.error }, { status: r.status });
    return NextResponse.json({ ok: true });
  }

  const admin = createAdminSupabase();
  // El equipo entero: la guarda del "último administrador" necesita verlo.
  let equipo;
  try {
    equipo = listarMiembros(await leerUsuarios(admin));
  } catch (e) {
    return NextResponse.json({ error: `No se pudo leer el equipo: ${(e as Error).message}` }, { status: 503 });
  }
  const objetivo = equipo.find((m) => m.id === params.id);
  if (!objetivo) return NextResponse.json({ error: "No es parte del equipo." }, { status: 404 });
  const error = validarCambioEquipo(actorId, objetivo, cambio, equipo);
  if (error) return NextResponse.json({ error }, { status: 409 });

  const { error: authErr } = await admin.auth.admin.updateUserById(objetivo.id, {
    app_metadata: metadataDeCambio(cambio),
    ...(cambio.accion === "desactivar" ? { ban_duration: BLOQUEO } : {}),
    ...(cambio.accion === "reactivar" ? { ban_duration: "none" } : {}),
  });
  if (authErr) {
    return NextResponse.json({ error: `No se pudo aplicar el cambio: ${authErr.message}` }, { status: 500 });
  }

  const { error: logErr } = await admin.from("equipo_cambios").insert(registroDeCambio(objetivo, cambio, por));
  return NextResponse.json({
    ok: true,
    aviso: logErr ? "El cambio se hizo pero no quedó en el registro." : undefined,
  });
}
