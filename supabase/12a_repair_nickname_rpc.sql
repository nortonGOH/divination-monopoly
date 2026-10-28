-- v12a: STANDALONE nickname repair for Supabase SQL Editor.
-- Unlike v12, this migration does not reference quiz_player_state, totals, or leaderboard.
-- It can be executed even if the v8 player statistics upgrade is incomplete.
-- Run as the project database owner in Supabase SQL Editor.
BEGIN;

CREATE TABLE IF NOT EXISTS public.quiz_player_profiles (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  nickname text NOT NULL,
  leaderboard_opt_in boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Safe for a profile table created by an earlier compatible version.
ALTER TABLE public.quiz_player_profiles
  ADD COLUMN IF NOT EXISTS leaderboard_opt_in boolean NOT NULL DEFAULT false;
ALTER TABLE public.quiz_player_profiles
  ADD COLUMN IF NOT EXISTS created_at timestamptz NOT NULL DEFAULT now();
ALTER TABLE public.quiz_player_profiles
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

CREATE UNIQUE INDEX IF NOT EXISTS quiz_player_profiles_nickname_unique
  ON public.quiz_player_profiles (lower(nickname));

ALTER TABLE public.quiz_player_profiles ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.quiz_player_profiles FROM PUBLIC, anon, authenticated;

-- Authenticated users may read their own nickname through this RPC only.
CREATE OR REPLACE FUNCTION public.quiz_my_profile()
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_profile public.quiz_player_profiles%rowtype;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Login required' USING ERRCODE='28000';
  END IF;
  SELECT * INTO v_profile FROM public.quiz_player_profiles WHERE user_id = v_uid;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('nickname',NULL,'leaderboard_opt_in',false);
  END IF;
  RETURN jsonb_build_object('nickname',v_profile.nickname,
                            'leaderboard_opt_in',v_profile.leaderboard_opt_in);
END;
$$;

REVOKE ALL ON FUNCTION public.quiz_my_profile() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.quiz_my_profile() TO authenticated;

-- Match the frontend JSON request exactly:
-- {"p_nickname":"...","p_leaderboard_opt_in":false}
CREATE OR REPLACE FUNCTION public.quiz_set_player_profile(
  p_nickname text,
  p_leaderboard_opt_in boolean DEFAULT false
)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_name text := btrim(p_nickname);
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Login required' USING ERRCODE='28000';
  END IF;
  IF v_name IS NULL OR v_name !~ '^[[:alnum:]_一-龥-]{2,18}$' THEN
    RAISE EXCEPTION 'Nickname must be 2-18 letters, numbers, underscores, or hyphens'
      USING ERRCODE='22023';
  END IF;

  INSERT INTO public.quiz_player_profiles(user_id,nickname,leaderboard_opt_in)
  VALUES (v_uid,v_name,coalesce(p_leaderboard_opt_in,false))
  ON CONFLICT (user_id) DO UPDATE SET
    nickname=excluded.nickname,
    leaderboard_opt_in=excluded.leaderboard_opt_in,
    updated_at=now();

  RETURN jsonb_build_object('nickname',v_name,
                            'leaderboard_opt_in',coalesce(p_leaderboard_opt_in,false));
EXCEPTION WHEN unique_violation THEN
  RAISE EXCEPTION 'Nickname already taken; choose another nickname'
    USING ERRCODE='23505';
END;
$$;

REVOKE ALL ON FUNCTION public.quiz_set_player_profile(text,boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.quiz_set_player_profile(text,boolean)
  TO authenticated;

-- Save signup metadata for future accounts. No email is published.
CREATE OR REPLACE FUNCTION public.quiz_create_player_profile_on_signup()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
DECLARE v_name text := btrim(new.raw_user_meta_data ->> 'nickname');
BEGIN
  IF v_name IS NOT NULL AND v_name ~ '^[[:alnum:]_一-龥-]{2,18}$' THEN
    INSERT INTO public.quiz_player_profiles(user_id,nickname,leaderboard_opt_in)
    VALUES (new.id,v_name,coalesce((new.raw_user_meta_data ->> 'leaderboard_opt_in')::boolean,false))
    ON CONFLICT DO NOTHING;
  END IF;
  RETURN new;
END;
$$;

DROP TRIGGER IF EXISTS quiz_player_profile_signup ON auth.users;
CREATE TRIGGER quiz_player_profile_signup
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.quiz_create_player_profile_on_signup();

COMMIT;

-- Tell the Supabase REST API to reload the function signatures.
NOTIFY pgrst, 'reload schema';

-- Both entries should be non-NULL, with authenticated_can_execute=true.
SELECT
  to_regclass('public.quiz_player_profiles') AS profile_table,
  to_regprocedure('public.quiz_my_profile()') AS profile_reader,
  to_regprocedure('public.quiz_set_player_profile(text,boolean)') AS profile_writer,
  has_function_privilege('authenticated',
    'public.quiz_set_player_profile(text,boolean)','EXECUTE') AS authenticated_can_execute;
