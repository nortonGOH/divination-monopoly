-- Isolated migration proposal: daily challenge, review snapshot and badges.
-- Do NOT apply to production until separate CI and security review pass.
BEGIN;
CREATE TABLE IF NOT EXISTS public.quiz_daily_assignments (
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  challenge_date date NOT NULL,
  slot smallint NOT NULL CHECK(slot BETWEEN 1 AND 3),
  question_id text NOT NULL REFERENCES public.quiz_questions(id) ON DELETE CASCADE,
  PRIMARY KEY(user_id,challenge_date,slot),
  UNIQUE(user_id,challenge_date,question_id)
);
CREATE TABLE IF NOT EXISTS public.quiz_daily_completions (
  user_id uuid NOT NULL, challenge_date date NOT NULL,
  question_id text NOT NULL, completed_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY(user_id,challenge_date,question_id),
  FOREIGN KEY(user_id,challenge_date,question_id)
    REFERENCES public.quiz_daily_assignments(user_id,challenge_date,question_id) ON DELETE CASCADE
);
ALTER TABLE public.quiz_daily_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quiz_daily_completions ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.quiz_daily_assignments,public.quiz_daily_completions FROM PUBLIC,anon,authenticated;

-- Invoked by the existing server-validated quiz_submit_choice() transaction.
-- It never accepts correctness or user IDs from the browser.
CREATE OR REPLACE FUNCTION public.quiz_daily_capture_answer()
RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path=''
AS $fn$
DECLARE v_date date := (now() AT TIME ZONE 'Asia/Taipei')::date;
BEGIN
 IF NEW.correct IS TRUE THEN
   INSERT INTO public.quiz_daily_completions(user_id,challenge_date,question_id)
   SELECT a.user_id,a.challenge_date,a.question_id
     FROM public.quiz_daily_assignments a
    WHERE a.user_id=NEW.user_id AND a.challenge_date=v_date
      AND a.question_id=NEW.question_id ON CONFLICT DO NOTHING;
 END IF;
 RETURN NEW;
END;
$fn$;
DROP TRIGGER IF EXISTS quiz_daily_capture_answer_trigger ON public.quiz_player_answered_questions;
CREATE TRIGGER quiz_daily_capture_answer_trigger
AFTER INSERT OR UPDATE OF correct ON public.quiz_player_answered_questions
FOR EACH ROW EXECUTE FUNCTION public.quiz_daily_capture_answer();

CREATE OR REPLACE FUNCTION public.quiz_learning_dashboard()
RETURNS jsonb LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path=''
AS $fn$
DECLARE
 v_uid uuid:=auth.uid();
 v_today date:=(now() AT TIME ZONE 'Asia/Taipei')::date;
 v_date date;
 v_daily jsonb:='[]'::jsonb;
 v_wrong jsonb:='[]'::jsonb;
 v_mastered integer:=0;
 v_recovered integer:=0;
 v_days integer:=0;
 v_streak integer:=0;
 v_done integer:=0;
 v_assigned integer:=0;
BEGIN
 IF v_uid IS NULL THEN RAISE EXCEPTION 'Login required' USING ERRCODE='28000'; END IF;
 -- Three unmastered questions, stable for a Taiwan calendar day.
 IF NOT EXISTS (
    SELECT 1 FROM public.quiz_daily_assignments
    WHERE user_id=v_uid AND challenge_date=v_today
 ) THEN
   INSERT INTO public.quiz_daily_assignments(user_id,challenge_date,slot,question_id)
   SELECT v_uid,v_today,row_number() OVER(ORDER BY sorted.rank_key,sorted.id)::smallint,sorted.id
   FROM (
     SELECT q.id,md5(v_today::text||':'||v_uid::text||':'||q.id) AS rank_key
       FROM public.quiz_questions q
      WHERE NOT EXISTS (
        SELECT 1 FROM public.quiz_player_answered_questions h
        WHERE h.user_id=v_uid AND h.question_id=q.id AND h.correct IS TRUE
      )
      ORDER BY rank_key,q.id LIMIT 3
   ) sorted ON CONFLICT DO NOTHING;
 END IF;

 SELECT count(*)::integer,count(c.question_id)::integer,
   coalesce(jsonb_agg(jsonb_build_object('id',a.question_id,'slot',a.slot,
               'correct',(c.question_id IS NOT NULL)) ORDER BY a.slot) FILTER (WHERE a.question_id IS NOT NULL),'[]'::jsonb)
 INTO v_assigned,v_done,v_daily
 FROM public.quiz_daily_assignments a
 LEFT JOIN public.quiz_daily_completions c
   ON c.user_id=a.user_id AND c.challenge_date=a.challenge_date
  AND c.question_id=a.question_id
 WHERE a.user_id=v_uid AND a.challenge_date=v_today;

 SELECT coalesce(jsonb_agg(jsonb_build_object('id',w.question_id,
       'attempts',w.attempt_count) ORDER BY w.answered_at DESC),'[]'::jsonb)
 INTO v_wrong
 FROM (
   SELECT question_id,attempt_count,answered_at
   FROM public.quiz_player_answered_questions
   WHERE user_id=v_uid AND correct IS FALSE
   ORDER BY answered_at DESC LIMIT 20
 ) w;

 SELECT count(*) FILTER(WHERE correct IS TRUE)::integer,
        count(*) FILTER(WHERE correct IS TRUE AND attempt_count>1)::integer
 INTO v_mastered,v_recovered
 FROM public.quiz_player_answered_questions WHERE user_id=v_uid;

 SELECT count(*)::integer INTO v_days FROM (
   SELECT a.challenge_date
   FROM public.quiz_daily_assignments a
   LEFT JOIN public.quiz_daily_completions c
     ON c.user_id=a.user_id AND c.challenge_date=a.challenge_date
    AND c.question_id=a.question_id
   WHERE a.user_id=v_uid GROUP BY a.challenge_date
   HAVING count(*)=3 AND count(c.question_id)=3
 ) d;
 v_date:=v_today;
 IF NOT EXISTS (
   SELECT 1 FROM public.quiz_daily_assignments a
   JOIN public.quiz_daily_completions c
     ON c.user_id=a.user_id AND c.challenge_date=a.challenge_date
    AND c.question_id=a.question_id
   WHERE a.user_id=v_uid AND a.challenge_date=v_date
   GROUP BY a.challenge_date HAVING count(*)=3
 ) THEN v_date:=v_date-1; END IF;
 LOOP
   EXIT WHEN NOT EXISTS (
     SELECT 1 FROM public.quiz_daily_assignments a
     JOIN public.quiz_daily_completions c
       ON c.user_id=a.user_id AND c.challenge_date=a.challenge_date
      AND c.question_id=a.question_id
     WHERE a.user_id=v_uid AND a.challenge_date=v_date
     GROUP BY a.challenge_date HAVING count(*)=3
   );
   v_streak:=v_streak+1; v_date:=v_date-1;
 END LOOP;
 RETURN jsonb_build_object(
   'date',v_today,'daily',v_daily,'assigned',v_assigned,'done',v_done,
   'wrong',v_wrong,'mastered',v_mastered,'recovered',v_recovered,
   'days',v_days,'streak',v_streak
 );
END;
$fn$;
REVOKE ALL ON FUNCTION public.quiz_learning_dashboard() FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.quiz_learning_dashboard() TO authenticated;
REVOKE ALL ON FUNCTION public.quiz_daily_capture_answer() FROM PUBLIC,anon,authenticated;
COMMIT;
