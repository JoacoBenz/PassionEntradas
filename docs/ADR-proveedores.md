# ADR-001 — Cómo se suman proveedores (arquitectura multiproveedor)

- **Estado:** Propuesto (a validar con negocio)
- **Fecha:** 2026-07-01
- **Contexto del proyecto:** TicketMirror — plataforma de reventa de entradas.

---

## Contexto

El sistema debe soportar **múltiples proveedores de inventario**; Passion Events es el
primero, no el único. Cada proveedor externo es **un sitio distinto**: login propio,
HTML/estructura propia, y su forma de marcar disponibilidad y precios. Tratar cada uno
"a mano" dentro del núcleo no escala y acopla todo el sistema a cada sitio.

## Decisión

Adoptar **puertos y adaptadores** (arquitectura hexagonal):

1. Definir **un contrato interno único** (`ProviderAdapter`).
2. Cada proveedor se implementa como **un adaptador** que hace dos cosas: **traer** sus
   datos (como sea) y **normalizarlos** a una ficha común.
3. Del contrato para adentro, **el núcleo es agnóstico**: no sabe ni le importa de qué
   proveedor vino cada entrada.

> Lo distinto de cada página queda **encerrado en su adaptador**; el resto del sistema
> (validación, markup, anti-vaciado, catálogo, panel, reportes) es idéntico para todos.

### El contrato

```ts
type ProviderType = "scrape" | "api" | "feed" | "manual";

interface ProviderAdapter {
  id: string;            // "passion_events"
  name: string;          // "Passion Events"
  type: ProviderType;
  // Trae y normaliza el inventario del proveedor.
  fetchTickets(ctx: ProviderContext): Promise<ScrapeResult>;
}

// Ficha normalizada que TODO adaptador debe entregar:
interface TicketNormalizado {
  providerId: string;
  eventId: string;                 // id del proveedor
  categoriaId: string;             // sector/tipo de entrada
  evento: string;
  competicion: string | null;
  fecha: string | null;            // ISO 8601
  ciudad: string | null;
  categoria: string | null;        // nombre del sector
  precioOrigen: number | null;     // en monedaOrigen
  monedaOrigen: string;            // "EUR", "USD", ...
  stock: number | null;
  estado: "inmediato" | "on_request";
  urlOrigen: string | null;
}

interface ScrapeResult {
  rows: TicketNormalizado[];
  complete: boolean;               // false si el ciclo fue parcial (no marcar ausentes)
}
```

El `id` de cada entrada en la base se arma **con prefijo de proveedor** para que no
choquen entre sí: `<providerId>::<eventId>::<categoriaId>`.

### Qué se escribe una vez (núcleo) vs qué es propio de cada proveedor (adaptador)

| Núcleo compartido (una vez) | Adaptador (por proveedor) |
|---|---|
| Scheduler, reintentos, backoff | Login / API key |
| Validación (zod) | Cómo trae los datos (scraping o API) |
| Markup por reglas (proveedor + categoría) | Cómo parsea su HTML/JSON a `TicketNormalizado` |
| Anti-vaciado (por proveedor) | URLs, selectores, límites de frecuencia |
| Dedup + upsert en la base | Mapeo de su "inmediato/on_request" al nuestro |
| Catálogo, panel admin, reportes | Conversión de su moneda (ver pregunta abierta) |

Sumar un proveedor = **escribir un adaptador nuevo**, sin tocar el núcleo.

### Tres formas de integrar un proveedor (costo y estabilidad)

| Tipo | Cuándo | Esfuerzo aprox. | Estabilidad |
|---|---|---|---|
| **Manual** | Carga a mano desde el panel (ya existe) | 0 (ya hecho) | Total |
| **API / feed** | El proveedor ofrece API, CSV, Sheet | ~0,5–1 día | Alta (no se rompe por rediseños) |
| **Scraping** | No hay API; hay que leer sus páginas | ~2–5 días por sitio | Baja: **requiere mantenimiento** ante cambios de layout |

**Recomendación:** empujar a los proveedores hacia **API/feed** siempre que se pueda.

### Cambios en el modelo de datos

- `tickets.provider_id` (hoy existe `source` = `portal|manual`; se generaliza a
  identificar el proveedor concreto).
- `tickets.id` con prefijo de proveedor (ver arriba).
- Tabla **`providers`**: `id, name, type, enabled, config (jsonb), created_at`.
- Tabla **`markup_rules`**: `(provider_id, categoria) -> percent`, con **default por
  proveedor** y **default global**. La más específica gana.
- **Anti-vaciado por proveedor:** `markAbsentBefore` debe filtrar **también por
  `provider_id`** y correr solo si **ese** proveedor tuvo un sync completo. Un fallo de
  Passion Events **no puede** tocar el inventario de otro proveedor.
