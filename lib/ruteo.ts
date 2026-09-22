// A dónde va cada rol en cada ruta.
//
// Esta decisión vive en el middleware y es la que sostiene los permisos del
// sitio: que un cliente no entre al panel, que una sesión sin rol quede afuera,
// que el staff no aterrice en la página de captación. El middleware no se puede
// testear en el modo demo (ahí se saltea la autenticación entera), así que la
// regla vive acá, pura y con tests, y el middleware solo la aplica.

import type { Rol } from "@/lib/auth";
import { esStaff } from "@/lib/auth";

export type Zona = "landing" | "login" | "tienda" | "panel" | "otra";

export function zonaDe(path: string): Zona {
  if (path === "/") return "landing";
  if (path === "/ingresar" || path === "/admin/login") return "login";
  if (
    path === "/buscar" ||
    path === "/mapa" ||
    path.startsWith("/entradas") ||
    path.startsWith("/cuenta") ||
    path.startsWith("/mis-pedidos")
  ) {
    return "tienda";
  }
  if (path.startsWith("/admin") || path.startsWith("/moderador")) return "panel";
  return "otra";
}

/** Dónde arranca cada rol cuando no pidió una página en particular. */
export function inicioDe(rol: Rol | null): string {
  return rol === "administrador" ? "/admin" : rol === "moderador" ? "/moderador" : "/entradas";
}

export type Decision =
  | { accion: "seguir" }
  | { accion: "redirigir"; a: string }
  /** Sesión que no es de nadie: se cierra y afuera. */
  | { accion: "cerrar-sesion"; a: string };

export function decidirRuteo(
  path: string,
  rol: Rol | null,
  hayUsuario: boolean
): Decision {
  const zona = zonaDe(path);

  // Sin sesión: la tienda y el panel piden login. La landing queda abierta,
  // que es por donde se pide el acceso.
  if (!hayUsuario) {
    if (zona === "tienda" || zona === "panel") return { accion: "redirigir", a: "/ingresar" };
    return { accion: "seguir" };
  }

  // Sesión sin rol (cuenta creada por fuera de la app): no entra a ningún
  // lado. Se cierra para que el login no la recicle en loop.
  if (rol == null) {
    if (zona === "login") return { accion: "seguir" };
    return { accion: "cerrar-sesion", a: "/ingresar" };
  }

  // Ya logueado entrando a cualquier login -> a su lugar.
  if (zona === "login") return { accion: "redirigir", a: inicioDe(rol) };

  // El staff no tiene nada que hacer en la página de captación; el cliente sí
  // la puede ver.
  if (zona === "landing") {
    return esStaff(rol) ? { accion: "redirigir", a: inicioDe(rol) } : { accion: "seguir" };
  }

  // Cliente: solo la tienda.
  if (rol === "cliente") {
    return zona === "panel" ? { accion: "redirigir", a: "/entradas" } : { accion: "seguir" };
  }

  // Moderador: su módulo, no el de administración. La excepción es su propia
  // cuenta (cambiar la contraseña).
  if (rol === "moderador" && path.startsWith("/admin") && path !== "/admin/cuenta") {
    return { accion: "redirigir", a: "/moderador" };
  }

  return { accion: "seguir" };
}
