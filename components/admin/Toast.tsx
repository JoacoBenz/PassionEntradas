"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export type ToastKind = "success" | "error";
export type ToastMsg = { id: number; kind: ToastKind; text: string };

// Hook simple de toasts (sin dependencias externas).
export function useToast() {
  const [toasts, setToasts] = useState<ToastMsg[]>([]);
  const nextId = useRef(1);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);

  useEffect(() => {
    const pending = timers.current;
    return () => pending.forEach(clearTimeout);
  }, []);

  const push = useCallback((kind: ToastKind, text: string) => {
    const id = nextId.current++;
    setToasts((prev) => [...prev, { id, kind, text }]);
    timers.current.push(
      setTimeout(() => {
        setToasts((cur) => cur.filter((t) => t.id !== id));
      }, 3500)
    );
  }, []);

  return { toasts, push };
}

export function ToastViewport({ toasts }: { toasts: ToastMsg[] }) {
  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-4 z-50 flex flex-col items-center gap-2 px-4">
      {toasts.map((t) => (
        <div
          key={t.id}
          role="status"
          className="toast-in pointer-events-auto flex w-full max-w-sm items-center gap-2.5 rounded-xl px-4 py-3 text-sm font-medium text-white shadow-card"
          style={{
            backgroundColor: t.kind === "success" ? "#0D9377" : "#D14D68",
          }}
        >
          <span
            className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-white/20 text-[11px]"
            aria-hidden
          >
            {t.kind === "success" ? "✓" : "✕"}
          </span>
          {t.text}
        </div>
      ))}
    </div>
  );
}
