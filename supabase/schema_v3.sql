-- ============================================================
-- Quizly — Schema Migration v3 (Critical Fix)
-- Run this ENTIRE file in the Supabase SQL Editor.
-- It is idempotent: safe to run multiple times.
-- ============================================================

-- ── 1. Ensure base tables exist (idempotent) ────────────────

CREATE TABLE IF NOT EXISTS profiles (
  id          UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name   TEXT,
  email       TEXT,
  avatar_url  TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS quizzes (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id           UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  title             TEXT NOT NULL,
  description       TEXT,
  category          TEXT,
  difficulty        TEXT,
  shuffle_questions BOOLEAN NOT NULL DEFAULT FALSE,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS questions (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  quiz_id        UUID NOT NULL REFERENCES quizzes(id) ON DELETE CASCADE,
  question_text  TEXT NOT NULL,
  question_type  TEXT NOT NULL DEFAULT 'single_choice',
  question_order INTEGER NOT NULL DEFAULT 0,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS choices (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  question_id  UUID NOT NULL REFERENCES questions(id) ON DELETE CASCADE,
  choice_text  TEXT NOT NULL,
  choice_order INTEGER NOT NULL DEFAULT 0,
  is_correct   BOOLEAN NOT NULL DEFAULT FALSE
);

-- ── 2. Add missing columns (idempotent) ──────────────────────

ALTER TABLE quizzes ADD COLUMN IF NOT EXISTS visibility   TEXT NOT NULL DEFAULT 'private';
ALTER TABLE quizzes ADD COLUMN IF NOT EXISTS share_token  UUID NOT NULL DEFAULT gen_random_uuid();

-- Unique index on share_token
CREATE UNIQUE INDEX IF NOT EXISTS quizzes_share_token_idx ON quizzes (share_token);

-- ── 3. Enable RLS (idempotent) ───────────────────────────────

ALTER TABLE profiles  ENABLE ROW LEVEL SECURITY;
ALTER TABLE quizzes   ENABLE ROW LEVEL SECURITY;
ALTER TABLE questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE choices   ENABLE ROW LEVEL SECURITY;

-- ── 4. PROFILES policies ─────────────────────────────────────

DROP POLICY IF EXISTS "profiles: select own"    ON profiles;
DROP POLICY IF EXISTS "profiles: select public" ON profiles;
DROP POLICY IF EXISTS "profiles: insert own"    ON profiles;
DROP POLICY IF EXISTS "profiles: update own"    ON profiles;

-- Anyone can read profiles (needed to show creator names on public quizzes)
CREATE POLICY "profiles: select public"
  ON profiles FOR SELECT USING (TRUE);

CREATE POLICY "profiles: insert own"
  ON profiles FOR INSERT WITH CHECK ((SELECT auth.uid()) = id);

CREATE POLICY "profiles: update own"
  ON profiles FOR UPDATE USING ((SELECT auth.uid()) = id);

-- ── 5. QUIZZES policies ──────────────────────────────────────

DROP POLICY IF EXISTS "quizzes: select own"    ON quizzes;
DROP POLICY IF EXISTS "quizzes: select public" ON quizzes;
DROP POLICY IF EXISTS "quizzes: insert own"    ON quizzes;
DROP POLICY IF EXISTS "quizzes: update own"    ON quizzes;
DROP POLICY IF EXISTS "quizzes: delete own"    ON quizzes;

-- Owner can always see their own quizzes (any visibility)
CREATE POLICY "quizzes: select own"
  ON quizzes FOR SELECT
  USING ((SELECT auth.uid()) = user_id);

-- Anyone (anon or authed) can see public quizzes
CREATE POLICY "quizzes: select public"
  ON quizzes FOR SELECT
  USING (visibility = 'public');

-- Owner can insert their own quizzes
CREATE POLICY "quizzes: insert own"
  ON quizzes FOR INSERT
  WITH CHECK ((SELECT auth.uid()) = user_id);

-- Owner can update their own quizzes
CREATE POLICY "quizzes: update own"
  ON quizzes FOR UPDATE
  USING ((SELECT auth.uid()) = user_id);

-- Owner can delete their own quizzes
CREATE POLICY "quizzes: delete own"
  ON quizzes FOR DELETE
  USING ((SELECT auth.uid()) = user_id);

-- ── 6. QUESTIONS policies ────────────────────────────────────

DROP POLICY IF EXISTS "questions: select own"    ON questions;
DROP POLICY IF EXISTS "questions: select public" ON questions;
DROP POLICY IF EXISTS "questions: insert own"    ON questions;
DROP POLICY IF EXISTS "questions: update own"    ON questions;
DROP POLICY IF EXISTS "questions: delete own"    ON questions;

-- Select questions for quizzes you own OR that are public
CREATE POLICY "questions: select own or public"
  ON questions FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM quizzes
      WHERE quizzes.id = questions.quiz_id
        AND (quizzes.user_id = (SELECT auth.uid()) OR quizzes.visibility = 'public')
    )
  );

-- Insert questions only for quizzes you own
CREATE POLICY "questions: insert own"
  ON questions FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM quizzes
      WHERE quizzes.id = questions.quiz_id
        AND quizzes.user_id = (SELECT auth.uid())
    )
  );

