-- Staged migration for review. Do not run against production before tests.
CREATE TABLE IF NOT EXISTS public.quiz_registration_mode (id boolean PRIMARY KEY DEFAULT true CHECK (id), email_signup_enabled boolean NOT NULL DEFAULT true, updated_at timestamptz NOT NULL DEFAULT now());
INSERT INTO public.quiz_registration_mode(id,email_signup_enabled) VALUES(true,true) ON CONFLICT(id) DO NOTHING;
ALTER TABLE public.quiz_registration_mode ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.quiz_registration_mode FROM public,anon,authenticated;

CREATE OR REPLACE FUNCTION public.quiz_public_registration_mode()
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path=''
AS $$
 SELECT jsonb_build_object('email_signup_enabled',email_signup_enabled)
 FROM public.quiz_registration_mode WHERE id=true;
$$;
REVOKE ALL ON FUNCTION public.quiz_public_registration_mode() FROM public,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.quiz_public_registration_mode() TO anon,authenticated;

CREATE OR REPLACE FUNCTION public.quiz_admin_set_registration_mode(p_enabled boolean)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=''
AS $$
BEGIN
 IF auth.uid() IS NULL OR NOT EXISTS
    (SELECT 1 FROM public.quiz_admins WHERE user_id=auth.uid())
 THEN RAISE EXCEPTION 'Administrator required' USING errcode='42501'; END IF;
 IF p_enabled IS NULL THEN RAISE EXCEPTION 'Invalid value' USING errcode='22023'; END IF;
 UPDATE public.quiz_registration_mode
 SET email_signup_enabled=p_enabled,updated_at=now() WHERE id=true;
 RETURN jsonb_build_object('email_signup_enabled',p_enabled);
END; $$;
REVOKE ALL ON FUNCTION public.quiz_admin_set_registration_mode(boolean) FROM public,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.quiz_admin_set_registration_mode(boolean) TO authenticated;
