# Roadmap de desarrollo — Sistema de venta de entradas

> Preparado por **Bexovar** · 2026-07-01 · Documento vivo (se actualiza por fase).
> Objetivo: llevar el sistema de "worker + catálogo" a un **producto completo** (multiproveedor,
> comisión por reglas, roles, pedidos + Dashboard, reportes) **sin rediseñar nada** — todo se apoya
> en la arquitectura actual.

## Cómo leer este roadmap
- **Prioridad (MoSCoW):** 🟥 Must · 🟧 Should · 🟩 Could.
- **Esfuerzo:** días-persona (estimado; ± según definiciones abiertas).
- **DoD** = *Definition of Done* (criterios de aceptación).
- Las casillas `[ ]` sirven para trackear avance.

---

## 0. Principios de diseño (no negociables)

1. **Puertos y adaptadores.** Cada proveedor = un módulo que **normaliza** a la misma ficha (`RawTicketInput`) y **se conecta directo a la base**. El núcleo no sabe de qué proveedor vino.
2. **Anti-vaciado / robustez.** Nunca vaciar el catálogo; conservar el último estado válido ante fallos; todo **scopeado por proveedor**.
3. **Seguridad.** `service_role` solo en el servidor (worker + Edge Functions); el front usa anon + **RLS**; **sin datos de tarjeta**; secretos por env; tokens hasheados.
4. **Sin pasarela de pago.** El sistema **registra estados**, no mueve plata (pago por fuera).
5. **USD · LatAm · WhatsApp · comisión del agente por reglas · entrega por etapas.**

---

## 1. Estado actual (baseline)

| Componente | Estado | Archivos |
|---|---|---|
| Worker Passion Events (login, scraping lista+detalle, anti-vaciado, dry-run, Docker, 33 tests) | ✅ | `src/portal/*`, `src/sync/*`, `src/index.ts` |
| DB `tickets` + `sync_runs` (auditoría) + RLS | ✅ | `db/migrations/0001_init.sql` |
| Carga manual admin (Edge Function + token hasheado, columna `source`) | ✅ | `db/migrations/0002_admin_manual.sql`, `supabase/functions/admin-tickets/` |
| Front catálogo (home, buscador, WhatsApp, moneda de display) | ✅ | `web/` |
| **Multiproveedor real / comisión por reglas / USD en sync** | ❌ | — |
| **Auth de vendedores + roles** | ❌ (solo token admin) | — |
| **Pedidos / On Request / Dashboard** | ❌ (solo propuesta) | — |
| **Reportes / observabilidad / CI** | ❌ | — |

---

## 2. Definiciones a cerrar (bloquean parte del alcance)

| # | Pregunta | Afecta |
|---|---|---|
| D1 | ¿Vendedores: solo Christian e Ignacio o más? ¿cola común o cartera por cliente? | Auth/roles, Dashboard (asignación) |
| D2 | Categorías de la comisión: ¿lista común normalizada o las crudas de cada proveedor? | Motor de comisión, mapeos |
| D3 | Moneda: ¿conversión a USD en el sync y con qué **fuente de cotización**? | Pricing, Fase 1 |
| D4 | Notificaciones: ¿email, WhatsApp, o ambos? ¿qué proveedor de envío? | On Request, avisos |

---

## 3. Mejoras técnicas transversales (aplican a todas las fases)

- [ ] 🟥 **CI** (GitHub Actions): `typecheck` + `test` + `build` en cada push/PR. *(0.5 d)*
- [ ] 🟥 **Disciplina de migraciones**: numeradas, idempotentes, aplicadas por `db:migrate` o Studio; nunca DDL a mano sin migración. *(transversal)*
- [ ] 🟧 **Manejo de secretos**: `.env` fuera de git (ya), token admin y claves como **secretos de la función/host**, rotación documentada. *(0.5 d)*
- [ ] 🟧 **Monitoreo de errores** (Sentry o logs estructurados a un colector) en worker y Edge Functions. *(1 d)*
- [ ] 🟧 **Backups**: verificar retención de Supabase (plan Pro) + export periódico de `tickets`/`pedidos`. *(0.5 d)*
- [ ] 🟩 **Rate-limit** en la Edge Function admin y en futuras funciones públicas. *(0.5 d)*
- [ ] 🟩 **Cobertura de tests**: sumar tests del motor de comisión, del scoping por proveedor y del state-machine de pedidos. *(continuo)*

