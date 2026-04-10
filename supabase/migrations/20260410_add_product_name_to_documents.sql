alter table if exists public.documents
  add column if not exists product_name text;

update public.documents
set product_name = nullif(
  initcap(
    trim(
      regexp_replace(
        regexp_replace(
          regexp_replace(
            coalesce(substring(content from '^\[SOURCE:\s*([^\]]+)\]'), ''),
            '\.[^.]+$',
            '',
            'i'
          ),
          '[_-]+',
          ' ',
          'g'
        ),
        '\s*(user\s*manual|usermanual|manual|instruction\s*manual|instructions?|quick\s*start(\s*guide)?|setup\s*guide)\s*$',
        '',
        'i'
      )
    )
  ),
  ''
)
where coalesce(product_name, '') = ''
  and content ~ '^\[SOURCE:\s*[^\]]+\]';

create index if not exists documents_client_id_product_name_idx
  on public.documents (client_id, product_name);
