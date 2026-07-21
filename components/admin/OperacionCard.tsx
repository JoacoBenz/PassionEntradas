"use client";

import { useState } from "react";
import {
  ESTADO_LABEL,
  HITO_COLOR,
  diasHastaEvento,
  estadoDe,
  estadoDotColor,
  formatUSD,
  formatFecha,
  quienDe,
  whatsappMessage,
  TIPO_LABEL,
  type Operacion,
  type StatusAction,
} from "@/lib/operaciones";
import StatusChip from "@/components/StatusChip";
import FacturaModal from "./FacturaModal";

type Props = {
  op: Operacion;
  baseUrl: string;
  busy?: boolean;
  // readOnly: modo moderador — sin botones de cambio de estado.
  readOnly?: boolean;
  // Arranca desplegada (ej: recién creada en el módulo de carga).
  defaultOpen?: boolean;
  onAction?: (op: Operacion, action: StatusAction, okMsg: string) => void;
  onUpdate?: (
    op: Operacion,
    patch: Partial<Pick<Operacion, "notas" | "fecha_evento">>,
    okMsg: string
  ) => void;
  onCopied: (text: string) => void;
};

// Aviso de urgencia según la fecha del evento (solo operaciones en curso).
function UrgenciaChip({ dias }: { dias: number }) {
  const label =
    dias < 0
      ? "El evento ya pasó"
      : dias === 0
        ? "¡El evento es HOY!"
        : dias === 1
          ? "El evento es mañana"
          : `Evento en ${dias} días`;
  const color = dias <= 1 ? "#D14D68" : dias <= 7 ? "#B07A14" : "#5F6577";
  return (
    <span
      className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold"
      style={{ color, backgroundColor: `${color}14`, boxShadow: `inset 0 0 0 1px ${color}33` }}
    >
      {label}
    </span>
  );
}

// Fecha corta para la línea colapsada ("18 JUL").
function fechaCorta(fecha: string): string {
  const [, m, d] = fecha.split("-");
  const meses = ["ENE", "FEB", "MAR", "ABR", "MAY", "JUN", "JUL", "AGO", "SEP", "OCT", "NOV", "DIC"];
  const mes = meses[Number(m) - 1] ?? "";
  return `${d} ${mes}`;
}

