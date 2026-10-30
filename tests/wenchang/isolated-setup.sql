\set ON_ERROR_STOP on
CREATE ROLE anon NOLOGIN;
CREATE ROLE authenticated NOLOGIN;
CREATE SCHEMA auth;
CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$
 SELECT nullif(current_setting('request.jwt.claim.sub',true),'')::uuid;
$$;
CREATE TABLE auth.users(id uuid PRIMARY KEY, email text NOT NULL);
CREATE TABLE public.quiz_admins(user_id uuid PRIMARY KEY REFERENCES auth.users(id));
CREATE TABLE public.quiz_questions(id text PRIMARY KEY,answer integer NOT NULL,explanation text NOT NULL DEFAULT '');
CREATE TABLE public.quiz_player_state(
 user_id uuid PRIMARY KEY REFERENCES auth.users(id),
 correct_attempts bigint NOT NULL DEFAULT 0
);
CREATE TABLE public.quiz_player_answered_questions(
 user_id uuid NOT NULL REFERENCES auth.users(id),question_id text NOT NULL REFERENCES public.quiz_questions(id),
 correct boolean NOT NULL,PRIMARY KEY(user_id,question_id)
);
CREATE TABLE public.quiz_wenchang_unlocked(
 user_id uuid NOT NULL REFERENCES auth.users(id), question_id text NOT NULL REFERENCES public.quiz_questions(id),
 unlocked_at timestamptz NOT NULL DEFAULT now(),PRIMARY KEY(user_id,question_id)
);
CREATE TABLE public.quiz_wenchang_wallet(
 user_id uuid PRIMARY KEY REFERENCES auth.users(id), credits integer NOT NULL DEFAULT 3,
 last_refill_at timestamptz NOT NULL DEFAULT now()
);
CREATE FUNCTION public.quiz_guestbook_grant_wenchang(p_id uuid,p_amount integer)
RETURNS jsonb LANGUAGE sql AS $$ SELECT '{}'::jsonb $$;
CREATE FUNCTION public.quiz_admin_reset_wenchang(p_user_id uuid)
RETURNS jsonb LANGUAGE sql AS $$ SELECT '{}'::jsonb $$;
INSERT INTO auth.users(id,email) VALUES
 ('11111111-1111-4111-8111-111111111111','member1@example.test'),
 ('22222222-2222-4222-8222-222222222222','member2@example.test'),
 ('33333333-3333-4333-8333-333333333333','nortonwu@gmail.com');
INSERT INTO public.quiz_admins(user_id) VALUES ('33333333-3333-4333-8333-333333333333');
INSERT INTO public.quiz_questions(id,answer,explanation) VALUES
 ('q1',1,'verified 1'),('q2',2,'verified 2'),('q3',3,'verified 3'),
 ('q4',0,'verified 4'),('q5',1,'verified 5'),('q6',2,'verified 6');
INSERT INTO public.quiz_player_state(user_id,correct_attempts) VALUES
 ('11111111-1111-4111-8111-111111111111',2),
 ('22222222-2222-4222-8222-222222222222',0),
 ('33333333-3333-4333-8333-333333333333',0);
INSERT INTO public.quiz_player_answered_questions(user_id,question_id,correct) VALUES
 ('11111111-1111-4111-8111-111111111111','q1',false),
 ('11111111-1111-4111-8111-111111111111','q2',true),
 ('11111111-1111-4111-8111-111111111111','q3',false),
 ('11111111-1111-4111-8111-111111111111','q4',false),
 ('11111111-1111-4111-8111-111111111111','q5',false),
 ('11111111-1111-4111-8111-111111111111','q6',true),
 ('22222222-2222-4222-8222-222222222222','q1',false),
 ('33333333-3333-4333-8333-333333333333','q5',false);
-- q3 was unlocked under the retired system, and must remain free to revisit.
INSERT INTO public.quiz_wenchang_unlocked(user_id,question_id)
 VALUES ('11111111-1111-4111-8111-111111111111','q3');
INSERT INTO public.quiz_wenchang_wallet(user_id,credits)
 VALUES ('11111111-1111-4111-8111-111111111111',10);
GRANT USAGE ON SCHEMA auth,public TO anon,authenticated;
GRANT EXECUTE ON FUNCTION auth.uid() TO anon,authenticated;
