-- Automatically publish a 14-day summary of recently edited/inserted questions.
-- IP addresses are never persisted; only a keyed, per-version digest is stored.
create table if not exists public.quiz_update_notice_seen (
  notice_version text not null check (length(notice_version) between 10 and 64),
  ip_digest text not null check (ip_digest ~ '^[0-9a-f]{64}$'),
  seen_at timestamptz not null default now(),
  primary key (notice_version, ip_digest)
);
create index if not exists idx_quiz_update_notice_seen_at
  on public.quiz_update_notice_seen(seen_at);
alter table public.quiz_update_notice_seen enable row level security;
revoke all on public.quiz_update_notice_seen from public, anon, authenticated;
grant select, insert, delete on public.quiz_update_notice_seen to service_role;

create or replace function public.quiz_recent_bank_updates()
returns jsonb
language sql stable security invoker
set search_path=''
as $$
  with recent as (
    select coalesce(nullif(btrim(q.knowledge_type), ''), '待分類') as bank,
           q.updated_at
      from public.quiz_questions q
     where q.updated_at >= now() - interval '14 days'
  ),
  grouped as (
    select bank, count(*)::integer as changed_count
      from recent group by bank
     order by changed_count desc, bank
     limit 12
  )
  select jsonb_build_object(
    'version', (select to_char(max(updated_at) at time zone 'UTC',
                       'YYYY-MM-DD"T"HH24:MI:SS.US"Z"') from recent),
    'days', 14,
    'banks', (select coalesce(jsonb_agg(
                      jsonb_build_object('name',bank,'changed_count',changed_count)
                      order by changed_count desc,bank
                  ), '[]'::jsonb) from grouped)
  );
$$;
revoke all on function public.quiz_recent_bank_updates() from public,anon,authenticated;
grant execute on function public.quiz_recent_bank_updates() to service_role;

create or replace function public.quiz_claim_update_notice(
  p_version text, p_ip_digest text
) returns boolean
language plpgsql security invoker
set search_path=''
as $$
declare claimed boolean := false;
begin
  if p_version is null or length(p_version) not between 10 and 64
    or p_ip_digest is null or p_ip_digest !~ '^[0-9a-f]{64}$' then
    raise exception 'Invalid announcement key' using errcode='22023';
  end if;
  -- Updates are shown only while recent (14 days), so a 21-day retention
  -- limit is sufficient to suppress repeats for every active notice.
  delete from public.quiz_update_notice_seen
   where seen_at < now() - interval '21 days';
  insert into public.quiz_update_notice_seen(notice_version,ip_digest)
    values(p_version,p_ip_digest)
    on conflict do nothing
    returning true into claimed;
  return coalesce(claimed,false);
end;
$$;
revoke all on function public.quiz_claim_update_notice(text,text) from public,anon,authenticated;
grant execute on function public.quiz_claim_update_notice(text,text) to service_role;
