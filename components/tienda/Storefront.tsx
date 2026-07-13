"use client";

// Tienda pública (TicketMirror) portada del front Vite de PassionEntradas.
// Un solo componente cliente con las dos vistas (home y catálogo); la data
// llega ya cargada desde el server component.

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import {
  buildEvents,
  fmtDate,
  fmtPrice,
  isWC,
  parseTitle,
  waLink,
  type EventoAgrupado,
  type Ticket,
} from "@/lib/tickets";

function Wordmark() {
  return (
    <Link className="wm" href="/">
      <span className="ticketmark">▚</span> TICKET<em>MIRROR</em>
    </Link>
  );
}

function WcLogo({ comp }: { comp: string | null }) {
  if (!isWC(comp)) return null;
  return (
    <span className="wc-logo" title="Mundial" role="img" aria-label="Mundial">
      🏆
    </span>
  );
}

function WaFloat() {
  return (
    <a
      className="wa-float"
      href={waLink("Hola! Quiero consultar por entradas.")}
      target="_blank"
      rel="noopener noreferrer"
      aria-label="WhatsApp"
    >
      WhatsApp
    </a>
  );
}

function Foot() {
  return (
    <footer className="foot">
      <span>TicketMirror</span>
      <span>
        Stock y precios sincronizados desde la fuente ·{" "}
        <Link href="/admin/login">Acceso equipo</Link>
      </span>
    </footer>
  );
}

// ---- fila de sector dentro de la card ----------------------------------------
function LadderRow({ u, ev }: { u: Ticket; ev: EventoAgrupado }) {
  const hasPrice = u.precio_final != null && Number(u.precio_final) > 0;
  const precio = hasPrice ? fmtPrice(u.precio_final) : null;
  const stk = u.stock ?? 0;
  const bookable = stk > 0 && u.estado === "book" && hasPrice;
  const low = stk > 0 && stk <= 2;
  const sector = u.categoria || "Entrada general";
  const msg = bookable
    ? `Hola! Quiero reservar: ${ev.evento} — ${sector}${precio ? ` (${precio})` : ""}. ¿Sigue disponible?`
    : `Hola! Consulto por: ${ev.evento} — ${sector}. ¿Hay disponibilidad?`;
  return (
    <li className={`seat ${bookable ? "" : "seat--req"}`}>
      <span className="seat-name">{sector}</span>
      <span className="seat-price">{precio ?? <span className="consult">Consultar</span>}</span>
      <span className="seat-stat">
        {stk > 0 ? (
          <>
            <i className={`dot ${low ? "low" : "ok"}`} />
            {low ? `Quedan ${stk}` : `${stk} lugares`}
          </>
        ) : u.stock == null && u.estado === "on_request" ? (
          // Stock desconocido (a pedido), no agotado: "sin cupo" espantaba
          // consultas por entradas que sí se pueden conseguir.
          <>
            <i className="dot req" />
            A pedido
          </>
        ) : (
          <>
            <i className="dot req" />
            Sin cupo
          </>
        )}
      </span>
      <a
        className={`seat-act ${bookable ? "go" : "ask"}`}
        href={waLink(msg)}
        target="_blank"
        rel="noopener noreferrer"
      >
        {bookable ? "Reservar" : "Consultar"}
      </a>
    </li>
  );
}

