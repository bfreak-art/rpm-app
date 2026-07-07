-- RPM app — run this once in the Supabase SQL editor.
-- One generic entity table; the app handles typing. Last-write-wins sync.

create table if not exists public.entities (
  id uuid primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  kind text not null,
  data jsonb not null,
  updated_at bigint not null,
  deleted boolean not null default false
);

create index if not exists entities_user_updated on public.entities (user_id, updated_at);

alter table public.entities enable row level security;

create policy "own rows: select" on public.entities
  for select using (auth.uid() = user_id);
create policy "own rows: insert" on public.entities
  for insert with check (auth.uid() = user_id);
create policy "own rows: update" on public.entities
  for update using (auth.uid() = user_id);
create policy "own rows: delete" on public.entities
  for delete using (auth.uid() = user_id);
