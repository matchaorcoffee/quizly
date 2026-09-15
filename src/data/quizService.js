/**
 * Quiz Storage Service — Supabase backend
 *
 * All functions are async. Data shape returned to components:
 * {
 *   id, title, description, category, difficulty, shuffleQuestions,
 *   createdAt, updatedAt,
 *   questions: [
 *     { id, questionText, questionType,
 *       choices: [{ id, text }],
 *       correctAnswers: ['choice-id', ...] }
 *   ]
 * }
 */

import { supabase } from '../lib/supabase';
import { v4 as uuidv4 } from 'uuid';

// ── Shape mappers ──────────────────────────────────────────────────────────

/** Map a DB quiz row + nested questions/choices → component shape */
function mapQuiz(row) {
  return {
    id: row.id,
    title: row.title,
    description: row.description || '',
    category: row.category || '',
    difficulty: row.difficulty || '',
    shuffleQuestions: row.shuffle_questions ?? false,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    questions: (row.questions || [])
      .sort((a, b) => a.question_order - b.question_order)
      .map((q) => ({
        id: q.id,
        questionText: q.question_text,
        questionType: q.question_type || 'single_choice',
        choices: (q.choices || [])
          .sort((a, b) => a.choice_order - b.choice_order)
          .map((c) => ({ id: c.id, text: c.choice_text })),
        correctAnswers: (q.choices || [])
          .filter((c) => c.is_correct)
          .sort((a, b) => a.choice_order - b.choice_order)
          .map((c) => c.id),
      })),
  };
}

// ── CRUD ───────────────────────────────────────────────────────────────────

export async function getAllQuizzes() {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];

  const { data, error } = await supabase
    .from('quizzes')
    .select('*')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false });

  if (error) throw error;
  return (data || []).map((row) => mapQuiz({ ...row, questions: [] }));
}

export async function getQuizById(id) {
  const { data, error } = await supabase
    .from('quizzes')
    .select(`
      *,
      questions (
        *,
        choices (*)
      )
    `)
    .eq('id', id)
    .single();

  if (error) {
    if (error.code === 'PGRST116') return null; // not found
    throw error;
  }
  return data ? mapQuiz(data) : null;
}

export async function saveQuiz(quiz) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const now = new Date().toISOString();
  const quizId = quiz.id || uuidv4();

  // Upsert the quiz row
  const { error: quizError } = await supabase
    .from('quizzes')
    .upsert({
      id: quizId,
      user_id: user.id,
      title: quiz.title,
      description: quiz.description || null,
      category: quiz.category || null,
      difficulty: quiz.difficulty || null,
      shuffle_questions: quiz.shuffleQuestions ?? false,
      updated_at: now,
      // only set created_at on insert; upsert preserves existing value if already set
      ...(quiz.createdAt ? {} : { created_at: now }),
    }, { onConflict: 'id' });

  if (quizError) throw quizError;

  // Delete existing questions (cascade deletes choices)
  const { error: delError } = await supabase
    .from('questions')
    .delete()
    .eq('quiz_id', quizId);
  if (delError) throw delError;

  // Re-insert questions and choices
  for (let qi = 0; qi < (quiz.questions || []).length; qi++) {
    const q = quiz.questions[qi];
    const questionId = q.id || uuidv4();

    const { error: qError } = await supabase
      .from('questions')
      .insert({
        id: questionId,
        quiz_id: quizId,
        question_text: q.questionText,
        question_type: q.questionType || 'single_choice',
        question_order: qi,
      });
    if (qError) throw qError;

    const correctSet = new Set(q.correctAnswers || []);
    const choiceRows = (q.choices || []).map((c, ci) => ({
      id: c.id || uuidv4(),
      question_id: questionId,
      choice_text: c.text,
      choice_order: ci,
      is_correct: correctSet.has(c.id),
    }));

    if (choiceRows.length > 0) {
      const { error: cError } = await supabase.from('choices').insert(choiceRows);
      if (cError) throw cError;
    }
  }

  return quiz;
}

export async function deleteQuiz(id) {
  const { error } = await supabase.from('quizzes').delete().eq('id', id);
  if (error) throw error;
}

export async function duplicateQuiz(id) {
  const original = await getQuizById(id);
  if (!original) return null;

  const now = new Date().toISOString();
  const copy = {
    ...original,
    id: uuidv4(),
    title: `${original.title} (Copy)`,
    createdAt: now,
    updatedAt: now,
    questions: original.questions.map((q) => ({
      ...q,
      id: uuidv4(),
      choices: q.choices.map((c) => ({ ...c, id: uuidv4() })),
      // Re-map correctAnswers to new choice IDs
      correctAnswers: q.correctAnswers.map((oldId) => {
        const idx = q.choices.findIndex((c) => c.id === oldId);
        return idx >= 0 ? uuidv4() : null;
      }).filter(Boolean),
    })),
  };

  // Re-map correctAnswers with stable new IDs
  const copyWithMappedAnswers = {
    ...copy,
    questions: original.questions.map((q) => {
      const newChoices = q.choices.map((c) => ({ ...c, id: uuidv4() }));
      const idMap = Object.fromEntries(q.choices.map((c, i) => [c.id, newChoices[i].id]));
      return {
        ...q,
        id: uuidv4(),
        choices: newChoices,
        correctAnswers: q.correctAnswers.map((oldId) => idMap[oldId]).filter(Boolean),
      };
    }),
  };

  await saveQuiz(copyWithMappedAnswers);
  return copyWithMappedAnswers;
}

// Kept for backward-compat — no-op with Supabase (trigger creates profile)
export function ensureSeeded() {
  // No-op: seed data is not used with Supabase backend
}
