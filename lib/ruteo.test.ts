import { describe, expect, it } from "vitest";
import { decidirRuteo, inicioDe, zonaDe } from "./ruteo";

// Estos tests son los permisos del sitio. En el modo demo la autenticación se
// saltea entera, así que es el único lugar donde esto se puede verificar.
const ir = (path: string, rol: any, hay = true) => decidirRuteo(path, rol, hay);

describe("zonaDe", () => {
  it("clasifica cada ruta", () => {
    expect(zonaDe("/")).toBe("landing");
    expect(zonaDe("/ingresar")).toBe("login");
    expect(zonaDe("/admin/login")).toBe("login");
    expect(zonaDe("/entradas")).toBe("tienda");
    expect(zonaDe("/buscar")).toBe("tienda");
    expect(zonaDe("/mapa")).toBe("tienda");
    expect(zonaDe("/mis-pedidos")).toBe("tienda");
    expect(zonaDe("/cuenta")).toBe("tienda");
    expect(zonaDe("/admin")).toBe("panel");
    expect(zonaDe("/admin/entradas")).toBe("panel");
    expect(zonaDe("/moderador")).toBe("panel");
    expect(zonaDe("/op/abc")).toBe("otra");
    expect(zonaDe("/factura/abc")).toBe("otra");
  });
});

describe("sin sesión", () => {
  it("la tienda y el panel piden login", () => {
    expect(ir("/entradas", null, false)).toEqual({ accion: "redirigir", a: "/ingresar" });
    expect(ir("/admin", null, false)).toEqual({ accion: "redirigir", a: "/ingresar" });
    expect(ir("/moderador", null, false)).toEqual({ accion: "redirigir", a: "/ingresar" });
  });

  it("la landing queda abierta: es por donde se pide el acceso", () => {
    expect(ir("/", null, false)).toEqual({ accion: "seguir" });
  });

  it("el seguimiento público y la factura no piden login", () => {
    expect(ir("/op/abc", null, false)).toEqual({ accion: "seguir" });
    expect(ir("/factura/abc", null, false)).toEqual({ accion: "seguir" });
  });
});

describe("sesión sin rol", () => {
  it("no entra a ningún lado y se le cierra la sesión", () => {
    // Una cuenta creada por fuera de la app no es de nadie.
    expect(ir("/entradas", null)).toEqual({ accion: "cerrar-sesion", a: "/ingresar" });
    expect(ir("/admin", null)).toEqual({ accion: "cerrar-sesion", a: "/ingresar" });
    expect(ir("/", null)).toEqual({ accion: "cerrar-sesion", a: "/ingresar" });
  });

  it("pero puede volver a loguearse (si no, queda en loop)", () => {
    expect(ir("/ingresar", null)).toEqual({ accion: "seguir" });
  });
});

describe("cliente", () => {
  it("entra a la tienda", () => {
    expect(ir("/entradas", "cliente")).toEqual({ accion: "seguir" });
    expect(ir("/mis-pedidos", "cliente")).toEqual({ accion: "seguir" });
  });

  it("NO entra al panel", () => {
    expect(ir("/admin", "cliente")).toEqual({ accion: "redirigir", a: "/entradas" });
    expect(ir("/admin/entradas", "cliente")).toEqual({ accion: "redirigir", a: "/entradas" });
    expect(ir("/moderador", "cliente")).toEqual({ accion: "redirigir", a: "/entradas" });
    expect(ir("/admin/cuenta", "cliente")).toEqual({ accion: "redirigir", a: "/entradas" });
  });

  it("sí puede ver la landing", () => {
    expect(ir("/", "cliente")).toEqual({ accion: "seguir" });
  });

  it("desde el login va a la tienda", () => {
    expect(ir("/ingresar", "cliente")).toEqual({ accion: "redirigir", a: "/entradas" });
  });
});

describe("moderador", () => {
  it("entra a su módulo", () => {
    expect(ir("/moderador", "moderador")).toEqual({ accion: "seguir" });
  });

  it("NO entra al panel de administración", () => {
    expect(ir("/admin", "moderador")).toEqual({ accion: "redirigir", a: "/moderador" });
    expect(ir("/admin/entradas", "moderador")).toEqual({ accion: "redirigir", a: "/moderador" });
    expect(ir("/admin/solicitudes", "moderador")).toEqual({ accion: "redirigir", a: "/moderador" });
  });

  it("salvo su propia cuenta, para cambiar la contraseña", () => {
    expect(ir("/admin/cuenta", "moderador")).toEqual({ accion: "seguir" });
  });

  it("puede ver la tienda (carga pedidos desde ahí)", () => {
    expect(ir("/entradas", "moderador")).toEqual({ accion: "seguir" });
  });
});

describe("administrador", () => {
  it("entra a todo el panel", () => {
    expect(ir("/admin", "administrador")).toEqual({ accion: "seguir" });
    expect(ir("/admin/entradas", "administrador")).toEqual({ accion: "seguir" });
    expect(ir("/moderador", "administrador")).toEqual({ accion: "seguir" });
  });

  it("y a la tienda", () => {
    expect(ir("/entradas", "administrador")).toEqual({ accion: "seguir" });
  });
});

describe("el staff no aterriza en la tienda", () => {
  it("entrando por la raíz va derecho a su panel", () => {
    // Era el motivo por el que un admin terminaba en la tienda: entraba por
    // la raíz, que no estaba en el matcher.
    expect(ir("/", "administrador")).toEqual({ accion: "redirigir", a: "/admin" });
    expect(ir("/", "moderador")).toEqual({ accion: "redirigir", a: "/moderador" });
  });

  it("y desde el login también", () => {
    expect(ir("/ingresar", "administrador")).toEqual({ accion: "redirigir", a: "/admin" });
    expect(ir("/admin/login", "moderador")).toEqual({ accion: "redirigir", a: "/moderador" });
  });
});

describe("inicioDe", () => {
  it("cada rol tiene su punto de partida", () => {
    expect(inicioDe("administrador")).toBe("/admin");
    expect(inicioDe("moderador")).toBe("/moderador");
    expect(inicioDe("cliente")).toBe("/entradas");
    expect(inicioDe(null)).toBe("/entradas");
  });
});
