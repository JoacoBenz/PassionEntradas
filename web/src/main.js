import "./style.css";

const SUPA_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPA_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;
const WA = (import.meta.env.VITE_WHATSAPP || "").replace(/\D/g, "");
const ADMIN_FN = `${SUPA_URL}/functions/v1/admin-tickets`;

const RATES = { EUR: 1, USD: Number(import.meta.env.VITE_USD_RATE) || 1.08, ARS: Number(import.meta.env.VITE_ARS_RATE) || 1700 };
const SYM = { EUR: "€", USD: "US$", ARS: "$" };

const app = document.querySelector("#app");

// ---- estado global ---------------------------------------------------------
let EVENTS = [];
let CUR = localStorage.getItem("tm_cur") || "EUR";
const state = { cat: "*", lugar: "*", mes: "*", q: "" };

// ---- helpers ---------------------------------------------------------------
const esc = (s) =>
  String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

// precio: el dato está en EUR; lo convertimos a la moneda elegida.
function fmtPrice(eur) {
  if (eur == null) return null;
  const v = Number(eur) * (RATES[CUR] || 1);
  return SYM[CUR] + " " + new Intl.NumberFormat("es-AR", { maximumFractionDigits: 0 }).format(Math.round(v));
}

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
const wcLogo = (comp) => (isWC(comp) ? `<span class="wc-logo" title="Mundial" role="img" aria-label="Mundial">🏆</span>` : "");

function lugarDe(ciudad) {
  if (!ciudad) return "Sin sede";
  const m = ciudad.match(/\(([^)]+)\)\s*$/);
  if (m) return m[1].trim();
  return ciudad.split(",")[0].trim();
}
const mesKey = (iso) => (iso ? iso.slice(0, 7) : "0000-00");
const mesLabel = (iso) =>
  iso ? new Date(iso).toLocaleDateString("es-AR", { month: "long", year: "numeric" }).replace(/^\w/, (c) => c.toUpperCase()) : "A confirmar";

// WhatsApp con mensaje pre-armado
function waLink(text) {
  const base = WA ? `https://wa.me/${WA}` : "https://wa.me/";
  return `${base}?text=${encodeURIComponent(text)}`;
}

// ---- data ------------------------------------------------------------------
async function fetchTickets() {
  const cols = "id,evento,competicion,fecha,ciudad,categoria,precio_final,stock,estado,source";
  const url = `${SUPA_URL}/rest/v1/tickets?select=${cols}&order=fecha.asc.nullslast`;
  const res = await fetch(url, { headers: { apikey: SUPA_KEY, Authorization: `Bearer ${SUPA_KEY}` } });
  if (!res.ok) throw new Error(`Supabase ${res.status}: ${await res.text()}`);
  return res.json();
}

function buildEvents(rows) {
  const map = new Map();
  for (const r of rows) {
    const key = `${r.competicion}__${r.evento}`;
    if (!map.has(key)) map.set(key, { evento: r.evento, comp: r.competicion || "Otros", ciudad: r.ciudad, fecha: r.fecha, ubicaciones: [] });
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
    ev.bookStock = book.reduce((a, u) => a + (u.stock ?? 0), 0);
    ev.propias = ev.ubicaciones.some((u) => u.source === "manual");
    // "desde": menor precio REAL (>0). Prioriza lo reservable; si no hay, cualquier
    // precio positivo. Ignora 0/null (sectores sin precio o agotados sin valor).
    const precioPos = (arr) => arr.map((u) => Number(u.precio_final)).filter((n) => Number.isFinite(n) && n > 0);
    const reservables = precioPos(ev.ubicaciones.filter((u) => (u.stock ?? 0) > 0 && u.estado === "book"));
    const todos = precioPos(ev.ubicaciones);
    ev.minPrice = reservables.length ? Math.min(...reservables) : todos.length ? Math.min(...todos) : null;
    ev.ubicaciones.sort((a, b) => {
      const pa = a.precio_final == null ? Infinity : Number(a.precio_final);
      const pb = b.precio_final == null ? Infinity : Number(b.precio_final);
      return pa - pb;
    });
  }
  return evs;
}

