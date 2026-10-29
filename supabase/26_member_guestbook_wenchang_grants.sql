-- Guestbook: isolated from existing quiz, member history and Wenchang data.
-- Review and test in a disposable Supabase project before applying to production.
BEGIN;

CREATE TABLE IF NOT EXISTS public.quiz_guestbook_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  author_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  display_name text NOT NULL CHECK (char_length(display_name) BETWEEN 2 AND 40),
  body text NOT NULL CHECK (char_length(body) BETWEEN 2 AND 500),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz,
  deleted_by uuid
);
CREATE INDEX IF NOT EXISTS quiz_guestbook_recent_idx ON public.quiz_guestbook_messages(created_at DESC)
  WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS quiz_guestbook_author_idx ON public.quiz_guestbook_messages(author_id, created_at DESC);

CREATE TABLE IF NOT EXISTS public.quiz_guestbook_awards (
  message_id uuid PRIMARY KEY REFERENCES public.quiz_guestbook_messages(id) ON DELETE RESTRICT,
  recipient_id uuid NOT NULL,
  administrator_id uuid NOT NULL,
  requested_points integer NOT NULL CHECK (requested_points BETWEEN 1 AND 3),
  granted_points integer NOT NULL CHECK (granted_points BETWEEN 1 AND 3),
  wallet_before integer NOT NULL CHECK (wallet_before BETWEEN 0 AND 10),
  wallet_after integer NOT NULL CHECK (wallet_after BETWEEN 1 AND 10),
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.quiz_guestbook_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quiz_guestbook_awards ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.quiz_guestbook_messages FROM PUBLIC, anon, authenticated;
REVOKE ALL ON public.quiz_guestbook_awards FROM PUBLIC, anon, authenticated;

-- Public read access is LIMITED to the returned columns: no account emails or user IDs.
CREATE OR REPLACE FUNCTION public.quiz_guestbook_list(p_limit integer DEFAULT 30)
RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = ''
AS $$
  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'id', q.id, 'nickname', q.display_name, 'body', q.body,
    'created_at', q.created_at, 'updated_at', q.updated_at,
    'is_owner', (q.author_id IS NOT NULL AND q.author_id=auth.uid()),
    'awarded_points', a.granted_points
  ) ORDER BY q.created_at DESC), '[]'::jsonb)
  FROM (
    SELECT id,author_id,display_name,body,created_at,updated_at
    FROM public.quiz_guestbook_messages
    WHERE deleted_at IS NULL
    ORDER BY created_at DESC
    LIMIT LEAST(GREATEST(COALESCE(p_limit,30),1),50)
  ) AS q
  LEFT JOIN public.quiz_guestbook_awards a ON a.message_id=q.id;
$$;

