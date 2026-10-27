-- Run in Supabase SQL Editor. PostgreSQL auth + RLS is the actual security boundary.
-- No username, password, master key, or password hash belongs in the public website.

create table if not exists public.quiz_admins (
  user_id uuid primary key references auth.users(id) on delete cascade
);
create table if not exists public.quiz_questions (
  id text primary key check (char_length(id) between 1 and 120),
  mansion text not null check (char_length(mansion) between 1 and 32),
  category text not null check (char_length(category) between 1 and 40),
  prompt text not null check (char_length(prompt) between 1 and 300),
  options jsonb not null check (jsonb_typeof(options) = 'array' and jsonb_array_length(options) = 4),
  answer integer not null check (answer between 0 and 3),
  explanation text not null default '' check (char_length(explanation) <= 1600),
  updated_at timestamptz not null default now()
);

alter table public.quiz_admins enable row level security;
alter table public.quiz_questions enable row level security;

-- Defense in depth: do not rely on default Supabase table grants.
revoke all on table public.quiz_admins from public, anon, authenticated;
revoke all on table public.quiz_questions from public, anon, authenticated;
grant select on table public.quiz_admins to authenticated;
grant select on table public.quiz_questions to anon, authenticated;
grant insert, update, delete on table public.quiz_questions to authenticated;

-- Only the currently authenticated account can see its own admin membership.
drop policy if exists quiz_admin_select_self on public.quiz_admins;
create policy quiz_admin_select_self on public.quiz_admins
  for select to authenticated using (user_id = (select auth.uid()));

-- Everyone may read the public learning questions.
drop policy if exists quiz_public_read on public.quiz_questions;
create policy quiz_public_read on public.quiz_questions
  for select to anon, authenticated using (true);

-- Non-admin authenticated users cannot write, even by bypassing the browser UI.
drop policy if exists quiz_admin_insert on public.quiz_questions;
create policy quiz_admin_insert on public.quiz_questions
  for insert to authenticated with check (
    exists(select 1 from public.quiz_admins where user_id=(select auth.uid()))
  );
drop policy if exists quiz_admin_update on public.quiz_questions;
create policy quiz_admin_update on public.quiz_questions
  for update to authenticated
  using (exists(select 1 from public.quiz_admins where user_id=(select auth.uid())))
  with check (exists(select 1 from public.quiz_admins where user_id=(select auth.uid())));
drop policy if exists quiz_admin_delete on public.quiz_questions;
create policy quiz_admin_delete on public.quiz_questions
  for delete to authenticated
  using (exists(select 1 from public.quiz_admins where user_id=(select auth.uid())));

-- Single transaction replace; invoker security means quiz_questions RLS is still checked.
create or replace function public.replace_quiz_bank(payload jsonb)
returns integer
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare inserted integer;
begin
  if (select auth.uid()) is null or not exists(
    select 1 from public.quiz_admins where user_id=(select auth.uid())
  ) then
    raise exception 'Permission denied';
  end if;
  if payload is null or jsonb_typeof(payload) <> 'array' or jsonb_array_length(payload) > 3000 then
    raise exception 'Invalid bank JSON';
  end if;
  delete from public.quiz_questions;
  insert into public.quiz_questions(id,mansion,category,prompt,options,answer,explanation)
  select q.id,q.mansion,q.category,q.prompt,q.options,q.answer,coalesce(q.explanation,'')
  from jsonb_to_recordset(payload)
       as q(id text,mansion text,category text,prompt text,options jsonb,answer integer,explanation text);
  get diagnostics inserted = row_count;
  return inserted;
end;
$$;
revoke all on function public.replace_quiz_bank(jsonb) from public, anon;
grant execute on function public.replace_quiz_bank(jsonb) to authenticated;

-- ADMIN SETUP: Create a user in Supabase Dashboard -> Authentication -> Users,
-- then run the following with the user's ACTUAL UUID (keep it in Dashboard, NOT GitHub):
-- insert into public.quiz_admins(user_id) values ('PASTE-ACTUAL-ADMIN-UUID-HERE');
-- Do not enable open self-service signups for an admin-only application.
