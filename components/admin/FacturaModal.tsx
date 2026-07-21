"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type { Operacion } from "@/lib/operaciones";
import { numeroFactura, type Factura } from "@/lib/factura";

// Emite (o re-emite) la factura de una operación cobrada. Los 4 datos que
// la operación no tiene (nombre real, contacto, cantidad, método de pago)
// se completan acá; el resto sale del snapshot que arma la API.
export default function FacturaModal({
  op,
  baseUrl,
  onClose,
  onToast,
}: {
  op: Operacion;
  baseUrl: string;
  onClose: () => void;
  onToast: (kind: "success" | "error", msg: string) => void;
}) {
  const [nombre, setNombre] = useState(op.comprador_alias ?? "");
  const [contacto, setContacto] = useState("");
  // Cantidad del pedido (topeada por el stock en la tienda). Arranca de la
  // operación; si ya hay factura emitida, gana su snapshot (efecto de más abajo).
  const [cantidad, setCantidad] = useState(String(op.cantidad || 1));
  const [metodo, setMetodo] = useState("Bank transfer (USD)");
  const [idioma, setIdioma] = useState<"en" | "es">("en");
  const [existente, setExistente] = useState<Factura | null>(null);
  const [cargando, setCargando] = useState(true);
  const [emitiendo, setEmitiendo] = useState(false);
  const enviando = useRef(false);

  // ¿Ya se emitió? Mostramos el link y dejamos re-emitir.
  useEffect(() => {
    let vivo = true;
    fetch(`/api/operaciones/${op.id}/factura`)
      .then((r) => (r.ok ? r.json() : null))
      .then((f) => {
        if (!vivo || !f) return;
        setExistente(f as Factura);
        const d = (f as Factura).datos;
        setNombre(d.comprador.nombre);
        setContacto(d.comprador.contacto ?? "");
        setCantidad(String(d.cantidad));
        setMetodo(d.metodo_pago);
        setIdioma(d.idioma);
      })
      .catch(() => {})
      .finally(() => vivo && setCargando(false));
    return () => {
      vivo = false;
    };
  }, [op.id]);

  async function emitir() {
    if (enviando.current) return;
    if (!nombre.trim()) {
      onToast("error", "El nombre del comprador es obligatorio");
      return;
    }
    const cant = Math.trunc(Number(cantidad));
    if (!Number.isFinite(cant) || cant < 1) {
      onToast("error", "Cantidad inválida");
      return;
    }
    enviando.current = true;
    setEmitiendo(true);
    try {
      const res = await fetch(`/api/operaciones/${op.id}/factura`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          comprador_nombre: nombre,
          comprador_contacto: contacto,
          cantidad: cant,
          metodo_pago: metodo,
          idioma,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        onToast("error", data.error ?? "No se pudo emitir la factura");
        return;
      }
      setExistente(data as Factura);
      onToast(
        "success",
        `Factura ${numeroFactura(data.numero, data.created_at)} ${existente ? "re-emitida" : "emitida"}`
      );
    } catch {
      onToast("error", "Error de red al emitir");
    } finally {
      enviando.current = false;
      setEmitiendo(false);
    }
  }

  async function copiarLink() {
    if (!existente) return;
    try {
      await navigator.clipboard.writeText(`${baseUrl}/factura/${existente.id}`);
      onToast("success", "Link de la factura copiado");
    } catch {
      onToast("error", "No se pudo copiar");
    }
  }

  const inputCls =
    "w-full rounded-lg border border-line bg-white px-3 py-2 text-sm outline-none transition-colors focus:border-brand focus:ring-2 focus:ring-brand/15";
  const labelCls = "mb-1 block text-xs font-medium uppercase tracking-wide text-[#6A6E7E]";

  // Portal al <body>: renderizado adentro de la card de la operación, el
  // overflow/animaciones del árbol lo recortaban. Así flota arriba de TODA
  // la página, siempre. (Solo se monta con el modal abierto: document existe.)
  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-ink/40 p-4 sm:items-center"
      onClick={onClose}
      role="dialog"
      aria-label="Factura de la operación"
    >
      <div
        // max-h + scroll interno: con la operación completa (bloque de
        // factura emitida + formulario) el contenido supera el alto de la
        // pantalla y quedaba cortado sin forma de llegar a los botones.
        className="card-shadow flex max-h-[calc(100dvh-2rem)] w-full max-w-md flex-col overflow-hidden rounded-2xl bg-white"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="surface-ink px-5 py-4 text-white">
          <p className="text-[10px] font-medium uppercase tracking-[0.25em] text-white/50">
            {op.code}
          </p>
          <h2 className="mt-0.5 font-display text-lg font-bold tracking-tight">
            {existente ? "Factura emitida" : "Emitir factura"}
          </h2>
          <p className="mt-1 truncate text-xs text-white/60">{op.evento}</p>
        </div>

        <div className="min-h-0 flex-1 space-y-3 overflow-y-auto p-5">
          {cargando ? (
            <p className="py-4 text-center text-sm text-muted">Cargando…</p>
          ) : (
            <>
              {existente && (
                <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-canvas px-3 py-2.5">
                  <div className="min-w-0">
                    <p className="font-mono text-xs font-bold">
                      {numeroFactura(existente.numero, existente.created_at)}
                    </p>
                    <p className="text-[11px] text-muted">
                      Re-emitir actualiza los datos; el número y el link no cambian.
                    </p>
                  </div>
                  <div className="flex shrink-0 gap-2">
                    <a
                      href={`/factura/${existente.id}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="rounded-lg border border-line bg-white px-3 py-1.5 text-xs font-semibold text-[#4A4E5E] transition-colors hover:bg-canvas"
                    >
                      Ver
                    </a>
                    <button
                      onClick={copiarLink}
                      className="rounded-lg bg-brand px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-brand-deep"
                    >
                      Copiar link
                    </button>
                  </div>
                </div>
              )}

              <div>
                <label htmlFor="f-nombre" className={labelCls}>
                  Nombre del comprador *
                </label>
                <input
                  id="f-nombre"
                  className={inputCls}
                  value={nombre}
                  onChange={(e) => setNombre(e.target.value)}
                  placeholder="Nombre y apellido"
                />
              </div>
              <div>
                <label htmlFor="f-contacto" className={labelCls}>
                  Contacto (tel / email)
                </label>
                <input
                  id="f-contacto"
                  className={inputCls}
                  value={contacto}
                  onChange={(e) => setContacto(e.target.value)}
                  placeholder="+54 9 11 … · nombre@mail.com"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label htmlFor="f-cantidad" className={labelCls}>
                    Cantidad *
                  </label>
                  <input
                    id="f-cantidad"
                    type="number"
                    min={1}
                    step={1}
                    className={`${inputCls} font-mono`}
                    value={cantidad}
                    onChange={(e) => setCantidad(e.target.value)}
                  />
                </div>
                <div>
                  <label htmlFor="f-idioma" className={labelCls}>
                    Idioma
                  </label>
                  <select
                    id="f-idioma"
                    className={inputCls}
                    value={idioma}
                    onChange={(e) => setIdioma(e.target.value as "en" | "es")}
                  >
                    <option value="en">English</option>
                    <option value="es">Español</option>
                  </select>
                </div>
              </div>
              <div>
                <label htmlFor="f-metodo" className={labelCls}>
                  Método de pago *
                </label>
                <select
                  id="f-metodo"
                  className={inputCls}
                  value={metodo}
                  onChange={(e) => setMetodo(e.target.value)}
                >
                  <option>Bank transfer (USD)</option>
                  <option>Transferencia (USD)</option>
                  <option>Cash (USD)</option>
                  <option>Efectivo (USD)</option>
                  <option>Crypto (USDT)</option>
                </select>
              </div>

              <div className="flex gap-2 pt-1">
                <button
                  onClick={emitir}
                  disabled={emitiendo}
                  className="flex-1 rounded-xl bg-brand px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-brand-deep disabled:opacity-60"
                >
                  {emitiendo ? "Emitiendo…" : existente ? "Re-emitir con estos datos" : "Emitir factura"}
                </button>
                <button
                  onClick={onClose}
                  className="rounded-xl border border-line bg-white px-4 py-2.5 text-sm font-medium text-[#4A4E5E] transition-colors hover:bg-canvas"
                >
                  Cerrar
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
}
