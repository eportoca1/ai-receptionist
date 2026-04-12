alter table if exists public.documents
  add column if not exists source_filename text;

update public.documents
set source_filename = nullif(trim(substring(content from '^\[SOURCE:\s*([^\]]+)\]')), '')
where coalesce(source_filename, '') = ''
  and content ~ '^\[SOURCE:\s*[^\]]+\]';

create index if not exists documents_client_id_source_filename_idx
  on public.documents (client_id, source_filename);
