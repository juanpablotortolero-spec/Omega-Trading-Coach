-- ============================================================
-- Eliminación de la IA de Omega — migración de base de datos.
-- Corré esto una sola vez en el SQL Editor de Supabase.
-- ============================================================

-- 1) El nuevo trigger de "zona de miedo" escucha post_session_responses
--    (antes escuchaba ai_session_verdicts, que ya no existe).
alter publication supabase_realtime add table public.post_session_responses;

-- 2) Diario de progreso por meta — repropone goal_progress_events en vez de
--    borrarla, así se conserva el historial ya guardado.
alter table public.goal_progress_events rename to goal_notes;
alter table public.goal_notes rename column reason to note;
alter table public.goal_notes drop column delta;
alter table public.goal_notes drop column new_pct;

-- 3) Detalle real de la misión completada en el ledger de Virtus (para que
--    "Qué sumó/restó" muestre el título de la misión, no una etiqueta genérica).
alter table public.virtus_events add column if not exists detail text;

-- 4) Tablas que solo escribía la IA y ya no tienen ningún lector — borrado total.
drop table if exists public.omega_audits;
drop table if exists public.virtus_ai_events;
drop table if exists public.psychological_growth_events;
drop table if exists public.ai_session_verdicts;

-- No se tocan: omega_briefings (repropuesta), ai_missions (repropuesta).
