import { NextResponse } from "next/server";
import { createAdminSupabase } from "@/lib/supabase/server";
import { aliasValido } from "@/lib/comunidad";
import { isMock } from "@/lib/mock-db";

// POST /api/registro — alta simple de usuario de la comunidad.
// El signup público de Supabase está deshabilitado a propósito: el alta pasa
// por acá con service role, y el rol queda fijado en app_metadata (que el
// usuario no puede editar) como "usuario": solo feed, nunca panel.
export async function POST(request: Request) {
  let body: any;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }

  const alias = String(body.alias ?? "").trim();
  const email = String(body.email ?? "").trim().toLowerCase();
  const password = String(body.password ?? "");

  if (!aliasValido(alias)) {
    return NextResponse.json(
      { error: "El alias debe tener 3-30 caracteres: letras, números, punto, guión" },
      { status: 400 }
    );
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json({ error: "Email inválido" }, { status: 400 });
  }
  if (password.length < 8) {
    return NextResponse.json(
      { error: "La contraseña debe tener al menos 8 caracteres" },
      { status: 400 }
    );
  }

  if (isMock()) {
    return NextResponse.json({ ok: true }, { status: 201 });
  }

  const admin = createAdminSupabase();
  const { error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { alias },
    app_metadata: { role: "usuario" },
  });

  if (error) {
    const yaExiste = /already|registered|exists/i.test(error.message);
    return NextResponse.json(
      { error: yaExiste ? "Ese email ya está registrado" : error.message },
      { status: yaExiste ? 409 : 500 }
    );
  }

  return NextResponse.json({ ok: true }, { status: 201 });
}