---

## 4. Roadmap por fases

### Fase 0 — Base sólida, observable y en producción 🟥
*Cierra el MVP actual y lo deja monitoreado. Prereq de todo lo demás.*

**Épica E0.1 — Calidad y despliegue**
- [ ] CI con typecheck + test + build.
- [ ] Aplicar migraciones a Supabase (`0001`, `0002`) y cambiar el **token admin por defecto** (`tm-admin-2026`) por uno real, guardado como secreto.
- [ ] Deploy del worker (Docker en el server Ubuntu; volumen para `storageState`) y del front (Vercel, `web/`).
- [ ] Dominio propio + HTTPS.

**Épica E0.2 — Indicador de frescura (front)** 🟥
- [ ] El front lee `updated_at` y muestra "actualizado hace X"; atenúa/avisa si está *stale* (> N min).
- **DoD:** si el worker se detiene, el usuario lo nota; cumple la promesa de "stock real".

**Épica E0.3 — Observabilidad (usa `sync_runs`, ya existe)** 🟧
- [ ] Panel admin "Salud de sincronización": último ciclo OK, % descartados, ciclos abortados, duración, por proveedor.
- [ ] **Alerta "scraper roto"**: si el % descartado sube o hay N ciclos `aborted`/`error` seguidos → aviso (email/WhatsApp) al equipo.
- **DoD:** el equipo se entera de un problema **antes** que el cliente.

**Esfuerzo Fase 0:** ~4–6 d.

---

### Fase 1 — Multiproveedor + Comisión + USD 🟥
*El corazón del "sistema completo". Habilita sumar proveedores y precios por reglas.*

**Épica E1.1 — Framework de adaptadores**
- [ ] Extraer interfaz `ProviderAdapter { id, nombre, tipo, fetchTickets(ctx) → { rows, complete } }`.
- [ ] Envolver el código actual de Passion Events como el **primer adaptador** (sin cambiar su lógica).
- [ ] **Registro** `provider_id → adaptador`; scheduler recorre proveedores **habilitados**, cada uno en su cadencia.
- [ ] `tickets.id` con **prefijo de proveedor**: `<provider_id>::<event_id>::<seat_cat_id>`.

**Cambios de datos:**
```sql
create table providers (
  id           text primary key,                    -- 'passion_events'
  nombre       text not null,
  tipo         text not null default 'scraping',    -- scraping | manual
  moneda_origen text not null default 'EUR',
  activo       boolean not null default true,
  config       jsonb not null default '{}',         -- urls, throttle, credenciales-ref
  created_at   timestamptz not null default now()
);
alter table tickets    add column if not exists provider_id text references providers(id);
alter table sync_runs  add column if not exists provider_id text;
```

**Épica E1.2 — Anti-vaciado por proveedor** 🟥
- [ ] `markAbsentBefore` filtra **también por `provider_id`** (además de `source='portal'`) y corre solo si **ese** proveedor tuvo sync completo.
- **DoD:** un fallo de Passion Events **no toca** el inventario de otro proveedor. *(test unitario del scoping)*

**Épica E1.3 — Motor de comisión del agente por reglas**
- [ ] Tabla de reglas + resolución "más específica gana".
- [ ] UI admin para editar reglas (proveedor + categoría → %).
```sql
create table reglas_comision (
  id          bigint generated always as identity primary key,
  provider_id text not null,          -- '*' = global
  categoria   text,                   -- null = default del proveedor
  pct         numeric(5,4) not null check (pct >= 0),  -- 0.20 = +20%
  created_at  timestamptz not null default now(),
  unique (provider_id, categoria)
);
-- default global de ejemplo:
insert into reglas_comision (provider_id, categoria, pct) values ('*', null, 0.20);
```
- **DoD:** `precio_final = precio_origen × (1 + pct)` con el `pct` correcto; cambiar una regla se refleja en el próximo sync. *(pruebas de resolución de reglas)*