// ---- componentes compartidos -----------------------------------------------
function currencyTabs() {
  return `<div class="cur" role="group" aria-label="Moneda">
    ${["EUR", "USD", "ARS"].map((c) => `<button class="cur-btn ${c === CUR ? "active" : ""}" data-cur="${c}">${c}</button>`).join("")}
  </div>`;
}

function ladderRow(u, ev) {
  const hasPrice = u.precio_final != null && Number(u.precio_final) > 0;
  const precio = hasPrice ? fmtPrice(u.precio_final) : null;
  const stk = u.stock ?? 0;
  const bookable = stk > 0 && u.estado === "book" && hasPrice;
  const low = stk > 0 && stk <= 2;
  const sector = u.categoria || "Entrada general";
  const stat = stk > 0
    ? `<i class="dot ${low ? "low" : "ok"}"></i>${low ? `quedan ${stk}` : `${stk} lugares`}`
    : `<i class="dot req"></i>sin cupo`;
  const msg = bookable
    ? `Hola! Quiero reservar: ${ev.evento} — ${sector}${precio ? ` (${precio})` : ""}. ¿Sigue disponible?`
    : `Hola! Consulto por: ${ev.evento} — ${sector}. ¿Hay disponibilidad?`;
  return `
    <li class="seat ${bookable ? "" : "seat--req"}">
      <span class="seat-name">${esc(sector)}</span>
      <span class="seat-price">${precio ? esc(precio) : '<span class="consult">Consultar</span>'}</span>
      <span class="seat-stat">${stat}</span>
      <a class="seat-act ${bookable ? "go" : "ask"}" href="${esc(waLink(msg))}" target="_blank" rel="noopener">
        ${bookable ? "Reservar" : "Consultar"}
      </a>
    </li>`;
}

function stub(ev, i) {
  const { title, context } = parseTitle(ev.evento, ev.comp);
  const date = fmtDate(ev.fecha);
  const n = ev.ubicaciones.length;
  const code = (ev.ubicaciones[0]?.id || "").split("::")[0].slice(0, 6).padStart(6, "0");
  return `
    <article class="ticket ${ev.bookable ? "is-live" : ""}" style="--i:${Math.min(i, 12)}">
      <div class="ticket-body">
        <div class="ticket-top">
          <div class="top-left">
            ${ev.bookable ? `<span class="flag">● Reservá ya</span>` : ""}
            ${ev.propias ? `<span class="own">Nuestra</span>` : ""}
            ${wcLogo(ev.comp)}
            <span class="eyebrow">${esc(context || ev.comp)}</span>
          </div>
          <span class="cal"><b>${date.d}</b><span>${date.m}</span></span>
        </div>
        <h3 class="match">${esc(title)}</h3>
        <p class="where">${ev.ciudad ? "◓ " + esc(ev.ciudad) : "Sede a confirmar"} · ${esc(date.full)}</p>
        <div class="ticket-actions">
          <button class="reveal" aria-expanded="false">
            <span class="reveal-txt">Ver ${n} ${n === 1 ? "ubicación" : "ubicaciones"}</span>
            <span class="reveal-ic" aria-hidden="true">▼</span>
          </button>
          <button class="share" title="Compartir" data-ev="${esc(title)}">↗</button>
        </div>
        <div class="roll-wrap">
          <span class="scroll-rod" aria-hidden="true"></span>
          <ul class="ladder">${ev.ubicaciones.map((u) => ladderRow(u, ev)).join("")}</ul>
          <span class="scroll-curl" aria-hidden="true"></span>
        </div>
      </div>
      <aside class="ticket-stub">
        <span class="stub-label">${ev.minPrice != null ? "desde" : "precio"}</span>
        <span class="stub-price ${ev.minPrice == null ? "is-consult" : ""}">${ev.minPrice != null ? esc(fmtPrice(ev.minPrice)) : "Consultar"}</span>
        <span class="stub-meta">${n} ubicaciones${ev.bookable ? ` · ${ev.bookable} con stock` : ""}</span>
        <span class="barcode" aria-hidden="true"></span>
        <span class="stub-code">N.º ${esc(code)}</span>
      </aside>
    </article>`;
}

