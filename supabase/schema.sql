-- ============================================================
-- Quizly — Complete Consolidated Database Schema & Migration
-- Run this ENTIRE file in the Supabase SQL Editor.
-- It is idempotent: safe to run on brand new or existing projects.
-- ============================================================

-- ── 1. Create Base Tables ───────────────────────────────────

CREATE TABLE IF NOT EXISTS public.profiles (
  id          UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name   TEXT,
  email       TEXT,
  avatar_url  TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.quizzes (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id           UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  title             TEXT NOT NULL,
  description       TEXT,
  category          TEXT,
  difficulty        TEXT,
  visibility        TEXT NOT NULL DEFAULT 'private' CHECK (visibility IN ('public', 'private')),
  share_token       UUID NOT NULL DEFAULT gen_random_uuid(),
  shuffle_questions BOOLEAN NOT NULL DEFAULT FALSE,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.questions (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  quiz_id        UUID NOT NULL REFERENCES public.quizzes(id) ON DELETE CASCADE,
  question_text  TEXT NOT NULL,
  question_type  TEXT NOT NULL DEFAULT 'single_choice' CHECK (question_type IN ('single_choice', 'multiple_choice', 'fill_in_blank')),
  question_order INTEGER NOT NULL DEFAULT 0,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.choices (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  question_id  UUID NOT NULL REFERENCES public.questions(id) ON DELETE CASCADE,
  choice_text  TEXT NOT NULL,
  choice_order INTEGER NOT NULL DEFAULT 0,
  is_correct   BOOLEAN NOT NULL DEFAULT FALSE
);

CREATE TABLE IF NOT EXISTS public.question_answers (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  question_id UUID NOT NULL REFERENCES public.questions(id) ON DELETE CASCADE,
  answer_text TEXT NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── 2. Ensure Columns & Constraints on Existing Tables ────────

ALTER TABLE public.quizzes ADD COLUMN IF NOT EXISTS visibility TEXT NOT NULL DEFAULT 'private';
ALTER TABLE public.quizzes ADD COLUMN IF NOT EXISTS share_token UUID NOT NULL DEFAULT gen_random_uuid();
ALTER TABLE public.quizzes ADD COLUMN IF NOT EXISTS shuffle_questions BOOLEAN NOT NULL DEFAULT FALSE;

-- Ensure share_token unique index
CREATE UNIQUE INDEX IF NOT EXISTS quizzes_share_token_idx ON public.quizzes (share_token);

-- Index for question_answers
CREATE INDEX IF NOT EXISTS question_answers_question_idx ON public.question_answers (question_id);

-- ── 3. Schema Grants for Supabase Roles ───────────────────────
-- Ensure PostgREST / Supabase Data API roles have full access

GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;
GRANT ALL ON ALL TABLES IN SCHEMA public TO anon, authenticated, service_role;
GRANT ALL ON ALL ROUTINES IN SCHEMA public TO anon, authenticated, service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO anon, authenticated, service_role;

ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON ROUTINES TO anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO anon, authenticated, service_role;

-- ── 4. Enable Row Level Security (RLS) ────────────────────────

ALTER TABLE public.profiles         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quizzes          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.questions        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.choices          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.question_answers ENABLE ROW LEVEL SECURITY;

-- ── 5. RLS Policies: PROFILES ────────────────────────────────

DROP POLICY IF EXISTS "profiles: select own"    ON public.profiles;
DROP POLICY IF EXISTS "profiles: select public" ON public.profiles;
DROP POLICY IF EXISTS "profiles: insert own"    ON public.profiles;
DROP POLICY IF EXISTS "profiles: update own"    ON public.profiles;

CREATE POLICY "profiles: select public"
  ON public.profiles FOR SELECT USING (TRUE);

CREATE POLICY "profiles: insert own"
  ON public.profiles FOR INSERT WITH CHECK ((SELECT auth.uid()) = id);

CREATE POLICY "profiles: update own"
  ON public.profiles FOR UPDATE USING ((SELECT auth.uid()) = id);

-- ── 6. RLS Policies: QUIZZES ─────────────────────────────────

DROP POLICY IF EXISTS "quizzes: select own"    ON public.quizzes;
DROP POLICY IF EXISTS "quizzes: select public" ON public.quizzes;
DROP POLICY IF EXISTS "quizzes: insert own"    ON public.quizzes;
DROP POLICY IF EXISTS "quizzes: update own"    ON public.quizzes;
DROP POLICY IF EXISTS "quizzes: delete own"    ON public.quizzes;

-- Owner can always see their own quizzes; public quizzes visible to everyone
CREATE POLICY "quizzes: select own or public"
  ON public.quizzes FOR SELECT
  USING ((SELECT auth.uid()) = user_id OR visibility = 'public');

CREATE POLICY "quizzes: insert own"
  ON public.quizzes FOR INSERT
  WITH CHECK ((SELECT auth.uid()) = user_id);

CREATE POLICY "quizzes: update own"
  ON public.quizzes FOR UPDATE
  USING ((SELECT auth.uid()) = user_id);

CREATE POLICY "quizzes: delete own"
  ON public.quizzes FOR DELETE
  USING ((SELECT auth.uid()) = user_id);

-- ── 7. RLS Policies: QUESTIONS ───────────────────────────────

DROP POLICY IF EXISTS "questions: select own"           ON public.questions;
DROP POLICY IF EXISTS "questions: select public"        ON public.questions;
DROP POLICY IF EXISTS "questions: select own or public" ON public.questions;
DROP POLICY IF EXISTS "questions: insert own"           ON public.questions;
DROP POLICY IF EXISTS "questions: update own"           ON public.questions;
DROP POLICY IF EXISTS "questions: delete own"           ON public.questions;

CREATE POLICY "questions: select own or public"
  ON public.questions FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.quizzes
      WHERE quizzes.id = questions.quiz_id
        AND (quizzes.user_id = (SELECT auth.uid()) OR quizzes.visibility = 'public')
    )
  );

CREATE POLICY "questions: insert own"
  ON public.questions FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.quizzes
      WHERE quizzes.id = questions.quiz_id
        AND quizzes.user_id = (SELECT auth.uid())
    )
  );

