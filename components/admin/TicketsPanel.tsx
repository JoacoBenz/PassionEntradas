"use client";

import { useMemo, useRef, useState } from "react";
import Link from "next/link";
import type { SyncRun, TicketFull } from "@/lib/tickets";
import { ToastViewport, useToast } from "./Toast";

// Autocompletado propio para la competición: las sugerencias se ven ADENTRO
// de la página (un desplegable bajo el input), no en la barra del teclado
// como hacía <datalist> en móvil. A nivel módulo para que React no lo
// remonte en cada render.
function CompeticionCombo({
  value,
  onChange,
  opciones,
  inputCls,
}: {
  value: string;
  onChange: (v: string) => void;
  opciones: string[];
  inputCls: string;
}) {
  const [abierto, setAbierto] = useState(false);
  const sugerencias = useMemo(() => {
    const q = value.trim().toLowerCase();
    const base = q ? opciones.filter((c) => c.toLowerCase().includes(q)) : opciones;
    // Si ya escribió una igual, no la sugerimos de nuevo.
    return base.filter((c) => c.toLowerCase() !== q).slice(0, 8);
  }, [value, opciones]);

  return (
    <div className="relative">
      <input
        className={inputCls}
        value={value}
        autoComplete="off"
        aria-label="Categoría o competición"
        placeholder="Elegí o escribí una nueva"
        onChange={(e) => {
          onChange(e.target.value);
          setAbierto(true);
        }}
        onFocus={() => setAbierto(true)}
        onBlur={() => setAbierto(false)}
      />
      {abierto && sugerencias.length > 0 && (
        <ul className="absolute left-0 right-0 top-full z-20 mt-1 max-h-48 overflow-y-auto rounded-lg border border-line bg-white py-1 shadow-lg">
          {sugerencias.map((c) => (
            <li key={c}>
              <button
                type="button"
                // onMouseDown (no onClick): dispara ANTES del blur del input,
                // que si no cerraría la lista sin aplicar la selección.
                onMouseDown={(e) => {
                  e.preventDefault();
                  onChange(c);
                  setAbierto(false);
                }}
                className="w-full px-3 py-2 text-left text-sm transition-colors hover:bg-canvas"
              >
                {c}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

type Props = {
  initial: TicketFull[];
  syncRuns: SyncRun[];
  // Entradas del portal con evento vigente (las de eventos pasados no cuentan).
  portalCount: number;
  // De esas, las reservables ahora (con stock y en estado book).
  portalComprables: number;
  // Interruptor: si las entradas de Passion se muestran en la tienda.
  portalActivo: boolean;
  // Competiciones existentes (portal + propias) para el dropdown del form.
  competiciones: string[];
};

// Datos del evento (compartidos) + una fila por sector: un evento puede
// publicarse con varios sectores, cada uno con su precio y stock (igual que
// las entradas del portal: una fila de catálogo por sector).
const empty = {
  evento: "",
  competicion: "",
  fecha: "",
  ciudad: "",
};

type SectorForm = { categoria: string; precio: string; stock: string };
const sectorVacio = (): SectorForm => ({ categoria: "", precio: "", stock: "1" });
const MAX_SECTORES = 20;

// Panel de catálogo: carga de entradas propias (source=manual) junto a las
// sincronizadas del portal, y salud de las últimas corridas del worker.
export default function TicketsPanel({
  initial,
  syncRuns,
  portalCount,
  portalComprables,
  portalActivo,
  competiciones,
}: Props) {
  const [tickets, setTickets] = useState<TicketFull[]>(initial);
  // Sugerencias del dropdown de competición. Una nueva se suma al publicar,
  // así aparece en la próxima carga sin recargar la página.
  const [comps, setComps] = useState<string[]>(competiciones);
  const [form, setForm] = useState(empty);
  const [sectores, setSectores] = useState<SectorForm[]>([sectorVacio()]);
  const [loading, setLoading] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [passionOn, setPassionOn] = useState(portalActivo);
  const [passionBusy, setPassionBusy] = useState(false);
  const { toasts, push } = useToast();

  // Paginado como en el panel: renderizar miles de filas juntas era el
  // cuello confirmado por el stress test (p50 3,5s con 2500 entradas).
  const PAGE_SIZE = 20;
  const totalPages = Math.max(1, Math.ceil(tickets.length / PAGE_SIZE));
  const pagina = Math.min(page, totalPages);
  const enPagina = tickets.slice((pagina - 1) * PAGE_SIZE, pagina * PAGE_SIZE);
  // Mismo guard que en NewOperacionForm: dos taps en el mismo tick
  // dispararían dos POST antes de que el disabled llegue a pintarse.
  const enviando = useRef(false);

  function set<K extends keyof typeof empty>(key: K, value: string) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  function setSector(i: number, key: keyof SectorForm, value: string) {
    setSectores((prev) => prev.map((s, j) => (j === i ? { ...s, [key]: value } : s)));
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (enviando.current) return;
    // Todos los campos son obligatorios: sin esto se creaban entradas a
    // medias (mismo problema que hubo con las operaciones vacías).
    if (!form.evento.trim()) {
      push("error", "El evento es obligatorio");
      return;
    }
    if (!form.competicion.trim()) {
      push("error", "La categoría / competición es obligatoria");
      return;
    }
    if (!form.ciudad.trim()) {
      push("error", "El lugar (ciudad o país) es obligatorio");
      return;
    }
    if (!form.fecha) {
      push("error", "La fecha del evento es obligatoria");
      return;
    }
    const vistos = new Set<string>();
    for (let i = 0; i < sectores.length; i++) {
      const s = sectores[i];
      const n = sectores.length > 1 ? ` (sector ${i + 1})` : "";
      if (!s.categoria.trim()) {
        push("error", `El sector es obligatorio${n}`);
        return;
      }
      const precioNum = Number(s.precio);
      if (!s.precio.trim() || !Number.isFinite(precioNum) || precioNum <= 0) {
        push("error", `El precio debe ser mayor a 0${n}`);
        return;
      }
      const stockNum = Math.trunc(Number(s.stock));
      if (!s.stock.trim() || !Number.isFinite(stockNum) || stockNum < 1) {
        push("error", `El stock debe ser al menos 1${n}`);
        return;
      }
      const clave = s.categoria.trim().toLowerCase();
      if (vistos.has(clave)) {
        push("error", `El sector "${s.categoria.trim()}" está repetido`);
        return;
      }
      vistos.add(clave);
    }
    enviando.current = true;
    setLoading(true);
    try {
      const res = await fetch("/api/tickets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ticket: { ...form, sectores } }),
      });
      const data = await res.json();
      if (!res.ok) {
        push("error", data.error ?? "No se pudo publicar la entrada");
        return;
      }
      setTickets((prev) => [...(data.rows as TicketFull[]), ...prev]);
      const nuevaComp = form.competicion.trim();
      if (nuevaComp && !comps.includes(nuevaComp)) {
        setComps((prev) => [...prev, nuevaComp].sort());
      }
      setForm(empty);
      setSectores([sectorVacio()]);
      push(
        "success",
        sectores.length > 1
          ? `Entrada publicada con ${sectores.length} sectores`
          : "Entrada publicada en la tienda"
      );
    } catch {
      push("error", "Error de red al publicar");
    } finally {
      enviando.current = false;
      setLoading(false);
    }
  }

  // Prende/apaga las entradas de Passion en la tienda. Sin optimismo: el
  // estado recién cambia cuando el server confirmó (y ya revalidó la tienda).
  async function togglePassion() {
    if (passionBusy) return;
    setPassionBusy(true);
    try {
      const res = await fetch("/api/portal", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ activo: !passionOn }),
      });
      const data = await res.json();
      if (!res.ok) {
        push("error", data.error ?? "No se pudo cambiar la tienda");
        return;
      }
      setPassionOn(data.activo);
      push(
        "success",
        data.activo
          ? "Entradas de Passion visibles en la tienda"
          : "Entradas de Passion ocultas: la tienda muestra solo las propias"
      );
    } catch {
      push("error", "Error de red al cambiar la tienda");
    } finally {
      setPassionBusy(false);
    }
  }

  async function onDelete(id: string) {
    setBusyId(id);
    try {
      const res = await fetch(`/api/tickets/${encodeURIComponent(id)}`, {
        method: "DELETE",
      });
      const data = await res.json();
      if (!res.ok) {
        push("error", data.error ?? "No se pudo borrar");
        return;
      }
      setTickets((prev) => prev.filter((t) => t.id !== id));
      push("success", "Entrada borrada");
    } catch {
      push("error", "Error de red al borrar");
    } finally {
      setBusyId(null);
    }
  }

  const inputCls =
    "w-full rounded-lg border border-line bg-white px-3 py-2 text-sm outline-none transition-colors focus:border-brand focus:ring-2 focus:ring-brand/15";
  const labelCls =
    "mb-1 block text-xs font-medium uppercase tracking-wide text-[#6A6E7E]";

  const lastSync = syncRuns[0];

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-6">
      {/* Salud del catálogo / worker */}
      <section className="card-shadow mb-5 overflow-hidden rounded-2xl bg-white">
        <div className="grid grid-cols-3 divide-x divide-dashed divide-line">
          <Stat
            label="De Passion"
            value={String(portalCount)}
            accent={passionOn ? "#6C5BF2" : "#9AA0B2"}
            sub={passionOn ? `${portalComprables} comprables` : "Ocultas de la tienda"}
          />
          <Stat label="Propias" value={String(tickets.length)} accent="#0D9377" />
          <Stat
            label="Última sync"
            value={
              lastSync
                ? new Date(lastSync.created_at).toLocaleTimeString("es-AR", {
                    hour: "2-digit",
                    minute: "2-digit",
                    hour12: false,
                    timeZone: "America/Argentina/Buenos_Aires",
                  })
                : "—"
            }
            accent={lastSync?.status === "ok" ? "#0D9377" : "#D14D68"}
            sub={lastSync ? lastSync.status.toUpperCase() : "Sin corridas"}
          />
        </div>
      </section>

      {/* Interruptor: entradas de Passion visibles u ocultas en la tienda.
          El botón es el área táctil (el global de móvil le pone min-height
          40px, y eso deformaba la pastilla); el dibujo del switch vive en un
          span interno de tamaño fijo, centrado, que no se estira. */}
      <section className="card-shadow mb-5 flex flex-nowrap items-center justify-between gap-3 rounded-2xl bg-white px-4 py-3">
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold">Entradas de Passion en la tienda</p>
          <p className="text-xs text-muted">
            {passionOn
              ? "Visibles junto a las propias"
              : "Ocultas: la tienda muestra solo las entradas propias"}
          </p>
        </div>
        <button
          role="switch"
          aria-checked={passionOn}
          aria-label="Mostrar entradas de Passion en la tienda"
          onClick={togglePassion}
          disabled={passionBusy}
          className="flex shrink-0 items-center justify-center disabled:opacity-60"
        >
          <span
            aria-hidden
            className={`relative block h-7 w-12 rounded-full transition-colors ${
              passionOn ? "bg-estado-confirmada" : "bg-[#C5C9D6]"
            }`}
          >
            <span
              className={`absolute top-1/2 h-6 w-6 -translate-y-1/2 rounded-full bg-white shadow transition-[left] ${
                passionOn ? "left-[calc(100%-1.625rem)]" : "left-0.5"
              }`}
            />
          </span>
        </button>
      </section>

      {/* minmax(0,1fr) también en móvil: sin eso, el form impone su ancho
          mínimo intrínseco (inputs con size por defecto) y desborda. */}
      <div className="grid grid-cols-[minmax(0,1fr)] gap-6 md:grid-cols-[minmax(0,380px)_1fr]">
        {/* Formulario de carga manual */}
        <form
          onSubmit={onSubmit}
          className="card-shadow min-w-0 overflow-hidden rounded-2xl md:sticky md:top-6 md:self-start"
        >
          <div className="surface-ink punch-b px-5 py-4 text-white">
            <p className="text-[10px] font-medium uppercase tracking-[0.25em] text-white/50">
              Catálogo de la tienda
            </p>
            <h2 className="mt-0.5 font-display text-lg font-bold tracking-tight">
              Cargar entrada propia
            </h2>
          </div>
          <div className="punch-t bg-white">
            <div className="perf-line-light mx-5" />
            <div className="space-y-3 p-5">
              <div>
                <label className={labelCls}>Evento *</label>
                <input
                  className={inputCls}
                  value={form.evento}
                  onChange={(e) => set("evento", e.target.value)}
                  placeholder="River vs Boca — Superclásico"
                />
              </div>
              {/* En desktop comparten fila. flex-col + justify-between: si un
                  label envuelve a dos líneas, los inputs quedan igual anclados
                  abajo y alineados entre sí. */}
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                <div className="flex flex-col justify-between">
                  <label className={labelCls}>Categoría / competición *</label>
                  {/* Autocompletado propio: sugerencias en un desplegable
                      dentro de la página (en móvil, datalist las mandaba a
                      la barra del teclado). Nueva => se agrega al publicar. */}
                  <CompeticionCombo
                    value={form.competicion}
                    onChange={(v) => set("competicion", v)}
                    opciones={comps}
                    inputCls={inputCls}
                  />
                </div>
                <div className="flex flex-col justify-between">
                  <label className={labelCls}>Lugar *</label>
                  <input
                    className={inputCls}
                    value={form.ciudad}
                    onChange={(e) => set("ciudad", e.target.value)}
                    placeholder="Ciudad o país"
                  />
                </div>
              </div>
              <div>
                <label className={labelCls}>Fecha *</label>
                <input
                  type="date"
                  className={inputCls}
                  value={form.fecha}
                  onChange={(e) => set("fecha", e.target.value)}
                />
              </div>

              {/* Sectores: uno por defecto; se pueden sumar más (cada uno se
                  publica como su propia fila del catálogo, como el portal). */}
              {sectores.map((s, i) => (
                <div
                  key={i}
                  className="space-y-3 rounded-xl border border-dashed border-line bg-canvas/60 p-3"
                >
                  <div className="flex items-end gap-3">
                    <div className="min-w-0 flex-1">
                      <label className={labelCls}>
                        Sector {sectores.length > 1 ? i + 1 : ""} *
                      </label>
                      <input
                        className={inputCls}
                        value={s.categoria}
                        onChange={(e) => setSector(i, "categoria", e.target.value)}
                        placeholder="Platea Alta"
                      />
                    </div>
                    {sectores.length > 1 && (
                      <button
                        type="button"
                        aria-label={`Quitar sector ${i + 1}`}
                        onClick={() =>
                          setSectores((prev) => prev.filter((_, j) => j !== i))
                        }
                        className="shrink-0 rounded-lg border border-red-200 px-3 py-2 text-xs font-semibold text-red-600 transition-colors hover:bg-red-50"
                      >
                        Quitar
                      </button>
                    )}
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className={labelCls}>Precio (USD) *</label>
                      <input
                        type="number"
                        min={1}
                        step={1}
                        className={`${inputCls} font-mono`}
                        value={s.precio}
                        onChange={(e) => setSector(i, "precio", e.target.value)}
                        placeholder="120"
                      />
                    </div>
                    <div>
                      <label className={labelCls}>Stock *</label>
                      <input
                        type="number"
                        min={1}
                        step={1}
                        className={`${inputCls} font-mono`}
                        value={s.stock}
                        onChange={(e) => setSector(i, "stock", e.target.value)}
                      />
                    </div>
                  </div>
                </div>
              ))}

              {sectores.length < MAX_SECTORES && (
                <button
                  type="button"
                  onClick={() => setSectores((prev) => [...prev, sectorVacio()])}
                  className="w-full rounded-xl border border-dashed border-brand/40 px-3 py-2 text-xs font-semibold text-brand transition-colors hover:bg-brand/5"
                >
                  + Agregar otro sector
                </button>
              )}
            </div>
            <div className="px-5 pb-5">
              <button
                type="submit"
                disabled={loading}
                className="w-full rounded-xl bg-brand px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-brand-deep disabled:opacity-60"
              >
                {loading ? "Publicando…" : "Publicar en la tienda"}
              </button>
            </div>
          </div>
        </form>

        {/* Lista de entradas propias */}
        <div className="space-y-3">
          <h2 className="text-xs font-medium uppercase tracking-widest text-muted">
            Entradas propias publicadas
          </h2>
          {tickets.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-[#C5C9D6] bg-white/50 px-4 py-10 text-center text-sm text-muted">
              Todavía no cargaste entradas propias. Se publican junto a las del
              portal y la sincronización no las toca.
            </div>
          ) : (
            enPagina.map((t) => (
              <div
                key={t.id}
                className="card-shadow flex items-center justify-between gap-3 rounded-2xl bg-white px-4 py-3"
              >
                <div className="min-w-0">
                  <p className="truncate font-display font-semibold">{t.evento}</p>
                  <p className="text-xs text-muted">
                    {t.categoria ? `${t.categoria} · ` : ""}
                    {t.precio_final != null ? `US$ ${t.precio_final}` : "A consultar"} · Stock{" "}
                    {t.stock ?? 0}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <Link
                    href={`/moderador?evento=${encodeURIComponent(t.evento)}&ticket=${encodeURIComponent(t.id)}`}
                    className="rounded-lg border border-brand px-3 py-1.5 text-xs font-semibold text-brand transition-colors hover:bg-brand/5"
                  >
                    Crear operación
                  </Link>
                  <button
                    onClick={() => onDelete(t.id)}
                    disabled={busyId === t.id}
                    className="rounded-lg border border-estado-cancelada px-3 py-1.5 text-xs font-semibold text-estado-cancelada transition-colors hover:bg-estado-cancelada/5 disabled:opacity-60"
                  >
                    {busyId === t.id ? "Borrando…" : "Borrar"}
                  </button>
                </div>
              </div>
            ))
          )}

          {totalPages > 1 && (
            <nav
              aria-label="Paginación de entradas"
              className="flex items-center justify-center gap-3 pt-1"
            >
              <button
                onClick={() => setPage(Math.max(1, pagina - 1))}
                disabled={pagina <= 1}
                className="rounded-xl border border-line bg-white px-4 py-2 text-xs font-semibold text-[#4A4E5E] shadow-sm transition-colors hover:bg-canvas disabled:opacity-40"
              >
                ← Anteriores
              </button>
              <span className="text-xs font-medium tabular-nums text-muted">
                Página {pagina} de {totalPages} · {tickets.length} entradas
              </span>
              <button
                onClick={() => setPage(Math.min(totalPages, pagina + 1))}
                disabled={pagina >= totalPages}
                className="rounded-xl border border-line bg-white px-4 py-2 text-xs font-semibold text-[#4A4E5E] shadow-sm transition-colors hover:bg-canvas disabled:opacity-40"
              >
                Siguientes →
              </button>
            </nav>
          )}

          {/* Últimas corridas del worker */}
          <h2 className="pt-4 text-xs font-medium uppercase tracking-widest text-muted">
            Últimas sincronizaciones del portal
          </h2>
          {syncRuns.length === 0 ? (
            <p className="text-sm text-muted">
              Sin corridas registradas. El worker escribe acá en cada ciclo.
            </p>
          ) : (
            <div className="card-shadow overflow-hidden rounded-2xl bg-white text-sm">
              {syncRuns.map((r) => (
                <div
                  key={r.id}
                  className="flex items-center justify-between border-b border-dashed border-line px-4 py-2.5 last:border-b-0"
                >
                  <span
                    className="font-mono text-xs font-bold"
                    style={{ color: r.status === "ok" ? "#0D9377" : "#D14D68" }}
                  >
                    {r.status.toUpperCase()}
                  </span>
                  <span className="text-xs text-muted">
                    {r.upserted ?? 0} actualizadas
                    {r.reason ? ` · ${r.reason}` : ""}
                  </span>
                  <span className="font-mono text-xs text-muted">
                    {new Date(r.created_at).toLocaleString("es-AR", {
                      day: "2-digit",
                      month: "2-digit",
                      hour: "2-digit",
                      minute: "2-digit",
                      hour12: false,
                      timeZone: "America/Argentina/Buenos_Aires",
                    })}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <ToastViewport toasts={toasts} />
    </div>
  );
}

function Stat({
  label,
  value,
  accent,
  sub,
}: {
  label: string;
  value: string;
  accent: string;
  sub?: string;
}) {
  return (
    <div className="px-4 py-4 text-center sm:text-left">
      <p className="text-[11px] font-medium uppercase tracking-widest text-muted">{label}</p>
      <p
        className="mt-0.5 font-display text-2xl font-bold tabular-nums tracking-tight"
        style={{ color: accent }}
      >
        {value}
      </p>
      {sub && <p className="text-[11px] text-muted">{sub}</p>}
    </div>
  );
}
