import { NextResponse } from "next/server";
import { createServerSupabase, createAdminSupabase } from "@/lib/supabase/server";
import { esStaff, getRol, nombreDe } from "@/lib/auth";
import { generateCode, type Moneda } from "@/lib/operaciones";
import { parsePrecio } from "@/lib/precios";
import { isMock, MOCK_USER, mockConvertirConsulta } from "@/lib/mock-db";

// POST /api/consultas/[id]/convertir — SOLO staff. Le pone precio a una
// consulta y la convierte en una operación real.
//
// Una consulta es un pedido sin precio cerrado: por eso NO es una operación
// (una operación con monto 0 no significa nada y ensucia las métricas). Acá
// se cierra el precio y recién entonces nace la operación.
//
// La consulta no se borra: queda en estado 'convertida' apuntando a la
// operación, para no perder el rastro de que el pedido original existió.
export async function POST(request: Request, { params }: { params: { id: string } }) {
  let quien = MOCK_USER.email;

  if (!isMock()) {
    const supabase = createServerSupabase();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user || !esStaff(getRol(user))) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }
    quien = nombreDe(user) ?? user.email ?? "staff";
  }

  let body: any;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }

  // El precio es el motivo de existir de esta ruta: sin precio no hay
  // operación que crear.
  //
  // Se cotiza con COSTO + COMISIÓN: al cliente se le cobra la suma (es el
  // `monto` de la operación, lo único que ve en la factura) y la comisión
  // queda aparte como `fee` para las métricas. Se acepta también el formato
  // viejo { monto, fee } por si quedó una pestaña abierta con el panel anterior.
  let monto: number;
  let fee: number;
  if (body?.costo != null || body?.comision != null) {
    const precio = parsePrecio(body.costo, body.comision);
    if (!precio.ok) {
      return NextResponse.json({ error: precio.error }, { status: 400 });
    }
    monto = precio.total;
    fee = precio.comision;
  } else {
    monto = Math.round(Number(body?.monto));
    if (!Number.isFinite(monto) || monto <= 0) {
      return NextResponse.json(
        { error: "Ingresá el precio acordado para cargar la operación" },
        { status: 400 }
      );
    }
    fee = Math.max(0, Math.round(Number(body?.fee)) || 0);
  }

  const monedaRaw = String(body?.moneda ?? "USD").toUpperCase();
  const moneda: Moneda = (["ARS", "USD", "EUR"] as const).includes(monedaRaw as any)
    ? (monedaRaw as Moneda)
    : "USD";

  if (isMock()) {
    const r = mockConvertirConsulta(params.id, { monto, fee, moneda, quien });
    if (!r.ok) return NextResponse.json({ error: r.error }, { status: r.status });
    return NextResponse.json({ ok: true, operacion: { id: r.op.id, code: r.op.code } });
  }

  const admin = createAdminSupabase();

  const { data: c } = await admin
    .from("consultas")
    .select("id, estado, evento, sector, ticket_id, fecha_evento, cantidad, comprador_alias, cliente_id, cliente_email, notas, envio_id")
    .eq("id", params.id)
    .maybeSingle();
  if (!c) return NextResponse.json({ error: "Consulta no encontrada" }, { status: 404 });
  if (c.estado !== "pendiente") {
    return NextResponse.json({ error: "Esta consulta ya fue resuelta" }, { status: 409 });
  }

  const cantidad = Math.max(1, Number(c.cantidad) || 1);

  // La operación nace con la misma línea que la consulta: el detalle vive en
  // `operacion_items` igual que en los pedidos del carrito.
  let creada: { id: string; code: string } | null = null;
  for (let intento = 0; intento < 5; intento++) {
    const { data, error } = await admin
      .from("operaciones")
      .insert({
        code: generateCode(),
        evento: c.evento,
        comprador_alias: c.comprador_alias,
        monto,
        fee,
        cantidad,
        ticket_id: c.ticket_id,
        sector: c.sector,
        fecha_evento: c.fecha_evento,
        notas: `${c.notas ?? ""}\nCargada desde consulta por ${quien}.`.trim(),
        tipo: "pedido",
        cliente_id: c.cliente_id,
        cliente_email: c.cliente_email,
        envio_id: c.envio_id,
        moneda,
      })
      .select("id, code")
      .single();
    if (!error && data) {
      creada = data as { id: string; code: string };
      break;
    }
    if (error && (error as any).code !== "23505") {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
  }
  if (!creada) {
    return NextResponse.json({ error: "No se pudo crear la operación, reintentá" }, { status: 500 });
  }

  const { error: errItem } = await admin.from("operacion_items").insert({
    operacion_id: creada.id,
    ticket_id: c.ticket_id,
    evento: c.evento,
    sector: c.sector,
    fecha_evento: c.fecha_evento,
    cantidad,
    precio_unitario: monto / cantidad,
  });
  if (errItem) {
    // Sin línea la operación queda sin detalle: se deshace antes de marcar
    // la consulta, así el admin puede reintentar sin duplicados.
    await admin.from("operaciones").delete().eq("id", creada.id);
    return NextResponse.json({ error: "No se pudo crear el detalle, reintentá" }, { status: 500 });
  }

  // Marcar la consulta al final: si algo falló antes, sigue pendiente y se
  // puede volver a intentar.
  const { error: errUpd } = await admin
    .from("consultas")
    .update({
      estado: "convertida",
      operacion_id: creada.id,
      resuelta_por: quien,
      resuelta_at: new Date().toISOString(),
    })
    .eq("id", params.id)
    .eq("estado", "pendiente");
  if (errUpd) {
    return NextResponse.json(
      { error: "La operación se creó pero la consulta quedó pendiente. Revisala antes de reintentar." },
      { status: 500 }
    );
  }

  return NextResponse.json({ ok: true, operacion: creada });
}
