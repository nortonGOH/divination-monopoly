-- Staged migration for review. Do not run against production before tests.
CREATE TABLE IF NOT EXISTS public.quiz_registration_mode (id boolean PRIMARY KEY DEFAULT true CHECK (id), email_signup_enabled boolean NOT NULL DEFAULT true, updated_at timestamptz NOT NULL DEFAULT now());
INSERT INTO public.quiz_registration_mode(id,email_signup_enabled) VALUES(true,true) ON CONFLICT(id) DO NOTHING;
ALTER TABLE public.quiz_registration_mode ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.quiz_registration_mode FROM public,anon,authenticated;
