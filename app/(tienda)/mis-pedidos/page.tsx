import { redirect } from "next/navigation";
import { createServerSupabase, createAdminSupabase } from "@/lib/supabase/server";
import { getRol, puedeVerTienda } from "@/lib/auth";
import { estadoDe } from "@/lib/operaciones";
import { MisPedidos, type PedidoView } from "@/components/tienda/MisPedidos";
import { isMock, mockListPedidosCliente, MOCK_USER } from "@/lib/mock-db";

// "Mis pedidos" del cliente: sus pedidos/consultas desde la tienda con el
// estado de cada uno. Acceso reafirmado en el servidor (área privada).
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

function toView(o: OpRow): PedidoView {
  return {
    id: o.id,
    code: o.code,
    tipo: o.tipo === "consulta" ? "consulta" : "pedido",
    evento: o.evento,
    sector: o.sector ?? null,
    fecha_evento: o.fecha_evento ?? null,
    created_at: o.created_at,
    estado: estadoDe(o),
  };
}

export default async function MisPedidosPage() {
  let pedidos: PedidoView[] = [];

  if (isMock()) {
    pedidos = mockListPedidosCliente(
      "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
      MOCK_USER.email
    ).map((o) => toView(o as unknown as OpRow));
  } else {
    const supabase = createServerSupabase();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user || !puedeVerTienda(getRol(user))) redirect("/ingresar");

    // La tabla es deny-all para el cliente; leemos sus propios pedidos con
    // service role, filtrando por su cliente_id (nunca ve los de otros).
    const { data } = await createAdminSupabase()
      .from("operaciones")
      .select(
        "id, code, tipo, evento, sector, fecha_evento, created_at, status, entrada_recibida_at, pago_confirmado_at, cerrada_at"
      )
      .eq("cliente_id", user.id)
      .in("tipo", ["pedido", "consulta"])
      .order("created_at", { ascending: false })
      .limit(200);
    pedidos = ((data ?? []) as OpRow[]).map(toView);
  }

  return <MisPedidos pedidos={pedidos} />;
}
