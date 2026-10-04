import { PASOS_PUBLICOS, type EstadoPublico } from "@/lib/operaciones";

// Pasos que ve el COMPRADOR, en orden. El pago al proveedor no aparece: es
// gestión nuestra. Que tengamos la entrada sí: es lo que lo habilita a pagar.
const PASOS: Record<string, { label: string; color: string }> = {
  pedido_recibido: { label: "Recibido", color: "#5F6577" },
  pedido_confirmado: { label: "Confirmado", color: "#1F33E0" },
  listo_para_pagar: { label: "Para pagar", color: "#B07A14" },
  pago_recibido: { label: "Pagado", color: "#6C5BF2" },
  entregada: { label: "Entregada", color: "#0D9377" },
};

// Un paso está hecho si el estado actual llegó a él o lo pasó. En cancelada
// queda todo apagado.
export default function ProgressSteps({ estado }: { estado: EstadoPublico }) {
  const actual = PASOS_PUBLICOS.indexOf(estado);

  return (
    <ol className="grid grid-cols-5 gap-1.5">
      {PASOS_PUBLICOS.map((paso, i) => {
        const it = PASOS[paso];
        const done = actual >= 0 && i <= actual;
        return (
          <li
            key={paso}
            className="flex flex-col items-center gap-1.5 rounded-xl border px-1 py-2.5"
            style={{
              borderColor: done ? `${it.color}55` : "#E2E4EC",
              backgroundColor: done ? `${it.color}0D` : "transparent",
            }}
            aria-current={i === actual ? "step" : undefined}
          >
            <span
              className="flex h-6 w-6 items-center justify-center rounded-full border-2 font-mono text-[11px] font-bold transition-colors"
              style={{
                borderColor: done ? it.color : "#CBCEDA",
                backgroundColor: done ? it.color : "transparent",
                color: done ? "#fff" : "#7B8095",
              }}
              aria-hidden
            >
              {done ? "✓" : i + 1}
            </span>
            <span
              className="text-center text-[10px] font-medium uppercase leading-tight tracking-wide"
              style={{ color: done ? it.color : "#7B8095" }}
            >
              {it.label}
            </span>
          </li>
        );
      })}
    </ol>
  );
}
