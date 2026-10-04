import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { createServerSupabase, createAdminSupabase } from "@/lib/supabase/server";
import { getRol } from "@/lib/auth";
import { DEFAULT_EUR_USD } from "@/lib/tickets";
import { isMock, mockGetArsPorUsd, mockGetEurUsd, mockSetArsPorUsd, mockSetEurUsd } from "@/lib/mock-db";
import { parseCotizacion } from "@/lib/factura";

// Cotizaciones de la tienda (tabla config):
// - eur_usd: dólares por euro (los precios de Passion vienen en euros);
// - ars_por_usd: pesos por dólar. No se cobra con ella: solo compara precios
//   en pesos con precios en dólares (el "desde" de un evento).
// GET -> { eurUsd, arsPorUsd } · PUT { eurUsd } o { arsPorUsd } -> guarda esa
// y revalida la tienda.
// Solo administrador; escrituras con service role.

// Nunca estática: en modo demo el GET no lee la sesión y Next lo prerenderizaba
// como archivo fijo en el build (y el PUT daba 405). Una cotización cacheada
// además quedaría vieja.
export const dynamic = "force-dynamic";

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
    return NextResponse.json({ eurUsd: mockGetEurUsd(), arsPorUsd: mockGetArsPorUsd() });
  }

  const { data, error } = await createAdminSupabase()
    .from("config")
    .select("key, value")
    .in("key", ["eur_usd", "ars_por_usd"]);
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  const de = (k: string) => Number((data ?? []).find((r) => r.key === k)?.value);
  const v = de("eur_usd");
  const ars = de("ars_por_usd");
  return NextResponse.json({
    eurUsd: Number.isFinite(v) && v > 0 ? v : DEFAULT_EUR_USD,
    arsPorUsd: Number.isFinite(ars) && ars > 0 ? ars : null,
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

  // Pesos por dólar: mismo parser que el dólar del día de la factura (acepta
  // "1.465,50" o "1465.5").
  if (body.arsPorUsd !== undefined) {
    const ars = parseCotizacion(body.arsPorUsd);
    if (ars == null) {
      return NextResponse.json(
        { error: "Cotización inválida: cuántos pesos vale 1 dólar (por ejemplo 1465,50)" },
        { status: 400 }
      );
    }
    if (!isMock()) {
      const { error } = await createAdminSupabase()
        .from("config")
        .upsert({ key: "ars_por_usd", value: ars }, { onConflict: "key" });
      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
      }
    } else {
      mockSetArsPorUsd(ars);
    }
    revalidatePath("/(tienda)", "layout");
    return NextResponse.json({ arsPorUsd: ars });
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
