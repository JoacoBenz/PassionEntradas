"use client";

// Cola de consultas: entradas que el agente pidió sin precio cerrado. No son
// operaciones (una operación con monto 0 no significa nada), así que viven
// acá hasta que se les carga el precio acordado y recién ahí nacen como
// operación.

import { useState } from "react";
import Link from "next/link";
import { ESTADO_CONSULTA_LABEL, type Consulta } from "@/lib/operaciones";
import { ToastViewport, useToast } from "./Toast";

const btnPrimary =
  "inline-flex h-10 items-center justify-center rounded-xl bg-ink px-3.5 text-xs font-semibold text-white transition-colors hover:bg-ink/85 disabled:opacity-50 md:h-9";
const btnGhost =
  "inline-flex h-10 items-center justify-center rounded-xl border border-line px-3.5 text-xs font-semibold transition-colors hover:bg-canvas disabled:opacity-50 md:h-9";
const inputCls =
  "h-10 w-28 rounded-xl border border-line px-2.5 text-sm tabular-nums outline-none focus:border-ink md:h-9";

function fmtFecha(iso: string | null): string {
  if (!iso) return "—";
  const [y, m, d] = iso.slice(0, 10).split("-");
  return `${d}/${m}/${y}`;
}

export default function ConsultasPanel({ initial }: { initial: Consulta[] }) {
  const [consultas, setConsultas] = useState<Consulta[]>(initial);
  const [montos, setMontos] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<Record<string, boolean>>({});
  const { toasts, push: avisar } = useToast();

  const pendientes = consultas.filter((c) => c.estado === "pendiente");
  const resueltas = consultas.filter((c) => c.estado !== "pendiente");

  async function cargar(c: Consulta) {
    const monto = Math.round(Number(montos[c.id]));
    if (!Number.isFinite(monto) || monto <= 0) {
      avisar("error", "Ingresá el monto acordado.");
      return;
    }
    setBusy((b) => ({ ...b, [c.id]: true }));
    try {
      const res = await fetch(`/api/consultas/${c.id}/convertir`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ monto }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        avisar("error", data.error ?? "No se pudo cargar la operación.");
        return;
      }
      setConsultas((prev) =>
        prev.map((x) =>
          x.id === c.id
            ? { ...x, estado: "convertida", operacion_id: data.operacion?.id ?? null }
            : x
        )
      );
      avisar("success", `Operación ${data.operacion?.code ?? ""} creada.`);
    } catch {
      avisar("error", "Error de red. Reintentá.");
    } finally {
      setBusy((b) => ({ ...b, [c.id]: false }));
    }
  }

  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-5">
      <ToastViewport toasts={toasts} />

      <div className="mb-4">
        <h1 className="font-display text-lg font-bold">Consultas</h1>
        <p className="mt-0.5 text-xs text-muted">
          Entradas pedidas sin precio cerrado. Al cargarles el monto acordado se
          convierten en una operación.
        </p>
      </div>

      {pendientes.length === 0 && (
        <p className="rounded-xl border border-dashed border-line p-6 text-center text-sm text-muted">
          No hay consultas pendientes.
        </p>
      )}

      <div className="space-y-2.5">
        {pendientes.map((c) => (
          <div key={c.id} className="rounded-xl border border-line p-3.5">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold">{c.evento}</p>
                <p className="text-xs text-muted">
                  {c.sector ?? "General"}
                  {c.cantidad > 1 ? ` · ×${c.cantidad}` : ""}
                  {c.fecha_evento ? ` · ${fmtFecha(c.fecha_evento)}` : ""}
                </p>
                <p className="mt-0.5 break-all text-xs text-muted">
                  {c.comprador_alias}
                  {c.cliente_email ? ` · ${c.cliente_email}` : ""}
                </p>
              </div>
              <span className="shrink-0 font-mono text-[11px] text-muted">{c.code}</span>
            </div>

            <div className="mt-3 flex flex-wrap items-center gap-2">
              <label className="sr-only" htmlFor={`monto-${c.id}`}>
                Monto acordado
              </label>
              <input
                id={`monto-${c.id}`}
                className={inputCls}
                inputMode="numeric"
                placeholder="Monto"
                value={montos[c.id] ?? ""}
                onChange={(e) => setMontos((m) => ({ ...m, [c.id]: e.target.value }))}
              />
              <button
                className={btnPrimary}
                disabled={busy[c.id]}
                onClick={() => cargar(c)}
              >
                {busy[c.id] ? "Cargando…" : "Cargar operación"}
              </button>
            </div>
          </div>
        ))}
      </div>

      {resueltas.length > 0 && (
        <div className="mt-7">
          <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-muted">
            Resueltas ({resueltas.length})
          </p>
          <ul className="space-y-1.5">
            {resueltas.map((c) => (
              <li
                key={c.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-line px-3 py-2 text-xs"
              >
                <span className="min-w-0 truncate">
                  {c.evento}
                  <span className="text-muted"> · {c.sector ?? "General"}</span>
                </span>
                <span className="flex shrink-0 items-center gap-2 text-muted">
                  {ESTADO_CONSULTA_LABEL[c.estado]}
                  {c.operacion_id && (
                    <Link className={btnGhost} href={`/admin?op=${c.operacion_id}`}>
                      Ver operación
                    </Link>
                  )}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
