# Passion Unified — TicketMirror + AdminTickets

Proyecto unificado que junta los dos sistemas del cliente en una sola app
Next.js con un solo proyecto de Supabase:

1. **Tienda (TicketMirror)** — catálogo de entradas con stock y precios reales,
   venta por WhatsApp. Ahora es **privada** (requiere cuenta): la cara pública
   es una **landing** en `/` que capta clientes con un formulario de solicitud
   de acceso. Antes vivía en `PassionEntradas/web` (Vite).
2. **CRM de custodia (AdminTickets)** — operaciones de compra-venta con
   intermediario, link público de seguimiento por operación. Antes era el
   repo `CRMTickets`.
3. **Worker de sincronización** (`worker/`) — scrapea el portal de agentes de
   Passion Events, aplica markup y publica en la tabla `tickets`. Corre aparte
   (Docker), apuntando al mismo Supabase.

## Rutas

| Ruta                 | Qué es                                              | Acceso         |
| -------------------- | --------------------------------------------------- | -------------- |
| `/`                  | Landing pública: propuesta + formulario de acceso   | público        |
| `/ingresar`          | Login único (staff y clientes) + reset de clave     | público        |
| `/recuperar`         | Fijar contraseña nueva (link del reset por email)   | link directo   |
| `/entradas`          | Tienda: home con destacados                         | staff/cliente  |
| `/buscar`            | Tienda: catálogo con filtros                        | staff/cliente  |
| `/cuenta`            | Cliente: cambiar contraseña / cerrar sesión         | staff/cliente  |
| `/op/[id]`           | Seguimiento público de una operación de custodia    | link directo   |
| `/admin`             | Panel: lista y estados de operaciones               | administrador  |
| `/admin/entradas`    | Panel: carga manual de entradas + salud del worker  | administrador  |
| `/admin/solicitudes` | Panel: cola de solicitudes de acceso (aprobar/rechazar/revocar) | administrador |
| `/admin/equipo`      | Panel: equipo (alta, rol, desactivar, avisos por WhatsApp) | administrador |
| `/admin/clientes`    | Panel: clientes con sus pedidos (revocar/reactivar)  | admin / moderador |
| `/admin/cuenta`      | Panel: datos y contraseña del staff                 | staff logueado |
| `/moderador`         | Carga de operaciones nuevas                         | staff logueado |
| `/admin/login`       | Alias histórico: redirige a `/ingresar`             | —              |

**Acceso a la tienda:** un visitante llena el formulario de la landing → la
solicitud entra a `/admin/solicitudes` → el administrador la aprueba (crea un
usuario `cliente` en Supabase Auth) y le envía las credenciales (mensaje para
copiar y/o email). El cliente entra por `/ingresar` y ve `/entradas` y
`/buscar`. El acceso se puede revocar/reactivar desde el historial.

Flujo integrado: desde `/admin/entradas`, el botón **“Crear operación”** de una
entrada propia abre `/moderador` con el evento precargado y vincula la
operación al ticket (`operaciones.ticket_id`).

## Base de datos (Supabase)

Migraciones en `supabase/migrations/` (correr en orden en el SQL Editor):

- `0001_init.sql` — tabla `operaciones` + RLS (del CRM).
- `0002_public_read_rpc.sql` — RPC `operacion_publica` para el link público.
- `0003_tickets_catalogo.sql` — tablas `tickets` y `sync_runs` (de
  PassionEntradas), columna `operaciones.ticket_id`, RLS.
- … (`0004`–`0043`: ver cada archivo)
- `0044_equipo_cambios.sql` — historial de cambios del equipo (pantalla
  Equipo).
- `0045_notificaciones.sql` — tabla `notificaciones` (campanas del panel y de
  la tienda, con el estado de cada email/WhatsApp) e `idioma` en
  `operaciones` y `consultas` (idioma de los emails al cliente).

Las dos últimas se pueden aplicar antes o después del deploy: sin ellas la app
anda igual, salvo que las campanas quedan vacías (los WhatsApp salen como
antes) y Equipo aplica los cambios sin guardarlos en su historial.

