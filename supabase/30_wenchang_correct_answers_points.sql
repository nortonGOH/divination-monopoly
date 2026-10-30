-- Wenchang rescue: earned points, backed exclusively by the server-graded correct tally.
-- Roll out after disposable PostgreSQL and browser checks pass.
-- Keeps all prior unlocks, legacy wallet rows and guestbook award history intact.
BEGIN;
CREATE TABLE IF NOT EXISTS public.quiz_wenchang_points_spent (
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  question_id text NOT NULL,
  spent_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, question_id)
);
ALTER TABLE public.quiz_wenchang_points_spent ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.quiz_wenchang_points_spent FROM PUBLIC, anon, authenticated;

-- Balance = all server-confirmed correct answers - all NEW paid reveals.
-- Never alters, imports, or refills the obsolete wallet.
CREATE OR REPLACE FUNCTION public.quiz_wenchang_status()
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=''
AS $fn$
DECLARE v_uid uuid := auth.uid(); v_earned bigint := 0; v_spent bigint := 0;
BEGIN
 IF v_uid IS NULL THEN RAISE EXCEPTION '請先登入會員' USING ERRCODE='28000'; END IF;
 SELECT COALESCE(s.correct_attempts,0) INTO v_earned
   FROM public.quiz_player_state s WHERE s.user_id=v_uid;
 v_earned:=COALESCE(v_earned,0);
 SELECT count(*) INTO v_spent FROM public.quiz_wenchang_points_spent p
   WHERE p.user_id=v_uid;
 RETURN jsonb_build_object('credits',GREATEST(0,v_earned-v_spent),
   'earned',v_earned,'spent',v_spent,'earn_per_correct',1,
   'cost_per_reveal',1,'credit_source','correct_answers');
END;
$fn$;

-- A legacy or new unlock may be viewed again even at zero remaining points.
-- This function returns only access flags; no answer keys or explanations.
CREATE OR REPLACE FUNCTION public.quiz_wenchang_question_access(p_question_id text)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=''
AS $fn$
DECLARE v_uid uuid := auth.uid(); v_wrong boolean; v_unlocked boolean; v_admin boolean;
BEGIN
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
$fn$;

-- quiz_submit_choice and this function serialize on the same player-state row.
-- Correctness, balance, and spent state are never accepted from the browser.
CREATE OR REPLACE FUNCTION public.quiz_wenchang_reveal(p_question_id text)
RETURNS jsonb LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path=''
AS $fn$
DECLARE
 v_uid uuid := auth.uid();
 v_row public.quiz_player_state%ROWTYPE;
 v_answer integer; v_explanation text;
 v_admin boolean; v_unlocked boolean; v_spent bigint;
 v_used boolean := false;
BEGIN
 IF v_uid IS NULL THEN RAISE EXCEPTION '請先登入會員' USING ERRCODE='28000'; END IF;
 IF p_question_id IS NULL OR length(p_question_id)>200 THEN
   RAISE EXCEPTION '無效的題目編號' USING ERRCODE='22023';
 END IF;
 INSERT INTO public.quiz_player_state(user_id) VALUES(v_uid) ON CONFLICT(user_id) DO NOTHING;
 SELECT * INTO v_row FROM public.quiz_player_state WHERE user_id=v_uid FOR UPDATE;
 IF NOT EXISTS (SELECT 1 FROM public.quiz_player_answered_questions a
     WHERE a.user_id=v_uid AND a.question_id=p_question_id AND a.correct IS FALSE) THEN
   RAISE EXCEPTION '本題尚未有答錯紀錄，無法啟用文昌星救援' USING ERRCODE='22023';
 END IF;
 SELECT q.answer,q.explanation INTO v_answer,v_explanation
   FROM public.quiz_questions q WHERE q.id=p_question_id;
 IF NOT FOUND THEN RAISE EXCEPTION '找不到這道題目' USING ERRCODE='22023'; END IF;
 SELECT EXISTS(SELECT 1 FROM auth.users u JOIN public.quiz_admins ad ON ad.user_id=u.id
    WHERE u.id=v_uid AND lower(u.email)='nortonwu@gmail.com') INTO v_admin;
 SELECT EXISTS(SELECT 1 FROM public.quiz_wenchang_unlocked u
    WHERE u.user_id=v_uid AND u.question_id=p_question_id) INTO v_unlocked;

 IF NOT v_admin AND NOT v_unlocked THEN
   SELECT count(*) INTO v_spent FROM public.quiz_wenchang_points_spent p
     WHERE p.user_id=v_uid;
   IF v_row.correct_attempts <= v_spent THEN
     RAISE EXCEPTION '文昌點數不足，請先答對新題目' USING ERRCODE='22023';
   END IF;
   INSERT INTO public.quiz_wenchang_points_spent(user_id,question_id)
     VALUES(v_uid,p_question_id);
   INSERT INTO public.quiz_wenchang_unlocked(user_id,question_id)
     VALUES(v_uid,p_question_id);
   v_used:=true;
 END IF;
 RETURN jsonb_build_object('correct_answer',v_answer,'explanation',v_explanation,
   'used_credit',v_used,'administrator_exempt',v_admin,
   'status',public.quiz_wenchang_status());
END;
$fn$;

-- Do not let obsolete grant and reset RPCs change what users see as points.
REVOKE ALL ON FUNCTION public.quiz_wenchang_status() FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.quiz_wenchang_question_access(text) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.quiz_wenchang_reveal(text) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.quiz_guestbook_grant_wenchang(uuid,integer) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.quiz_admin_reset_wenchang(uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.quiz_wenchang_status() TO authenticated;
GRANT EXECUTE ON FUNCTION public.quiz_wenchang_question_access(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.quiz_wenchang_reveal(text) TO authenticated;
COMMIT;
