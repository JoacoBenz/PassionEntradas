"use client";

// Carrito de la tienda: el cliente junta varias entradas (pedidos/consultas) y
// después las envía todas juntas a revisión. Recién ahí se crean las
// operaciones (una por entrada) y se avisa a los vendedores. El carrito vive
// en localStorage, así sobrevive a la navegación entre /entradas y /buscar.

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";
import Link from "next/link";
import { fmtPrice } from "@/lib/tickets";
import { TX, type Lang } from "@/lib/tienda-i18n";

export type CartItem = {
  key: string; // = ticket_id (una fila del catálogo)
  ticket_id: string;
  evento: string;
  comp: string;
  sector: string;
  monto: number; // 0 en consultas / sin precio
  tipo: "pedido" | "consulta";
  fecha_evento: string | null;
};

type CartCtx = {
  items: CartItem[];
  count: number;
  has: (key: string) => boolean;
  add: (item: CartItem) => void;
  remove: (key: string) => void;
  clear: () => void;
};

const Ctx = createContext<CartCtx | null>(null);

export function useCart(): CartCtx {
  const c = useContext(Ctx);
  if (!c) throw new Error("useCart debe usarse dentro de <CartProvider>");
  return c;
}

const STORAGE = "tm_cart";

export function CartProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<CartItem[]>([]);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) setItems(parsed);
      }
    } catch {
      /* carrito corrupto: arranca vacío */
    }
    setReady(true);
  }, []);

  useEffect(() => {
    if (!ready) return;
    try {
      localStorage.setItem(STORAGE, JSON.stringify(items));
    } catch {
      /* sin storage: el carrito igual funciona en memoria */
    }
  }, [items, ready]);

  const add = useCallback((item: CartItem) => {
    setItems((prev) => (prev.some((i) => i.key === item.key) ? prev : [...prev, item]));
  }, []);
  const remove = useCallback((key: string) => {
    setItems((prev) => prev.filter((i) => i.key !== key));
  }, []);
  const clear = useCallback(() => setItems([]), []);
  const has = useCallback((key: string) => items.some((i) => i.key === key), [items]);

  return (
    <Ctx.Provider value={{ items, count: items.length, has, add, remove, clear }}>
      {children}
    </Ctx.Provider>
  );
}

// Idioma recordado (mismo criterio que el resto de la tienda).
function useLang(): Lang {
  const [lang, setLang] = useState<Lang>("en");
  useEffect(() => {
    const s = localStorage.getItem("tm_lang");
    if (s === "en" || s === "es") setLang(s);
  }, []);
  return lang;
}

type Estado = "idle" | "sending" | "done" | "err";

// Barra flotante + hoja de revisión. Se renderiza una vez, a nivel layout de
// la tienda; se muestra sola cuando hay entradas en el carrito.
export function CartBar() {
  const { items, count, remove, clear } = useCart();
  const lang = useLang();
  const c = TX[lang].carrito;
  const [open, setOpen] = useState(false);
  const [estado, setEstado] = useState<Estado>("idle");
  const [error, setError] = useState("");

  const total = items.reduce((a, i) => a + (i.monto || 0), 0);

  function cerrar() {
    setOpen(false);
    if (estado === "done" || estado === "err") {
      setEstado("idle");
      setError("");
    }
  }

  async function enviar() {
    if (estado === "sending" || items.length === 0) return;
    setEstado("sending");
    setError("");
    try {
      const res = await fetch("/api/pedidos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          items: items.map((i) => ({
            tipo: i.tipo,
            ticket_id: i.ticket_id,
            evento: i.evento,
            sector: i.sector,
            monto: i.monto,
            fecha_evento: i.fecha_evento,
          })),
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || c.errGeneric);
        setEstado("err");
        return;
      }
      clear();
      setEstado("done");
    } catch {
      setError(c.errRed);
      setEstado("err");
    }
  }

  // Nada que mostrar: carrito vacío y sin el cartel de "enviado".
  if (count === 0 && estado !== "done") return null;

  return (
    <>
      {count > 0 && !open && (
        <div className="cart-bar">
          <button type="button" onClick={() => setOpen(true)}>
            <span className="cart-count">{count}</span>
            {c.revisar}
            {total > 0 && <span className="cart-bar-total">{fmtPrice(total, lang)}</span>}
          </button>
        </div>
      )}

      {open && (
        <div className="cart-modal" role="dialog" aria-modal="true" aria-label={c.titulo}>
          <div className="cart-panel">
            {estado === "done" ? (
              <div className="cart-ok">
                <h2>{c.okTitulo}</h2>
                <p>{c.okP}</p>
                <Link className="btn-primary" href="/mis-pedidos" onClick={cerrar}>
                  {c.okCta}
                </Link>
                <div style={{ marginTop: 12 }}>
                  <button type="button" className="cart-keep" onClick={cerrar}>
                    {c.cerrar}
                  </button>
                </div>
              </div>
            ) : (
              <>
                <div className="cart-h">
                  <div>
                    <h2>{c.titulo}</h2>
                    <p>{c.sub}</p>
                  </div>
                  <button type="button" className="cart-x" onClick={cerrar} aria-label={c.cerrar}>
                    ✕
                  </button>
                </div>

                <ul className="cart-list">
                  {items.map((i) => (
                    <li className="cart-it" key={i.key}>
                      <span className={`cart-it-tag ${i.tipo}`}>
                        {i.tipo === "pedido" ? c.pedidoTag : c.consultaTag}
                      </span>
                      <div className="cart-it-main">
                        <div className="cart-it-ev">{i.evento}</div>
                        <div className="cart-it-meta">
                          <span>{i.sector}</span>
                          {i.comp && <span>· {i.comp}</span>}
                        </div>
                      </div>
                      <span className="cart-it-price">
                        {i.monto > 0 ? fmtPrice(i.monto, lang) : c.aConsultar}
                      </span>
                      <button
                        type="button"
                        className="cart-rm"
                        onClick={() => remove(i.key)}
                        aria-label={`${c.quitar}: ${i.evento}`}
                      >
                        {c.quitar}
                      </button>
                    </li>
                  ))}
                </ul>

                {total > 0 && (
                  <div className="cart-total">
                    <span>{c.total}</span>
                    <span>{fmtPrice(total, lang)}</span>
                  </div>
                )}

                {estado === "err" && <p className="cart-err">{error}</p>}

                <div className="cart-actions">
                  <button type="button" className="cart-keep" onClick={cerrar}>
                    {c.seguir}
                  </button>
                  <button
                    type="button"
                    className="cart-send"
                    onClick={enviar}
                    disabled={estado === "sending" || items.length === 0}
                  >
                    {estado === "sending" ? c.enviando : c.enviar}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
}
