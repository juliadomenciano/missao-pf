create table if not exists public.mpf_docs (
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name text not null,
  data jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  primary key (user_id, name)
);

alter table public.mpf_docs enable row level security;

drop policy if exists "mpf_docs_select_own" on public.mpf_docs;
drop policy if exists "mpf_docs_insert_own" on public.mpf_docs;
drop policy if exists "mpf_docs_update_own" on public.mpf_docs;
drop policy if exists "mpf_docs_delete_own" on public.mpf_docs;

create policy "mpf_docs_select_own" on public.mpf_docs
  for select to authenticated using (auth.uid() = user_id);
create policy "mpf_docs_insert_own" on public.mpf_docs
  for insert to authenticated with check (auth.uid() = user_id);
create policy "mpf_docs_update_own" on public.mpf_docs
  for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "mpf_docs_delete_own" on public.mpf_docs
  for delete to authenticated using (auth.uid() = user_id);

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'mpf_docs'
  ) then
    alter publication supabase_realtime add table public.mpf_docs;
  end if;
end $$;
