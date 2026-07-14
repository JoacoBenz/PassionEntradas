import { notFound } from "next/navigation";
import { createPublicSupabase } from "@/lib/supabase/public";
import {
  FACTURA_TX,
  fmtMontoFactura,
  numeroFactura,
  type Factura,
} from "@/lib/factura";
import { isMock, mockFacturaPorId } from "@/lib/mock-db";
import BotonImprimir from "./BotonImprimir";
import "./factura.css";

// Factura/recibo público: se accede solo con el uuid exacto (impredecible),
// mismo modelo que el link de seguimiento /op/[id]. Renderiza el snapshot
// emitido — nunca datos vivos de la operación.
export const dynamic = "force-dynamic";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function fechaLarga(iso: string | null, idioma: "en" | "es", tbc: string): string {
  if (!iso) return tbc;
  const label = new Date(iso).toLocaleDateString(idioma === "en" ? "en-US" : "es-AR", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
  return label.charAt(0).toUpperCase() + label.slice(1);
}

function fechaCorta(iso: string, idioma: "en" | "es"): string {
  return new Date(iso).toLocaleDateString(idioma === "en" ? "en-US" : "es-AR", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
}

export default async function FacturaPage({ params }: { params: { id: string } }) {
  if (!UUID_RE.test(params.id)) notFound();

  let factura: Factura | null = null;
  if (isMock()) {
    factura = mockFacturaPorId(params.id);
  } else {
    const supabase = createPublicSupabase();
    const { data, error } = await supabase
      .rpc("factura_publica", { f_id: params.id })
      .maybeSingle();
    if (!error && data) {
      factura = { id: params.id, ...(data as Omit<Factura, "id">) };
    }
  }
  if (!factura) notFound();

  const d = factura.datos;
  const t = FACTURA_TX[d.idioma] ?? FACTURA_TX.en;
  const num = numeroFactura(factura.numero, factura.created_at);
  const usd = (n: number) => fmtMontoFactura(n, d.idioma);
  const opUrl = `/op/${d.operacion.id}`;

  return (
    <main className="fac-body">
      <div className="fac-sheet">
        <header className="fac-head">
          <div className="fac-wm">
            <span className="fac-mark">▚</span> TICKET<em>MIRROR</em>
          </div>
          <div className="fac-head-right">
            <div className="fac-doc-kind">{t.docKind}</div>
            <div className="fac-doc-num">{num}</div>
            <span className="fac-chip">
              <i /> {t.paid}
            </span>
          </div>
        </header>

        <section className="fac-parties">
          <div className="fac-party">
            <p className="fac-label">{t.billedTo}</p>
            <p className="fac-name">{d.comprador.nombre}</p>
            {d.comprador.contacto && <p className="fac-dato">{d.comprador.contacto}</p>}
          </div>
          <div className="fac-party">
            <p className="fac-label">{t.issued}</p>
            <p className="fac-name">{fechaCorta(factura.created_at, d.idioma)}</p>
            {d.agente && (
              <p className="fac-dato">
                {t.handledBy} <strong>{d.agente}</strong> · {t.team}
              </p>
            )}
            <p className="fac-dato">
              {t.operacion} <span className="fac-mono">{d.operacion.code}</span>
            </p>
          </div>
        </section>

        <section className="fac-item-wrap">
          <p className="fac-label">{t.ticketPurchased}</p>
          <div className="fac-ticket">
            <div className="fac-t-body">
              {d.evento.competicion && (
                <p className="fac-t-eyebrow">{d.evento.competicion}</p>
              )}
              <h1 className="fac-t-title">{d.evento.titulo}</h1>
              <div className="fac-t-meta">
                <div>
                  <span className="k">{t.date}</span>
                  <span className="v">{fechaLarga(d.evento.fecha, d.idioma, t.dateTBC)}</span>
                </div>
                <div>
                  <span className="k">{t.venue}</span>
                  <span className="v">{d.evento.sede ?? t.venueTBC}</span>
                </div>
                {d.evento.sector && (
                  <div>
                    <span className="k">{t.section}</span>
                    <span className="v">{d.evento.sector}</span>
                  </div>
                )}
              </div>
            </div>
            <aside className="fac-t-stub">
              <span className="fac-stub-k">{t.qty}</span>
              <span className="fac-stub-qty">×{d.cantidad}</span>
              <span className="fac-stub-k">{t.unitPrice}</span>
              <span className="fac-stub-price">{usd(d.precio_unitario)}</span>
              <div className="fac-barcode" aria-hidden />
              <span className="fac-stub-code">{d.operacion.code}</span>
            </aside>
          </div>
        </section>

        <section>
          <div className="fac-totals">
            <table>
              <tbody>
                <tr>
                  <td className="t-label">{t.subtotal(d.cantidad, usd(d.precio_unitario))}</td>
                  <td>{usd(d.subtotal)}</td>
                </tr>
                <tr>
                  <td className="t-label">{t.fee}</td>
                  <td>{usd(d.fee)}</td>
                </tr>
                <tr className="total-row">
                  <td>{t.total}</td>
                  <td>{usd(d.total)}</td>
                </tr>
              </tbody>
            </table>
          </div>
          <p className="fac-usd-note">{t.usdNote}</p>
        </section>

        <section className="fac-pay">
          <div>
            <span className="k">{t.payMethod}</span>
            <span className="v">{d.metodo_pago}</span>
          </div>
          <div>
            <span className="k">{t.payConfirmed}</span>
            <span className="v">
              {d.pago_confirmado_at ? fechaCorta(d.pago_confirmado_at, d.idioma) : "—"}
            </span>
          </div>
          <div>
            <span className="k">{t.track}</span>
            <span className="v fac-mono">
              <a href={opUrl}>{d.operacion.code}</a>
            </span>
          </div>
        </section>

        <footer className="fac-foot">
          <span className="brand">▚ TicketMirror</span>
          <span className="terms">{t.terms}</span>
        </footer>
      </div>

      <div className="fac-print-row">
        <BotonImprimir label={t.print} />
      </div>
    </main>
  );
}
