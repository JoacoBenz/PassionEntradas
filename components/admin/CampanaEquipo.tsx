"use client";

// Campana del panel: los avisos del equipo (pedidos nuevos, consultas, lo que
// el cliente aceptó o canceló, solicitudes de acceso y los recordatorios de
// lo que lleva rato esperando). Misma API que la de la tienda
// (/api/notificaciones?audiencia=equipo). Abrirla marca todo leído.

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { fechaHora } from "@/lib/fechas";
import { textoAvisoEquipo, type DatosAvisoEquipo } from "@/lib/recordatorios";

type Aviso = { id: string; tipo: string; datos: DatosAvisoEquipo; url: string | null; leida: boolean; created_at: string };

const CADA_MS = 60_000;
const API = "/api/notificaciones?audiencia=equipo";

export default function CampanaEquipo() {
  const [avisos, setAvisos] = useState<Aviso[]>([]);
  const [noLeidas, setNoLeidas] = useState(0);
  const [abierta, setAbierta] = useState(false);
  // En celular el panel va a lo ancho de la pantalla (anclado a la campana se
  // salía por la izquierda).
  const [fijo, setFijo] = useState<React.CSSProperties | undefined>(undefined);
  const caja = useRef<HTMLDivElement>(null);

  const cargar = useCallback(async () => {
    try {
      const res = await fetch(API, { cache: "no-store" });
      if (!res.ok) return;
      const data = await res.json();
      setAvisos(Array.isArray(data.avisos) ? data.avisos : []);
      setNoLeidas(Number(data.noLeidas) || 0);
    } catch {
      /* sin red: queda lo último */
    }
  }, []);

  useEffect(() => {
    void cargar();
    const tick = window.setInterval(() => {
      if (document.visibilityState === "visible") void cargar();
    }, CADA_MS);
    const alVolver = () => document.visibilityState === "visible" && void cargar();
    document.addEventListener("visibilitychange", alVolver);
    return () => {
      window.clearInterval(tick);
      document.removeEventListener("visibilitychange", alVolver);
    };
  }, [cargar]);

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

  function alternar() {
    const abrir = !abierta;
    if (abrir && window.innerWidth < 640 && caja.current) {
      const r = caja.current.getBoundingClientRect();
      setFijo({ position: "fixed", top: r.bottom + 8, left: 16, right: 16, width: "auto" });
    } else {
      setFijo(undefined);
    }
    setAbierta(abrir);
    if (abrir && noLeidas > 0) {
      setNoLeidas(0);
      void fetch(API, { method: "POST" }).catch(() => {});
    }
    if (!abrir) setAvisos((a) => a.map((x) => ({ ...x, leida: true })));
  }

  return (
    <div className="relative" ref={caja}>
      <button
        type="button"
        onClick={alternar}
        aria-expanded={abierta}
        aria-label={noLeidas > 0 ? `Avisos: ${noLeidas} sin leer` : "Avisos"}
        title="Avisos"
        className="relative inline-flex h-10 w-10 items-center justify-center rounded-xl border border-white/15 bg-white/5 text-white/85 transition-colors hover:bg-white/15 md:h-9 md:w-9"
      >
        <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <path d="M6 8a6 6 0 1 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
          <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
        </svg>
        {noLeidas > 0 && (
          <span className="absolute -right-1.5 -top-1.5 inline-flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-[#D14D68] px-1 text-[10px] font-bold text-white">
            {noLeidas > 9 ? "9+" : noLeidas}
          </span>
        )}
      </button>
      {abierta && (
        <div
          role="dialog"
          aria-label="Avisos"
          style={fijo}
          className="absolute right-0 top-[calc(100%+8px)] z-40 max-h-[70vh] w-[min(360px,calc(100vw-32px))] overflow-auto rounded-2xl bg-white text-body shadow-xl ring-1 ring-black/5"
        >
          <p className="border-b border-dashed border-line px-4 py-2.5 font-mono text-[10px] font-bold uppercase tracking-[0.14em] text-muted">
            Avisos
          </p>
          {avisos.length === 0 ? (
            <p className="px-4 py-5 text-sm text-muted">Sin avisos todavía.</p>
          ) : (
            <ul className="divide-y divide-dashed divide-line">
              {avisos.map((a) => {
                const txt = textoAvisoEquipo(a.tipo, a.datos);
                if (!txt) return null;
                const recordatorio = a.tipo.startsWith("recordatorio_");
                return (
                  <li key={a.id}>
                    <Link
                      href={a.url ?? "/admin"}
                      onClick={() => setAbierta(false)}
                      className={`grid gap-0.5 px-4 py-2.5 hover:bg-canvas ${a.leida ? "" : "shadow-[inset_3px_0_0_#D14D68]"}`}
                    >
                      <span className={`text-[13px] font-semibold ${recordatorio ? "text-[#B5304B]" : "text-ink"}`}>{txt.titulo}</span>
                      {txt.cuerpo && <span className="text-xs text-[#4A4E5E]">{txt.cuerpo}</span>}
                      <time className="font-mono text-[10px] text-muted" dateTime={a.created_at}>
                        {fechaHora(a.created_at)}
                      </time>
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
