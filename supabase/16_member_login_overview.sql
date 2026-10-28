BEGIN;
CREATE TABLE IF NOT EXISTS public.quiz_member_login_events (
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  session_id uuid NOT NULL,
  logged_in_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY(user_id,session_id)
);
CREATE INDEX IF NOT EXISTS quiz_member_login_events_user_idx ON public.quiz_member_login_events(user_id,logged_in_at DESC);
ALTER TABLE public.quiz_member_login_events ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.quiz_member_login_events FROM PUBLIC,anon,authenticated;
CREATE OR REPLACE FUNCTION public.quiz_record_member_login()
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=''
AS $$
DECLARE uid uuid:=auth.uid(); sid uuid; added int:=0;
BEGIN
 IF uid IS NULL THEN RAISE EXCEPTION 'Please log in' USING ERRCODE='28000'; END IF;
 BEGIN sid:=(auth.jwt()->>'session_id')::uuid; EXCEPTION WHEN others THEN sid:=null; END;
 IF sid IS NULL THEN RAISE EXCEPTION 'Session not available' USING ERRCODE='22023'; END IF;
 INSERT INTO public.quiz_member_login_events(user_id,session_id) VALUES(uid,sid)
 ON CONFLICT (user_id,session_id) DO NOTHING;
 GET DIAGNOSTICS added=ROW_COUNT;
 RETURN jsonb_build_object('recorded',added=1);
END;
$$;
REVOKE ALL ON FUNCTION public.quiz_record_member_login() FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.quiz_record_member_login() TO authenticated;
CREATE OR REPLACE FUNCTION public.quiz_admin_member_overview()
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=''
AS $$
BEGIN
 IF auth.uid() IS NULL OR NOT EXISTS(SELECT 1 FROM public.quiz_admins WHERE user_id=auth.uid()) THEN
 RAISE EXCEPTION 'Administrator privileges required' USING ERRCODE='42501'; END IF;
 RETURN (
 SELECT COALESCE(jsonb_agg(jsonb_build_object(
   'user_id', u.id,'nickname',p.nickname,
   'login_count',coalesce(logs.login_count,0),
   'login_count_since','2026-10-28',
   'choice_count',coalesce(answers.choice_count,0),
   'choice_types',coalesce(answers.types,'[]'::jsonb),
   'open_count',0
 )),'[]'::jsonb)
 FROM auth.users u
 LEFT JOIN public.quiz_player_profiles p ON p.user_id=u.id
 LEFT JOIN LATERAL (SELECT count(*)::int login_count FROM public.quiz_member_login_events l WHERE l.user_id=u.id) logs ON true
 LEFT JOIN LATERAL (
 SELECT count(*)::int choice_count, coalesce(jsonb_agg(distinct coalesce(q.knowledge_type,'待分類')) FILTER (WHERE q.id IS NOT NULL),'[]'::jsonb) types
 FROM public.quiz_player_answered_questions a LEFT JOIN public.quiz_questions q ON q.id=a.question_id WHERE a.user_id=u.id
 ) answers ON true
 );
END;
$$;
REVOKE ALL ON FUNCTION public.quiz_admin_member_overview() FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.quiz_admin_member_overview() TO authenticated;
COMMIT;
NOTIFY pgrst,'reload schema';