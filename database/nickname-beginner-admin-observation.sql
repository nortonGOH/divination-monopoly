-- Private administrator view: shared IPs indicate traffic origin, not personal identity.
CREATE OR REPLACE FUNCTION public.quiz_admin_nickname_ip_report()
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=''
AS $$
BEGIN
 IF auth.uid() IS NULL
 OR coalesce(auth.jwt()->>'is_anonymous','false')='true'
 OR NOT EXISTS(SELECT 1 FROM public.quiz_admins a WHERE a.user_id=auth.uid())
 THEN RAISE EXCEPTION 'Administrator required' USING ERRCODE='42501'; END IF;
 RETURN jsonb_build_object(
  'retention_days',30,
  'shared_sources',coalesce((
   SELECT jsonb_agg(to_jsonb(t) ORDER BY t.events DESC)
   FROM (SELECT host(a.source_ip) AS ip,count(*) AS events,
     count(DISTINCT a.token_digest) AS nickname_sessions,
     max(a.occurred_at) AS last_seen
    FROM public.quiz_nickname_ip_activity a
    WHERE a.occurred_at>=now()-interval '30 days'
    GROUP BY a.source_ip ORDER BY events DESC LIMIT 100) t
  ),'[]'::jsonb),
  'recent',coalesce((
   SELECT jsonb_agg(to_jsonb(t) ORDER BY t.occurred_at DESC)
   FROM (SELECT a.occurred_at,host(a.source_ip) AS ip,
     p.nickname,a.action
    FROM public.quiz_nickname_ip_activity a
    JOIN public.quiz_nickname_players p USING(token_digest)
    ORDER BY a.occurred_at DESC LIMIT 100) t
  ),'[]'::jsonb));
END; $$;
REVOKE ALL ON FUNCTION public.quiz_admin_nickname_ip_report() FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.quiz_admin_nickname_ip_report() TO authenticated;
