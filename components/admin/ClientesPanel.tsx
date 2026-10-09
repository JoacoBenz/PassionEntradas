"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import ConfirmarBoton from "@/components/ConfirmarBoton";
import { fechaDia } from "@/lib/fechas";
import { formatMonto, type Moneda } from "@/lib/operaciones";
import type { FichaCliente } from "@/lib/clientes";

// Pantalla Clientes: cada cliente con lo que pidió. El moderador la ve (para
// saber a quién le carga); revocar/reactivar y el link al Panel son del admin.

const btnGhost =
  "rounded-lg border border-line px-3 py-1.5 text-xs font-semibold text-[#4A4E5E] transition-colors hover:bg-canvas disabled:opacity-50";
const btnWarn =
  "rounded-lg border border-amber-300 px-3 py-1.5 text-xs font-semibold text-amber-700 transition-colors hover:bg-amber-50 disabled:opacity-50";

export default function ClientesPanel({ fichas, esAdmin }: { fichas: FichaCliente[]; esAdmin: boolean }) {
  const router = useRouter();
  const [q, setQ] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [aviso, setAviso] = useState<{ tipo: "ok" | "error"; msg: string } | null>(null);

  const visibles = useMemo(() => {
    const t = q.trim().toLowerCase();
    if (!t) return fichas;
    return fichas.filter((f) => f.nombre.toLowerCase().includes(t) || f.email.toLowerCase().includes(t));
  }, [fichas, q]);

  function avisar(tipo: "ok" | "error", msg: string) {
    setAviso({ tipo, msg });
    window.setTimeout(() => setAviso(null), 4500);
  }

  // Mismo endpoint que Accesos: el acceso del cliente vive en su solicitud.
  async function revocar(f: FichaCliente, accion: "revocar" | "reactivar") {
    if (busy) return;
    setBusy(f.id);
    try {
      const res = await fetch(`/api/acceso/${f.solicitudId}/revocar`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ accion }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        avisar("error", typeof data.error === "string" ? data.error : "No se pudo cambiar el acceso");
        return;
      }
      avisar("ok", accion === "revocar" ? `${f.nombre} ya no puede entrar.` : `${f.nombre} puede volver a entrar.`);
      router.refresh();
    } catch {
      avisar("error", "Error de red");
    } finally {
      setBusy(null);
    }
  }

  const conAbiertas = fichas.filter((f) => f.abiertas > 0).length;

  return (
    <section className="card-shadow overflow-hidden rounded-2xl">
      <div className="surface-ink punch-b px-5 py-4 text-white">
        <p className="text-[10px] font-medium uppercase tracking-[0.25em] text-white/50">
          {fichas.length} {fichas.length === 1 ? "cliente" : "clientes"} · {conAbiertas} con pedidos abiertos
        </p>
        <h2 className="mt-0.5 font-display text-lg font-bold tracking-tight">Clientes</h2>
      </div>
      <div className="punch-t bg-white">
        <div className="perf-line-light mx-5" />
        <div className="space-y-3 p-5">
          {aviso && (
            <p
              className={`rounded-lg px-3 py-2 text-sm font-medium ${
                aviso.tipo === "ok" ? "bg-emerald-50 text-emerald-800" : "bg-red-50 text-red-700"
              }`}
              role="status"
            >
              {aviso.msg}
            </p>
          )}
          <input
            type="search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Buscar por nombre o email…"
            aria-label="Buscar clientes"
            className="w-full rounded-xl border border-line bg-white px-3.5 py-2 text-sm shadow-sm outline-none placeholder:text-muted focus:border-brand focus:ring-2 focus:ring-brand/15"
          />
          {visibles.length === 0 ? (
            <p className="rounded-xl bg-canvas px-3 py-6 text-center text-sm text-muted">
              {fichas.length === 0 ? "Todavía no hay clientes aprobados." : "Nadie con ese nombre o email."}
            </p>
          ) : (
            <ul className="space-y-2">
              {visibles.map((f) => (
                <li key={f.id} className={`rounded-xl border border-line p-3.5 ${f.revocada ? "bg-canvas/60" : ""}`}>
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-sm font-semibold">{f.nombre}</p>
                      <p className="break-all text-xs text-muted">{f.email}</p>
                    </div>
                    <div className="flex flex-wrap items-center gap-1.5">
                      {f.abiertas > 0 && (
                        <span className="rounded-full bg-blue-100 px-2.5 py-0.5 text-[11px] font-semibold text-blue-800">
                          {f.abiertas} {f.abiertas === 1 ? "abierta" : "abiertas"}
                        </span>
                      )}
                      {f.revocada && (
                        <span className="rounded-full bg-amber-100 px-2.5 py-0.5 text-[11px] font-semibold text-amber-800">
                          Acceso revocado
                        </span>
                      )}
                    </div>
                  </div>
                  <dl className="mt-2 grid grid-cols-3 gap-2 text-xs [&_dt]:[overflow-wrap:anywhere] [&_dd]:[overflow-wrap:anywhere]">
                    <div>
                      <dt className="font-mono text-[9px] font-bold uppercase tracking-[0.14em] text-muted">Pedidos</dt>
                      <dd className="font-semibold tabular-nums">{f.operaciones}</dd>
                    </div>
                    <div>
                      <dt className="font-mono text-[9px] font-bold uppercase tracking-[0.14em] text-muted">Total</dt>
                      <dd className="font-semibold tabular-nums">
                        {f.totales.length === 0
                          ? "—"
                          : f.totales.map((t) => formatMonto(t.total, t.moneda as Moneda, { sinDecimales: true })).join(" + ")}
                      </dd>
                    </div>
                    <div>
                      <dt className="font-mono text-[9px] font-bold uppercase tracking-[0.14em] text-muted">Último pedido</dt>
                      <dd className="font-semibold">{f.ultimoPedido ? fechaDia(f.ultimoPedido) : "Nunca"}</dd>
                    </div>
                  </dl>
                  {esAdmin && (
                    <div className="mt-3 flex flex-wrap gap-2">
                      {f.ultimoPedido && (
                        <Link href={`/admin?q=${encodeURIComponent(f.email)}`} className={btnGhost}>
                          Ver sus pedidos
                        </Link>
                      )}
                      {f.revocada ? (
                        <ConfirmarBoton
                          onConfirm={() => revocar(f, "reactivar")}
                          disabled={busy !== null}
                          className={btnGhost}
                          pregunta="¿Reactivar el acceso?"
                          si="Sí, reactivar"
                          siClassName="rounded-lg bg-brand px-3 py-1.5 text-xs font-semibold text-white"
                          noClassName={btnGhost}
                          preguntaClassName="text-xs font-semibold text-ink"
                        >
                          {busy === f.id ? "…" : "Reactivar"}
                        </ConfirmarBoton>
                      ) : (
                        <ConfirmarBoton
                          onConfirm={() => revocar(f, "revocar")}
                          disabled={busy !== null}
                          className={btnWarn}
                          title="El cliente deja de poder entrar hasta que lo reactives"
                          pregunta="Deja de poder entrar. ¿Seguro?"
                          si="Sí, revocar"
                          siClassName="rounded-lg bg-amber-600 px-3 py-1.5 text-xs font-semibold text-white"
                          noClassName={btnGhost}
                          preguntaClassName="text-xs font-semibold text-ink"
                        >
                          {busy === f.id ? "…" : "Revocar"}
                        </ConfirmarBoton>
                      )}
                    </div>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </section>
  );
}
