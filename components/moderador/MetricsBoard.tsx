"use client";

import { useRef, useState } from "react";
import { formatUSD } from "@/lib/operaciones";
import type { Metrics } from "@/lib/metrics";

// Tablero del negocio en el módulo de carga: cuánta plata se movió (pagos
// confirmados), cuántas entradas se vendieron, la comisión ganada, y dos
// métricas operativas: exposición actual ("en juego") y ticket promedio.
// Filtrable por rango de fechas (cuándo se confirmó el pago); "en juego"
// es exposición ACTUAL y no depende del rango.

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

export default function MetricsBoard({ metrics: inicial }: { metrics: Metrics }) {
  const [metrics, setMetrics] = useState<Metrics>(inicial);
  const [desde, setDesde] = useState("");
  const [hasta, setHasta] = useState("");
  const [cargando, setCargando] = useState(false);
  const [filtrado, setFiltrado] = useState(false);
  // Descarta respuestas viejas si el usuario cambia el rango rápido.
  const pedido = useRef(0);

  async function aplicarRango(d: string, h: string) {
    const id = ++pedido.current;
    setCargando(true);
    try {
      const qs = new URLSearchParams();
      if (d) qs.set("desde", d);
      if (h) qs.set("hasta", h);
      const res = await fetch(`/api/metricas?${qs.toString()}`);
      if (!res.ok || id !== pedido.current) return;
      setMetrics((await res.json()) as Metrics);
      setFiltrado(!!(d || h));
    } catch {
      // sin red: el tablero se queda como estaba
    } finally {
      if (id === pedido.current) setCargando(false);
    }
  }

  const inputCls =
    "rounded-lg border border-line bg-white px-2 py-1 text-xs outline-none transition-colors focus:border-brand";

  return (
    <section aria-label="Resumen del negocio" className="mb-6">
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-xs font-medium uppercase tracking-widest text-muted">
          Resumen{filtrado ? " · rango elegido" : " · histórico"}
          {cargando ? "…" : ""}
        </h2>
        {/* Rango por fecha de pago confirmado */}
        <div className="flex flex-wrap items-center gap-1.5">
          <label className="text-[11px] text-muted" htmlFor="m-desde">
            Desde
          </label>
          <input
            id="m-desde"
            type="date"
            className={inputCls}
            value={desde}
            onChange={(e) => {
              setDesde(e.target.value);
              void aplicarRango(e.target.value, hasta);
            }}
          />
          <label className="text-[11px] text-muted" htmlFor="m-hasta">
            Hasta
          </label>
          <input
            id="m-hasta"
            type="date"
            className={inputCls}
            value={hasta}
            onChange={(e) => {
              setHasta(e.target.value);
              void aplicarRango(desde, e.target.value);
            }}
          />
          {filtrado && (
            <button
              onClick={() => {
                setDesde("");
                setHasta("");
                void aplicarRango("", "");
              }}
              className="rounded-lg border border-line bg-white px-2 py-1 text-[11px] font-medium text-[#4A4E5E] transition-colors hover:bg-canvas"
            >
              Todo
            </button>
          )}
        </div>
      </div>
      <div className="card-shadow overflow-hidden rounded-2xl bg-white">
        {/* Fila principal. En móvil la plata movida ocupa la fila entera
            (los montos en ARS no entran en tercios de 390px); comisión y
            ventas comparten la segunda. En md+ van las tres en línea. */}
        <div className="grid grid-cols-2 md:grid-cols-3">
          <Tile
            big
            label="Volumen operado"
            value={formatUSD(metrics.plataMovida)}
            detail="Total con pago confirmado"
            accent="#0D9377"
            className="col-span-2 border-b border-dashed border-line md:col-span-1 md:border-b-0 md:border-r"
          />
          <Tile
            big
            label="Comisiones acumuladas"
            value={formatUSD(metrics.comisionGanada)}
            detail="Sobre ventas confirmadas"
            accent="#6C5BF2"
            className="border-r border-dashed border-line"
          />
          <Tile
            big
            label="Ventas concretadas"
            value={String(metrics.entradasVendidas).padStart(2, "0")}
            detail="Operaciones cobradas"
            accent="#B07A14"
          />
        </div>
        <div className="perf-line-light" />
        {/* Fila secundaria: lo operativo */}
        <div className="grid grid-cols-2">
          <Tile
            label="Capital comprometido"
            value={formatUSD(metrics.enJuegoMonto)}
            detail={`En ${metrics.enJuegoOps} ${
              metrics.enJuegoOps === 1
                ? "operación en curso sin cobrar"
                : "operaciones en curso sin cobrar"
            }`}
            accent="#5F6577"
            className="border-r border-dashed border-line"
          />
          <Tile
            label="Valor promedio"
            value={formatUSD(metrics.ticketPromedio)}
            detail="Por operación concretada"
            accent="#5F6577"
          />
        </div>
      </div>
    </section>
  );
}
