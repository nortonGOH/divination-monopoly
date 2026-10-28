-- v13: persistent per-account question history. Earlier attempt totals have no question IDs and cannot be reconstructed.
BEGIN;
CREATE TABLE IF NOT EXISTS public.quiz_player_answered_questions(
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  question_id text NOT NULL,
  correct boolean NOT NULL,
  answered_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY(user_id,question_id)
);
ALTER TABLE public.quiz_player_answered_questions ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.quiz_player_answered_questions FROM PUBLIC,anon,authenticated;

CREATE OR REPLACE FUNCTION public.quiz_answered_question_ids()
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=''
AS $$
DECLARE v_uid uuid:=auth.uid();
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Please log in' USING ERRCODE='28000'; END IF;
  RETURN (SELECT COALESCE(jsonb_agg(question_id ORDER BY question_id),'[]'::jsonb)
    FROM public.quiz_player_answered_questions WHERE user_id=v_uid);
END;
$$;
REVOKE ALL ON FUNCTION public.quiz_answered_question_ids() FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.quiz_answered_question_ids() TO authenticated;

CREATE OR REPLACE FUNCTION public.quiz_submit_choice(p_question_id text,p_answer_index integer)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=''
AS $$
DECLARE
  v_uid uuid:=auth.uid();
  v_row public.quiz_player_state%rowtype;
  v_answer integer;
  v_explanation text;
  v_correct boolean;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Please log in' USING ERRCODE='28000'; END IF;
  IF p_answer_index IS NULL OR p_answer_index NOT BETWEEN 0 AND 3 THEN
    RAISE EXCEPTION 'Invalid answer index' USING ERRCODE='22023';
  END IF;
  INSERT INTO public.quiz_player_state(user_id) VALUES(v_uid) ON CONFLICT (user_id) DO NOTHING;
  SELECT * INTO v_row FROM public.quiz_player_state WHERE user_id=v_uid FOR UPDATE;
  IF v_row.locked_until IS NOT NULL AND v_row.locked_until > now() THEN
    RETURN jsonb_build_object('accepted',false,'reason','locked','locked',true,
      'wrong_count',v_row.wrong_count,'locked_until',v_row.locked_until);
  END IF;
  IF v_row.locked_until IS NOT NULL AND v_row.locked_until <= now() THEN
    UPDATE public.quiz_player_state SET wrong_count=0,locked_until=NULL,updated_at=now()
      WHERE user_id=v_uid RETURNING * INTO v_row;
  END IF;
  IF EXISTS(SELECT 1 FROM public.quiz_player_answered_questions
    WHERE user_id=v_uid AND question_id=p_question_id) THEN
    RETURN jsonb_build_object('accepted',false,'reason','already_answered','locked',false,
      'total_attempts',v_row.total_attempts,'correct_attempts',v_row.correct_attempts);
  END IF;
  SELECT answer,explanation INTO v_answer,v_explanation
    FROM public.quiz_questions WHERE id=p_question_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Question not found'; END IF;
  v_correct:=(v_answer=p_answer_index);
  INSERT INTO public.quiz_player_answered_questions(user_id,question_id,correct)
    VALUES(v_uid,p_question_id,v_correct);
  UPDATE public.quiz_player_state SET
    total_attempts=total_attempts+1,
    correct_attempts=correct_attempts+CASE WHEN v_correct THEN 1 ELSE 0 END,
    updated_at=now()
    WHERE user_id=v_uid RETURNING * INTO v_row;
  IF NOT v_correct THEN
    UPDATE public.quiz_player_state SET
      wrong_count=least(5,wrong_count+1),
      locked_until=CASE WHEN wrong_count+1>=5 THEN now()+interval '4 hours' ELSE NULL END,
      updated_at=now()
      WHERE user_id=v_uid RETURNING * INTO v_row;
  END IF;
  RETURN jsonb_build_object(
    'accepted',true,'correct',v_correct,'correct_answer',v_answer,
    'explanation',v_explanation,'wrong_count',v_row.wrong_count,
    'locked',COALESCE(v_row.locked_until>now(),false),'locked_until',v_row.locked_until,
    'total_attempts',v_row.total_attempts,'correct_attempts',v_row.correct_attempts,
    'success_rate',round(100.0*v_row.correct_attempts/nullif(v_row.total_attempts,0),1));
END;
$$;
REVOKE ALL ON FUNCTION public.quiz_submit_choice(text,integer) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.quiz_submit_choice(text,integer) TO authenticated;
COMMIT;
NOTIFY pgrst,'reload schema';