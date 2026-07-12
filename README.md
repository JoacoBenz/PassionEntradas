# Passion Unified — TicketMirror + AdminTickets

Proyecto unificado que junta los dos sistemas del cliente en una sola app
Next.js con un solo proyecto de Supabase:

1. **Tienda pública (TicketMirror)** — catálogo de entradas con stock y precios
   reales, venta por WhatsApp. Antes vivía en `PassionEntradas/web` (Vite).
2. **CRM de custodia (AdminTickets)** — operaciones de compra-venta con
   intermediario, link público de seguimiento por operación. Antes era el
   repo `CRMTickets`.
3. **Worker de sincronización** (`worker/`) — scrapea el portal de agentes de
   Passion Events, aplica markup y publica en la tabla `tickets`. Corre aparte
   (Docker), apuntando al mismo Supabase.

## Rutas

| Ruta               | Qué es                                             | Acceso        |
| ------------------ | -------------------------------------------------- | ------------- |
| `/`                | Tienda: home con destacados                        | público       |
| `/buscar`          | Tienda: catálogo con filtros                       | público       |
| `/op/[id]`         | Seguimiento público de una operación de custodia   | link directo  |
| `/admin`           | Panel: lista y estados de operaciones              | administrador |
| `/admin/entradas`  | Panel: carga manual de entradas + salud del worker | administrador |
| `/moderador`       | Carga de operaciones nuevas                        | staff logueado|
| `/admin/login`     | Login (Supabase Auth)                              | —             |

Flujo integrado: desde `/admin/entradas`, el botón **“Crear operación”** de una
entrada propia abre `/moderador` con el evento precargado y vincula la
operación al ticket (`operaciones.ticket_id`).

## Base de datos (Supabase)

Migraciones en `supabase/migrations/` (correr en orden en el SQL Editor):

- `0001_init.sql` — tabla `operaciones` + RLS (del CRM).
- `0002_public_read_rpc.sql` — RPC `operacion_publica` para el link público.
- `0003_tickets_catalogo.sql` — tablas `tickets` y `sync_runs` (de
  PassionEntradas), columna `operaciones.ticket_id`, RLS.

> La tabla `admin_auth` del proyecto viejo (token compartido del panel de la
> tienda) **ya no existe**: el panel de entradas usa Supabase Auth con roles
> (`app_metadata.role`: `administrador` | `moderador`), igual que el resto.
> La Edge Function `admin-tickets` también quedó obsoleta (reemplazada por
> `/api/tickets`).

## App web (esta carpeta)

```bash
npm install
cp .env.example .env.local   # completar credenciales
npm run dev
```

Variables (`.env.local`): Supabase URL/anon/service-role, `NEXT_PUBLIC_SITE_URL`
y `NEXT_PUBLIC_WHATSAPP`. Los precios de la tienda se muestran en USD; la
cotización EUR->USD se edita desde el panel (Entradas -> Precios del portal).

Deploy: Vercel (un solo proyecto para tienda + panel).

## Worker (`worker/`)

Sin cambios funcionales respecto del repo original de PassionEntradas: se
configura con su propio `.env` (credenciales del portal, markup, y el
`SUPABASE_URL` / `SUPABASE_SERVICE_ROLE_KEY` **del proyecto unificado**).
Se despliega con Docker (`worker/Dockerfile` + `docker-compose.yml`).

Sus migraciones viejas (`db/`) se eliminaron: el esquema vive en
`supabase/migrations/` de la raíz. Ver `worker/README.md` para los detalles
de scraping, anti-borrado y riesgos de ToS del portal.

## Estilos

La tienda usa su CSS original portado y scopeado bajo `.tienda`
(`app/(tienda)/tienda.css`); el panel usa Tailwind. No se pisan entre sí.
