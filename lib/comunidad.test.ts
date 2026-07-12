import { beforeEach, describe, expect, it } from "vitest";
import {
  mockAccionSolicitud,
  mockApplyAction,
  mockCreatePublicacion,
  mockCreateSolicitud,
  mockListPublicaciones,
  mockListSolicitudes,
  mockListOps,
} from "./mock-db";

// La lógica del mock replica 1:1 la de las rutas reales; estos tests cubren
// los invariantes de la Fase 1 que no se pueden armar vía HTTP en demo
// (hacen falta varios compradores distintos).

function armarPubConDosSolicitudes() {
  const pub = mockCreatePublicacion({
    user_id: "vend-1",
    vendedor_alias: "vende_test",
    evento: "Evento Test",
    descripcion: null,
    fecha_evento: "2026-12-01",
    precio: 100_000,
    cantidad: 1,
  });
  const a = mockCreateSolicitud({
    publicacion_id: pub.id,
    comprador_id: "comp-a",
    comprador_alias: "ana",
    mensaje: null,
  });
  const b = mockCreateSolicitud({
    publicacion_id: pub.id,
    comprador_id: "comp-b",
    comprador_alias: "beto",
    mensaje: null,
  });
  if (!a.ok || !b.ok) throw new Error("seed de test falló");
  return { pub, solA: a.sol, solB: b.sol };
}

beforeEach(() => {
  // Resetea la "base" en memoria entre tests.
  (globalThis as Record<string, unknown>).__passionMockDb = undefined;
});

describe("candados de estado en solicitudes", () => {
  it("no se inicia una segunda custodia sobre la misma publicación", () => {
    const { solA, solB } = armarPubConDosSolicitudes();
    const r1 = mockAccionSolicitud(solA.id, "iniciar");
    expect(r1.ok).toBe(true);

    const r2 = mockAccionSolicitud(solB.id, "iniciar");
    expect(r2.ok).toBe(false);
    if (!r2.ok) expect(r2.status).toBe(409);
  });

  it("no se inicia custodia sobre una publicación retirada", () => {
    const pub = mockCreatePublicacion({
      user_id: "vend-1",
      vendedor_alias: "vende_test",
      evento: "Evento Test",
      descripcion: null,
      fecha_evento: null,
      precio: 50_000,
      cantidad: 1,
    });
    const sol = mockCreateSolicitud({
      publicacion_id: pub.id,
      comprador_id: "comp-a",
      comprador_alias: "ana",
      mensaje: null,
    });
    if (!sol.ok) throw new Error("seed");
    pub.estado = "retirada";
    const r = mockAccionSolicitud(sol.sol.id, "iniciar");
    expect(r.ok).toBe(false);
  });

  it("concretar auto-rechaza las solicitudes hermanas pendientes", () => {
    const { pub, solA, solB } = armarPubConDosSolicitudes();
    mockAccionSolicitud(solA.id, "iniciar");
    const r = mockAccionSolicitud(solA.id, "concretar");
    expect(r.ok).toBe(true);

    const sols = mockListSolicitudes();
    expect(sols.find((s) => s.id === solB.id)?.estado).toBe("rechazada");
    expect(mockListPublicaciones().find((p) => p.id === pub.id)?.estado).toBe("vendida");
  });
});

describe("sincronización operación <-> solicitud", () => {
  it("rechazar una solicitud en proceso cancela su operación", () => {
    const { solA } = armarPubConDosSolicitudes();
    const inicio = mockAccionSolicitud(solA.id, "iniciar");
    if (!inicio.ok || !inicio.operacion) throw new Error("no inició");

    const r = mockAccionSolicitud(solA.id, "rechazar");
    expect(r.ok).toBe(true);
    const op = mockListOps().find((o) => o.id === inicio.operacion!.id);
    expect(op?.status).toBe("cancelada");
  });

  it("con la operación cerrada no se rechaza: hay que concretar", () => {
    const { solA } = armarPubConDosSolicitudes();
    const inicio = mockAccionSolicitud(solA.id, "iniciar");
    if (!inicio.ok || !inicio.operacion) throw new Error("no inició");
    const opId = inicio.operacion.id;
    mockApplyAction(opId, { action: "entrada", done: true });
    mockApplyAction(opId, { action: "pago", done: true });
    mockApplyAction(opId, { action: "cerrar", done: true });

    const r = mockAccionSolicitud(solA.id, "rechazar");
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toMatch(/concretá/);
  });

  it("cancelar la operación desde el panel rechaza la solicitud y libera la publicación", () => {
    const { pub, solA } = armarPubConDosSolicitudes();
    const inicio = mockAccionSolicitud(solA.id, "iniciar");
    if (!inicio.ok || !inicio.operacion) throw new Error("no inició");

    const r = mockApplyAction(inicio.operacion.id, { action: "cancelar" });
    expect(r.ok).toBe(true);
    const sols = mockListSolicitudes();
    expect(sols.find((s) => s.id === solA.id)?.estado).toBe("rechazada");
    expect(mockListPublicaciones().find((p) => p.id === pub.id)?.estado).toBe("activa");
  });
});

describe("re-solicitar tras un rechazo", () => {
  it("una solicitud rechazada no bloquea volver a pedir; una viva sí", () => {
    const { solA } = armarPubConDosSolicitudes();

    // Con la solicitud viva (pendiente), duplicar está bloqueado.
    const dupe = mockCreateSolicitud({
      publicacion_id: solA.publicacion_id,
      comprador_id: "comp-a",
      comprador_alias: "ana",
      mensaje: null,
    });
    expect(dupe.ok).toBe(false);

    // Rechazada -> puede volver a pedir.
    mockAccionSolicitud(solA.id, "rechazar");
    const otraVez = mockCreateSolicitud({
      publicacion_id: solA.publicacion_id,
      comprador_id: "comp-a",
      comprador_alias: "ana",
      mensaje: null,
    });
    expect(otraVez.ok).toBe(true);
  });
});
