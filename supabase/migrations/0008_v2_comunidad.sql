-- V2 Comunidad: usuarios registrados publican entradas en un feed y piden
-- comprar; toda transacción la media un administrador (custodia AdminTickets).
--
-- NO aplicada en el proyecto live todavía: va junto con el deploy de la V2.
--
-- Mismo modelo de seguridad que operaciones: RLS deny-all (sin policies),
-- toda lectura/escritura pasa por el servidor con service role.

-- 1) Publicaciones: una entrada que un usuario pone a la venta.
create type publicacion_estado as enum ('activa', 'en_proceso', 'vendida', 'retirada');

create table public.publicaciones (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  vendedor_alias text not null,
  evento text not null,
  descripcion text,
  fecha_evento date,
  precio integer not null default 0 check (precio >= 0),
  cantidad integer not null default 1 check (cantidad between 1 and 10),
  estado publicacion_estado not null default 'activa',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index publicaciones_estado_idx on public.publicaciones (estado, created_at desc);
create index publicaciones_user_idx on public.publicaciones (user_id);

alter table public.publicaciones enable row level security;

drop trigger if exists trg_publicaciones_updated_at on public.publicaciones;
create trigger trg_publicaciones_updated_at
  before update on public.publicaciones
  for each row execute function public.set_updated_at();

-- 2) Solicitudes de compra: "quiero comprarla"; el admin la convierte en
--    una operación de custodia (o la rechaza).
create type solicitud_estado as enum ('pendiente', 'en_proceso', 'concretada', 'rechazada');

create table public.solicitudes (
  id uuid primary key default gen_random_uuid(),
  publicacion_id uuid not null references public.publicaciones (id) on delete cascade,
  comprador_id uuid not null references auth.users (id) on delete cascade,
  comprador_alias text not null,
  mensaje text,
  estado solicitud_estado not null default 'pendiente',
  operacion_id uuid references public.operaciones (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Un usuario tiene UNA solicitud viva por publicación; si se la rechazan
-- puede volver a pedir (las rechazadas/concretadas no bloquean).
create unique index solicitudes_unica_activa_idx
  on public.solicitudes (publicacion_id, comprador_id)
  where estado in ('pendiente', 'en_proceso');

create index solicitudes_estado_idx on public.solicitudes (estado, created_at desc);
create index solicitudes_comprador_idx on public.solicitudes (comprador_id);

alter table public.solicitudes enable row level security;

drop trigger if exists trg_solicitudes_updated_at on public.solicitudes;
create trigger trg_solicitudes_updated_at
  before update on public.solicitudes
  for each row execute function public.set_updated_at();