CREATE POLICY "questions: update own"
  ON public.questions FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.quizzes
      WHERE quizzes.id = questions.quiz_id
        AND quizzes.user_id = (SELECT auth.uid())
    )
  );

CREATE POLICY "questions: delete own"
  ON public.questions FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.quizzes
      WHERE quizzes.id = questions.quiz_id
        AND quizzes.user_id = (SELECT auth.uid())
    )
  );

-- ── 8. RLS Policies: CHOICES ─────────────────────────────────

DROP POLICY IF EXISTS "choices: select own"           ON public.choices;
DROP POLICY IF EXISTS "choices: select public"        ON public.choices;
DROP POLICY IF EXISTS "choices: select own or public" ON public.choices;
DROP POLICY IF EXISTS "choices: insert own"           ON public.choices;
DROP POLICY IF EXISTS "choices: update own"           ON public.choices;
DROP POLICY IF EXISTS "choices: delete own"           ON public.choices;

CREATE POLICY "choices: select own or public"
  ON public.choices FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.questions
      JOIN public.quizzes ON quizzes.id = questions.quiz_id
      WHERE questions.id = choices.question_id
        AND (quizzes.user_id = (SELECT auth.uid()) OR quizzes.visibility = 'public')
    )
  );

CREATE POLICY "choices: insert own"
  ON public.choices FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.questions
      JOIN public.quizzes ON quizzes.id = questions.quiz_id
      WHERE questions.id = choices.question_id
        AND quizzes.user_id = (SELECT auth.uid())
    )
  );

CREATE POLICY "choices: update own"
  ON public.choices FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.questions
      JOIN public.quizzes ON quizzes.id = questions.quiz_id
      WHERE questions.id = choices.question_id
        AND quizzes.user_id = (SELECT auth.uid())
    )
  );