- `sync_runs.provider_id` para auditar por proveedor.

### Registro y scheduler

- Un **registro** mapea `provider_id -> adaptador` (los adaptadores son código; se
  despliegan con la app).
- La **config por proveedor** (habilitado, credenciales ref, frecuencia, throttle,
  filtros de categoría, reglas de markup) vive en la base y es administrable.
- El scheduler recorre los proveedores **habilitados** y corre cada uno en **su propia
  cadencia**; los resultados pasan por el **mismo pipeline** (validar → markup → guard →
  upsert), scopeado por proveedor.

## Consecuencias

**A favor**
- Agregar un proveedor = 1 adaptador; el núcleo queda intacto.
- El fallo de un proveedor queda **aislado** (no afecta a los demás).
- Proveedores con API/feed son baratos y estables.
- **El código actual ya tiene esta forma:** `src/portal/` (login + parser + scrape) es,
  de hecho, el **adaptador de Passion Events**, y `scrapeRawTickets` ya devuelve
  `{ rows, complete }`. Migrar es un **refactor incremental**, no un rediseño.

**En contra / costo**
- El scraping sigue siendo **trabajo a medida por sitio** + **mantenimiento continuo**.
- "Multiproveedor sin rediseñar" aplica al **núcleo**, no significa "agregar proveedores
  con un clic". El **marco** va en el plan completo; **cada scraper nuevo se cotiza aparte**
  según el sitio.

## Plan de migración (incremental, sin rediseño)

1. Extraer la interfaz `ProviderAdapter` y envolver el código actual de Passion Events
   como el primer adaptador.
2. Parametrizar `runSyncCycle(adapter, providerConfig)` y el scheduler por proveedor.
3. Agregar `provider_id` + prefijo de id + anti-vaciado scopeado por proveedor.
4. Tabla `markup_rules` (proveedor + categoría) y motor de markup por reglas.
5. Tabla `providers` + config administrable desde el panel.

---

## Preguntas abiertas (decisiones de negocio pendientes)

> Se dejan explícitas en vez de asumir una respuesta. Cada una afecta el diseño.

1. **Taxonomía de categorías para el markup.** El markup es por `(proveedor + categoría)`.
   ¿Las categorías son una **lista común** normalizada (Fútbol, F1, Conciertos, …) o las
   **categorías crudas** de cada proveedor? Si es común, hay que **mapear** las de cada
   proveedor a esa lista.
2. **Moneda de origen por proveedor.** Passion Events cotiza en **EUR**; la plataforma
   opera en **USD**. Si un proveedor cotiza en otra moneda, ¿se **convierte a USD al
   sincronizar**? ¿Con qué **tipo de cambio** y de qué fuente? (Choca con "sin conversión
   de moneda en el MVP": hay que definir el alcance real.)
3. **Inventario duplicado entre proveedores.** Si dos proveedores venden el **mismo
   evento/sector**, ¿se muestran **ambos**, se elige el **más barato**, o se **unifica** en
   una sola fila? ¿Cómo se detecta que son "el mismo"?
4. **Alta/config de proveedor.** ¿El **admin** puede dar de alta y configurar un proveedor
   (URLs, %, frecuencia, credenciales) **desde el panel**, o cada proveedor nuevo es
   siempre un **desarrollo + deploy**? (El adaptador es código; la config puede ser
   administrable — hay que decidir hasta dónde.)
5. **Flujo On Request por proveedor.** ¿El circuito de Solicitudes (mail → confirmación →
   aprobado/alternativa/rechazado) es **igual para todos**, o cada proveedor tiene su
   **canal/tiempos** de confirmación propios?
6. **Definición de "inmediato/on_request" cuando el proveedor no la trae.** Si un
   proveedor **no** distingue ese concepto, ¿cuál es el **default**?
7. **Credenciales por proveedor.** Cada scraping usa **tu cuenta de agente** en ese
   proveedor. ¿Dónde se guardan/rotan esos secretos y **quién** los administra?
8. **Frecuencia y cortesía por proveedor.** Cada sitio tolera distinta frecuencia. ¿Hay
   un **default** y el admin lo ajusta por proveedor?
9. **Habilitación legal por proveedor.** Cada proveedor tiene su **ToS/riesgo** propio.
   ¿Quién **valida** que un proveedor nuevo se puede sincronizar y revender antes de
   sumarlo?
10. **Prioridad en el catálogo.** Cuando hay varios proveedores, ¿hay un **orden de
    preferencia** para mostrarlos (o se ordena solo por precio/fecha)?
