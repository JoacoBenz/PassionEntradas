import { describe, expect, it } from "vitest";
import {
  estadoDe,
  estadoPublicoDe,
  semaforoDe,
  operacionCompleta,
  sePuedeFacturar,
} from "./operaciones";

// Los hitos dejaron de tener orden: estos tests fijan que cualquier
// combinación sea válida y que el ticket del cliente NO vea los internos.

const hitos = (over: Partial<Parameters<typeof estadoDe>[0]> = {}) => ({
  status: "esperando_entrada" as const,
  entrada_recibida_at: null,
  pago_confirmado_at: null,
  pago_proveedor_at: null,
  cerrada_at: null,
  ...over,
});

const AYER = "2020-01-01T00:00:00.000Z";

describe("estadoDe — sin orden obligatorio", () => {
  it("sin nada marcado está en espera", () => {
    expect(estadoDe(hitos())).toBe("esperando");
  });

  // El caso que antes era imposible: la base y la API lo rechazaban.
  it("acepta pago sin entrada", () => {
    expect(estadoDe(hitos({ pago_confirmado_at: AYER }))).toBe("pago_confirmado");
  });

  it("acepta pago al proveedor sin nada más", () => {
    expect(estadoDe(hitos({ pago_proveedor_at: AYER }))).toBe("pago_confirmado");
  });

  it("con la entrada en mano pesa más que haber cobrado", () => {
    const e = estadoDe(hitos({ entrada_recibida_at: AYER, pago_confirmado_at: AYER }));
    expect(e).toBe("entrada_recibida");
  });

  it("con los tres internos hechos solo falta entregar", () => {
    const e = estadoDe(
      hitos({ entrada_recibida_at: AYER, pago_confirmado_at: AYER, pago_proveedor_at: AYER })
    );
    expect(e).toBe("lista_para_cerrar");
  });

  it("entregar NO cierra la operación por sí solo", () => {
    // `cerrada_at` es el hito "entrada entregada". Tomarlo como el fin de la
    // operación congelaba los otros tres, y quedaban sin tildar cosas que sí
    // pasaron (se entrega antes de pagarle al proveedor todo el tiempo).
    expect(estadoDe(hitos({ cerrada_at: AYER }))).not.toBe("cerrada");
  });

  it("cerrada son los CUATRO hitos", () => {
    expect(
      estadoDe(
        hitos({
          entrada_recibida_at: AYER,
          pago_confirmado_at: AYER,
          pago_proveedor_at: AYER,
          cerrada_at: AYER,
        })
      )
    ).toBe("cerrada");
  });

  it("con tres hechos, falta uno", () => {
    // Entregada y cobrada, pero todavía no se le pagó al proveedor.
    expect(
      estadoDe(hitos({ entrada_recibida_at: AYER, pago_confirmado_at: AYER, cerrada_at: AYER }))
    ).toBe("lista_para_cerrar");
    // O al revés: todo lo interno hecho y falta entregar.
    expect(
      estadoDe(
        hitos({ entrada_recibida_at: AYER, pago_confirmado_at: AYER, pago_proveedor_at: AYER })
      )
    ).toBe("lista_para_cerrar");
  });

  it("cancelada gana sobre todo", () => {
    expect(
      estadoDe(
        hitos({
          status: "cancelada",
          entrada_recibida_at: AYER,
          pago_confirmado_at: AYER,
          pago_proveedor_at: AYER,
          cerrada_at: AYER,
        })
      )
    ).toBe("cancelada");
  });
});

describe("operacionCompleta / sePuedeFacturar", () => {
  it("completa solo con los cuatro", () => {
    const tres = hitos({ entrada_recibida_at: AYER, pago_confirmado_at: AYER, cerrada_at: AYER });
    expect(operacionCompleta(tres)).toBe(false);
    expect(operacionCompleta({ ...tres, pago_proveedor_at: AYER })).toBe(true);
  });

  it("se factura con el pago del cliente, sin esperar al proveedor", () => {
    // Lo que habilita la factura es que el cliente haya pagado; los hitos con
    // el proveedor son asunto nuestro y no pueden trabar el comprobante.
    expect(sePuedeFacturar(hitos({ pago_confirmado_at: AYER }))).toBe(true);
    expect(sePuedeFacturar(hitos({ pago_confirmado_at: AYER, cerrada_at: AYER }))).toBe(true);
  });

  it("sin pago del cliente no hay factura", () => {
    expect(sePuedeFacturar(hitos({ cerrada_at: AYER }))).toBe(false);
  });

  it("una cancelada no se factura aunque tenga el pago", () => {
    expect(sePuedeFacturar(hitos({ status: "cancelada", pago_confirmado_at: AYER }))).toBe(false);
  });

  it("cancelada gana sobre todo, incluso sobre cerrada", () => {
    expect(estadoDe(hitos({ status: "cancelada", cerrada_at: null }))).toBe("cancelada");
  });
});

