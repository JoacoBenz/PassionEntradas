"use client";

import { useEffect, useMemo, useState } from "react";
import {
  diasHastaEvento,
  estadoDe,
  type Operacion,
  type StatusAction,
} from "@/lib/operaciones";
import OperacionCard from "./OperacionCard";
import { ToastViewport, useToast } from "./Toast";

type Props = {
  initial: Operacion[];
  baseUrl: string;
};

type Filter = "todas" | "en_curso" | "para_cerrar" | "cerradas" | "canceladas";

const FILTERS: { key: Filter; label: string }[] = [
  { key: "todas", label: "Todas" },
  { key: "en_curso", label: "En curso" },
  { key: "para_cerrar", label: "Para entregar" },
  { key: "cerradas", label: "Entregadas" },
  { key: "canceladas", label: "Canceladas" },
];

function matches(op: Operacion, filter: Filter): boolean {
  const estado = estadoDe(op);
  switch (filter) {
    case "todas":
      return true;
    case "en_curso":
      return (
        estado !== "cerrada" &&
        estado !== "cancelada" &&
        estado !== "lista_para_cerrar"
      );
    case "para_cerrar":
      return estado === "lista_para_cerrar";
    case "cerradas":
      return estado === "cerrada";
    case "canceladas":
      return estado === "cancelada";
  }
}

