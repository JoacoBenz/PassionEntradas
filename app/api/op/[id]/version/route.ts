import { NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";
import { isMock, mockOpPublica } from "@/lib/mock-db";

// GET /api/op/[id]/version — versión mínima de una operación pública.
// Mismo contrato de acceso que la página /op/[id]: hace falta el uuid exacto
// (el RPC operacion_publica no expone nada más). Devuelve { v: updated_at }
// para que AutoRefresh solo re-renderice cuando la operación cambió.
export const dynamic = "force-dynamic";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function GET(
  _request: Request,
  { params }: { params: { id: string } }
) {
  if (!UUID_RE.test(params.id)) {
    return NextResponse.json({ error: "No encontrada" }, { status: 404 });
  }

  if (isMock()) {
    const op = mockOpPublica(params.id);
    if (!op) {
      return NextResponse.json({ error: "No encontrada" }, { status: 404 });
    }
    return NextResponse.json({ v: op.updated_at });
  }

  const supabase = createServerSupabase();
  const { data, error } = await supabase
    .rpc("operacion_publica", { op_id: params.id })
    .maybeSingle();

  if (error || !data) {
    return NextResponse.json({ error: "No encontrada" }, { status: 404 });
  }

  return NextResponse.json({ v: (data as { updated_at: string }).updated_at });
}
