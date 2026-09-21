-- VERIX Supabase database setup
-- Run this entire file once in Supabase SQL Editor.
-- Requires the standard Supabase auth.users table.

create extension if not exists vector;
create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, full_name)
  values (new.id, coalesce(new.raw_user_meta_data ->> 'full_name', ''))
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute procedure public.handle_new_user();

create table if not exists public.documents (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  kind text not null,
  s3_key text,
  source_text text not null,
  protected_text text,
  word_count integer not null default 0,
  is_demo boolean not null default false,
  analysis jsonb,
  sensitive_items jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.document_chunks (
  id uuid primary key default gen_random_uuid(),
  document_id uuid not null references public.documents(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  chunk_index integer not null,
  content text not null,
  embedding vector(1024) not null,
  created_at timestamptz not null default now(),
  unique(document_id, chunk_index)
);
create index if not exists document_chunks_document_idx on public.document_chunks(document_id);
create index if not exists document_chunks_user_idx on public.document_chunks(user_id);
create index if not exists document_chunks_embedding_idx on public.document_chunks using hnsw (embedding vector_cosine_ops);

create table if not exists public.transformations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  document_id uuid not null references public.documents(id) on delete cascade,
  config jsonb not null default '{}'::jsonb,
  sensitive_count integer not null default 0,
  created_at timestamptz not null default now()
);
create index if not exists transformations_user_idx on public.transformations(user_id, created_at desc);

create table if not exists public.outputs (
  id uuid primary key default gen_random_uuid(),
  transformation_id uuid not null references public.transformations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  run_id uuid,
  output_type text not null,
  format text not null,
  data jsonb,
  content text not null,
  format_checks jsonb not null default '[]'::jsonb,
  status text not null default 'Draft',
  verification jsonb not null default '[]'::jsonb,
  versions jsonb not null default '[]'::jsonb,
  active_version integer not null default 1,
  created_at timestamptz not null default now()
);
create index if not exists outputs_user_idx on public.outputs(user_id, created_at desc);
create index if not exists outputs_transformation_idx on public.outputs(transformation_id);

create table if not exists public.audit_logs (
  id bigint generated always as identity primary key,
  user_id uuid references auth.users(id) on delete set null,
  action text not null,
  resource_type text,
  resource_id uuid,
  run_id uuid,
  status text not null default 'success',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists audit_logs_user_created_idx on public.audit_logs(user_id, created_at desc);
create index if not exists audit_logs_run_idx on public.audit_logs(run_id, created_at);

create or replace function public.match_document_chunks(
  query_embedding vector(1024),
  match_document_id uuid,
  match_user_id uuid,
  match_count int default 5
)
returns table(id uuid, content text, similarity float)
language sql stable security definer set search_path = public as $$
  select c.id, c.content, 1 - (c.embedding <=> query_embedding) as similarity
  from public.document_chunks c
  where c.document_id = match_document_id
    and c.user_id = match_user_id
  order by c.embedding <=> query_embedding
  limit greatest(1, least(match_count, 20));
$$;

-- match_document_chunks is SECURITY DEFINER and reachable via PostgREST RPC.
-- Without an explicit revoke, Postgres grants EXECUTE on new functions to
-- PUBLIC by default, which would let any anon/authenticated API caller pass
-- an arbitrary match_user_id and read another user's document chunks. Only
-- the FastAPI service role (which enforces the real ownership check) may
-- call it.
revoke execute on function public.match_document_chunks(vector, uuid, uuid, int) from public;
revoke execute on function public.match_document_chunks(vector, uuid, uuid, int) from anon;
revoke execute on function public.match_document_chunks(vector, uuid, uuid, int) from authenticated;
grant execute on function public.match_document_chunks(vector, uuid, uuid, int) to service_role;

-- RLS is enabled for defense in depth. The FastAPI service role bypasses these policies.
alter table public.profiles enable row level security;
alter table public.documents enable row level security;
alter table public.document_chunks enable row level security;
alter table public.transformations enable row level security;
alter table public.outputs enable row level security;
alter table public.audit_logs enable row level security;

drop policy if exists profiles_self on public.profiles;
create policy profiles_self on public.profiles for all using (auth.uid() = id) with check (auth.uid() = id);

drop policy if exists documents_self on public.documents;
create policy documents_self on public.documents for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists chunks_self on public.document_chunks;
create policy chunks_self on public.document_chunks for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists transformations_self on public.transformations;
create policy transformations_self on public.transformations for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists outputs_self on public.outputs;
create policy outputs_self on public.outputs for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists audit_self_read on public.audit_logs;
create policy audit_self_read on public.audit_logs for select using (auth.uid() = user_id);

comment on table public.audit_logs is 'VERIX security and workflow audit trail. Never store source text, prompts, secrets or raw PII here.';
