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

  const tipo = String(body.tipo ?? "") as TipoOperacion;
  if (tipo !== "pedido" && tipo !== "consulta") {
    return NextResponse.json({ error: "Tipo inválido (pedido o consulta)" }, { status: 400 });
  }
  const evento = String(body.evento ?? "").trim();
  if (!evento) {
    return NextResponse.json({ error: "Falta el evento" }, { status: 400 });
  }
  const sector = body.sector ? String(body.sector).trim().slice(0, 200) : null;
  const ticket_id = body.ticket_id ? String(body.ticket_id).slice(0, 200) : null;
  // En una consulta el precio puede no estar; el pedido suele traerlo. Se
  // guarda si es válido, si no queda en 0 (el monto final lo cierra el staff).
  const montoRaw = Math.trunc(Number(body.monto));
  const monto = Number.isFinite(montoRaw) && montoRaw > 0 ? montoRaw : 0;
  const fechaRaw = body.fecha_evento ? String(body.fecha_evento).slice(0, 10) : null;
  const fecha_evento = fechaRaw && /^\d{4}-\d{2}-\d{2}$/.test(fechaRaw) ? fechaRaw : null;

  const esPedido = tipo === "pedido";
  const notas =
    `${esPedido ? "Pedido" : "Consulta"} desde la tienda por ${ctx.comprador}` +
    (sector ? ` — ${sector}` : "") +
    (ctx.cliente_email ? ` (${ctx.cliente_email})` : "");

  // 1) Registro en la app.
  let opId: string;
  let opCode: string;
  if (isMock()) {
    const op = mockCreateOp({
      evento,
      comprador_alias: ctx.comprador,
      vendedor_alias: null,
      monto,
      fee: 0,
      ticket_id,
      fecha_evento,
      notas,
      cuenta_debitar: null,
      tipo,
      cliente_id: ctx.cliente_id,
      cliente_email: ctx.cliente_email,
      sector,
    });
    opId = op.id;
    opCode = op.code;
  } else {
    const admin = createAdminSupabase();
    let inserted: { id: string; code: string } | null = null;
    for (let attempt = 0; attempt < 5; attempt++) {
      const code = generateCode();
      const { data, error } = await admin
        .from("operaciones")
        .insert({
          code,
          evento,
          comprador_alias: ctx.comprador,
          monto,
          fee: 0,
          ticket_id,
          fecha_evento,
          notas,
          tipo,
          cliente_id: ctx.cliente_id,
          cliente_email: ctx.cliente_email,
          sector,
        })
        .select("id, code")
        .single();
      if (!error && data) {
        inserted = data;
        break;
      }
      if (error && (error as any).code !== "23505") {
        return NextResponse.json({ error: error.message }, { status: 500 });
      }
    }
    if (!inserted) {
      return NextResponse.json(
        { error: "No se pudo registrar el pedido, reintentá" },
        { status: 500 }
      );
    }
    opId = inserted.id;
    opCode = inserted.code;
  }

  // 2) Aviso a los vendedores por WhatsApp Y por email (best-effort, en
  // paralelo). Cualquiera que falle o no esté configurado no corta el flujo:
  // el pedido ya quedó registrado arriba.
  const lineaMonto = monto > 0 ? `\nPrecio de referencia: ${formatUSD(monto)}` : "";
  const mensaje =
    `🎟️ Nuev${esPedido ? "o PEDIDO" : "a CONSULTA"} en la tienda\n` +
    `Evento: ${evento}` +
    (sector ? `\nSector: ${sector}` : "") +
    lineaMonto +
    `\nCliente: ${ctx.comprador}` +
    (ctx.cliente_email ? ` (${ctx.cliente_email})` : "") +
    `\nCode: ${opCode}\nAccioná la operación desde el panel.`;
  const asunto = `🎟️ ${esPedido ? "Nuevo pedido" : "Nueva consulta"} — ${evento}`;

  const [wa, mail] = await Promise.all([
    notificarVendedores(mensaje),
    notificarVendedoresEmail(asunto, mensaje),
  ]);

  return NextResponse.json(
    {
      id: opId,
      code: opCode,
      tipo,
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
