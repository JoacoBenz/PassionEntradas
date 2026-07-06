import { ESTADO_COLOR, ESTADO_LABEL, type Estado } from "@/lib/operaciones";

// Chip de estado con el color correspondiente (fondo suave + texto fuerte).
export default function StatusChip({ estado }: { estado: Estado }) {
  const color = ESTADO_COLOR[estado];
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold"
      style={{
        color,
        backgroundColor: `${color}14`,
        boxShadow: `inset 0 0 0 1px ${color}33`,
      }}
    >
      <span
        className="h-1.5 w-1.5 rounded-full"
        style={{ backgroundColor: color }}
        aria-hidden
      />
      {ESTADO_LABEL[estado]}
    </span>
  );
}
