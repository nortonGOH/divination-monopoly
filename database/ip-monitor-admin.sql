-- Administrator-only IP reports and block/unblock; thresholds are alerts, not automatic bans.
CREATE TABLE IF NOT EXISTS public.quiz_ip_monitor_audit(
 id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
 source_ip inet NOT NULL,
 action text NOT NULL CHECK(action IN ('block','unblock')),
 reason text NOT NULL,
 actor uuid NOT NULL REFERENCES auth.users(id),
 occurred_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.quiz_ip_monitor_audit ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.quiz_ip_monitor_audit FROM public,anon,authenticated;

CREATE OR REPLACE FUNCTION public.quiz_admin_ip_monitor_action(
 p_ip inet,p_action text,p_minutes integer DEFAULT 60,p_reason text DEFAULT 'Manual moderation')
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=''
AS $$
DECLARE v_admin uuid:=auth.uid(); v_reason text:=btrim(p_reason);
BEGIN
 IF v_admin IS NULL OR coalesce(auth.jwt()->>'is_anonymous','false')='true'
 OR NOT EXISTS(SELECT 1 FROM public.quiz_admins WHERE user_id=v_admin)
 THEN RAISE EXCEPTION 'Administrator required' USING errcode='42501'; END IF;
 IF p_ip IS NULL OR masklen(p_ip)<>CASE WHEN family(p_ip)=4 THEN 32 ELSE 128 END
 OR p_action NOT IN ('block','unblock') OR v_reason IS NULL
 OR length(v_reason) NOT BETWEEN 2 AND 200
 THEN RAISE EXCEPTION 'Invalid IP/action/reason' USING errcode='22023'; END IF;
 IF p_action='block' THEN
  IF p_minutes NOT IN (60,1440,10080) THEN
   RAISE EXCEPTION 'Invalid duration' USING errcode='22023'; END IF;
  INSERT INTO public.quiz_ip_monitor_blocks(source_ip,reason,expires_at,blocked_by)
  VALUES(p_ip,v_reason,now()+make_interval(mins=>p_minutes),v_admin)
  ON CONFLICT(source_ip) DO UPDATE SET reason=excluded.reason,
    expires_at=excluded.expires_at,blocked_at=now(),blocked_by=v_admin;
 ELSE
  DELETE FROM public.quiz_ip_monitor_blocks WHERE source_ip=p_ip;
 END IF;
 INSERT INTO public.quiz_ip_monitor_audit(source_ip,action,reason,actor)
 VALUES(p_ip,p_action,v_reason,v_admin);
 RETURN jsonb_build_object('ok',true,'action',p_action,'ip',host(p_ip));
END; $$;
REVOKE ALL ON FUNCTION public.quiz_admin_ip_monitor_action(inet,text,integer,text)
 FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.quiz_admin_ip_monitor_action(inet,text,integer,text)
 TO authenticated;
