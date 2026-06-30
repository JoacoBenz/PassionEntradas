# PassionEntradas — worker de sincronización

Worker en **Node.js 20 + TypeScript** que sincroniza periódicamente **stock y precios**
desde el portal de agentes de Passion Events, les aplica un **markup del 20 %** y
publica el resultado en **Supabase (Postgres)** para que tu front (Next.js) muestre
disponibilidad y precios actualizados.

> ⚠️ **Antes de usar esto, leé la sección [Riesgos](#riesgos).** El problema técnico se
> resuelve con buen diseño; el riesgo real es de **Términos de Servicio / cuenta**.
> La vía sólida y duradera es pedirle a Passion Events una **API/feed de agentes**
> (Camino A oficial). Si te la dan, todo esto se vuelve trivial y sin riesgo de suspensión.

---

## Arquitectura

```
[Portal agentes passioneventsonline.eu]
        | login (1 vez) -> sesión persistida (storageState)
        | sync cada SYNC_INTERVAL_MS:
        |   1. ensureSession()  -> re-login si expiró
        |   2. recorrer eventos -> extraer stock + precio (parser aislado)
        |   3. validar (zod)    -> descartar inválidos
        |   4. guard anti-borrado (detección de sync parcial)
        |   5. markup 20% (+ conversión opcional EUR->ARS)
        |   6. upsert por lotes en Supabase
        |   7. marcar ausentes como no disponibles (solo si pasó el guard)
        v
   [Supabase Postgres] <--(SELECT, anon key + RLS)-- [Next.js front]
```

### Estructura

```
src/
  config/      Config validada con zod (.env)
  portal/
    parser.ts  ⭐ ÚNICO punto de acoplamiento con el portal (selectores/endpoint)
    session.ts Login + storageState (Playwright); detecta expiración y captcha
    client.ts  Cliente HTTP (undici) para el endpoint JSON interno (camino A)
    scrape.ts  Orquesta extracción según PE_SCRAPE_MODE
    types.ts   Validación zod del input no confiable del portal
  pricing/     Markup + conversión (función pura, testeada)
  db/          Cliente Supabase + repositorio (upsert / anti-borrado)
  sync/
    partial-guard.ts  Regla anti-borrado (pura, testeada)
    cycle.ts          Un ciclo completo de sync
  health.ts    Servidor /healthz interno
  index.ts     Loop single-flight + manejo de señales (SIGTERM/SIGINT)
db/
  migrations/0001_init.sql   Esquema + RLS
  apply.ts                   Aplica migraciones (pg + SUPABASE_DB_URL)
test/fixtures/               Fixtures de HTML/JSON para los tests del parser
```

---

## ⭐ Adaptar el parser al portal real (paso obligatorio)

Este repo trae el sistema completo y robusto, pero la **forma exacta de los datos del
portal** hay que capturarla vos (no se puede inferir sin la sesión logueada):

1. Logueate en `https://passioneventsonline.eu/` en tu navegador.
2. Abrí **DevTools → pestaña Network** y navegá a un listado de eventos.
3. ¿Ves un request **XHR/fetch** que devuelve **JSON** con eventos/precios/stock?
   - **Sí** → camino A (recomendado, el más estable). Poné `PE_SCRAPE_MODE=api` y
     `PE_API_ENDPOINT=<esa URL>`. Ajustá `parseApiResponse()` en
     [`src/portal/parser.ts`](src/portal/parser.ts) a la forma real del JSON
     y actualizá el fixture [`test/fixtures/portal-api.json`](test/fixtures/portal-api.json).
   - **No** (todo viene en el HTML server-side / render JS) → camino B. Dejá
     `PE_SCRAPE_MODE=playwright`, ajustá los **selectores** y `parseListingHtml()` en
     `src/portal/parser.ts`, `LISTING_PATHS`, y el fixture
     [`test/fixtures/portal-list.html`](test/fixtures/portal-list.html).
4. Confirmá también los **selectores de login** (`PORTAL_SELECTORS`) y el marcador de
   sesión iniciada.
5. `npm test` valida la **mecánica** del parser contra los fixtures. Al cambiar
   selectores/forma, actualizá el fixture correspondiente.

Todo lo específico del portal vive **solo** en `src/portal/parser.ts`: si cambia el
layout, se arregla en un único archivo.

---

## Setup local

Requisitos: Node.js 20+.

```bash
cp .env.example .env      # completá credenciales y claves
npm install
npx playwright install chromium   # solo para correr fuera de Docker

npm run typecheck
npm test                  # tests de pricing, parser y anti-borrado
npm run build
npm start                 # corre el worker (necesita .env válido)
```

### Aplicar la migración a Supabase

Tres opciones:

```bash
# A) Script incluido (pg). Necesita el connection string de Postgres:
SUPABASE_DB_URL="postgres://postgres:...@db.<ref>.supabase.co:5432/postgres" npm run db:migrate

# B) Supabase Studio: pegá db/migrations/0001_init.sql en el SQL Editor.

# C) Supabase CLI:
supabase db push
```

---

## Deploy con Docker (Ubuntu + Portainer + Watchtower)

```bash
# En el server, con el .env presente junto al docker-compose.yml:
docker compose up -d --build
docker compose logs -f worker
```

- El front Next.js **no** se deploya acá.
- `storageState` (cookies de sesión) se persiste en el volumen `pe_state` para
  sobrevivir reinicios.
- Usuario **no-root** (`pwuser`), `no-new-privileges`, logs rotados.
- **Watchtower**: el contenedor está etiquetado para auto-update.
- Healthcheck: Docker ejecuta `dist/healthcheck.js` contra `/healthz` interno.

---

## Variables de entorno

Ver [`.env.example`](.env.example) para la lista completa y comentada.

| Variable | Default | Descripción |
|---|---|---|
| `PE_USER` / `PE_PASS` | — | Credenciales de **tu** cuenta de agente (secreto). |
| `PE_BASE_URL` | `https://passioneventsonline.eu/` | Portal de origen. |
| `PE_SCRAPE_MODE` | `playwright` | `api` (endpoint JSON) o `playwright` (HTML). |
| `PE_API_ENDPOINT` | — | URL del endpoint JSON interno (si `mode=api`). |
| `PRICE_MARKUP` | `0.20` | Markup fijo (+20 %). |
| `CONVERT_TO_ARS` | `false` | Si `true`, convierte EUR→ARS. |
| `EUR_ARS_RATE` | — | Tasa EUR→ARS (obligatoria si conversión `true`). |
| `ARS_ROUND_TO` | `100` | Redondeo ARS (100 = al cien; 1 = entero). |
| `SYNC_INTERVAL_MS` | `45000` | Espera **entre** ciclos (tras terminar cada uno). |
| `SYNC_DROP_ABORT_RATIO` | `0.7` | Aborta si la cantidad cae más que esto vs. último sync. |
| `SUPABASE_URL` | — | URL del proyecto Supabase. |
| `SUPABASE_SERVICE_ROLE_KEY` | — | **service_role** (secreto, solo en el worker). |
| `SUPABASE_DB_URL` | — | Connection string Postgres (solo migraciones). |
| `STATE_DIR` | `/data` | Dónde persistir `storageState`. |
| `HEALTH_PORT` | `8080` | Puerto de `/healthz`. |

---

## Regla de markup

```
precio_final = round( precio_origen * (1 + PRICE_MARKUP) * tasaConversion )
```

- Sin conversión: `tasaConversion = 1`, `moneda_final = 'EUR'`, redondeo a **2 decimales**.
- Con `CONVERT_TO_ARS=true`: `tasaConversion = EUR_ARS_RATE`, `moneda_final = 'ARS'`,
  redondeo al **múltiplo `ARS_ROUND_TO`** (default 100).

Se guardan **siempre** `precio_origen` y `precio_final` por separado (trazabilidad).

---

## Robustez

- **Loop single-flight**: el `while + await` garantiza que dos ciclos nunca se solapen
  aunque el portal tarde. No usa `cron` del SO (no baja de 1 min).
- **Anti-borrado** (crítico): jamás `delete` masivo. Un ítem ausente se marca
  `disponible=false`/`stock=0`, **solo si el sync fue exitoso y completo**. Si el sync
  trae 0 ítems o cae más de `SYNC_DROP_ABORT_RATIO` respecto del último exitoso, se
  **aborta el update** y se preservan los datos viejos.
- **Sesión**: login una vez, `storageState` reusado y persistido en volumen. Re-login
  ante expiración (redirect a login / 401 / 403), con backoff.
- **Captcha/MFA/bloqueo**: si aparece, **no se evade** — se loguea, se alerta y se enfría
  (`BLOCKED_COOLDOWN_MS`). Es señal de que el portal no quiere acceso automatizado.
- **Backoff** exponencial + jitter ante 429/5xx y fallos de login.
- **Validación zod** de todo lo extraído (input no confiable): fuerza numéricos, rechaza
  negativos/no-numéricos; los inválidos se descartan y se cuentan.
- **Shutdown limpio** con SIGTERM/SIGINT (cierra Playwright, flush de logs).
- **/healthz** para el healthcheck de Docker (stale si no hubo sync exitoso reciente).
- **Logging** con pino y **redacción** de credenciales/cookies/keys.

---

## Riesgos

### Legales y de cuenta (los más serios — verificalos vos)

- **ToS del portal**: automatizar login + scraping de `passioneventsonline.eu`
  **casi seguro viola sus términos**, aun con credenciales legítimas. Consecuencia
  realista: **suspensión de tu cuenta de agente**. Revisá los Legal Terms
  (<https://www.passionevents.eu/legal-terms>) y, si dudás, **pedí una integración
  oficial (Camino A)**. Esto **no** se arregla con código.
- **Acceso autorizado**: usá **solo tu propia** cuenta de agente. No compartas ni
  multipliques sesiones.
- **Reventa con markup**: revender como agente con tu margen es normal, pero la reventa
  de entradas está **regulada** en varios países (origen y destino). Cumplí tu contrato
  de agente y la normativa aplicable.
- **Datos de terceros / precios**: estás republicando precios e inventario de Passion
  Events. Confirmá en tu acuerdo que **podés mostrarlos públicamente con markup**.

### Seguridad de la aplicación

- Credenciales del portal y **service_role** de Supabase = **secretos**. Solo en el
  worker, vía `.env` fuera de git, **nunca** en el front ni en `NEXT_PUBLIC_*`. Si se
  filtra la service_role, alguien tiene acceso total a tu DB salteando RLS.
- **RLS** en `tickets`: el front (anon key) solo `SELECT`; `INSERT/UPDATE` solo con
  service_role (que saltea RLS).
- **Validá con zod** todo lo extraído del portal.
- **storageState/cookies** = secreto: volumen con permisos restringidos (`0600`), nunca
  en el repo, nunca en logs.
- Contenedor con usuario **no-root** y `no-new-privileges`.

### Técnicos del scraping

- **Cambio de layout**: rompe el parser → por eso está **aislado** y hay **detección de
  sync parcial** que evita publicar basura o vaciar el catálogo.
- **Expiración de sesión / re-login**: manejado. Si Passion Events agrega **MFA/CAPTCHA**,
  el sync **se cae por diseño** (y debe caerse, no evadirse).
- **Bloqueo por frecuencia**: 30 s es agresivo contra un portal B2B. Si ves 429s, subí
  `SYNC_INTERVAL_MS` (60 000–120 000).
- **Datos stale**: mostrá `updated_at` en el front para que se note si los precios
  quedaron viejos.

> **Resumen honesto:** el verdadero *breach* acá no es técnico sino de **ToS/cuenta**.
> La vía robusta es una **API/feed oficial de agentes** de Passion Events.
