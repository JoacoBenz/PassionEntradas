import { NextResponse } from "next/server";
import { createAdminSupabase } from "@/lib/supabase/server";
import { validarSolicitud } from "@/lib/acceso";
import { isMock, mockCrearSolicitud } from "@/lib/mock-db";

// POST /api/acceso/solicitar — PÚBLICO. Un visitante de la landing pide
// acceso a la tienda. Se inserta con service role (la tabla es RLS deny-all).
// Anti-spam: honeypot + validación. Una sola solicitud PENDIENTE por email
// (unique index); un duplicado se trata como éxito idempotente (no se filtra
// si el email ya pidió, ni se le da error al usuario legítimo que reintenta).
export async function POST(request: Request) {
  let body: any;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }

  // Honeypot: campo oculto que sólo un bot completa. Fingimos éxito para no
  // darle señal de que fue detectado.
  if (typeof body?.empresa === "string" && body.empresa.trim() !== "") {
    return NextResponse.json({ ok: true });
  }

  const parsed = validarSolicitud(body ?? {});
  if (!parsed.ok) {
    return NextResponse.json({ error: parsed.error }, { status: 400 });
  }
  const { nombre, email, telefono, mensaje } = parsed.value;

  if (isMock()) {
    const r = mockCrearSolicitud(parsed.value);
    if (!r.ok) return NextResponse.json({ error: r.error }, { status: 400 });
    return NextResponse.json({ ok: true }, { status: 201 });
  }

  const admin = createAdminSupabase();
  const { error } = await admin
    .from("solicitudes_acceso")
    .insert({ nombre, email, telefono, mensaje });

  if (error) {
    // 23505 = unique_violation: ya hay una solicitud PENDIENTE con ese email.
    // No es un error para el usuario: ya está en la cola.
    if ((error as any).code === "23505") {
      return NextResponse.json({ ok: true });
    }
    return NextResponse.json(
      { error: "No se pudo registrar la solicitud" },
      { status: 500 }
    );
  }

  return NextResponse.json({ ok: true }, { status: 201 });
}
