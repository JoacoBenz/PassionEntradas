import { NextResponse } from "next/server";
import { createServerSupabase, createAdminSupabase } from "@/lib/supabase/server";
import { getRol, puedeVerTienda, nombreDe } from "@/lib/auth";
import { formatUSD, generateCode, type TipoOperacion } from "@/lib/operaciones";
import { notificarVendedores } from "@/lib/whatsapp";
import { notificarVendedoresEmail } from "@/lib/email";
import {
  isMock,
  mockCreateOp,
  mockCrearConsulta,
  mockListManual,
  MOCK_USER,
} from "@/lib/mock-db";
import { fetchConfigTienda } from "@/lib/supabase/public";
import { DEFAULT_EUR_USD } from "@/lib/tickets";
import {
  evaluarLimite,
  reconciliarItem,
  resumenOperacion,
  separarPorTipo,
  RL_MAX_VENTANA,
  RL_VENTANA_MS,
  type ItemPedido,
  type TicketRef,
} from "@/lib/pedidos";

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

// --- Anti-flood --------------------------------------------------------------
// Sin infra nueva: se cuenta sobre `operaciones`, que es donde ya queda el
// rastro. La decisión en sí está en lib/pedidos.ts (evaluarLimite).
async function limiteExcedido(clienteId: string | null): Promise<string | null> {
  // En mock no se aplica: el demo y los e2e envían pedidos seguidos.
  if (isMock() || !clienteId) return null;
  const desde = new Date(Date.now() - RL_VENTANA_MS).toISOString();
  const { data, error } = await createAdminSupabase()
    .from("operaciones")
    .select("created_at")
    .eq("cliente_id", clienteId)
    .gte("created_at", desde)
    .order("created_at", { ascending: false })
    .limit(RL_MAX_VENTANA + 1);
  // Ante un error de lectura no se bloquea al cliente (fail-open: perder un
  // pedido legítimo es peor que dejar pasar un envío de más).
  if (error) return null;
  return evaluarLimite(
    (data ?? []).map((r) => String(r.created_at)),
    Date.now()
  );
}

// --- Datos reales de la entrada ----------------------------------------------
// Trae las filas de `tickets` contra las que se reconcilian los items del
// carrito (la reconciliación en sí está en lib/pedidos.ts).
async function buscarTickets(ids: string[]): Promise<Map<string, TicketRef>> {
  const map = new Map<string, TicketRef>();
  if (ids.length === 0) return map;
  const guardar = (t: any) =>
    map.set(t.id, {
      evento: t.evento,
      categoria: t.categoria ?? null,
      precio_final: t.precio_final ?? null,
      stock: t.stock ?? null,
      fecha: t.fecha ?? null,
      source: t.source === "manual" ? "manual" : "portal",
    });

  if (isMock()) {
    const { MOCK_TICKETS } = await import("@/lib/mock-tickets");
    for (const t of [...MOCK_TICKETS, ...mockListManual()]) {
      if (ids.includes(t.id)) guardar(t);
    }
    return map;
  }
  const { data } = await createAdminSupabase()
    .from("tickets")
    .select("id, evento, categoria, precio_final, stock, fecha, source")
    .in("id", ids);
  for (const t of (data ?? []) as any[]) guardar(t);
  return map;
}

