// Ranking de compradores para el desplegable de "nueva operación".
//
// El admin cargaba el comprador escribiéndolo a mano, así que el mismo cliente
// terminaba como "Juan Perez", "juan perez" y "Juan P." según quién cargara.
// Con la lista cerrada eso no pasa, y de paso los que más compran quedan
// arriba, que es a quienes más se les carga.

export type ClienteCuenta = {
  id: string;
  nombre: string;
  email: string;
};

export type CompraDeCliente = {
  cliente_id: string | null;
  cliente_email: string | null;
  monto: number;
  moneda: string;
  // Las canceladas no cuentan como compra.
  status: string;
};

export type ClienteRankeado = ClienteCuenta & {
  /** Operaciones no canceladas que originó. */
  operaciones: number;
  /** Total por moneda, porque sumar pesos con dólares no significa nada. */
  totales: { moneda: string; total: number }[];
};

// Orden: primero los que más compraron (cantidad de operaciones), y entre
// iguales el que más plata movió. Los que nunca compraron van al final por
// nombre, para que el desplegable siga siendo una lista completa y ordenada.
//
// Se rankea por CANTIDAD y no por plata porque el total no es comparable entre
// monedas; el monto sólo desempata, y ahí ya se está comparando gente con la
// misma cantidad de operaciones.
export function rankearClientes(
  cuentas: ClienteCuenta[],
  compras: CompraDeCliente[]
): ClienteRankeado[] {
  const porId = new Map<string, { n: number; totales: Map<string, number> }>();
  const idPorEmail = new Map<string, string>();
  for (const c of cuentas) {
    if (c.email) idPorEmail.set(c.email.toLowerCase(), c.id);
  }

  for (const op of compras) {
    if (op.status === "cancelada") continue;
    // Por id, o por email cuando la operación se cargó a mano sin vincular.
    const id =
      op.cliente_id ??
      (op.cliente_email ? idPorEmail.get(op.cliente_email.toLowerCase()) : undefined);
    if (!id) continue;
    let acc = porId.get(id);
    if (!acc) {
      acc = { n: 0, totales: new Map() };
      porId.set(id, acc);
    }
    acc.n += 1;
    const moneda = op.moneda || "USD";
    acc.totales.set(moneda, (acc.totales.get(moneda) ?? 0) + Number(op.monto || 0));
  }

  const conRanking: ClienteRankeado[] = cuentas.map((c) => {
    const acc = porId.get(c.id);
    return {
      ...c,
      operaciones: acc?.n ?? 0,
      totales: acc
        ? Array.from(acc.totales.entries())
            .map(([moneda, total]) => ({ moneda, total }))
            .sort((a, b) => b.total - a.total)
        : [],
    };
  });

  const mayorTotal = (c: ClienteRankeado) =>
    c.totales.reduce((max, t) => Math.max(max, t.total), 0);

  return conRanking.sort((a, b) => {
    if (b.operaciones !== a.operaciones) return b.operaciones - a.operaciones;
    const d = mayorTotal(b) - mayorTotal(a);
    if (d !== 0) return d;
    return a.nombre.localeCompare(b.nombre, "es");
  });
}

// ---- Pantalla Clientes -----------------------------------------------------
// Cada cliente con lo que pidió: cuántas operaciones, cuántas siguen
// abiertas, el total por moneda y cuándo fue la última. Mismo criterio de
// vinculación que el ranking (por id, o por email si se cargó a mano).

export type CuentaCliente = ClienteCuenta & {
  // La solicitud de acceso que le dio la cuenta: con ella se revoca/reactiva.
  solicitudId: string;
  revocada: boolean;
};

export type OpDeCliente = CompraDeCliente & {
  created_at: string;
  cerrada_at: string | null;
};

export type FichaCliente = CuentaCliente & {
  operaciones: number; // no canceladas
  abiertas: number; // ni canceladas ni entregadas
  totales: { moneda: string; total: number }[];
  ultimoPedido: string | null;
};

export function fichasDeClientes(cuentas: CuentaCliente[], ops: OpDeCliente[]): FichaCliente[] {
  const idPorEmail = new Map<string, string>();
  for (const c of cuentas) if (c.email) idPorEmail.set(c.email.toLowerCase(), c.id);

  type Acc = { n: number; abiertas: number; totales: Map<string, number>; ultimo: string | null };
  const porId = new Map<string, Acc>();
  for (const op of ops) {
    const id =
      op.cliente_id ?? (op.cliente_email ? idPorEmail.get(op.cliente_email.toLowerCase()) : undefined);
    if (!id) continue;
    let a = porId.get(id);
    if (!a) {
      a = { n: 0, abiertas: 0, totales: new Map(), ultimo: null };
      porId.set(id, a);
    }
    // La última vez que pidió algo cuenta aunque después lo haya cancelado.
    if (!a.ultimo || op.created_at > a.ultimo) a.ultimo = op.created_at;
    if (op.status === "cancelada") continue;
    a.n += 1;
    if (!op.cerrada_at) a.abiertas += 1;
    const moneda = op.moneda || "USD";
    a.totales.set(moneda, (a.totales.get(moneda) ?? 0) + Number(op.monto || 0));
  }

  return cuentas
    .map((c) => {
      const a = porId.get(c.id);
      return {
        ...c,
        operaciones: a?.n ?? 0,
        abiertas: a?.abiertas ?? 0,
        totales: a
          ? Array.from(a.totales.entries())
              .map(([moneda, total]) => ({ moneda, total }))
              .sort((x, y) => y.total - x.total)
          : [],
        ultimoPedido: a?.ultimo ?? null,
      };
    })
    .sort((a, b) => {
      // Los que pidieron más recientemente arriba; los que nunca pidieron, al
      // final por nombre.
      if (a.ultimoPedido && b.ultimoPedido) return b.ultimoPedido.localeCompare(a.ultimoPedido);
      if (a.ultimoPedido) return -1;
      if (b.ultimoPedido) return 1;
      return a.nombre.localeCompare(b.nombre, "es");
    });
}
