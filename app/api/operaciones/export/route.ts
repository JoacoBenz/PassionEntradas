import { NextResponse } from "next/server";
import { createServerSupabase, createAdminSupabase } from "@/lib/supabase/server";
import { getRol } from "@/lib/auth";
import { estadoDe, ESTADO_LABEL, type Operacion } from "@/lib/operaciones";
import { isMock, mockListOps } from "@/lib/mock-db";

// GET /api/operaciones/export — CSV con TODAS las operaciones (sin el tope
// de 1000 del panel), para contabilidad. Solo administrador.
// Descarga directa: <a href> desde el panel.
export const dynamic = "force-dynamic";

const COLUMNAS = [
  "code",
  "evento",
  "estado",
  "monto_usd",
  "comision_usd",
  "comprador",
  "vendedor",
  "fecha_evento",
  "creada",
  "entrada_recibida",
  "entrada_por",
  "pago_confirmado",
  "pago_por",
  "cerrada",
  "cerrada_por",
  "notas",
];

// Escape CSV: comillas dobladas y campo entrecomillado si hace falta.
// Los campos que arrancan con caracteres de fórmula van con ' adelante
// (inyección de fórmulas al abrir en Excel/Sheets).
function celda(v: unknown): string {
  if (v == null) return "";
  let s = String(v);
  if (/^[=+\-@]/.test(s)) s = `'${s}`;
  if (/[",\n\r;]/.test(s)) s = `"${s.replace(/"/g, '""')}"`;
  return s;
}

function fila(op: Operacion): string {
  const dia = (ts: string | null) => (ts ? ts.slice(0, 10) : "");
  return [
    op.code,
    op.evento,
    ESTADO_LABEL[estadoDe(op)],
    op.monto,
    op.fee,
    op.comprador_alias ?? "",
    op.vendedor_alias ?? "",
    op.fecha_evento ?? "",
    dia(op.created_at),
    dia(op.entrada_recibida_at),
    op.entrada_recibida_por ?? "",
    dia(op.pago_confirmado_at),
    op.pago_confirmado_por ?? "",
    dia(op.cerrada_at),
    op.cerrada_por ?? "",
    op.notas ?? "",
  ]
    .map(celda)
    .join(",");
}

export async function GET() {
  let ops: Operacion[];

  if (isMock()) {
    ops = mockListOps();
  } else {
    const supabase = createServerSupabase();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user || getRol(user) !== "administrador") {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    // Paginado de a 1000 (tope de PostgREST) hasta agotar el historial.
    const admin = createAdminSupabase();
    const PAGINA = 1000;
    ops = [];
    for (let p = 0; p < 100; p++) {
      const { data, error } = await admin
        .from("operaciones")
        .select("*")
        .order("created_at", { ascending: true })
        .range(p * PAGINA, (p + 1) * PAGINA - 1);
      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
      }
      ops = ops.concat((data ?? []) as Operacion[]);
      if ((data ?? []).length < PAGINA) break;
    }
  }

  // BOM para que Excel abra el UTF-8 (tildes) sin drama.
  const csv = "﻿" + [COLUMNAS.join(","), ...ops.map(fila)].join("\r\n");
  const hoy = new Date().toISOString().slice(0, 10);
  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="operaciones-${hoy}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
