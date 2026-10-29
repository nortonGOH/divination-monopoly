-- Execute only against the ephemeral PostgreSQL service in CI.
CREATE ROLE anon NOLOGIN;
CREATE ROLE authenticated NOLOGIN;
CREATE SCHEMA auth;
CREATE TABLE auth.users(id uuid PRIMARY KEY, email text);
CREATE OR REPLACE FUNCTION auth.uid() RETURNS uuid
LANGUAGE sql STABLE AS $$
 SELECT NULLIF(current_setting('request.jwt.claim.sub',true),'')::uuid
$$;
GRANT USAGE ON SCHEMA auth,public TO anon,authenticated;
GRANT EXECUTE ON FUNCTION auth.uid() TO PUBLIC;
CREATE TABLE public.quiz_admins(user_id uuid PRIMARY KEY REFERENCES auth.users(id));
CREATE TABLE public.quiz_player_profiles(
 user_id uuid PRIMARY KEY REFERENCES auth.users(id),
 nickname text NOT NULL,
 leaderboard_opt_in boolean DEFAULT false
);
CREATE TABLE public.quiz_wenchang_wallet(
 user_id uuid PRIMARY KEY REFERENCES auth.users(id),
 credits integer NOT NULL DEFAULT 3 CHECK(credits BETWEEN 0 AND 10),
 last_refill_at timestamptz NOT NULL DEFAULT now()
);
INSERT INTO auth.users VALUES
 ('00000000-0000-0000-0000-000000000001','a@example.test'),
 ('00000000-0000-0000-0000-000000000002','b@example.test'),
 ('00000000-0000-0000-0000-000000000003','admin@example.test');
INSERT INTO public.quiz_player_profiles(user_id,nickname) VALUES
 ('00000000-0000-0000-0000-000000000001','會員甲'),
 ('00000000-0000-0000-0000-000000000002','會員乙'),
 ('00000000-0000-0000-0000-000000000003','管理員');
INSERT INTO public.quiz_admins VALUES ('00000000-0000-0000-0000-000000000003');
