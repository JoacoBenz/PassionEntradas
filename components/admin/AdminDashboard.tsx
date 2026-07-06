"use client";

import { useMemo, useState } from "react";
import { nextStatus, type Operacion, type Status } from "@/lib/operaciones";
import OperacionCard from "./OperacionCard";
import { ToastViewport, useToast } from "./Toast";

type Props = {
  initial: Operacion[];
  baseUrl: string;
};

type Filter = "todas" | "en_curso" | "confirmadas" | "canceladas";

const FILTERS: { key: Filter; label: string }[] = [
  { key: "todas", label: "Todas" },
  { key: "en_curso", label: "En curso" },
  { key: "confirmadas", label: "Confirmadas" },
  { key: "canceladas", label: "Canceladas" },
];

function matches(op: Operacion, filter: Filter): boolean {
  switch (filter) {
    case "todas":
      return true;
    case "en_curso":
      return op.status === "esperando_entrada" || op.status === "entrada_recibida";
    case "confirmadas":
      return op.status === "confirmada";
    case "canceladas":
      return op.status === "cancelada";
  }
}

// Módulo del administrador: chequea la lista y actualiza estados.
// La carga de operaciones nuevas vive en el módulo /moderador.
export default function AdminDashboard({ initial, baseUrl }: Props) {
  const [ops, setOps] = useState<Operacion[]>(initial);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [filter, setFilter] = useState<Filter>("todas");
  const { toasts, push } = useToast();

  const stats = useMemo(() => {
    const enCurso = ops.filter(
      (o) => o.status === "esperando_entrada" || o.status === "entrada_recibida"
    ).length;
    const confirmadas = ops.filter((o) => o.status === "confirmada").length;
    return { enCurso, confirmadas, total: ops.length };
  }, [ops]);

  const visible = useMemo(
    () => ops.filter((o) => matches(o, filter)),
    [ops, filter]
  );

  function replaceOp(id: string, status: Status) {
    setOps((prev) => prev.map((o) => (o.id === id ? { ...o, status } : o)));
  }

  async function changeStatus(op: Operacion, to: Status, okMsg: string) {
    setBusyId(op.id);
    try {
      const res = await fetch(`/api/operaciones/${op.id}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: to }),
      });
      const data = await res.json();
      if (!res.ok) {
        push("error", data.error ?? "No se pudo actualizar el estado");
        return;
      }
      replaceOp(op.id, data.status as Status);
      push("success", okMsg);
    } catch {
      push("error", "Error de red al actualizar");
    } finally {
      setBusyId(null);
    }
  }

  function onAdvance(op: Operacion) {
    const to = nextStatus(op.status);
    if (!to) return;
    const msg =
      to === "entrada_recibida" ? "Entrada recibida" : "Pago confirmado";
    changeStatus(op, to, msg);
  }

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-6">
      {/* Mini stats: tira única estilo talón, dividida por líneas punteadas */}
      <section className="card-shadow mb-5 overflow-hidden rounded-2xl bg-white">
        <div className="grid grid-cols-3 divide-x divide-dashed divide-line">
          <Stat label="En curso" value={stats.enCurso} accent="#B07A14" />
          <Stat label="Confirmadas" value={stats.confirmadas} accent="#0D9377" />
          <Stat label="Totales" value={stats.total} accent="#6C5BF2" />
        </div>
      </section>

      {/* Filtros por estado */}
      <div
        role="tablist"
        aria-label="Filtrar operaciones"
        className="mb-5 inline-flex w-full gap-1 overflow-x-auto rounded-xl border border-line bg-white p-1 shadow-sm sm:w-auto"
      >
        {FILTERS.map((f) => {
          const active = filter === f.key;
          return (
            <button
              key={f.key}
              role="tab"
              aria-selected={active}
              onClick={() => setFilter(f.key)}
              className={`whitespace-nowrap rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors ${
                active
                  ? "bg-ink text-white"
                  : "text-[#4A4E5E] hover:bg-canvas"
              }`}
            >
              {f.label}
            </button>
          );
        })}
      </div>

      <div className="space-y-3">
        {visible.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-[#C5C9D6] bg-white/50 px-4 py-10 text-center text-sm text-muted">
            {ops.length === 0
              ? "Todavía no hay operaciones. Se cargan desde el módulo de carga."
              : "No hay operaciones con este filtro."}
          </div>
        ) : (
          visible.map((op) => (
            <OperacionCard
              key={op.id}
              op={op}
              baseUrl={baseUrl}
              busy={busyId === op.id}
              onAdvance={onAdvance}
              onCancel={(o) => changeStatus(o, "cancelada", "Operación cancelada")}
              onReopen={(o) =>
                changeStatus(o, "esperando_entrada", "Operación reabierta")
              }
              onCopied={(m) => push("success", m)}
            />
          ))
        )}
      </div>

      <ToastViewport toasts={toasts} />
    </div>
  );
}

function Stat({
  label,
  value,
  accent,
}: {
  label: string;
  value: number;
  accent: string;
}) {
  return (
    <div className="px-4 py-4 text-center sm:text-left">
      <p className="text-[11px] font-medium uppercase tracking-widest text-muted">
        {label}
      </p>
      <p
        className="mt-0.5 font-display text-3xl font-bold tabular-nums tracking-tight"
        style={{ color: accent }}
      >
        {String(value).padStart(2, "0")}
      </p>
    </div>
  );
}
