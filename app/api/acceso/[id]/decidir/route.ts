import { NextResponse } from "next/server";
import { createServerSupabase, createAdminSupabase } from "@/lib/supabase/server";
import { getRol, nombreDe } from "@/lib/auth";
import { generarPassword, mensajeCredenciales } from "@/lib/acceso";
import { emailConfigurado } from "@/lib/email";
import { isMock, MOCK_USER, mockDecidirSolicitud } from "@/lib/mock-db";

// Aleatoriedad de calidad para la contraseña (no Math.random).
function randomCrypto(): number {
  return crypto.getRandomValues(new Uint32Array(1))[0]! / 2 ** 32;
}

function urlIngreso(request: Request): string {
  const base = process.env.NEXT_PUBLIC_SITE_URL
    ? process.env.NEXT_PUBLIC_SITE_URL.replace(/\/$/, "")
    : new URL(request.url).origin;
  return `${base}/ingresar`;
}

// POST /api/acceso/[id]/decidir — SOLO administrador. Aprueba o rechaza una
// solicitud de acceso. Al aprobar crea el usuario cliente (Supabase Auth,
// rol 'cliente' en app_metadata) y devuelve las credenciales UNA sola vez
// para que el admin las mande (mensaje para copiar y/o email).
export async function POST(
  request: Request,
  { params }: { params: { id: string } }
) {
  const id = params.id;

  let decididaPor = MOCK_USER.email;
  if (!isMock()) {
    const supabase = createServerSupabase();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }
    if (getRol(user) !== "administrador") {
      return NextResponse.json(
        { error: "Solo un administrador puede resolver solicitudes" },
        { status: 403 }
      );
    }
    decididaPor = nombreDe(user) ?? user.email ?? "admin";
  }

  let body: any;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }
  const accion = body?.accion;
  if (accion !== "aprobar" && accion !== "rechazar") {
    return NextResponse.json({ error: "Acción inválida" }, { status: 400 });
  }

  // --- Mock -----------------------------------------------------------------
  if (isMock()) {
    const r = mockDecidirSolicitud(id, accion, decididaPor);
    if (!r.ok) return NextResponse.json({ error: r.error }, { status: r.status });
    if (accion === "rechazar" || !r.credenciales) {
      return NextResponse.json({ estado: "rechazada" });
    }
    const mensaje = mensajeCredenciales({
      nombre: r.solicitud.nombre,
      email: r.credenciales.email,
      password: r.credenciales.password,
      urlIngreso: urlIngreso(request),
    });
    return NextResponse.json({
      estado: "aprobada",
      credenciales: r.credenciales,
      mensaje,
      emailConfigurado: emailConfigurado(),
    });
  }

  // --- Real -----------------------------------------------------------------
  const admin = createAdminSupabase();

  const { data: sol, error: solErr } = await admin
    .from("solicitudes_acceso")
    .select("id, nombre, email, estado")
    .eq("id", id)
    .single();
  if (solErr || !sol) {
    return NextResponse.json({ error: "Solicitud no encontrada" }, { status: 404 });
  }
  if (sol.estado !== "pendiente") {
    return NextResponse.json({ error: "La solicitud ya fue resuelta" }, { status: 409 });
  }

  const decididaAt = new Date().toISOString();

  if (accion === "rechazar") {
    const { error } = await admin
      .from("solicitudes_acceso")
      .update({ estado: "rechazada", decidida_por: decididaPor, decidida_at: decididaAt })
      .eq("id", id)
      .eq("estado", "pendiente");
    if (error) {
      return NextResponse.json({ error: "No se pudo rechazar la solicitud" }, { status: 500 });
    }
    return NextResponse.json({ estado: "rechazada" });
  }

  // Aprobar: crear el usuario cliente.
  const password = generarPassword(randomCrypto);
  const { data: created, error: createErr } = await admin.auth.admin.createUser({
    email: sol.email,
    password,
    email_confirm: true,
    app_metadata: { role: "cliente" },
  });
  if (createErr || !created?.user) {
    // Email ya registrado u otro fallo de Auth: no marcamos aprobada.
    const msg = /already been registered|already exists/i.test(createErr?.message ?? "")
      ? "Ya existe un usuario con ese email"
      : `No se pudo crear el usuario: ${createErr?.message ?? "error desconocido"}`;
    return NextResponse.json({ error: msg }, { status: 409 });
  }

  const { error: updErr } = await admin
    .from("solicitudes_acceso")
    .update({
      estado: "aprobada",
      user_id: created.user.id,
      decidida_por: decididaPor,
      decidida_at: decididaAt,
    })
    .eq("id", id)
    .eq("estado", "pendiente");
  if (updErr) {
    // El usuario quedó creado; avisamos para no perder el rastro.
    return NextResponse.json(
      {
        error:
          "El usuario se creó pero no se pudo actualizar la solicitud. Revisá la cola antes de reintentar.",
      },
      { status: 500 }
    );
  }

  const mensaje = mensajeCredenciales({
    nombre: sol.nombre,
    email: sol.email,
    password,
    urlIngreso: urlIngreso(request),
  });

  return NextResponse.json({
    estado: "aprobada",
    credenciales: { email: sol.email, password },
    mensaje,
    emailConfigurado: emailConfigurado(),
  });
}
