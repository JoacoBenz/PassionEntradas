"use client";

// Tienda pública (TicketMirror) portada del front Vite de PassionEntradas.
// Un solo componente cliente con las dos vistas (home y catálogo); la data
// llega ya cargada desde el server component.
// Bilingüe EN/ES (default inglés): los textos viven en lib/tienda-i18n.ts y
// el toggle del header se recuerda en localStorage.

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
import { LANGS, mesLabelLang, TX, type Lang } from "@/lib/tienda-i18n";

// Idioma elegido: default inglés; se recuerda entre visitas.
function useLang() {
  const [lang, setLang] = useState<Lang>("en");
  useEffect(() => {
    const saved = localStorage.getItem("tm_lang");
    if (saved === "en" || saved === "es") setLang(saved);
  }, []);
  function change(l: Lang) {
    setLang(l);
    localStorage.setItem("tm_lang", l);
  }
  return [lang, change] as const;
}

function LangToggle({ lang, onChange }: { lang: Lang; onChange: (l: Lang) => void }) {
  return (
    <div className="lang" role="group" aria-label="Language / Idioma">
      {LANGS.map((l) => (
        <button
          key={l}
          className={`lang-btn ${l === lang ? "active" : ""}`}
          onClick={() => onChange(l)}
          aria-pressed={l === lang}
        >
          {l.toUpperCase()}
        </button>
      ))}
    </div>
  );
}

// Link profundo al evento (mismo formato que el botón compartir) para pegar
// en los mensajes de WhatsApp: el agente abre y ve exactamente qué entrada
// le están pidiendo. Base determinística (env con fallback al dominio de
// prod) para que el server y el cliente rendericen el mismo href.
const SITE_BASE = (
  process.env.NEXT_PUBLIC_SITE_URL || "https://tickermirror.vercel.app"
).replace(/\/$/, "");

function eventoLink(evento: string, comp: string): string {
  return `${SITE_BASE}/buscar?ev=${encodeURIComponent(evento)}&c=${encodeURIComponent(comp)}`;
}

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
    <span className="wc-logo" title="World Cup" role="img" aria-label="World Cup">
      🏆
    </span>
  );
}

// Widget de WhatsApp: el botón flotante abre un panel con los agentes y su
// estado (disponible / con un cliente). Los estados rotan solos en
// intervalos irregulares — transmite que del otro lado hay gente atendiendo.
// Cada agente chatea desde SU número (no el general de la tienda).
const AGENTES = [
  { nombre: "Kiru", inicial: "K", telefono: "5492944806666" },
  { nombre: "Nacho", inicial: "N", telefono: "5491136148053" },
] as const;

function waAgente(telefono: string, text: string): string {
  return `https://wa.me/${telefono}?text=${encodeURIComponent(text)}`;
}

type EstadoAgente = "disponible" | "ocupado";