**Épica E1.4 — Conversión a USD en el sync** *(depende de D3)* 🟧
- [ ] Fuente de cotización (API pública o valor cargado por admin), con caché y fallback.
- [ ] Guardar `precio_final` ya en **USD**; el front deja de convertir (o mantiene USD/ARS solo de referencia).
- **DoD:** todo el catálogo en USD, con la cotización trazable.

**Esfuerzo Fase 1:** ~11–17 d.

---

### Fase 2 — Identidad y accesos (auth + roles) 🟥
*Prerequisito del Dashboard y de las agencias. Reemplaza el token admin único.*

**Épica E2.1 — Auth + perfiles + roles** *(depende de D1)*
- [ ] **Supabase Auth** (email/password o magic link).
- [ ] Tabla `profiles` con rol.
```sql
create table profiles (
  id         uuid primary key references auth.users(id) on delete cascade,
  nombre     text,
  rol        text not null check (rol in ('admin','vendedor','agencia')),
  activo     boolean not null default true,
  created_at timestamptz not null default now()
);
```

**Épica E2.2 — RLS por rol** 🟥
- [ ] `tickets`: SELECT público (ya). Escritura solo service_role (worker) o admin.
- [ ] `pedidos` (Fase 3): el **vendedor** ve los suyos + "Sin asignar"; el **admin** ve todo; escritura por el asignado o admin.
- [ ] `reglas_comision`, `providers`, `profiles`: solo admin.
- **DoD:** un vendedor no puede leer/escribir lo que no le corresponde (pruebas de RLS).

**Épica E2.3 — Migrar el panel admin del token a auth real** 🟧
- [ ] La Edge Function `admin-tickets` y el panel pasan a validar **JWT de Supabase Auth** (rol) en vez del token compartido.
- **DoD:** el token compartido queda deprecado; accesos con usuario/clave y rol.

**Esfuerzo Fase 2:** ~5–8 d.

---

### Fase 3 — Pedidos, On Request y Dashboard accionable 🟥
*El diferencial operativo. Aquí vive el flujo que ya diagramamos.*

**Épica E3.1 — Modelo de pedidos**
```sql
create table pedidos (
  id             uuid primary key default gen_random_uuid(),
  tipo           text not null check (tipo in ('reserva','on_request')),
  ticket_id      text references tickets(id),
  evento         text not null,
  categoria      text,
  cantidad       integer not null check (cantidad > 0),
  precio_unit_usd numeric(12,2),            -- snapshot al crear el pedido
  cliente_nombre  text,
  cliente_contacto text,                    -- WhatsApp/email (PII mínima)
  canal          text,                      -- web | whatsapp | manual
  vendedor_id    uuid references profiles(id),  -- null = "Sin asignar"
  estado         text not null,             -- ver máquina de estados
  hold_expira_at timestamptz,               -- reservas con vencimiento (Fase 6)
  comprobante_url text,
  notas          text,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);
create index on pedidos (estado);
create index on pedidos (vendedor_id);
```
**Máquina de estados:**
- `reserva`: **reservado → vendido → entregado** · (cancelado / expirado)
- `on_request`: **pendiente → aprobado → entregado** · (alternativa / rechazado)

**Épica E3.2 — Crear pedidos desde el catálogo**
- [ ] Botón **Reservar** (inmediata) y **Pedir** (On Request) crean el `pedido` en estado inicial + snapshot de precio.
- [ ] Si es web pública → `canal='web'`; el contacto se pide o se toma del WhatsApp.

**Épica E3.3 — Notificaciones** *(depende de D4)*
- [ ] Al crear/cambiar estado → aviso automático (email y/o WhatsApp) al equipo y/o al cliente.

**Épica E3.4 — Dashboard (cola + asignación)** 🟥
- [ ] Vistas por permiso: **Sin asignar / Míos / Todos**.
- [ ] **Claim/lock**: cuando un vendedor "se lo asigna", queda bloqueado a él (nadie más lo toma) — con control de concurrencia (update condicional `where vendedor_id is null`).
- [ ] **Reasignación** por admin.

