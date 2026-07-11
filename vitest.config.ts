import { defineConfig } from "vitest/config";

// Tests del front (lib/). El worker tiene su propio package.json y tooling
// en worker/ — se excluye para no requerir sus dependencias acá.
export default defineConfig({
  test: {
    include: ["lib/**/*.test.ts"],
    exclude: ["worker/**", "node_modules/**"],
  },
});
