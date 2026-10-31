-- Use the live quiz_questions.knowledge_type vocabulary. No separate editable taxonomy.
alter table public.quiz_daily_knowledge_cards add column if not exists knowledge_type text;
-- Preserve legacy cards as unclassified; managers can assign categories explicitly.
-- A named type must already exist in the question bank.
create or replace function public.quiz_daily_knowledge_type_guard()
returns trigger language plpgsql security invoker set search_path=''
as $$
begin
 if new.knowledge_type is not null
  and not exists(select 1 from public.quiz_questions q where q.knowledge_type=new.knowledge_type) then
  raise exception 'Knowledge type is not present in quiz_questions' using errcode='23514';
 end if;
 return new;
end;$$;
drop trigger if exists quiz_daily_card_type_guard on public.quiz_daily_knowledge_cards;
create trigger quiz_daily_card_type_guard before insert or update of knowledge_type on public.quiz_daily_knowledge_cards
for each row execute function public.quiz_daily_knowledge_type_guard();
create or replace function public.quiz_public_daily_knowledge_cards()
returns jsonb language sql stable security definer set search_path=''
as $$
 select jsonb_build_object(
  'cards',coalesce((select jsonb_agg(jsonb_build_object('id',z.id,'title',z.title,
    'content',z.body,'knowledge_type',z.knowledge_type,'caution',z.caution,'source_label',z.source_label,'source_url',z.source_url)
    order by z.id)
    from (select id,title,body,caution,source_label,source_url,knowledge_type
          from public.quiz_daily_knowledge_cards
          where is_active=true order by id limit 250) z),'[]'::jsonb)
 );
$$;


create or replace function public.quiz_admin_daily_knowledge_list()
returns jsonb language plpgsql stable security definer set search_path=''
as $$
declare uid uuid:=auth.uid(); result jsonb;
begin
 if uid is null or coalesce(auth.jwt()->>'is_anonymous','false')='true'
 or not exists(select 1 from public.quiz_admins a where a.user_id=uid) then
  raise exception 'Administrator required' using errcode='42501';
 end if;
 select jsonb_build_object(
  'visible',s.daily_knowledge_visible,'settings_revision',s.revision,
  'types',coalesce((select jsonb_agg(knowledge_type order by knowledge_type) from (select distinct knowledge_type from public.quiz_questions where nullif(btrim(knowledge_type),'') is not null) typ),'[]'::jsonb),
  'cards',coalesce((select jsonb_agg(to_jsonb(c) order by c.created_at,c.id)
    from (select id,title,body,caution,source_label,source_url,knowledge_type,is_active,revision,created_at,updated_at
          from public.quiz_daily_knowledge_cards order by created_at,id limit 250) c),'[]'::jsonb)
 ) into result from public.quiz_public_feature_settings s where s.id=1;
 return result;
end;
$$;


create or replace function public.quiz_admin_daily_knowledge_save(
 p_id uuid,p_title text,p_body text,p_caution text,
 p_source_label text,p_source_url text,p_active boolean,p_expected_revision bigint,p_knowledge_type text)
returns jsonb language plpgsql security definer set search_path=''
as $$
declare uid uuid:=auth.uid(); r public.quiz_daily_knowledge_cards%rowtype;
        v_title text:=btrim(coalesce(p_title,'')); v_body text:=btrim(coalesce(p_body,''));
        v_source text:=btrim(coalesce(p_source_label,'')); v_url text:=btrim(coalesce(p_source_url,''));
        v_caution text:=btrim(coalesce(p_caution,'')); v_type text:=btrim(coalesce(p_knowledge_type,''));
        v_visible boolean;
begin
 if uid is null or coalesce(auth.jwt()->>'is_anonymous','false')='true'
 or not exists(select 1 from public.quiz_admins a where a.user_id=uid) then
  raise exception 'Administrator required' using errcode='42501';
 end if;
 if length(v_title) not between 1 and 100 or length(v_body) not between 1 and 1800
 or length(v_caution)>700 or length(v_source) not between 1 and 250
 or length(v_url)>600 or v_url !~ '^https://[^[:space:]]+$' or p_active is null then
  raise exception 'Invalid card fields or source HTTPS URL' using errcode='22023';
 end if;
 if not exists(select 1 from public.quiz_questions where knowledge_type=v_type) then
  raise exception 'Invalid knowledge type: select one from the existing question bank' using errcode='22023';
 end if;
 select daily_knowledge_visible into v_visible from public.quiz_public_feature_settings where id=1 for update;
 if p_id is null then
  if p_expected_revision is not null then raise exception 'New card cannot have revision' using errcode='22023';end if;
  insert into public.quiz_daily_knowledge_cards(title,body,caution,source_label,source_url,knowledge_type,is_active,updated_by)
    values(v_title,v_body,v_caution,v_source,v_url,v_type,p_active,uid) returning * into r;
 else
  select * into r from public.quiz_daily_knowledge_cards where id=p_id for update;
  if not found then raise exception 'Card missing' using errcode='P0002'; end if;
  if p_expected_revision is distinct from r.revision then
   raise exception 'Card changed by another editor; reload' using errcode='40001';
  end if;
  if not p_active and r.is_active and v_visible and
     (select count(*) from public.quiz_daily_knowledge_cards where is_active) <= 3 then
   raise exception 'Keep at least three active cards while carousel is visible' using errcode='22023';
  end if;
  update public.quiz_daily_knowledge_cards
   set title=v_title,body=v_body,caution=v_caution,source_label=v_source,source_url=v_url,knowledge_type=v_type,
       is_active=p_active,revision=revision+1,updated_at=now(),updated_by=uid
   where id=p_id returning * into r;
 end if;
 return jsonb_build_object('id',r.id,'revision',r.revision,'is_active',r.is_active);
end;
$$;

revoke all on function public.quiz_admin_daily_knowledge_save(uuid,text,text,text,text,text,boolean,bigint) from PUBLIC,anon,authenticated;
revoke all on function public.quiz_admin_daily_knowledge_save(uuid,text,text,text,text,text,boolean,bigint,text) from PUBLIC,anon,authenticated;
grant execute on function public.quiz_admin_daily_knowledge_save(uuid,text,text,text,text,text,boolean,bigint,text) to authenticated;
-- Retire the old 8-argument editor endpoint (no way to set the required category).
drop function public.quiz_admin_daily_knowledge_save(uuid,text,text,text,text,text,boolean,bigint);
