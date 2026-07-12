"use client";

import { useMemo, useState } from "react";
import { estadoDe, ESTADO_LABEL, ESTADO_COLOR, formatARS, formatFecha } from "@/lib/operaciones";
import {
  SOLICITUD_COLOR,
  SOLICITUD_LABEL,
  type SolicitudConPublicacion,
  type SolicitudEstado,
} from "@/lib/comunidad";

type Props = { initial: SolicitudConPublicacion[] };

const FILTROS: { key: SolicitudEstado | "todas"; label: string }[] = [
  { key: "todas", label: "Todas" },
  { key: "pendiente", label: "Pendientes" },
  { key: "en_proceso", label: "En operación" },
  { key: "concretada", label: "Concretadas" },
  { key: "rechazada", label: "Rechazadas" },
];

// Bandeja de solicitudes del mercado. "Iniciar custodia" crea la operación
// con comprador, vendedor y monto ya cargados; de ahí en más el flujo es el
// de siempre: entrada -> pago -> entrega, con su link público.
export default function SolicitudesBandeja({ initial }: Props) {
  const [items, setItems] = useState(initial);
  const [filtro, setFiltro] = useState<SolicitudEstado | "todas">("todas");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [aviso, setAviso] = useState<{ tipo: "ok" | "error"; msg: string } | null>(null);
  const [copiado, setCopiado] = useState<string | null>(null);

  function avisar(tipo: "ok" | "error", msg: string) {
    setAviso({ tipo, msg });
    setTimeout(() => setAviso(null), 4000);
  }

  async function accion(
    sol: SolicitudConPublicacion,
    accion: "iniciar" | "rechazar" | "concretar",
    okMsg: string
  ) {
    setBusyId(sol.id);
    try {
      const res = await fetch(`/api/solicitudes/${sol.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ accion }),
      });
      const data = await res.json();
      if (!res.ok) {
        avisar("error", data.error ?? "No se pudo aplicar la acción");
        return;
      }
      setItems((prev) =>
        prev.map((s) =>
          s.id === sol.id
            ? {
                ...s,
                ...data.solicitud,
                publicacion: {
                  ...s.publicacion,
                  estado:
                    accion === "iniciar"
                      ? "en_proceso"
                      : accion === "concretar"
                        ? "vendida"
                        : s.estado === "en_proceso"
                          ? "activa"
                          : s.publicacion.estado,
                },
              }
            : s
        )
      );
      avisar("ok", okMsg);
    } catch {
      avisar("error", "Error de red");
    } finally {
      setBusyId(null);
    }
  }

  async function copiarLink(operacionId: string) {
    const url = `${window.location.origin}/op/${operacionId}`;
    try {
      await navigator.clipboard.writeText(url);
      setCopiado(operacionId);
      setTimeout(() => setCopiado(null), 2000);
    } catch {
      avisar("error", "No se pudo copiar el link");
    }
  }

  const visibles = useMemo(
    () => (filtro === "todas" ? items : items.filter((s) => s.estado === filtro)),
    [items, filtro]
  );

  const pendientes = items.filter((s) => s.estado === "pendiente").length;

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-6">
      <div className="card-shadow mb-5 rounded-2xl bg-white px-4 py-3 text-sm text-[#4A4E5E]">
        <span className="font-semibold text-ink">
          {pendientes === 0
            ? "Sin solicitudes pendientes."
            : pendientes === 1
              ? "1 solicitud esperando tu revisión."
              : `${pendientes} solicitudes esperando tu revisión.`}
        </span>{" "}
        Al iniciar la custodia se crea la operación con los datos de la
        publicación y arranca el flujo de siempre.
      </div>

      {aviso && (
        <div
          className={`mb-4 rounded-xl px-4 py-3 text-sm font-medium ${
            aviso.tipo === "ok" ? "bg-emerald-50 text-emerald-800" : "bg-red-50 text-red-700"
          }`}
          role="status"
        >
          {aviso.msg}
        </div>
      )}

      <div className="mb-4 flex gap-1.5 overflow-x-auto pb-1">
        {FILTROS.map((f) => (
          <button
            key={f.key}
            onClick={() => setFiltro(f.key)}
            className={`whitespace-nowrap rounded-full px-3.5 py-1.5 text-xs font-semibold transition-colors ${
              filtro === f.key
                ? "bg-ink text-white"
                : "bg-white text-[#4A4E5E] shadow-sm hover:bg-white/70"
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {visibles.length === 0 ? (
        <p className="card-shadow rounded-2xl bg-white px-4 py-10 text-center text-sm text-muted">
          Nada por acá.
        </p>
      ) : (
        <ul className="space-y-3">
          {visibles.map((sol) => {
            const color = SOLICITUD_COLOR[sol.estado];
            const busy = busyId === sol.id;
            return (
              <li key={sol.id} className="card-shadow overflow-hidden rounded-2xl bg-white">
                <div className="border-l-4 p-4" style={{ borderColor: color }}>
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="min-w-0">
                      <h3 className="font-display text-lg font-bold leading-tight tracking-tight">
                        {sol.publicacion.evento}
                      </h3>
                      <p className="mt-0.5 text-sm text-muted">
                        {sol.publicacion.fecha_evento
                          ? formatFecha(sol.publicacion.fecha_evento)
                          : "Fecha a confirmar"}
                        {" · "}
                        {sol.publicacion.cantidad}{" "}
                        {sol.publicacion.cantidad === 1 ? "entrada" : "entradas"}
                      </p>
                    </div>
                    <span
                      className="whitespace-nowrap rounded-full px-2.5 py-1 text-[11px] font-semibold"
                      style={{ backgroundColor: `${color}1a`, color }}
                    >
                      {SOLICITUD_LABEL[sol.estado]}
                    </span>
                  </div>

                  <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 text-sm sm:grid-cols-3">
                    <div>
                      <dt className="text-xs font-medium uppercase tracking-wide text-muted">
                        Comprador
                      </dt>
                      <dd className="font-mono">{sol.comprador_alias}</dd>
                    </div>
                    <div>
                      <dt className="text-xs font-medium uppercase tracking-wide text-muted">
                        Vendedor
                      </dt>
                      <dd className="font-mono">{sol.publicacion.vendedor_alias}</dd>
                    </div>
                    <div>
                      <dt className="text-xs font-medium uppercase tracking-wide text-muted">
                        Monto
                      </dt>
                      <dd className="font-display font-bold tabular-nums">
                        {formatARS(sol.publicacion.precio)}
                      </dd>
                    </div>
                  </dl>

                  {sol.estado === "en_proceso" && sol.operacion && (() => {
                    const est = estadoDe(sol.operacion);
                    const cerro = est === "cerrada";
                    return (
                      <p
                        className="mt-2 flex flex-wrap items-center gap-2 rounded-lg px-3 py-2 text-sm"
                        style={{ backgroundColor: `${ESTADO_COLOR[est]}14` }}
                      >
                        <span className="text-xs font-semibold uppercase tracking-wide text-muted">
                          Custodia:
                        </span>
                        <span className="font-semibold" style={{ color: ESTADO_COLOR[est] }}>
                          {ESTADO_LABEL[est]}
                        </span>
                        {cerro && (
                          <span className="text-[#4A4E5E]">
                            — la operación terminó, concretá la venta acá abajo.
                          </span>
                        )}
                      </p>
                    );
                  })()}

                  {sol.mensaje && (
                    <p className="mt-2 rounded-lg bg-canvas px-3 py-2 text-sm text-[#4A4E5E]">
                      <span className="mr-1 text-xs font-semibold uppercase tracking-wide text-muted">
                        Mensaje:
                      </span>
                      {sol.mensaje}
                    </p>
                  )}

                  <div className="mt-3 flex flex-wrap gap-2">
                    {sol.estado === "pendiente" && (
                      <>
                        {sol.publicacion.estado === "activa" ? (
                          <button
                            onClick={() =>
                              accion(sol, "iniciar", "Operación de custodia creada")
                            }
                            disabled={busy}
                            className="rounded-xl bg-brand px-4 py-2 text-xs font-semibold text-white transition-colors hover:bg-brand-deep disabled:opacity-60"
                          >
                            Iniciar custodia
                          </button>
                        ) : (
                          <span className="rounded-lg bg-canvas px-3 py-2 text-xs text-muted">
                            La publicación ya no está activa: solo se puede rechazar.
                          </span>
                        )}
                        <button
                          onClick={() => accion(sol, "rechazar", "Solicitud rechazada")}
                          disabled={busy}
                          className="rounded-xl border border-red-200 px-4 py-2 text-xs font-semibold text-red-600 transition-colors hover:bg-red-50 disabled:opacity-60"
                        >
                          Rechazar
                        </button>
                      </>
                    )}
                    {sol.estado === "en_proceso" && (
                      <>
                        {sol.operacion_id && (
                          <button
                            onClick={() => copiarLink(sol.operacion_id!)}
                            className="rounded-xl border border-line px-4 py-2 text-xs font-semibold text-[#4A4E5E] transition-colors hover:bg-canvas"
                          >
                            {copiado === sol.operacion_id ? "¡Copiado!" : "Copiar link de la operación"}
                          </button>
                        )}
                        <button
                          onClick={() =>
                            accion(sol, "concretar", "Venta concretada — publicación vendida")
                          }
                          disabled={busy}
                          className="rounded-xl bg-[#0D9377] px-4 py-2 text-xs font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-60"
                        >
                          ✓ Concretar venta
                        </button>
                        <button
                          onClick={() =>
                            accion(
                              sol,
                              "rechazar",
                              "Custodia cancelada — la publicación volvió al feed"
                            )
                          }
                          disabled={busy}
                          className="rounded-xl border border-red-200 px-4 py-2 text-xs font-semibold text-red-600 transition-colors hover:bg-red-50 disabled:opacity-60"
                        >
                          Cancelar custodia
                        </button>
                      </>
                    )}
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