// Módulo del administrador: chequea la lista y actualiza estados.
// La carga de operaciones nuevas vive en el módulo /moderador.
export default function AdminDashboard({ initial, baseUrl }: Props) {
  const [ops, setOps] = useState<Operacion[]>(initial);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [filter, setFilter] = useState<Filter>("todas");
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<"recientes" | "urgentes">("recientes");
  const [page, setPage] = useState(1);
  const { toasts, push } = useToast();

  // Cambiar filtro, búsqueda u orden vuelve a la primera página.
  useEffect(() => {
    setPage(1);
  }, [filter, query, sort]);

  // Lista viva: cuando AutoRefresh refresca el server component, `initial`
  // llega con datos nuevos (operaciones cargadas por el moderador, cambios
  // de otro admin) y sincronizamos el estado local.
  useEffect(() => {
    setOps(initial);
  }, [initial]);

  const stats = useMemo(() => {
    const estados = ops.map(estadoDe);
    const enCurso = estados.filter(
      (e) => e !== "cerrada" && e !== "cancelada" && e !== "lista_para_cerrar"
    ).length;
    const paraCerrar = estados.filter((e) => e === "lista_para_cerrar").length;
    const cerradas = estados.filter((e) => e === "cerrada").length;
    return { enCurso, paraCerrar, cerradas };
  }, [ops]);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    let out = ops.filter(
      (o) =>
        matches(o, filter) &&
        (!q ||
          o.evento.toLowerCase().includes(q) ||
          o.code.toLowerCase().includes(q) ||
          (o.comprador_alias ?? "").toLowerCase().includes(q) ||
          (o.vendedor_alias ?? "").toLowerCase().includes(q))
    );
    if (sort === "urgentes") {
      // Fecha de evento más próxima primero; sin fecha al final.
      out = [...out].sort((a, b) => {
        const da = diasHastaEvento(a.fecha_evento);
        const db = diasHastaEvento(b.fecha_evento);
        if (da == null && db == null) return b.created_at.localeCompare(a.created_at);
        if (da == null) return 1;
        if (db == null) return -1;
        return da - db;
      });
    }
    return out;
  }, [ops, filter, query, sort]);

  // Paginado en el cliente: con historial grande, renderizar cientos de
  // cards de una sola vez es lo que pesa (el fetch ya viene topado en 1000).
  const PAGE_SIZE = 15;
  const totalPages = Math.max(1, Math.ceil(visible.length / PAGE_SIZE));
  const pagina = Math.min(page, totalPages);
  const enPagina = visible.slice((pagina - 1) * PAGE_SIZE, pagina * PAGE_SIZE);

  function irAPagina(n: number) {
    setPage(Math.min(Math.max(1, n), totalPages));
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function applyAction(op: Operacion, action: StatusAction, okMsg: string) {
    setBusyId(op.id);
    try {
      const res = await fetch(`/api/operaciones/${op.id}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(action),
      });
      const data = await res.json();
      if (!res.ok) {
        push("error", data.error ?? "No se pudo actualizar el estado");
        return;
      }
      setOps((prev) =>
        prev.map((o) =>
          o.id === op.id
            ? {
                ...o,
                status: data.status,
                entrada_recibida_at: data.entrada_recibida_at,
                pago_confirmado_at: data.pago_confirmado_at,
                cerrada_at: data.cerrada_at,
              }
            : o
        )
      );
      push("success", okMsg);
    } catch {
      push("error", "Error de red al actualizar");
    } finally {
      setBusyId(null);
    }
  }

  // Edición de datos internos (notas / fecha) vía PATCH /api/operaciones/[id].
  async function updateOp(
    op: Operacion,
    patch: Partial<Pick<Operacion, "notas" | "fecha_evento">>,
    okMsg: string
  ) {
    setBusyId(op.id);
    try {
      const res = await fetch(`/api/operaciones/${op.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      });
      const data = await res.json();
      if (!res.ok) {
        push("error", data.error ?? "No se pudo guardar");
        return;
      }
      setOps((prev) =>
        prev.map((o) =>
          o.id === op.id
            ? { ...o, notas: data.notas, fecha_evento: data.fecha_evento }
            : o
        )
      );
      push("success", okMsg);
    } catch {
      push("error", "Error de red al guardar");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-6">
      {/* Mini stats: tira única estilo talón, dividida por líneas punteadas */}
      <section className="card-shadow mb-5 overflow-hidden rounded-2xl bg-white">
        <div className="grid grid-cols-3 divide-x divide-dashed divide-line">
          <Stat label="En curso" value={stats.enCurso} accent="#B07A14" />
          <Stat label="Para entregar" value={stats.paraCerrar} accent="#0D9377" />
          <Stat label="Entregadas" value={stats.cerradas} accent="#6C5BF2" />
        </div>
      </section>

      {/* Búsqueda + orden */}
      <div className="mb-3 flex flex-wrap gap-2">
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Buscar por evento, code o alias…"
          aria-label="Buscar operaciones"
          className="min-w-0 flex-1 rounded-xl border border-line bg-white px-3.5 py-2 text-sm shadow-sm outline-none transition-colors placeholder:text-muted focus:border-brand focus:ring-2 focus:ring-brand/15"
        />
        <select
          value={sort}
          onChange={(e) => setSort(e.target.value as "recientes" | "urgentes")}
          aria-label="Ordenar operaciones"
          className="rounded-xl border border-line bg-white px-3 py-2 text-sm shadow-sm outline-none focus:border-brand"
        >
          <option value="recientes">Más recientes</option>
          <option value="urgentes">Evento más próximo</option>
        </select>
      </div>

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
          enPagina.map((op) => (
            <OperacionCard
              key={op.id}
              op={op}
              baseUrl={baseUrl}
              busy={busyId === op.id}
              onAction={applyAction}
              onUpdate={updateOp}
              onCopied={(m) => push("success", m)}
            />
          ))
        )}
      </div>

      {totalPages > 1 && (
        <nav
          aria-label="Paginación de operaciones"
          className="mt-5 flex items-center justify-center gap-3"
        >
          <button
            onClick={() => irAPagina(pagina - 1)}
            disabled={pagina <= 1}
            className="rounded-xl border border-line bg-white px-4 py-2 text-xs font-semibold text-[#4A4E5E] shadow-sm transition-colors hover:bg-canvas disabled:opacity-40"
          >
            ← Anteriores
          </button>
          <span className="text-xs font-medium tabular-nums text-muted">
            Página {pagina} de {totalPages} · {visible.length} operaciones
          </span>
          <button
            onClick={() => irAPagina(pagina + 1)}
            disabled={pagina >= totalPages}
            className="rounded-xl border border-line bg-white px-4 py-2 text-xs font-semibold text-[#4A4E5E] shadow-sm transition-colors hover:bg-canvas disabled:opacity-40"
          >
            Siguientes →
          </button>
        </nav>
      )}

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
