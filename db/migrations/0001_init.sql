-- =============================================================================
-- PassionEntradas — migración inicial
-- Tabla `tickets` (catálogo publicado) + `sync_runs` (auditoría) + RLS.
-- Adaptada al portal real (Passion Events Booking System):
--   - estado 'book' (con precio, comprable) | 'on_request' (sin precio, contacto)
--   - precio_origen/precio_final NULLABLE (null para on_request)
-- Idempotente: se puede correr varias veces.
-- =============================================================================

create table if not exists tickets (
  id              text primary key,                 -- id estable: <event_id>::<seat_cat_id> | <event_id>::REQ
  evento          text not null,
  competicion     text,                             -- "Sub Category" del portal
  fecha           timestamptz,
  ciudad          text,                             -- venue / location
  categoria       text,                             -- sector (null para on_request)
  precio_origen   numeric(12,2) check (precio_origen is null or precio_origen >= 0), -- EUR del portal
  moneda_origen   text not null default 'EUR',
  precio_final    numeric(12,2) check (precio_final is null or precio_final >= 0),   -- con markup (y conversión)
  moneda_final    text,                             -- 'EUR' | 'ARS' | null (on_request)
  stock           integer check (stock is null or stock >= 0),
  disponible      boolean not null default true,
  estado          text not null default 'book' check (estado in ('book', 'on_request')),
  url_origen      text,
  scraped_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

-- ---- Índices de lectura (front) --------------------------------------------
create index if not exists idx_tickets_disponible  on tickets (disponible);
create index if not exists idx_tickets_estado       on tickets (estado);
create index if not exists idx_tickets_competicion on tickets (competicion);
create index if not exists idx_tickets_fecha        on tickets (fecha);
create index if not exists idx_tickets_updated_at   on tickets (updated_at);

-- ---- updated_at automático --------------------------------------------------
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

-- ---- Auditoría de sync ------------------------------------------------------
create table if not exists sync_runs (
  id                 bigint generated always as identity primary key,
  status             text not null,                 -- ok | aborted | error
  reason             text,
  scraped_raw        integer,
  scraped_valid      integer,
  discarded          integer,
  baseline_count     integer,                       -- ítems válidos del último sync exitoso
  upserted           integer,
  marked_unavailable integer,
  complete           boolean,
  duration_ms        integer,
  created_at         timestamptz not null default now()
);

create index if not exists idx_sync_runs_ok on sync_runs (status, created_at desc);

-- =============================================================================
-- RLS
-- - Front (anon key): SOLO SELECT sobre `tickets`.
-- - Worker (service_role): SALTEA RLS (insert/update). No requiere policy de
--   escritura: service_role la evita.
-- - `sync_runs` sin policies => solo service_role la lee/escribe.
-- =============================================================================
alter table tickets   enable row level security;
alter table sync_runs enable row level security;

drop policy if exists tickets_select_public on tickets;
create policy tickets_select_public
  on tickets
  for select
  to anon, authenticated
  using (true);
