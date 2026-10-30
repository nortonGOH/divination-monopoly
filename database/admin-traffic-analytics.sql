-- Aggregate page views. No visitor IDs, cookies, IP addresses or raw referrer URLs.
create table if not exists public.quiz_traffic_daily (
  visit_day date not null,
  source text not null check (source in ('direct','search','social','referral','internal','unknown')),
  page text not null check (page in ('home','atlas')),
  views bigint not null default 0 check (views >= 0),
  primary key (visit_day,source,page)
);
alter table public.quiz_traffic_daily enable row level security;
revoke all on public.quiz_traffic_daily from public,anon,authenticated;

create or replace function public.quiz_track_page_view(p_page text,p_source text)
returns void language plpgsql security definer set search_path=''
as $$
declare d date := (now() at time zone 'Asia/Taipei')::date;
begin
  if p_page is null or p_page not in ('home','atlas')
    or p_source is null or p_source not in ('direct','search','social','referral','internal','unknown')
  then raise exception 'Invalid traffic dimension' using errcode='22023'; end if;
  insert into public.quiz_traffic_daily(visit_day,source,page,views)
    values(d,p_source,p_page,1)
    on conflict(visit_day,source,page) do update set views=public.quiz_traffic_daily.views+1;
end;$$;
revoke all on function public.quiz_track_page_view(text,text) from public,anon,authenticated;
grant execute on function public.quiz_track_page_view(text,text) to anon,authenticated;

create or replace function public.quiz_admin_traffic_report()
returns jsonb language plpgsql security definer set search_path=''
as $$
declare uid uuid := auth.uid(); today date := (now() at time zone 'Asia/Taipei')::date;
begin
 if uid is null or coalesce((select auth.jwt()->>'is_anonymous'),'false')='true'
    or not exists(select 1 from public.quiz_admins a where a.user_id=uid) then
    raise exception 'Administrator required' using errcode='42501';
 end if;
 return jsonb_build_object(
  'timezone','Asia/Taipei',
  'today',today,
  'total',coalesce((select sum(views) from public.quiz_traffic_daily),0),
  'today_views',coalesce((select sum(views) from public.quiz_traffic_daily where visit_day=today),0),
  'week_views',coalesce((select sum(views) from public.quiz_traffic_daily where visit_day >= date_trunc('week',today::timestamp)::date and visit_day<=today),0),
  'month_views',coalesce((select sum(views) from public.quiz_traffic_daily where visit_day >= date_trunc('month',today::timestamp)::date and visit_day<=today),0),
  'daily',coalesce((select jsonb_agg(x order by x->>'period' desc) from (
    select jsonb_build_object('period',visit_day::text,'views',sum(views)) x
    from public.quiz_traffic_daily group by visit_day order by visit_day desc limit 60
  ) d),'[]'::jsonb),
  'weekly',coalesce((select jsonb_agg(x order by x->>'period' desc) from (
    select jsonb_build_object('period',to_char(date_trunc('week',visit_day::timestamp),'YYYY-MM-DD'),'views',sum(views)) x
    from public.quiz_traffic_daily group by date_trunc('week',visit_day::timestamp) order by date_trunc('week',visit_day::timestamp) desc limit 26
  ) w),'[]'::jsonb),
  'monthly',coalesce((select jsonb_agg(x order by x->>'period' desc) from (
    select jsonb_build_object('period',to_char(date_trunc('month',visit_day::timestamp),'YYYY-MM'),'views',sum(views)) x
    from public.quiz_traffic_daily group by date_trunc('month',visit_day::timestamp) order by date_trunc('month',visit_day::timestamp) desc limit 24
  ) m),'[]'::jsonb),
  'sources',coalesce((select jsonb_agg(jsonb_build_object('source',source,'views',n) order by n desc)
     from (select source,sum(views) n from public.quiz_traffic_daily group by source) s),'[]'::jsonb),
  'pages',coalesce((select jsonb_agg(jsonb_build_object('page',page,'views',n) order by n desc)
     from (select page,sum(views) n from public.quiz_traffic_daily group by page) s),'[]'::jsonb)
 );
end;$$;
revoke all on function public.quiz_admin_traffic_report() from public,anon,authenticated;
grant execute on function public.quiz_admin_traffic_report() to authenticated;
