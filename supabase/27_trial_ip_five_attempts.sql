-- Anonymous five-answer trial, keyed by a keyed SHA-256 digest of the inbound IP.
-- IP addresses are hashed in the Edge Function and never stored in PostgreSQL.
-- Five accepted answers per IP identity in the lifetime of this trial.
BEGIN;

CREATE TABLE IF NOT EXISTS public.quiz_trial_ip_counters (
  ip_digest text PRIMARY KEY CHECK (ip_digest ~ '^[a-f0-9]{64}$'),
  attempts integer NOT NULL DEFAULT 0 CHECK (attempts BETWEEN 0 AND 5),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS public.quiz_trial_ip_answers (
  ip_digest text NOT NULL REFERENCES public.quiz_trial_ip_counters(ip_digest) ON DELETE RESTRICT,
  question_id text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY(ip_digest,question_id)
);

ALTER TABLE public.quiz_trial_ip_counters ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quiz_trial_ip_answers ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.quiz_trial_ip_counters FROM PUBLIC, anon, authenticated;
REVOKE ALL ON public.quiz_trial_ip_answers FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE ON public.quiz_trial_ip_counters TO service_role;
GRANT SELECT, INSERT ON public.quiz_trial_ip_answers TO service_role;

-- SECURITY INVOKER: only the trusted Edge Function's service role may execute;
-- no anonymous user can submit arbitrary IP digests through PostgREST.
CREATE OR REPLACE FUNCTION public.quiz_trial_status(p_identity text)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY INVOKER SET search_path=''
AS $$
DECLARE v_used integer;
BEGIN
  IF p_identity IS NULL OR p_identity !~ '^[a-f0-9]{64}$' THEN
    RAISE EXCEPTION 'Invalid trial identity' USING ERRCODE='22023';
  END IF;
  SELECT attempts INTO v_used FROM public.quiz_trial_ip_counters WHERE ip_digest=p_identity;
  v_used:=COALESCE(v_used,0);
  RETURN jsonb_build_object('used',v_used,'remaining',5-v_used,'limit',5,'locked',v_used>=5);
END $$;

CREATE OR REPLACE FUNCTION public.quiz_trial_submit(
  p_identity text,p_question_id text,p_answer_index integer
) RETURNS jsonb LANGUAGE plpgsql VOLATILE SECURITY INVOKER SET search_path=''
AS $$
DECLARE v_used integer; v_answer integer; v_exists boolean;
BEGIN
  IF p_identity IS NULL OR p_identity !~ '^[a-f0-9]{64}$' THEN
    RAISE EXCEPTION 'Invalid trial identity' USING ERRCODE='22023';
  END IF;
  IF p_question_id IS NULL OR char_length(p_question_id)>150
     OR p_answer_index IS NULL OR p_answer_index NOT BETWEEN 0 AND 3 THEN
    RAISE EXCEPTION 'Invalid trial answer' USING ERRCODE='22023';
  END IF;

  -- Never return the answer index or explanation to an unauthenticated visitor.
  SELECT answer INTO v_answer FROM public.quiz_questions WHERE id=p_question_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Question not found' USING ERRCODE='22023';
  END IF;

  INSERT INTO public.quiz_trial_ip_counters(ip_digest,attempts)
    VALUES(p_identity,0) ON CONFLICT(ip_digest) DO NOTHING;
  SELECT attempts INTO v_used
    FROM public.quiz_trial_ip_counters WHERE ip_digest=p_identity FOR UPDATE;
  IF v_used>=5 THEN
    RETURN jsonb_build_object('accepted',false,'reason','limit_reached',
      'used',v_used,'remaining',0,'limit',5,'locked',true);
  END IF;
  SELECT EXISTS(SELECT 1 FROM public.quiz_trial_ip_answers
    WHERE ip_digest=p_identity AND question_id=p_question_id) INTO v_exists;
  IF v_exists THEN
    RETURN jsonb_build_object('accepted',false,'reason','already_answered',
      'used',v_used,'remaining',5-v_used,'limit',5,'locked',false);
  END IF;

  INSERT INTO public.quiz_trial_ip_answers(ip_digest,question_id)
    VALUES(p_identity,p_question_id);
  UPDATE public.quiz_trial_ip_counters
    SET attempts=attempts+1,updated_at=now()
    WHERE ip_digest=p_identity;
  v_used:=v_used+1;
  RETURN jsonb_build_object('accepted',true,'correct',v_answer=p_answer_index,
    'used',v_used,'remaining',5-v_used,'limit',5,'locked',v_used>=5);
END $$;

REVOKE ALL ON FUNCTION public.quiz_trial_status(text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.quiz_trial_submit(text,text,integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.quiz_trial_status(text) TO service_role;
GRANT EXECUTE ON FUNCTION public.quiz_trial_submit(text,text,integer) TO service_role;
COMMIT;