function WaFloat({ lang }: { lang: Lang }) {
  const t = TX[lang];
  const [abierto, setAbierto] = useState(false);
  // Arranca con ambos disponibles (mismo HTML en server y cliente: nada de
  // Math.random en el render inicial o rompería la hidratación). Recién
  // montado, cada agente empieza a alternar por su cuenta.
  const [estados, setEstados] = useState<EstadoAgente[]>(["disponible", "disponible"]);

  useEffect(() => {
    const timers: ReturnType<typeof setTimeout>[] = [];
    function programar(i: number, delay: number) {
      timers[i] = setTimeout(() => {
        setEstados((prev) => {
          const nx = [...prev];
          // Sesgo a "disponible" (65%): ocupado aparece lo justo para que
          // se note movimiento sin espantar consultas.
          nx[i] = Math.random() < 0.65 ? "disponible" : "ocupado";
          return nx;
        });
        programar(i, 15000 + Math.random() * 35000);
      }, delay);
    }
    // Primer cambio a los pocos segundos, después cada 15-50s cada uno.
    programar(0, 6000 + Math.random() * 10000);
    programar(1, 12000 + Math.random() * 14000);
    return () => timers.forEach(clearTimeout);
  }, []);

  return (
    <div className="wa-widget">
      {abierto && (
        <div className="wa-panel" role="dialog" aria-label={t.waTitle}>
          <div className="wa-panel-head">
            <p className="wa-panel-title">{t.waTitle}</p>
            <p className="wa-panel-sub">{t.waSubtitle}</p>
          </div>
          {AGENTES.map((a, i) => {
            const disponible = estados[i] === "disponible";
            return (
              <div key={a.nombre} className="wa-agente">
                <span className={`wa-avatar ${i === 0 ? "wa-avatar--a" : "wa-avatar--b"}`}>
                  {a.inicial}
                </span>
                <span className="wa-agente-info">
                  <span className="wa-agente-nombre">{a.nombre}</span>
                  <span className={`wa-agente-estado ${disponible ? "on" : "off"}`}>
                    <i aria-hidden />
                    {disponible ? t.waDisponible : t.waOcupado}
                  </span>
                </span>
                <a
                  className="wa-agente-btn"
                  href={waAgente(a.telefono, t.waAgenteMsg(a.nombre))}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={() => setAbierto(false)}
                >
                  {t.waChat}
                </a>
              </div>
            );
          })}
        </div>
      )}
      <button
        className="wa-float"
        onClick={() => setAbierto((v) => !v)}
        aria-expanded={abierto}
        aria-label="WhatsApp"
      >
        {abierto ? "✕" : "WhatsApp"}
      </button>
    </div>
  );
}

function Foot({ lang }: { lang: Lang }) {
  const t = TX[lang];
  return (
    <footer className="foot">
      <span>TicketMirror</span>
      <span>
        {t.footSync} · <Link href="/admin/login">{t.footTeam}</Link>
      </span>
    </footer>
  );
}

// ---- fila de sector dentro de la card ----------------------------------------
function LadderRow({ u, ev, lang }: { u: Ticket; ev: EventoAgrupado; lang: Lang }) {
  const t = TX[lang];
  const hasPrice = u.precio_final != null && Number(u.precio_final) > 0;
  const precio = hasPrice ? fmtPrice(u.precio_final, lang) : null;
  const stk = u.stock ?? 0;
  const bookable = stk > 0 && u.estado === "book" && hasPrice;
  const low = stk > 0 && stk <= 2;
  const sector = u.categoria || t.entradaGeneral;
  const link = eventoLink(ev.evento, ev.comp);
  const msg = bookable
    ? t.msgReservar(ev.evento, sector, precio ?? "", link)
    : t.msgConsultar(ev.evento, sector, link);
  return (
    <li className={`seat ${bookable ? "" : "seat--req"}`}>
      <span className="seat-name">{sector}</span>
      <span className="seat-price">{precio ?? <span className="consult">{t.consultar}</span>}</span>
      <span className="seat-stat">
        {stk > 0 ? (
          <>
            <i className={`dot ${low ? "low" : "ok"}`} />
            {low ? t.quedan(stk) : t.lugares(stk)}
          </>
        ) : u.stock == null && u.estado === "on_request" ? (
          // Stock desconocido (a pedido), no agotado: "sin cupo" espantaba
          // consultas por entradas que sí se pueden conseguir.
          <>
            <i className="dot req" />
            {t.aPedido}
          </>
        ) : (
          <>
            <i className="dot req" />
            {t.sinCupo}
          </>
        )}
      </span>
      <a
        className={`seat-act ${bookable ? "go" : "ask"}`}
        href={waLink(msg)}
        target="_blank"
        rel="noopener noreferrer"
      >
        {bookable ? t.reservar : t.consultar}
      </a>
    </li>
  );
}

