import { describe, expect, it } from "vitest";
import { sesionCaida } from "./sesion";

describe("sesionCaida", () => {
  it("sin error, la sesión está bien", () => {
    expect(sesionCaida(null)).toBe(false);
    expect(sesionCaida(undefined)).toBe(false);
  });

  it("reconoce el error exacto que tira un usuario borrado", () => {
    // Tal cual lo devuelve Supabase Auth.
    expect(
      sesionCaida({
        name: "AuthApiError",
        status: 400,
        code: "refresh_token_not_found",
      })
    ).toBe(true);
  });

  it("reconoce el resto de los códigos de sesión muerta", () => {
    for (const code of [
      "refresh_token_already_used",
      "refresh_token_revoked",
      "session_not_found",
      "session_expired",
      "user_not_found",
      "user_banned",
    ]) {
      expect(sesionCaida({ name: "AuthApiError", status: 400, code })).toBe(true);
    }
  });

  it("un 401/403 de Auth sin código también es sesión muerta", () => {
    expect(sesionCaida({ name: "AuthApiError", status: 401 })).toBe(true);
    expect(sesionCaida({ name: "AuthApiError", status: 403 })).toBe(true);
  });

  it("una sesión que no está en la cookie cuenta como caída", () => {
    expect(sesionCaida({ name: "AuthSessionMissingError" })).toBe(true);
  });

  it("NO borra la sesión si el servidor de Auth está caído", () => {
    // Esto es lo importante: un corte de red no puede desloguear a todos.
    expect(
      sesionCaida({ name: "AuthRetryableFetchError", status: 0 })
    ).toBe(false);
    expect(
      sesionCaida({
        name: "AuthRetryableFetchError",
        status: 0,
        code: "refresh_token_not_found",
      })
    ).toBe(false);
  });

  it("NO borra la sesión por un 400 cualquiera ni por un 500", () => {
    expect(sesionCaida({ name: "AuthApiError", status: 400 })).toBe(false);
    expect(sesionCaida({ name: "AuthApiError", status: 500 })).toBe(false);
    expect(sesionCaida({ name: "AuthApiError", status: 429 })).toBe(false);
  });

  it("NO borra la sesión por un error desconocido", () => {
    expect(sesionCaida({ name: "TypeError" })).toBe(false);
    expect(sesionCaida({})).toBe(false);
  });
});
