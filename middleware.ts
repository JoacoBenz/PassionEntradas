import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { getRol } from "@/lib/auth";

// Refresca la sesión de Supabase Auth y RUTEA los módulos:
// - /admin: solo administrador (los moderadores van a /moderador), salvo
//   /admin/cuenta (cambio de contraseña propio): todo el staff.
// - /moderador: cualquier usuario del staff.
// - /entradas y /buscar (la tienda): staff o CLIENTE aprobado. Anónimo -> al
//   login de cliente (/ingresar). La tienda dejó de ser pública.
// - Sesión SIN rol: no es de nadie, se corta y afuera.
// La landing (/), /op/[id] y la factura pública quedan fuera del matcher.
export async function middleware(request: NextRequest) {
  const path = request.nextUrl.pathname;
  const esPanel = path.startsWith("/admin") || path.startsWith("/moderador");
  const esTienda =
    path === "/buscar" || path.startsWith("/entradas") || path.startsWith("/cuenta");
  const esLoginAdmin = path === "/admin/login";
  const esLoginCliente = path === "/ingresar";
  const esLogin = esLoginAdmin || esLoginCliente;

  function redirectTo(pathname: string) {
    const url = request.nextUrl.clone();
    url.pathname = pathname;
    return NextResponse.redirect(url);
  }

  // Modo demo sin Supabase: todo abierto; los logins mandan a su módulo.
  if (process.env.MOCK_DATA === "1") {
    if (esLoginAdmin) return redirectTo("/admin");
    if (esLoginCliente) return redirectTo("/entradas");
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

  // getSession lee de la cookie (sin viaje a Auth salvo refresh). El
  // middleware solo RUTEA; la autorización real la reafirma cada página/API
  // con getUser()+rol (defensa en profundidad), así que una cookie adulterada
  // rebota igual más adentro.
  const {
    data: { session },
  } = await supabase.auth.getSession();
  const user = session?.user ?? null;

  // Sin sesión en una ruta protegida (que no sea un login) -> al login único.
  if (!user) {
    if (esTienda) return redirectTo("/ingresar");
    if (esPanel && !esLoginAdmin) return redirectTo("/ingresar");
    return response;
  }

  const rol = getRol(user);

  // Sesión sin rol (cuenta creada por fuera): se corta y afuera. Se cierra la
  // sesión para que el login no la recicle en loop.
  if (rol == null) {
    if (esLogin) return response; // dejar re-loguear
    await supabase.auth.signOut();
    return redirectTo("/ingresar");
  }

  // Ya logueado y entrando a CUALQUIER login -> a su lugar.
  if (esLogin) {
    return redirectTo(
      rol === "administrador"
        ? "/admin"
        : rol === "moderador"
          ? "/moderador"
          : "/entradas"
    );
  }

  // Cliente: solo la tienda. El panel lo manda a las entradas.
  if (rol === "cliente") {
    if (esPanel) return redirectTo("/entradas");
    return response;
  }

  // Moderador en el panel de administración -> a su módulo, con la excepción
  // de /admin/cuenta (cambiar su propia contraseña).
  if (rol === "moderador" && path.startsWith("/admin") && path !== "/admin/cuenta") {
    return redirectTo("/moderador");
  }

  // Staff en la tienda: permitido (además de su panel).
  return response;
}

export const config = {
  matcher: [
    "/admin/:path*",
    "/moderador/:path*",
    "/entradas/:path*",
    "/cuenta/:path*",
    "/buscar",
    "/ingresar",
  ],
};
