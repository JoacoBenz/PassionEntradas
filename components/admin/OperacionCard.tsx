"use client";

import {
  ESTADO_COLOR,
  HITO_COLOR,
  estadoDe,
  formatARS,
  whatsappMessage,
  type Operacion,
  type StatusAction,
} from "@/lib/operaciones";
import StatusChip from "@/components/StatusChip";

type Props = {
  op: Operacion;
  baseUrl: string;
  busy?: boolean;
  // readOnly: modo moderador — sin botones de cambio de estado.
  readOnly?: boolean;
  onAction?: (op: Operacion, action: StatusAction, okMsg: string) => void;
  onCopied: (text: string) => void;
};

// Card de una operación en el panel, con estética de ticket: lomo de color
// por estado, dos hitos independientes (entrada / pago) que se marcan y
// desmarcan por separado, y una franja de acciones separada por troquelado.
export default function OperacionCard({
  op,
  baseUrl,
  busy = false,
  readOnly = false,
  onAction,
  onCopied,
}: Props) {
  const link = `${baseUrl}/op/${op.id}`;
  const estado = estadoDe(op);
  const color = ESTADO_COLOR[estado];
  const cancelada = estado === "cancelada";
  const entrada = !!op.entrada_recibida_at;
  const pago = !!op.pago_confirmado_at;

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
            <StatusChip estado={estado} />
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

          {/* Hitos independientes: cada uno se marca/desmarca por separado */}
          {!readOnly && !cancelada && (
            <div className="mt-4 grid grid-cols-2 gap-2">
              <HitoButton
                label="Entrada recibida"
                done={entrada}
                color={HITO_COLOR.entrada}
                busy={busy}
                onClick={() =>
                  onAction?.(
                    op,
                    { action: "entrada", done: !entrada },
                    !entrada ? "Entrada marcada como recibida" : "Entrada desmarcada"
                  )
                }
              />
              <HitoButton
                label="Pago confirmado"
                done={pago}
                color={HITO_COLOR.pago}
                busy={busy}
                onClick={() =>
                  onAction?.(
                    op,
                    { action: "pago", done: !pago },
                    !pago ? "Pago marcado como confirmado" : "Pago desmarcado"
                  )
                }
              />
            </div>
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
            (cancelada ? (
              <button
                onClick={() =>
                  onAction?.(op, { action: "reabrir" }, "Operación reabierta")
                }
                disabled={busy}
                className="ml-auto rounded-lg border border-brand px-3 py-1.5 text-xs font-semibold text-brand transition-colors hover:bg-brand/5 disabled:opacity-60"
              >
                Reabrir
              </button>
            ) : (
              estado !== "confirmada" && (
                <button
                  onClick={() =>
                    onAction?.(op, { action: "cancelar" }, "Operación cancelada")
                  }
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

// Botón de hito con dos estados: pendiente (delineado, "Marcar…") y hecho
// (relleno con ✓; al tocarlo de nuevo se desmarca, por si hubo un error).
function HitoButton({
  label,
  done,
  color,
  busy,
  onClick,
}: {
  label: string;
  done: boolean;
  color: string;
  busy: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      disabled={busy}
      aria-pressed={done}
      title={done ? "Tocá para desmarcar" : undefined}
      className="flex items-center justify-center gap-2 rounded-xl border-2 px-3 py-2.5 text-xs font-semibold transition-colors disabled:opacity-60"
      style={
        done
          ? { backgroundColor: color, borderColor: color, color: "#fff" }
          : { borderColor: `${color}66`, color }
      }
    >
      <span
        className="flex h-4 w-4 items-center justify-center rounded-full border text-[10px]"
        style={{
          borderColor: done ? "rgba(255,255,255,0.7)" : `${color}88`,
          backgroundColor: done ? "rgba(255,255,255,0.2)" : "transparent",
        }}
        aria-hidden
      >
        {done ? "✓" : ""}
      </span>
      {label}
    </button>
  );
}
