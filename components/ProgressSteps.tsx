import { HITO_COLOR } from "@/lib/operaciones";

type Props = {
  entrada: boolean;
  pago: boolean;
  cerrada: boolean;
  cancelada?: boolean;
};

// Los hitos de la operación, mostrados A LA VEZ (entrada y pago son
// independientes: cualquiera puede llegar primero). "Listo" se enciende
// cuando el admin cierra la operación. En cancelada queda todo apagado.
export default function ProgressSteps({ entrada, pago, cerrada, cancelada = false }: Props) {
  const items = [
    { label: "Entrada", done: entrada && !cancelada, color: HITO_COLOR.entrada },
    { label: "Pago", done: pago && !cancelada, color: HITO_COLOR.pago },
    { label: "Entrega", done: cerrada && !cancelada, color: HITO_COLOR.listo },
  ];

  return (
    <div className="grid grid-cols-3 gap-2">
      {items.map((it) => (
        <div
          key={it.label}
          className="flex flex-col items-center gap-1.5 rounded-xl border px-2 py-3"
          style={{
            borderColor: it.done ? `${it.color}55` : "#E2E4EC",
            backgroundColor: it.done ? `${it.color}0D` : "transparent",
          }}
        >
          <span
            className="flex h-7 w-7 items-center justify-center rounded-full border-2 font-mono text-[12px] font-bold transition-colors"
            style={{
              borderColor: it.done ? it.color : "#CBCEDA",
              backgroundColor: it.done ? it.color : "transparent",
              color: it.done ? "#fff" : "#7B8095",
            }}
            aria-hidden
          >
            {it.done ? "✓" : "·"}
          </span>
          <span
            className="text-[11px] font-medium uppercase tracking-wide"
            style={{ color: it.done ? it.color : "#7B8095" }}
          >
            {it.label}
          </span>
        </div>
      ))}
    </div>
  );
}
