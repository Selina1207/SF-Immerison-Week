-- Duplicate protection: the same document text is analyzed by the AI only once.
--
-- text_hash is a SHA-256 of the analyzed text (lowercased, whitespace collapsed).
-- out_of_scope rows remember documents the AI refused, so re-uploading them is
-- also free. Those rows keep no document text or AI reply.

alter table public.analyses add column if not exists text_hash text;
alter table public.analyses add column if not exists out_of_scope boolean not null default false;

create index if not exists analyses_text_hash_idx on public.analyses (text_hash, created_at desc);
