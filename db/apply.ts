/**
 * Aplica las migraciones SQL de db/migrations a la base de Supabase.
 *
 *   SUPABASE_DB_URL="postgres://..." npm run db:migrate
 *
 * El connection string está en Supabase: Settings > Database > Connection string (URI).
 * Alternativa sin este script: pegar el SQL en Supabase Studio > SQL Editor,
 * o `supabase db push` con la CLI.
 */
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { Client } from "pg";

const migrationsDir = fileURLToPath(new URL("./migrations", import.meta.url));

const connectionString = process.env.SUPABASE_DB_URL;
if (!connectionString) {
  console.error("Falta SUPABASE_DB_URL (Settings > Database > Connection string en Supabase).");
  process.exit(1);
}

const files = readdirSync(migrationsDir)
  .filter((f) => f.endsWith(".sql"))
  .sort();

const client = new Client({ connectionString, ssl: { rejectUnauthorized: false } });

await client.connect();
try {
  for (const file of files) {
    const sql = readFileSync(path.join(migrationsDir, file), "utf8");
    console.log(`→ aplicando ${file}`);
    await client.query(sql);
  }
  console.log(`✓ ${files.length} migración(es) aplicada(s).`);
} catch (err) {
  console.error("✗ error aplicando migraciones:", err instanceof Error ? err.message : err);
  process.exitCode = 1;
} finally {
  await client.end();
}
