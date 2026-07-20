-- La landing ahora pide también la dirección (obligatoria, junto con nombre,
-- email y teléfono). Se agrega la columna; queda nullable para no romper las
-- filas históricas, la obligatoriedad se valida en la API/landing.

alter table public.solicitudes_acceso
  add column if not exists direccion text;
