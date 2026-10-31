-- Disposable PostgreSQL 17: observation only; no action may block visitors.
CREATE SCHEMA auth;
CREATE ROLE anon NOLOGIN;
CREATE ROLE authenticated NOLOGIN;
CREATE ROLE service_role NOLOGIN BYPASSRLS;
GRANT USAGE ON SCHEMA public TO anon,authenticated,service_role;
CREATE TABLE auth.users(id uuid PRIMARY KEY);
CREATE TABLE public.quiz_admins(user_id uuid PRIMARY KEY);
CREATE OR REPLACE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE
 AS $$ SELECT nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
CREATE OR REPLACE FUNCTION auth.jwt() RETURNS jsonb LANGUAGE sql STABLE
 AS $$ SELECT coalesce(nullif(current_setting('request.jwt.claims',true),''),'{}')::jsonb $$;
CREATE OR REPLACE FUNCTION public.quiz_track_page_view(p_page text,p_source text)
RETURNS text LANGUAGE sql AS 'SELECT p_page';
REVOKE ALL ON FUNCTION public.quiz_track_page_view(text,text) FROM PUBLIC,anon,authenticated;
INSERT INTO auth.users VALUES('00000000-0000-0000-0000-000000000001');
INSERT INTO public.quiz_admins VALUES('00000000-0000-0000-0000-000000000001');
\i database/ip-monitor-schema.sql
\i database/ip-monitor-report.sql
\i database/ip-monitor-intake.sql

-- Anonymous users cannot query the report or read stored personal IP data.
SET ROLE anon;
DO $$
BEGIN
 PERFORM public.quiz_admin_ip_monitor_report();
 RAISE EXCEPTION 'anonymous was allowed to view report';
EXCEPTION WHEN SQLSTATE '42501' THEN NULL;
END $$;
RESET ROLE;
SET ROLE authenticated;
SELECT set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000002',false);
DO $$
BEGIN
 PERFORM public.quiz_admin_ip_monitor_report();
 RAISE EXCEPTION 'non-admin was allowed to view IP report';
EXCEPTION WHEN SQLSTATE '42501' THEN NULL;
END $$;
RESET ROLE;

-- Only service-role writes telemetry, and none of these operations restrict access.
SET ROLE service_role;
DO $$
DECLARE r jsonb;
BEGIN
 r:=public.quiz_ip_monitor_record('203.0.113.42','click','home','direct','spinBtn');
 IF r->>'recorded' IS DISTINCT FROM 'true' THEN
  RAISE EXCEPTION 'IP observation failed'; END IF;
 IF r ? 'blocked' THEN RAISE EXCEPTION 'access restriction surfaced in monitoring'; END IF;
END $$;
RESET ROLE;
INSERT INTO public.quiz_ip_monitor_events(source_ip,kind,page,source,target)
SELECT '203.0.113.44'::inet,'click','home','direct','button' FROM generate_series(1,80);
SET ROLE authenticated;
SELECT set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000001',false);
DO $$
DECLARE r jsonb;
BEGIN
 r:=public.quiz_admin_ip_monitor_report();
 IF NOT EXISTS(
 SELECT 1 FROM jsonb_array_elements(r->'top_ips') x
 WHERE x->>'ip'='203.0.113.44' AND x->>'alert'='true')
 THEN RAISE EXCEPTION 'anomaly alert was not raised'; END IF;
 IF r ? 'blocks' THEN RAISE EXCEPTION 'blocklist leaked into observation-only report'; END IF;
END $$;
RESET ROLE;
DO $$
BEGIN
 IF to_regclass('public.quiz_ip_monitor_blocks') IS NOT NULL
 OR to_regprocedure('public.quiz_admin_ip_monitor_action(inet,text,integer,text)') IS NOT NULL
 THEN RAISE EXCEPTION 'old IP blocking objects remain'; END IF;
END $$;
