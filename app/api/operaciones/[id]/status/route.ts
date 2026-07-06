import { NextResponse } from "next/server";
import { createServerSupabase, createAdminSupabase } from "@/lib/supabase/server";
import { canTransition, type Status } from "@/lib/operaciones";
import { getRol } from "@/lib/auth";
import { isMock, mockSetOpStatus } from "@/lib/mock-db";

const VALID: Status[] = [
  "esperando_entrada",
  "entrada_recibida",
  "confirmada",
  "cancelada",
];

// PATCH /api/operaciones/[id]/status — cambia el estado respetando la
// máquina de estados. Requiere admin logueado; escribe con service role.
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

    // Los moderadores solo cargan operaciones; el estado lo maneja el admin.
    if (getRol(user) !== "administrador") {
      return NextResponse.json(
        { error: "Solo el administrador puede cambiar estados" },
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

  const to = body.status as Status;
  if (!VALID.includes(to)) {
    return NextResponse.json({ error: "Estado inválido" }, { status: 400 });
  }

  if (isMock()) {
    const res = mockSetOpStatus(params.id, to);
    if (!res.ok) {
      return NextResponse.json({ error: res.error }, { status: res.status });
    }
    return NextResponse.json({ id: res.op.id, status: res.op.status });
  }

  const admin = createAdminSupabase();

  // Leemos el estado actual para validar la transición en el servidor.
  const { data: current, error: readErr } = await admin
    .from("operaciones")
    .select("status")
    .eq("id", params.id)
    .maybeSingle();

  if (readErr) {
    return NextResponse.json({ error: readErr.message }, { status: 500 });
  }
  if (!current) {
    return NextResponse.json(
      { error: "Operación no encontrada" },
      { status: 404 }
    );
  }

  const from = current.status as Status;
  if (!canTransition(from, to)) {
    return NextResponse.json(
      { error: `Transición no permitida: ${from} → ${to}` },
      { status: 409 }
    );
  }

  const { data, error } = await admin
    .from("operaciones")
    .update({ status: to })
    .eq("id", params.id)
    .select("id, status")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ id: data.id, status: data.status });
}
