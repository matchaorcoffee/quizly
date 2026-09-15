-- ============================================================
-- Quizly — Supabase Database Schema
-- Run this in the Supabase SQL Editor to set up your database.
-- ============================================================

-- profiles table
create table if not exists profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  email text,
  avatar_url text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- quizzes table
create table if not exists quizzes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references profiles(id) on delete cascade not null,
  title text not null,
  description text,
  category text,
  difficulty text,
  shuffle_questions boolean default false,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- questions table
create table if not exists questions (
  id uuid primary key default gen_random_uuid(),
  quiz_id uuid references quizzes(id) on delete cascade not null,
  question_text text not null,
  question_type text not null default 'single_choice',
  question_order integer not null default 0,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- choices table
create table if not exists choices (
  id uuid primary key default gen_random_uuid(),
  question_id uuid references questions(id) on delete cascade not null,
  choice_text text not null,
  choice_order integer not null default 0,
  is_correct boolean not null default false
);

-- ============================================================
-- Row Level Security
-- ============================================================

alter table profiles enable row level security;
alter table quizzes enable row level security;
alter table questions enable row level security;
alter table choices enable row level security;

-- profiles policies
create policy "Users can view own profile"
  on profiles for select
  using (auth.uid() = id);

create policy "Users can update own profile"
  on profiles for update
  using (auth.uid() = id);

create policy "Users can insert own profile"
  on profiles for insert
  with check (auth.uid() = id);

-- quizzes policies
create policy "Users can view own quizzes"
  on quizzes for select
  using (auth.uid() = user_id);

create policy "Users can insert own quizzes"
  on quizzes for insert
  with check (auth.uid() = user_id);

create policy "Users can update own quizzes"
  on quizzes for update
  using (auth.uid() = user_id);

create policy "Users can delete own quizzes"
  on quizzes for delete
  using (auth.uid() = user_id);

-- questions policies (ownership via quiz)
create policy "Users can view own questions"
  on questions for select
  using (
    exists (select 1 from quizzes where quizzes.id = questions.quiz_id and quizzes.user_id = auth.uid())
  );

create policy "Users can insert own questions"
  on questions for insert
  with check (
    exists (select 1 from quizzes where quizzes.id = questions.quiz_id and quizzes.user_id = auth.uid())
  );

create policy "Users can update own questions"
  on questions for update
  using (
    exists (select 1 from quizzes where quizzes.id = questions.quiz_id and quizzes.user_id = auth.uid())
  );

create policy "Users can delete own questions"
  on questions for delete
  using (
    exists (select 1 from quizzes where quizzes.id = questions.quiz_id and quizzes.user_id = auth.uid())
  );

-- choices policies (ownership via question → quiz)
create policy "Users can view own choices"
  on choices for select
  using (
    exists (
      select 1 from questions
      join quizzes on quizzes.id = questions.quiz_id
      where questions.id = choices.question_id and quizzes.user_id = auth.uid()
    )
  );

create policy "Users can insert own choices"
  on choices for insert
  with check (
    exists (
      select 1 from questions
      join quizzes on quizzes.id = questions.quiz_id
      where questions.id = choices.question_id and quizzes.user_id = auth.uid()
    )
  );

create policy "Users can update own choices"
  on choices for update
  using (
    exists (
      select 1 from questions
      join quizzes on quizzes.id = questions.quiz_id
      where questions.id = choices.question_id and quizzes.user_id = auth.uid()
    )
  );

create policy "Users can delete own choices"
  on choices for delete
  using (
    exists (
      select 1 from questions
      join quizzes on quizzes.id = questions.quiz_id
      where questions.id = choices.question_id and quizzes.user_id = auth.uid()
    )
  );

-- ============================================================
-- Trigger: auto-create profile row on new user signup
-- ============================================================

create or replace function handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, full_name, email)
  values (
    new.id,
    new.raw_user_meta_data->>'full_name',
    new.email
  );
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists on_auth_user_created on auth.users;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure handle_new_user();
