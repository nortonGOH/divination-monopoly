\set ON_ERROR_STOP on
CREATE ROLE anon NOLOGIN;
CREATE ROLE authenticated NOLOGIN;
CREATE SCHEMA auth;
CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$
  SELECT nullif(current_setting('request.jwt.claim.sub',true),'')::uuid;
$$;
CREATE TABLE auth.users(id uuid PRIMARY KEY);
CREATE TABLE public.quiz_questions(
 id text PRIMARY KEY, prompt text NOT NULL,
 answer integer NOT NULL, explanation text NOT NULL DEFAULT ''
);
CREATE TABLE public.quiz_player_answered_questions(
 user_id uuid NOT NULL REFERENCES auth.users(id),
 question_id text NOT NULL,
 correct boolean NOT NULL,
 answered_at timestamptz NOT NULL DEFAULT now(),
 attempt_count integer NOT NULL DEFAULT 1,
 PRIMARY KEY(user_id,question_id)
);
INSERT INTO auth.users(id) VALUES
 ('11111111-1111-4111-8111-111111111111'),
 ('22222222-2222-4222-8222-222222222222');
INSERT INTO public.quiz_questions(id,prompt,answer,explanation) VALUES
 ('q1','Prompt 1',1,'verified one'),
 ('q2','Prompt 2',0,'verified two'),
 ('q3','Prompt 3',2,'verified three'),
 ('q4','Prompt 4',3,'verified four'),
 ('q5','Prompt 5',2,'verified five');
GRANT USAGE ON SCHEMA auth, public TO anon, authenticated;
GRANT EXECUTE ON FUNCTION auth.uid() TO anon, authenticated;
-- The learning tables themselves must never be directly writable by clients.
