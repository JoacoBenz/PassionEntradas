import "./style.css";

const SUPA_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPA_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;

const app = document.querySelector("#app");

// ---- helpers ---------------------------------------------------------------
const fmtMoney = (n, cur) =>
  n == null
    ? null
    : new Intl.NumberFormat("es-AR", {
        style: "currency",
        currency: cur || "EUR",
        maximumFractionDigits: 0,
      }).format(Number(n));

// Compacto para el talón: "€ 12.000" (sin el código "EUR" largo).
const fmtEuro = (n) => (n == null ? null : "€ " + new Intl.NumberFormat("es-AR", { maximumFractionDigits: 0 }).format(Number(n)));

const fmtDate = (iso) => {
  if (!iso) return { d: "—", m: "", y: "", full: "Fecha a confirmar" };
  const dt = new Date(iso);
  return {
    d: dt.toLocaleDateString("es-AR", { day: "2-digit" }),
    m: dt.toLocaleDateString("es-AR", { month: "short" }).replace(".", "").toUpperCase(),
    y: dt.toLocaleDateString("es-AR", { year: "numeric" }),
    full: dt.toLocaleDateString("es-AR", { weekday: "long", day: "2-digit", month: "long", year: "numeric" }),
  };
};

const esc = (s) =>
  String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

function parseTitle(evento, comp) {
  let s = String(evento || "").replace(/^match\s+\d+\s*[,-]\s*/i, "").trim();
  const segs = s.split(/\s+-\s+/).map((x) => x.trim()).filter(Boolean);
  if (segs.length <= 1) return { title: s || evento, context: "" };
  const title = segs[segs.length - 1];
  let context = segs.slice(0, -1).join(" · ");
  if (comp) context = context.replace(comp, "").replace(/^[\s·]+|[\s·]+$/g, "");
  return { title, context };
}

const isWC = (comp) => /world cup/i.test(comp || "");
function wcLogo(comp) {
  if (!isWC(comp)) return "";
  return `<span class="wc-logo" title="Mundial" role="img" aria-label="Mundial">🏆</span>`;
}

function lugarDe(ciudad) {
  if (!ciudad) return "Sin sede";
  const m = ciudad.match(/\(([^)]+)\)\s*$/);
  if (m) return m[1].trim();
  return ciudad.split(",")[0].trim();
}

const mesKey = (iso) => (iso ? iso.slice(0, 7) : "0000-00");
const mesLabel = (iso) =>
  iso
    ? new Date(iso).toLocaleDateString("es-AR", { month: "long", year: "numeric" }).replace(/^\w/, (c) => c.toUpperCase())
    : "A confirmar";

// ---- data ------------------------------------------------------------------
async function fetchTickets() {
  const cols = "id,evento,competicion,fecha,ciudad,categoria,precio_final,moneda_final,stock,estado";
  const url = `${SUPA_URL}/rest/v1/tickets?select=${cols}&order=fecha.asc.nullslast`;
  const res = await fetch(url, { headers: { apikey: SUPA_KEY, Authorization: `Bearer ${SUPA_KEY}` } });
  if (!res.ok) throw new Error(`Supabase ${res.status}: ${await res.text()}`);
  return res.json();
}

function buildEvents(rows) {
  const map = new Map();
  for (const r of rows) {
    const key = `${r.competicion}__${r.evento}`;
    if (!map.has(key))
      map.set(key, { evento: r.evento, comp: r.competicion || "Otros", ciudad: r.ciudad, fecha: r.fecha, ubicaciones: [] });
    const ev = map.get(key);
    ev.ubicaciones.push(r);
    if (!ev.fecha && r.fecha) ev.fecha = r.fecha;
    if (!ev.ciudad && r.ciudad) ev.ciudad = r.ciudad;
  }
  const evs = [...map.values()];
  for (const ev of evs) {
    ev.lugar = lugarDe(ev.ciudad);
    ev.mes = mesKey(ev.fecha);
    ev.mesLabel = mesLabel(ev.fecha);
    const book = ev.ubicaciones.filter((u) => (u.stock ?? 0) > 0 && u.estado === "book");
    ev.bookable = book.length;
    ev.bookStock = book.reduce((a, u) => a + (u.stock ?? 0), 0); // entradas comprables
    // "desde": menor precio REAL (>0). Prioriza lo reservable; ignora 0/null
    // (sectores sin precio o agotados, como GA/VIP de F1 que vienen en 0).
    const precioPos = (arr) => arr.map((u) => Number(u.precio_final)).filter((n) => Number.isFinite(n) && n > 0);
    const reservables = precioPos(book);
    const todos = precioPos(ev.ubicaciones);
    ev.minPrice = reservables.length ? Math.min(...reservables) : todos.length ? Math.min(...todos) : null;
    // TODO: enganchar acá el flujo de compra/contacto propio (checkout, WhatsApp,
    // mail, etc.). Por ahora los botones son placeholders y NO linkean al portal.
    ev.ubicaciones.sort((a, b) => {
      const pa = a.precio_final == null ? Infinity : Number(a.precio_final);
      const pb = b.precio_final == null ? Infinity : Number(b.precio_final);
      return pa - pb;
    });
  }
  return evs;
}

