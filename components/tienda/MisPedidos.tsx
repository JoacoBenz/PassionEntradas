"use client";

// "Mis pedidos" del cliente: la vista de seguimiento de los pedidos y consultas
// que hizo desde la tienda. Cada uno es una operación que el staff acciona
// desde el panel; acá el cliente ve en qué estado va. Estética de la tienda,
// bilingüe EN/ES (idioma recordado en localStorage, igual que el resto).

import { useEffect, useState } from "react";
import Link from "next/link";
import AutoRefresh from "@/components/AutoRefresh";
import { LANGS, LOCALE, TX, type Lang } from "@/lib/tienda-i18n";
import type { Estado } from "@/lib/operaciones";

export type PedidoView = {
  id: string;
  code: string;
  tipo: "pedido" | "consulta";
  evento: string;
  sector: string | null;
  cantidad: number;
  fecha_evento: string | null;
  created_at: string;
  estado: Estado;
  // Factura emitida para este pedido (si el staff ya la generó).
  facturaId: string | null;
};

// Color del chip de estado, alineado con el agrupado del panel.
const ESTADO_CLASS: Record<Estado, string> = {
  esperando: "mp-e-abierta",
  entrada_recibida: "mp-e-curso",
  pago_confirmado: "mp-e-curso",
  lista_para_cerrar: "mp-e-curso",
  cerrada: "mp-e-cerrada",
  cancelada: "mp-e-cancelada",
};

function useLang(): [Lang, (l: Lang) => void] {
  const [lang, setLang] = useState<Lang>("en");
  useEffect(() => {
    const saved = localStorage.getItem("tm_lang");
    if (saved === "en" || saved === "es") setLang(saved);
  }, []);
  function change(l: Lang) {
    setLang(l);
    localStorage.setItem("tm_lang", l);
  }
  return [lang, change];
}

function fmtDate(value: string | null, lang: Lang, withTime = false): string {
  if (!value) return "—";
  // fecha_evento viene como YYYY-MM-DD (sin hora); created_at es timestamp.
  const iso = /^\d{4}-\d{2}-\d{2}$/.test(value) ? `${value}T00:00:00` : value;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString(LOCALE[lang], {
    day: "numeric",
    month: "short",
    year: "numeric",
    ...(withTime ? { hour: "2-digit", minute: "2-digit" } : {}),
  });
}

export function MisPedidos({ pedidos }: { pedidos: PedidoView[] }) {
  const [lang, setLang] = useLang();
  const t = TX[lang];
  const mp = t.misPedidos;

  return (
    <>
      {/* La página se actualiza sola: cuando el staff avanza la operación, el
          estado acá se refresca sin recargar. */}
      <AutoRefresh intervalMs={20000} />
      <header className="masthead masthead--cat">
        <div className="toprow">
          <Link className="wm" href="/entradas">
            <span className="ticketmark">▚</span> TICKET<em>MIRROR</em>
          </Link>
          <div className="mast-right">
            <div className="lang" role="group" aria-label="Language / Idioma">
              {LANGS.map((l) => (
                <button
                  key={l}
                  type="button"
                  className={`lang-btn ${l === lang ? "active" : ""}`}
                  onClick={() => setLang(l)}
                  aria-pressed={l === lang}
                >
                  {l.toUpperCase()}
                </button>
              ))}
            </div>
            <Link className="lp-nav-login" href="/cuenta">
              {t.lp.navCuenta}
            </Link>
            <Link className="back" href="/entradas">
              {mp.volver}
            </Link>
          </div>
        </div>
      </header>

      <main className="mp-wrap">
        <div className="section-h">
          <span className="sh-eyebrow">{t.lp.navPedidos}</span>
          <h2>{mp.title}</h2>
          <p>{mp.sub}</p>
        </div>

        {pedidos.length === 0 ? (
          <div className="mp-empty">
            <h3>{mp.vacioTitle}</h3>
            <p>{mp.vacioP}</p>
            <Link className="btn-primary" href="/buscar">
              {mp.vacioCta}
            </Link>
          </div>
        ) : (
          <ul className="mp-list">
            {pedidos.map((p) => (
              <li className="mp-item" key={p.id}>
                <div className="mp-item-head">
                  <span className={`mp-tipo mp-tipo--${p.tipo}`}>
                    {p.tipo === "pedido" ? mp.pedidoLabel : mp.consultaLabel}
                  </span>
                  <span className={`mp-estado ${ESTADO_CLASS[p.estado]}`}>
                    {mp.estados[p.estado] ?? p.estado}
                  </span>
                </div>
                <h3 className="mp-evento">{p.evento}</h3>
                <dl className="mp-meta">
                  {p.sector && (
                    <div>
                      <dt>{mp.sectorLabel}</dt>
                      <dd>
                        {p.sector}
                        {p.cantidad > 1 ? ` ×${p.cantidad}` : ""}
                      </dd>
                    </div>
                  )}
                  {p.fecha_evento && (
                    <div>
                      <dt>{mp.fechaLabel}</dt>
                      <dd>{fmtDate(p.fecha_evento, lang)}</dd>
                    </div>
                  )}
                  <div>
                    <dt>{mp.creado}</dt>
                    <dd>{fmtDate(p.created_at, lang, true)}</dd>
                  </div>
                </dl>
                <div className="mp-foot">
                  <span className="mp-code">N.º {p.code}</span>
                  <span className="mp-links">
                    {/* Link público de seguimiento (mismo que comparte el staff). */}
                    <a
                      className="mp-link"
                      href={`/op/${p.id}`}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      {mp.verSeguimiento}
                    </a>
                    {/* Factura: solo si el staff ya la emitió. */}
                    {p.facturaId && (
                      <a
                        className="mp-link mp-link--factura"
                        href={`/factura/${p.facturaId}`}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        {mp.verFactura}
                      </a>
                    )}
                  </span>
                </div>
              </li>
            ))}
          </ul>
        )}
      </main>
    </>
  );
}
