// Stock de entradas propias: cuándo se descuenta y cuándo se devuelve.
//
// Se descuenta cuando el CLIENTE PAGA (pedido del cliente) y por la cantidad
// real de cada línea; antes era al entregar, y siempre 1. El movimiento en sí
// lo hace la función de la base `stock_operacion` (migración 0039), que deja
// registrado en la operación cuánto descontó: devolver devuelve exactamente
// eso. Acá solo se decide QUÉ hacer según la acción del panel.

import type { StatusAction } from "@/lib/operaciones";

export type MovimientoStock = "tomar" | "devolver" | null;

export function movimientoDeStock(
  action: StatusAction,
  despues: { status: string; pago_confirmado_at: string | null }
): MovimientoStock {
  switch (action.action) {
    case "pago":
      return action.done ? "tomar" : "devolver";
    case "cancelar":
      // Cancelar libera lo que se había tomado.
      return "devolver";
    case "reabrir":
      // Reabrir una operación que ya estaba paga vuelve a tomar su stock.
      return despues.pago_confirmado_at ? "tomar" : null;
    default:
      // Entregar ya no mueve stock (antes descontaba 1 acá).
      return null;
  }
}

export type LineaDescontada = { ticket_id: string; cantidad: number; pedido: number };

// Sobreventa: se pidió más de lo que había. La base nunca deja el stock en
// negativo, así que descuenta lo que hay; el panel avisa con este texto.
export function avisoDeSobreventa(lineas: LineaDescontada[] | null | undefined): string | null {
  const cortas = (lineas ?? []).filter((l) => l.cantidad < l.pedido);
  if (cortas.length === 0) return null;
  const faltan = cortas.reduce((a, l) => a + (l.pedido - l.cantidad), 0);
  return `Ojo: no alcanzaba el stock de la tienda (faltaron ${faltan} ${
    faltan === 1 ? "entrada" : "entradas"
  }). Revisá la disponibilidad antes de confirmar con el cliente.`;
}
