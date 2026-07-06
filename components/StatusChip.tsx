import { STATUS_COLOR, STATUS_LABEL, type Status } from "@/lib/operaciones";

// Chip de estado con el color correspondiente (fondo suave + texto fuerte).
export default function StatusChip({ status }: { status: Status }) {
  const color = STATUS_COLOR[status];
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
      {STATUS_LABEL[status]}
    </span>
  );
}
