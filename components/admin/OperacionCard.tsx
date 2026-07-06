"use client";

import {
  STATUS_COLOR,
  formatARS,
  nextStatus,
  nextStatusLabel,
  whatsappMessage,
  type Operacion,
} from "@/lib/operaciones";
import StatusChip from "@/components/StatusChip";

type Props = {
  op: Operacion;
  baseUrl: string;
  busy?: boolean;
  // readOnly: modo moderador — sin botones de cambio de estado.
  readOnly?: boolean;
  onAdvance?: (op: Operacion) => void;
  onCancel?: (op: Operacion) => void;
  onReopen?: (op: Operacion) => void;
  onCopied: (text: string) => void;
};

// Card de una operación en el panel, con estética de ticket: lomo de color
// por estado, cuerpo con el botón de "un toque" y una franja de acciones
// separada por troquelado real (agujeros vía máscara .punch-*).
export default function OperacionCard({
  op,
  baseUrl,
  busy = false,
  readOnly = false,
  onAdvance,
  onCancel,
  onReopen,
  onCopied,
}: Props) {
  const link = `${baseUrl}/op/${op.id}`;
  const color = STATUS_COLOR[op.status];
  const advanceLabel = nextStatusLabel(op.status);
  const next = nextStatus(op.status);

  async function copy(text: string, label: string) {
    try {
      await navigator.clipboard.writeText(text);
      onCopied(label);
    } catch {
      onCopied("No se pudo copiar");
    }
  }

  const secondaryBtn =
    "rounded-lg border border-line bg-white px-3 py-1.5 text-xs font-medium text-[#4A4E5E] transition-colors hover:border-[#C5C9D6] hover:bg-canvas";

  return (
    <article className="card-shadow card-lift relative overflow-hidden rounded-2xl">
      {/* Cuerpo principal */}
      <div className="punch-b relative bg-white">
        {/* Lomo de color según estado */}
        <span
          className="absolute inset-y-0 left-0 w-1.5"
          style={{ backgroundColor: color }}
          aria-hidden
        />
        <div className="p-4 pl-6">
          <div className="flex items-start justify-between gap-3">
            <span className="rounded-md bg-canvas px-2 py-0.5 font-mono text-[11px] tracking-wider text-[#6A6E7E]">
              {op.code}
            </span>
            <StatusChip status={op.status} />
          </div>

          <h3 className="mt-2 truncate font-display text-lg font-semibold tracking-tight">
            {op.evento}
          </h3>

          <div className="mt-1.5 flex flex-wrap items-baseline gap-x-4 gap-y-1 text-sm">
            <span className="font-display text-base font-bold tabular-nums">
              {formatARS(op.monto)}
            </span>
            <span className="text-muted">+ {formatARS(op.fee)} comisión</span>
          </div>

          {(op.comprador_alias || op.vendedor_alias) && (
            <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-[#6A6E7E]">
              {op.comprador_alias && (
                <span>
                  Comprador:{" "}
                  <span className="font-medium">{op.comprador_alias}</span>
                </span>
              )}
              {op.vendedor_alias && (
                <span>
                  Vendedor:{" "}
                  <span className="font-medium">{op.vendedor_alias}</span>
                </span>
              )}
            </div>
          )}

          {/* Botón primario de un toque */}
          {!readOnly && next && advanceLabel && (
            <button
              onClick={() => onAdvance?.(op)}
              disabled={busy}
              className="mt-4 w-full rounded-xl px-4 py-3 text-sm font-semibold text-white shadow-sm transition-opacity hover:opacity-90 disabled:opacity-60"
              style={{ backgroundColor: STATUS_COLOR[next] }}
            >
              {advanceLabel} →
            </button>
          )}
        </div>
      </div>

      {/* Franja de acciones, separada por troquel real */}
      <div className="punch-t relative bg-white">
        <span
          className="absolute inset-y-0 left-0 w-1.5"
          style={{ backgroundColor: color }}
          aria-hidden
        />
        <div className="perf-line-light mx-4 ml-6" />
        <div className="flex flex-wrap gap-2 p-3 pl-6">
          <a
            href={link}
            target="_blank"
            rel="noopener noreferrer"
            className={secondaryBtn}
          >
            Ver
          </a>
          <button onClick={() => copy(link, "Link copiado")} className={secondaryBtn}>
            Copiar link
          </button>
          <button
            onClick={() =>
              copy(whatsappMessage(op.evento, link), "Mensaje de WhatsApp copiado")
            }
            className={secondaryBtn}
          >
            Copiar WhatsApp
          </button>

          {!readOnly &&
            (op.status === "cancelada" ? (
              <button
                onClick={() => onReopen?.(op)}
                disabled={busy}
                className="ml-auto rounded-lg border border-brand px-3 py-1.5 text-xs font-semibold text-brand transition-colors hover:bg-brand/5 disabled:opacity-60"
              >
                Reabrir
              </button>
            ) : (
              op.status !== "confirmada" && (
                <button
                  onClick={() => onCancel?.(op)}
                  disabled={busy}
                  className="ml-auto rounded-lg border border-estado-cancelada px-3 py-1.5 text-xs font-semibold text-estado-cancelada transition-colors hover:bg-estado-cancelada/5 disabled:opacity-60"
                >
                  Cancelar
                </button>
              )
            ))}
        </div>
      </div>
    </article>
  );
}
