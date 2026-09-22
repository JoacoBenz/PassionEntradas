-- Zona del mapa a la que pertenece cada sector.
--
-- El portal publica una columna "Zone" por sector y evento, y el mapa de
-- sectores ya viene con las zonas pintadas: alcanza con decirle al agente cuál
-- mirar ("Zona Azul", "#E4572E", "verde"). Por eso se guarda el valor crudo,
-- como texto: puede ser un nombre, un color CSS o un hex, y `zonaDelMapa()`
-- (lib/tickets.ts) se encarga de interpretarlo.
--
-- La columna ya está creada en producción; esta migración la deja registrada
-- en el repo para que un entorno nuevo se levante igual. Todo idempotente.
alter table public.tickets
  add column if not exists zona_color text;

comment on column public.tickets.zona_color is
  'Zona del mapa del sector, tal como viene del portal (nombre, color CSS o hex). Se interpreta en la app, no acá.';

-- La tienda es anónima hasta que el cliente entra: sin este grant la columna
-- es ilegible y el select de `tickets` falla entero (no devuelve la fila sin
-- la columna: devuelve error). Mismo patrón que imagen_url en 0016.
grant select (zona_color) on table public.tickets to anon, authenticated;
