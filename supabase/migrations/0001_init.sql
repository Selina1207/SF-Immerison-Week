-- Patient Rights Analyzer -- initial schema
--
-- Stores PDF analyses run by patient advocates.
-- Each analysis has the original document name, extracted text,
-- and the flagged clauses returned by the AI.

create extension if not exists "pgcrypto";

-- analyses -- one row per uploaded document
create table public.analyses (
  id            uuid primary key default gen_random_uuid(),
  created_at    timestamptz not null default now(),
  document_name text not null check (length(btrim(document_name)) > 0),
  raw_text      text not null,
  ai_response   text not null
);

-- clauses -- individual rights-waiver clauses extracted from each analysis
create table public.clauses (
  id            uuid primary key default gen_random_uuid(),
  analysis_id   uuid not null references public.analyses (id) on delete cascade,
  created_at    timestamptz not null default now(),
  right_affected text not null,
  clause_text   text,
  plain_english text not null,
  risk_level    text not null check (risk_level in ('high', 'medium', 'low'))
);

-- indexes for common lookups
create index on public.clauses (analysis_id);
create index on public.analyses (created_at desc);
