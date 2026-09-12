-- Estas 3 tablas solo las escribía antes la Edge Function omega-coach con la
-- Service Role Key (que bypassea RLS por completo) — ahora que el propio
-- cliente arma y guarda el briefing/misiones/diario de metas, cada una
-- necesita permiso explícito de INSERT/UPDATE para el dueño de la fila.
-- Confirmado en vivo: las 3 devuelven 42501 (RLS violation) sin esto.

-- 1) Briefing pre-sesión (ahora escrito directo por el cliente, sin Edge Function).
create policy "insert own omega_briefings" on public.omega_briefings
  for insert with check (auth.uid() = user_id);

create policy "update own omega_briefings" on public.omega_briefings
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- 2) Misiones deterministas (reconcileDeterministicMissions asigna/completa/expira).
create policy "insert own ai_missions" on public.ai_missions
  for insert with check (auth.uid() = user_id);

create policy "update own ai_missions" on public.ai_missions
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- 3) Diario de progreso por meta (addGoalNote).
create policy "insert own goal_notes" on public.goal_notes
  for insert with check (auth.uid() = user_id);
