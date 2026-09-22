import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { getRol } from "@/lib/auth";
import { decidirRuteo } from "@/lib/ruteo";

// Refresca la sesión de Supabase Auth y RUTEA los módulos:
// - /admin: solo administrador (los moderadores van a /moderador), salvo
//   /admin/cuenta (cambio de contraseña propio): todo el staff.
// - /moderador: cualquier usuario del staff.
// - /entradas y /buscar (la tienda): staff o CLIENTE aprobado. Anónimo -> al
//   login de cliente (/ingresar). La tienda dejó de ser pública.
// - Sesión SIN rol: no es de nadie, se corta y afuera.
// - La landing (/) es pública, pero al staff lo manda a su panel.
//
// La REGLA en sí (qué rol va a dónde) vive en lib/ruteo.ts, pura y con tests:
// es lo que sostiene los permisos del sitio, y acá no se puede verificar — el
// modo demo saltea la autenticación entera. Este archivo solo la aplica.
// /op/[id] y la factura pública quedan fuera del matcher.
export async function middleware(request: NextRequest) {
  const path = request.nextUrl.pathname;

  function redirectTo(pathname: string) {
    const url = request.nextUrl.clone();
    url.pathname = pathname;
    return NextResponse.redirect(url);
  }

  // Modo demo sin Supabase: todo abierto; los logins mandan a su módulo.
  if (process.env.MOCK_DATA === "1") {
    if (path === "/admin/login") return redirectTo("/admin");
    if (path === "/ingresar") return redirectTo("/entradas");
    return NextResponse.next();
  }

  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(
          cookiesToSet: { name: string; value: string; options: CookieOptions }[]
        ) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  // getUser() valida el token contra el servidor de Auth (no confía en la
  // cookie): es lo que recomienda Supabase para el middleware. Además de rutear,
  // así una cookie adulterada rebota ya en el borde. Cada página/API igual
  // reafirma con getUser()+rol (defensa en profundidad).
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const decision = decidirRuteo(path, user ? getRol(user) : null, !!user);

  if (decision.accion === "cerrar-sesion") {
    // Sesión que no es de nadie: se cierra para que el login no la recicle en
    // un loop de redirecciones.
    await supabase.auth.signOut();
    return redirectTo(decision.a);
  }
  if (decision.accion === "redirigir") {
    return redirectTo(decision.a);
  }
  return response;
}

export const config = {
  matcher: [
    // La raíz entra al matcher solo para mandar al staff a su panel; el
    // anónimo y el cliente siguen viendo la landing estática.
    "/",
    "/admin/:path*",
    "/moderador/:path*",
    "/entradas/:path*",
    "/cuenta/:path*",
    "/mis-pedidos/:path*",
    "/buscar",
    "/mapa",
    "/ingresar",
  ],
};
