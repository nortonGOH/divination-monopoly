BEGIN;
-- This migration is for staging first. It preserves the currently deployed balance/reveal rules.
-- Require a confirmed email-based Auth account, not a nickname/IP identity or anonymous JWT.
CREATE OR REPLACE FUNCTION public.quiz_require_email_member()
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=''
AS $member$
BEGIN
 IF auth.uid() IS NULL
    OR coalesce(auth.jwt()->>'is_anonymous','false')='true'
    OR NOT EXISTS(
      SELECT 1 FROM auth.users u
      WHERE u.id=auth.uid()
        AND u.email IS NOT NULL
        AND btrim(u.email)<>''
        AND u.email_confirmed_at IS NOT NULL
    )
 THEN RAISE EXCEPTION 'Please sign in with a confirmed email member account'
      USING errcode='28000'; END IF;
END;
$member$;
REVOKE ALL ON FUNCTION public.quiz_require_email_member() FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.quiz_require_email_member() TO authenticated;

CREATE OR REPLACE FUNCTION public.quiz_wenchang_question_access(p_question_id text)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE v_uid uuid := auth.uid(); v_wrong boolean; v_unlocked boolean; v_admin boolean;
BEGIN
 PERFORM public.quiz_require_email_member();
 IF v_uid IS NULL THEN RAISE EXCEPTION '請先登入會員' USING ERRCODE='28000'; END IF;
 SELECT EXISTS(SELECT 1 FROM public.quiz_player_answered_questions a
      WHERE a.user_id=v_uid AND a.question_id=p_question_id AND a.correct IS FALSE)
 INTO v_wrong;
 SELECT EXISTS(SELECT 1 FROM public.quiz_wenchang_unlocked u
      WHERE u.user_id=v_uid AND u.question_id=p_question_id)
 INTO v_unlocked;
 SELECT EXISTS(SELECT 1 FROM auth.users u JOIN public.quiz_admins ad ON ad.user_id=u.id
      WHERE u.id=v_uid AND lower(u.email)='nortonwu@gmail.com') INTO v_admin;
 RETURN jsonb_build_object('can_reveal_without_points',v_wrong AND (v_unlocked OR v_admin),
   'already_unlocked',v_wrong AND v_unlocked,'administrator_exempt',v_wrong AND v_admin);
END;
$function$;

CREATE OR REPLACE FUNCTION public.quiz_wenchang_reveal(p_question_id text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
 v_uid uuid := auth.uid();
 v_row public.quiz_player_state%rowtype;
 v_answer integer; v_explanation text;
 v_admin boolean; v_unlocked boolean; v_spent bigint; v_bonus integer := 0;
 v_used boolean := false;
BEGIN
 PERFORM public.quiz_require_email_member();
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
$function$;

CREATE OR REPLACE FUNCTION public.quiz_wenchang_status()
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare v_uid uuid := auth.uid(); v_earned bigint := 0; v_spent bigint := 0; v_bonus bigint := 0;
BEGIN
 PERFORM public.quiz_require_email_member();
 if v_uid is null then raise exception '請先登入會員' using errcode='28000'; end if;
 select coalesce(s.correct_attempts,0) into v_earned from public.quiz_player_state s where s.user_id=v_uid;
 v_earned:=coalesce(v_earned,0);
 select count(*) into v_spent from public.quiz_wenchang_points_spent p where p.user_id=v_uid;
 select coalesce(sum(points),0) into v_bonus from public.quiz_wenchang_signup_grants g where g.user_id=v_uid;
 return jsonb_build_object('credits',greatest(0,v_bonus+v_earned-v_spent),
  'signup_bonus',v_bonus,'earned',v_earned,'spent',v_spent,'earn_per_correct',1,
  'cost_per_reveal',1,'credit_source','correct_answers');
end;
$function$;

REVOKE ALL ON FUNCTION public.quiz_wenchang_status() FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.quiz_wenchang_status() TO authenticated;
REVOKE ALL ON FUNCTION public.quiz_wenchang_question_access(text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.quiz_wenchang_question_access(text) TO authenticated;
REVOKE ALL ON FUNCTION public.quiz_wenchang_reveal(text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.quiz_wenchang_reveal(text) TO authenticated;
COMMIT;
