import { NextResponse } from "next/server";
import { createServerSupabase, createAdminSupabase } from "@/lib/supabase/server";
import { getRol } from "@/lib/auth";
import { parseHoras, VENCE_HORAS_DEFAULT, VENCE_HORAS_MAX, VENCE_HORAS_MIN } from "@/lib/cotizaciones";
import { isMock, mockGetVenceHoras, mockSetVenceHoras } from "@/lib/mock-db";

// GET/PUT /api/ajustes-cotizacion — cuántas horas tiene el cliente para
// aceptar una cotización (config.cotizacion_vence_horas, 48 por defecto).
// Aplica a las cotizaciones que se manden DESPUÉS de cambiarlo. Solo admin.
export const dynamic = "force-dynamic";

async function soloAdmin(): Promise<NextResponse | null> {
  if (isMock()) return null;
  const supabase = createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user || getRol(user) !== "administrador") {
    return NextResponse.json({ error: "Solo el administrador" }, { status: 403 });
  }
  return null;
}

export async function GET() {
  const no = await soloAdmin();
  if (no) return no;
  if (isMock()) return NextResponse.json({ horas: mockGetVenceHoras() });
  const { data } = await createAdminSupabase()
    .from("config")
    .select("value")
    .eq("key", "cotizacion_vence_horas")
    .maybeSingle();
  const h = Number(data?.value);
  return NextResponse.json({ horas: h > 0 ? h : VENCE_HORAS_DEFAULT });
}

export async function PUT(request: Request) {
  const no = await soloAdmin();
  if (no) return no;
  let body: any;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }
  const horas = parseHoras(body?.horas);
  if (horas == null) {
    return NextResponse.json(
      { error: `Horas inválidas: un número entero entre ${VENCE_HORAS_MIN} y ${VENCE_HORAS_MAX}` },
      { status: 400 }
    );
  }
  if (isMock()) {
    mockSetVenceHoras(horas);
    return NextResponse.json({ horas });
  }
  const { error } = await createAdminSupabase()
    .from("config")
    .upsert({ key: "cotizacion_vence_horas", value: horas }, { onConflict: "key" });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ horas });
}
