import { formatARS } from "@/lib/operaciones";
import type { Metrics } from "@/lib/metrics";

// Tablero del negocio en el módulo de carga: cuánta plata se movió (pagos
// confirmados), cuántas entradas se vendieron, la comisión ganada, y dos
// métricas operativas: exposición actual ("en juego") y ticket promedio.

function Tile({
  label,
  value,
  detail,
  accent,
  big = false,
  className = "",
}: {
  label: string;
  value: string;
  detail?: string;
  accent: string;
  big?: boolean;
  className?: string;
}) {
  return (
    <div className={`min-w-0 px-4 py-3.5 ${className}`}>
      <p className="text-[10px] font-medium uppercase leading-snug tracking-[0.14em] text-muted">
        {label}
      </p>
      <p
        className={`mt-0.5 truncate font-display font-bold tabular-nums tracking-tight ${
          big ? "text-2xl" : "text-lg"
        }`}
        style={{ color: accent }}
        title={value}
      >
        {value}
      </p>
      {detail && <p className="text-[11px] leading-snug text-muted">{detail}</p>}
    </div>
  );
}

export default function MetricsBoard({ metrics }: { metrics: Metrics }) {
  return (
    <section aria-label="Resumen del negocio" className="mb-6">
      <h2 className="mb-2 text-xs font-medium uppercase tracking-widest text-muted">
        Resumen
      </h2>
      <div className="card-shadow overflow-hidden rounded-2xl bg-white">
        {/* Fila principal. En móvil la plata movida ocupa la fila entera
            (los montos en ARS no entran en tercios de 390px); comisión y
            ventas comparten la segunda. En md+ van las tres en línea. */}
        <div className="grid grid-cols-2 md:grid-cols-3">
          <Tile
            big
            label="Volumen operado"
            value={formatARS(metrics.plataMovida)}
            detail="total con pago confirmado"
            accent="#0D9377"
            className="col-span-2 border-b border-dashed border-line md:col-span-1 md:border-b-0 md:border-r"
          />
          <Tile
            big
            label="Comisiones acumuladas"
            value={formatARS(metrics.comisionGanada)}
            detail="sobre ventas confirmadas"
            accent="#6C5BF2"
            className="border-r border-dashed border-line"
          />
          <Tile
            big
            label="Ventas concretadas"
            value={String(metrics.entradasVendidas).padStart(2, "0")}
            detail="operaciones cobradas"
            accent="#B07A14"
          />
        </div>
        <div className="perf-line-light" />
        {/* Fila secundaria: lo operativo */}
        <div className="grid grid-cols-2">
          <Tile
            label="Capital comprometido"
            value={formatARS(metrics.enJuegoMonto)}
            detail={`en ${metrics.enJuegoOps} ${
              metrics.enJuegoOps === 1
                ? "operación en curso sin cobrar"
                : "operaciones en curso sin cobrar"
            }`}
            accent="#5F6577"
            className="border-r border-dashed border-line"
          />
          <Tile
            label="Valor promedio"
            value={formatARS(metrics.ticketPromedio)}
            detail="por operación concretada"
            accent="#5F6577"
          />
        </div>
      </div>
    </section>
  );
}
