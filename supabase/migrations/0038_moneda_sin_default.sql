-- APLICAR DESPUÉS DE DEPLOYAR el código que siempre manda la moneda.
--
-- operaciones.moneda tenía default 'USD': cualquier camino que se olvidara de
-- mandar la moneda creaba una operación en dólares sin avisar (así nació el
-- pedido de Boca en "US$ 1.200.000"). Sin default, una operación sin moneda
-- falla al insertarse en vez de quedar mal. Todos los caminos de alta la
-- mandan explícita: pedidos de la tienda, alta manual del panel y conversión
-- de consultas.
alter table public.operaciones alter column moneda drop default;
