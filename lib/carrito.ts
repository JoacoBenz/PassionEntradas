import type { MonedaVenta } from "./tickets";

// Resumen del carrito para el paso de revisión antes de enviar: las líneas
// separadas en pedido (con precio, se reservan al confirmar) y consulta (sin
// precio todavía), y un total POR MONEDA — pesos y dólares nunca se suman,
// cada moneda termina siendo una operación aparte (ver /api/pedidos).

type Linea = {
  tipo: "pedido" | "consulta";
  monto: number; // precio unitario (0 = sin precio)
  cantidad: number;
  // Los carritos guardados antes de las monedas no la tienen: eran dólares.
  moneda?: MonedaVenta;
};

export type TotalMoneda = { moneda: MonedaVenta; total: number };

export function totalesPorMoneda(items: Linea[]): TotalMoneda[] {
  return (["USD", "ARS"] as MonedaVenta[])
    .map((moneda) => ({
      moneda,
      total: items
        .filter((i) => (i.moneda ?? "USD") === moneda)
        .reduce((a, i) => a + (i.monto || 0) * i.cantidad, 0),
    }))
    .filter((t) => t.total > 0);
}

export function resumenCarrito<T extends Linea>(items: T[]) {
  return {
    pedidos: items.filter((i) => i.tipo === "pedido"),
    consultas: items.filter((i) => i.tipo === "consulta"),
    totales: totalesPorMoneda(items),
  };
}
