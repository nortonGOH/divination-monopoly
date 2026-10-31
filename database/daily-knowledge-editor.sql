-- Independent editorial content: NEVER publish gated answer cards or member-only lessons.
create table if not exists public.quiz_daily_knowledge_cards (
  id uuid primary key default gen_random_uuid(),
  title text not null check(length(btrim(title)) between 1 and 100),
  body text not null check(length(btrim(body)) between 1 and 1800),
  caution text not null default '' check(length(caution)<=700),
  source_label text not null check(length(btrim(source_label)) between 1 and 250),
  source_url text not null check(length(source_url)<=600 and source_url ~ '^https://[^[:space:]]+$'),
  is_active boolean not null default true,
  revision bigint not null default 1 check(revision>=1),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  updated_by uuid
);
alter table public.quiz_daily_knowledge_cards enable row level security;
revoke all on public.quiz_daily_knowledge_cards from PUBLIC, anon, authenticated;

-- Seed the nine existing publicly disclosed notes unchanged; never seed question answers.
insert into public.quiz_daily_knowledge_cards (id,title,body,caution,source_label,source_url)
select md5('intro-public:'+v.seed_key)::uuid,v.title,v.body,v.caution,v.source_label,v.source_url
from (values
('classification-0','數術文獻與歷史分類','《漢書·藝文志》區分六藝、諸子、詩賦、兵書、術數與方技等著錄類別。','「山醫命卜相」適合用作部分後世傳統的描述，不能直接當成《漢書》原有的五分法。','《漢書》卷三十〈藝文志〉','https://ctext.org/han-shu/yi-wen-zhi'),
('classification-1','數術文獻與歷史分類','〈術數略〉列有天文、曆譜、五行、蓍龜、雜占、形法；〈方技略〉另列醫經、經方、房中、神仙。','「山醫命卜相」適合用作部分後世傳統的描述，不能直接當成《漢書》原有的五分法。','《漢書》卷三十〈藝文志〉','https://ctext.org/han-shu/yi-wen-zhi'),
('classification-2','數術文獻與歷史分類','書目分類反映編纂者的知識秩序，不等於所有實際使用者都遵守同一學科界線。','「山醫命卜相」適合用作部分後世傳統的描述，不能直接當成《漢書》原有的五分法。','《漢書》卷三十〈藝文志〉','https://ctext.org/han-shu/yi-wen-zhi'),
('yinyang-0','陰陽、五行與關聯思維','陰陽可用於描述相對位置、變化與相互關係；不宜先驗地把它化約為固定的兩個物體。','這是現代研究整理的概念引導，不主張所有時代共享同一套完整宇宙論。','《周易》〈繫辭上〉','https://ctext.org/book-of-changes/xi-ci-shang'),
('yinyang-1','陰陽、五行與關聯思維','五行相關說法出現在不同類型的古代文獻中，彼此並非完全同義。','這是現代研究整理的概念引導，不主張所有時代共享同一套完整宇宙論。','《周易》〈繫辭上〉','https://ctext.org/book-of-changes/xi-ci-shang'),
('yinyang-2','陰陽、五行與關聯思維','分析古代技術時，應先辨認作者使用陰陽、五行所處理的具體問題。','這是現代研究整理的概念引導，不主張所有時代共享同一套完整宇宙論。','《周易》〈繫辭上〉','https://ctext.org/book-of-changes/xi-ci-shang'),
('calendar-0','干支、曆譜與歲時','干支常被用來標記時間，應注意不同時代、地域及制度中的用法。','本單元不宣稱存在跨朝代通用且固定不變的干支推算法。','《漢書》卷三十〈藝文志〉','https://ctext.org/han-shu/yi-wen-zhi'),
('calendar-1','干支、曆譜與歲時','曆譜涉及年月日的編排與推算，不等同於所有以日期判斷吉凶的活動。','本單元不宣稱存在跨朝代通用且固定不變的干支推算法。','《漢書》卷三十〈藝文志〉','https://ctext.org/han-shu/yi-wen-zhi'),
('calendar-2','干支、曆譜與歲時','古代曆法知識與官方制度、農事、祭祀及占候實踐可能相互關聯。','本單元不宣稱存在跨朝代通用且固定不變的干支推算法。','《漢書》卷三十〈藝文志〉','https://ctext.org/han-shu/yi-wen-zhi')
) as v(seed_key,title,body,caution,source_label,source_url)
on conflict(id) do nothing;

