"use client";

// Una consulta dentro de la lista del panel.
//
// Las consultas ya no tienen sección propia: llegan mezcladas con las
// operaciones, que es donde el admin mira. Lo que las distingue es el signo de
// pregunta: significa "hay que chequear si hay stock y cerrar precio". Cuando
// se le carga el precio deja de ser consulta y pasa a ser una operación más de
// la misma lista.

import { useState } from "react";
import { formatMonto, type Consulta, type Moneda } from "@/lib/operaciones";
import { parsePrecio } from "@/lib/precios";

type Props = {
  consulta: Consulta;
  busy?: boolean;
  // Devuelve el mensaje de error si falló, o null si salió bien.
  onCargar: (
    c: Consulta,
    valores: { costo: number; comision: number; moneda: Moneda }
  ) => Promise<string | null>;
  onError: (msg: string) => void;
};

const inputCls =
  "h-9 w-full rounded-lg border border-line bg-white px-2.5 text-sm tabular-nums outline-none focus:border-brand";
const labelCls =
  "mb-1 block text-[10px] font-semibold uppercase tracking-wide text-muted";

function fechaCorta(fecha: string): string {
  const [, m, d] = fecha.split("-");
  const meses = ["ENE", "FEB", "MAR", "ABR", "MAY", "JUN", "JUL", "AGO", "SEP", "OCT", "NOV", "DIC"];
  return `${d} ${meses[Number(m) - 1] ?? ""}`;
}

export default function ConsultaCard({ consulta: c, busy = false, onCargar, onError }: Props) {
  const [open, setOpen] = useState(false);
  const [costo, setCosto] = useState("");
  const [comision, setComision] = useState("");
  const [moneda, setMoneda] = useState<Moneda>("USD");

  const cliente = c.comprador_alias ?? c.cliente_email ?? null;
  // Vista previa del total mientras escribe: es lo que se le va a cobrar.
  const previo = parsePrecio(costo, comision);
  const total = previo.ok ? previo.total : null;

  async function cargar() {
    const r = parsePrecio(costo, comision);
    if (!r.ok) {
      onError(r.error);
      return;
    }
    const err = await onCargar(c, { costo: r.costo, comision: r.comision, moneda });
    if (!err) {
      setCosto("");
      setComision("");
      setOpen(false);
    }
  }

  return (
    <article className="card-shadow overflow-hidden rounded-2xl bg-white ring-1 ring-[#B07A14]/25">
      <button
        onClick={() => setOpen(!open)}
        aria-expanded={open}
        className="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-canvas/40"
      >
        {/* El signo de pregunta ocupa el lugar del semáforo: la consulta no
            tiene hitos que semaforear, tiene una pregunta sin responder. */}
        <span
          className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[11px] font-bold text-white"
          style={{ background: "#B07A14" }}
          title="Consulta: chequear stock y cerrar precio"
          aria-label="Consulta: chequear stock y cerrar precio"
        >
          ?
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate font-display text-[15px] font-semibold leading-tight tracking-tight">
            {c.evento}
          </span>
          {cliente && (
            <span className="mt-0.5 block truncate text-[11px] font-medium text-[#4A4E5E]">
              {cliente}
            </span>
          )}
          <span className="mt-0.5 block truncate font-mono text-[10px] uppercase tracking-wider text-muted">
            {c.code} · Consulta — chequear stock
            {c.fecha_evento ? ` · ${fechaCorta(c.fecha_evento)}` : ""}
          </span>
        </span>
        <span className="shrink-0 rounded-full bg-[#B07A14]/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-[#B07A14]">
          A cotizar
        </span>
        <svg
          className={`h-4 w-4 shrink-0 text-muted transition-transform ${open ? "rotate-180" : ""}`}
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden
        >
          <path d="m6 9 6 6 6-6" />
        </svg>
      </button>

      {open && (
        <div className="border-t border-dashed border-[#C5C9D6] p-4">
          <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-[#6A6E7E]">
            <span>
              Sector <span className="font-medium text-body">{c.sector ?? "General"}</span>
            </span>
            {c.cantidad > 1 && (
              <span>
                Cantidad <span className="font-medium text-body">×{c.cantidad}</span>
              </span>
            )}
            {c.cliente_email && c.cliente_email !== c.comprador_alias && (
              <span className="break-all font-medium text-body">{c.cliente_email}</span>
            )}
          </div>

          {c.notas && (
            <p className="mt-3 whitespace-pre-wrap rounded-xl bg-canvas px-3 py-2.5 text-xs text-[#4A4E5E]">
              {c.notas}
            </p>
          )}

          {/* Precio = costo + comisión. Se cobra el total; el desglose es
              interno (la factura muestra solo el total). */}
          <div className="mt-4 grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls} htmlFor={`costo-${c.id}`}>
                Precio de costo
              </label>
              <div className="flex gap-2">
                <select
                  aria-label="Moneda"
                  className={`${inputCls} w-20 shrink-0`}
                  value={moneda}
                  onChange={(e) => setMoneda(e.target.value as Moneda)}
                >
                  <option value="USD">USD</option>
                  <option value="ARS">ARS</option>
                  <option value="EUR">EUR</option>
                </select>
                <input
                  id={`costo-${c.id}`}
                  type="number"
                  min={0}
                  step="0.01"
                  inputMode="decimal"
                  className={`${inputCls} font-mono`}
                  value={costo}
                  onChange={(e) => setCosto(e.target.value)}
                  placeholder="0"
                />
              </div>
            </div>
            <div>
              <label className={labelCls} htmlFor={`comision-${c.id}`}>
                Comisión
              </label>
              <input
                id={`comision-${c.id}`}
                type="number"
                min={0}
                step="0.01"
                inputMode="decimal"
                className={`${inputCls} font-mono`}
                value={comision}
                onChange={(e) => setComision(e.target.value)}
                placeholder="0"
              />
            </div>
          </div>

          <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
            <p className="text-xs text-muted">
              Total al cliente{" "}
              <span className="font-display text-sm font-bold tabular-nums text-body">
                {total != null ? formatMonto(total, moneda) : "—"}
              </span>
            </p>
            <button
              onClick={cargar}
              disabled={busy || total == null}
              className="rounded-xl bg-ink px-4 py-2 text-xs font-semibold text-white transition-colors hover:bg-ink/85 disabled:opacity-50"
            >
              {busy ? "Cargando…" : "Cargar operación"}
            </button>
          </div>
        </div>
      )}
    </article>
  );
}
