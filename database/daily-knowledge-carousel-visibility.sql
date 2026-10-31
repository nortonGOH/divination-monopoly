-- Optional daily knowledge carousel; existing member-only answer cards remain private.
alter table public.quiz_public_feature_settings
 add column if not exists daily_knowledge_visible boolean not null default true;

-- Public response contains only visibility flags, never admin metadata.
create or replace function public.quiz_public_feature_visibility()
returns jsonb language sql stable security definer set search_path=''
as $$
  select jsonb_build_object(
    'guestbook_visible',coalesce(s.guestbook_visible,true),
    'leaderboard_visible',coalesce(s.leaderboard_visible,true),
    'daily_knowledge_visible',coalesce(s.daily_knowledge_visible,true)
  )
  from public.quiz_public_feature_settings s where s.id=1;
$$;

create or replace function public.quiz_admin_feature_visibility()
returns jsonb language plpgsql stable security definer set search_path=''
as $$
declare uid uuid:=auth.uid(); r public.quiz_public_feature_settings%rowtype;
begin
  if uid is null or coalesce(auth.jwt()->>'is_anonymous','false')='true'
     or not exists(select 1 from public.quiz_admins a where a.user_id=uid) then
    raise exception 'Administrator required' using errcode='42501';
  end if;
  select * into r from public.quiz_public_feature_settings where id=1;
  if not found then raise exception 'Feature settings missing'; end if;
  return jsonb_build_object(
    'guestbook_visible',r.guestbook_visible,
    'leaderboard_visible',r.leaderboard_visible,
    'daily_knowledge_visible',r.daily_knowledge_visible,
    'revision',r.revision,'updated_at',r.updated_at);
end;
$$;

-- New version avoids breaking existing clients that still call the legacy 3-argument setter.
create or replace function public.quiz_admin_set_feature_visibility_v2(
  p_guestbook_visible boolean,p_leaderboard_visible boolean,
  p_daily_knowledge_visible boolean,p_expected_revision bigint)
returns jsonb language plpgsql security definer set search_path=''
as $$
declare uid uuid:=auth.uid(); r public.quiz_public_feature_settings%rowtype;
begin
  if uid is null or coalesce(auth.jwt()->>'is_anonymous','false')='true'
     or not exists(select 1 from public.quiz_admins a where a.user_id=uid) then
    raise exception 'Administrator required' using errcode='42501';
  end if;
  if p_guestbook_visible is null or p_leaderboard_visible is null
     or p_daily_knowledge_visible is null then
    raise exception 'Three visibility flags are required' using errcode='22023';
  end if;
  select * into r from public.quiz_public_feature_settings where id=1 for update;
  if not found then raise exception 'Feature settings missing'; end if;
  if p_expected_revision is distinct from r.revision then
    raise exception 'Feature settings changed; reload first' using errcode='40001';
  end if;
  update public.quiz_public_feature_settings
     set guestbook_visible=p_guestbook_visible,
         leaderboard_visible=p_leaderboard_visible,
         daily_knowledge_visible=p_daily_knowledge_visible,
         revision=revision+1,updated_at=now(),updated_by=uid
   where id=1;
  return public.quiz_admin_feature_visibility();
end;
$$;
revoke all on function public.quiz_public_feature_visibility() from PUBLIC,anon,authenticated;
revoke all on function public.quiz_admin_feature_visibility() from PUBLIC,anon,authenticated;
revoke all on function public.quiz_admin_set_feature_visibility_v2(boolean,boolean,boolean,bigint)
 from PUBLIC,anon,authenticated;
grant execute on function public.quiz_public_feature_visibility() to anon,authenticated;
grant execute on function public.quiz_admin_feature_visibility() to authenticated;
grant execute on function public.quiz_admin_set_feature_visibility_v2(boolean,boolean,boolean,bigint) to authenticated;