function wordmark() {
  return `<button class="wm" id="home-link"><span class="ticketmark">▚</span> TICKER<em>MIRROR</em></button>`;
}

// ---- routing ---------------------------------------------------------------
function viewFromHash() {
  if (location.hash === "#buscar") return "catalog";
  if (location.hash === "#admin") return "admin";
  return "home";
}
function go(view, preset) {
  if (preset) Object.assign(state, { cat: "*", lugar: "*", mes: "*", q: "", ...preset });
  const target = view === "catalog" ? "#buscar" : view === "admin" ? "#admin" : "#inicio";
  if (location.hash === target) route();
  else location.hash = target;
}
function route() {
  const v = viewFromHash();
  (v === "catalog" ? renderCatalog : v === "admin" ? renderAdmin : renderHome)();
  window.scrollTo(0, 0);
}

// listeners comunes (se re-enganchan en cada render)
function wireCommon() {
  app.querySelector("#home-link")?.addEventListener("click", () => go("home"));
  app.querySelectorAll(".cur-btn").forEach((b) =>
    b.addEventListener("click", () => { CUR = b.dataset.cur; localStorage.setItem("tm_cur", CUR); route(); }),
  );
  app.querySelectorAll(".reveal").forEach((btn) =>
    btn.addEventListener("click", () => {
      const card = btn.closest(".ticket");
      const roll = card.querySelector(".roll-wrap");
      const open = card.classList.toggle("open");
      btn.setAttribute("aria-expanded", String(open));
      const n = card.querySelectorAll(".seat").length;
      card.querySelector(".reveal-txt").textContent = open ? "Ocultar ubicaciones" : `Ver ${n} ${n === 1 ? "ubicación" : "ubicaciones"}`;
      roll.style.maxHeight = open ? roll.scrollHeight + "px" : "0px";
    }),
  );
  app.querySelectorAll(".share").forEach((b) =>
    b.addEventListener("click", async () => {
      const url = location.origin + location.pathname + "#buscar";
      const data = { title: "TickerMirror", text: `Mirá las entradas para ${b.dataset.ev} en TickerMirror`, url };
      try { if (navigator.share) await navigator.share(data); else { await navigator.clipboard.writeText(url); b.textContent = "✓"; setTimeout(() => (b.textContent = "↗"), 1500); } } catch {}
    }),
  );
}

// ---- HOME ------------------------------------------------------------------
function rankItem(ev, idx) {
  const { title } = parseTitle(ev.evento, ev.comp);
  const date = fmtDate(ev.fecha);
  return `
    <li class="rank-item" data-ev="${esc(ev.evento)}" style="--i:${idx}">
      <div class="rank-main">
        <span class="rank-eyebrow">${wcLogo(ev.comp)}${ev.propias ? '<span class="own">Nuestra</span>' : ""}${esc(ev.comp)}</span>
        <h3 class="rank-title">${esc(title)}</h3>
        <span class="rank-meta">${date.d} ${date.m} ${date.y} · ${esc(ev.lugar)}</span>
      </div>
      <div class="rank-aside">
        <span class="rank-stock">${ev.bookStock} <small>entradas</small></span>
        <span class="rank-price">${ev.minPrice != null ? "desde " + esc(fmtPrice(ev.minPrice)) : "a consultar"}</span>
      </div>
      <a class="rank-act" href="${esc(waLink(`Hola! Quiero reservar para ${ev.evento}. ¿Qué disponibilidad hay?`))}" target="_blank" rel="noopener" data-stop>Reservar</a>
    </li>`;
}

