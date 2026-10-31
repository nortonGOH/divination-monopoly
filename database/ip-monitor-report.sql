-- Administrator-only observation report. Warnings never block visitors.
CREATE OR REPLACE FUNCTION public.quiz_admin_ip_monitor_report()
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=''
AS $$
BEGIN
 IF auth.uid() IS NULL OR coalesce(auth.jwt()->>'is_anonymous','false')='true'
    OR NOT EXISTS(SELECT 1 FROM public.quiz_admins WHERE user_id=auth.uid())
 THEN RAISE EXCEPTION 'Administrator required' USING errcode='42501'; END IF;
 RETURN jsonb_build_object(
 'timezone','Asia/Taipei','retention_days',30,
 'threshold_5m_total',80,'threshold_5m_clicks',40,
 'top_ips',coalesce((SELECT jsonb_agg(to_jsonb(t) ORDER BY t.events24h DESC)
 FROM (SELECT host(e.source_ip) AS ip,count(*) AS events24h,
 count(*) FILTER (WHERE e.kind='view') AS views24h,
 count(*) FILTER (WHERE e.occurred_at>=now()-interval '5 minutes') AS events5m,
 count(*) FILTER (WHERE e.kind='click' AND e.occurred_at>=now()-interval '5 minutes') AS clicks5m,
 (count(*) FILTER (WHERE e.occurred_at>=now()-interval '5 minutes')>=80
 OR count(*) FILTER (WHERE e.kind='click' AND e.occurred_at>=now()-interval '5 minutes')>=40) AS alert,
 max(e.occurred_at) AS last_seen
 FROM public.quiz_ip_monitor_events e
 WHERE e.occurred_at>=now()-interval '24 hours'
 GROUP BY e.source_ip ORDER BY events24h DESC LIMIT 50) t),'[]'::jsonb),
 'recent',coalesce((SELECT jsonb_agg(to_jsonb(r) ORDER BY r.occurred_at DESC)
 FROM (SELECT occurred_at,host(source_ip) AS ip,kind,page,source,target
 FROM public.quiz_ip_monitor_events ORDER BY occurred_at DESC LIMIT 100) r),'[]'::jsonb));
END; $$;
REVOKE ALL ON FUNCTION public.quiz_admin_ip_monitor_report()
 FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.quiz_admin_ip_monitor_report() TO authenticated;
