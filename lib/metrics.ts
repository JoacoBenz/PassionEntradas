import type { Operacion } from "@/lib/operaciones";

// Métricas del negocio para el tablero del módulo de carga.
//
// Criterio: la plata "se movió" cuando el pago está confirmado (incluye
// operaciones ya cerradas). Las canceladas no cuentan nunca, aunque hayan
// tenido pago en algún momento. "En juego" es la exposición actual: monto
// comprometido en operaciones abiertas que todavía no cobraron.

export type Metrics = {
  plataMovida: number; // suma de monto con pago confirmado
  comisionGanada: number; // suma de fee de esas operaciones
  entradasVendidas: number; // cantidad de operaciones con pago confirmado
  enJuegoMonto: number; // monto comprometido en operaciones abiertas sin pago
  enJuegoOps: number; // cuántas operaciones abiertas sin pago
  ticketPromedio: number; // plataMovida / entradasVendidas (0 si no hay)
};

type OpMetrica = Pick<
  Operacion,
  "monto" | "fee" | "status" | "pago_confirmado_at" | "cerrada_at"
>;

export function computeMetrics(ops: OpMetrica[]): Metrics {
  let plataMovida = 0;
  let comisionGanada = 0;
  let entradasVendidas = 0;
  let enJuegoMonto = 0;
  let enJuegoOps = 0;

  for (const op of ops) {
    if (op.status === "cancelada") continue;

    if (op.pago_confirmado_at) {
      plataMovida += op.monto;
      comisionGanada += op.fee;
      entradasVendidas += 1;
    } else if (!op.cerrada_at) {
      enJuegoMonto += op.monto;
      enJuegoOps += 1;
    }
  }

  return {
    plataMovida,
    comisionGanada,
    entradasVendidas,
    enJuegoMonto,
    enJuegoOps,
    ticketPromedio:
      entradasVendidas > 0 ? Math.round(plataMovida / entradasVendidas) : 0,
  };
}
