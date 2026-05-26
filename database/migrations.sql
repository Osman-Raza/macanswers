-- MacAnswers — Supabase Migrations
-- Run this entire file in the Supabase SQL editor.
-- Safe to re-run: uses IF NOT EXISTS / CREATE OR REPLACE where possible.

-- ─────────────────────────────────────────
-- Extensions
-- ─────────────────────────────────────────
create extension if not exists vector;

-- ─────────────────────────────────────────
-- Knowledge Base: scraped content chunks
-- ─────────────────────────────────────────
create table if not exists knowledge_chunks (
  id              uuid primary key default gen_random_uuid(),
  source_url      text not null,
  source_name     text not null,
  content         text not null,
  embedding       vector(768),                 -- gemini-embedding-001 truncated to 768
  scrape_run_id   uuid,                        -- groups all chunks from one scrape run
  scraped_at      timestamptz default now()
);

-- Add scrape_run_id if upgrading an existing install
alter table knowledge_chunks
  add column if not exists scrape_run_id uuid;

-- ivfflat index for cosine similarity
create index if not exists knowledge_chunks_embedding_idx
  on knowledge_chunks using ivfflat (embedding vector_cosine_ops)
  with (lists = 100);

create index if not exists knowledge_chunks_source_url_idx
  on knowledge_chunks (source_url);

-- ─────────────────────────────────────────
-- Campus Issue Tracker
-- ─────────────────────────────────────────
do $$ begin
  create type issue_category as enum (
    'electrical', 'printer', 'accessibility', 'safety',
    'hvac', 'plumbing', 'wifi', 'other'
  );
exception when duplicate_object then null; end $$;

do $$ begin
  create type issue_status as enum ('open', 'in_progress', 'resolved');
exception when duplicate_object then null; end $$;

create table if not exists campus_issues (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid references auth.users(id) on delete set null,
  title        text not null,
  description  text,
  category     issue_category not null,
  status       issue_status default 'open',
  latitude     double precision not null,
  longitude    double precision not null,
  building     text,
  upvotes      integer default 0,
  reported_at  timestamptz default now(),
  resolved_at  timestamptz
);

-- Add user_id if upgrading
alter table campus_issues
  add column if not exists user_id uuid references auth.users(id) on delete set null;

create table if not exists issue_upvotes (
  issue_id    uuid references campus_issues(id) on delete cascade,
  voter_token text not null,
  voted_at    timestamptz default now(),
  primary key (issue_id, voter_token)
);

-- ─────────────────────────────────────────
-- RPC: upvote (idempotent per voter)
-- Fixed: previous version had a `found` check that didn't work with INSERT
-- ON CONFLICT — `found` reflects the last statement, but `on conflict do nothing`
-- still sets found=true. We now check row count of the insert explicitly.
-- ─────────────────────────────────────────
create or replace function increment_upvote(issue_id uuid, voter text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  inserted_count int;
begin
  insert into issue_upvotes (issue_id, voter_token)
  values (issue_id, voter)
  on conflict do nothing;

  get diagnostics inserted_count = row_count;

  if inserted_count > 0 then
    update campus_issues
      set upvotes = upvotes + 1
      where id = issue_id;
  end if;
end;
$$;

-- ─────────────────────────────────────────
-- RPC: vector similarity search
-- ─────────────────────────────────────────
create or replace function match_chunks(
  query_embedding vector(768),
  match_count     int default 5,
  match_threshold float default 0.5
)
returns table (
  id          uuid,
  source_url  text,
  source_name text,
  content     text,
  similarity  float
)
language sql stable as $$
  select
    id, source_url, source_name, content,
    1 - (embedding <=> query_embedding) as similarity
  from knowledge_chunks
  where 1 - (embedding <=> query_embedding) > match_threshold
  order by embedding <=> query_embedding
  limit match_count;
$$;

-- ─────────────────────────────────────────
-- Row Level Security
-- ─────────────────────────────────────────
-- knowledge_chunks: public READ only. Writes only via service_role (backend/scraper).
alter table knowledge_chunks enable row level security;

drop policy if exists "knowledge_chunks_public_read" on knowledge_chunks;
create policy "knowledge_chunks_public_read"
  on knowledge_chunks for select
  to anon, authenticated
  using (true);

-- No insert/update/delete policies → blocked for anon + authenticated.
-- service_role bypasses RLS automatically, so the scraper still works.

-- campus_issues: public READ of non-resolved, authenticated INSERT (must own row),
-- owners can UPDATE/DELETE their own. service_role bypasses for backend writes.
alter table campus_issues enable row level security;

drop policy if exists "campus_issues_public_read" on campus_issues;
create policy "campus_issues_public_read"
  on campus_issues for select
  to anon, authenticated
  using (true);

drop policy if exists "campus_issues_owner_insert" on campus_issues;
create policy "campus_issues_owner_insert"
  on campus_issues for insert
  to authenticated
  with check (
    auth.uid() = user_id
    and (auth.jwt() ->> 'email') like '%@mcmaster.ca'
  );

drop policy if exists "campus_issues_owner_update" on campus_issues;
create policy "campus_issues_owner_update"
  on campus_issues for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "campus_issues_owner_delete" on campus_issues;
create policy "campus_issues_owner_delete"
  on campus_issues for delete
  to authenticated
  using (auth.uid() = user_id);

-- issue_upvotes: no direct table access for anyone. All writes go through the
-- increment_upvote RPC (which runs as security definer).
alter table issue_upvotes enable row level security;
-- No policies = anon + authenticated have zero access. service_role still bypasses.
