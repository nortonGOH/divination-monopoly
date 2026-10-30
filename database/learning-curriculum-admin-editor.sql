-- Administrator-only editing of already protected member lessons.
-- No new member records; public intro bodies and lesson metadata remain immutable.
-- Execute in the authorized Supabase SQL Editor after review.
alter table public.learning_curriculum_lessons
  add column if not exists revision integer not null default 1,
  add column if not exists updated_at timestamptz not null default now(),
  add column if not exists updated_by uuid;

alter table public.learning_curriculum_lessons
  add constraint learning_curriculum_revision_positive check (revision > 0);

-- Existing readers keep SELECT rights, but can never change access tier or publication.
revoke update on public.learning_curriculum_lessons from public, anon, authenticated;
grant update (lead, points, method, question, caution, sources)
  on public.learning_curriculum_lessons to authenticated;

drop policy if exists learning_member_editor_update on public.learning_curriculum_lessons;
create policy learning_member_editor_update
  on public.learning_curriculum_lessons
  for update to authenticated
  using (
    published and access_tier = 'member'
    and (select auth.uid()) is not null
    and coalesce((select auth.jwt()->>'is_anonymous'),'false') <> 'true'
    and exists (select 1 from public.quiz_admins a where a.user_id=(select auth.uid()))
  )
  with check (
    published and access_tier = 'member'
    and (select auth.uid()) is not null
    and coalesce((select auth.jwt()->>'is_anonymous'),'false') <> 'true'
    and exists (select 1 from public.quiz_admins a where a.user_id=(select auth.uid()))
  );

create or replace function public.learning_curriculum_bump_revision()
returns trigger language plpgsql security invoker
set search_path = ''
as $$
begin
  new.revision := old.revision + 1;
  new.updated_at := now();
  new.updated_by := (select auth.uid());
  return new;
end;
$$;
revoke all on function public.learning_curriculum_bump_revision() from public,anon,authenticated;
drop trigger if exists trg_learning_curriculum_bump_revision on public.learning_curriculum_lessons;
create trigger trg_learning_curriculum_bump_revision
before update on public.learning_curriculum_lessons
for each row execute function public.learning_curriculum_bump_revision();

-- Expect read: guests 3, members 39; writes: authenticated non-admin 0.
-- Test all UPDATE commands in transactions that ROLLBACK, never on live content.
