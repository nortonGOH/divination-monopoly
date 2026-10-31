-- Public top five combines registered members with nickname beginner players.
-- Output contract matches the existing leaderboard RPC. No raw token, email, or IP.
CREATE OR REPLACE FUNCTION public.quiz_public_leaderboard()
RETURNS TABLE("position" bigint,nickname text,total_attempts bigint,
 correct_attempts bigint,success_rate numeric)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=''
AS $$
 WITH contenders AS (
  SELECT COALESCE(p.nickname,'尚未設定暱稱')::text AS name,
   COALESCE(s.total_attempts,0)::bigint AS attempts,
   COALESCE(s.correct_attempts,0)::bigint AS correct,
   ('member:'||u.id::text) AS tie_breaker
  FROM auth.users u
  LEFT JOIN public.quiz_player_profiles p ON p.user_id=u.id
  LEFT JOIN public.quiz_player_state s ON s.user_id=u.id
  UNION ALL
  SELECT (p.nickname||'（暱名）')::text,p.total_attempts,p.correct_attempts,
   ('nickname:'||p.token_digest)
  FROM public.quiz_nickname_players p
  WHERE p.total_attempts>0
 ), ranked AS (
  SELECT row_number() OVER (
    ORDER BY correct DESC,
      CASE WHEN attempts>0 THEN correct::numeric/attempts ELSE 0 END DESC,
      attempts DESC,name ASC,tie_breaker ASC
  ) AS place,name,attempts,correct
  FROM contenders
 )
 SELECT r.place,r.name,r.attempts,r.correct,
  CASE WHEN r.attempts>0 THEN round(100.0*r.correct/r.attempts,1)
  ELSE 0::numeric END
 FROM ranked r WHERE r.place<=5 ORDER BY r.place;
$$;
REVOKE ALL ON FUNCTION public.quiz_public_leaderboard() FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.quiz_public_leaderboard() TO anon,authenticated;
