import { pasosCliente, type EstadoPublico } from "@/lib/operaciones";

// Los 3 pasos del comprador (ver pasosCliente): Recibido→Confirmado,
// Para pagar→Pagado, Entregada. Cada uno cambia de nombre al completarse.
const COLOR: Record<string, string> = {
  pedido: "#1F33E0",
  pago: "#6C5BF2",
  entrega: "#0D9377",
};

export default function ProgressSteps({ estado }: { estado: EstadoPublico }) {
  const pasos = pasosCliente(estado);
  if (!pasos) return null;

  return (
    <ol className="grid grid-cols-3 gap-2">
      {pasos.map((p, i) => {
        const color = COLOR[p.key];
        const hecho = p.estado === "hecho";
        const actual = p.estado === "actual";
        return (
          <li
            key={p.key}
            className="flex flex-col items-center gap-1.5 rounded-xl border px-2 py-3"
            style={{
              borderColor: hecho || actual ? `${color}55` : "#E2E4EC",
              backgroundColor: hecho ? `${color}0D` : "transparent",
            }}
            aria-current={actual ? "step" : undefined}
          >
            <span
              className="flex h-7 w-7 items-center justify-center rounded-full border-2 font-mono text-[12px] font-bold transition-colors"
              style={{
                borderColor: hecho || actual ? color : "#CBCEDA",
                backgroundColor: hecho ? color : "transparent",
                color: hecho ? "#fff" : actual ? color : "#7B8095",
              }}
              aria-hidden
            >
              {hecho ? "✓" : i + 1}
            </span>
            <span
              className="text-center text-[11px] font-semibold uppercase leading-tight tracking-wide"
              style={{ color: hecho || actual ? color : "#7B8095" }}
            >
              {p.label}
            </span>
          </li>
        );
      })}
    </ol>
  );
}
