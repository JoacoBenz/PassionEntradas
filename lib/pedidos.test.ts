import { describe, expect, it } from "vitest";
import {
  evaluarLimite,
  precioUsd,
  reconciliarItem,
  RL_MAX_VENTANA,
  RL_MIN_INTERVALO_MS,
  type ItemPedido,
  type TicketRef,
} from "./pedidos";

// El cliente manda el body del pedido, así que TODO lo que llega es hostil
// hasta que se reconcilia contra `tickets`. Estos tests fijan qué gana: la
// base, no el carrito.

// Entradas reales del catálogo demo (lib/mock-tickets.ts).
const PORTAL: TicketRef = {
  evento: "Match 12, Group A - Argentina vs Chile",
  categoria: "Category 1",
  precio_final: 720, // EUR: el portal guarda en euros
  stock: 4,
  fecha: "2026-10-08T12:00:00.000Z",
  source: "portal",
};
const PROPIA: TicketRef = {
  evento: "River vs Boca - Superclásico",
  categoria: "Platea Alta",
  precio_final: 150, // USD: las entradas propias ya vienen en dólares
  stock: 2,
  fecha: "2026-10-03T00:00:00.000Z",
  source: "manual",
};

const TASA = 1.08; // cotización EUR->USD del panel

function item(over: Partial<ItemPedido> = {}): ItemPedido {
  return {
    tipo: "pedido",
    evento: "Match 12, Group A - Argentina vs Chile",
    sector: "Category 1",
    ticket_id: "1001::1",
    monto: 778,
    cantidad: 1,
    fecha_evento: "2026-10-08",
    ...over,
  };
}

describe("precioUsd", () => {
  it("convierte el precio del portal con la cotización", () => {
    expect(precioUsd(PORTAL, TASA)).toBeCloseTo(777.6, 5);
  });

  it("deja las entradas propias como están (ya son USD)", () => {
    expect(precioUsd(PROPIA, TASA)).toBe(150);
  });

  // La regresión que casi se escapa: usar precio_final crudo guardaba el
  // pedido ~8% por debajo del precio que el cliente vio en la tienda.
  it("el portal en USD vale más que el número crudo de la tabla", () => {
    expect(precioUsd(PORTAL, TASA)!).toBeGreaterThan(PORTAL.precio_final!);
  });

  it("cae a la cotización por defecto si la configurada es inválida", () => {
    expect(precioUsd(PORTAL, 0)).toBeCloseTo(720 * 1.08, 5);
    expect(precioUsd(PORTAL, -5)).toBeCloseTo(720 * 1.08, 5);
  });

  it("sin precio o con basura devuelve null (nunca NaN)", () => {
    expect(precioUsd({ ...PORTAL, precio_final: null }, TASA)).toBeNull();
    expect(precioUsd({ ...PORTAL, precio_final: NaN }, TASA)).toBeNull();
    expect(precioUsd({ ...PORTAL, precio_final: 0 }, TASA)).toBeNull();
  });
});

describe("reconciliarItem — el precio sale de la base", () => {
  // Coincide con lo que muestra la tienda: fmtPrice redondea 777.6 a "US$ 778".
  it("ignora el monto del cliente y usa el del catálogo, redondeado", () => {
    const r = reconciliarItem(item({ monto: 1 }), PORTAL, TASA);
    expect(r.monto).toBe(778);
  });

  it("guarda el total de la línea (unitario × cantidad)", () => {
    const r = reconciliarItem(item({ cantidad: 3, monto: 1 }), PORTAL, TASA);
    expect(r.monto).toBe(778 * 3);
  });

  it("no convierte dos veces las entradas propias", () => {
    const r = reconciliarItem(
      item({ ticket_id: "manual::demo-1", cantidad: 2, monto: 1 }),
      PROPIA,
      TASA
    );
    expect(r.monto).toBe(300);
  });

  it("un precio regalado no sobrevive", () => {
    const r = reconciliarItem(item({ monto: 0 }), PORTAL, TASA);
    expect(r.monto).toBeGreaterThan(0);
  });
});