describe("estadoPublicoDe — el cliente no ve los hitos internos", () => {
  // Lo esencial: el comprador no tiene por qué enterarse de si ya le
  // pagamos al proveedor o si tenemos la entrada en mano.
  it("los hitos con el proveedor no cambian lo que ve", () => {
    const sin = estadoPublicoDe({ status: "esperando_entrada", pago_confirmado_at: null, cerrada_at: null });
    const con = estadoPublicoDe({ status: "esperando_entrada", pago_confirmado_at: null, cerrada_at: null });
    expect(sin).toBe("pedido_recibido");
    expect(con).toBe("pedido_recibido");
  });

  it("su pago sí lo ve", () => {
    expect(
      estadoPublicoDe({ status: "esperando_entrada", pago_confirmado_at: AYER, cerrada_at: null })
    ).toBe("pago_recibido");
  });

  it("entregada cuando se cierra", () => {
    expect(
      estadoPublicoDe({ status: "esperando_entrada", pago_confirmado_at: AYER, cerrada_at: AYER })
    ).toBe("entregada");
  });

  it("cancelada", () => {
    expect(
      estadoPublicoDe({ status: "cancelada", pago_confirmado_at: null, cerrada_at: null })
    ).toBe("cancelada");
  });
});

describe("semaforoDe", () => {
  // Fechas relativas a hoy para que el test no caduque.
  const enDias = (n: number) => {
    const d = new Date();
    d.setDate(d.getDate() + n);
    return d.toISOString().slice(0, 10);
  };

  it("verde cuando está entregada", () => {
    expect(semaforoDe({ ...hitos({ cerrada_at: AYER }), fecha_evento: enDias(30) })).toBe("verde");
  });

  // Entregada manda: pasó el evento pero ya cumplimos, no hay nada urgente.
  it("entregada sigue verde aunque el evento ya haya pasado", () => {
    expect(semaforoDe({ ...hitos({ cerrada_at: AYER }), fecha_evento: enDias(-10) })).toBe("verde");
  });

  it("rojo si el evento ya pasó y no se entregó", () => {
    expect(semaforoDe({ ...hitos(), fecha_evento: enDias(-1) })).toBe("rojo");
  });

  it("rojo si el evento es dentro del plazo de aviso", () => {
    expect(semaforoDe({ ...hitos(), fecha_evento: enDias(3) })).toBe("rojo");
  });

  // El rojo pisa al amarillo: "pagué y se me vence mañana" es más urgente.
  it("rojo gana sobre amarillo", () => {
    expect(
      semaforoDe({ ...hitos({ pago_confirmado_at: AYER }), fecha_evento: enDias(2) })
    ).toBe("rojo");
  });

  it("amarillo con el pago hecho y sin urgencia de fecha", () => {
    expect(
      semaforoDe({ ...hitos({ pago_confirmado_at: AYER }), fecha_evento: enDias(60) })
    ).toBe("amarillo");
  });

  it("gris sin pago y con el evento lejos", () => {
    expect(semaforoDe({ ...hitos(), fecha_evento: enDias(60) })).toBe("gris");
  });

  // Sin fecha no hay contra qué medir: nunca puede ser roja.
  it("sin fecha de evento nunca es roja", () => {
    expect(semaforoDe({ ...hitos(), fecha_evento: null })).toBe("gris");
    expect(semaforoDe({ ...hitos({ pago_confirmado_at: AYER }), fecha_evento: null })).toBe("amarillo");
  });

  it("las canceladas quedan fuera del semáforo", () => {
    expect(semaforoDe({ ...hitos({ status: "cancelada" }), fecha_evento: enDias(-5) })).toBe("gris");
  });

  it("respeta un plazo de aviso distinto", () => {
    expect(semaforoDe({ ...hitos(), fecha_evento: enDias(10) }, 14)).toBe("rojo");
    expect(semaforoDe({ ...hitos(), fecha_evento: enDias(10) }, 5)).toBe("gris");
  });
});
