-- Never run against production. Executes only in CI ephemeral PostgreSQL.
CREATE ROLE anon NOLOGIN;
CREATE ROLE authenticated NOLOGIN;
CREATE ROLE service_role NOLOGIN BYPASSRLS;
CREATE TABLE public.quiz_questions(id text PRIMARY KEY,answer integer NOT NULL);
GRANT SELECT ON public.quiz_questions TO service_role;
INSERT INTO public.quiz_questions(id,answer) VALUES
 ('trial-q-1',1),('trial-q-2',2),('trial-q-3',1),
 ('trial-q-4',0),('trial-q-5',3),('trial-q-6',2);
