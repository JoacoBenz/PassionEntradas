import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { createServerSupabase, createAdminSupabase } from "@/lib/supabase/server";
import { getRol } from "@/lib/auth";
import { DEFAULT_EUR_USD } from "@/lib/tickets";
import { isMock, mockGetEurUsd, mockSetEurUsd } from "@/lib/mock-db";

// Cotización EUR->USD de la tienda (tabla config, clave eur_usd).
// GET -> { eurUsd } · PUT -> guarda y revalida la tienda.
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
      { error: "Solo el administrador maneja la cotización" },
      { status: 403 }
    );
  }
  return null;
}

export async function GET() {
  const denied = await requireAdmin();
  if (denied) return denied;

  if (isMock()) {
    return NextResponse.json({ eurUsd: mockGetEurUsd() });
  }

  const { data, error } = await createAdminSupabase()
    .from("config")
    .select("value")
    .eq("key", "eur_usd")
    .maybeSingle();
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  const v = Number(data?.value);
  return NextResponse.json({
    eurUsd: Number.isFinite(v) && v > 0 ? v : DEFAULT_EUR_USD,
  });
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

  // Rango generoso pero que frena errores de tipeo (1080 en vez de 1.08):
  // el EUR/USD real vive alrededor de 1.
  const eurUsd = Number(body.eurUsd);
  if (!Number.isFinite(eurUsd) || eurUsd < 0.5 || eurUsd > 3) {
    return NextResponse.json(
      { error: "Cotización inválida: cuántos dólares vale 1 euro (entre 0.5 y 3)" },
      { status: 400 }
    );
  }
  const redondeada = Math.round(eurUsd * 10000) / 10000;

  if (!isMock()) {
    const { error } = await createAdminSupabase()
      .from("config")
      .upsert({ key: "eur_usd", value: redondeada }, { onConflict: "key" });
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
  } else {
    mockSetEurUsd(redondeada);
  }

  // La tienda es ISR: sin esto el precio viejo seguiría hasta la revalidación
  // de fondo. También en mock, para poder probar el flujo completo en local.
  revalidatePath("/(tienda)", "layout");

  return NextResponse.json({ eurUsd: redondeada });
}
