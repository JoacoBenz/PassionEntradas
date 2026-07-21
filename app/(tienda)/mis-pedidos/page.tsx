import { redirect } from "next/navigation";
import { createServerSupabase, createAdminSupabase } from "@/lib/supabase/server";
import { getRol, puedeVerTienda } from "@/lib/auth";
import { estadoDe } from "@/lib/operaciones";
import { MisPedidos, type PedidoView } from "@/components/tienda/MisPedidos";
import {
  isMock,
  mockFacturaDeOperacion,
  mockListPedidosCliente,
  MOCK_USER,
} from "@/lib/mock-db";

// "Mis pedidos" del cliente: sus pedidos/consultas desde la tienda con el
// estado de cada uno (que se actualiza a medida que el staff acciona la
// operación), el link público de seguimiento y la factura si ya se emitió.
// Acceso reafirmado en el servidor (área privada).
export const dynamic = "force-dynamic";

type OpRow = {
  id: string;
  code: string;
  tipo: string;
  evento: string;
  sector: string | null;
  fecha_evento: string | null;
  created_at: string;
  status: any;
  entrada_recibida_at: string | null;
  pago_confirmado_at: string | null;
  cerrada_at: string | null;
};

function toView(o: OpRow, facturaId: string | null): PedidoView {
  return {
    id: o.id,
    code: o.code,
    tipo: o.tipo === "consulta" ? "consulta" : "pedido",
    evento: o.evento,
    sector: o.sector ?? null,
    fecha_evento: o.fecha_evento ?? null,
    created_at: o.created_at,
    estado: estadoDe(o),
    facturaId,
  };
}

export default async function MisPedidosPage() {
  let pedidos: PedidoView[] = [];

  if (isMock()) {
    const ops = mockListPedidosCliente(
      "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
      MOCK_USER.email
    );
    pedidos = ops.map((o) =>
      toView(o as unknown as OpRow, mockFacturaDeOperacion(o.id)?.id ?? null)
    );
  } else {
    const supabase = createServerSupabase();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user || !puedeVerTienda(getRol(user))) redirect("/ingresar");

    // La tabla es deny-all para el cliente; leemos sus propios pedidos con
    // service role, filtrando por su cliente_id (nunca ve los de otros).
    const admin = createAdminSupabase();
    const { data } = await admin
      .from("operaciones")
      .select(
        "id, code, tipo, evento, sector, fecha_evento, created_at, status, entrada_recibida_at, pago_confirmado_at, cerrada_at"
      )
      .eq("cliente_id", user.id)
      .in("tipo", ["pedido", "consulta"])
      .order("created_at", { ascending: false })
      .limit(200);
    const ops = (data ?? []) as OpRow[];

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

    pedidos = ops.map((o) => toView(o, facturaPorOp.get(o.id) ?? null));
  }

  return <MisPedidos pedidos={pedidos} />;
}