// ---- card de evento (talón) ----------------------------------------------------
function TicketCard({ ev, i, defaultOpen = false }: { ev: EventoAgrupado; i: number; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen);
  const [shared, setShared] = useState(false);
  const rollRef = useRef<HTMLDivElement>(null);
  const { title, context } = parseTitle(ev.evento, ev.comp);
  const date = fmtDate(ev.fecha);
  const n = ev.ubicaciones.length;
  // N.º de talón (cosmético): primer segmento del id del portal, o el uuid
  // para las propias (antes esas mostraban literalmente "N.º manual").
  const segs = (ev.ubicaciones[0]?.id || "").split("::");
  const code = (segs[0] === "manual" ? segs[1] ?? "" : segs[0])
    .replace(/-/g, "")
    .slice(0, 6)
    .padStart(6, "0")
    .toUpperCase();

  useEffect(() => {
    const roll = rollRef.current;
    if (roll) roll.style.maxHeight = open ? roll.scrollHeight + "px" : "0px";
  }, [open]);

  async function share() {
    // Link profundo al evento puntual: el catálogo lo abre filtrado y con la
    // card desplegada (antes se compartía /buscar a secas y el que recibía
    // caía en la cartelera completa sin saber cuál era). Va también la
    // competición: los eventos se agrupan por (competición, evento) y dos
    // torneos pueden repetir el mismo nombre de partido.
    const url = `${location.origin}/buscar?ev=${encodeURIComponent(ev.evento)}&c=${encodeURIComponent(ev.comp)}`;
    const data = { title: "TicketMirror", text: `Mirá las entradas para ${title} en TicketMirror`, url };
    try {
      if (navigator.share) await navigator.share(data);
      else {
        await navigator.clipboard.writeText(url);
        setShared(true);
        setTimeout(() => setShared(false), 1500);
      }
    } catch {}
  }

  return (
    <article
      className={`ticket ${ev.bookable ? "is-live" : ""} ${open ? "open" : ""}`}
      style={{ "--i": Math.min(i, 12) } as React.CSSProperties}
    >
      <div className="ticket-body">
        <div className="ticket-top">
          <div className="top-left">
            {ev.bookable > 0 && <span className="flag">● Reservá ya</span>}
            {ev.propias && <span className="own">Nuestra</span>}
            <WcLogo comp={ev.comp} />
            <span className="eyebrow">{context || ev.comp}</span>
          </div>
          <span className="cal">
            <b>{date.d}</b>
            <span>{date.m}</span>
          </span>
        </div>
        <h3 className="match">{title}</h3>
        <p className="where">
          {ev.ciudad ? "◓ " + ev.ciudad : "Sede a confirmar"} · {date.full}
        </p>
        <div className="ticket-actions">
          <button className="reveal" aria-expanded={open} onClick={() => setOpen(!open)}>
            <span className="reveal-txt">
              {open ? "Ocultar ubicaciones" : `Ver ${n} ${n === 1 ? "ubicación" : "ubicaciones"}`}
            </span>
            <span className="reveal-ic" aria-hidden>
              ▼
            </span>
          </button>
          <button className="share" title="Compartir" onClick={share}>
            {shared ? "✓" : "↗"}
          </button>
        </div>
        <div className="roll-wrap" ref={rollRef} style={{ maxHeight: 0 }}>
          <span className="scroll-rod" aria-hidden />
          {ev.imagen && (
            <img
              src={ev.imagen}
              alt={`Mapa de sectores de ${title}`}
              loading="lazy"
              className="mapa-sectores"
              // La animación de despliegue fija maxHeight con el alto medido
              // al abrir; si la imagen (lazy) carga después, el contenido
              // crecería recortado. Al cargar, re-medimos.
              onLoad={() => {
                const roll = rollRef.current;
                if (roll && open) roll.style.maxHeight = roll.scrollHeight + "px";
              }}
            />
          )}
          <ul className="ladder">
            {ev.ubicaciones.map((u) => (
              <LadderRow key={u.id} u={u} ev={ev} />
            ))}
          </ul>
          <span className="scroll-curl" aria-hidden />
        </div>
      </div>
      <aside className="ticket-stub">
        <span className="stub-label">{ev.minPrice != null ? "Desde" : "Precio"}</span>
        <span className={`stub-price ${ev.minPrice == null ? "is-consult" : ""}`}>
          {ev.minPrice != null ? fmtPrice(ev.minPrice) : "Consultar"}
        </span>
        <span className="stub-meta">
          {n} ubicaciones{ev.bookable ? ` · ${ev.bookable} con stock` : ""}
        </span>
        <span className="barcode" aria-hidden />
        <span className="stub-code">N.º {code}</span>
      </aside>
    </article>
  );
}

