import { redirect } from "next/navigation";
import { createServerSupabase, createAdminSupabase } from "@/lib/supabase/server";
import { getRol, puedeVerTienda } from "@/lib/auth";
import { estadoPublicoDe } from "@/lib/operaciones";
import { MisPedidos, type PedidoView } from "@/components/tienda/MisPedidos";
import {
  isMock,
  mockFacturaDeOperacion,
  mockListConsultasCliente,
  mockListPedidosCliente,
  MOCK_USER,
} from "@/lib/mock-db";

// "Mis pedidos" del cliente: sus pedidos/consultas desde la tienda con el
// estado de cada uno (que se actualiza a medida que el staff acciona la
// operación), el link público de seguimiento y la factura si ya se emitió.
// Acceso reafirmado en el servidor (área privada).
//
// La lista junta DOS orígenes: las operaciones (pedidos con precio cerrado, y
// las consultas que el staff ya cargó) y las consultas todavía pendientes, que
// viven en su propia tabla y aún no son una operación. Sin esto último el
// cliente manda una consulta desde la tienda y no la ve en ningún lado.
export const dynamic = "force-dynamic";

type OpRow = {
  id: string;
  code: string;
  tipo: string;
  evento: string;
  sector: string | null;
  cantidad: number | null;
  fecha_evento: string | null;
  created_at: string;
  status: any;
  entrada_recibida_at: string | null;
  pago_confirmado_at: string | null;
  cerrada_at: string | null;
};

type ConsultaRow = {
  id: string;
  code: string;
  evento: string;
  sector: string | null;
  cantidad: number | null;
  fecha_evento: string | null;
  created_at: string;
};

function toView(o: OpRow, facturaId: string | null): PedidoView {
  return {
    id: o.id,
    code: o.code,
    tipo: o.tipo === "consulta" ? "consulta" : "pedido",
    evento: o.evento,
    sector: o.sector ?? null,
    cantidad: o.cantidad ?? 1,
    fecha_evento: o.fecha_evento ?? null,
    created_at: o.created_at,
    estado: estadoPublicoDe(o),
    facturaId,
    seguible: true,
  };
}

// Consulta pendiente: sin operación detrás no hay seguimiento ni factura.
function consultaToView(c: ConsultaRow): PedidoView {
  return {
    id: c.id,
    code: c.code,
    tipo: "consulta",
    evento: c.evento,
    sector: c.sector ?? null,
    cantidad: c.cantidad ?? 1,
    fecha_evento: c.fecha_evento ?? null,
    created_at: c.created_at,
    estado: "consulta_recibida",
    facturaId: null,
    seguible: false,
  };
}

const masNuevoPrimero = (a: PedidoView, b: PedidoView) =>
  b.created_at.localeCompare(a.created_at);

export default async function MisPedidosPage() {
  let pedidos: PedidoView[] = [];

  if (isMock()) {
    const ops = mockListPedidosCliente(
      "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
      MOCK_USER.email
    );
    const consultas = mockListConsultasCliente(
      "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
      MOCK_USER.email
    );
    pedidos = [
      ...ops.map((o) =>
        toView(o as unknown as OpRow, mockFacturaDeOperacion(o.id)?.id ?? null)
      ),
      ...consultas.map((c) => consultaToView(c as unknown as ConsultaRow)),
    ].sort(masNuevoPrimero);
  } else {
    const supabase = createServerSupabase();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user || !puedeVerTienda(getRol(user))) redirect("/ingresar");

    // Las tablas son deny-all para el cliente; leemos lo suyo con service role,
    // filtrando por su cliente_id (nunca ve los de otros).
    const admin = createAdminSupabase();
    const { data } = await admin
      .from("operaciones")
      .select(
        "id, code, tipo, evento, sector, cantidad, fecha_evento, created_at, status, entrada_recibida_at, pago_confirmado_at, cerrada_at"
      )
      .eq("cliente_id", user.id)
      .in("tipo", ["pedido", "consulta"])
      .order("created_at", { ascending: false })
      .limit(200);
    const ops = (data ?? []) as OpRow[];

    // Solo las PENDIENTES: una consulta ya convertida se ve como la operación
    // que originó, y mostrar las dos duplicaría el mismo pedido.
    const { data: dataC } = await admin
      .from("consultas")
      .select("id, code, evento, sector, cantidad, fecha_evento, created_at")
      .eq("cliente_id", user.id)
      .eq("estado", "pendiente")
      .order("created_at", { ascending: false })
      .limit(200);
    const consultas = (dataC ?? []) as ConsultaRow[];

    // Facturas emitidas para estos pedidos (map operacion_id -> factura_id),
    // así el cliente accede al recibo desde su seguimiento.
    const facturaPorOp = new Map<string, string>();
    if (ops.length > 0) {
      const { data: facs } = await admin
        .from("facturas")
        .select("id, operacion_id")
        .in(
          "operacion_id",
          ops.map((o) => o.id)
        );
      for (const f of (facs ?? []) as { id: string; operacion_id: string }[]) {
        facturaPorOp.set(f.operacion_id, f.id);
      }
    }

    pedidos = [
      ...ops.map((o) => toView(o, facturaPorOp.get(o.id) ?? null)),
      ...consultas.map(consultaToView),
    ].sort(masNuevoPrimero);
  }

  return <MisPedidos pedidos={pedidos} />;
}
