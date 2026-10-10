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
    <ol className="grid grid-cols-3 gap-1.5 sm:gap-2">
      {pasos.map((p, i) => {
        const color = COLOR[p.key];
        const hecho = p.estado === "hecho";
        const actual = p.estado === "actual";
        return (
          <li
            key={p.key}
            className="flex min-w-0 flex-col items-center gap-1.5 rounded-xl border px-1 py-3 sm:px-2"
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
              // En 320px "CONFIRMADO" a 11px con tracking no entraba en su cajita
              // y pisaba el borde: más chico y sin tracking en celular.
              className="max-w-full text-center text-[10px] font-semibold uppercase leading-tight tracking-normal sm:text-[11px] sm:tracking-wide"
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
