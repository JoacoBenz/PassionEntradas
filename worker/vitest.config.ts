import { defineConfig } from "vitest/config";

export default defineConfig({
  // El worker no tiene CSS, pero Vite busca un postcss.config hacia arriba y
  // encuentra el de la app Next, que pide tailwindcss. En local no se nota
  // (está el node_modules de la raíz); en CI el job del worker instala solo
  // SUS dependencias y los tests se caían con "Cannot find module 'tailwindcss'".
  // Un config inline corta la búsqueda: acá no hay CSS que procesar.
  css: { postcss: { plugins: [] } },
  test: {
    include: ["src/**/*.test.ts"],
    environment: "node",
    clearMocks: true,
  },
});