describe("reconciliarItem — el resto de los datos también", () => {
  it("pisa evento, sector y fecha falseados por el cliente", () => {
    const r = reconciliarItem(
      item({ evento: "HACKED", sector: "HACKED", fecha_evento: "1999-01-01" }),
      PORTAL,
      TASA
    );
    expect(r.evento).toBe(PORTAL.evento);
    expect(r.sector).toBe("Category 1");
    expect(r.fecha_evento).toBe("2026-10-08");
  });

  it("topea la cantidad por el stock real", () => {
    const r = reconciliarItem(item({ cantidad: 999 }), PORTAL, TASA);
    expect(r.cantidad).toBe(4);
    expect(r.monto).toBe(778 * 4);
  });

  it("no infla una cantidad menor al stock", () => {
    expect(reconciliarItem(item({ cantidad: 2 }), PORTAL, TASA).cantidad).toBe(2);
  });

  it("sin stock confiable respeta lo pedido (el panel lo revisa a mano)", () => {
    const r = reconciliarItem(item({ cantidad: 5 }), { ...PORTAL, stock: null }, TASA);
    expect(r.cantidad).toBe(5);
  });

  it("no muta el item original", () => {
    const original = item({ evento: "HACKED", monto: 1 });
    const copia = { ...original };
    reconciliarItem(original, PORTAL, TASA);
    expect(original).toEqual(copia);
  });
});

describe("reconciliarItem — casos que NO se tocan", () => {
  // El catálogo rota en cada sync: si la entrada ya no está, el pedido igual
  // se registra con lo que mandó el cliente y el panel lo resuelve.
  it("sin fila en la base deja el item como vino", () => {
    const p = item({ evento: "Algo viejo", monto: 500 });
    expect(reconciliarItem(p, undefined, TASA)).toEqual(p);
  });

  // Una consulta es "a confirmar", no una compra: el monto queda en 0 igual
  // que antes de estos cambios.
  it("la consulta queda en monto 0 aunque el ticket tenga precio", () => {
    const r = reconciliarItem(item({ tipo: "consulta", monto: 9999 }), PORTAL, TASA);
    expect(r.monto).toBe(0);
  });

  it("la consulta tampoco se topea por stock", () => {
    const r = reconciliarItem(
      item({ tipo: "consulta", cantidad: 9 }),
      { ...PORTAL, stock: 1 },
      TASA
    );
    expect(r.cantidad).toBe(9);
  });

  it("un ticket sin categoría no borra el sector que mandó el cliente", () => {
    const r = reconciliarItem(item({ sector: "Lo que eligió" }), { ...PORTAL, categoria: null }, TASA);
    expect(r.sector).toBe("Lo que eligió");
  });

  it("una fecha inválida en la base no pisa la del item", () => {
    const r = reconciliarItem(item(), { ...PORTAL, fecha: "no-es-fecha" }, TASA);
    expect(r.fecha_evento).toBe("2026-10-08");
  });

  // Entrada on_request (precio a confirmar): se registra sin monto.
  it("un ticket sin precio deja el pedido en 0", () => {
    const r = reconciliarItem(item({ monto: 400 }), { ...PORTAL, precio_final: null }, TASA);
    expect(r.monto).toBe(0);
  });
});

describe("evaluarLimite", () => {
  const AHORA = Date.parse("2026-09-18T12:00:00.000Z");
  const haceMs = (ms: number) => new Date(AHORA - ms).toISOString();

  it("deja pasar al cliente sin pedidos previos", () => {
    expect(evaluarLimite([], AHORA)).toBeNull();
  });

  it("corta el doble click", () => {
    expect(evaluarLimite([haceMs(1_000)], AHORA)).toMatch(/unos segundos/);
  });

  it("deja pasar pasado el intervalo mínimo", () => {
    expect(evaluarLimite([haceMs(RL_MIN_INTERVALO_MS + 1)], AHORA)).toBeNull();
  });

  // Un carrito real son hasta 50 líneas = 50 filas: no puede rozar el tope.
  it("un carrito grande legítimo no se bloquea", () => {
    const filas = Array.from({ length: 50 }, (_, i) => haceMs(60_000 + i));
    expect(evaluarLimite(filas, AHORA)).toBeNull();
  });

  it("corta al superar el tope de la ventana", () => {
    const filas = Array.from({ length: RL_MAX_VENTANA + 1 }, (_, i) => haceMs(60_000 + i));
    expect(evaluarLimite(filas, AHORA)).toMatch(/muchos pedidos/);
  });

  it("justo en el tope todavía pasa", () => {
    const filas = Array.from({ length: RL_MAX_VENTANA }, (_, i) => haceMs(60_000 + i));
    expect(evaluarLimite(filas, AHORA)).toBeNull();
  });

  // Fail-open: perder un pedido legítimo es peor que dejar pasar uno de más.
  it("una fecha ilegible no bloquea", () => {
    expect(evaluarLimite(["no-es-fecha"], AHORA)).toBeNull();
  });
});
