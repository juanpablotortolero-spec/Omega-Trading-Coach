-- Omega Coach: persistencia de briefings pre-sesión (para el calendario
-- histórico + el "contrato de lectura" con notificación en el sidebar).
-- Corré esto vos mismo en el SQL Editor de Supabase.

create table public.omega_briefings (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  briefing_date date not null,
  content text not null,
  acknowledged_at timestamptz,
  created_at timestamptz not null default now(),
  unique (user_id, briefing_date)
);

alter table public.omega_briefings enable row level security;

create policy "select own omega_briefings" on public.omega_briefings
  for select using (auth.uid() = user_id);

-- El contenido lo escribe solo el backend (Service Role) al generarlo — sin
-- policy de insert para 'authenticated'. El "contrato de aceptación" (marcar
-- que lo leí) sí lo hace el propio trader: no tiene XP/recompensa asociada,
-- así que no hay nada que hacer trampa marcándolo.
create policy "acknowledge own omega_briefings" on public.omega_briefings
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
