-- La tienda convierte a dólares las entradas propias cargadas en pesos o en
-- euros, y para eso necesita saber en qué moneda está cada una. La tienda lee
-- `tickets` con la clave pública (anon), que tiene grants por columna: sin
-- este grant, agregar `moneda_final` a su consulta la hace fallar entera
-- ("permission denied") y la tienda queda sin entradas.
--
-- Solo es el código de moneda ("USD", "ARS", "EUR"); el precio ya es público.
-- Aditiva e idempotente: aplicarla antes de deployar el código no cambia nada.
grant select (moneda_final) on table public.tickets to anon, authenticated;
