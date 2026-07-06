import { NextResponse } from "next/server";
import { createServerSupabase, createAdminSupabase } from "@/lib/supabase/server";
import { getRol } from "@/lib/auth";
import { isMock, mockUpdateOp } from "@/lib/mock-db";

// PATCH /api/operaciones/[id] — edita datos internos de la operación
// (notas del panel y fecha del evento). Solo admin; service role.
export async function PATCH(
  request: Request,
  { params }: { params: { id: string } }
) {
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
        { error: "Solo el administrador puede editar la operación" },
        { status: 403 }
      );
    }
  }

  let body: any;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }

  const patch: Record<string, string | null> = {};

  if ("notas" in body) {
    const notas = body.notas == null ? null : String(body.notas).trim().slice(0, 2000);
    patch.notas = notas || null;
  }
  if ("fecha_evento" in body) {
    const fecha = body.fecha_evento ? String(body.fecha_evento) : null;
    if (fecha && !/^\d{4}-\d{2}-\d{2}$/.test(fecha)) {
      return NextResponse.json({ error: "Fecha inválida" }, { status: 400 });
    }
    patch.fecha_evento = fecha;
  }

  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ error: "Nada para actualizar" }, { status: 400 });
  }

  if (isMock()) {
    const res = mockUpdateOp(params.id, patch);
    if (!res.ok) {
      return NextResponse.json({ error: res.error }, { status: res.status });
    }
    return NextResponse.json({
      id: res.op.id,
      notas: res.op.notas,
      fecha_evento: res.op.fecha_evento,
    });
  }

  const admin = createAdminSupabase();
  const { data, error } = await admin
    .from("operaciones")
    .update(patch)
    .eq("id", params.id)
    .select("id, notas, fecha_evento")
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  if (!data) {
    return NextResponse.json(
      { error: "Operación no encontrada" },
      { status: 404 }
    );
  }

  return NextResponse.json(data);
}
