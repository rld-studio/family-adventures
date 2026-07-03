-- Run this once in your Supabase project: Dashboard -> SQL Editor -> New query -> paste -> Run.

create table if not exists public.cards (
  id text primary key,
  data jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- This board has no login, so we let the public (anon) key read and write.
-- Fine for a private family board; see the README's security note before going wider.
alter table public.cards enable row level security;

drop policy if exists "family board anon access" on public.cards;
create policy "family board anon access"
  on public.cards for all
  to anon
  using (true)
  with check (true);

-- Optional: instant updates instead of the app's few-second refresh.
-- alter publication supabase_realtime add table public.cards;
