"use client";

import { useEffect, useMemo, useState } from "react";
import {
  diasHastaEvento,
  estadoDe,
  SEMAFORO_COLOR,
  SEMAFORO_LABEL,
  SEMAFORO_LEYENDA,
  type Consulta,
  type Moneda,
  type Operacion,
  type StatusAction,
  type OperacionItem,
} from "@/lib/operaciones";
import OperacionCard from "./OperacionCard";
import ConsultaCard from "./ConsultaCard";
import { ToastViewport, useToast } from "./Toast";

type Props = {
  initial: Operacion[];
  // Líneas de TODAS las operaciones en pantalla: se agrupan acá una vez en
  // vez de filtrar el array entero en cada card.
  items?: OperacionItem[];
  // Consultas PENDIENTES. Van en la misma lista que las operaciones (con el
  // signo de pregunta) en vez de en una sección aparte: el admin mira un solo
  // lugar, y una consulta es trabajo pendiente igual que una operación.
  consultas?: Consulta[];
  baseUrl: string;
};

// Fila de la lista: o una operación, o una consulta sin cotizar.
type Fila =
  | { kind: "op"; id: string; created_at: string; op: Operacion }
  | { kind: "consulta"; id: string; created_at: string; consulta: Consulta };

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
export default function AdminDashboard({
  initial,
  items = [],
  consultas: consultasIniciales = [],
  baseUrl,
}: Props) {
  // Índice operación -> líneas, armado una vez por render en vez de filtrar
  // el array completo dentro de cada tarjeta.
  const itemsPorOp = useMemo(() => {
    const m = new Map<string, OperacionItem[]>();
    for (const i of items) {
      const arr = m.get(i.operacion_id);
      if (arr) arr.push(i);
      else m.set(i.operacion_id, [i]);
    }
    return m;
  }, [items]);

  const [ops, setOps] = useState<Operacion[]>(initial);
  const [consultas, setConsultas] = useState<Consulta[]>(consultasIniciales);
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

  useEffect(() => {
    setConsultas(consultasIniciales);
  }, [consultasIniciales]);

  const stats = useMemo(() => {
    const estados = ops.map(estadoDe);
    const enCurso = estados.filter(
      (e) => e !== "cerrada" && e !== "cancelada" && e !== "lista_para_cerrar"
    ).length;
    const paraCerrar = estados.filter((e) => e === "lista_para_cerrar").length;
    const cerradas = estados.filter((e) => e === "cerrada").length;
    return { enCurso, paraCerrar, cerradas, aCotizar: consultas.length };
  }, [ops, consultas]);

  const visible = useMemo<Fila[]>(() => {
    const q = query.trim().toLowerCase();
    const coincide = (...campos: (string | null | undefined)[]) =>
      !q || campos.some((c) => (c ?? "").toLowerCase().includes(q));

    let filas: Fila[] = ops
      .filter(
        (o) =>
          matches(o, filter) &&
          coincide(o.evento, o.code, o.comprador_alias, o.vendedor_alias, o.cliente_email)
      )
      .map((op) => ({ kind: "op" as const, id: op.id, created_at: op.created_at, op }));

    if (sort === "urgentes") {
      // Fecha de evento más próxima primero; sin fecha al final.
      filas = [...filas].sort((a, b) => {
        const fa = a.kind === "op" ? a.op.fecha_evento : a.consulta.fecha_evento;
        const fb = b.kind === "op" ? b.op.fecha_evento : b.consulta.fecha_evento;
        const da = diasHastaEvento(fa);
        const db = diasHastaEvento(fb);
        if (da == null && db == null) return b.created_at.localeCompare(a.created_at);
        if (da == null) return 1;
        if (db == null) return -1;
        return da - db;
      });
    }

    // Las consultas van SIEMPRE arriba: son las únicas filas que esperan algo
    // del admin (chequear stock y cerrar precio). Con el paginado, dejarlas
    // ordenadas por fecha las mandaba a la página 3 y no las veía nadie.
    // Solo aparecen en los filtros donde "trabajo pendiente" tiene sentido.
    const muestraConsultas = filter === "todas" || filter === "en_curso";
    const pendientes: Fila[] = muestraConsultas
      ? consultas
          .filter((c) => coincide(c.evento, c.code, c.comprador_alias, c.cliente_email))
          .map((c) => ({ kind: "consulta" as const, id: c.id, created_at: c.created_at, consulta: c }))
      : [];

    return [...pendientes, ...filas];
  }, [ops, consultas, filter, query, sort]);

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
                entrada_recibida_por: data.entrada_recibida_por ?? null,
                pago_confirmado_por: data.pago_confirmado_por ?? null,
                cerrada_por: data.cerrada_por ?? null,
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

  // Cotizar una consulta la convierte en operación: desaparece de las
  // consultas y aparece en la lista como una operación más.
  async function cargarConsulta(
    c: Consulta,
    valores: { costo: number; comision: number; moneda: Moneda }
  ): Promise<string | null> {
    setBusyId(c.id);
    try {
      const res = await fetch(`/api/consultas/${c.id}/convertir`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(valores),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        const msg = data.error ?? "No se pudo cargar la operación";
        push("error", msg);
        return msg;
      }
      setConsultas((prev) => prev.filter((x) => x.id !== c.id));
      if (data.operacion) {
        // Optimista: la operación real llega con el próximo AutoRefresh, pero
        // la fila tiene que aparecer ya para que se vea que se cargó.
        setOps((prev) => [
          {
            id: data.operacion.id,
            code: data.operacion.code,
            evento: c.evento,
            comprador_alias: c.comprador_alias,
            vendedor_alias: null,
            monto: valores.costo + valores.comision,
            fee: valores.comision,
            moneda: valores.moneda,
            cantidad: c.cantidad,
            status: "esperando_entrada",
            ticket_id: c.ticket_id,
            sector: c.sector,
            fecha_evento: c.fecha_evento,
            notas: c.notas,
            cuenta_debitar: null,
            tipo: "pedido",
            cliente_id: c.cliente_id,
            cliente_email: c.cliente_email,
            envio_id: c.envio_id,
            entrada_recibida_at: null,
            pago_confirmado_at: null,
            pago_proveedor_at: null,
            cerrada_at: null,
            entrada_recibida_por: null,
            pago_confirmado_por: null,
            pago_proveedor_por: null,
            cerrada_por: null,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          } as Operacion,
          ...prev,
        ]);
      }
      push("success", `Operación ${data.operacion?.code ?? ""} creada`);
      return null;
    } catch {
      const msg = "Error de red. Reintentá.";
      push("error", msg);
      return msg;
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-6">
      {/* Mini stats: tira única estilo talón, dividida por líneas punteadas */}
      <section className="card-shadow mb-5 overflow-hidden rounded-2xl bg-white">
        <div className="grid grid-cols-4 divide-x divide-dashed divide-line">
          {/* "A cotizar" son las consultas: entradas que el cliente pidió y
              todavía hay que chequear si están y a cuánto. */}
          <Stat label="A cotizar" value={stats.aCotizar} accent="#B07A14" />
          <Stat label="En curso" value={stats.enCurso} accent="#1F33E0" />
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
        {/* CSV con TODO el historial (server-side, sin el tope de 1000 del
            panel) para contabilidad. Descarga directa. */}
        <a
          href="/api/operaciones/export"
          download
          className="rounded-xl border border-line bg-white px-3 py-2 text-sm font-medium text-[#4A4E5E] shadow-sm transition-colors hover:bg-canvas"
          title="Descargar todas las operaciones en CSV"
        >
          Exportar CSV
        </a>
      </div>

      {/* Filtros por estado: la barra ocupa el ancho completo y los 5 tabs
          lo reparten en partes iguales — nada de barra corta ni scroll
          horizontal con tabs cortados. */}
      <div
        role="tablist"
        aria-label="Filtrar operaciones"
        className="mb-5 flex w-full gap-1 rounded-xl border border-line bg-white p-1 shadow-sm"
      >
        {FILTERS.map((f) => {
          const active = filter === f.key;
          return (
            <button
              key={f.key}
              role="tab"
              aria-selected={active}
              onClick={() => setFilter(f.key)}
              className={`min-w-0 flex-1 truncate rounded-lg px-1 py-1.5 text-center text-xs font-semibold transition-colors sm:px-3 ${
                active
                  ? "bg-ink text-white"
                  : "text-[#4A4E5E] hover:bg-canvas"
              }`}
              title={f.label}
            >
              {f.label}
            </button>
          );
        })}
      </div>

      {/* Leyenda del semáforo: los tres estados que se accionan. El gris no
          está porque no es un estado, es "todavía no pasó nada". */}
      <div className="mb-2 flex flex-wrap items-center gap-x-3.5 gap-y-1 px-1 text-[11px] text-muted">
        {SEMAFORO_LEYENDA.map((sem) => (
          <span key={sem} className="inline-flex items-center gap-1.5">
            <span
              className="h-2 w-2 rounded-full"
              style={{ backgroundColor: SEMAFORO_COLOR[sem] }}
              aria-hidden
            />
            {SEMAFORO_LABEL[sem]}
          </span>
        ))}
        <span className="inline-flex items-center gap-1.5">
          <span
            className="flex h-3.5 w-3.5 items-center justify-center rounded-full text-[9px] font-bold text-white"
            style={{ background: "#B07A14" }}
            aria-hidden
          >
            ?
          </span>
          Consulta — chequear stock
        </span>
      </div>

      <div className="space-y-2">
        {visible.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-[#C5C9D6] bg-white/50 px-4 py-10 text-center text-sm text-muted">
            {ops.length === 0 && consultas.length === 0
              ? "Todavía no hay operaciones. Se cargan desde el módulo de carga."
              : "No hay operaciones con este filtro."}
          </div>
        ) : (
          enPagina.map((fila) =>
            fila.kind === "consulta" ? (
              <ConsultaCard
                key={fila.id}
                consulta={fila.consulta}
                busy={busyId === fila.id}
                onCargar={cargarConsulta}
                onError={(m) => push("error", m)}
              />
            ) : (
              <OperacionCard
                key={fila.id}
                op={fila.op}
                items={itemsPorOp.get(fila.id) ?? []}
                baseUrl={baseUrl}
                busy={busyId === fila.id}
                onAction={applyAction}
                onUpdate={updateOp}
                onCopied={(m) => push("success", m)}
              />
            )
          )
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
    // Estilo del mock aprobado: label en mono chiquito y número gordo a la
    // izquierda. flex-col + justify-between mantiene los números alineados
    // aunque un label envuelva a dos líneas en móvil.
    <div className="flex h-full flex-col justify-between gap-1 px-4 py-3.5 text-left">
      <p className="font-mono text-[10px] font-bold uppercase tracking-[0.12em] text-muted">
        {label}
      </p>
      <p
        className="font-body text-[28px] font-extrabold leading-none tabular-nums tracking-tight"
        style={{ color: accent }}
      >
        {String(value).padStart(2, "0")}
      </p>
    </div>
  );
}
