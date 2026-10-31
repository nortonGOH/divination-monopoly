-- Server-only intake: never accept an IP field from the public browser.
CREATE TABLE IF NOT EXISTS public.quiz_ip_monitor_housekeeping(
 id boolean PRIMARY KEY DEFAULT true CHECK(id),
 last_purged_at timestamptz NOT NULL DEFAULT '2000-01-01'
);
INSERT INTO public.quiz_ip_monitor_housekeeping(id) VALUES(true) ON CONFLICT DO NOTHING;
ALTER TABLE public.quiz_ip_monitor_housekeeping ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.quiz_ip_monitor_housekeeping FROM PUBLIC,anon,authenticated;
GRANT SELECT,UPDATE ON public.quiz_ip_monitor_housekeeping TO service_role;

CREATE OR REPLACE FUNCTION public.quiz_ip_monitor_record(
 p_ip inet,p_kind text,p_page text,p_source text,p_target text DEFAULT '')
RETURNS jsonb LANGUAGE plpgsql VOLATILE SECURITY INVOKER SET search_path=''
AS $$
DECLARE v_blocked boolean; v_n integer; v_purge boolean;
BEGIN
 IF p_ip IS NULL OR masklen(p_ip)<>CASE WHEN family(p_ip)=4 THEN 32 ELSE 128 END
 OR p_kind IS NULL OR p_kind NOT IN ('view','click','trial')
 OR p_page IS NULL OR p_page NOT IN ('home','atlas')
 OR p_source IS NULL OR p_source NOT IN ('direct','search','social','referral','internal','unknown')
 OR p_target IS NULL OR length(p_target)>80 OR p_target !~ '^[A-Za-z0-9_:.-]*$'
 THEN RAISE EXCEPTION 'Invalid monitor input' USING errcode='22023'; END IF;
 SELECT EXISTS(SELECT 1 FROM public.quiz_ip_monitor_blocks
  WHERE source_ip=p_ip AND expires_at>now()) INTO v_blocked;
 SELECT count(*) INTO v_n FROM public.quiz_ip_monitor_events
 WHERE source_ip=p_ip AND occurred_at>=now()-interval '1 minute';
 IF v_n>=150 THEN RETURN jsonb_build_object(
   'blocked',v_blocked,'rate_limited',true,'recorded',false); END IF;
 INSERT INTO public.quiz_ip_monitor_events(source_ip,kind,page,source,target,denied)
 VALUES(p_ip,p_kind,p_page,p_source,p_target,v_blocked);
 UPDATE public.quiz_ip_monitor_housekeeping SET last_purged_at=now()
 WHERE id=true AND last_purged_at<now()-interval '1 day'
 RETURNING true INTO v_purge;
 IF coalesce(v_purge,false) THEN
  DELETE FROM public.quiz_ip_monitor_events WHERE occurred_at<now()-interval '30 days';
 END IF;
 RETURN jsonb_build_object('blocked',v_blocked,'rate_limited',false,'recorded',true);
END; $$;
REVOKE ALL ON FUNCTION public.quiz_ip_monitor_record(inet,text,text,text,text)
 FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.quiz_ip_monitor_record(inet,text,text,text,text)
 TO service_role;
