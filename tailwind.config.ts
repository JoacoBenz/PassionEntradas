import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./lib/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        brand: "#6C5BF2",
        "brand-deep": "#4F41C8",
        ink: "#0C0E16",
        "ink-soft": "#171B2B",
        canvas: "#EFF0F5",
        line: "#E2E4EC",
        muted: "#7B8095",
        body: "#1A1D2B",
        // Colores por estado de la operación
        estado: {
          esperando: "#5F6577", // pizarra
          recibida: "#B07A14", // ámbar
          confirmada: "#0D9377", // verde-teal
          cancelada: "#D14D68", // rosa
        },
      },
      fontFamily: {
        display: ["var(--font-display)", "system-ui", "sans-serif"],
        body: ["var(--font-body)", "system-ui", "sans-serif"],
        mono: ["var(--font-mono)", "ui-monospace", "monospace"],
      },
      boxShadow: {
        card: "0 1px 2px rgba(12,14,22,0.05), 0 6px 24px rgba(12,14,22,0.07)",
        "card-hover":
          "0 2px 4px rgba(12,14,22,0.06), 0 12px 32px rgba(12,14,22,0.12)",
        stub: "0 2px 6px rgba(12,14,22,0.12), 0 24px 48px -12px rgba(12,14,22,0.28)",
      },
    },
  },
  plugins: [],
};

export default config;