function renderHome() {
  const totalEv = EVENTS.length;
  const totalStock = EVENTS.reduce((a, e) => a + e.bookStock, 0);
  const populares = EVENTS.filter((e) => e.bookStock > 0)
    .sort((a, b) => { const da = a.fecha ? Date.parse(a.fecha) : Infinity; const db = b.fecha ? Date.parse(b.fecha) : Infinity; return da - db; })
    .slice(0, 6);
  const catCounts = new Map();
  for (const e of EVENTS) catCounts.set(e.comp, (catCounts.get(e.comp) || 0) + 1);
  const topCats = [...catCounts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8);

  const pasos = [
    ["Buscás", "Filtrá por evento, lugar o fecha y mirá precios y stock reales, actualizados al momento."],
    ["Consultás", "Tocá Reservar o Consultar y nos escribís directo por WhatsApp con el evento ya cargado."],
    ["Asegurás", "Coordinamos pago y te confirmamos la entrada. Simple, sin vueltas."],
  ];
  const porque = [
    ["Stock real", "Sincronizamos disponibilidad y precios cada pocos minutos: lo que ves es lo que hay."],
    ["Precio claro", "Sin sorpresas. Podés ver el valor en euros, dólares o pesos."],
    ["Atención directa", "Hablás con una persona por WhatsApp, no con un bot."],
  ];
  const faqs = [
    ["¿En qué moneda están los precios?", "El valor base es en euros; con el selector de arriba podés verlo en dólares o pesos como referencia. El monto final lo confirmamos al cerrar."],
    ["¿Cómo reservo o consulto?", "Cada ubicación tiene un botón que abre WhatsApp con el evento y el sector ya escritos. Nos llega tu mensaje y te respondemos."],
    ["¿Y si no aparece mi evento?", "Escribinos igual: conseguimos entradas para muchos eventos que no siempre están listados."],
    ["¿Las entradas tienen disponibilidad real?", "Sí. El stock que mostramos viene de la fuente y se actualiza solo; aun así confirmamos antes de cerrar."],
  ];

  app.innerHTML = `
    <header class="masthead masthead--home">
      <div class="toprow">${wordmark()}${currencyTabs()}</div>
      <div class="hero hero--home">
        <h1>Entradas para los<br><span>eventos que importan</span>.</h1>
        <p>Mundial 2026, Euro 2028, Fórmula 1 y los partidos más buscados, con disponibilidad real y precio claro.</p>
        <div class="cta-row">
          <button class="btn-primary" id="cta-buscar">Buscar entradas →</button>
          <a class="btn-ghost" href="${esc(waLink("Hola! Quiero consultar por entradas."))}" target="_blank" rel="noopener">Escribinos por WhatsApp</a>
          <span class="stat"><b>${totalEv}</b> eventos</span>
          <span class="stat"><b>${totalStock}</b> entradas para comprar</span>
        </div>
      </div>
    </header>

    <section class="block">
      <div class="section-h"><span class="sh-eyebrow">Próximos</span><h2>Eventos más cercanos con entradas</h2><p>Los que están a la vuelta de la esquina y todavía tienen lugar.</p></div>
      <ol class="rank">${populares.map(rankItem).join("")}</ol>
    </section>

    <section class="block">
      <div class="section-h"><span class="sh-eyebrow">Explorá</span><h2>Entrá por categoría</h2></div>
      <div class="catstrip">
        ${topCats.map(([c, n]) => `<button class="catlink" data-cat="${esc(c)}">${esc(c)}<small>${n}</small></button>`).join("")}
        <button class="catlink catlink--all" data-cat="*">Ver todo<small>${totalEv}</small></button>
      </div>
    </section>

    <section class="block">
      <div class="section-h"><span class="sh-eyebrow">Simple</span><h2>Cómo funciona</h2></div>
      <div class="steps">
        ${pasos.map(([t, d], i) => `<div class="step"><span class="step-n">${i + 1}</span><h3>${t}</h3><p>${d}</p></div>`).join("")}
      </div>
    </section>

    <section class="block">
      <div class="section-h"><span class="sh-eyebrow">Confianza</span><h2>Por qué TickerMirror</h2></div>
      <div class="cards3">
        ${porque.map(([t, d]) => `<div class="card3"><h3>${t}</h3><p>${d}</p></div>`).join("")}
      </div>
    </section>

    <section class="block">
      <div class="section-h"><span class="sh-eyebrow">Dudas</span><h2>Preguntas frecuentes</h2></div>
      <div class="faq">
        ${faqs.map(([q, a]) => `<details class="faq-item"><summary>${q}</summary><p>${a}</p></details>`).join("")}
      </div>
    </section>

    <section class="cta-band">
      <div><h2>¿Buscás un evento puntual?</h2><p>Escribinos y te decimos al toque si lo conseguimos.</p></div>
      <a class="btn-primary" href="${esc(waLink("Hola! Estoy buscando entradas para un evento."))}" target="_blank" rel="noopener">Consultar por WhatsApp</a>
    </section>

    <footer class="foot">
      <span>TickerMirror</span>
      <span>Stock y precios sincronizados desde la fuente</span>
    </footer>

    ${WA ? `<a class="wa-float" href="${esc(waLink("Hola! Quiero consultar por entradas."))}" target="_blank" rel="noopener" aria-label="WhatsApp">WhatsApp</a>` : ""}`;

  wireCommon();
  app.querySelector("#cta-buscar").addEventListener("click", () => go("catalog"));
  app.querySelectorAll(".rank-item").forEach((li) =>
    li.addEventListener("click", (e) => { if (e.target.closest("[data-stop]")) return; go("catalog", { q: li.dataset.ev }); }));
  app.querySelectorAll(".catlink").forEach((b) => b.addEventListener("click", () => go("catalog", { cat: b.dataset.cat })));
}

