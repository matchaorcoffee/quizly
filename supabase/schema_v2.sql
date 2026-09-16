-- ============================================================
-- Quizly — Schema Migration v2 (Public/Private Visibility & Sharing)
-- Run this entire file in the Supabase SQL Editor.
-- ============================================================

-- 1. Add visibility and share_token columns to quizzes table
ALTER TABLE quizzes ADD COLUMN IF NOT EXISTS visibility TEXT NOT NULL DEFAULT 'private';
ALTER TABLE quizzes ADD COLUMN IF NOT EXISTS share_token UUID NOT NULL DEFAULT gen_random_uuid();

-- 2. Ensure share_token has a unique index for fast lookups
CREATE UNIQUE INDEX IF NOT EXISTS quizzes_share_token_idx ON quizzes (share_token);

-- 3. Update RLS policies for profiles: allow public profile read for creator names
DROP POLICY IF EXISTS "profiles: select public" ON profiles;
CREATE POLICY "profiles: select public"
  ON profiles FOR SELECT
  USING (true);

-- 4. Update RLS policies for quizzes table
DROP POLICY IF EXISTS "quizzes: select public" ON quizzes;
CREATE POLICY "quizzes: select public"
  ON quizzes FOR SELECT
  USING (visibility = 'public');

-- 5. Update questions table RLS policy: allow SELECT if parent quiz is public OR owned
DROP POLICY IF EXISTS "questions: select public" ON questions;
CREATE POLICY "questions: select public"
  ON questions FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM quizzes
      WHERE quizzes.id = questions.quiz_id
        AND (quizzes.visibility = 'public' OR quizzes.user_id = auth.uid())
    )
  );

-- 6. Update choices table RLS policy: allow SELECT if parent quiz is public OR owned
DROP POLICY IF EXISTS "choices: select public" ON choices;
CREATE POLICY "choices: select public"
  ON choices FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM questions
      JOIN quizzes ON quizzes.id = questions.quiz_id
      WHERE questions.id = choices.question_id
        AND (quizzes.visibility = 'public' OR quizzes.user_id = auth.uid())
    )
  );

-- 7. SECURITY DEFINER RPC function to fetch a quiz by share_token
-- This allows anyone (authenticated or anonymous) with the share link
-- to fetch a private quiz with all its questions and choices safely.
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
    'id', q.id,
    'user_id', q.user_id,
    'title', q.title,
    'description', q.description,
    'category', q.category,
    'difficulty', q.difficulty,
    'visibility', q.visibility,
    'share_token', q.share_token,
    'shuffle_questions', q.shuffle_questions,
    'created_at', q.created_at,
    'updated_at', q.updated_at,
    'questions', COALESCE(
      (
        SELECT jsonb_agg(
          jsonb_build_object(
            'id', qu.id,
            'quiz_id', qu.quiz_id,
            'question_text', qu.question_text,
            'question_type', qu.question_type,
            'question_order', qu.question_order,
            'created_at', qu.created_at,
            'updated_at', qu.updated_at,
            'choices', COALESCE(
              (
                SELECT jsonb_agg(
                  jsonb_build_object(
                    'id', ch.id,
                    'question_id', ch.question_id,
                    'choice_text', ch.choice_text,
                    'choice_order', ch.choice_order,
                    'is_correct', ch.is_correct
                  ) ORDER BY ch.choice_order ASC
                )
                FROM choices ch
                WHERE ch.question_id = qu.id
              ),
              '[]'::jsonb
            )
          ) ORDER BY qu.question_order ASC
        )
        FROM questions qu
        WHERE qu.quiz_id = q.id
      ),
      '[]'::jsonb
    )
  )
  INTO v_quiz
  FROM quizzes q
  WHERE q.share_token = p_token;

  RETURN v_quiz;
END;
$$;
