-- Limpieza del journal de PRUEBA sellado hoy (2026-09-12) durante la
-- verificación en vivo de la eliminación de la IA — borra el journal y todo
-- lo que se derivó de él (eventos de Virtus, misiones básicas, veredicto),
-- más la misión determinista y la nota de meta que se generaron al probar.
-- Ejecutar como el usuario juanpablo.tortolero@gmail.com.

do $$
declare
  v_user_id uuid;
  v_entry_id uuid;
begin
  select id into v_user_id from auth.users where email = 'juanpablo.tortolero@gmail.com';
  select id into v_entry_id from public.journal_entries where user_id = v_user_id and entry_date = '2026-09-12';

  if v_entry_id is not null then
    delete from public.virtus_events where journal_entry_id = v_entry_id;
    delete from public.operations where journal_entry_id = v_entry_id;
    delete from public.core_mission_completions where user_id = v_user_id and entry_date = '2026-09-12';
    delete from public.journal_entries where id = v_entry_id;
  end if;

  -- post_session_responses no tiene entry_date propio — se borra por rango de created_at de hoy.
  delete from public.post_session_responses
    where user_id = v_user_id and created_at >= '2026-09-12T00:00:00Z' and created_at < '2026-09-13T00:00:00Z';

  -- La misión determinista asignada por el negativo de prueba (emotional_state).
  delete from public.ai_missions
    where user_id = v_user_id and title = 'Escribí, antes de operar mañana, qué emoción destructiva predominó hoy y su disparador concreto.';

  -- La nota de diario de prueba agregada a la meta.
  delete from public.goal_notes
    where user_id = v_user_id and note = 'Hoy seguí mi plan y subí la cuenta.';
end $$;