// Operación como fila compacta que se expande al tocar (como las entradas
// de la tienda): colapsada muestra estado, evento, code y monto; desplegada
// trae los hitos, las notas y las acciones.
export default function OperacionCard({
  op,
  baseUrl,
  busy = false,
  readOnly = false,
  defaultOpen = false,
  onAction,
  onUpdate,
  onCopied,
}: Props) {
  const link = `${baseUrl}/op/${op.id}`;
  const estado = estadoDe(op);
  // Punto de la fila: color por GRUPO (abierta / en curso / cerrada /
  // cancelada), para leer el estado de un vistazo.
  const color = estadoDotColor(estado);
  const cancelada = estado === "cancelada";
  const cerrada = estado === "cerrada";
  const entrada = !!op.entrada_recibida_at;
  const pago = !!op.pago_confirmado_at;
  const dias = diasHastaEvento(op.fecha_evento);
  const enCurso = !cerrada && !cancelada;

  const [open, setOpen] = useState(defaultOpen);
  const [editingNotas, setEditingNotas] = useState(false);
  const [notasDraft, setNotasDraft] = useState(op.notas ?? "");
  const [confirmandoCancel, setConfirmandoCancel] = useState(false);
  const [facturaAbierta, setFacturaAbierta] = useState(false);

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
    <article className="card-shadow overflow-hidden rounded-2xl bg-white">
      {/* Fila colapsada: toda la fila es el toggle */}
      <button
        onClick={() => setOpen(!open)}
        aria-expanded={open}
        className="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-canvas/40"
      >
        <span
          className="h-2 w-2 shrink-0 rounded-full"
          style={{ backgroundColor: color }}
          aria-hidden
        />
        <span className="min-w-0 flex-1">
          <span className="block truncate font-display text-[15px] font-semibold leading-tight tracking-tight">
            {op.evento}
          </span>
          <span className="mt-0.5 block truncate font-mono text-[10px] uppercase tracking-wider text-muted">
            {op.code} · {ESTADO_LABEL[estado]}
            {op.fecha_evento ? ` · ${fechaCorta(op.fecha_evento)}` : ""}
          </span>
        </span>
        {op.tipo !== "operacion" && (
          // Origen: pedido/consulta del cliente desde la tienda.
          <span
            className="shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide"
            style={
              op.tipo === "pedido"
                ? { color: "#1F33E0", backgroundColor: "#1F33E014" }
                : { color: "#B07A14", backgroundColor: "#B07A1414" }
            }
          >
            {TIPO_LABEL[op.tipo]}
          </span>
        )}
        <span className="whitespace-nowrap font-display text-sm font-bold tabular-nums">
          {formatUSD(op.monto)}
        </span>
        <svg
          className={`h-3.5 w-3.5 shrink-0 text-muted transition-transform ${open ? "rotate-180" : ""}`}
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden
        >
          <path d="m6 9 6 6 6-6" />
        </svg>
      </button>

      {/* Cuerpo desplegado, separado por el troquel punteado de siempre */}
      {open && (
        <div className="border-t border-dashed border-[#C5C9D6]">
          <div className="p-4">
            <div className="flex flex-wrap items-center gap-2">
              <StatusChip estado={estado} />
              {enCurso && dias != null && dias <= 14 && <UrgenciaChip dias={dias} />}
            </div>

            <div className="mt-2.5 flex flex-wrap gap-x-4 gap-y-1 text-xs text-[#6A6E7E]">
              {op.fecha_evento && <span>📅 {formatFecha(op.fecha_evento)}</span>}
              <span>
                Comisión{" "}
                <span className="font-semibold text-body">{formatUSD(op.fee)}</span>
              </span>
              {op.comprador_alias && (
                <span>
                  {op.tipo === "operacion" ? "Comprador" : "Cliente"}{" "}
                  <span className="font-medium text-body">{op.comprador_alias}</span>
                </span>
              )}
              {op.cliente_email && op.cliente_email !== op.comprador_alias && (
                <span>
                  <span className="font-medium text-body">{op.cliente_email}</span>
                </span>
              )}
              {op.sector && (
                <span>
                  Sector <span className="font-medium text-body">{op.sector}</span>
                </span>
              )}
              {op.vendedor_alias && (
                <span>
                  Vendedor <span className="font-medium text-body">{op.vendedor_alias}</span>
                </span>
              )}
              {op.cuenta_debitar && (
                <span>
                  Debita de{" "}
                  <span className="font-mono font-medium text-body">{op.cuenta_debitar}</span>
                </span>
              )}
            </div>

            {/* Notas internas (solo panel; nunca van al link público) */}
            {(op.notas || (!readOnly && onUpdate)) && (
              <div className="mt-3 rounded-xl bg-canvas px-3 py-2.5 text-xs">
                {editingNotas ? (
                  <div className="space-y-2">
                    <textarea
                      rows={3}
                      maxLength={2000}
                      autoFocus
                      value={notasDraft}
                      onChange={(e) => setNotasDraft(e.target.value)}
                      className="w-full resize-y rounded-lg border border-line bg-white px-2.5 py-2 text-xs outline-none focus:border-brand"
                      placeholder="Notas internas de la operación…"
                    />
                    <div className="flex gap-2">
                      <button
                        onClick={() => {
                          onUpdate?.(
                            op,
                            { notas: notasDraft.trim() || null },
                            "Notas guardadas"
                          );
                          setEditingNotas(false);
                        }}
                        disabled={busy}
                        className="rounded-lg bg-ink px-3 py-1.5 font-semibold text-white disabled:opacity-60"
                      >
                        Guardar notas
                      </button>
                      <button
                        onClick={() => {
                          setNotasDraft(op.notas ?? "");
                          setEditingNotas(false);
                        }}
                        className="rounded-lg px-3 py-1.5 font-medium text-[#6A6E7E] hover:bg-white"
                      >
                        Cancelar
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-start justify-between gap-3">
                    <p className="whitespace-pre-wrap text-[#4A4E5E]">
                      {op.notas ? (
                        <>
                          <span className="mr-1 font-semibold uppercase tracking-wide text-muted">
                            Nota:
                          </span>
                          {op.notas}
                        </>
                      ) : (
                        <span className="text-muted">Sin notas internas.</span>
                      )}
                    </p>
                    {!readOnly && onUpdate && (
                      <button
                        onClick={() => {
                          setNotasDraft(op.notas ?? "");
                          setEditingNotas(true);
                        }}
                        className="shrink-0 rounded-lg border border-line bg-white px-2.5 py-1 font-medium text-[#4A4E5E] transition-colors hover:bg-white/60"
                      >
                        {op.notas ? "Editar" : "Agregar nota"}
                      </button>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Hitos en orden estricto (fiel al proceso): primero se reciben y
                verifican las entradas; recién ahí se autoriza el pago. */}
            {!readOnly && !cancelada && !cerrada && (
              <div className="mt-4 grid grid-cols-2 gap-2">
                <HitoButton
                  label="Entrada recibida"
                  done={entrada}
                  por={quienDe(op.entrada_recibida_por)}
                  color={HITO_COLOR.entrada}
                  busy={busy}
                  locked={pago}
                  lockedHint="Hay un pago confirmado: desmarcá el pago primero"
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
                  por={quienDe(op.pago_confirmado_por)}
                  color={HITO_COLOR.pago}
                  busy={busy}
                  locked={!entrada}
                  lockedHint="Primero marcá la entrada recibida: el pago se autoriza después de verificar"
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

            {/* Tercer paso accionable: con entrada y pago listos, se cierra */}
            {!readOnly && estado === "lista_para_cerrar" && (
              <button
                onClick={() =>
                  onAction?.(op, { action: "cerrar", done: true }, "Entrega registrada — operación cerrada")
                }
                disabled={busy}
                className="mt-2 w-full rounded-xl bg-cobalt px-4 py-3 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-cobalt-deep disabled:opacity-60"
              >
                ✓ Entradas entregadas — cerrar
              </button>
            )}

            {/* Cerrada: resumen con opción de reabrir el cierre. Con los
                botones de hitos ocultos, el "quién hizo qué" vive acá. */}
            {!readOnly && cerrada && (
              <div className="mt-4 flex items-center justify-between gap-3 rounded-xl bg-ink px-4 py-3 text-white">
                <span className="min-w-0 text-sm font-semibold">
                  ✓ Operación cerrada
                  {op.cerrada_at && (
                    <span className="ml-2 font-normal text-white/60">
                      {new Date(op.cerrada_at).toLocaleDateString("es-AR", {
                        day: "2-digit",
                        month: "2-digit",
                        timeZone: "America/Argentina/Buenos_Aires",
                      })}
                    </span>
                  )}
                  {quienDe(op.cerrada_por) && (
                    <span className="ml-2 font-normal text-white/60">
                      por {quienDe(op.cerrada_por)}
                    </span>
                  )}
                  {(op.entrada_recibida_por || op.pago_confirmado_por) && (
                    <span className="mt-0.5 block truncate text-[11px] font-normal text-white/50">
                      {op.entrada_recibida_por &&
                        `Entrada por ${quienDe(op.entrada_recibida_por)}`}
                      {op.entrada_recibida_por && op.pago_confirmado_por && " · "}
                      {op.pago_confirmado_por &&
                        `Pago por ${quienDe(op.pago_confirmado_por)}`}
                    </span>
                  )}
                </span>
                <button
                  onClick={() =>
                    onAction?.(op, { action: "cerrar", done: false }, "Cierre reabierto")
                  }
                  disabled={busy}
                  className="rounded-lg border border-white/25 px-3 py-1.5 text-xs font-medium text-white/85 transition-colors hover:bg-white/10 disabled:opacity-60"
                >
                  Reabrir
                </button>
              </div>
            )}
          </div>

          {/* Acciones, separadas por la línea troquelada */}
          <div className="perf-line-light mx-4" />
          <div className="flex flex-wrap gap-2 p-3 px-4">
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
            {/* Recibo/factura: recién cuando el pago está confirmado. */}
            {!readOnly && pago && !cancelada && (
              <button onClick={() => setFacturaAbierta(true)} className={secondaryBtn}>
                Factura
              </button>
            )}

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
                !cerrada && (
                  <button
                    onClick={() => {
                      // Dos toques: el primero arma la confirmación (se
                      // desarma sola a los 4s), el segundo cancela. Evita
                      // cancelar por un toque accidental en el celular —
                      // el link público mostraría "Cancelada" al cliente.
                      if (!confirmandoCancel) {
                        setConfirmandoCancel(true);
                        window.setTimeout(() => setConfirmandoCancel(false), 4000);
                        return;
                      }
                      setConfirmandoCancel(false);
                      onAction?.(op, { action: "cancelar" }, "Operación cancelada");
                    }}
                    disabled={busy}
                    className={`ml-auto rounded-lg border px-3 py-1.5 text-xs font-semibold transition-colors disabled:opacity-60 ${
                      confirmandoCancel
                        ? "border-estado-cancelada bg-estado-cancelada text-white"
                        : "border-estado-cancelada text-estado-cancelada hover:bg-estado-cancelada/5"
                    }`}
                  >
                    {confirmandoCancel ? "¿Confirmás cancelar?" : "Cancelar"}
                  </button>
                )
              ))}
          </div>
        </div>
      )}

      {facturaAbierta && (
        <FacturaModal
          op={op}
          baseUrl={baseUrl}
          onClose={() => setFacturaAbierta(false)}
          onToast={(kind, msg) => onCopied(kind === "error" ? msg : msg)}
        />
      )}
    </article>
  );
}

// Botón de hito con dos estados: pendiente (delineado, "Marcar…") y hecho
// (relleno con ✓; al tocarlo de nuevo se desmarca, por si hubo un error).
// Completado, muestra además QUIÉN lo marcó ("por kiru"), para saber a quién
// preguntarle por ese paso.
function HitoButton({
  label,
  done,
  por,
  color,
  busy,
  locked,
  lockedHint,
  onClick,
}: {
  label: string;
  done: boolean;
  por?: string | null;
  color: string;
  busy: boolean;
  locked?: boolean;
  lockedHint?: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      disabled={busy || locked}
      aria-pressed={done}
      title={locked ? lockedHint : done ? "Tocá para desmarcar" : undefined}
      className="flex items-center justify-center gap-2 rounded-xl border-2 px-3 py-2.5 text-xs font-semibold transition-colors disabled:opacity-60"
      style={
        done
          ? { backgroundColor: color, borderColor: color, color: "#fff" }
          : { borderColor: `${color}66`, color }
      }
    >
      <span
        className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full border text-[10px]"
        style={{
          borderColor: done ? "rgba(255,255,255,0.7)" : `${color}88`,
          backgroundColor: done ? "rgba(255,255,255,0.2)" : "transparent",
        }}
        aria-hidden
      >
        {done ? "✓" : ""}
      </span>
      <span className="min-w-0">
        {label}
        {done && por && (
          <span className="block truncate text-[10px] font-normal text-white/75">
            Por {por}
          </span>
        )}
      </span>
    </button>
  );
}
