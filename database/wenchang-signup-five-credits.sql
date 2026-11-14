-- Five welcome rescue credits granted exactly once to new permanent Auth accounts.
-- Existing users receive no retroactive award; never use legacy refill wallet balances.
create table if not exists public.quiz_wenchang_signup_grants (
  user_id uuid primary key references auth.users(id) on delete cascade,
  points integer not null default 5 check (points=5),
  granted_at timestamptz not null default now()
);
alter table public.quiz_wenchang_signup_grants enable row level security;
revoke all on public.quiz_wenchang_signup_grants from public,anon,authenticated;
create or replace function public.quiz_wenchang_grant_on_signup()
returns trigger language plpgsql security definer set search_path = ''
as $$
begin
  if new.is_anonymous is false and new.email is not null then
    insert into public.quiz_wenchang_signup_grants(user_id,points)
    values(new.id,5) on conflict(user_id) do nothing;
  end if;
  return new;
end;
$$;
revoke all on function public.quiz_wenchang_grant_on_signup() from public,anon,authenticated;
drop trigger if exists quiz_wenchang_signup_bonus on auth.users;
create trigger quiz_wenchang_signup_bonus
after insert on auth.users for each row
execute function public.quiz_wenchang_grant_on_signup();

create or replace function public.quiz_wenchang_status()
returns jsonb language plpgsql security definer set search_path = ''
as $$
declare v_uid uuid := auth.uid(); v_earned bigint := 0; v_spent bigint := 0; v_bonus bigint := 0;
begin
 if v_uid is null then raise exception '請先登入會員' using errcode='28000'; end if;
 select coalesce(s.correct_attempts,0) into v_earned from public.quiz_player_state s where s.user_id=v_uid;
 v_earned:=coalesce(v_earned,0);
 select count(*) into v_spent from public.quiz_wenchang_points_spent p where p.user_id=v_uid;
 select coalesce(sum(points),0) into v_bonus from public.quiz_wenchang_signup_grants g where g.user_id=v_uid;
 return jsonb_build_object('credits',greatest(0,v_bonus+v_earned-v_spent),
  'signup_bonus',v_bonus,'earned',v_earned,'spent',v_spent,'earn_per_correct',1,
  'cost_per_reveal',1,'credit_source','correct_answers');
end;
$$;

create or replace function public.quiz_wenchang_reveal(p_question_id text)
returns jsonb language plpgsql security definer set search_path = ''
as $$
declare
 v_uid uuid := auth.uid();
 v_row public.quiz_player_state%rowtype;
 v_answer integer; v_explanation text;
 v_admin boolean; v_unlocked boolean; v_spent bigint; v_bonus integer := 0;
 v_used boolean := false;
begin
 if v_uid is null then raise exception '請先登入會員' using errcode='28000'; end if;
 if p_question_id is null or length(p_question_id)>200 then
   raise exception '無效的題目編號' using errcode='22023';
 end if;
 insert into public.quiz_player_state(user_id) values(v_uid) on conflict(user_id) do nothing;
 select * into v_row from public.quiz_player_state where user_id=v_uid for update;
 if not exists (select 1 from public.quiz_player_answered_questions a
     where a.user_id=v_uid and a.question_id=p_question_id and a.correct is false) then
   raise exception '本題尚未有答錯紀錄，無法啟用文昌星救援' using errcode='22023';
 end if;
 select q.answer,q.explanation into v_answer,v_explanation
   from public.quiz_questions q where q.id=p_question_id;
 if not found then raise exception '找不到這道題目' using errcode='22023'; end if;
 select exists(select 1 from auth.users u join public.quiz_admins ad on ad.user_id=u.id
    where u.id=v_uid and lower(u.email)='nortonwu@gmail.com') into v_admin;
 select exists(select 1 from public.quiz_wenchang_unlocked u
    where u.user_id=v_uid and u.question_id=p_question_id) into v_unlocked;
 if not v_admin and not v_unlocked then
   select count(*) into v_spent from public.quiz_wenchang_points_spent p where p.user_id=v_uid;
   select coalesce(sum(points),0) into v_bonus from public.quiz_wenchang_signup_grants g where g.user_id=v_uid;
   if v_row.correct_attempts+v_bonus<=v_spent then
     raise exception '文昌點數不足，請先答對新題目' using errcode='22023';
   end if;
   insert into public.quiz_wenchang_points_spent(user_id,question_id) values(v_uid,p_question_id);
   insert into public.quiz_wenchang_unlocked(user_id,question_id) values(v_uid,p_question_id);
   v_used:=true;
 end if;
 return jsonb_build_object('correct_answer',v_answer,'explanation',v_explanation,
   'used_credit',v_used,'administrator_exempt',v_admin,
   'status',public.quiz_wenchang_status());
end;
$$;