// ---- card de evento (talón) ----------------------------------------------------
function TicketCard({
  ev,
  i,
  lang,
  defaultOpen = false,
}: {
  ev: EventoAgrupado;
  i: number;
  lang: Lang;
  defaultOpen?: boolean;
}) {
  const t = TX[lang];
  const [open, setOpen] = useState(defaultOpen);
  const [shared, setShared] = useState(false);
  const rollRef = useRef<HTMLDivElement>(null);
  const { title, context } = parseTitle(ev.evento, ev.comp);
  const date = fmtDate(ev.fecha, lang);
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
    const data = { title: "TicketMirror", text: t.shareText(title), url };
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
            {ev.bookable > 0 && <span className="flag">{t.bookNow}</span>}
            {ev.propias && <span className="own">{t.nuestra}</span>}
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
          {ev.ciudad ? "◓ " + ev.ciudad : t.sedeTBC} · {date.full}
        </p>
        <div className="ticket-actions">
          <button className="reveal" aria-expanded={open} onClick={() => setOpen(!open)}>
            <span className="reveal-txt">{open ? t.ocultarUbic : t.verUbic(n)}</span>
            <span className="reveal-ic" aria-hidden>
              ▼
            </span>
          </button>
          <button className="share" title="Share" onClick={share}>
            {shared ? "✓" : "↗"}
          </button>
        </div>
        <div className="roll-wrap" ref={rollRef} style={{ maxHeight: 0 }}>
          <span className="scroll-rod" aria-hidden />
          {ev.imagen && (
            <img
              src={ev.imagen}
              alt={`${title} — seating map`}
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
              <LadderRow key={u.id} u={u} ev={ev} lang={lang} />
            ))}
          </ul>
          <span className="scroll-curl" aria-hidden />
        </div>
      </div>
      <aside className="ticket-stub">
        <span className="stub-label">{ev.minPrice != null ? t.desde : t.precio}</span>
        <span className={`stub-price ${ev.minPrice == null ? "is-consult" : ""}`}>
          {ev.minPrice != null ? fmtPrice(ev.minPrice, lang) : t.consultar}
        </span>
        <span className="stub-meta">
          {t.ubicaciones(n)}
          {ev.bookable ? t.conStock(ev.bookable) : ""}
        </span>
        <span className="barcode" aria-hidden />
        <span className="stub-code">N.º {code}</span>
      </aside>
    </article>
  );
}

