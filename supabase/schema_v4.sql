-- ============================================================
-- Quizly — Schema Migration v4 (Fill in the Blanks)
-- Run this ENTIRE file in the Supabase SQL Editor.
-- It is idempotent: safe to run multiple times.
-- ============================================================

-- ── 1. Create the question_answers table ────────────────────
-- Stores accepted answers for fill_in_blank questions.
-- Existing single_choice / multiple_choice questions continue
-- using the choices table — this table is ONLY for fill_in_blank.

CREATE TABLE IF NOT EXISTS question_answers (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  question_id UUID NOT NULL REFERENCES questions(id) ON DELETE CASCADE,
  answer_text TEXT NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index for fast lookup by question
CREATE INDEX IF NOT EXISTS question_answers_question_idx
  ON question_answers (question_id);

-- ── 2. Enable RLS ────────────────────────────────────────────

ALTER TABLE question_answers ENABLE ROW LEVEL SECURITY;

-- ── 3. RLS policies for question_answers ─────────────────────

DROP POLICY IF EXISTS "question_answers: select own or public" ON question_answers;
DROP POLICY IF EXISTS "question_answers: insert own"           ON question_answers;
DROP POLICY IF EXISTS "question_answers: update own"           ON question_answers;
DROP POLICY IF EXISTS "question_answers: delete own"           ON question_answers;

-- SELECT: owner of the quiz OR the quiz is public
CREATE POLICY "question_answers: select own or public"
  ON question_answers FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM questions
      JOIN quizzes ON quizzes.id = questions.quiz_id
      WHERE questions.id = question_answers.question_id
        AND (quizzes.user_id = (SELECT auth.uid()) OR quizzes.visibility = 'public')
    )
  );

-- INSERT: only quiz owner can insert accepted answers
CREATE POLICY "question_answers: insert own"
  ON question_answers FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM questions
      JOIN quizzes ON quizzes.id = questions.quiz_id
      WHERE questions.id = question_answers.question_id
        AND quizzes.user_id = (SELECT auth.uid())
    )
  );

-- UPDATE: only quiz owner
CREATE POLICY "question_answers: update own"
  ON question_answers FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM questions
      JOIN quizzes ON quizzes.id = questions.quiz_id
      WHERE questions.id = question_answers.question_id
        AND quizzes.user_id = (SELECT auth.uid())
    )
  );

-- DELETE: only quiz owner
CREATE POLICY "question_answers: delete own"
  ON question_answers FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM questions
      JOIN quizzes ON quizzes.id = questions.quiz_id
      WHERE questions.id = question_answers.question_id
        AND quizzes.user_id = (SELECT auth.uid())
    )
  );

-- ── 4. Update get_quiz_by_share_token to include question_answers ──
-- Replaces the v3 version.  The function also returns question_answers
-- rows so fill_in_blank private quizzes can be graded client-side.

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
              ) FROM choices ch WHERE ch.question_id = qu.id),
             '[]'::jsonb
           ),
           'question_answers', COALESCE(
             (SELECT jsonb_agg(
                jsonb_build_object(
                  'id',          qa.id,
                  'answer_text', qa.answer_text
                )
              ) FROM question_answers qa WHERE qa.question_id = qu.id),
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
