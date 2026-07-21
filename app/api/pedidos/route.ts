import { NextResponse } from "next/server";
import { createServerSupabase, createAdminSupabase } from "@/lib/supabase/server";
import { getRol, puedeVerTienda, nombreDe } from "@/lib/auth";
import { formatUSD, generateCode, type TipoOperacion } from "@/lib/operaciones";
import { notificarVendedores } from "@/lib/whatsapp";
import { notificarVendedoresEmail } from "@/lib/email";
import { isMock, mockCreateOp, MOCK_USER } from "@/lib/mock-db";

// POST /api/pedidos — el cliente hace un PEDIDO o una CONSULTA sobre una
// entrada del catálogo. Se hacen DOS cosas por cada acción:
//   1) se registra en la app como una operación (tipo pedido/consulta,
//      linkeada al cliente y a la entrada) para trackearla desde el panel;
//   2) se avisa a los vendedores por WhatsApp para que la accionen.
// El aviso por WhatsApp es best-effort: si no está configurado o falla, el
// registro igual queda hecho (nunca se pierde un pedido por eso).

type Ctx = { cliente_id: string | null; cliente_email: string | null; comprador: string };

async function contexto(): Promise<Ctx | { error: string; status: number }> {
  if (isMock()) {
    return {
      cliente_id: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
      cliente_email: MOCK_USER.email,
      comprador: "Demo Cliente",
    };
  }
  const supabase = createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "No autorizado", status: 401 };
  if (!puedeVerTienda(getRol(user))) {
    return { error: "Tu cuenta no tiene acceso a la tienda", status: 403 };
  }
  return {
    cliente_id: user.id,
    cliente_email: user.email ?? null,
    comprador: nombreDe(user) ?? user.email ?? "Cliente",
  };
}

