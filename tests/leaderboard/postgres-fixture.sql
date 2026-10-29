-- Isolated PostgreSQL fixture only. Never run against live Auth accounts.
CREATE ROLE anon NOLOGIN;
CREATE ROLE authenticated NOLOGIN;
CREATE SCHEMA auth;
GRANT USAGE ON SCHEMA public TO anon,authenticated;
CREATE TABLE auth.users (id uuid PRIMARY KEY, email text);
CREATE TABLE public.quiz_player_profiles (
 user_id uuid PRIMARY KEY REFERENCES auth.users(id),nickname text NOT NULL UNIQUE,
 leaderboard_opt_in boolean NOT NULL DEFAULT false
);
CREATE TABLE public.quiz_player_state (
 user_id uuid PRIMARY KEY REFERENCES auth.users(id),total_attempts bigint NOT NULL DEFAULT 0,
 correct_attempts bigint NOT NULL DEFAULT 0
);
INSERT INTO auth.users(id,email)
 SELECT ('00000000-0000-0000-0000-'||lpad(i::text,12,'0'))::uuid,'test-'||i||'@example.test'
 FROM generate_series(1,8) AS i;
INSERT INTO public.quiz_player_profiles(user_id,nickname,leaderboard_opt_in)
 SELECT id,'測試會員'||right(id::text,1),false FROM auth.users WHERE email<>'test-8@example.test';
INSERT INTO public.quiz_player_state(user_id,total_attempts,correct_attempts)
 SELECT id,CASE WHEN email='test-1@example.test' THEN 10
                WHEN email='test-2@example.test' THEN 8
                WHEN email='test-3@example.test' THEN 6
                WHEN email='test-4@example.test' THEN 4 ELSE 0 END,
           CASE WHEN email='test-1@example.test' THEN 9
                WHEN email='test-2@example.test' THEN 7
                WHEN email='test-3@example.test' THEN 4
                WHEN email='test-4@example.test' THEN 2 ELSE 0 END
 FROM auth.users;
