\set ON_ERROR_STOP on
DO $$
BEGIN
 IF has_table_privilege('authenticated','public.quiz_wenchang_points_spent','SELECT')
 OR has_table_privilege('authenticated','public.quiz_wenchang_points_spent','INSERT')
 OR has_table_privilege('anon','public.quiz_wenchang_points_spent','INSERT') THEN
    RAISE EXCEPTION 'Points ledger directly exposed';
 END IF;
 IF has_function_privilege('anon','public.quiz_wenchang_reveal(text)','EXECUTE')
 OR has_function_privilege('anon','public.quiz_wenchang_question_access(text)','EXECUTE')
 OR has_function_privilege('anon','public.quiz_wenchang_status()','EXECUTE') THEN
    RAISE EXCEPTION 'Unauthenticated caller has RPC access';
 END IF;
 IF has_function_privilege('authenticated','public.quiz_guestbook_grant_wenchang(uuid,integer)','EXECUTE')
 OR has_function_privilege('authenticated','public.quiz_admin_reset_wenchang(uuid)','EXECUTE') THEN
    RAISE EXCEPTION 'Legacy point mutations still callable';
 END IF;
 IF NOT (SELECT relrowsecurity FROM pg_class WHERE oid='public.quiz_wenchang_points_spent'::regclass) THEN
    RAISE EXCEPTION 'Ledger RLS disabled';
 END IF;
END $$;

SET ROLE authenticated;
SELECT set_config('request.jwt.claim.sub','11111111-1111-4111-8111-111111111111',false);

DO $$
DECLARE b jsonb; a jsonb;
BEGIN
 b:=public.quiz_wenchang_status();
 IF (b->>'earned')::int<>2 OR (b->>'credits')::int<>2 OR (b->>'spent')::int<>0
 OR b->>'credit_source'<>'correct_answers' THEN RAISE EXCEPTION 'Wrong initial earned balance: %',b; END IF;
 a:=public.quiz_wenchang_question_access('q3');
 IF a->>'can_reveal_without_points'<>'true' OR a->>'already_unlocked'<>'true' THEN
   RAISE EXCEPTION 'Legacy unlock not free: %',a; END IF;
 a:=public.quiz_wenchang_reveal('q3');
 IF a->>'used_credit'<>'false' OR (a->'status'->>'credits')::int<>2 THEN
   RAISE EXCEPTION 'Legacy unlock incorrectly charged: %',a; END IF;
 a:=public.quiz_wenchang_reveal('q1');
 IF a->>'used_credit'<>'true' OR (a->'status'->>'credits')::int<>1 OR (a->>'correct_answer')::int<>1 THEN
   RAISE EXCEPTION 'First reveal must spend exactly 1: %',a; END IF;
 a:=public.quiz_wenchang_reveal('q1');
 IF a->>'used_credit'<>'false' OR (a->'status'->>'credits')::int<>1 THEN
   RAISE EXCEPTION 'Repeated reveal spent twice: %',a; END IF;
 a:=public.quiz_wenchang_reveal('q4');
 IF a->>'used_credit'<>'true' OR (a->'status'->>'credits')::int<>0 THEN
   RAISE EXCEPTION 'Second new reveal should exhaust points: %',a; END IF;
 a:=public.quiz_wenchang_question_access('q1');
 IF a->>'can_reveal_without_points'<>'true' THEN RAISE EXCEPTION 'Paid unlock lost at zero'; END IF;
 BEGIN
   PERFORM public.quiz_wenchang_reveal('q5');
   RAISE EXCEPTION 'Reveal incorrectly succeeded with no points';
 EXCEPTION WHEN SQLSTATE '22023' THEN
   IF (SELECT count(*) FROM public.quiz_wenchang_points_spent
       WHERE user_id='11111111-1111-4111-8111-111111111111')<>2 THEN
       RAISE EXCEPTION 'Failed reveal changed balance';
   END IF;
 END;
 BEGIN
   PERFORM public.quiz_wenchang_reveal('q2');
   RAISE EXCEPTION 'Correct answer was inappropriately revealable';
 EXCEPTION WHEN SQLSTATE '22023' THEN NULL; END;
END $$;
-- After switching the token, the next member cannot access first member's unlocks.
SELECT set_config('request.jwt.claim.sub','22222222-2222-4222-8222-222222222222',false);
DO $$
DECLARE a jsonb;
BEGIN
 a:=public.quiz_wenchang_status();
 IF (a->>'credits')::int<>0 THEN RAISE EXCEPTION 'Cross-member credits leaked: %',a; END IF;
 a:=public.quiz_wenchang_question_access('q1');
 IF a->>'can_reveal_without_points'<>'false' THEN RAISE EXCEPTION 'Other user unlock leaked'; END IF;
 BEGIN
   PERFORM public.quiz_wenchang_reveal('q1');
   RAISE EXCEPTION 'Zero-point member was allowed to spend';
 EXCEPTION WHEN SQLSTATE '22023' THEN NULL; END;
END $$;
-- Special existing administrator exception stays unchanged.
SELECT set_config('request.jwt.claim.sub','33333333-3333-4333-8333-333333333333',false);
DO $$
DECLARE a jsonb;
BEGIN
 a:=public.quiz_wenchang_question_access('q5');
 IF a->>'can_reveal_without_points'<>'true' THEN RAISE EXCEPTION 'Admin exception missing'; END IF;
 a:=public.quiz_wenchang_reveal('q5');
 IF a->>'administrator_exempt'<>'true' OR a->>'used_credit'<>'false'
 OR (a->'status'->>'credits')::int<>0 THEN RAISE EXCEPTION 'Admin exemption failed'; END IF;
END $$;
RESET ROLE;
DO $$
BEGIN
 IF (SELECT count(*) FROM public.quiz_wenchang_points_spent)<>2 THEN
   RAISE EXCEPTION 'Unexpected spent ledger rows';
 END IF;
 IF (SELECT credits FROM public.quiz_wenchang_wallet
     WHERE user_id='11111111-1111-4111-8111-111111111111')<>10 THEN
   RAISE EXCEPTION 'Legacy wallet was modified';
 END IF;
 IF (SELECT count(*) FROM public.quiz_wenchang_unlocked
     WHERE user_id='11111111-1111-4111-8111-111111111111')<>3 THEN
   RAISE EXCEPTION 'Prior and new unlocks not preserved';
 END IF;
END $$;
SELECT 'PASS: earned points, spent ledger, free old unlock, repeat reveal, zero, other member, admin, grants, RLS' AS outcome;
