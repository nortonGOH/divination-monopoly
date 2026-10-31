-- Run in disposable PostgreSQL 17 (never the production Supabase database).
CREATE SCHEMA auth;
CREATE ROLE anon NOLOGIN;
CREATE ROLE authenticated NOLOGIN;
CREATE ROLE service_role NOLOGIN BYPASSRLS;
GRANT USAGE ON SCHEMA public TO anon,authenticated,service_role;
CREATE TABLE auth.users(id uuid PRIMARY KEY);
CREATE TABLE public.quiz_admins(user_id uuid PRIMARY KEY);
CREATE OR REPLACE FUNCTION auth.uid() RETURNS uuid
 LANGUAGE sql STABLE AS $$
 SELECT nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
CREATE OR REPLACE FUNCTION auth.jwt() RETURNS jsonb
 LANGUAGE sql STABLE AS $$
 SELECT coalesce(nullif(current_setting('request.jwt.claims',true),''),'{}')::jsonb $$;
INSERT INTO auth.users VALUES('00000000-0000-0000-0000-000000000001');
INSERT INTO public.quiz_admins VALUES('00000000-0000-0000-0000-000000000001');
\i database/ip-monitor-schema.sql
\i database/ip-monitor-admin.sql
\i database/ip-monitor-report.sql
\i database/ip-monitor-intake.sql

-- Non-admin users must never invoke management actions.
SET ROLE authenticated;
SELECT set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000002',false);
DO $$
BEGIN
 PERFORM public.quiz_admin_ip_monitor_action('203.0.113.42','block',60,'Unauthorized request');
 RAISE EXCEPTION 'non-admin was allowed to block IP';
EXCEPTION WHEN SQLSTATE '42501' THEN NULL;
END $$;
DO $$
BEGIN
 PERFORM public.quiz_admin_ip_monitor_report();
 RAISE EXCEPTION 'non-admin was allowed to read IP report';
EXCEPTION WHEN SQLSTATE '42501' THEN NULL;
END $$;

-- Admin can block; short duration or CIDR range must be rejected.
SELECT set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000001',false);
SELECT public.quiz_admin_ip_monitor_action('203.0.113.42','block',60,'Integration test');
DO $$
BEGIN
 PERFORM public.quiz_admin_ip_monitor_action('203.0.113.0/24','block',60,'Disallow range');
 RAISE EXCEPTION 'CIDR range unexpectedly accepted';
EXCEPTION WHEN SQLSTATE '22023' THEN NULL;
END $$;
SET ROLE service_role;
DO $$
DECLARE r jsonb;
BEGIN
 r:=public.quiz_ip_monitor_record('203.0.113.42','trial','home','unknown','answer');
 IF r->>'blocked' IS DISTINCT FROM 'true' THEN RAISE EXCEPTION 'blocked IP passed gate'; END IF;
END $$;
RESET ROLE;

-- Alerts are advisory, not automatic bans; 80 clicks should trigger a five-minute alert.
INSERT INTO public.quiz_ip_monitor_events(source_ip,kind,page,source,target)
SELECT '203.0.113.44'::inet,'click','home','direct','button'
FROM generate_series(1,80);
SET ROLE authenticated;
SELECT set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000001',false);
DO $$
DECLARE r jsonb;
BEGIN
 r:=public.quiz_admin_ip_monitor_report();
 IF NOT EXISTS (SELECT 1 FROM jsonb_array_elements(r->'top_ips') x
  WHERE x->>'ip'='203.0.113.44' AND x->>'alert'='true')
 THEN RAISE EXCEPTION '80 clicks did not trigger alert'; END IF;
END $$;
SELECT public.quiz_admin_ip_monitor_action('203.0.113.42','unblock',60,'Test unblock');
SET ROLE service_role;
DO $$
DECLARE r jsonb;
BEGIN
 r:=public.quiz_ip_monitor_record('203.0.113.42','trial','home','unknown','answer');
 IF r->>'blocked' IS DISTINCT FROM 'false' THEN RAISE EXCEPTION 'IP remained blocked'; END IF;
END $$;
RESET ROLE;
DO $$
BEGIN
 IF (SELECT count(*) FROM public.quiz_ip_monitor_audit
    WHERE source_ip='203.0.113.42')<>2
 THEN RAISE EXCEPTION 'block/unblock audit missing'; END IF;
END $$;