> La tabla `admin_auth` del proyecto viejo (token compartido del panel de la
> tienda) **ya no existe**: todo usa Supabase Auth con roles en
> `app_metadata.role` (no editable por el usuario):
>
> - `administrador` / `moderador` — staff del panel.
> - `cliente` — visitante aprobado desde la landing; **solo** ve la tienda.
> - sin rol ⇒ sin acceso a nada.
>
> Los clientes se crean al aprobar una solicitud en `/admin/solicitudes`. La
> tabla `solicitudes_acceso` (migraciones `0021`–`0023`, RLS deny-all) guarda
> las solicitudes y su auditoría. La Edge Function `admin-tickets` también
> quedó obsoleta (reemplazada por `/api/tickets`).

## App web (esta carpeta)

```bash
npm install
cp .env.example .env.local   # completar credenciales
npm run dev
```

Variables (`.env.local`): Supabase URL/anon/service-role, `NEXT_PUBLIC_SITE_URL`
y `NEXT_PUBLIC_WHATSAPP`; las de avisos (WhatsApp y email) son opcionales,
ver `.env.example`. Los precios de la tienda se muestran en USD; la
cotización EUR->USD se edita desde el panel (Entradas -> Precios del portal).

Deploy: Vercel (un solo proyecto para tienda + panel).

### Avisos (campana, WhatsApp, email)

- **Al equipo** — pedido o consulta nueva, cotización aceptada, cancelación
  del cliente, solicitud de acceso, y recordatorios de lo que lleva rato
  esperando (pedido sin confirmar 2 h, consulta sin cotizar 4 h, cotización
  por vencer, evento en 48 h sin entregar). Quedan en la campana del panel
  (una fila por persona) y salen por WhatsApp a quien lo activó en
  **Equipo**; mientras nadie lo activó, a la lista fija `WHATSAPP_VENDEDORES`.
  Si la operación tiene un vendedor que nombra a alguien del equipo (nombre,
  nombre de pila o email), el aviso es solo para esa persona. La campana
  muestra si cada WhatsApp salió y, si no, por qué.
- **Al cliente** — Confirmado, Para pagar y Entregada: en su campana de la
  tienda y por email (con `RESEND_API_KEY` y `EMAIL_FROM`), en el idioma en
  que hizo el pedido. La tarjeta del pedido en el panel muestra qué se le
  avisó y si el email salió.
- Los recordatorios los dispara el worker (`POST /api/recordatorios` en cada
  vuelta del loop).

Para ponerlo en marcha: aplicar `0044` y `0045`; redeployar el worker
(`git pull && docker compose up -d --build`); crear en WhatsApp Manager la
plantilla `aviso_operacion` (Utility, variables `{{aviso}}` y `{{detalle}}`)
y, cuando esté aprobada, setear `WHATSAPP_TEMPLATE_AVISO`. Ver
`.env.example`.

## Worker (`worker/`)

El scraping es el del repo original de PassionEntradas. Además, en cada
vuelta del loop le pide a la app los recordatorios al equipo
(`TIENDA_URL/api/recordatorios`). Se configura con su propio `.env`
(credenciales del portal, markup, `TIENDA_URL`, y el `SUPABASE_URL` /
`SUPABASE_SERVICE_ROLE_KEY` **del proyecto unificado**). Se despliega con
Docker (`worker/Dockerfile` + `docker-compose.yml`).

Sus migraciones viejas (`db/`) se eliminaron: el esquema vive en
`supabase/migrations/` de la raíz. Ver `worker/README.md` para los detalles
de scraping, anti-borrado y riesgos de ToS del portal.

## Estilos

La tienda (landing, `/entradas`, `/buscar`, `/ingresar`, `/recuperar`,
`/cuenta`) usa su CSS original portado y scopeado bajo `.tienda`
(`app/(tienda)/tienda.css`); el panel usa Tailwind. No se pisan entre sí. Como
son dos hojas de estilo distintas, las transiciones que cruzan tienda ↔ panel
(login, logout, “Ver tienda”) hacen una **carga completa** (`window.location` /
`<a>`) en vez de soft-nav, para que cada lado traiga su CSS.
