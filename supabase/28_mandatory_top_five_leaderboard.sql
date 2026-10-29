-- Mandatory aggregate leaderboard. No emails, user IDs, or per-user private data are returned.
-- Keep legacy leaderboard_opt_in column solely for compatibility with older clients;
-- the setting no longer affects inclusion or the public output.
BEGIN;

CREATE OR REPLACE FUNCTION public.quiz_public_leaderboard()
RETURNS TABLE(
  "position" bigint,
  nickname text,
  total_attempts bigint,
  correct_attempts bigint,
  success_rate numeric
)
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT ranked."position",ranked.nickname,ranked.total_attempts,
         ranked.correct_attempts,ranked.success_rate
  FROM (
    SELECT
      row_number() OVER (
        ORDER BY COALESCE(s.correct_attempts,0) DESC,
          CASE WHEN COALESCE(s.total_attempts,0)>0
               THEN s.correct_attempts::numeric/s.total_attempts ELSE 0 END DESC,
          COALESCE(s.total_attempts,0) DESC,
          COALESCE(p.nickname,'尚未設定暱稱') ASC,
          u.id ASC
      ) AS "position",
      COALESCE(p.nickname,'尚未設定暱稱')::text AS nickname,
      COALESCE(s.total_attempts,0)::bigint AS total_attempts,
      COALESCE(s.correct_attempts,0)::bigint AS correct_attempts,
      CASE WHEN COALESCE(s.total_attempts,0)>0
           THEN round(100.0*s.correct_attempts/s.total_attempts,1)
           ELSE 0::numeric END AS success_rate
    FROM auth.users u
    LEFT JOIN public.quiz_player_profiles p ON p.user_id=u.id
    LEFT JOIN public.quiz_player_state s ON s.user_id=u.id
  ) ranked
  WHERE ranked."position"<=5
  ORDER BY ranked."position";
$$;

CREATE OR REPLACE FUNCTION public.quiz_public_registration_count()
RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path=''
AS $$
  SELECT jsonb_build_object('registered_count',count(*))
  FROM auth.users;
$$;

REVOKE ALL ON FUNCTION public.quiz_public_leaderboard() FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.quiz_public_registration_count() FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.quiz_public_leaderboard() TO anon,authenticated;
GRANT EXECUTE ON FUNCTION public.quiz_public_registration_count() TO anon,authenticated;
COMMIT;