export async function POST(request: Request) {
  const ctx = await contexto();
  if ("error" in ctx) {
    return NextResponse.json({ error: ctx.error }, { status: ctx.status });
  }

  let body: any;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }

  // El carrito manda { items: [...] }; se acepta también un item suelto
  // (compat: { tipo, evento, ... }) envolviéndolo en un array.
  const raw = Array.isArray(body.items) ? body.items : [body];
  if (raw.length === 0) {
    return NextResponse.json({ error: "El pedido está vacío" }, { status: 400 });
  }
  if (raw.length > 50) {
    return NextResponse.json({ error: "Demasiadas entradas en un pedido" }, { status: 400 });
  }

  // Validación + normalización de cada entrada.
  type Parsed = {
    tipo: TipoOperacion;
    evento: string;
    sector: string | null;
    ticket_id: string | null;
    monto: number; // total de la línea (unitario × cantidad)
    cantidad: number;
    fecha_evento: string | null;
  };
  const parsed: Parsed[] = [];
  for (const it of raw) {
    const tipo = String(it?.tipo ?? "") as TipoOperacion;
    if (tipo !== "pedido" && tipo !== "consulta") {
      return NextResponse.json({ error: "Tipo inválido (pedido o consulta)" }, { status: 400 });
    }
    const evento = String(it?.evento ?? "").trim();
    if (!evento) {
      return NextResponse.json({ error: "Falta el evento en una entrada" }, { status: 400 });
    }
    const sector = it?.sector ? String(it.sector).trim().slice(0, 200) : null;
    const ticket_id = it?.ticket_id ? String(it.ticket_id).slice(0, 200) : null;
    // Cantidad: solo un pedido puede pedir más de una; la consulta es siempre
    // por una. El tope real por stock lo aplica la tienda; acá se acota a un
    // rango sano (1..99) para no guardar valores absurdos.
    const cantRaw = Math.trunc(Number(it?.cantidad));
    const cantidad =
      tipo === "pedido" && Number.isFinite(cantRaw) && cantRaw > 0
        ? Math.min(cantRaw, 99)
        : 1;
    // Precio unitario: redondeo (no truncado) para que coincida con el precio
    // mostrado en la tienda (fmtPrice usa Math.round). `monto` guardado = total
    // de la línea = unitario × cantidad; la factura deriva el unitario de vuelta.
    const unitRaw = Math.round(Number(it?.monto));
    const unit = Number.isFinite(unitRaw) && unitRaw > 0 ? unitRaw : 0;
    const monto = unit * cantidad;
    const fechaRaw = it?.fecha_evento ? String(it.fecha_evento).slice(0, 10) : null;
    const fecha_evento = fechaRaw && /^\d{4}-\d{2}-\d{2}$/.test(fechaRaw) ? fechaRaw : null;
    parsed.push({ tipo, evento, sector, ticket_id, monto, cantidad, fecha_evento });
  }

  const notasDe = (p: Parsed) =>
    `${p.tipo === "pedido" ? "Pedido" : "Consulta"} desde la tienda por ${ctx.comprador}` +
    (p.sector ? ` — ${p.sector}` : "") +
    (ctx.cliente_email ? ` (${ctx.cliente_email})` : "");

  // 1) Registro en la app: una operación por entrada.
  type Creada = { id: string; code: string; evento: string; sector: string | null; tipo: string; monto: number; cantidad: number };
  let creadas: Creada[] = [];

  if (isMock()) {
    creadas = parsed.map((p) => {
      const op = mockCreateOp({
        evento: p.evento,
        comprador_alias: ctx.comprador,
        vendedor_alias: null,
        monto: p.monto,
        cantidad: p.cantidad,
        fee: 0,
        ticket_id: p.ticket_id,
        fecha_evento: p.fecha_evento,
        notas: notasDe(p),
        cuenta_debitar: null,
        tipo: p.tipo,
        cliente_id: ctx.cliente_id,
        cliente_email: ctx.cliente_email,
        sector: p.sector,
      });
      return { id: op.id, code: op.code, evento: op.evento, sector: op.sector, tipo: op.tipo, monto: op.monto, cantidad: op.cantidad };
    });
  } else {
    const admin = createAdminSupabase();
    // Inserción en lote; si algún code colisiona (23505) se reintenta el lote
    // entero con codes nuevos (muy improbable).
    for (let attempt = 0; attempt < 5; attempt++) {
      const rows = parsed.map((p) => ({
        code: generateCode(),
        evento: p.evento,
        comprador_alias: ctx.comprador,
        monto: p.monto,
        cantidad: p.cantidad,
        fee: 0,
        ticket_id: p.ticket_id,
        fecha_evento: p.fecha_evento,
        notas: notasDe(p),
        tipo: p.tipo,
        cliente_id: ctx.cliente_id,
        cliente_email: ctx.cliente_email,
        sector: p.sector,
      }));
      const { data, error } = await admin
        .from("operaciones")
        .insert(rows)
        .select("id, code, evento, sector, tipo, monto, cantidad");
      if (!error && data) {
        creadas = data as Creada[];
        break;
      }
      if (error && (error as any).code !== "23505") {
        return NextResponse.json({ error: error.message }, { status: 500 });
      }
    }
    if (creadas.length === 0) {
      return NextResponse.json(
        { error: "No se pudo registrar el pedido, reintentá" },
        { status: 500 }
      );
    }
  }

  // 2) Un solo aviso a los vendedores (WhatsApp + email) con todas las
  // entradas del pedido. Best-effort: si falla o no está configurado, las
  // operaciones ya quedaron registradas arriba.
  const n = creadas.length;
  const lineas = creadas
    .map((c, i) => {
      const cant = c.cantidad > 1 ? ` ×${c.cantidad}` : "";
      const monto = c.monto > 0 ? ` — ${formatUSD(c.monto)}` : "";
      const tag = c.tipo === "pedido" ? "PEDIDO" : "CONSULTA";
      return `${i + 1}) ${c.evento}${c.sector ? ` — ${c.sector}` : ""}${cant}${monto} [${tag}] · ${c.code}`;
    })
    .join("\n");
  const mensaje =
    `🎟️ Nuevo pedido en la tienda (${n} ${n === 1 ? "entrada" : "entradas"})\n` +
    `Cliente: ${ctx.comprador}${ctx.cliente_email ? ` (${ctx.cliente_email})` : ""}\n\n` +
    lineas +
    `\n\nAccioná las operaciones desde el panel.`;
  const asunto = `🎟️ Nuevo pedido (${n}) — ${ctx.comprador}`;

  const [wa, mail] = await Promise.all([
    notificarVendedores(mensaje),
    notificarVendedoresEmail(asunto, mensaje),
  ]);

  return NextResponse.json(
    {
      ok: true,
      count: n,
      items: creadas.map((c) => ({ id: c.id, code: c.code })),
      whatsapp: wa.ok
        ? { ok: true, enviados: wa.enviados }
        : { ok: false, noConfigurado: wa.noConfigurado ?? false },
      email: mail.ok
        ? { ok: true }
        : { ok: false, noConfigurado: mail.noConfigurado ?? false },
    },
    { status: 201 }
  );
}