// =============================== HOME ==========================================
export function StorefrontHome({ rows }: { rows: Ticket[] }) {
  const router = useRouter();
  const [lang, setLang] = useLang();
  const t = TX[lang];
  const events = useMemo(() => buildEvents(rows), [rows]);

  const totalEv = events.length;
  const totalStock = events.reduce((a, e) => a + e.bookStock, 0);
  // Los 6 más próximos por fecha, tengan stock de compra o sean "a pedido":
  // un partidazo On Request (ej: una semi del Mundial) también va en la
  // vidriera — cambia la acción (Consultar en vez de Reservar), no el lugar.
  const populares = [...events]
    .sort((a, b) => {
      const da = a.fecha ? Date.parse(a.fecha) : Infinity;
      const db = b.fecha ? Date.parse(b.fecha) : Infinity;
      return da - db;
    })
    .slice(0, 6);
  const catCounts = new Map<string, number>();
  for (const e of events) catCounts.set(e.comp, (catCounts.get(e.comp) || 0) + 1);
  const topCats = Array.from(catCounts.entries()).sort((a, b) => b[1] - a[1]).slice(0, 8);

  if (!events.length) return <div className="splash">No events yet.</div>;

  return (
    <>
      <header className="masthead masthead--home">
        <div className="toprow">
          <Wordmark />
          <LangToggle lang={lang} onChange={setLang} />
        </div>
        <div className="hero hero--home">
          <h1>
            {t.heroTitle1}
            <br />
            <span>{t.heroTitle2}</span>.
          </h1>
          <p>{t.heroP}</p>
          <div className="cta-row">
            <button className="btn-primary" onClick={() => router.push("/buscar")}>
              {t.ctaSearch}
            </button>
            <a
              className="btn-ghost"
              href={waLink(t.waFloatMsg)}
              target="_blank"
              rel="noopener noreferrer"
            >
              {t.ctaWhatsapp}
            </a>
            <span className="stat">
              <b>{totalEv}</b> {t.statEventos}
            </span>
            <span className="stat">
              <b>{totalStock}</b> {t.statStock}
            </span>
          </div>
        </div>
      </header>

      <section className="block">
        <div className="section-h">
          <span className="sh-eyebrow">{t.proximosEyebrow}</span>
          <h2>{t.proximosH2}</h2>
          <p>{t.proximosP}</p>
        </div>
        <ol className="rank">
          {populares.map((ev, idx) => {
            const { title } = parseTitle(ev.evento, ev.comp);
            const date = fmtDate(ev.fecha, lang);
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
                    {ev.propias && <span className="own">{t.nuestra}</span>}
                    {ev.comp}
                  </span>
                  <h3 className="rank-title">{title}</h3>
                  <span className="rank-meta">
                    {date.d} {date.m} {date.y} · {ev.lugar}
                  </span>
                </div>
                <div className="rank-aside">
                  <span className="rank-stock">
                    {ev.bookStock > 0 ? (
                      <>
                        {ev.bookStock} <small>{t.entradasRank}</small>
                      </>
                    ) : (
                      <small>{t.aPedido}</small>
                    )}
                  </span>
                  <span className="rank-price">
                    {ev.minPrice != null
                      ? t.desdeMayus + " " + fmtPrice(ev.minPrice, lang)
                      : t.aConsultar}
                  </span>
                </div>
                <a
                  className="rank-act"
                  href={waLink(
                    ev.bookStock > 0
                      ? t.msgReservarRank(ev.evento, eventoLink(ev.evento, ev.comp))
                      : t.msgConsultarRank(ev.evento, eventoLink(ev.evento, ev.comp))
                  )}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={(e) => e.stopPropagation()}
                >
                  {ev.bookStock > 0 ? t.reservar : t.consultar}
                </a>
              </li>
            );
          })}
        </ol>
      </section>

      <section className="block">
        <div className="section-h">
          <span className="sh-eyebrow">{t.exploraEyebrow}</span>
          <h2>{t.exploraH2}</h2>
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
            {t.verTodo}
            <small>{totalEv}</small>
          </button>
        </div>
      </section>

      <section className="block">
        <div className="section-h">
          <span className="sh-eyebrow">{t.comoEyebrow}</span>
          <h2>{t.comoH2}</h2>
        </div>
        <div className="steps">
          {t.pasos.map(([tt, d], i) => (
            <div className="step" key={tt}>
              <span className="step-n">{i + 1}</span>
              <h3>{tt}</h3>
              <p>{d}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="block">
        <div className="section-h">
          <span className="sh-eyebrow">{t.porqueEyebrow}</span>
          <h2>{t.porqueH2}</h2>
        </div>
        <div className="cards3">
          {t.porque.map(([tt, d]) => (
            <div className="card3" key={tt}>
              <h3>{tt}</h3>
              <p>{d}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="block">
        <div className="section-h">
          <span className="sh-eyebrow">{t.dudasEyebrow}</span>
          <h2>{t.dudasH2}</h2>
        </div>
        <div className="faq">
          {t.faqs.map(([q, a]) => (
            <details className="faq-item" key={q}>
              <summary>{q}</summary>
              <p>{a}</p>
            </details>
          ))}
        </div>
      </section>

      <section className="cta-band">
        <div>
          <h2>{t.ctaBandH2}</h2>
          <p>{t.ctaBandP}</p>
        </div>
        <a
          className="btn-primary"
          href={waLink(t.msgBuscoEvento)}
          target="_blank"
          rel="noopener noreferrer"
        >
          {t.ctaBandBtn}
        </a>
      </section>

      <Foot lang={lang} />
      <WaFloat lang={lang} />
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
  const [lang, setLang] = useLang();
  const t = TX[lang];
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
    { value: "*", label: t.todasCategorias },
    ...uniqueOptions(events, (e) => ({ key: e.comp, label: e.comp }), true),
  ];
  const lugarOpts = [
    { value: "*", label: t.todosLugares },
    ...uniqueOptions(events, (e) => ({ key: e.lugar, label: e.lugar }), true),
  ];
  // El label del mes se arma acá (no en buildEvents) para que siga el idioma.
  const mesOpts = [
    { value: "*", label: t.todasFechas },
    ...uniqueOptions(events, (e) => ({ key: e.mes, label: mesLabelLang(e.mes, lang) }), false),
  ];
  const filtrando =
    state.cat !== "*" || state.lugar !== "*" || state.mes !== "*" || !!state.q || !!state.evento;

  return (
    <>
      <header className="masthead masthead--cat">
        <div className="toprow">
          <Wordmark />
          <div className="mast-right">
            <LangToggle lang={lang} onChange={setLang} />
            <button className="back" onClick={() => router.push("/")}>
              {t.backHome}
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
            label={t.fCategoria}
            value={state.cat}
            options={catOpts}
            onChange={(v) => setState((s) => ({ ...s, cat: v, evento: "", comp: "" }))}
          />
          <Select
            id="f-lugar"
            label={t.fLugar}
            value={state.lugar}
            options={lugarOpts}
            onChange={(v) => setState((s) => ({ ...s, lugar: v, evento: "", comp: "" }))}
          />
          <Select
            id="f-mes"
            label={t.fFecha}
            value={state.mes}
            options={mesOpts}
            onChange={(v) => setState((s) => ({ ...s, mes: v, evento: "", comp: "" }))}
          />
        </div>
        <input
          className="search"
          type="search"
          placeholder={t.buscarPlaceholder}
          value={state.q}
          onChange={(e) => setState((s) => ({ ...s, q: e.target.value, evento: "", comp: "" }))}
        />
      </div>

      <div className="result-line">
        <b>{filtered.length}</b> {t.eventos(filtered.length)}
        {totalPages > 1 && (
          <span className="range">
            {t.mostrando(pageStart + 1, Math.min(pageStart + PAGE_SIZE, filtered.length))}
          </span>
        )}
        {filtrando && (
          <button
            className="clear"
            onClick={() => setState({ cat: "*", lugar: "*", mes: "*", q: "", evento: "", comp: "" })}
          >
            {t.limpiar}
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
              lang={lang}
              defaultOpen={
                !!state.evento &&
                ev.evento === state.evento &&
                (!state.comp || ev.comp === state.comp)
              }
            />
          ))
        ) : (
          <p className="empty">
            {t.vacio1}
            <br />
            <a href={waLink(t.msgBuscoEvento)} target="_blank" rel="noopener noreferrer">
              {t.vacioLink}
            </a>{" "}
            {t.vacio2}
          </p>
        )}
      </main>

      {totalPages > 1 && (
        <nav className="pager" aria-label="Pagination">
          <button
            className="pager-btn"
            disabled={pageSafe <= 1}
            onClick={() => goToPage(pageSafe - 1)}
          >
            {t.anterior}
          </button>
          <span className="pager-info">{t.pagina(pageSafe, totalPages)}</span>
          <button
            className="pager-btn"
            disabled={pageSafe >= totalPages}
            onClick={() => goToPage(pageSafe + 1)}
          >
            {t.siguiente}
          </button>
        </nav>
      )}

      <Foot lang={lang} />
      <WaFloat lang={lang} />
    </>
  );
}
