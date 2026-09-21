import type { Operacion } from "@/lib/operaciones";

// Métricas del negocio para el tablero del módulo de carga.
//
// Criterio: la plata "se movió" cuando el pago está confirmado (incluye
// operaciones ya cerradas). Las canceladas no cuentan nunca, aunque hayan
// tenido pago en algún momento. "En juego" es la exposición actual: monto
// comprometido en operaciones abiertas que todavía no cobraron.

export type Metrics = {
  // Con varias monedas no tiene sentido un pozo único: las métricas son de
  // UNA moneda, la de mayor movimiento. El tablero la muestra en las
  // etiquetas para que no se lea un número sin unidad.
  moneda: string;
  plataMovida: number; // suma de monto con pago confirmado
  comisionGanada: number; // suma de fee de esas operaciones
  entradasVendidas: number; // cantidad de operaciones con pago confirmado
  enJuegoMonto: number; // monto comprometido en operaciones abiertas sin pago
  enJuegoOps: number; // cuántas operaciones abiertas sin pago
  ticketPromedio: number; // plataMovida / entradasVendidas (0 si no hay)
};

type OpMetrica = Pick<
  Operacion,
  "monto" | "fee" | "status" | "pago_confirmado_at" | "cerrada_at" | "moneda">;

// Rango opcional (fechas YYYY-MM-DD, inclusive): filtra las métricas de
// venta por CUÁNDO se confirmó el pago. "En juego" no depende del rango
// (es exposición actual). Mismo criterio que el RPC metricas_operaciones.
export function computeMetrics(
  ops: OpMetrica[],
  desde?: string | null,
  hasta?: string | null
): Metrics {
  let plataMovida = 0;
  let comisionGanada = 0;
  let entradasVendidas = 0;
  let enJuegoMonto = 0;
  let enJuegoOps = 0;

  for (const op of ops) {
    if (op.status === "cancelada") continue;

    if (op.pago_confirmado_at) {
      const dia = op.pago_confirmado_at.slice(0, 10);
      if (desde && dia < desde) continue;
      if (hasta && dia > hasta) continue;
      plataMovida += op.monto;
      comisionGanada += op.fee;
      entradasVendidas += 1;
    } else if (!op.cerrada_at) {
      enJuegoMonto += op.monto;
      enJuegoOps += 1;
    }
  }

  return {
    // En el cálculo en JS no hay agrupado por moneda: se informa la de la
    // primera operación, que es lo que efectivamente se está sumando.
    moneda: ops[0]?.moneda ?? "USD",
    plataMovida,
    comisionGanada,
    entradasVendidas,
    enJuegoMonto,
    enJuegoOps,
    ticketPromedio:
      entradasVendidas > 0 ? Math.round(plataMovida / entradasVendidas) : 0,
  };
}


// El RPC devuelve una fila por moneda. Se queda con la de mayor movimiento:
// mezclarlas daría un número que no significa nada, y mostrar N tableros
// complica una pantalla que hoy es de un vistazo.
export function metricasDominantes(
  filas: {
    moneda?: string | null;
    plata_movida?: number | null;
    comision_ganada?: number | null;
    entradas_vendidas?: number | null;
    en_juego_monto?: number | null;
    en_juego_ops?: number | null;
  }[]
): Metrics {
  const orden = [...(filas ?? [])].sort(
    (a, b) => Number(b.plata_movida ?? 0) - Number(a.plata_movida ?? 0)
  );
  const m = orden[0] ?? {};
  const plataMovida = Number(m.plata_movida ?? 0);
  const entradasVendidas = Number(m.entradas_vendidas ?? 0);
  return {
    moneda: m.moneda ?? "USD",
    plataMovida,
    comisionGanada: Number(m.comision_ganada ?? 0),
    entradasVendidas,
    enJuegoMonto: Number(m.en_juego_monto ?? 0),
    enJuegoOps: Number(m.en_juego_ops ?? 0),
    ticketPromedio: entradasVendidas > 0 ? Math.round(plataMovida / entradasVendidas) : 0,
  };
}
