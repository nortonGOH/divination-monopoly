-- Called only by trusted Edge service role; never expose raw token or client IP RPC.
CREATE OR REPLACE FUNCTION public.quiz_nickname_beginner_action(
 p_action text,p_token_digest text,p_source_ip inet,p_nickname text DEFAULT NULL,
 p_question_id text DEFAULT NULL,p_answer_index integer DEFAULT NULL
) RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path=''
AS $$
DECLARE v_player public.quiz_nickname_players%rowtype;
 v_answer integer; v_level text; v_correct boolean;
BEGIN
 IF p_action IS NULL OR p_action NOT IN ('join','status','answer')
 OR p_token_digest IS NULL OR p_token_digest !~ '^[a-f0-9]{64}$'
 OR p_source_ip IS NULL OR masklen(p_source_ip)<>(CASE WHEN family(p_source_ip)=4 THEN 32 ELSE 128 END)
 THEN RAISE EXCEPTION 'Invalid nickname request' USING ERRCODE='22023'; END IF;
 IF p_action='join' THEN
   IF p_nickname IS NULL OR length(p_nickname) NOT BETWEEN 2 AND 18
      OR p_nickname ~ '[[:cntrl:][:space:]]'
   THEN RAISE EXCEPTION 'Invalid nickname' USING ERRCODE='22023'; END IF;
   INSERT INTO public.quiz_nickname_players(token_digest,nickname) VALUES(p_token_digest,p_nickname)
     ON CONFLICT(token_digest) DO UPDATE SET nickname=EXCLUDED.nickname,updated_at=now();
 END IF;
 SELECT * INTO v_player FROM public.quiz_nickname_players WHERE token_digest=p_token_digest FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Join with nickname before answering' USING ERRCODE='22023'; END IF;
 IF p_action='answer' THEN
  IF p_question_id IS NULL OR length(p_question_id) NOT BETWEEN 1 AND 150
    OR p_answer_index IS NULL OR p_answer_index NOT BETWEEN 0 AND 3
  THEN RAISE EXCEPTION 'Invalid answer' USING ERRCODE='22023'; END IF;
  SELECT q.answer,q.difficulty INTO v_answer,v_level
   FROM public.quiz_questions q WHERE q.id=p_question_id;
  IF NOT FOUND OR v_level IS DISTINCT FROM '初階'
  THEN RAISE EXCEPTION 'Registration required for this difficulty' USING ERRCODE='42501'; END IF;
  IF EXISTS(SELECT 1 FROM public.quiz_nickname_answers
   WHERE token_digest=p_token_digest AND question_id=p_question_id) THEN
   RETURN jsonb_build_object('accepted',false,'reason','already_answered',
    'nickname',v_player.nickname,'total_attempts',v_player.total_attempts,
    'correct_attempts',v_player.correct_attempts);
  END IF;
  v_correct:=(v_answer=p_answer_index);
  INSERT INTO public.quiz_nickname_answers(token_digest,question_id,correct)
   VALUES(p_token_digest,p_question_id,v_correct);
  UPDATE public.quiz_nickname_players SET total_attempts=total_attempts+1,
   correct_attempts=correct_attempts+CASE WHEN v_correct THEN 1 ELSE 0 END,
   updated_at=now() WHERE token_digest=p_token_digest RETURNING * INTO v_player;
 END IF;
 IF p_action IN ('join','answer') THEN
  INSERT INTO public.quiz_nickname_ip_activity(token_digest,source_ip,action)
  VALUES(p_token_digest,p_source_ip,p_action);
  DELETE FROM public.quiz_nickname_ip_activity WHERE occurred_at<now()-interval '30 days';
 END IF;
 RETURN jsonb_build_object('accepted',true,
  'correct',CASE WHEN p_action='answer' THEN v_correct ELSE NULL END,
  'nickname',v_player.nickname,'total_attempts',v_player.total_attempts,
  'correct_attempts',v_player.correct_attempts);
END; $$;
REVOKE ALL ON FUNCTION public.quiz_nickname_beginner_action(text,text,inet,text,text,integer)
 FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.quiz_nickname_beginner_action(text,text,inet,text,text,integer) TO service_role;