// ---- CATALOG ---------------------------------------------------------------
function opts(list, current) {
  return list.map((o) => `<option value="${esc(o.value)}" ${o.value === current ? "selected" : ""}>${esc(o.label)}</option>`).join("");
}
function uniqueOptions(getter, sortByCount) {
  const counts = new Map();
  for (const ev of EVENTS) { const v = getter(ev); counts.set(v.key, { label: v.label, key: v.key, n: (counts.get(v.key)?.n || 0) + 1 }); }
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
      const hit = ev.evento.toLowerCase().includes(q) || (ev.ciudad || "").toLowerCase().includes(q) || ev.ubicaciones.some((u) => (u.categoria || "").toLowerCase().includes(q));
      if (!hit) return false;
    }
    return true;
  });
  filtered.sort((a, b) => { if (!!a.bookable !== !!b.bookable) return b.bookable - a.bookable; const da = a.fecha ? Date.parse(a.fecha) : Infinity; const db = b.fecha ? Date.parse(b.fecha) : Infinity; return da - db; });

  const catOpts = [{ value: "*", label: "Todas las categorías" }, ...uniqueOptions((e) => ({ key: e.comp, label: e.comp }), true)];
  const lugarOpts = [{ value: "*", label: "Todos los lugares" }, ...uniqueOptions((e) => ({ key: e.lugar, label: e.lugar }), true)];
  const mesOpts = [{ value: "*", label: "Todas las fechas" }, ...uniqueOptions((e) => ({ key: e.mes, label: e.mesLabel }), false)];
  const filtrando = state.cat !== "*" || state.lugar !== "*" || state.mes !== "*" || state.q;

  app.innerHTML = `
    <header class="masthead masthead--cat">
      <div class="toprow">${wordmark()}<div class="mast-right">${currencyTabs()}<button class="back" id="back">← Inicio</button></div></div>
    </header>

    <div class="bar">
      <div class="filters">
        <label class="sel"><span>Categoría</span><select id="f-cat">${opts(catOpts, state.cat)}</select></label>
        <label class="sel"><span>Lugar</span><select id="f-lugar">${opts(lugarOpts, state.lugar)}</select></label>
        <label class="sel"><span>Fecha</span><select id="f-mes">${opts(mesOpts, state.mes)}</select></label>
      </div>
      <input id="search" class="search" type="search" placeholder="Buscar equipo, sede o sector" value="${esc(state.q)}" />
    </div>

    <div class="result-line"><b>${filtered.length}</b> ${filtered.length === 1 ? "evento" : "eventos"}${filtrando ? ` <button id="clear" class="clear">Limpiar filtros</button>` : ""}</div>

    <main class="feed">
      ${filtered.length ? filtered.map(stub).join("") : `<p class="empty">Ningún evento coincide con estos filtros.<br><a href="${esc(waLink("Hola! Busco un evento que no aparece en la web."))}" target="_blank" rel="noopener">Consultanos por WhatsApp</a> y lo buscamos.</p>`}
    </main>

    <footer class="foot"><span>TickerMirror</span><span>Stock y precios sincronizados desde la fuente</span></footer>
    ${WA ? `<a class="wa-float" href="${esc(waLink("Hola! Quiero consultar por entradas."))}" target="_blank" rel="noopener" aria-label="WhatsApp">WhatsApp</a>` : ""}`;

  wireCommon();
  app.querySelector("#back").addEventListener("click", () => go("home"));
  const bind = (id, key) => app.querySelector(id).addEventListener("change", (e) => { state[key] = e.target.value; renderCatalog(); });
  bind("#f-cat", "cat"); bind("#f-lugar", "lugar"); bind("#f-mes", "mes");
  app.querySelector("#clear")?.addEventListener("click", () => { state.cat = state.lugar = state.mes = "*"; state.q = ""; renderCatalog(); });
  const search = app.querySelector("#search");
  search.addEventListener("input", (e) => { const pos = e.target.selectionStart; state.q = e.target.value; renderCatalog(); const s = app.querySelector("#search"); s.focus(); s.setSelectionRange(pos, pos); });
}

