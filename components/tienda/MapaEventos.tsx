"use client";

// Mapa mundial del catálogo (/mapa): cada ciudad con eventos es un punto
// sobre una silueta del mundo (SVG propio, sin librerías de mapas). Tocar un
// punto —o su chip— lista los eventos de esa ciudad con link al catálogo.
// Estética de la tienda; bilingüe EN/ES.

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  buildEvents,
  fmtDate,
  fmtPrice,
  parseTitle,
  type EventoAgrupado,
  type Ticket,
} from "@/lib/tickets";
import { ubicarCiudad } from "@/lib/geo";
import { MAPA_H, MAPA_W, proyectar, WORLD_PATH } from "@/lib/mapa-mundo";
import { LANGS, TX, type Lang } from "@/lib/tienda-i18n";

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

type Ciudad = {
  label: string;
  x: number;
  y: number;
  eventos: EventoAgrupado[];
};

export function MapaEventos({ rows }: { rows: Ticket[] }) {
  const [lang, setLang] = useLang();
  const t = TX[lang];
  const [sel, setSel] = useState<string | null>(null);

  const { ciudades, sinUbicar, totalUbicados } = useMemo(() => {
    const events = buildEvents(rows);
    const porCiudad = new Map<string, Ciudad>();
    let sinUbicar = 0;
    for (const ev of events) {
      const lugar = ubicarCiudad(ev.ciudad);
      if (!lugar) {
        sinUbicar++;
        continue;
      }
      let c = porCiudad.get(lugar.label);
      if (!c) {
        const { x, y } = proyectar(lugar.lat, lugar.lng);
        c = { label: lugar.label, x, y, eventos: [] };
        porCiudad.set(lugar.label, c);
      }
      c.eventos.push(ev);
    }
    const ciudades = Array.from(porCiudad.values()).sort(
      (a, b) => b.eventos.length - a.eventos.length || a.label.localeCompare(b.label)
    );
    const totalUbicados = ciudades.reduce((a, c) => a + c.eventos.length, 0);
    return { ciudades, sinUbicar, totalUbicados };
  }, [rows]);

  const seleccionada = ciudades.find((c) => c.label === sel) ?? null;
  const eventosSel = useMemo(() => {
    if (!seleccionada) return [];
    return [...seleccionada.eventos].sort((a, b) => {
      const da = a.fecha ? Date.parse(a.fecha) : Infinity;
      const db = b.fecha ? Date.parse(b.fecha) : Infinity;
      return da - db;
    });
  }, [seleccionada]);

  // Radio según cantidad de eventos (clampado: Londres no debe tapar Europa).
  const radio = (n: number) => Math.min(9, 3.5 + Math.sqrt(n) * 1.7);

  return (
    <>
      <header className="masthead masthead--cat">
        <div className="toprow">
          <Link className="wm" href="/entradas">
            <span className="ticketmark">▚</span> TICKET<em>MIRROR</em>
          </Link>
          <div className="mast-right">
            <LangToggle lang={lang} onChange={setLang} />
            <Link className="back" href="/entradas">
              {t.backHome}
            </Link>
          </div>
        </div>
      </header>

      <section className="block mapa-block">
        <div className="section-h">
          <span className="sh-eyebrow">{t.mapa.eyebrow}</span>
          <h2>{t.mapa.h2}</h2>
          <p>{t.mapa.p}</p>
        </div>

        <div className="mapa-frame">
          <svg
            className="mapa-svg"
            viewBox={`0 0 ${MAPA_W} ${MAPA_H}`}
            role="img"
            aria-label={t.mapa.h2}
          >
            <path className="mapa-land" d={WORLD_PATH} />
            {/* Más eventos primero: los puntos chicos quedan clickeables arriba. */}
            {ciudades.map((c) => {
              const r = radio(c.eventos.length);
              const activa = sel === c.label;
              return (
                <g
                  key={c.label}
                  className={`mapa-dot ${activa ? "sel" : ""}`}
                  onClick={() => setSel(activa ? null : c.label)}
                >
                  {activa && <circle className="mapa-ring" cx={c.x} cy={c.y} r={r + 4.5} />}
                  <circle className="mapa-punto" cx={c.x} cy={c.y} r={r} />
                  <title>{`${c.label} — ${c.eventos.length}`}</title>
                </g>
              );
            })}
          </svg>
        </div>

        <p className="mapa-meta">
          {t.mapa.resumen(totalUbicados, ciudades.length)}
          {sinUbicar > 0 && <span className="mapa-meta-extra"> · {t.mapa.sinUbicar(sinUbicar)}</span>}
        </p>

        {/* Chips de ciudades: selección precisa (los puntos de Europa quedan
            pegados entre sí, y en mobile el dedo no da esa precisión). */}
        <div className="catstrip mapa-chips">
          {ciudades.map((c) => (
            <button
              key={c.label}
              className={`catlink ${sel === c.label ? "catlink--all" : ""}`}
              onClick={() => setSel(sel === c.label ? null : c.label)}
            >
              {c.label}
              <small>{c.eventos.length}</small>
            </button>
          ))}
        </div>

        {seleccionada ? (
          <div className="mapa-panel">
            <div className="mapa-panel-head">
              <h3>{seleccionada.label}</h3>
              <span>{t.eventos(eventosSel.length)}: {eventosSel.length}</span>
            </div>
            <ul className="mapa-lista">
              {eventosSel.map((ev) => {
                const { title, context } = parseTitle(ev.evento, ev.comp);
                const date = fmtDate(ev.fecha, lang);
                return (
                  <li key={ev.comp + ev.evento} className="mapa-ev">
                    <div className="mapa-ev-main">
                      <span className="mapa-ev-eyebrow">{context || ev.comp}</span>
                      <span className="mapa-ev-title">{title}</span>
                      <span className="mapa-ev-meta">
                        {date.full}
                        {" · "}
                        {ev.minPrice != null
                          ? `${t.desdeMayus} ${fmtPrice(ev.minPrice, lang)}`
                          : t.aConsultar}
                      </span>
                    </div>
                    <Link
                      className="mapa-ev-link"
                      href={`/buscar?ev=${encodeURIComponent(ev.evento)}&c=${encodeURIComponent(ev.comp)}`}
                    >
                      {t.mapa.verCatalogo}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ) : (
          <p className="mapa-hint">{t.mapa.elegi}</p>
        )}
      </section>

      <footer className="foot">
        <span>TicketMirror</span>
        <span>{t.footSync}</span>
      </footer>
    </>
  );
}
