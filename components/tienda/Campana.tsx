"use client";

// Campana de la tienda: los avisos de los pedidos del cliente (Confirmado,
// Para pagar, Entregada). Se consulta al abrir la página, cada minuto mientras
// la pestaña está a la vista y al volver a ella. Abrirla marca todo leído.

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { textoAviso, type DatosAviso } from "@/lib/notificaciones";
import { fechaHora } from "@/lib/fechas";
import { LOCALE, TX, type Lang } from "@/lib/tienda-i18n";

type Aviso = { id: string; tipo: string; datos: DatosAviso; url: string | null; leida: boolean; created_at: string };

const CADA_MS = 60_000;

export default function Campana({ lang }: { lang: Lang }) {
  const t = TX[lang].campana;
  const [avisos, setAvisos] = useState<Aviso[]>([]);
  const [noLeidas, setNoLeidas] = useState(0);
  const [abierta, setAbierta] = useState(false);
  // En celular el panel va a lo ancho de la pantalla, justo debajo de la
  // campana (anclado a ella se salía por la izquierda).
  const [fijo, setFijo] = useState<React.CSSProperties | undefined>(undefined);
  const caja = useRef<HTMLDivElement>(null);

  // Devuelve lo que cargó (null si no pudo).
  const cargar = useCallback(async (): Promise<Aviso[] | null> => {
    try {
      const res = await fetch("/api/notificaciones?audiencia=cliente", { cache: "no-store" });
      if (!res.ok) return null;
      const data = await res.json();
      const lista: Aviso[] = Array.isArray(data.avisos) ? data.avisos : [];
      setAvisos(lista);
      setNoLeidas(Number(data.noLeidas) || 0);
      return lista;
    } catch {
      /* sin red: queda lo último que se vio */
      return null;
    }
  }, []);

  useEffect(() => {
    void cargar();
    const tick = window.setInterval(() => {
      if (document.visibilityState === "visible") void cargar();
    }, CADA_MS);
    const alVolver = () => {
      if (document.visibilityState === "visible") void cargar();
    };
    document.addEventListener("visibilitychange", alVolver);
    return () => {
      window.clearInterval(tick);
      document.removeEventListener("visibilitychange", alVolver);
    };
  }, [cargar]);

  // Cerrar con un toque afuera o Escape.
  useEffect(() => {
    if (!abierta) return;
    const afuera = (e: PointerEvent) => {
      if (caja.current && !caja.current.contains(e.target as Node)) setAbierta(false);
    };
    const tecla = (e: KeyboardEvent) => e.key === "Escape" && setAbierta(false);
    document.addEventListener("pointerdown", afuera);
    document.addEventListener("keydown", tecla);
    return () => {
      document.removeEventListener("pointerdown", afuera);
      document.removeEventListener("keydown", tecla);
    };
  }, [abierta]);

  // Al abrir: primero lo último y después se marcan leídos SOLO los que se
  // muestran (marcar "todos" se llevaba puestos avisos que no llegó a ver).
  async function marcarLeidos() {
    const lista = (await cargar()) ?? avisos;
    const ids = lista.filter((a) => !a.leida).map((a) => a.id);
    if (ids.length === 0) return;
    setNoLeidas((n) => Math.max(0, n - ids.length));
    await fetch("/api/notificaciones?audiencia=cliente", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ids }),
    }).catch(() => {});
  }

  function abrir() {
    const abrir = !abierta;
    if (abrir && window.innerWidth < 640 && caja.current) {
      const r = caja.current.getBoundingClientRect();
      setFijo({ position: "fixed", top: r.bottom + 8, left: 16, right: 16, width: "auto" });
    } else {
      setFijo(undefined);
    }
    setAbierta(abrir);
    // Se ven como nuevas mientras está abierta; el contador baja ya.
    if (abrir) void marcarLeidos();
    if (!abrir) setAvisos((a) => a.map((x) => ({ ...x, leida: true })));
  }

  return (
    <div className="campana" ref={caja}>
      <button
        type="button"
        className="campana-btn"
        onClick={abrir}
        aria-expanded={abierta}
        aria-label={noLeidas > 0 ? t.conNuevas(noLeidas) : t.titulo}
        title={t.titulo}
      >
        <svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <path d="M6 8a6 6 0 1 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
          <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
        </svg>
        {noLeidas > 0 && <span className="campana-n">{noLeidas > 9 ? "9+" : noLeidas}</span>}
      </button>
      {abierta && (
        <div className="campana-panel" role="dialog" aria-label={t.titulo} style={fijo}>
          <p className="campana-h">{t.titulo}</p>
          {avisos.length === 0 ? (
            <p className="campana-vacia">{t.vacia}</p>
          ) : (
            <ul className="campana-lista">
              {avisos.map((a) => {
                const txt = textoAviso(a.tipo, a.datos, lang);
                if (!txt) return null;
                return (
                  <li key={a.id} className={a.leida ? "" : "is-nueva"}>
                    <Link href="/mis-pedidos" onClick={() => setAbierta(false)}>
                      <strong>{txt.titulo}</strong>
                      <span>{txt.cuerpo}</span>
                      <time dateTime={a.created_at}>{fechaHora(a.created_at, LOCALE[lang])}</time>
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
