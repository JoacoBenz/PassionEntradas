import { describe, expect, it } from "vitest";
import { fechaDia, fechaHora, horaAr } from "./fechas";

// El punto de estos tests no es el formato lindo: es que el resultado NO
// dependa de la zona horaria del proceso. Si dependiera, el servidor y el
// navegador escribirían textos distintos y React descartaría el HTML del
// servidor (errores de hidratación).
describe("fechas con zona explícita", () => {
  const iso = "2026-09-22T02:30:00Z"; // 23:30 del 21 en Argentina (UTC-3)

  it("un timestamp UTC se muestra en hora argentina", () => {
    expect(fechaHora(iso)).toContain("21");
    expect(fechaHora(iso)).toContain("23:30");
  });

  it("el día también corre a la fecha argentina", () => {
    expect(fechaDia(iso)).toContain("21");
    expect(fechaDia(iso)).toContain("sept");
  });

  it("la hora sola", () => {
    expect(horaAr(iso)).toBe("23:30");
  });

  it("el resultado no cambia si cambia la zona del proceso", () => {
    const original = process.env.TZ;
    const enCada = (tz: string) => {
      process.env.TZ = tz;
      return [fechaHora(iso), fechaDia(iso), horaAr(iso)].join("|");
    };
    const utc = enCada("UTC");
    const tokio = enCada("Asia/Tokyo");
    const ny = enCada("America/New_York");
    process.env.TZ = original;
    expect(tokio).toBe(utc);
    expect(ny).toBe(utc);
  });

  it("sin fecha, o con una ilegible, devuelve un guión y no rompe", () => {
    expect(fechaHora(null)).toBe("—");
    expect(fechaDia(undefined)).toBe("—");
    expect(horaAr("no es una fecha")).toBe("—");
  });

  it("acepta otro locale", () => {
    expect(fechaDia(iso, "en-US")).toContain("Sep");
  });
});
