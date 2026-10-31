-- Disposable PostgreSQL 17, not connected to production Supabase.
CREATE SCHEMA auth;
CREATE ROLE anon NOLOGIN;
CREATE ROLE authenticated NOLOGIN;
CREATE ROLE service_role NOLOGIN BYPASSRLS;
GRANT USAGE ON SCHEMA public TO anon,authenticated,service_role;
CREATE TABLE auth.users(id uuid PRIMARY KEY);
CREATE TABLE public.quiz_admins(user_id uuid PRIMARY KEY);
CREATE TABLE public.quiz_questions(id text PRIMARY KEY,answer integer,difficulty text);
CREATE TABLE public.quiz_player_profiles(user_id uuid PRIMARY KEY,nickname text);
CREATE TABLE public.quiz_player_state(user_id uuid PRIMARY KEY,total_attempts bigint,correct_attempts bigint);
CREATE OR REPLACE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE
 AS $$ SELECT nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
CREATE OR REPLACE FUNCTION auth.jwt() RETURNS jsonb LANGUAGE sql STABLE
 AS $$ SELECT coalesce(nullif(current_setting('request.jwt.claims',true),''),'{}')::jsonb $$;
INSERT INTO auth.users VALUES('00000000-0000-0000-0000-000000000001');
INSERT INTO public.quiz_admins VALUES('00000000-0000-0000-0000-000000000001');
INSERT INTO public.quiz_player_profiles VALUES('00000000-0000-0000-0000-000000000001','Member');
INSERT INTO public.quiz_player_state VALUES('00000000-0000-0000-0000-000000000001',4,2);
INSERT INTO public.quiz_questions VALUES('beginner1',0,'初階'),('advanced1',2,'高階');
GRANT SELECT ON public.quiz_questions TO service_role;
\i database/nickname-beginner-players.sql
\i database/nickname-beginner-answers.sql
\i database/nickname-beginner-ip-observation.sql
\i database/nickname-beginner-action.sql
\i database/nickname-beginner-leaderboard.sql
\i database/nickname-beginner-admin-observation.sql

DO $$
BEGIN
 IF has_table_privilege('anon','public.quiz_nickname_players','SELECT')
 OR has_table_privilege('anon','public.quiz_nickname_ip_activity','SELECT')
 OR has_function_privilege('anon','public.quiz_nickname_beginner_action(text,text,inet,text,text,integer)','EXECUTE')
 THEN RAISE EXCEPTION 'Unregistered client gained private DB access'; END IF;
END $$;

SET ROLE service_role;
SELECT public.quiz_nickname_beginner_action('join',repeat('a',64),'198.51.100.42','Visitor',NULL,NULL);
DO $$
DECLARE r jsonb;
BEGIN
 r:=public.quiz_nickname_beginner_action('answer',repeat('a',64),'198.51.100.42',NULL,'beginner1',0);
 IF r->>'accepted'<>'true' OR r->>'correct'<>'true' OR (r->>'correct_attempts')::integer<>1
 THEN RAISE EXCEPTION 'Beginner answer not scored'; END IF;
 r:=public.quiz_nickname_beginner_action('answer',repeat('a',64),'198.51.100.42',NULL,'beginner1',0);
 IF r->>'reason'<>'already_answered' OR (r->>'correct_attempts')::integer<>1
 THEN RAISE EXCEPTION 'Duplicate question inflated score'; END IF;
END $$;
DO $$
DECLARE denied boolean:=false;
BEGIN
 BEGIN
  PERFORM public.quiz_nickname_beginner_action('answer',repeat('a',64),'198.51.100.42',NULL,'advanced1',2);
 EXCEPTION WHEN SQLSTATE '42501' THEN denied:=true;
 END;
 IF NOT denied THEN RAISE EXCEPTION 'Unregistered player answered advanced question'; END IF;
END $$;
SELECT public.quiz_nickname_beginner_action('join',repeat('b',64),'198.51.100.42','Visitor2',NULL,NULL);
RESET ROLE;

SET ROLE authenticated;
SELECT set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000001',false);
DO $$
DECLARE r jsonb;
BEGIN
 r:=public.quiz_admin_nickname_ip_report();
 IF NOT EXISTS(SELECT 1 FROM jsonb_array_elements(r->'shared_sources') x
   WHERE x->>'ip'='198.51.100.42' AND (x->>'nickname_sessions')::integer=2)
 THEN RAISE EXCEPTION 'Shared IP aggregation missing two distinct players'; END IF;
END $$;
RESET ROLE;
DO $$
BEGIN
 IF NOT EXISTS(SELECT 1 FROM public.quiz_public_leaderboard()
 WHERE nickname LIKE '%（暱名）' AND correct_attempts=1)
 THEN RAISE EXCEPTION 'Nickname player missing from combined board'; END IF;
END $$;