-- Anonymous API exposes only active published public-learning cards; never admin metadata.
create or replace function public.quiz_public_daily_knowledge_cards()
returns jsonb language sql stable security definer set search_path=''
as $$
 select jsonb_build_object(
  'cards',coalesce((select jsonb_agg(jsonb_build_object('id',z.id,'title',z.title,
    'content',z.body,'caution',z.caution,'source_label',z.source_label,'source_url',z.source_url)
    order by z.id)
    from (select id,title,body,caution,source_label,source_url
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
  'cards',coalesce((select jsonb_agg(to_jsonb(c) order by c.created_at,c.id)
    from (select id,title,body,caution,source_label,source_url,is_active,revision,created_at,updated_at
          from public.quiz_daily_knowledge_cards order by created_at,id limit 250) c),'[]'::jsonb)
 ) into result from public.quiz_public_feature_settings s where s.id=1;
 return result;
end;
$$;

-- Separate toggle avoids overwriting simultaneous guestbook/leaderboard settings.
create or replace function public.quiz_admin_daily_knowledge_visibility(
  p_visible boolean,p_expected_revision bigint)
returns jsonb language plpgsql security definer set search_path=''
as $$
declare uid uuid:=auth.uid(); r public.quiz_public_feature_settings%rowtype;
begin
 if uid is null or coalesce(auth.jwt()->>'is_anonymous','false')='true'
 or not exists(select 1 from public.quiz_admins a where a.user_id=uid) then
  raise exception 'Administrator required' using errcode='42501';
 end if;
 if p_visible is null then raise exception 'Visibility is required' using errcode='22023';end if;
 select * into r from public.quiz_public_feature_settings where id=1 for update;
 if p_expected_revision is distinct from r.revision then
  raise exception 'Settings changed; reload first' using errcode='40001';
 end if;
 if p_visible and (select count(*) from public.quiz_daily_knowledge_cards where is_active) < 3 then
  raise exception 'At least three active cards are required' using errcode='22023';
 end if;
 update public.quiz_public_feature_settings
 set daily_knowledge_visible=p_visible,revision=revision+1,updated_at=now(),updated_by=uid where id=1;
 return public.quiz_admin_daily_knowledge_list();
end;
$$;

create or replace function public.quiz_admin_daily_knowledge_save(
 p_id uuid,p_title text,p_body text,p_caution text,
 p_source_label text,p_source_url text,p_active boolean,p_expected_revision bigint)
returns jsonb language plpgsql security definer set search_path=''
as $$
declare uid uuid:=auth.uid(); r public.quiz_daily_knowledge_cards%rowtype;
        v_title text:=btrim(coalesce(p_title,'')),v_body text:=btrim(coalesce(p_body,'')),
        v_source text:=btrim(coalesce(p_source_label,'')),v_url text:=btrim(coalesce(p_source_url,''));
        v_caution text:=btrim(coalesce(p_caution,''));
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
 select daily_knowledge_visible into v_visible from public.quiz_public_feature_settings where id=1 for update;
 if p_id is null then
  if p_expected_revision is not null then raise exception 'New card cannot have revision' using errcode='22023';end if;
  insert into public.quiz_daily_knowledge_cards(title,body,caution,source_label,source_url,is_active,updated_by)
    values(v_title,v_body,v_caution,v_source,v_url,p_active,uid) returning * into r;
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
   set title=v_title,body=v_body,caution=v_caution,source_label=v_source,source_url=v_url,
       is_active=p_active,revision=revision+1,updated_at=now(),updated_by=uid
   where id=p_id returning * into r;
 end if;
 return jsonb_build_object('id',r.id,'revision',r.revision,'is_active',r.is_active);
end;
$$;
revoke all on function public.quiz_public_daily_knowledge_cards() from PUBLIC,anon,authenticated;
revoke all on function public.quiz_admin_daily_knowledge_list() from PUBLIC,anon,authenticated;
revoke all on function public.quiz_admin_daily_knowledge_visibility(boolean,bigint) from PUBLIC,anon,authenticated;
revoke all on function public.quiz_admin_daily_knowledge_save(uuid,text,text,text,text,text,boolean,bigint) from PUBLIC,anon,authenticated;
grant execute on function public.quiz_public_daily_knowledge_cards() to anon,authenticated;
grant execute on function public.quiz_admin_daily_knowledge_list() to authenticated;
grant execute on function public.quiz_admin_daily_knowledge_visibility(boolean,bigint) to authenticated;
grant execute on function public.quiz_admin_daily_knowledge_save(uuid,text,text,text,text,text,boolean,bigint) to authenticated;