**Épica E3.5 — Lifecycle On Request**
- [ ] Acciones: confirmar con proveedor → **Aprobado** (genera invoice/nota) / **Alternativa** / **Rechazado**.

**Épica E3.6 — Entrega**
- [ ] Estado `vendido → entregado`; adjuntar **comprobante** (Fase 6) o marcar entregado.
- **DoD Fase 3:** un pedido nace, se asigna, se resuelve y se entrega, con estados y avisos; dos vendedores no pueden tomar el mismo pedido.

**Esfuerzo Fase 3:** ~14–21 d.

---

### Fase 4 — Reportes, rentabilidad y márgenes 🟧
*Aprovecha que guardamos `precio_origen` y `precio_final` por separado (a propósito).*

**Épica E4.1 — Reportes operativos**
- [ ] Ventas del período, pedidos por estado, por vendedor, tiempo de resolución.

**Épica E4.2 — Rentabilidad**
- [ ] Margen real (`precio_final − precio_origen`) y **comisión del agente** ganada, por evento / proveedor / vendedor.

**Épica E4.3 — Export**
- [ ] Exportar a CSV/Excel.
- **DoD:** el admin ve cuánto se vendió, cuánto se ganó y quién vendió, y lo exporta.

**Esfuerzo Fase 4:** ~4–6 d.

---

### Fase 5 — Crecimiento del canal 🟧
*Que te encuentren y compartan. Independiente de Fase 3/4 (puede ir en paralelo).*

**Épica E5.1 — SEO técnico**
- [ ] `meta description`, **Open Graph / Twitter cards**, favicon, `sitemap`, `theme-color`.
- [ ] **JSON-LD `Event`** por evento (rich results).

**Épica E5.2 — Deep links por evento + prerender**
- [ ] Ruta propia por evento (`/evento/<slug>-<id>`) con su OG → compartir por WhatsApp funciona.
- [ ] Prerender/SSG del catálogo para que Google lo indexe (hoy es SPA vacía para el bot).

**Épica E5.3 — Lista de espera / "avisame"** 🟧
- [ ] En On Request o agotado, el cliente deja su contacto; cuando el sync lo marca `disponible`, se **notifica** y se crea un lead.
```sql
create table waitlist (
  id          uuid primary key default gen_random_uuid(),
  ticket_id   text, evento text,
  contacto    text not null, canal text,        -- whatsapp | email
  created_at  timestamptz not null default now(),
  notified_at timestamptz
);
```

**Épica E5.4 — Captura de demanda**
- [ ] Búsqueda sin resultados → "dejanos el evento" → lead al Dashboard (qué proveedores/eventos sumar).

**Épica E5.5 — Multi-idioma** 🟩
- [ ] ES / EN / PT (LatAm + compradores internacionales).

**Esfuerzo Fase 5:** ~13–20 d.

---

### Fase 6 — Extras de valor 🟩
*Suman mucho y usan data que ya fluye. Cotizables uno por uno.*

**Épica E6.1 — Reserva con hold/vencimiento**
- [ ] La reserva bloquea el pedido por N horas (`hold_expira_at`); un job la libera si no se concreta.
- **DoD:** no se sobre-reserva; el stock se libera solo.

**Épica E6.2 — Historial de precios ("bajó de X")**
```sql
create table price_history (
  id          bigint generated always as identity primary key,
  ticket_id   text not null,
  precio_final numeric(12,2), disponible boolean, stock integer,
  ts          timestamptz not null default now()
);
```
- [ ] Registrar **solo cuando cambia** (no cada ciclo) para no inflar la tabla. Mostrar "bajó de X" en el front.

**Épica E6.3 — Comprobantes de entrega** (Supabase Storage)
- [ ] Adjuntar el e-ticket / comprobante al `pedido`; cierra el estado `entregado`.

**Épica E6.4 — Auditoría de cambios**
```sql
create table audit_log (
  id        bigint generated always as identity primary key,
  actor     uuid, accion text, entidad text, entidad_id text,
  antes jsonb, despues jsonb, ts timestamptz not null default now()
);
```
- [ ] Registrar quién cambió un precio manual / resolvió un pedido.

