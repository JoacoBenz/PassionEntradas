-- =============================================================================
-- Unificación con PassionEntradas (TickerMirror): catálogo de entradas.
-- Trae `tickets` (catálogo publicado por el worker + carga manual) y
-- `sync_runs` (auditoría del worker) al mismo proyecto Supabase del CRM.
--
-- Reemplaza a las migraciones 0001/0002 del repo viejo de PassionEntradas.
-- La tabla `admin_auth` (token compartido del panel viejo) NO se migra:
-- el panel de entradas ahora usa Supabase Auth del CRM.
-- Idempotente: se puede correr varias veces.
-- =============================================================================

create table if not exists tickets (
  id              text primary key,                 -- <event_id>::<seat_cat_id> | manual::<uuid>
  evento          text not null,
  competicion     text,
  fecha           timestamptz,
  ciudad          text,
  categoria       text,                             -- sector (null para on_request)
  precio_origen   numeric(12,2) check (precio_origen is null or precio_origen >= 0),
  moneda_origen   text not null default 'EUR',
  precio_final    numeric(12,2) check (precio_final is null or precio_final >= 0),
  moneda_final    text,
  stock           integer check (stock is null or stock >= 0),
  disponible      boolean not null default true,
  estado          text not null default 'book' check (estado in ('book', 'on_request')),
  url_origen      text,
  source          text not null default 'portal' check (source in ('portal', 'manual')),
  scraped_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index if not exists idx_tickets_disponible  on tickets (disponible);
create index if not exists idx_tickets_estado      on tickets (estado);
create index if not exists idx_tickets_competicion on tickets (competicion);
create index if not exists idx_tickets_fecha       on tickets (fecha);
create index if not exists idx_tickets_updated_at  on tickets (updated_at);
create index if not exists idx_tickets_source      on tickets (source);

-- updated_at automático (misma función que usa `operaciones` si ya existe;
-- se redefine de forma idempotente).
create or replace function set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_tickets_updated_at on tickets;
create trigger trg_tickets_updated_at
  before update on tickets
  for each row execute function set_updated_at();

-- ---- Auditoría de sync (worker) ---------------------------------------------
create table if not exists sync_runs (
  id                 bigint generated always as identity primary key,
  status             text not null,                 -- ok | aborted | error
  reason             text,
  scraped_raw        integer,
  scraped_valid      integer,
  discarded          integer,
  baseline_count     integer,
  upserted           integer,
  marked_unavailable integer,
  complete           boolean,
  duration_ms        integer,
  created_at         timestamptz not null default now()
);

create index if not exists idx_sync_runs_ok on sync_runs (status, created_at desc);

-- ---- Vínculo catálogo -> operación de custodia -------------------------------
-- Una operación puede originarse en una entrada del catálogo.
alter table operaciones add column if not exists ticket_id text
  references tickets (id) on delete set null;
create index if not exists idx_operaciones_ticket on operaciones (ticket_id);

-- =============================================================================
-- RLS
-- - Front público (anon): SOLO SELECT sobre `tickets`.
-- - `sync_runs`: lectura para usuarios logueados (panel admin); escritura solo
--   del worker vía service_role (saltea RLS).
-- - Escrituras de `tickets`: worker y API del panel usan service_role.
-- =============================================================================
alter table tickets   enable row level security;
alter table sync_runs enable row level security;

drop policy if exists tickets_select_public on tickets;
create policy tickets_select_public
  on tickets
  for select
  to anon, authenticated
  using (true);

drop policy if exists sync_runs_select_staff on sync_runs;
create policy sync_runs_select_staff
  on sync_runs
  for select
  to authenticated
  using (true);