// ---- shared bits -----------------------------------------------------------
function wordmark() {
  return `<button class="wm" id="home-link"><span class="ticketmark">▚</span> TICKER<em>MIRROR</em></button>`;
}

function ladderRow(u) {
  const hasPrice = u.precio_final != null && Number(u.precio_final) > 0;
  const precio = hasPrice ? fmtMoney(u.precio_final, u.moneda_final) : null;
  const stk = u.stock ?? 0;
  const bookable = stk > 0 && u.estado === "book" && hasPrice;
  const low = stk > 0 && stk <= 2;
  const sector = u.categoria || "Entrada general";
  const stat =
    stk > 0
      ? `<i class="dot ${low ? "low" : "ok"}"></i>${low ? `quedan ${stk}` : `${stk} lugares`}`
      : `<i class="dot req"></i>sin cupo`;
  return `
    <li class="seat ${bookable ? "" : "seat--req"}">
      <span class="seat-name">${esc(sector)}</span>
      <span class="seat-price">${precio ? esc(precio) : '<span class="consult">Consultar</span>'}</span>
      <span class="seat-stat">${stat}</span>
      <a class="seat-act ${bookable ? "go" : "ask"}" href="#" data-placeholder>
        ${bookable ? "Reservar" : "Consultar"}
      </a>
    </li>`;
}

function stub(ev, i) {
  const { title, context } = parseTitle(ev.evento, ev.comp);
  const date = fmtDate(ev.fecha);
  const code = (ev.ubicaciones[0]?.id || "").split("::")[0].padStart(6, "0");
  const n = ev.ubicaciones.length;
  return `
    <article class="ticket ${ev.bookable ? "is-live" : ""}" style="--i:${Math.min(i, 12)}">
      <div class="ticket-body">
        <div class="ticket-top">
          <div class="top-left">
            ${ev.bookable ? `<span class="flag">● Reservá ya</span>` : ""}
            ${wcLogo(ev.comp)}
            <span class="eyebrow">${esc(context || ev.comp)}</span>
          </div>
          <span class="cal"><b>${date.d}</b><span>${date.m}</span></span>
        </div>
        <h3 class="match">${esc(title)}</h3>
        <p class="where">${ev.ciudad ? "◓ " + esc(ev.ciudad) : "Sede a confirmar"} · ${esc(date.full)}</p>
        <button class="reveal" aria-expanded="false">
          <span class="reveal-txt">Ver ${n} ${n === 1 ? "ubicación" : "ubicaciones"}</span>
          <span class="reveal-ic" aria-hidden="true">▼</span>
        </button>
        <div class="roll-wrap">
          <span class="scroll-rod" aria-hidden="true"></span>
          <ul class="ladder">${ev.ubicaciones.map(ladderRow).join("")}</ul>
          <span class="scroll-curl" aria-hidden="true"></span>
        </div>
      </div>
      <aside class="ticket-stub">
        <span class="stub-label">${ev.minPrice != null ? "desde" : "precio"}</span>
        <span class="stub-price ${ev.minPrice == null ? "is-consult" : ""}">${ev.minPrice != null ? esc(fmtEuro(ev.minPrice)) : "Consultar"}</span>
        <span class="stub-meta">${ev.ubicaciones.length} ubicaciones${ev.bookable ? ` · ${ev.bookable} con stock` : ""}</span>
        <span class="barcode" aria-hidden="true"></span>
        <span class="stub-code">N.º ${esc(code)}</span>
      </aside>
    </article>`;
}

// ---- state + routing -------------------------------------------------------
let EVENTS = [];
const state = { cat: "*", lugar: "*", mes: "*", q: "" };

const viewFromHash = () => (location.hash === "#buscar" ? "catalog" : "home");

function go(view, preset) {
  if (preset) Object.assign(state, { cat: "*", lugar: "*", mes: "*", q: "", ...preset });
  const target = view === "catalog" ? "#buscar" : "#inicio";
  if (location.hash === target) route();
  else location.hash = target; // dispara hashchange -> route
}

function route() {
  (viewFromHash() === "catalog" ? renderCatalog : renderHome)();
  window.scrollTo(0, 0);
}

function wireWordmark() {
  app.querySelector("#home-link")?.addEventListener("click", () => go("home"));
}

