-- ============================================================
-- Quizly — Supabase Database Schema
-- Run this entire file in the Supabase SQL Editor.
-- ============================================================

-- ── profiles ────────────────────────────────────────────────
create table if not exists profiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  full_name   text,
  email       text,
  avatar_url  text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- ── quizzes ─────────────────────────────────────────────────
create table if not exists quizzes (
  id                uuid primary key default gen_random_uuid(),
  user_id           uuid not null references profiles(id) on delete cascade,
  title             text not null,
  description       text,
  category          text,
  difficulty        text,
  shuffle_questions boolean not null default false,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

-- ── questions ───────────────────────────────────────────────
create table if not exists questions (
  id              uuid primary key default gen_random_uuid(),
  quiz_id         uuid not null references quizzes(id) on delete cascade,
  question_text   text not null,
  question_type   text not null default 'single_choice',
  question_order  integer not null default 0,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

-- ── choices ─────────────────────────────────────────────────
create table if not exists choices (
  id           uuid primary key default gen_random_uuid(),
  question_id  uuid not null references questions(id) on delete cascade,
  choice_text  text not null,
  choice_order integer not null default 0,
  is_correct   boolean not null default false
);

-- ============================================================
-- Row Level Security
-- ============================================================

alter table profiles  enable row level security;
alter table quizzes   enable row level security;
alter table questions enable row level security;
alter table choices   enable row level security;

-- profiles
create policy "profiles: select own"
  on profiles for select using (auth.uid() = id);

create policy "profiles: insert own"
  on profiles for insert with check (auth.uid() = id);

create policy "profiles: update own"
  on profiles for update using (auth.uid() = id);

-- quizzes
create policy "quizzes: select own"
  on quizzes for select using (auth.uid() = user_id);

create policy "quizzes: insert own"
  on quizzes for insert with check (auth.uid() = user_id);

create policy "quizzes: update own"
  on quizzes for update using (auth.uid() = user_id);

create policy "quizzes: delete own"
  on quizzes for delete using (auth.uid() = user_id);

-- questions (ownership verified via parent quiz)
create policy "questions: select own"
  on questions for select using (
    exists (
      select 1 from quizzes
      where quizzes.id = questions.quiz_id
        and quizzes.user_id = auth.uid()
    )
  );

create policy "questions: insert own"
  on questions for insert with check (
    exists (
      select 1 from quizzes
      where quizzes.id = questions.quiz_id
        and quizzes.user_id = auth.uid()
    )
  );

create policy "questions: update own"
  on questions for update using (
    exists (
      select 1 from quizzes
      where quizzes.id = questions.quiz_id
        and quizzes.user_id = auth.uid()
    )
  );

create policy "questions: delete own"
  on questions for delete using (
    exists (
      select 1 from quizzes
      where quizzes.id = questions.quiz_id
        and quizzes.user_id = auth.uid()
    )
  );

-- choices (ownership verified via question → quiz)
create policy "choices: select own"
  on choices for select using (
    exists (
      select 1 from questions
      join quizzes on quizzes.id = questions.quiz_id
      where questions.id = choices.question_id
        and quizzes.user_id = auth.uid()
    )
  );

create policy "choices: insert own"
  on choices for insert with check (
    exists (
      select 1 from questions
      join quizzes on quizzes.id = questions.quiz_id
      where questions.id = choices.question_id
        and quizzes.user_id = auth.uid()
    )
  );

create policy "choices: update own"
  on choices for update using (
    exists (
      select 1 from questions
      join quizzes on quizzes.id = questions.quiz_id
      where questions.id = choices.question_id
        and quizzes.user_id = auth.uid()
    )
  );

create policy "choices: delete own"
  on choices for delete using (
    exists (
      select 1 from questions
      join quizzes on quizzes.id = questions.quiz_id
      where questions.id = choices.question_id
        and quizzes.user_id = auth.uid()
    )
  );

-- ============================================================
-- Auto-create profile on new user signup
-- ============================================================
create or replace function handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, full_name, email)
  values (
    new.id,
    new.raw_user_meta_data ->> 'full_name',
    new.email
  );
  return new;
end;
$$;

-- Drop trigger first so re-running the script is idempotent
drop trigger if exists on_auth_user_created on auth.users;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure handle_new_user();
