import { NextResponse } from "next/server";
import { createServerSupabase, createAdminSupabase } from "@/lib/supabase/server";
import { generateCode } from "@/lib/operaciones";
import { isMock, mockCreateOp } from "@/lib/mock-db";

// POST /api/operaciones — crea una operación.
// Requiere admin logueado. La escritura va con service role.
export async function POST(request: Request) {
  if (!isMock()) {
    const supabase = createServerSupabase();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }
  }

  let body: any;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }

  const evento = String(body.evento ?? "").trim();
  const comprador_alias = body.comprador_alias
    ? String(body.comprador_alias).trim()
    : null;
  const vendedor_alias = body.vendedor_alias
    ? String(body.vendedor_alias).trim()
    : null;
  const monto = Math.trunc(Number(body.monto));
  const fee = Math.trunc(Number(body.fee));
  const ticket_id = body.ticket_id ? String(body.ticket_id) : null;
  const fecha_evento = body.fecha_evento ? String(body.fecha_evento) : null;
  const notas = body.notas ? String(body.notas).trim().slice(0, 2000) : null;
  const cuenta_debitar = body.cuenta_debitar
    ? String(body.cuenta_debitar).trim().slice(0, 200)
    : null;

  if (fecha_evento && !/^\d{4}-\d{2}-\d{2}$/.test(fecha_evento)) {
    return NextResponse.json({ error: "Fecha inválida" }, { status: 400 });
  }
  // Datos mínimos de una operación de custodia: qué se opera, entre quiénes y
  // por cuánto. Se validan también acá (además del form) para que nunca entre
  // una operación con datos vacíos a la base.
  if (!evento) {
    return NextResponse.json(
      { error: "El evento es obligatorio" },
      { status: 400 }
    );
  }
  if (!comprador_alias) {
    return NextResponse.json(
      { error: "El alias del comprador es obligatorio" },
      { status: 400 }
    );
  }
  if (!vendedor_alias) {
    return NextResponse.json(
      { error: "El alias del vendedor es obligatorio" },
      { status: 400 }
    );
  }
  if (!Number.isFinite(monto) || monto <= 0) {
    return NextResponse.json(
      { error: "El monto debe ser mayor a 0" },
      { status: 400 }
    );
  }
  if (!Number.isFinite(fee) || fee < 0) {
    return NextResponse.json({ error: "Comisión inválida" }, { status: 400 });
  }

  if (isMock()) {
    const op = mockCreateOp({ evento, comprador_alias, vendedor_alias, monto, fee, ticket_id, fecha_evento, notas, cuenta_debitar });
    return NextResponse.json({ id: op.id, code: op.code }, { status: 201 });
  }

  const admin = createAdminSupabase();

  // Reintentos por si el code colisiona (muy improbable).
  for (let attempt = 0; attempt < 5; attempt++) {
    const code = generateCode();
    const { data, error } = await admin
      .from("operaciones")
      .insert({
        code,
        evento,
        comprador_alias,
        vendedor_alias,
        monto,
        fee,
        ticket_id,
        fecha_evento,
        notas,
        cuenta_debitar,
      })
      .select("id, code")
      .single();

    if (!error && data) {
      return NextResponse.json({ id: data.id, code: data.code }, { status: 201 });
    }

    // 23505 = unique_violation (colisión de code). Reintentar.
    if (error && (error as any).code !== "23505") {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
  }

  return NextResponse.json(
    { error: "No se pudo generar un code único, reintentá" },
    { status: 500 }
  );
}