// =============================== HOME ==========================================
const PASOS: [string, string][] = [
  ["Buscás", "Filtrá por evento, lugar o fecha y mirá precios y stock reales, actualizados al momento."],
  ["Consultás", "Tocá Reservar o Consultar y nos escribís directo por WhatsApp con el evento ya cargado."],
  ["Asegurás", "Coordinamos pago y te confirmamos la entrada. Simple, sin vueltas."],
];
const PORQUE: [string, string][] = [
  ["Stock real", "Sincronizamos disponibilidad y precios cada pocos minutos: lo que ves es lo que hay."],
  ["Precio claro", "Sin sorpresas: todos los precios están en dólares (USD)."],
  ["Atención directa", "Hablás con una persona por WhatsApp, no con un bot."],
];
const FAQS: [string, string][] = [
  [
    "¿En qué moneda están los precios?",
    "Todos los precios están en dólares estadounidenses (USD). El monto final lo confirmamos al cerrar.",
  ],
  [
    "¿Cómo reservo o consulto?",
    "Cada ubicación tiene un botón que abre WhatsApp con el evento y el sector ya escritos. Nos llega tu mensaje y te respondemos.",
  ],
  [
    "¿Y si no aparece mi evento?",
    "Escribinos igual: conseguimos entradas para muchos eventos que no siempre están listados.",
  ],
  [
    "¿Las entradas tienen disponibilidad real?",
    "Sí. El stock que mostramos viene de la fuente y se actualiza solo; aun así confirmamos antes de cerrar.",
  ],
];

