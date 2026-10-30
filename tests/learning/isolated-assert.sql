\set ON_ERROR_STOP on
SET ROLE authenticated;
SELECT set_config('request.jwt.claim.sub','11111111-1111-4111-8111-111111111111',false);
DO $test$
DECLARE a jsonb; b jsonb;
BEGIN
 a:=public.quiz_learning_dashboard(); b:=public.quiz_learning_dashboard();
 IF a->'daily'<>b->'daily' OR jsonb_array_length(a->'daily')<>3
 THEN RAISE EXCEPTION 'The daily assignment changed on refresh'; END IF;
 IF (a->>'assigned')::integer<>3 OR (a->>'done')::integer<>0
 THEN RAISE EXCEPTION 'Expected three unanswered questions'; END IF;
 IF has_table_privilege(current_user,'public.quiz_daily_assignments','SELECT')
    OR has_table_privilege(current_user,'public.quiz_daily_completions','INSERT')
 THEN RAISE EXCEPTION 'Direct client table grants are too broad'; END IF;
 IF (a ? 'answer') OR (a::text LIKE '%verified one%')
 THEN RAISE EXCEPTION 'Dashboard must never leak answer keys'; END IF;
END;
$test$;
RESET ROLE;
-- Simulate the server's already-validated grading transaction.
-- Members are intentionally NOT allowed to write the ledger directly.
SELECT set_config('request.jwt.claim.sub','11111111-1111-4111-8111-111111111111',false);
INSERT INTO public.quiz_player_answered_questions(user_id,question_id,correct)
SELECT user_id,question_id,false
FROM public.quiz_daily_assignments
WHERE user_id='11111111-1111-4111-8111-111111111111'
ORDER BY slot LIMIT 1;
SET ROLE authenticated;
DO $test$
DECLARE a jsonb;
BEGIN
 a:=public.quiz_learning_dashboard();
 IF jsonb_array_length(a->'wrong')<>1 OR (a->>'done')::integer<>0
 THEN RAISE EXCEPTION 'Wrong answer should be reviewable, not completed'; END IF;
END;
$test$;
RESET ROLE;
UPDATE public.quiz_player_answered_questions SET
 correct=true, attempt_count=2, answered_at=now()
WHERE user_id='11111111-1111-4111-8111-111111111111';
SET ROLE authenticated;
DO $test$
DECLARE a jsonb;
BEGIN
 a:=public.quiz_learning_dashboard();
 IF (a->>'done')::integer<>1 OR (a->>'mastered')::integer<>1
 OR (a->>'recovered')::integer<>1 OR jsonb_array_length(a->'wrong')<>0
 THEN RAISE EXCEPTION 'Review progress / recovery badge calculation failed'; END IF;
END;
$test$;
-- Switching account must not expose the first member's progress.
SELECT set_config('request.jwt.claim.sub','22222222-2222-4222-8222-222222222222',false);
DO $test$
DECLARE a jsonb;
BEGIN
 a:=public.quiz_learning_dashboard();
 IF (a->>'done')::integer<>0 OR (a->>'mastered')::integer<>0
 OR jsonb_array_length(a->'wrong')<>0
 THEN RAISE EXCEPTION 'Member isolation failed'; END IF;
END;
$test$;
RESET ROLE;
SELECT set_config('request.jwt.claim.sub','',false);
SET ROLE anon;
DO $test$
BEGIN
 BEGIN
   PERFORM public.quiz_learning_dashboard();
   RAISE EXCEPTION 'Anonymous call was incorrectly accepted';
 EXCEPTION WHEN insufficient_privilege THEN NULL;
 END;
END;
$test$;
RESET ROLE;
\echo 'PASS: server-only daily progress, wrong answers, badges, isolation and anon denial'
