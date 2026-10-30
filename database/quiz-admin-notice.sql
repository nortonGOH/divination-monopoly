-- Administrator-managed notice text, draft and publication are separate.
-- The public can only see published text through the existing IP-deduplicating Edge Function.
create table if not exists public.quiz_update_editor_notice (
  id smallint primary key default 1 check (id=1),
  draft_title text not null default '' check (char_length(draft_title)<=80),
  draft_body text not null default '' check (char_length(draft_body)<=4000),
  draft_show_banks boolean not null default true,
  published_title text not null default '' check (char_length(published_title)<=80),
  published_body text not null default '' check (char_length(published_body)<=4000),
  published_show_banks boolean not null default true,
  is_published boolean not null default false,
  edit_revision bigint not null default 0,
  publication_revision bigint not null default 0,
  updated_at timestamptz not null default now(),
  published_at timestamptz,
  updated_by uuid
);
insert into public.quiz_update_editor_notice(id) values(1) on conflict do nothing;
alter table public.quiz_update_editor_notice enable row level security;
revoke all on public.quiz_update_editor_notice from PUBLIC, anon, authenticated;
grant select,insert,update on public.quiz_update_editor_notice to service_role;

create or replace function public.quiz_admin_notice_get()
returns jsonb
language plpgsql security definer
set search_path=''
as $$
declare v_user uuid := auth.uid(); r public.quiz_update_editor_notice%rowtype;
begin
  if v_user is null or coalesce(auth.jwt()->>'is_anonymous','false')='true'
     or not exists(select 1 from public.quiz_admins where user_id=v_user) then
    raise exception 'Administrator required' using errcode='42501';
  end if;
  select * into r from public.quiz_update_editor_notice where id=1;
  if not found then raise exception 'Notice configuration missing'; end if;
  return jsonb_build_object(
    'title',r.draft_title,'body',r.draft_body,'show_banks',r.draft_show_banks,
    'published',r.is_published,'revision',r.edit_revision,
    'publication_revision',r.publication_revision,
    'published_title',r.published_title,'published_body',r.published_body,
    'updated_at',r.updated_at,'published_at',r.published_at
  );
end;
$$;

create or replace function public.quiz_admin_notice_save(
  p_action text,p_title text,p_body text,p_show_banks boolean,p_expected_revision bigint
)
returns jsonb
language plpgsql security definer
set search_path=''
as $$
declare v_user uuid := auth.uid(); r public.quiz_update_editor_notice%rowtype;
        v_title text := btrim(coalesce(p_title,'')); v_body text := btrim(coalesce(p_body,''));
begin
  if v_user is null or coalesce(auth.jwt()->>'is_anonymous','false')='true'
     or not exists(select 1 from public.quiz_admins where user_id=v_user) then
    raise exception 'Administrator required' using errcode='42501';
  end if;
  if p_action not in ('draft','publish','unpublish') then
    raise exception 'Invalid action' using errcode='22023';
  end if;
  if p_action in ('draft','publish') and
    (char_length(v_title)>80 or char_length(v_body)>4000) then
    raise exception 'Notice length exceeded' using errcode='22023';
  end if;
  if p_action='publish' and (v_title='' or v_body='') then
    raise exception 'Title and body are required for publication' using errcode='22023';
  end if;
  select * into r from public.quiz_update_editor_notice where id=1 for update;
  if not found then raise exception 'Notice configuration missing'; end if;
  if p_expected_revision is distinct from r.edit_revision then
    raise exception 'Notice changed by another administrator; reload and retry'
    using errcode='40001';
  end if;
  if p_action='draft' then
    update public.quiz_update_editor_notice
      set draft_title=v_title,draft_body=v_body,
          draft_show_banks=coalesce(p_show_banks,true),
          edit_revision=edit_revision+1,updated_at=now(),updated_by=v_user
    where id=1;
  elsif p_action='publish' then
    update public.quiz_update_editor_notice
      set draft_title=v_title,draft_body=v_body,
          draft_show_banks=coalesce(p_show_banks,true),
          published_title=v_title,published_body=v_body,
          published_show_banks=coalesce(p_show_banks,true),
          is_published=true,publication_revision=publication_revision+1,
          edit_revision=edit_revision+1,updated_at=now(),
          published_at=now(),updated_by=v_user
    where id=1;
  else
    update public.quiz_update_editor_notice
      set is_published=false,publication_revision=publication_revision+1,
          edit_revision=edit_revision+1,updated_at=now(),updated_by=v_user
    where id=1;
  end if;
  return public.quiz_admin_notice_get();
end;
$$;
revoke all on function public.quiz_admin_notice_get() from PUBLIC,anon,authenticated;
revoke all on function public.quiz_admin_notice_save(text,text,text,boolean,bigint) from PUBLIC,anon,authenticated;
grant execute on function public.quiz_admin_notice_get() to authenticated;
grant execute on function public.quiz_admin_notice_save(text,text,text,boolean,bigint) to authenticated;
