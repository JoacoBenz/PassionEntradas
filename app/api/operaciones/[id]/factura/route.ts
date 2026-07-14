import { NextResponse } from "next/server";
import { createServerSupabase, createAdminSupabase } from "@/lib/supabase/server";
import { getRol, nombreDe } from "@/lib/auth";
import type { FacturaDatos, FacturaIdioma } from "@/lib/factura";
import {
  isMock,
  MOCK_USER,
  mockFacturaDeOperacion,
  mockGuardarFactura,
  mockListOps,
  mockListManual,
} from "@/lib/mock-db";
import { MOCK_TICKETS } from "@/lib/mock-tickets";

// Factura/recibo de una operación cobrada.
// GET  -> la factura existente de la operación (404 si no se emitió).
// POST -> emite (o re-emite) la factura: snapshot inmutable con numero
//         correlativo. Re-emitir actualiza los datos pero conserva numero,
//         id (o sea el link) y fecha de emisión original.
// Solo administrador; escrituras con service role.

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function requireAdmin(): Promise<
  { denied: NextResponse } | { denied: null; quien: string | null }
> {
  if (isMock()) return { denied: null, quien: MOCK_USER.email };
  const supabase = createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user || getRol(user) !== "administrador") {
    return {
      denied: NextResponse.json({ error: "No autorizado" }, { status: 401 }),
    };
  }
  return { denied: null, quien: nombreDe(user) };
}

export async function GET(
  _request: Request,
  { params }: { params: { id: string } }
) {
  const auth = await requireAdmin();
  if (auth.denied) return auth.denied;
  if (!UUID_RE.test(params.id)) {
    return NextResponse.json({ error: "Operación inválida" }, { status: 400 });
  }

  if (isMock()) {
    const f = mockFacturaDeOperacion(params.id);
    if (!f) return NextResponse.json({ error: "Sin factura" }, { status: 404 });
    return NextResponse.json(f);
  }

  const { data, error } = await createAdminSupabase()
    .from("facturas")
    .select("id, numero, datos, created_at")
    .eq("operacion_id", params.id)
    .maybeSingle();
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  if (!data) return NextResponse.json({ error: "Sin factura" }, { status: 404 });
  return NextResponse.json(data);
}

export async function POST(
  request: Request,
  { params }: { params: { id: string } }
) {
  const auth = await requireAdmin();
  if (auth.denied) return auth.denied;
  if (!UUID_RE.test(params.id)) {
    return NextResponse.json({ error: "Operación inválida" }, { status: 400 });
  }

  let body: any;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }

  const nombre = String(body.comprador_nombre ?? "").trim().slice(0, 120);
  const contacto = String(body.comprador_contacto ?? "").trim().slice(0, 160) || null;
  const cantidad = Math.trunc(Number(body.cantidad));
  const metodo = String(body.metodo_pago ?? "").trim().slice(0, 80);
  const idioma: FacturaIdioma = body.idioma === "es" ? "es" : "en";

  if (!nombre) {
    return NextResponse.json(
      { error: "El nombre del comprador es obligatorio" },
      { status: 400 }
    );
  }
  if (!Number.isFinite(cantidad) || cantidad < 1 || cantidad > 100) {
    return NextResponse.json({ error: "Cantidad inválida" }, { status: 400 });
  }
  if (!metodo) {
    return NextResponse.json(
      { error: "El método de pago es obligatorio" },
      { status: 400 }
    );
  }

  // Operación + entrada vinculada (para sede/competición/sector).
  type OpFactura = {
    id: string;
    code: string;
    evento: string;
    monto: number;
    fee: number;
    status: string;
    pago_confirmado_at: string | null;
    fecha_evento: string | null;
    ticket_id: string | null;
  };
  let op: OpFactura | null = null;
  let ticket: { competicion: string | null; ciudad: string | null; categoria: string | null } | null =
    null;

  if (isMock()) {
    const m = mockListOps().find((o) => o.id === params.id);
    if (m) {
      op = m;
      const t =
        [...MOCK_TICKETS, ...mockListManual()].find((x) => x.id === m.ticket_id) ?? null;
      if (t) ticket = { competicion: t.competicion, ciudad: t.ciudad, categoria: t.categoria };
    }
  } else {
    const admin = createAdminSupabase();
    const { data, error } = await admin
      .from("operaciones")
      .select("id, code, evento, monto, fee, status, pago_confirmado_at, fecha_evento, ticket_id")
      .eq("id", params.id)
      .maybeSingle();
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    op = (data ?? null) as OpFactura | null;
    if (op?.ticket_id) {
      const { data: t } = await admin
        .from("tickets")
        .select("competicion, ciudad, categoria")
        .eq("id", op.ticket_id)
        .maybeSingle();
      ticket = t ?? null;
    }
  }

  if (!op) {
    return NextResponse.json({ error: "Operación no encontrada" }, { status: 404 });
  }
  if (op.status === "cancelada") {
    return NextResponse.json(
      { error: "La operación está cancelada: no se factura" },
      { status: 409 }
    );
  }
  // El invoice es un recibo: recién existe cuando el pago está confirmado.
  if (!op.pago_confirmado_at) {
    return NextResponse.json(
      { error: "El pago todavía no está confirmado: no hay nada que facturar" },
      { status: 409 }
    );
  }

  const datos: FacturaDatos = {
    idioma,
    comprador: { nombre, contacto },
    agente: auth.quien,
    operacion: { id: op.id, code: op.code },
    evento: {
      titulo: op.evento,
      competicion: ticket?.competicion ?? null,
      fecha: op.fecha_evento,
      sede: ticket?.ciudad ?? null,
      sector: ticket?.categoria ?? null,
    },
    cantidad,
    precio_unitario: Math.round((op.monto / cantidad) * 100) / 100,
    subtotal: op.monto,
    fee: op.fee,
    total: op.monto + op.fee,
    metodo_pago: metodo,
    pago_confirmado_at: op.pago_confirmado_at,
  };

  if (isMock()) {
    const f = mockGuardarFactura(params.id, datos);
    return NextResponse.json(f, { status: 201 });
  }

  // Upsert por operación: re-emitir actualiza el snapshot pero conserva el
  // numero correlativo y el id (el link ya compartido sigue valiendo).
  const admin = createAdminSupabase();
  const { data, error } = await admin
    .from("facturas")
    .upsert({ operacion_id: params.id, datos }, { onConflict: "operacion_id" })
    .select("id, numero, datos, created_at")
    .single();
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json(data, { status: 201 });
}
