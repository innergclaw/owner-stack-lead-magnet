create table if not exists public.owner_stack_leads (
  id uuid primary key default gen_random_uuid(),
  name text,
  email text not null,
  source text not null default 'Owner Stack Website Gate',
  page_url text,
  referrer text,
  user_agent text,
  ip_address text,
  telegram_notified boolean not null default false,
  telegram_message_id bigint,
  telegram_error text,
  raw_payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint owner_stack_leads_email_valid check (email ~* '^[^\s@]+@[^\s@]+\.[^\s@]+$')
);

alter table public.owner_stack_leads enable row level security;

revoke all on table public.owner_stack_leads from anon;
revoke all on table public.owner_stack_leads from authenticated;

create index if not exists owner_stack_leads_created_at_idx on public.owner_stack_leads (created_at desc);
create index if not exists owner_stack_leads_email_idx on public.owner_stack_leads (lower(email));
create index if not exists owner_stack_leads_source_idx on public.owner_stack_leads (source);

comment on table public.owner_stack_leads is 'Leads captured from the GitHub Pages Owner Stack email gate.';
comment on column public.owner_stack_leads.raw_payload is 'Original submitted form payload for debugging and attribution.';