// ---- HOME ------------------------------------------------------------------
function rankItem(ev, idx) {
  const { title } = parseTitle(ev.evento, ev.comp);
  const date = fmtDate(ev.fecha);
  return `
    <li class="rank-item" data-ev="${esc(ev.evento)}" style="--i:${idx}">
      <div class="rank-main">
        <span class="rank-eyebrow">${wcLogo(ev.comp)}${esc(ev.comp)}</span>
        <h3 class="rank-title">${esc(title)}</h3>
        <span class="rank-meta">${date.d} ${date.m} ${date.y} · ${esc(ev.lugar)}</span>
      </div>
      <div class="rank-aside">
        <span class="rank-stock">${ev.bookStock} <small>entradas</small></span>
        <span class="rank-price">${ev.minPrice != null ? "desde " + esc(fmtMoney(ev.minPrice, "EUR")) : "a consultar"}</span>
      </div>
      <a class="rank-act" href="#" data-stop data-placeholder>Reservar</a>
    </li>`;
}

function renderHome() {
  const totalEv = EVENTS.length;
  const totalStock = EVENTS.reduce((a, e) => a + e.bookStock, 0);
  const populares = EVENTS.filter((e) => e.bookStock > 0)
    .sort((a, b) => {
      const da = a.fecha ? Date.parse(a.fecha) : Infinity;
      const db = b.fecha ? Date.parse(b.fecha) : Infinity;
      return da - db; // más próximos a la fecha primero
    })
    .slice(0, 6);

  const catCounts = new Map();
  for (const e of EVENTS) catCounts.set(e.comp, (catCounts.get(e.comp) || 0) + 1);
  const topCats = [...catCounts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8);

  app.innerHTML = `
    <header class="masthead masthead--home">
      ${wordmark()}
      <div class="hero hero--home">
        <h1>Entradas para los<br><span>eventos que importan</span>.</h1>
        <p>Mundial 2026, Euro 2028, Fórmula 1 y los partidos más buscados, con disponibilidad real y precio claro.</p>
        <div class="cta-row">
          <button class="btn-primary" id="cta-buscar">Buscar entradas →</button>
          <span class="stat"><b>${totalEv}</b> eventos</span>
          <span class="stat"><b>${totalStock}</b> entradas para comprar</span>
        </div>
      </div>
    </header>

    <section class="block">
      <div class="section-h">
        <span class="sh-eyebrow">Próximos</span>
        <h2>Eventos más cercanos con entradas</h2>
        <p>Los que están a la vuelta de la esquina y todavía tienen lugar.</p>
      </div>
      <ol class="rank">${populares.map(rankItem).join("")}</ol>
    </section>

    <section class="block">
      <div class="section-h">
        <span class="sh-eyebrow">Explorá</span>
        <h2>Entrá por categoría</h2>
      </div>
      <div class="catstrip">
        ${topCats
          .map(([c, n]) => `<button class="catlink" data-cat="${esc(c)}">${esc(c)}<small>${n}</small></button>`)
          .join("")}
        <button class="catlink catlink--all" data-cat="*">Ver todo<small>${totalEv}</small></button>
      </div>
    </section>

    <footer class="foot">
      <span>TickerMirror</span>
      <span>Stock y precios sincronizados cada 5 min desde el portal oficial</span>
    </footer>`;

  wireWordmark();
  app.querySelector("#cta-buscar").addEventListener("click", () => go("catalog"));
  app.querySelectorAll(".rank-item").forEach((li) =>
    li.addEventListener("click", (e) => {
      if (e.target.closest("[data-stop]")) return; // el botón Reservar abre el portal
      go("catalog", { q: li.dataset.ev });
    }),
  );
  app.querySelectorAll(".catlink").forEach((b) =>
    b.addEventListener("click", () => go("catalog", { cat: b.dataset.cat })),
  );
}

// ---- CATALOG ---------------------------------------------------------------
function opts(list, current) {
  return list
    .map((o) => `<option value="${esc(o.value)}" ${o.value === current ? "selected" : ""}>${esc(o.label)}</option>`)
    .join("");
}

function uniqueOptions(getter, sortByCount) {
  const counts = new Map();
  for (const ev of EVENTS) {
    const v = getter(ev);
    counts.set(v.key, { label: v.label, key: v.key, n: (counts.get(v.key)?.n || 0) + 1 });
  }
  let arr = [...counts.values()];
  arr = sortByCount ? arr.sort((a, b) => b.n - a.n || a.label.localeCompare(b.label)) : arr.sort((a, b) => a.key.localeCompare(b.key));
  return arr.map((a) => ({ value: a.key, label: `${a.label} (${a.n})` }));
}

