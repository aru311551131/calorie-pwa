create table if not exists public.nutrition_states (
  user_id uuid primary key references auth.users (id) on delete cascade,
  data jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.nutrition_states enable row level security;

grant select, insert, update, delete on public.nutrition_states to authenticated;

drop policy if exists "nutrition_states_select_own" on public.nutrition_states;
create policy "nutrition_states_select_own"
on public.nutrition_states
for select
to authenticated
using (auth.uid() = user_id);

drop policy if exists "nutrition_states_insert_own" on public.nutrition_states;
create policy "nutrition_states_insert_own"
on public.nutrition_states
for insert
to authenticated
with check (auth.uid() = user_id);

drop policy if exists "nutrition_states_update_own" on public.nutrition_states;
create policy "nutrition_states_update_own"
on public.nutrition_states
for update
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "nutrition_states_delete_own" on public.nutrition_states;
create policy "nutrition_states_delete_own"
on public.nutrition_states
for delete
to authenticated
using (auth.uid() = user_id);