export async function POST(request: Request) {
  const ctx = await contexto();
  if ("error" in ctx) {
    return NextResponse.json({ error: ctx.error }, { status: ctx.status });
  }

  const limite = await limiteExcedido(ctx.cliente_id);
  if (limite) {
    return NextResponse.json({ error: limite }, { status: 429 });
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
  type Parsed = ItemPedido;
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

  // Los items vinculados a una entrada del catálogo se reconcilian contra la
  // fila real: evento, sector, fecha y PRECIO salen de la base, no del cliente.
  // La cantidad se topea por el stock conocido (la tienda ya lo limita; un
  // desvío significa carrito viejo o manipulación). Los que no matchean quedan
  // como vinieron.
  const refs = await buscarTickets(
    parsed.map((p) => p.ticket_id).filter((id): id is string => !!id)
  );
  // La tienda muestra TODO en USD: las filas del portal están en EUR y se
  // convierten con la cotización del panel; las propias ya están en USD. Hay que
  // aplicar la misma conversión acá o el monto guardado quedaría por debajo del
  // precio que vio el cliente.
  const tasa = refs.size
    ? await fetchConfigTienda()
        .then((c) => (c.eurUsd > 0 ? c.eurUsd : DEFAULT_EUR_USD))
        .catch(() => DEFAULT_EUR_USD)
    : DEFAULT_EUR_USD;

  for (let i = 0; i < parsed.length; i++) {
    const p = parsed[i];
    parsed[i] = reconciliarItem(p, p.ticket_id ? refs.get(p.ticket_id) : undefined, tasa);
  }

  const quien = `${ctx.comprador}${ctx.cliente_email ? ` (${ctx.cliente_email})` : ""}`;
  const detalle = (p: Parsed) =>
    `${p.evento}${p.sector ? ` — ${p.sector}` : ""}${p.cantidad > 1 ? ` ×${p.cantidad}` : ""}`;
  const notasDePedido = (ls: Parsed[]) =>
    `Pedido desde la tienda por ${quien}\n` + ls.map((l) => `· ${detalle(l)}`).join("\n");
  const notasDeConsulta = (l: Parsed, _c: Ctx) =>
    `Consulta desde la tienda por ${quien} — ${detalle(l)}`;

  // 1) Registro en la app. UN envío del carrito = UNA operación con sus
  // líneas. Lo que va "a consultar" no tiene precio cerrado, así que no es una
  // operación: va a `consultas` y se convierte después desde el panel. Ambas
  // comparten `envio_id` para no perder que entraron juntas.
  const { pedidos: lineasPedido, consultas: lineasConsulta } = separarPorTipo(parsed);
  const envioId = crypto.randomUUID();

  type Creada = { id: string; code: string; evento: string; monto: number; cantidad: number };
  let operacion: Creada | null = null;
  const consultasCreadas: { id: string; code: string; evento: string }[] = [];

  const resumen = lineasPedido.length > 0 ? resumenOperacion(lineasPedido) : null;

  if (isMock()) {
    if (resumen) {
      const op = mockCreateOp({
        evento: resumen.evento,
        comprador_alias: ctx.comprador,
        vendedor_alias: null,
        monto: resumen.monto,
        cantidad: resumen.cantidad,
        fee: 0,
        ticket_id: resumen.ticket_id,
        fecha_evento: resumen.fecha_evento,
        notas: notasDePedido(lineasPedido),
        cuenta_debitar: null,
        tipo: "pedido",
        cliente_id: ctx.cliente_id,
        cliente_email: ctx.cliente_email,
        sector: resumen.sector,
        envio_id: envioId,
        items: lineasPedido.map((l) => ({
          ticket_id: l.ticket_id,
          evento: l.evento,
          sector: l.sector,
          fecha_evento: l.fecha_evento,
          cantidad: l.cantidad,
          precio_unitario: l.cantidad > 0 ? l.monto / l.cantidad : 0,
        })),
      });
      operacion = { id: op.id, code: op.code, evento: op.evento, monto: op.monto, cantidad: op.cantidad };
    }
    for (const l of lineasConsulta) {
      const c = mockCrearConsulta({
        envio_id: envioId,
        cliente_id: ctx.cliente_id,
        cliente_email: ctx.cliente_email,
        comprador_alias: ctx.comprador,
        ticket_id: l.ticket_id,
        evento: l.evento,
        sector: l.sector,
        fecha_evento: l.fecha_evento,
        cantidad: l.cantidad,
        notas: notasDeConsulta(l, ctx),
      });
      consultasCreadas.push({ id: c.id, code: c.code, evento: c.evento });
    }
  } else {
    const admin = createAdminSupabase();

    if (resumen) {
      // Reintento por colisión de code (23505); muy improbable.
      for (let attempt = 0; attempt < 5; attempt++) {
        const { data, error } = await admin
          .from("operaciones")
          .insert({
            code: generateCode(),
            evento: resumen.evento,
            comprador_alias: ctx.comprador,
            monto: resumen.monto,
            cantidad: resumen.cantidad,
            fee: 0,
            ticket_id: resumen.ticket_id,
            fecha_evento: resumen.fecha_evento,
            notas: notasDePedido(lineasPedido),
            tipo: "pedido",
            cliente_id: ctx.cliente_id,
            cliente_email: ctx.cliente_email,
            sector: resumen.sector,
            envio_id: envioId,
          })
          .select("id, code, evento, monto, cantidad")
          .single();
        if (!error && data) {
          operacion = data as Creada;
          break;
        }
        if (error && (error as any).code !== "23505") {
          return NextResponse.json({ error: error.message }, { status: 500 });
        }
      }
      if (!operacion) {
        return NextResponse.json(
          { error: "No se pudo registrar el pedido, reintentá" },
          { status: 500 }
        );
      }

      // Las líneas. Si fallan, la operación queda sin detalle: se borra para
      // no dejar una operación a medias en el panel.
      const { error: errItems } = await admin.from("operacion_items").insert(
        lineasPedido.map((l) => ({
          operacion_id: operacion!.id,
          ticket_id: l.ticket_id,
          evento: l.evento,
          sector: l.sector,
          fecha_evento: l.fecha_evento,
          cantidad: l.cantidad,
          precio_unitario: l.cantidad > 0 ? l.monto / l.cantidad : 0,
        }))
      );
      if (errItems) {
        await admin.from("operaciones").delete().eq("id", operacion.id);
        return NextResponse.json(
          { error: "No se pudo registrar el detalle del pedido, reintentá" },
          { status: 500 }
        );
      }
    }

    for (const l of lineasConsulta) {
      for (let attempt = 0; attempt < 5; attempt++) {
        const { data, error } = await admin
          .from("consultas")
          .insert({
            code: generateCode(),
            envio_id: envioId,
            cliente_id: ctx.cliente_id,
            cliente_email: ctx.cliente_email,
            comprador_alias: ctx.comprador,
            ticket_id: l.ticket_id,
            evento: l.evento,
            sector: l.sector,
            fecha_evento: l.fecha_evento,
            cantidad: l.cantidad,
            notas: notasDeConsulta(l, ctx),
          })
          .select("id, code, evento")
          .single();
        if (!error && data) {
          consultasCreadas.push(data as { id: string; code: string; evento: string });
          break;
        }
        if (error && (error as any).code !== "23505") {
          return NextResponse.json({ error: error.message }, { status: 500 });
        }
      }
    }
  }

  // 2) Un solo aviso a los vendedores (WhatsApp + email) con todas las
  // entradas del pedido. Best-effort: si falla o no está configurado, las
  // operaciones ya quedaron registradas arriba.
  const totalEntradas = parsed.reduce((a, p) => a + p.cantidad, 0);
  const bloques: string[] = [];

  if (operacion && resumen) {
    const ls = lineasPedido
      .map((l, i) => `  ${i + 1}) ${detalle(l)} — ${formatUSD(l.monto)}`)
      .join("\n");
    bloques.push(
      `OPERACIÓN ${operacion.code} — ${formatUSD(resumen.monto)}\n${ls}`
    );
  }
  if (consultasCreadas.length > 0) {
    const ls = lineasConsulta
      .map((l, i) => `  ${i + 1}) ${detalle(l)} · ${consultasCreadas[i]?.code ?? ""}`)
      .join("\n");
    bloques.push(`A CONSULTAR (${consultasCreadas.length})\n${ls}`);
  }

  const mensaje =
    `🎟️ Nuevo pedido en la tienda (${totalEntradas} ${totalEntradas === 1 ? "entrada" : "entradas"})\n` +
    `Cliente: ${quien}\n\n` +
    bloques.join("\n\n") +
    `\n\nAccionalo desde el panel.`;
  const asunto = `🎟️ Nuevo pedido (${totalEntradas}) — ${ctx.comprador}`;

  const [wa, mail] = await Promise.all([
    notificarVendedores(mensaje),
    notificarVendedoresEmail(asunto, mensaje),
  ]);

  return NextResponse.json(
    {
      ok: true,
      // `count` sigue siendo la cantidad de entradas del envío (lo que el
      // carrito muestra); ahora además se devuelve qué se creó con cada una.
      count: totalEntradas,
      operacion: operacion ? { id: operacion.id, code: operacion.code } : null,
      consultas: consultasCreadas.map((c) => ({ id: c.id, code: c.code })),
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
