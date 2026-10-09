"use client";

// Campana del panel: los avisos del equipo (pedidos nuevos, consultas, lo que
// el cliente aceptó o canceló, solicitudes de acceso y los recordatorios de
// lo que lleva rato esperando). Misma API que la de la tienda
// (/api/notificaciones?audiencia=equipo). Abrirla marca todo leído.

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { fechaHora } from "@/lib/fechas";
import { textoAvisoEquipo, type DatosAvisoEquipo, type EstadoWhatsappAviso } from "@/lib/recordatorios";
import { EVENTO_IR_AL_PANEL } from "@/lib/panel-filtros";

type Aviso = {
  id: string;
  tipo: string;
  datos: DatosAvisoEquipo;
  url: string | null;
  leida: boolean;
  created_at: string;
  // Cómo salió el WhatsApp de este aviso (null: no se mandó).
  whatsapp?: EstadoWhatsappAviso | null;
};

const TONO_WA: Record<EstadoWhatsappAviso["tono"], string> = {
  ok: "text-[#2E7D4F]",
  error: "text-[#B5304B]",
  gris: "text-muted",
};

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

  // Devuelve lo que cargó (null si no pudo).
  const cargar = useCallback(async (): Promise<Aviso[] | null> => {
    try {
      const res = await fetch(API, { cache: "no-store" });
      if (!res.ok) return null;
      const data = await res.json();
      const lista: Aviso[] = Array.isArray(data.avisos) ? data.avisos : [];
      setAvisos(lista);
      setNoLeidas(Number(data.noLeidas) || 0);
      return lista;
    } catch {
      /* sin red: queda lo último */
      return null;
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

  // Al abrir: primero lo último (lo que entró desde la última consulta) y
  // después se marcan leídos SOLO los que se están mostrando. Marcar "todos"
  // en el server se llevaba puestos avisos que nadie llegó a ver.
  async function marcarLeidos() {
    const lista = (await cargar()) ?? avisos;
    const ids = lista.filter((a) => !a.leida).map((a) => a.id);
    if (ids.length === 0) return;
    setNoLeidas((n) => Math.max(0, n - ids.length));
    await fetch(API, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ids }),
    }).catch(() => {});
  }

  function alternar() {
    const abrir = !abierta;
    // A lo ancho de la pantalla en el celular, y también cuando la campana
    // quedó tan a la izquierda (header partido en dos renglones) que el panel
    // anclado a ella se saldría por el borde.
    const r = caja.current?.getBoundingClientRect();
    if (abrir && r && (window.innerWidth < 640 || r.right < 360 + 16)) {
      setFijo({ position: "fixed", top: r.bottom + 8, left: 16, right: 16, width: "auto" });
    } else {
      setFijo(undefined);
    }
    setAbierta(abrir);
    if (abrir) void marcarLeidos();
    if (!abrir) setAvisos((a) => a.map((x) => ({ ...x, leida: true })));
  }

  const fallidos = avisos.filter((a) => a.whatsapp?.tono === "error").length;

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
          {fallidos > 0 && (
            <p role="status" className="border-b border-dashed border-line bg-[#FCEBEE] px-4 py-2 text-xs font-medium text-[#B5304B]">
              {fallidos === 1 ? "1 WhatsApp no salió" : `${fallidos} WhatsApp no salieron`}: el motivo está en cada aviso.
            </p>
          )}
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
                      onClick={() => {
                        setAbierta(false);
                        // Ya en el Panel: que aplique el filtro aunque la URL
                        // sea la misma (ver EVENTO_IR_AL_PANEL).
                        if (window.location.pathname === "/admin") {
                          window.dispatchEvent(new CustomEvent(EVENTO_IR_AL_PANEL, { detail: a.url ?? "/admin" }));
                        }
                      }}
                      className={`grid gap-0.5 px-4 py-2.5 hover:bg-canvas ${a.leida ? "" : "shadow-[inset_3px_0_0_#D14D68]"}`}
                    >
                      <span className={`text-[13px] font-semibold ${recordatorio ? "text-[#B5304B]" : "text-ink"}`}>{txt.titulo}</span>
                      {txt.cuerpo && <span className="text-xs text-[#4A4E5E]">{txt.cuerpo}</span>}
                      {a.whatsapp && (
                        <span className={`text-[11px] leading-snug ${TONO_WA[a.whatsapp.tono]}`}>{a.whatsapp.texto}</span>
                      )}
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