export function StorefrontHome({ rows }: { rows: Ticket[] }) {
  const router = useRouter();
  const events = useMemo(() => buildEvents(rows), [rows]);

  const totalEv = events.length;
  const totalStock = events.reduce((a, e) => a + e.bookStock, 0);
  const populares = events
    .filter((e) => e.bookStock > 0)
    .sort((a, b) => {
      const da = a.fecha ? Date.parse(a.fecha) : Infinity;
      const db = b.fecha ? Date.parse(b.fecha) : Infinity;
      return da - db;
    })
    .slice(0, 6);
  const catCounts = new Map<string, number>();
  for (const e of events) catCounts.set(e.comp, (catCounts.get(e.comp) || 0) + 1);
  const topCats = Array.from(catCounts.entries()).sort((a, b) => b[1] - a[1]).slice(0, 8);

  if (!events.length) return <div className="splash">Todavía no hay eventos cargados.</div>;

  return (
    <>
      <header className="masthead masthead--home">
        <div className="toprow">
          <Wordmark />
        </div>
        <div className="hero hero--home">
          <h1>
            Entradas para los
            <br />
            <span>eventos que importan</span>.
          </h1>
          <p>
            Mundial 2026, Euro 2028, Fórmula 1 y los partidos más buscados, con disponibilidad
            real y precio claro.
          </p>
          <div className="cta-row">
            <button className="btn-primary" onClick={() => router.push("/buscar")}>
              Buscar entradas →
            </button>
            <a
              className="btn-ghost"
              href={waLink("Hola! Quiero consultar por entradas.")}
              target="_blank"
              rel="noopener noreferrer"
            >
              Escribinos por WhatsApp
            </a>
            <span className="stat">
              <b>{totalEv}</b> eventos
            </span>
            <span className="stat">
              <b>{totalStock}</b> entradas para comprar
            </span>
          </div>
        </div>
      </header>

      <section className="block">
        <div className="section-h">
          <span className="sh-eyebrow">Próximos</span>
          <h2>Eventos más cercanos con entradas</h2>
          <p>Los que están a la vuelta de la esquina y todavía tienen lugar.</p>
        </div>
        <ol className="rank">
          {populares.map((ev, idx) => {
            const { title } = parseTitle(ev.evento, ev.comp);
            const date = fmtDate(ev.fecha);
            return (
              <li
                key={ev.comp + ev.evento}
                className="rank-item"
                style={{ "--i": idx } as React.CSSProperties}
                onClick={() => router.push(`/buscar?q=${encodeURIComponent(ev.evento)}`)}
              >
                <div className="rank-main">
                  <span className="rank-eyebrow">
                    <WcLogo comp={ev.comp} />
                    {ev.propias && <span className="own">Nuestra</span>}
                    {ev.comp}
                  </span>
                  <h3 className="rank-title">{title}</h3>
                  <span className="rank-meta">
                    {date.d} {date.m} {date.y} · {ev.lugar}
                  </span>
                </div>
                <div className="rank-aside">
                  <span className="rank-stock">
                    {ev.bookStock} <small>entradas</small>
                  </span>
                  <span className="rank-price">
                    {ev.minPrice != null
                      ? "Desde " + fmtPrice(ev.minPrice)
                      : "A consultar"}
                  </span>
                </div>
                <a
                  className="rank-act"
                  href={waLink(`Hola! Quiero reservar para ${ev.evento}. ¿Qué disponibilidad hay?`)}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={(e) => e.stopPropagation()}
                >
                  Reservar
                </a>
              </li>
            );
          })}
        </ol>
      </section>

      <section className="block">
        <div className="section-h">
          <span className="sh-eyebrow">Explorá</span>
          <h2>Entrá por categoría</h2>
        </div>
        <div className="catstrip">
          {topCats.map(([c, count]) => (
            <button
              key={c}
              className="catlink"
              onClick={() => router.push(`/buscar?cat=${encodeURIComponent(c)}`)}
            >
              {c}
              <small>{count}</small>
            </button>
          ))}
          <button className="catlink catlink--all" onClick={() => router.push("/buscar")}>
            Ver todo<small>{totalEv}</small>
          </button>
        </div>
      </section>

      <section className="block">
        <div className="section-h">
          <span className="sh-eyebrow">Simple</span>
          <h2>Cómo funciona</h2>
        </div>
        <div className="steps">
          {PASOS.map(([t, d], i) => (
            <div className="step" key={t}>
              <span className="step-n">{i + 1}</span>
              <h3>{t}</h3>
              <p>{d}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="block">
        <div className="section-h">
          <span className="sh-eyebrow">Confianza</span>
          <h2>Por qué TicketMirror</h2>
        </div>
        <div className="cards3">
          {PORQUE.map(([t, d]) => (
            <div className="card3" key={t}>
              <h3>{t}</h3>
              <p>{d}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="block">
        <div className="section-h">
          <span className="sh-eyebrow">Dudas</span>
          <h2>Preguntas frecuentes</h2>
        </div>
        <div className="faq">
          {FAQS.map(([q, a]) => (
            <details className="faq-item" key={q}>
              <summary>{q}</summary>
              <p>{a}</p>
            </details>
          ))}
        </div>
      </section>

      <section className="cta-band">
        <div>
          <h2>¿Buscás un evento puntual?</h2>
          <p>Escribinos y te decimos al toque si lo conseguimos.</p>
        </div>
        <a
          className="btn-primary"
          href={waLink("Hola! Estoy buscando entradas para un evento.")}
          target="_blank"
          rel="noopener noreferrer"
        >
          Consultar por WhatsApp
        </a>
      </section>

      <Foot />
      <WaFloat />
    </>
  );
}

// =============================== CATÁLOGO ======================================
// `evento` es el link profundo compartido (?ev=): match exacto de un evento,
// tiene prioridad sobre el resto de los filtros y se limpia al tocar cualquier
// filtro. Vacío = navegación normal.
type FilterState = { cat: string; lugar: string; mes: string; q: string; evento: string; comp: string };

function uniqueOptions(
  events: EventoAgrupado[],
  getter: (e: EventoAgrupado) => { key: string; label: string },
  sortByCount: boolean
) {
  const counts = new Map<string, { label: string; key: string; n: number }>();
  for (const ev of events) {
    const v = getter(ev);
    counts.set(v.key, { label: v.label, key: v.key, n: (counts.get(v.key)?.n || 0) + 1 });
  }
  let arr = Array.from(counts.values());
  arr = sortByCount
    ? arr.sort((a, b) => b.n - a.n || a.label.localeCompare(b.label))
    : arr.sort((a, b) => a.key.localeCompare(b.key));
  return arr.map((a) => ({ value: a.key, label: `${a.label} (${a.n})` }));
}

// A nivel módulo (no adentro del render): definido adentro, React lo veía
// como un componente NUEVO en cada render y remontaba los <select>,
// perdiendo el foco mientras se tipeaba en el buscador.
function Select({
  id,
  label,
  value,
  options,
  onChange,
}: {
  id: string;
  label: string;
  value: string;
  options: { value: string; label: string }[];
  onChange: (v: string) => void;
}) {
  return (
    <label className="sel">
      <span>{label}</span>
      <select id={id} value={value} onChange={(e) => onChange(e.target.value)}>
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  );
}

export function StorefrontCatalog({ rows }: { rows: Ticket[] }) {
  const router = useRouter();
  const params = useSearchParams();
  const events = useMemo(() => buildEvents(rows), [rows]);
  const [state, setState] = useState<FilterState>({
    cat: params.get("cat") || "*",
    lugar: params.get("lugar") || "*",
    mes: params.get("mes") || "*",
    q: params.get("q") || "",
    evento: params.get("ev") || "",
    comp: params.get("c") || "",
  });

  const filtered = useMemo(() => {
    const out = events.filter((ev) => {
      // Link compartido: solo ese evento (y su competición, si vino en el
      // link: dos torneos pueden repetir nombre de partido).
      if (state.evento) {
        return ev.evento === state.evento && (!state.comp || ev.comp === state.comp);
      }
      if (state.cat !== "*" && ev.comp !== state.cat) return false;
      if (state.lugar !== "*" && ev.lugar !== state.lugar) return false;
      if (state.mes !== "*" && ev.mes !== state.mes) return false;
      if (state.q) {
        const q = state.q.toLowerCase();
        const hit =
          ev.evento.toLowerCase().includes(q) ||
          (ev.ciudad || "").toLowerCase().includes(q) ||
          ev.ubicaciones.some((u) => (u.categoria || "").toLowerCase().includes(q));
        if (!hit) return false;
      }
      return true;
    });
    out.sort((a, b) => {
      if (!!a.bookable !== !!b.bookable) return b.bookable - a.bookable;
      const da = a.fecha ? Date.parse(a.fecha) : Infinity;
      const db = b.fecha ? Date.parse(b.fecha) : Infinity;
      return da - db;
    });
    return out;
  }, [events, state]);

  // Paginación client-side: la cartelera crece con cada sync y una lista
  // infinita se vuelve inmanejable en móvil.
  const PAGE_SIZE = 12;
  const [page, setPage] = useState(1);
  // Al cambiar cualquier filtro se vuelve a la primera página.
  useEffect(() => {
    setPage(1);
  }, [state.cat, state.lugar, state.mes, state.q, state.evento]);

  // Link compartido: centrar la card del evento apenas se abre la página.
  // (La card ya viene desplegada por defaultOpen.)
  useEffect(() => {
    if (!state.evento) return;
    const t = setTimeout(() => {
      document
        .querySelector(".feed .ticket")
        ?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 120);
    return () => clearTimeout(t);
  }, [state.evento]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const pageSafe = Math.min(page, totalPages);
  const pageStart = (pageSafe - 1) * PAGE_SIZE;
  const visible = filtered.slice(pageStart, pageStart + PAGE_SIZE);

  function goToPage(p: number) {
    setPage(p);
    // La cartelera puede ser larga: al paginar volvemos al inicio de la lista.
    document.querySelector(".result-line")?.scrollIntoView({ behavior: "smooth" });
  }

  const catOpts = [
    { value: "*", label: "Todas las categorías" },
    ...uniqueOptions(events, (e) => ({ key: e.comp, label: e.comp }), true),
  ];
  const lugarOpts = [
    { value: "*", label: "Todos los lugares" },
    ...uniqueOptions(events, (e) => ({ key: e.lugar, label: e.lugar }), true),
  ];
  const mesOpts = [
    { value: "*", label: "Todas las fechas" },
    ...uniqueOptions(events, (e) => ({ key: e.mes, label: e.mesLabel }), false),
  ];
  const filtrando =
    state.cat !== "*" || state.lugar !== "*" || state.mes !== "*" || !!state.q || !!state.evento;

  return (
    <>
      <header className="masthead masthead--cat">
        <div className="toprow">
          <Wordmark />
          <div className="mast-right">
            <button className="back" onClick={() => router.push("/")}>
              ← Inicio
            </button>
          </div>
        </div>
      </header>

      <div className="bar">
        <div className="filters">
          {/* Tocar un filtro libera el link compartido (evento: "") para
              volver a la navegación normal. */}
          <Select
            id="f-cat"
            label="Categoría"
            value={state.cat}
            options={catOpts}
            onChange={(v) => setState((s) => ({ ...s, cat: v, evento: "", comp: "" }))}
          />
          <Select
            id="f-lugar"
            label="Lugar"
            value={state.lugar}
            options={lugarOpts}
            onChange={(v) => setState((s) => ({ ...s, lugar: v, evento: "", comp: "" }))}
          />
          <Select
            id="f-mes"
            label="Fecha"
            value={state.mes}
            options={mesOpts}
            onChange={(v) => setState((s) => ({ ...s, mes: v, evento: "", comp: "" }))}
          />
        </div>
        <input
          className="search"
          type="search"
          placeholder="Buscar equipo, sede o sector"
          value={state.q}
          onChange={(e) => setState((s) => ({ ...s, q: e.target.value, evento: "", comp: "" }))}
        />
      </div>

      <div className="result-line">
        <b>{filtered.length}</b> {filtered.length === 1 ? "evento" : "eventos"}
        {totalPages > 1 && (
          <span className="range">
            {" "}· Mostrando {pageStart + 1}–{Math.min(pageStart + PAGE_SIZE, filtered.length)}
          </span>
        )}
        {filtrando && (
          <button
            className="clear"
            onClick={() => setState({ cat: "*", lugar: "*", mes: "*", q: "", evento: "", comp: "" })}
          >
            Limpiar filtros
          </button>
        )}
      </div>

      <main className="feed">
        {filtered.length ? (
          visible.map((ev, i) => (
            <TicketCard
              key={ev.comp + ev.evento}
              ev={ev}
              i={i}
              defaultOpen={
                !!state.evento &&
                ev.evento === state.evento &&
                (!state.comp || ev.comp === state.comp)
              }
            />
          ))
        ) : (
          <p className="empty">
            Ningún evento coincide con estos filtros.
            <br />
            <a
              href={waLink("Hola! Busco un evento que no aparece en la web.")}
              target="_blank"
              rel="noopener noreferrer"
            >
              Consultanos por WhatsApp
            </a>{" "}
            y lo buscamos.
          </p>
        )}
      </main>

      {totalPages > 1 && (
        <nav className="pager" aria-label="Paginación de eventos">
          <button
            className="pager-btn"
            disabled={pageSafe <= 1}
            onClick={() => goToPage(pageSafe - 1)}
          >
            ← Anterior
          </button>
          <span className="pager-info">
            Página {pageSafe} de {totalPages}
          </span>
          <button
            className="pager-btn"
            disabled={pageSafe >= totalPages}
            onClick={() => goToPage(pageSafe + 1)}
          >
            Siguiente →
          </button>
        </nav>
      )}

      <Foot />
      <WaFloat />
    </>
  );
}
