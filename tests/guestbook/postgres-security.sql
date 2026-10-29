\set ON_ERROR_STOP on
-- Verify access grants, and ensure ordinary roles cannot bypass the RPCs.
DO $$
BEGIN
 IF has_table_privilege('anon','public.quiz_guestbook_messages','SELECT') OR
    has_table_privilege('authenticated','public.quiz_guestbook_messages','UPDATE') OR
    has_table_privilege('authenticated','public.quiz_guestbook_awards','INSERT') THEN
  RAISE EXCEPTION 'FAIL: direct-table access exposed';
 END IF;
 IF has_function_privilege('anon','public.quiz_guestbook_save(text,uuid)','EXECUTE') OR
    has_function_privilege('anon','public.quiz_guestbook_delete(uuid)','EXECUTE') OR
    has_function_privilege('anon','public.quiz_guestbook_grant_wenchang(uuid,integer)','EXECUTE') THEN
  RAISE EXCEPTION 'FAIL: anonymous mutation RPC access exposed';
 END IF;
 IF NOT has_function_privilege('anon','public.quiz_guestbook_list(integer)','EXECUTE') THEN
  RAISE EXCEPTION 'FAIL: public list unavailable';
 END IF;
END $$;

SET ROLE authenticated;
SET request.jwt.claim.sub='00000000-0000-0000-0000-000000000001';
SELECT set_config('test.guestbook.a_id',(public.quiz_guestbook_save('會員甲心得',NULL)->>'id'),false) AS created_a;
DO $$
DECLARE blocked boolean:=false;
BEGIN
 BEGIN PERFORM public.quiz_guestbook_grant_wenchang(current_setting('test.guestbook.a_id')::uuid,1);
 EXCEPTION WHEN insufficient_privilege THEN blocked:=true; END;
 IF NOT blocked THEN RAISE EXCEPTION 'FAIL: member granted points'; END IF;
END $$;
-- Verify anonymous can only see projected public fields.
RESET ROLE;
SET ROLE anon;
SELECT public.quiz_guestbook_list(30) AS public_list;
RESET ROLE;

SET ROLE authenticated;
SET request.jwt.claim.sub='00000000-0000-0000-0000-000000000002';
DO $$
DECLARE blocked boolean:=false;
BEGIN
 BEGIN PERFORM public.quiz_guestbook_save('不應能修改',current_setting('test.guestbook.a_id')::uuid);
 EXCEPTION WHEN insufficient_privilege THEN blocked:=true; END;
 IF NOT blocked THEN RAISE EXCEPTION 'FAIL: other member edited post'; END IF;
 blocked:=false;
 BEGIN PERFORM public.quiz_guestbook_delete(current_setting('test.guestbook.a_id')::uuid);
 EXCEPTION WHEN insufficient_privilege THEN blocked:=true; END;
 IF NOT blocked THEN RAISE EXCEPTION 'FAIL: other member deleted post'; END IF;
END $$;
SELECT set_config('test.guestbook.b_id',(public.quiz_guestbook_save('會員乙心得',NULL)->>'id'),false) AS created_b;
RESET ROLE;

SET ROLE authenticated;
SET request.jwt.claim.sub='00000000-0000-0000-0000-000000000003';
SELECT public.quiz_guestbook_grant_wenchang(current_setting('test.guestbook.b_id')::uuid,2) AS award_result;
DO $$
DECLARE blocked boolean:=false;
BEGIN
 BEGIN PERFORM public.quiz_guestbook_grant_wenchang(current_setting('test.guestbook.b_id')::uuid,2);
 EXCEPTION WHEN unique_violation THEN blocked:=true; END;
 IF NOT blocked THEN RAISE EXCEPTION 'FAIL: same post rewarded twice'; END IF;
END $$;
SELECT public.quiz_guestbook_delete(current_setting('test.guestbook.a_id')::uuid) AS admin_delete;
RESET ROLE;

DO $$
BEGIN
 IF (SELECT credits FROM public.quiz_wenchang_wallet
     WHERE user_id='00000000-0000-0000-0000-000000000002')<>5 THEN
  RAISE EXCEPTION 'FAIL: award not reflected in existing wallet';
 END IF;
 IF (SELECT count(*) FROM public.quiz_guestbook_awards)<>1 THEN
  RAISE EXCEPTION 'FAIL: award log missing or duplicate';
 END IF;
 IF NOT EXISTS (SELECT 1 FROM public.quiz_guestbook_messages
      WHERE id=current_setting('test.guestbook.a_id')::uuid AND deleted_at IS NOT NULL) THEN
  RAISE EXCEPTION 'FAIL: admin deletion not audited (soft-deleted)';
 END IF;
END $$;
-- Test full-wallet cap against a distinct post.
UPDATE public.quiz_guestbook_messages SET created_at=now()-interval '2 minutes'
WHERE id=current_setting('test.guestbook.b_id')::uuid;
SET ROLE authenticated;
SET request.jwt.claim.sub='00000000-0000-0000-0000-000000000002';
SELECT set_config('test.guestbook.b2_id',(public.quiz_guestbook_save('會員乙第二則留言',NULL)->>'id'),false) AS created_b2;
RESET ROLE;
UPDATE public.quiz_wenchang_wallet SET credits=10 WHERE user_id='00000000-0000-0000-0000-000000000002';
SET ROLE authenticated;
SET request.jwt.claim.sub='00000000-0000-0000-0000-000000000003';
DO $$
DECLARE blocked boolean:=false;
BEGIN
 BEGIN PERFORM public.quiz_guestbook_grant_wenchang(current_setting('test.guestbook.b2_id')::uuid,1);
 EXCEPTION WHEN invalid_parameter_value THEN blocked:=true; END;
 IF NOT blocked THEN RAISE EXCEPTION 'FAIL: wallet cap not enforced'; END IF;
END $$;
RESET ROLE;
DO $$
BEGIN
 IF (SELECT count(*) FROM public.quiz_guestbook_awards)<>1 OR
    (SELECT credits FROM public.quiz_wenchang_wallet WHERE
      user_id='00000000-0000-0000-0000-000000000002')<>10 THEN
  RAISE EXCEPTION 'FAIL: failed capped grant mutated wallet/audit';
 END IF;
END $$;
SELECT 'PASS: SQL owner-only edits/deletes, admin moderation, single award, capped wallet and audit' AS outcome;
