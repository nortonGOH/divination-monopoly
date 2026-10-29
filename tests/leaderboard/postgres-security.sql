\set ON_ERROR_STOP on
DO $$
DECLARE j jsonb; n integer;
BEGIN
 IF has_table_privilege('anon','auth.users','SELECT')
    OR has_table_privilege('anon','public.quiz_player_profiles','SELECT')
    OR has_table_privilege('anon','public.quiz_player_state','SELECT') THEN
   RAISE EXCEPTION 'FAIL: direct user or score data exposed to anonymous role';
 END IF;
 IF NOT has_function_privilege('anon','public.quiz_public_leaderboard()','EXECUTE')
    OR NOT has_function_privilege('anon','public.quiz_public_registration_count()','EXECUTE') THEN
   RAISE EXCEPTION 'FAIL: public leaderboard endpoints unavailable';
 END IF;
 SELECT public.quiz_public_registration_count() INTO j;
 IF (j->>'registered_count')::integer <> 8 THEN
   RAISE EXCEPTION 'FAIL: registration count did not include profile-less member';
 END IF;
 SELECT count(*) INTO n FROM public.quiz_public_leaderboard();
 IF n <> 5 THEN RAISE EXCEPTION 'FAIL: leaderboard did not limit to five'; END IF;
 IF NOT EXISTS (SELECT 1 FROM public.quiz_public_leaderboard() WHERE nickname='測試會員1' AND correct_attempts=9) THEN
   RAISE EXCEPTION 'FAIL: previously opted-out top scorer absent';
 END IF;
 IF NOT EXISTS (SELECT 1 FROM public.quiz_public_leaderboard() WHERE total_attempts=0) THEN
   RAISE EXCEPTION 'FAIL: zero-scoring member excluded';
 END IF;
 IF EXISTS(SELECT 1 FROM public.quiz_public_leaderboard() WHERE nickname LIKE '%@%') THEN
   RAISE EXCEPTION 'FAIL: email leaked in nickname';
 END IF;
END $$;
SET ROLE anon;
SELECT public.quiz_public_registration_count() AS total_registered;
SELECT * FROM public.quiz_public_leaderboard() ORDER BY "position";
RESET ROLE;
SELECT 'PASS: all registered users counted, top five only, opted-out and zero-scoring ranked, no direct table grants' AS verdict;
