-- Mapa de sectores del evento (imagen del portal Passion).
-- El worker la extrae del detalle del evento, la descarga con su sesión y la
-- re-sube al bucket público `mapas` (las imágenes del portal están detrás
-- del login, no se pueden hotlinkear). En `tickets.imagen_url` queda la URL
-- pública del bucket, repetida en cada fila/sector del evento.

alter table public.tickets add column if not exists imagen_url text;

-- El grant de anon es por columna (0013): sumar la nueva columna pública.
grant select (imagen_url) on table public.tickets to anon;

-- Bucket público para servir los mapas (lectura anónima por URL pública;
-- escritura solo service role, que ignora RLS de storage).
insert into storage.buckets (id, name, public)
values ('mapas', 'mapas', true)
on conflict (id) do nothing;