// ---- ADMIN -----------------------------------------------------------------
let ADMIN_TOKEN = sessionStorage.getItem("tm_admin") || "";

async function adminCall(action, payload = {}) {
  const res = await fetch(ADMIN_FN, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ action, token: ADMIN_TOKEN, ...payload }) });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `Error ${res.status}`);
  return data;
}

function renderAdmin() {
  if (!ADMIN_TOKEN) {
    app.innerHTML = `
      <header class="masthead masthead--cat"><div class="toprow">${wordmark()}<button class="back" id="back">← Inicio</button></div></header>
      <div class="admin-login">
        <h2>Panel de administración</h2>
        <p>Ingresá tu clave de acceso para cargar entradas propias.</p>
        <form id="login-form">
          <input id="admin-pass" type="password" placeholder="Clave de admin" autocomplete="current-password" />
          <button class="btn-primary" type="submit">Entrar</button>
        </form>
        <p class="admin-err" id="login-err"></p>
      </div>`;
    wireCommon();
    app.querySelector("#back").addEventListener("click", () => go("home"));
    app.querySelector("#login-form").addEventListener("submit", async (e) => {
      e.preventDefault();
      const err = app.querySelector("#login-err");
      err.textContent = "";
      ADMIN_TOKEN = app.querySelector("#admin-pass").value.trim();
      try { await adminCall("list"); sessionStorage.setItem("tm_admin", ADMIN_TOKEN); renderAdmin(); }
      catch (ex) { ADMIN_TOKEN = ""; err.textContent = "Clave incorrecta."; }
    });
    return;
  }

  app.innerHTML = `
    <header class="masthead masthead--cat"><div class="toprow">${wordmark()}<div class="mast-right"><button class="back" id="logout">Cerrar sesión</button><button class="back" id="back">← Inicio</button></div></div></header>
    <div class="admin">
      <div class="section-h"><span class="sh-eyebrow">Admin</span><h2>Cargar entrada propia</h2><p>Estas entradas se publican junto a las del portal y no las toca la sincronización.</p></div>
      <form id="t-form" class="admin-form">
        <label>Evento *<input name="evento" required placeholder="Ej: River vs Boca - Superclásico"></label>
        <label>Categoría / competición<input name="competicion" placeholder="Ej: Primera División"></label>
        <label>Fecha<input name="fecha" type="date"></label>
        <label>Lugar / sede<input name="ciudad" placeholder="Ej: Estadio Monumental, Buenos Aires (ARG)"></label>
        <label>Sector / ubicación<input name="categoria" placeholder="Ej: Platea Alta"></label>
        <label>Precio (EUR)<input name="precio" type="number" min="0" step="1" placeholder="Ej: 120"></label>
        <label>Stock<input name="stock" type="number" min="0" step="1" value="0"></label>
        <button class="btn-primary" type="submit">Publicar entrada</button>
        <p class="admin-err" id="form-msg"></p>
      </form>

      <div class="section-h" style="margin-top:30px"><span class="sh-eyebrow">Publicadas</span><h2>Entradas propias</h2></div>
      <div id="manual-list" class="manual-list"><p class="dim">Cargando…</p></div>
    </div>`;

  wireCommon();
  app.querySelector("#back").addEventListener("click", () => go("home"));
  app.querySelector("#logout").addEventListener("click", () => { ADMIN_TOKEN = ""; sessionStorage.removeItem("tm_admin"); renderAdmin(); });

  const msg = app.querySelector("#form-msg");
  app.querySelector("#t-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    msg.textContent = ""; msg.className = "admin-err";
    const fd = new FormData(e.target);
    const ticket = Object.fromEntries(fd.entries());
    try {
      await adminCall("create", { ticket });
      msg.className = "admin-ok"; msg.textContent = "✓ Entrada publicada.";
      e.target.reset();
      loadManual();
    } catch (ex) { msg.textContent = "No se pudo publicar: " + ex.message; }
  });

  async function loadManual() {
    const box = app.querySelector("#manual-list");
    try {
      const { rows } = await adminCall("list");
      if (!rows.length) { box.innerHTML = `<p class="dim">Todavía no cargaste entradas propias.</p>`; return; }
      box.innerHTML = rows.map((r) => `
        <div class="manual-item">
          <div><b>${esc(r.evento)}</b><span class="dim">${r.categoria ? esc(r.categoria) + " · " : ""}${r.precio_final != null ? "€ " + r.precio_final : "a consultar"} · stock ${r.stock ?? 0}</span></div>
          <button class="del" data-id="${esc(r.id)}">Borrar</button>
        </div>`).join("");
      box.querySelectorAll(".del").forEach((b) => b.addEventListener("click", async () => {
        if (!confirm("¿Borrar esta entrada?")) return;
        try { await adminCall("delete", { id: b.dataset.id }); loadManual(); } catch (ex) { alert("No se pudo borrar: " + ex.message); }
      }));
    } catch (ex) { box.innerHTML = `<p class="admin-err">Error: ${esc(ex.message)}</p>`; }
  }
  loadManual();
}

// ---- boot ------------------------------------------------------------------
window.addEventListener("hashchange", route);
app.addEventListener("click", (e) => { const a = e.target.closest("[data-placeholder]"); if (a) e.preventDefault(); });

async function boot() {
  if (viewFromHash() === "admin") { renderAdmin(); }
  app.innerHTML = app.innerHTML || `<div class="splash">Armando la cartelera…</div>`;
  try {
    const rows = await fetchTickets();
    EVENTS = buildEvents(rows);
    if (!EVENTS.length && viewFromHash() !== "admin") { app.innerHTML = `<div class="splash">Todavía no hay eventos cargados.</div>`; return; }
    route();
  } catch (err) {
    if (viewFromHash() !== "admin") app.innerHTML = `<div class="splash err">No pudimos cargar la cartelera.<br><code>${esc(err.message)}</code></div>`;
  }
}

boot();
