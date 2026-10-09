import { describe, expect, it } from "vitest";
import { fichasDeClientes, rankearClientes, type ClienteCuenta, type CompraDeCliente } from "./clientes";

const cuentas: ClienteCuenta[] = [
  { id: "a", nombre: "Ana", email: "ana@x.com" },
  { id: "b", nombre: "Bruno", email: "bruno@x.com" },
  { id: "c", nombre: "Carla", email: "carla@x.com" },
];

const compra = (o: Partial<CompraDeCliente>): CompraDeCliente => ({
  cliente_id: null,
  cliente_email: null,
  monto: 100,
  moneda: "USD",
  status: "esperando_entrada",
  ...o,
});

describe("rankearClientes", () => {
  it("ordena por cantidad de operaciones", () => {
    const r = rankearClientes(cuentas, [
      compra({ cliente_id: "b" }),
      compra({ cliente_id: "b" }),
      compra({ cliente_id: "a" }),
    ]);
    expect(r.map((c) => c.nombre)).toEqual(["Bruno", "Ana", "Carla"]);
    expect(r[0].operaciones).toBe(2);
  });

  it("con la misma cantidad, desempata el que más plata movió", () => {
    const r = rankearClientes(cuentas, [
      compra({ cliente_id: "a", monto: 50 }),
      compra({ cliente_id: "b", monto: 900 }),
    ]);
    expect(r.map((c) => c.nombre).slice(0, 2)).toEqual(["Bruno", "Ana"]);
  });

  it("los que nunca compraron van al final, por nombre", () => {
    const r = rankearClientes(cuentas, [compra({ cliente_id: "c" })]);
    expect(r.map((c) => c.nombre)).toEqual(["Carla", "Ana", "Bruno"]);
  });

  it("la lista siempre trae a TODOS, compren o no", () => {
    expect(rankearClientes(cuentas, [])).toHaveLength(3);
  });

  it("las canceladas no cuentan como compra", () => {
    const r = rankearClientes(cuentas, [
      compra({ cliente_id: "a", status: "cancelada" }),
      compra({ cliente_id: "b" }),
    ]);
    expect(r[0].nombre).toBe("Bruno");
    expect(r.find((c) => c.id === "a")!.operaciones).toBe(0);
  });

  it("vincula por email cuando la operación no tiene cliente_id", () => {
    const r = rankearClientes(cuentas, [
      compra({ cliente_email: "ANA@x.com" }),
      compra({ cliente_email: "ana@X.com" }),
    ]);
    expect(r[0].nombre).toBe("Ana");
    expect(r[0].operaciones).toBe(2);
  });

  it("no mezcla monedas: un total por cada una", () => {
    // Sumar 500.000 pesos con 300 dólares daría un número que no es de ninguna
    // de las dos monedas.
    const r = rankearClientes(cuentas, [
      compra({ cliente_id: "a", monto: 500000, moneda: "ARS" }),
      compra({ cliente_id: "a", monto: 300, moneda: "USD" }),
    ]);
    const ana = r.find((c) => c.id === "a")!;
    expect(ana.operaciones).toBe(2);
    expect(ana.totales).toEqual([
      { moneda: "ARS", total: 500000 },
      { moneda: "USD", total: 300 },
    ]);
  });

  it("una operación de alguien que no está en la lista no rompe nada", () => {
    const r = rankearClientes(cuentas, [compra({ cliente_id: "fantasma" })]);
    expect(r).toHaveLength(3);
    expect(r.every((c) => c.operaciones === 0)).toBe(true);
  });
});

describe("fichasDeClientes", () => {
  const cuenta = (id: string, nombre: string, email: string) => ({
    id, nombre, email, solicitudId: `s-${id}`, revocada: false,
  });
  const op = (extra: Partial<import("./clientes").OpDeCliente>) => ({
    cliente_id: null, cliente_email: null, monto: 100, moneda: "USD", status: "esperando_entrada",
    created_at: "2026-10-01T00:00:00Z", cerrada_at: null, ...extra,
  });

  it("cuenta operaciones, abiertas, totales por moneda y la última", () => {
    const [ana] = fichasDeClientes(
      [cuenta("a", "Ana", "ana@x.com")],
      [
        op({ cliente_id: "a", monto: 100, created_at: "2026-10-01T00:00:00Z" }),
        op({ cliente_email: "ANA@x.com", monto: 50, cerrada_at: "x", created_at: "2026-10-03T00:00:00Z" }),
        op({ cliente_id: "a", moneda: "ARS", monto: 9000, created_at: "2026-10-02T00:00:00Z" }),
        op({ cliente_id: "a", status: "cancelada", monto: 999, created_at: "2026-10-05T00:00:00Z" }),
      ]
    );
    expect(ana).toMatchObject({ operaciones: 3, abiertas: 2, ultimoPedido: "2026-10-05T00:00:00Z" });
    expect(ana.totales).toEqual([
      { moneda: "ARS", total: 9000 },
      { moneda: "USD", total: 150 },
    ]);
  });

  it("orden: pidió más reciente arriba; sin pedidos al final por nombre", () => {
    const fichas = fichasDeClientes(
      [cuenta("z", "Zoe", "z@x"), cuenta("b", "Beto", "b@x"), cuenta("a", "Ana", "a@x"), cuenta("c", "Carla", "c@x")],
      [op({ cliente_id: "c", created_at: "2026-10-01T00:00:00Z" }), op({ cliente_id: "z", created_at: "2026-10-04T00:00:00Z" })]
    );
    expect(fichas.map((f) => f.nombre)).toEqual(["Zoe", "Carla", "Ana", "Beto"]);
    expect(fichas[2]).toMatchObject({ operaciones: 0, abiertas: 0, totales: [], ultimoPedido: null });
  });
});