CREATE POLICY "choices: delete own"
  ON public.choices FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.questions
      JOIN public.quizzes ON quizzes.id = questions.quiz_id
      WHERE questions.id = choices.question_id
        AND quizzes.user_id = (SELECT auth.uid())
    )
  );

-- ── 9. RLS Policies: QUESTION_ANSWERS ────────────────────────

DROP POLICY IF EXISTS "question_answers: select own or public" ON public.question_answers;
DROP POLICY IF EXISTS "question_answers: insert own"           ON public.question_answers;
DROP POLICY IF EXISTS "question_answers: update own"           ON public.question_answers;
DROP POLICY IF EXISTS "question_answers: delete own"           ON public.question_answers;

CREATE POLICY "question_answers: select own or public"
  ON public.question_answers FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.questions
      JOIN public.quizzes ON quizzes.id = questions.quiz_id
      WHERE questions.id = question_answers.question_id
        AND (quizzes.user_id = (SELECT auth.uid()) OR quizzes.visibility = 'public')
    )
  );

CREATE POLICY "question_answers: insert own"
  ON public.question_answers FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.questions
      JOIN public.quizzes ON quizzes.id = questions.quiz_id
      WHERE questions.id = question_answers.question_id
        AND quizzes.user_id = (SELECT auth.uid())
    )
  );

CREATE POLICY "question_answers: update own"
  ON public.question_answers FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.questions
      JOIN public.quizzes ON quizzes.id = questions.quiz_id
      WHERE questions.id = question_answers.question_id
        AND quizzes.user_id = (SELECT auth.uid())
    )
  );

CREATE POLICY "question_answers: delete own"
  ON public.question_answers FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.questions
      JOIN public.quizzes ON quizzes.id = questions.quiz_id
      WHERE questions.id = question_answers.question_id
        AND quizzes.user_id = (SELECT auth.uid())
    )
  );

-- ── 10. Auto-create Profile Trigger ──────────────────────────

CREATE OR REPLACE FUNCTION public.handle_new_user()
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
  ON CONFLICT (id) DO UPDATE SET
    full_name = EXCLUDED.full_name,
    email = EXCLUDED.email,
    updated_at = NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();

-- Backfill any existing auth.users into public.profiles if missing
INSERT INTO public.profiles (id, full_name, email)
SELECT
  id,
  raw_user_meta_data ->> 'full_name',
  email
FROM auth.users
ON CONFLICT (id) DO NOTHING;

-- ── 11. SECURITY DEFINER RPC: get_quiz_by_share_token ────────

CREATE OR REPLACE FUNCTION public.get_quiz_by_share_token(p_token UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_quiz JSONB;
BEGIN
  SELECT jsonb_build_object(
    'id',                q.id,
    'user_id',           q.user_id,
    'title',             q.title,
    'description',       q.description,
    'category',          q.category,
    'difficulty',        q.difficulty,
    'visibility',        q.visibility,
    'share_token',       q.share_token,
    'shuffle_questions', q.shuffle_questions,
    'created_at',        q.created_at,
    'updated_at',        q.updated_at,
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
              ) FROM public.choices ch WHERE ch.question_id = qu.id),
             '[]'::jsonb
           ),
           'question_answers', COALESCE(
             (SELECT jsonb_agg(
                jsonb_build_object(
                  'id',          qa.id,
                  'answer_text', qa.answer_text
                )
              ) FROM public.question_answers qa WHERE qa.question_id = qu.id),
             '[]'::jsonb
           )
         ) ORDER BY qu.question_order ASC
       ) FROM public.questions qu WHERE qu.quiz_id = q.id),
      '[]'::jsonb
    )
  )
  INTO v_quiz
  FROM public.quizzes q
  WHERE q.share_token = p_token;

  RETURN v_quiz;
END;
$$;

-- ── 12. Notify PostgREST to Reload Schema Cache ──────────────
NOTIFY pgrst, 'reload schema';
