import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { createServerSupabase, createAdminSupabase } from "@/lib/supabase/server";
import { getRol } from "@/lib/auth";
import { isMock, mockGetPortalActivo, mockSetPortalActivo } from "@/lib/mock-db";

// Interruptor de las entradas de Passion en la tienda (config.portal_activo).
// GET -> { activo } · PUT { activo: boolean } -> guarda y revalida la tienda.
// Apagado = la tienda muestra solo las entradas propias. El worker sigue
// sincronizando igual; esto solo afecta qué se publica.
// Solo administrador; escrituras con service role.

async function requireAdmin(): Promise<NextResponse | null> {
  if (isMock()) return null;
  const supabase = createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }
  if (getRol(user) !== "administrador") {
    return NextResponse.json(
      { error: "Solo el administrador maneja la tienda" },
      { status: 403 }
    );
  }
  return null;
}

export async function GET() {
  const denied = await requireAdmin();
  if (denied) return denied;

  if (isMock()) {
    return NextResponse.json({ activo: mockGetPortalActivo() });
  }

  const { data, error } = await createAdminSupabase()
    .from("config")
    .select("value")
    .eq("key", "portal_activo")
    .maybeSingle();
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  // Sin fila = activado (default histórico).
  return NextResponse.json({ activo: data == null || Number(data.value) !== 0 });
}

export async function PUT(request: Request) {
  const denied = await requireAdmin();
  if (denied) return denied;

  let body: any;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }
  if (typeof body.activo !== "boolean") {
    return NextResponse.json(
      { error: "Falta 'activo' (true/false)" },
      { status: 400 }
    );
  }

  if (!isMock()) {
    const { error } = await createAdminSupabase()
      .from("config")
      .upsert({ key: "portal_activo", value: body.activo ? 1 : 0 }, { onConflict: "key" });
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
  } else {
    mockSetPortalActivo(body.activo);
  }

  // La tienda es ISR: reflejar el cambio al instante (también en mock, para
  // poder probar el flujo completo en local).
  revalidatePath("/(tienda)", "layout");

  return NextResponse.json({ activo: body.activo });
}