function renderCatalog() {
  const filtered = EVENTS.filter((ev) => {
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

  filtered.sort((a, b) => {
    if (!!a.bookable !== !!b.bookable) return b.bookable - a.bookable;
    const da = a.fecha ? Date.parse(a.fecha) : Infinity;
    const db = b.fecha ? Date.parse(b.fecha) : Infinity;
    return da - db;
  });

  const catOpts = [{ value: "*", label: "Todas las categorías" }, ...uniqueOptions((e) => ({ key: e.comp, label: e.comp }), true)];
  const lugarOpts = [{ value: "*", label: "Todos los lugares" }, ...uniqueOptions((e) => ({ key: e.lugar, label: e.lugar }), true)];
  const mesOpts = [{ value: "*", label: "Todas las fechas" }, ...uniqueOptions((e) => ({ key: e.mes, label: e.mesLabel }), false)];
  const filtrando = state.cat !== "*" || state.lugar !== "*" || state.mes !== "*" || state.q;

  app.innerHTML = `
    <header class="masthead masthead--cat">
      ${wordmark()}
      <button class="back" id="back">← Inicio</button>
    </header>

    <div class="bar">
      <div class="filters">
        <label class="sel"><span>Categoría</span><select id="f-cat">${opts(catOpts, state.cat)}</select></label>
        <label class="sel"><span>Lugar</span><select id="f-lugar">${opts(lugarOpts, state.lugar)}</select></label>
        <label class="sel"><span>Fecha</span><select id="f-mes">${opts(mesOpts, state.mes)}</select></label>
      </div>
      <input id="search" class="search" type="search" placeholder="Buscar equipo, sede o sector" value="${esc(state.q)}" />
    </div>

    <div class="result-line">
      <b>${filtered.length}</b> ${filtered.length === 1 ? "evento" : "eventos"}
      ${filtrando ? `<button id="clear" class="clear">Limpiar filtros</button>` : ""}
    </div>

    <main class="feed">
      ${filtered.length ? filtered.map(stub).join("") : `<p class="empty">Ningún evento coincide con estos filtros. Probá ampliar la búsqueda.</p>`}
    </main>

    <footer class="foot">
      <span>TickerMirror</span>
      <span>Stock y precios sincronizados cada 5 min desde el portal oficial</span>
    </footer>`;

  wireWordmark();
  app.querySelector("#back").addEventListener("click", () => go("home"));

  // Desplegar ubicaciones con efecto "papiro" (medimos la altura real).
  app.querySelectorAll(".reveal").forEach((btn) => {
    btn.addEventListener("click", () => {
      const card = btn.closest(".ticket");
      const roll = card.querySelector(".roll-wrap");
      const open = card.classList.toggle("open");
      btn.setAttribute("aria-expanded", String(open));
      const n = card.querySelectorAll(".seat").length;
      card.querySelector(".reveal-txt").textContent = open
        ? "Ocultar ubicaciones"
        : `Ver ${n} ${n === 1 ? "ubicación" : "ubicaciones"}`;
      roll.style.maxHeight = open ? roll.scrollHeight + "px" : "0px";
    });
  });
  const bind = (id, key) =>
    app.querySelector(id).addEventListener("change", (e) => {
      state[key] = e.target.value;
      renderCatalog();
    });
  bind("#f-cat", "cat");
  bind("#f-lugar", "lugar");
  bind("#f-mes", "mes");
  app.querySelector("#clear")?.addEventListener("click", () => {
    state.cat = state.lugar = state.mes = "*";
    state.q = "";
    renderCatalog();
  });
  const search = app.querySelector("#search");
  search.addEventListener("input", (e) => {
    const pos = e.target.selectionStart;
    state.q = e.target.value;
    renderCatalog();
    const s = app.querySelector("#search");
    s.focus();
    s.setSelectionRange(pos, pos);
  });
}

// ---- boot ------------------------------------------------------------------
window.addEventListener("hashchange", route);

// Botones placeholder (Reservar/Consultar): todavía no tienen destino propio.
app.addEventListener("click", (e) => {
  const a = e.target.closest("[data-placeholder]");
  if (a) e.preventDefault();
});

async function boot() {
  app.innerHTML = `<div class="splash">Armando la cartelera…</div>`;
  try {
    const rows = await fetchTickets();
    if (!rows.length) {
      app.innerHTML = `<div class="splash">Todavía no hay eventos. Corré el worker para sincronizar el catálogo.</div>`;
      return;
    }
    EVENTS = buildEvents(rows);
    route();
  } catch (err) {
    app.innerHTML = `<div class="splash err">No pudimos cargar la cartelera.<br><code>${esc(err.message)}</code></div>`;
  }
}

boot();
