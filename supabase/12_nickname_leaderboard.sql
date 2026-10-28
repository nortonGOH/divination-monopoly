-- v12: privacy-first nicknames + opt-in leaderboard.
-- REQUIREMENT: run v8 player-statistics migration first (quiz_player_state.total_attempts/correct_attempts).
-- Existing login identifiers stay in auth.users; never publish email addresses in rankings.
BEGIN;

CREATE TABLE IF NOT EXISTS public.quiz_player_profiles (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  nickname text NOT NULL CHECK (
    char_length(nickname) BETWEEN 2 AND 18
    AND nickname ~ '^[[:alnum:]_一-龥-]{2,18}$'
  ),
  leaderboard_opt_in boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS quiz_player_profiles_nickname_unique
  ON public.quiz_player_profiles (lower(nickname));
ALTER TABLE public.quiz_player_profiles ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.quiz_player_profiles FROM PUBLIC, anon, authenticated;
-- The functions below are the *only* authorized client read/write routes for profiles.

CREATE OR REPLACE FUNCTION public.quiz_my_profile()
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
DECLARE v_uid uuid := auth.uid(); v_row public.quiz_player_profiles%rowtype;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Login required' USING ERRCODE='28000'; END IF;
  SELECT * INTO v_row FROM public.quiz_player_profiles WHERE user_id=v_uid;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('nickname',null,'leaderboard_opt_in',false);
  END IF;
  RETURN jsonb_build_object('nickname',v_row.nickname,'leaderboard_opt_in',v_row.leaderboard_opt_in);
END;
$$;
REVOKE ALL ON FUNCTION public.quiz_my_profile() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.quiz_my_profile() TO authenticated;

CREATE OR REPLACE FUNCTION public.quiz_set_player_profile(
  p_nickname text, p_leaderboard_opt_in boolean DEFAULT false
)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
DECLARE v_uid uuid := auth.uid(); v_name text := btrim(p_nickname);
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Login required' USING ERRCODE='28000'; END IF;
  IF v_name IS NULL OR v_name !~ '^[[:alnum:]_一-龥-]{2,18}$' THEN
    RAISE EXCEPTION 'Nickname must be 2-18 letters, numbers, underscores, or hyphens' USING ERRCODE='22023';
  END IF;
  INSERT INTO public.quiz_player_profiles(user_id,nickname,leaderboard_opt_in)
  VALUES(v_uid,v_name,coalesce(p_leaderboard_opt_in,false))
  ON CONFLICT (user_id) DO UPDATE SET
    nickname=excluded.nickname,
    leaderboard_opt_in=excluded.leaderboard_opt_in,
    updated_at=now();
  RETURN jsonb_build_object('nickname',v_name,'leaderboard_opt_in',coalesce(p_leaderboard_opt_in,false));
EXCEPTION WHEN unique_violation THEN
  RAISE EXCEPTION 'Nickname already taken; please choose another' USING ERRCODE='23505';
END;
$$;
REVOKE ALL ON FUNCTION public.quiz_set_player_profile(text,boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.quiz_set_player_profile(text,boolean) TO authenticated;

-- At registration, retain the submitted nickname even while email confirmation is pending.
-- A conflicting name is skipped instead of failing the Auth signup; user can choose a new one after login.
CREATE OR REPLACE FUNCTION public.quiz_create_player_profile_on_signup()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
DECLARE v_name text := btrim(new.raw_user_meta_data ->> 'nickname');
BEGIN
  IF v_name IS NOT NULL AND v_name ~ '^[[:alnum:]_一-龥-]{2,18}$' THEN
    INSERT INTO public.quiz_player_profiles(user_id,nickname,leaderboard_opt_in)
    VALUES(new.id,v_name,coalesce((new.raw_user_meta_data ->> 'leaderboard_opt_in')::boolean,false))
    ON CONFLICT DO NOTHING;
  END IF;
  RETURN new;
END;
$$;
DROP TRIGGER IF EXISTS quiz_player_profile_signup ON auth.users;
CREATE TRIGGER quiz_player_profile_signup
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.quiz_create_player_profile_on_signup();

-- Public view is deliberately a function with *only* opted-in nickname/score fields.
-- It never emits user_id, email, or contact details.
CREATE OR REPLACE FUNCTION public.quiz_public_leaderboard()
RETURNS TABLE("position" bigint, nickname text, total_attempts bigint,
              correct_attempts bigint, success_rate numeric)
LANGUAGE sql SECURITY DEFINER SET search_path = ''
AS $$
  SELECT row_number() OVER (
      ORDER BY s.correct_attempts DESC,
        s.correct_attempts::numeric / nullif(s.total_attempts,0) DESC,
        s.total_attempts DESC, p.nickname ASC
    ) AS "position",
    p.nickname, s.total_attempts, s.correct_attempts,
    round(s.correct_attempts::numeric * 100/nullif(s.total_attempts,0),1) AS success_rate
  FROM public.quiz_player_profiles p
  JOIN public.quiz_player_state s ON s.user_id=p.user_id
  WHERE p.leaderboard_opt_in=true AND s.total_attempts>0
  ORDER BY "position" LIMIT 50;
$$;
REVOKE ALL ON FUNCTION public.quiz_public_leaderboard() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.quiz_public_leaderboard() TO anon, authenticated;

-- Admin statistics also use nicknames, never emails.
CREATE OR REPLACE FUNCTION public.quiz_admin_challenger_stats_nicknames()
RETURNS TABLE(nickname text,total_attempts bigint,correct_attempts bigint,
              wrong_attempts bigint,success_rate numeric)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
BEGIN
  IF auth.uid() IS NULL OR NOT EXISTS(
    SELECT 1 FROM public.quiz_admins WHERE user_id=auth.uid()
  ) THEN RAISE EXCEPTION 'Administrator privileges required' USING ERRCODE='42501'; END IF;
  RETURN QUERY
  SELECT coalesce(p.nickname, '會員-'||substr(md5(s.user_id::text),1,8))::text,
    s.total_attempts, s.correct_attempts, s.total_attempts-s.correct_attempts,
    CASE WHEN s.total_attempts=0 THEN 0::numeric
      ELSE round(s.correct_attempts::numeric*100/s.total_attempts,1) END
  FROM public.quiz_player_state s
  LEFT JOIN public.quiz_player_profiles p ON p.user_id=s.user_id
  WHERE s.total_attempts>0
  ORDER BY s.correct_attempts DESC,s.total_attempts DESC;
END;
$$;
REVOKE ALL ON FUNCTION public.quiz_admin_challenger_stats_nicknames() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.quiz_admin_challenger_stats_nicknames() TO authenticated;
COMMIT;

-- After installation: a new account should set a nickname and explicitly opt in.
-- No pre-existing account is automatically listed publicly.
SELECT to_regclass('public.quiz_player_profiles') AS profile_table;
