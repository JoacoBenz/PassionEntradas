import { describe, expect, it } from "vitest";
import { rankearClientes, type ClienteCuenta, type CompraDeCliente } from "./clientes";

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