-- Update questions only for quizzes you own
CREATE POLICY "questions: update own"
  ON questions FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM quizzes
      WHERE quizzes.id = questions.quiz_id
        AND quizzes.user_id = (SELECT auth.uid())
    )
  );

-- Delete questions only for quizzes you own
CREATE POLICY "questions: delete own"
  ON questions FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM quizzes
      WHERE quizzes.id = questions.quiz_id
        AND quizzes.user_id = (SELECT auth.uid())
    )
  );

-- ── 7. CHOICES policies ──────────────────────────────────────

DROP POLICY IF EXISTS "choices: select own"    ON choices;
DROP POLICY IF EXISTS "choices: select public" ON choices;
DROP POLICY IF EXISTS "choices: insert own"    ON choices;
DROP POLICY IF EXISTS "choices: update own"    ON choices;
DROP POLICY IF EXISTS "choices: delete own"    ON choices;

-- Select choices for quizzes you own OR that are public
CREATE POLICY "choices: select own or public"
  ON choices FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM questions
      JOIN quizzes ON quizzes.id = questions.quiz_id
      WHERE questions.id = choices.question_id
        AND (quizzes.user_id = (SELECT auth.uid()) OR quizzes.visibility = 'public')
    )
  );

-- Insert choices only for questions in quizzes you own
CREATE POLICY "choices: insert own"
  ON choices FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM questions
      JOIN quizzes ON quizzes.id = questions.quiz_id
      WHERE questions.id = choices.question_id
        AND quizzes.user_id = (SELECT auth.uid())
    )
  );

-- Update choices only for questions in quizzes you own
CREATE POLICY "choices: update own"
  ON choices FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM questions
      JOIN quizzes ON quizzes.id = questions.quiz_id
      WHERE questions.id = choices.question_id
        AND quizzes.user_id = (SELECT auth.uid())
    )
  );

-- Delete choices only for questions in quizzes you own
CREATE POLICY "choices: delete own"
  ON choices FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM questions
      JOIN quizzes ON quizzes.id = questions.quiz_id
      WHERE questions.id = choices.question_id
        AND quizzes.user_id = (SELECT auth.uid())
    )
  );

-- ── 8. Auto-create profile on new user signup ────────────────

CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, email)
  VALUES (
    NEW.id,
    NEW.raw_user_meta_data ->> 'full_name',
    NEW.email
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE handle_new_user();

-- ── 9. SECURITY DEFINER RPC: get_quiz_by_share_token ─────────
-- Fetches a private quiz by its share_token, bypassing RLS.
-- Returns NULL if not found.

CREATE OR REPLACE FUNCTION get_quiz_by_share_token(p_token UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_quiz JSONB;
BEGIN
  SELECT jsonb_build_object(
    'id',               q.id,
    'user_id',          q.user_id,
    'title',            q.title,
    'description',      q.description,
    'category',         q.category,
    'difficulty',       q.difficulty,
    'visibility',       q.visibility,
    'share_token',      q.share_token,
    'shuffle_questions',q.shuffle_questions,
    'created_at',       q.created_at,
    'updated_at',       q.updated_at,
    'questions', COALESCE(
      (SELECT jsonb_agg(
         jsonb_build_object(
           'id',             qu.id,
           'quiz_id',        qu.quiz_id,
           'question_text',  qu.question_text,
           'question_type',  qu.question_type,
           'question_order', qu.question_order,
           'choices', COALESCE(
             (SELECT jsonb_agg(
                jsonb_build_object(
                  'id',           ch.id,
                  'question_id',  ch.question_id,
                  'choice_text',  ch.choice_text,
                  'choice_order', ch.choice_order,
                  'is_correct',   ch.is_correct
                ) ORDER BY ch.choice_order ASC
              ) FROM choices ch WHERE ch.question_id = qu.id),
             '[]'::jsonb
           )
         ) ORDER BY qu.question_order ASC
       ) FROM questions qu WHERE qu.quiz_id = q.id),
      '[]'::jsonb
    )
  )
  INTO v_quiz
  FROM quizzes q
  WHERE q.share_token = p_token;

  RETURN v_quiz;
END;
$$;
