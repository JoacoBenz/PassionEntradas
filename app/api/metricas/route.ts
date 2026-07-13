import { NextResponse } from "next/server";
import { createServerSupabase, createAdminSupabase } from "@/lib/supabase/server";
import { esStaff, getRol } from "@/lib/auth";
import type { Metrics } from "@/lib/metrics";
import { computeMetrics } from "@/lib/metrics";
import { isMock, mockListOps } from "@/lib/mock-db";

// GET /api/metricas?desde=YYYY-MM-DD&hasta=YYYY-MM-DD — métricas del tablero
// filtradas por cuándo se confirmó el pago (ambas fechas opcionales e
// inclusive). Staff (el tablero vive en el módulo del moderador).
// Agregados en la base vía RPC: nunca se bajan filas.
export const dynamic = "force-dynamic";

const DIA_RE = /^\d{4}-\d{2}-\d{2}$/;

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const desde = searchParams.get("desde");
  const hasta = searchParams.get("hasta");
  if ((desde && !DIA_RE.test(desde)) || (hasta && !DIA_RE.test(hasta))) {
    return NextResponse.json({ error: "Fecha inválida (YYYY-MM-DD)" }, { status: 400 });
  }

  if (isMock()) {
    return NextResponse.json(computeMetrics(mockListOps(), desde, hasta));
  }

  const supabase = createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user || !esStaff(getRol(user))) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const { data, error } = await createAdminSupabase()
    .rpc("metricas_operaciones", { p_desde: desde, p_hasta: hasta })
    .single();
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const m = (data ?? {}) as Record<string, number | null>;
  const plataMovida = Number(m.plata_movida ?? 0);
  const entradasVendidas = Number(m.entradas_vendidas ?? 0);
  const metrics: Metrics = {
    plataMovida,
    comisionGanada: Number(m.comision_ganada ?? 0),
    entradasVendidas,
    enJuegoMonto: Number(m.en_juego_monto ?? 0),
    enJuegoOps: Number(m.en_juego_ops ?? 0),
    ticketPromedio:
      entradasVendidas > 0 ? Math.round(plataMovida / entradasVendidas) : 0,
  };
  return NextResponse.json(metrics);
}
