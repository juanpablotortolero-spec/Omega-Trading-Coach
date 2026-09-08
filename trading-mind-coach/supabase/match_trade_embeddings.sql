-- ============================================================
-- RPC de búsqueda vectorial para el "Patrones históricos" de Omega.
-- omega-coach ya la llama (fetchHistoricalPatterns, index.ts) — correr esto
-- una sola vez en el SQL Editor de Supabase para que exista.
-- ============================================================

create or replace function public.match_trade_embeddings(
  p_user_id uuid,
  p_query_embedding vector(384),
  p_before_date date,
  p_match_count int default 3
)
returns table (
  operation_id uuid,
  lesson text,
  entry_date date,
  model text,
  symbol text,
  similarity float
)
language sql
stable
as $$
  select
    te.operation_id,
    o.lesson,
    o.created_at::date as entry_date,
    o.model,
    o.symbol,
    1 - (te.embedding <=> p_query_embedding) as similarity
  from public.trade_embeddings te
  join public.operations o on o.id = te.operation_id
  where te.user_id = p_user_id
    and o.created_at::date < p_before_date
    and o.lesson is not null
    and length(trim(o.lesson)) > 0
  order by te.embedding <=> p_query_embedding
  limit greatest(p_match_count, 0);
$$;

-- Seguridad: esta función recibe p_user_id como parámetro CRUDO, sin chequear
-- auth.uid() — si quedara ejecutable por anon/authenticated, cualquier
-- trader logueado podría pedir las lecciones de OTRO usuario pasándole su id.
-- Solo omega-coach la llama, con la service role key — se revoca todo lo
-- demás explícitamente.
revoke all on function public.match_trade_embeddings(uuid, vector, date, int) from public;
revoke all on function public.match_trade_embeddings(uuid, vector, date, int) from anon, authenticated;
grant execute on function public.match_trade_embeddings(uuid, vector, date, int) to service_role;
