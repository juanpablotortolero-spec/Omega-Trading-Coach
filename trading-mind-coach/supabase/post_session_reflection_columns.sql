-- ============================================================
-- Fase 3 — 6 preguntas nuevas de reflexión post-sesión.
-- Se guardan como texto libre (la opción elegida tal cual), mismo patrón que
-- psychology_rating/risk_respected/setup_compliant ya existentes en la tabla.
-- ============================================================

alter table public.post_session_responses
  add column if not exists decision_making text,
  add column if not exists process_consistency text,
  add column if not exists hardest_moment text,
  add column if not exists mental_energy text,
  add column if not exists next_morning_plan text,
  add column if not exists next_move text;
