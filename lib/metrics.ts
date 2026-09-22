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
// (es exposición actual).
//
// Agrupa por moneda y devuelve la dominante, igual que el RPC: sumar pesos
// con dólares en un solo pozo y etiquetarlo con la moneda de la primera
// operación daba un número que no significaba nada (y mentía sobre la unidad).
//
// OJO: el RPC `metricas_operaciones` todavía cuenta la plata movida por
// `cerrada_at` y las entradas por suma de `cantidad`; acá se usa el criterio
// documentado arriba (pago confirmado, una por operación). Son dos
// definiciones distintas del mismo tablero y hay que unificarlas.
export function computeMetrics(
  ops: OpMetrica[],
  desde?: string | null,
  hasta?: string | null
): Metrics {
  type Acum = {
    moneda: string;
    plata_movida: number;
    comision_ganada: number;
    entradas_vendidas: number;
    en_juego_monto: number;
    en_juego_ops: number;
  };
  const porMoneda = new Map<string, Acum>();
  const acum = (moneda: string): Acum => {
    let a = porMoneda.get(moneda);
    if (!a) {
      a = {
        moneda,
        plata_movida: 0,
        comision_ganada: 0,
        entradas_vendidas: 0,
        en_juego_monto: 0,
        en_juego_ops: 0,
      };
      porMoneda.set(moneda, a);
    }
    return a;
  };

  for (const op of ops) {
    if (op.status === "cancelada") continue;
    const a = acum(op.moneda ?? "USD");

    if (op.pago_confirmado_at) {
      const dia = op.pago_confirmado_at.slice(0, 10);
      if (desde && dia < desde) continue;
      if (hasta && dia > hasta) continue;
      a.plata_movida += op.monto;
      a.comision_ganada += op.fee;
      a.entradas_vendidas += 1;
    } else if (!op.cerrada_at) {
      a.en_juego_monto += op.monto;
      a.en_juego_ops += 1;
    }
  }

  return metricasDominantes(Array.from(porMoneda.values()));
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