**Épica E6.5 — CRM ligero de contactos** 🟩
- [ ] Historial de pedidos por cliente (PII mínima, con consentimiento). *(cuidar Ley 25.326 de datos personales.)*

**Esfuerzo Fase 6:** ~12–20 d.

---

## 5. Matriz de mejoras (resumen)

| Mejora | Fase | Prioridad | Esfuerzo (d) |
|---|---|---|---|
| CI + deploy + token real + dominio | 0 | 🟥 | 2–3 |
| Indicador de frescura (front) | 0 | 🟥 | 1 |
| Panel de salud + alerta scraper roto | 0 | 🟧 | 2–4 |
| Framework multiproveedor + anti-vaciado por proveedor | 1 | 🟥 | 6–9 |
| Motor de comisión por reglas + UI | 1 | 🟥 | 3–5 |
| Conversión a USD en sync | 1 | 🟧 | 2–3 |
| Auth + roles + RLS | 2 | 🟥 | 5–8 |
| Pedidos + On Request + **Dashboard** | 3 | 🟥 | 14–21 |
| Reportes + rentabilidad + export | 4 | 🟧 | 4–6 |
| SEO + deep links + prerender | 5 | 🟧 | 6–10 |
| Lista de espera / "avisame" | 5 | 🟧 | 3–5 |
| Captura de demanda | 5 | 🟩 | 2–3 |
| Multi-idioma | 5 | 🟩 | 3–5 |
| Reserva con hold | 6 | 🟩 | 3–5 |
| Historial de precios | 6 | 🟩 | 3–5 |
| Comprobantes de entrega | 6 | 🟩 | 2–3 |
| Auditoría | 6 | 🟩 | 2–3 |
| CRM ligero | 6 | 🟩 | 3–5 |
| **Total aproximado** | | | **≈ 66–106 d** |

*(~3–5 meses de una persona; se comprime con dos en paralelo, sobre todo Fase 5, que es independiente.)*

---

## 6. Métricas de éxito (KPIs)

- **% de catálogo fresco** (tickets con `updated_at` reciente).
- **Tiempo de respuesta a un pedido** (creado → asignado → resuelto).
- **Conversión reserva → vendido → entregado.**
- **Solicitudes On Request** aprobadas vs rechazadas.
- **Margen / comisión** total por período y por vendedor.
- **Uptime del sync** por proveedor (desde `sync_runs`).

---

## 7. Riesgos y mitigaciones

| Riesgo | Mitigación |
|---|---|
| **ToS / bloqueo del proveedor** (scraping) | Multiproveedor reduce dependencia; gestionar acuerdo/feed oficial; si aparece captcha/MFA, el sync **se cae por diseño** (no se evade) |
| **Cambio de layout** del proveedor | Parser aislado por módulo + **alerta de scraper roto** (Fase 0) + anti-vaciado |
| **Datos personales** (contactos de clientes) | PII mínima, consentimiento, RLS, Ley 25.326 |
| **Dependencia de una cotización** (USD) | Fuente con caché + fallback + valor manual del admin |
| **Sobreventa** de reservas | Reserva con hold/vencimiento (Fase 6) + control de concurrencia en el claim |

---

## 8. Secuencia y dependencias

```
Fase 0 (base) ──► Fase 1 (multiproveedor+comisión+USD) ──► Fase 2 (auth/roles) ──► Fase 3 (pedidos+Dashboard) ──► Fase 4 (reportes)
                                                                                     │
Fase 5 (SEO/crecimiento)  ── independiente, puede ir en paralelo desde Fase 0 ───────┘
Fase 6 (extras)          ── depende de Fase 3 (pedidos) para hold/comprobantes; el resto es suelto
```

- **Camino crítico:** 0 → 1 → 2 → 3. Fase 5 corre en paralelo. Fase 6 son add-ons cotizables uno a uno.
- **Regla de entrega (Bexovar):** cada fase se aprueba y se cobra contra su resultado; anticipo chico para arrancar.
