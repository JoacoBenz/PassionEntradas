"use client";

import { useRef, useState } from "react";
import type { Operacion } from "@/lib/operaciones";
import { parseTitle } from "@/lib/tickets";

type Props = {
  onCreated: (op: Operacion) => void;
  onError: (msg: string) => void;
  // Prefill al llegar desde el catálogo de la tienda ("Crear operación").
  prefill?: { evento?: string; ticketId?: string };
};

// Resultado del buscador de entradas (/api/tickets/buscar).
type TicketMatch = {
  id: string;
  evento: string;
  competicion: string | null;
  fecha: string | null;
  categoria: string | null;
  precio_final: number | null;
  stock: number | null;
  source: "portal" | "manual";
};

// Autocompletado del evento contra el catálogo: elegir un resultado vincula
// la operación a esa entrada (ticket_id) — con eso funcionan el descuento de
// stock al cerrar (propias) y la factura con sede/sector. Escribir libre
// sigue valiendo para eventos que no están en el catálogo.
// A nivel módulo para que React no lo remonte en cada render.
function EventoCombo({
  value,
  onTexto,
  onElegir,
  inputCls,
}: {
  value: string;
  onTexto: (v: string) => void;
  onElegir: (t: TicketMatch) => void;
  inputCls: string;
}) {
  const [abierto, setAbierto] = useState(false);
  const [resultados, setResultados] = useState<TicketMatch[]>([]);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pedido = useRef(0);

  function buscar(q: string) {
    if (timer.current) clearTimeout(timer.current);
    if (q.trim().length < 2) {
      setResultados([]);
      return;
    }
    timer.current = setTimeout(async () => {
      const id = ++pedido.current;
      try {
        const res = await fetch(`/api/tickets/buscar?q=${encodeURIComponent(q)}`);
        if (!res.ok || id !== pedido.current) return;
        setResultados((await res.json()) as TicketMatch[]);
      } catch {
        // sin red: el desplegable simplemente no sugiere
      }
    }, 250);
  }

  return (
    <div className="relative">
      <input
        id="evento"
        className={inputCls}
        value={value}
        autoComplete="off"
        placeholder="Buscá en el catálogo o escribí libre"
        onChange={(e) => {
          onTexto(e.target.value);
          setAbierto(true);
          buscar(e.target.value);
        }}
        onFocus={() => setAbierto(true)}
        onBlur={() => setAbierto(false)}
      />
      {abierto && resultados.length > 0 && (
        <ul className="absolute left-0 right-0 top-full z-20 mt-1 max-h-72 overflow-y-auto rounded-lg border border-line bg-white py-1 shadow-lg">
          {resultados.map((t) => {
            // Mismo truco que la tienda: "Match 101, World Cup - Semi Final
            // - France vs Spain" => título "France vs Spain" + su contexto.
            const { title, context } = parseTitle(t.evento, t.competicion);
            const contexto = context || t.competicion || "";
            return (
              <li key={t.id}>
                <button
                  type="button"
                  // onMouseDown: dispara ANTES del blur del input.
                  onMouseDown={(e) => {
                    e.preventDefault();
                    onElegir(t);
                    setAbierto(false);
                  }}
                  className="w-full border-b border-dashed border-line px-3 py-2 text-left transition-colors last:border-b-0 hover:bg-canvas"
                >
                  {contexto && (
                    <span className="block font-mono text-[9px] font-bold uppercase tracking-wider text-muted">
                      {contexto}
                    </span>
                  )}
                  <span className="flex items-baseline justify-between gap-2">
                    {/* El nombre envuelve completo, nunca se corta. */}
                    <span className="min-w-0 whitespace-normal break-words text-sm font-semibold leading-snug">
                      {title}
                    </span>
                    <span
                      className={`shrink-0 rounded-md px-1.5 py-0.5 font-mono text-[9px] font-bold uppercase tracking-wider ${
                        t.source === "manual"
                          ? "bg-estado-confirmada/10 text-estado-confirmada"
                          : "bg-canvas text-muted"
                      }`}
                    >
                      {t.source === "manual" ? "Propia" : "Passion"}
                    </span>
                  </span>
                  {/* El sector, protagonista y en su propia línea. */}
                  <span className="mt-0.5 block whitespace-normal text-xs font-medium text-body">
                    {t.categoria ?? "Entrada general"}
                    <span className="font-normal text-muted">
                      {t.fecha ? ` · ${t.fecha.slice(0, 10)}` : ""}
                      {t.stock != null ? ` · stock ${t.stock}` : ""}
                    </span>
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

const empty = {
  evento: "",
  comprador_alias: "",
  vendedor_alias: "",
  monto: "",
  fee: "",
  fecha_evento: "",
  notas: "",
};

// Formulario "Nueva operación".
export default function NewOperacionForm({ onCreated, onError, prefill }: Props) {
  const [form, setForm] = useState({ ...empty, evento: prefill?.evento ?? "" });
  const [ticketId, setTicketId] = useState<string | null>(prefill?.ticketId ?? null);
  // Detalle de la entrada vinculada para el chip (desde el buscador; el
  // prefill de "Crear operación" no lo trae y muestra un texto genérico).
  const [vinculo, setVinculo] = useState<{ categoria: string | null; source: string } | null>(null);
  const [loading, setLoading] = useState(false);
  // El disabled de React llega tarde si dos taps caen en el mismo tick:
  // el ref corta el segundo submit antes de que dispare otro POST.
  const enviando = useRef(false);

  function set<K extends keyof typeof empty>(key: K, value: string) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  // Elegir una entrada del buscador: vincula el ticket y autocompleta fecha
  // (siempre) y monto (solo si está vacío y la entrada es propia: las de
  // Passion están en EUR en la base, no sirven como monto USD directo).
  function elegirTicket(t: TicketMatch) {
    setTicketId(t.id);
    setVinculo({ categoria: t.categoria, source: t.source });
    setForm((f) => ({
      ...f,
      evento: t.evento,
      fecha_evento: t.fecha ? t.fecha.slice(0, 10) : f.fecha_evento,
      monto:
        !f.monto.trim() && t.source === "manual" && t.precio_final != null
          ? String(Math.round(t.precio_final))
          : f.monto,
    }));
  }

  // Editar el texto a mano rompe el vínculo (el nombre ya no es el del
  // catálogo); se puede volver a elegir del desplegable.
  function editarEvento(v: string) {
    set("evento", v);
    if (ticketId) {
      setTicketId(null);
      setVinculo(null);
    }
  }

  function desvincular() {
    setTicketId(null);
    setVinculo(null);
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (enviando.current) return;
    // Datos mínimos de una operación de custodia: qué se opera, entre quiénes
    // y por cuánto. Sin esto no se crea (antes solo se validaba el evento y
    // quedaban operaciones con comprador/vendedor/monto vacíos).
    if (!form.evento.trim()) {
      onError("El evento es obligatorio");
      return;
    }
    if (!form.comprador_alias.trim()) {
      onError("El comprador es obligatorio");
      return;
    }
    if (!form.vendedor_alias.trim()) {
      onError("El vendedor es obligatorio");
      return;
    }
    const montoNum = Number(form.monto);
    if (!form.monto.trim() || !Number.isFinite(montoNum) || montoNum <= 0) {
      onError("El monto debe ser mayor a 0");
      return;
    }
    enviando.current = true;
    setLoading(true);
    try {
      const res = await fetch("/api/operaciones", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          evento: form.evento,
          comprador_alias: form.comprador_alias || null,
          vendedor_alias: form.vendedor_alias || null,
          monto: Number(form.monto || 0),
          fee: Number(form.fee || 0),
          ticket_id: ticketId,
          fecha_evento: form.fecha_evento || null,
          notas: form.notas || null,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        onError(data.error ?? "No se pudo crear la operación");
        return;
      }

      // Construimos el objeto local para pintar la card al instante.
      const now = new Date().toISOString();
      onCreated({
        id: data.id,
        code: data.code,
        evento: form.evento.trim(),
        comprador_alias: form.comprador_alias.trim() || null,
        vendedor_alias: form.vendedor_alias.trim() || null,
        cuenta_debitar: null,
        monto: Math.trunc(Number(form.monto || 0)),
        cantidad: 1,
        fee: Math.trunc(Number(form.fee || 0)),
        status: "esperando_entrada",
        entrada_recibida_at: null,
        pago_confirmado_at: null,
        cerrada_at: null,
        entrada_recibida_por: null,
        pago_confirmado_por: null,
        cerrada_por: null,
        fecha_evento: form.fecha_evento || null,
        notas: form.notas.trim() || null,
        ticket_id: ticketId,
        tipo: "operacion",
        cliente_id: null,
        cliente_email: null,
        sector: null,
        created_at: now,
        updated_at: now,
      });
      setForm(empty);
      setTicketId(null);
    } catch {
      onError("Error de red al crear la operación");
    } finally {
      enviando.current = false;
      setLoading(false);
    }
  }

  const inputCls =
    "w-full rounded-lg border border-line bg-white px-3 py-2 text-sm outline-none transition-colors focus:border-brand focus:ring-2 focus:ring-brand/15";
  const labelCls =
    "mb-1 block text-xs font-medium uppercase tracking-wide text-[#6A6E7E]";

  return (
    <form onSubmit={onSubmit} className="card-shadow overflow-hidden rounded-2xl">
      {/* Cabecera oscura estilo talón, con troquel real hacia el cuerpo */}
      <div className="surface-ink punch-b px-5 py-4 text-white">
        <p className="text-[10px] font-medium uppercase tracking-[0.25em] text-white/50">
          Módulo de carga
        </p>
        <h2 className="mt-0.5 font-display text-lg font-bold tracking-tight">
          Nueva operación
        </h2>
      </div>

      <div className="punch-t bg-white">
        <div className="perf-line-light mx-5" />
        <div className="space-y-3 p-5">
          <div>
            <label htmlFor="evento" className={labelCls}>
              Evento *
            </label>
            <EventoCombo
              value={form.evento}
              onTexto={editarEvento}
              onElegir={elegirTicket}
              inputCls={inputCls}
            />
            {ticketId && (
              <div className="mt-1.5 flex items-center justify-between gap-2 rounded-lg bg-canvas px-2.5 py-1.5">
                <span className="min-w-0 truncate text-[11px] text-muted">
                  Vinculada al catálogo
                  {vinculo
                    ? `: ${vinculo.categoria ?? "Entrada general"} · ${
                        vinculo.source === "manual" ? "Propia" : "Passion"
                      }`
                    : ""}
                </span>
                <button
                  type="button"
                  onClick={desvincular}
                  title="Desvincular de la entrada del catálogo"
                  className="shrink-0 rounded-md px-1.5 text-xs font-semibold text-muted transition-colors hover:bg-white hover:text-body"
                >
                  ✕
                </button>
              </div>
            )}
          </div>

          {/* flex-col + justify-between: si un label envuelve a dos líneas,
              los inputs quedan anclados abajo y alineados entre sí. */}
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col justify-between">
              <label htmlFor="comprador" className={labelCls}>
                Comprador *
              </label>
              <input
                id="comprador"
                className={inputCls}
                value={form.comprador_alias}
                onChange={(e) => set("comprador_alias", e.target.value)}
                placeholder="Nombre o alias"
              />
            </div>
            <div className="flex flex-col justify-between">
              <label htmlFor="vendedor" className={labelCls}>
                Vendedor *
              </label>
              <input
                id="vendedor"
                className={inputCls}
                value={form.vendedor_alias}
                onChange={(e) => set("vendedor_alias", e.target.value)}
                placeholder="Nombre o alias"
              />
            </div>
          </div>

          <div>
            <label htmlFor="fecha_evento" className={labelCls}>
              Fecha del evento
            </label>
            <input
              id="fecha_evento"
              type="date"
              className={inputCls}
              value={form.fecha_evento}
              onChange={(e) => set("fecha_evento", e.target.value)}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col justify-between">
              <label htmlFor="monto" className={labelCls}>
                Monto (USD) *
              </label>
              <input
                id="monto"
                type="number"
                min={0}
                inputMode="numeric"
                className={`${inputCls} font-mono`}
                value={form.monto}
                onChange={(e) => set("monto", e.target.value)}
                placeholder="850"
              />
            </div>
            <div className="flex flex-col justify-between">
              <label htmlFor="fee" className={labelCls}>
                Comisión (USD)
              </label>
              <input
                id="fee"
                type="number"
                min={0}
                inputMode="numeric"
                className={`${inputCls} font-mono`}
                value={form.fee}
                onChange={(e) => set("fee", e.target.value)}
                placeholder="60"
              />
            </div>
          </div>

          <div>
            <label htmlFor="notas" className={labelCls}>
              Notas internas (no se ven en el link)
            </label>
            <textarea
              id="notas"
              rows={2}
              maxLength={2000}
              className={`${inputCls} resize-y`}
              value={form.notas}
              onChange={(e) => set("notas", e.target.value)}
              placeholder="Vendedor manda el QR el jueves…"
            />
          </div>
        </div>

        <div className="px-5 pb-5">
          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-xl bg-brand px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-brand-deep disabled:opacity-60"
          >
            {loading ? "Creando…" : "Crear operación"}
          </button>
        </div>
      </div>
    </form>
  );
}