-- Only the caller's own message may be inserted or edited. Nicknames originate
-- in the server-controlled player profile, never the request JSON.
CREATE OR REPLACE FUNCTION public.quiz_guestbook_save(p_body text,p_id uuid DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_name text;
  v_body text := btrim(COALESCE(p_body,''));
  v_row public.quiz_guestbook_messages%ROWTYPE;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION '請先登入註冊會員' USING ERRCODE='42501';
  END IF;
  SELECT nickname INTO v_name
  FROM public.quiz_player_profiles WHERE user_id=v_uid;
  IF v_name IS NULL THEN
    RAISE EXCEPTION '請先在會員帳號設定暱稱' USING ERRCODE='22023';
  END IF;
  IF char_length(v_body)<2 OR char_length(v_body)>500 THEN
    RAISE EXCEPTION '留言長度限 2 至 500 字' USING ERRCODE='22023';
  END IF;

  IF p_id IS NULL THEN
    IF EXISTS (
      SELECT 1 FROM public.quiz_guestbook_messages
      WHERE author_id=v_uid AND created_at>now()-interval '45 seconds'
    ) THEN
      RAISE EXCEPTION '發表過於頻繁，請稍後再留言' USING ERRCODE='22023';
    END IF;
    INSERT INTO public.quiz_guestbook_messages(author_id,display_name,body)
    VALUES(v_uid,v_name,v_body) RETURNING * INTO v_row;
  ELSE
    SELECT * INTO v_row FROM public.quiz_guestbook_messages
    WHERE id=p_id FOR UPDATE;
    IF NOT FOUND OR v_row.deleted_at IS NOT NULL OR
       v_row.author_id IS DISTINCT FROM v_uid THEN
      RAISE EXCEPTION '只能修改自己的有效留言' USING ERRCODE='42501';
    END IF;
    UPDATE public.quiz_guestbook_messages SET body=v_body,updated_at=now()
    WHERE id=p_id RETURNING * INTO v_row;
  END IF;
  RETURN jsonb_build_object('id',v_row.id,'saved',true);
END;
$$;

-- Author may delete own message; admins may delete any. Soft deletion retains
-- the single-award record and prevents re-awarding the same message ID.
CREATE OR REPLACE FUNCTION public.quiz_guestbook_delete(p_id uuid)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_row public.quiz_guestbook_messages%ROWTYPE;
  v_admin boolean;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION '請先登入' USING ERRCODE='42501';
  END IF;
  v_admin := EXISTS(SELECT 1 FROM public.quiz_admins WHERE user_id=v_uid);
  SELECT * INTO v_row FROM public.quiz_guestbook_messages WHERE id=p_id FOR UPDATE;
  IF NOT FOUND OR v_row.deleted_at IS NOT NULL THEN
    RAISE EXCEPTION '留言不存在或已刪除' USING ERRCODE='22023';
  END IF;
  IF NOT v_admin AND v_row.author_id IS DISTINCT FROM v_uid THEN
    RAISE EXCEPTION '不能刪除別人的留言' USING ERRCODE='42501';
  END IF;
  UPDATE public.quiz_guestbook_messages
  SET deleted_at=now(),deleted_by=v_uid WHERE id=p_id;
  RETURN jsonb_build_object('deleted',true,'id',p_id);
END;
$$;

-- A grant NEVER trusts a supplied member ID or balance. The recipient comes
-- from the message author, the admin from auth.uid(), and one award is allowed
-- per message. Wallet refill and grant occur under row lock in one transaction.
CREATE OR REPLACE FUNCTION public.quiz_guestbook_grant_wenchang(p_id uuid,p_amount integer)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
DECLARE
  v_admin uuid := auth.uid();
  v_message public.quiz_guestbook_messages%ROWTYPE;
  v_wallet public.quiz_wenchang_wallet%ROWTYPE;
  v_cycles integer;
  v_balance integer;
  v_refill timestamptz;
BEGIN
  IF v_admin IS NULL OR NOT EXISTS(
    SELECT 1 FROM public.quiz_admins WHERE user_id=v_admin
  ) THEN
    RAISE EXCEPTION '只有管理員可以贈送文昌星救援點數' USING ERRCODE='42501';
  END IF;
  IF p_amount IS NULL OR p_amount NOT BETWEEN 1 AND 3 THEN
    RAISE EXCEPTION '每則留言只能贈送 1 至 3 點' USING ERRCODE='22023';
  END IF;
  SELECT * INTO v_message
  FROM public.quiz_guestbook_messages WHERE id=p_id FOR UPDATE;
  IF NOT FOUND OR v_message.deleted_at IS NOT NULL OR
     v_message.author_id IS NULL THEN
    RAISE EXCEPTION '留言不存在、已刪除或會員不存在' USING ERRCODE='22023';
  END IF;
  IF v_message.author_id=v_admin THEN
    RAISE EXCEPTION '管理員不可贈點給自己的留言' USING ERRCODE='42501';
  END IF;
  IF EXISTS(SELECT 1 FROM public.quiz_guestbook_awards WHERE message_id=p_id) THEN
    RAISE EXCEPTION '這則留言已獲贈點，不能重複贈送' USING ERRCODE='23505';
  END IF;
  INSERT INTO public.quiz_wenchang_wallet(user_id)
  VALUES(v_message.author_id) ON CONFLICT(user_id) DO NOTHING;
  SELECT * INTO v_wallet FROM public.quiz_wenchang_wallet
  WHERE user_id=v_message.author_id FOR UPDATE;
  v_cycles := GREATEST(0,FLOOR(EXTRACT(epoch FROM
    (now()-v_wallet.last_refill_at))/7200)::integer);
  v_balance := LEAST(10,v_wallet.credits+v_cycles*3);
  v_refill := v_wallet.last_refill_at+v_cycles*interval '2 hours';
  IF v_balance+p_amount>10 THEN
    RAISE EXCEPTION '會員救援餘額將超過 10 點，請減少贈點或稍後再試'
      USING ERRCODE='22023';
  END IF;
  UPDATE public.quiz_wenchang_wallet
  SET credits=v_balance+p_amount,last_refill_at=v_refill
  WHERE user_id=v_message.author_id;
  INSERT INTO public.quiz_guestbook_awards
    (message_id,recipient_id,administrator_id,requested_points,
     granted_points,wallet_before,wallet_after)
  VALUES(p_id,v_message.author_id,v_admin,p_amount,p_amount,v_balance,
    v_balance+p_amount);
  RETURN jsonb_build_object('success',true,'granted_points',p_amount,
    'wallet_after',v_balance+p_amount,'maximum',10);
END;
$$;

-- Default Postgres function privileges are PUBLIC; explicitly remove them.
REVOKE ALL ON FUNCTION public.quiz_guestbook_list(integer) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.quiz_guestbook_save(text,uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.quiz_guestbook_delete(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.quiz_guestbook_grant_wenchang(uuid,integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.quiz_guestbook_list(integer) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.quiz_guestbook_save(text,uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.quiz_guestbook_delete(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.quiz_guestbook_grant_wenchang(uuid,integer) TO authenticated;
COMMIT;
