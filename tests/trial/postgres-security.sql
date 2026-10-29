\set ON_ERROR_STOP on
DO $$
BEGIN
  IF has_table_privilege('anon','public.quiz_trial_ip_counters','SELECT')
    OR has_table_privilege('authenticated','public.quiz_trial_ip_counters','UPDATE')
    OR has_table_privilege('authenticated','public.quiz_trial_ip_answers','INSERT')
    OR has_function_privilege('anon','public.quiz_trial_submit(text,text,integer)','EXECUTE')
    OR has_function_privilege('authenticated','public.quiz_trial_status(text)','EXECUTE')
  THEN RAISE EXCEPTION 'FAIL: anonymous trial privilege leakage'; END IF;
END $$;

SET ROLE service_role;
SELECT public.quiz_trial_status(repeat('a',64)) AS initial_status;
DO $$
DECLARE x jsonb; i integer; identity text := repeat('a',64);
BEGIN
  x:=public.quiz_trial_status(identity);
  IF x->>'remaining'<>'5' OR x->>'locked'<>'false' THEN
    RAISE EXCEPTION 'FAIL: initial quota not 5';
  END IF;
  x:=public.quiz_trial_submit(identity,'trial-q-1',1);
  IF x->>'correct'<>'true' OR x->>'remaining'<>'4' THEN
    RAISE EXCEPTION 'FAIL: accepted valid correct answer';
  END IF;
  x:=public.quiz_trial_submit(identity,'trial-q-1',0);
  IF x->>'accepted'<>'false' OR x->>'reason'<>'already_answered' OR x->>'used'<>'1' THEN
    RAISE EXCEPTION 'FAIL: replay consumed quota';
  END IF;
  FOR i IN 2..5 LOOP
    x:=public.quiz_trial_submit(identity,'trial-q-'||i,0);
    IF x->>'used'<>i::text OR x->>'remaining'<>(5-i)::text THEN
      RAISE EXCEPTION 'FAIL: incorrect sequential remaining quota';
    END IF;
  END LOOP;
  x:=public.quiz_trial_submit(identity,'trial-q-6',2);
  IF x->>'accepted'<>'false' OR x->>'locked'<>'true' OR x->>'used'<>'5' THEN
    RAISE EXCEPTION 'FAIL: over-quota answer accepted';
  END IF;
  IF x ? 'correct_answer' OR x ? 'explanation' THEN
    RAISE EXCEPTION 'FAIL: answer leaked';
  END IF;
  x:=public.quiz_trial_status(identity);
  IF x->>'remaining'<>'0' THEN RAISE EXCEPTION 'FAIL: quota not permanent'; END IF;
  x:=public.quiz_trial_submit(repeat('b',64),'trial-q-1',0);
  IF x->>'accepted'<>'true' OR x->>'remaining'<>'4' THEN
    RAISE EXCEPTION 'FAIL: independent IP identity blocked';
  END IF;
  IF (SELECT count(*) FROM public.quiz_trial_ip_answers WHERE ip_digest=identity)<>5 THEN
    RAISE EXCEPTION 'FAIL: expected exactly five distinct trial attempts';
  END IF;
  BEGIN
    PERFORM public.quiz_trial_submit(identity,'not-a-real-question',0);
    RAISE EXCEPTION 'FAIL: invalid question accepted';
  EXCEPTION WHEN invalid_parameter_value THEN NULL; END;
END $$;
RESET ROLE;
SELECT 'PASS: anon denied, atomic 5-answer quota, replay safe, lock, isolation, no answers leaked' AS result;
