// Versión de "Mis pedidos" de un cliente: cambia solo si cambia algo que la
// página muestra. La página la consulta cada 20 s (AutoRefresh) y se vuelve a
// armar solo cuando cambió, en vez de re-renderizarse entera cada vez.
//
// Entra todo lo que mueve la pantalla: sus operaciones y consultas (cualquier
// cambio toca updated_at; las altas y bajas, la cantidad), sus facturas, los
// textos de pago y las cotizaciones que vencieron (vencer no escribe nada en la
// base, pero cambia lo que se ve).

type ConFecha = { updated_at: string | null };

export function versionMisPedidos(d: {
  ops: ConFecha[];
  consultas: (ConFecha & { estado: string; vence_at: string | null })[];
  facturas: number;
  textos: ConFecha[];
  ahora?: number;
}): string {
  const ahora = d.ahora ?? Date.now();
  const max = (xs: ConFecha[]) =>
    xs.reduce((m, x) => (x.updated_at && x.updated_at > m ? x.updated_at : m), "");
  const vencidas = d.consultas.filter(
    (c) => c.estado === "cotizada" && c.vence_at != null && Date.parse(c.vence_at) <= ahora
  ).length;
  return [
    `o${d.ops.length}:${max(d.ops)}`,
    `c${d.consultas.length}:${max(d.consultas)}:${vencidas}`,
    `f${d.facturas}`,
    `t${d.textos.length}:${max(d.textos)}`,
  ].join("|");
}
