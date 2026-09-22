-- Dos cambios de modelo que van juntos porque nacen del mismo envío del
-- carrito:
--
-- 1) UNA OPERACIÓN POR PEDIDO, no por entrada. Hasta ahora un carrito con tres
--    entradas creaba tres operaciones sueltas, sin nada que las vinculara. Las
--    líneas pasan a `operacion_items` y la operación es la cabecera.
--
-- 2) LAS CONSULTAS DEJAN DE SER OPERACIONES. Vivían en `operaciones` con
--    monto 0, mezcladas en la misma lista y contaminando las métricas. Ahora
--    tienen su propia tabla y, cuando se arregla precio, se convierten en una
--    operación real.
--
-- Las columnas viejas de `operaciones` (evento, sector, ticket_id, cantidad)
-- NO se borran todavía: se rellenan como resumen de la operación y se van a
-- retirar en una migración posterior, cuando nada las lea. Cambiarlas ahora
-- rompería el panel, el ticket público, la factura y el CSV de una sola vez.

-- ---------------------------------------------------------------------------
-- Líneas de la operación
-- ---------------------------------------------------------------------------
create table if not exists public.operacion_items (
  id uuid primary key default gen_random_uuid(),
  operacion_id uuid not null references public.operaciones(id) on delete cascade,
  -- Entrada del catálogo, si la línea salió de la tienda.
  ticket_id text,
  evento text not null,
  sector text,
  fecha_evento date,
  cantidad integer not null default 1 check (cantidad > 0),
  -- numeric desde el arranque: la migración de monedas convierte los montos de
  -- la operación a numeric y así las líneas no hay que volver a tocarlas.
  precio_unitario numeric(14,2) not null default 0 check (precio_unitario >= 0),
  created_at timestamptz not null default now()
);

create index if not exists operacion_items_operacion_idx
  on public.operacion_items (operacion_id);

alter table public.operacion_items enable row level security;

comment on table public.operacion_items is
  'Líneas de una operación (una por entrada/sector). El monto de la operación es la suma de cantidad * precio_unitario.';

-- ---------------------------------------------------------------------------
-- Consultas: pedidos sin precio, todavía no son una operación
-- ---------------------------------------------------------------------------
create table if not exists public.consultas (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  -- Agrupa lo que entró en un mismo envío del carrito: si el agente mandó
  -- entradas para reservar Y entradas a consultar, la operación y la consulta
  -- comparten este id y no se pierde el contexto.
  envio_id uuid,
  cliente_id uuid,
  cliente_email text,
  comprador_alias text,
  ticket_id text,
  evento text not null,
  sector text,
  fecha_evento date,
  cantidad integer not null default 1 check (cantidad > 0),
  notas text,
  estado text not null default 'pendiente'
    check (estado in ('pendiente', 'convertida', 'descartada')),
  -- Operación que se creó al cargarle precio. Si esa operación se borra, la
  -- consulta sobrevive como registro del pedido original.
  operacion_id uuid references public.operaciones(id) on delete set null,
  resuelta_por text,
  resuelta_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists consultas_estado_idx on public.consultas (estado, created_at desc);
create index if not exists consultas_cliente_idx on public.consultas (cliente_id);

alter table public.consultas enable row level security;

comment on table public.consultas is
  'Consultas de agentes: entradas pedidas sin precio cerrado. Se convierten en operación con el botón "Cargar operación" del panel.';

-- Mismo trigger de updated_at que el resto de las tablas.
drop trigger if exists consultas_updated_at on public.consultas;
create trigger consultas_updated_at
  before update on public.consultas
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Vínculo del envío en la operación
-- ---------------------------------------------------------------------------
alter table public.operaciones
  add column if not exists envio_id uuid;

create index if not exists operaciones_envio_idx on public.operaciones (envio_id);

-- ---------------------------------------------------------------------------
-- Backfill: cada operación existente pasa a tener su línea
-- ---------------------------------------------------------------------------
insert into public.operacion_items
  (operacion_id, ticket_id, evento, sector, fecha_evento, cantidad, precio_unitario)
select o.id, o.ticket_id, o.evento, o.sector, o.fecha_evento,
       greatest(o.cantidad, 1),
       case when o.cantidad > 0 then round(o.monto::numeric / o.cantidad, 2) else o.monto end
from public.operaciones o
where not exists (select 1 from public.operacion_items i where i.operacion_id = o.id);

-- ---------------------------------------------------------------------------
-- NOTA: el constraint `monto > 0` NO va acá.
-- ---------------------------------------------------------------------------
-- Se intentó agregarlo en esta migración y rompía producción: el código que
-- está desplegado sigue creando consultas con monto 0 desde el carrito, y el
-- check las habría rechazado con un 500 en la cara del agente.
--
-- El constraint va en la migración que acompaña al código que deja de generar
-- ceros (cuando las consultas pasen a su propia tabla). Schema y código tienen
-- que viajar juntos para este cambio.

-- ACTUALIZACIÓN: el constraint ya está aplicado, en 0032, junto con el
-- código que dejó de generar consultas con monto 0.
