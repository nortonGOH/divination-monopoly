-- Apply ONLY after the new collector Edge Function and updated pages are live.
-- This prevents unauthenticated requests from bypassing monitored page-view accounting.
REVOKE EXECUTE ON FUNCTION public.quiz_track_page_view(text,text) FROM anon,authenticated;
GRANT EXECUTE ON FUNCTION public.quiz_track_page_view(text,text) TO service_role;
