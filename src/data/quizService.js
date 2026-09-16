/**
 * Quiz Storage Service — Supabase backend
 *
 * All functions are async. Data shape returned to components:
 * {
 *   id, userId, title, description, category, difficulty,
 *   visibility, shareToken, shuffleQuestions,
 *   createdAt, updatedAt, creatorName,
 *   questions: [
 *     { id, questionText, questionType,
 *       choices: [{ id, text }],
 *       correctAnswers: ['choice-id', ...] }
 *   ]
 * }
 */

import { supabase } from '../lib/supabase';
import { v4 as uuidv4 } from 'uuid';
import { SEED_QUIZZES } from './seedData';

// ── Dev logging ────────────────────────────────────────────────────────────
// Logs only in dev builds; stripped in production by Vite's tree-shaking.
const DEV = import.meta.env.DEV;
function log(...args) {
  if (DEV) console.log('[QuizService]', ...args);
}
function logError(action, error, details = {}) {
  if (DEV) {
    console.error(`[QuizService ERROR] ${action}:`, {
      message: error?.message,
      code: error?.code,
      details: error?.details,
      hint: error?.hint,
      ...details,
    });
  }
}

// ── Shape mappers ──────────────────────────────────────────────────────────

/** Map a DB quiz row + nested questions/choices → component shape */
function mapQuiz(row) {
  return {
    id: row.id,
    userId: row.user_id,
    title: row.title,
    description: row.description || '',
    category: row.category || '',
    difficulty: row.difficulty || '',
    visibility: row.visibility || 'private',
    shareToken: row.share_token || null,
    shuffleQuestions: row.shuffle_questions ?? false,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    creatorName: row.profiles?.full_name || row.profiles?.email?.split('@')[0] || null,
    questions: (row.questions || [])
      .sort((a, b) => a.question_order - b.question_order)
      .map((q) => {
        const qType = q.question_type || 'single_choice';
        const isFillBlank = qType === 'fill_in_blank';
        return {
          id: q.id,
          questionText: q.question_text,
          questionType: qType,
          // choices only used for single_choice / multiple_choice
          choices: isFillBlank ? [] : (q.choices || [])
            .sort((a, b) => a.choice_order - b.choice_order)
            .map((c) => ({ id: c.id, text: c.choice_text })),
          correctAnswers: isFillBlank ? [] : (q.choices || [])
            .filter((c) => c.is_correct)
            .sort((a, b) => a.choice_order - b.choice_order)
            .map((c) => c.id),
          // fill_in_blank: accepted answer strings
          acceptedAnswers: isFillBlank
            ? (q.question_answers || []).map((a) => a.answer_text).filter(Boolean)
            : [],
        };
      }),
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

  if (error) {
    logError('getAllQuizzes query failed', error, { table: 'quizzes' });
    throw error;
  }
  return (data || []).map((row) => mapQuiz({ ...row, questions: [] }));
}

export async function getPublicQuizzes() {
  const { data, error } = await supabase
    .from('quizzes')
    .select(`
      *,
      profiles:user_id (
        full_name,
        email
      ),
      questions (
        id,
        question_type
      )
    `)
    .eq('visibility', 'public')
    .order('created_at', { ascending: false });

  if (error) {
    logError('getPublicQuizzes query failed', error, { table: 'quizzes' });
    throw error;
  }
  return (data || []).map((row) => ({
    ...mapQuiz(row),
    questions: row.questions || [],
  }));
}

export async function getQuizById(id) {
  const { data, error } = await supabase
    .from('quizzes')
    .select(`
      *,
      profiles:user_id (
        full_name,
        email
      ),
      questions (
        *,
        choices (*),
        question_answers (*)
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

export async function getQuizByShareToken(token) {
  if (!token) return null;

  // 1. Try the SECURITY DEFINER RPC first (bypasses RLS)
  const { data: rpcData, error: rpcError } = await supabase.rpc('get_quiz_by_share_token', {
    p_token: token,
  });

  if (!rpcError && rpcData) {
    return mapQuiz(rpcData);
  }

  // 2. Fallback: direct query (if schema v2 RPC not run yet or in local/public scenarios)
  const { data, error } = await supabase
    .from('quizzes')
    .select(`
      *,
      profiles:user_id (
        full_name,
        email
      ),
      questions (
        *,
        choices (*),
        question_answers (*)
      )
    `)
    .eq('share_token', token)
    .maybeSingle();

  if (error) {
    if (error.code === 'PGRST116') return null;
    throw error;
  }
  return data ? mapQuiz(data) : null;
}

export async function regenerateShareToken(quizId) {
  const newToken = uuidv4();
  const { data, error } = await supabase
    .from('quizzes')
    .update({ share_token: newToken, updated_at: new Date().toISOString() })
    .eq('id', quizId)
    .select('share_token')
    .single();

  if (error) throw error;
  return data?.share_token || newToken;
}

export async function saveQuiz(quiz) {
  // ── Step 1: Verify authentication ────────────────────────
  const { data: authData, error: authError } = await supabase.auth.getUser();
  if (authError || !authData?.user) {
    logError('Auth check failed', authError, { table: 'auth.users' });
    throw new Error('Your session has expired. Please sign in again.');
  }
  const user = authData.user;
  log('Authenticated user:', user.id);

  const isEditing = Boolean(quiz.id);
  const now = new Date().toISOString();
  const shareToken = quiz.shareToken || uuidv4();
  const visibility = quiz.visibility || 'private';

  // ── Step 2: Save the quiz row ────────────────────────────
  // For new quizzes: INSERT and get back the DB-assigned id.
  // For existing quizzes: UPDATE only fields that can change.
  let savedQuizId;

  if (!isEditing) {
    log('Inserting new quiz…');
    const { data: insertedQuiz, error: insertError } = await supabase
      .from('quizzes')
      .insert({
        user_id: user.id,
        title: quiz.title,
        description: quiz.description || null,
        category: quiz.category || null,
        difficulty: quiz.difficulty || null,
        visibility,
        share_token: shareToken,
        shuffle_questions: quiz.shuffleQuestions ?? false,
        created_at: now,
        updated_at: now,
      })
      .select('id, user_id, title, visibility, share_token')
      .single();

    if (insertError) {
      logError('Quiz insert failed', insertError, { table: 'quizzes' });
      throw new Error(`Failed to create quiz: ${insertError.message}`);
    }
    if (!insertedQuiz?.id) {
      logError('Quiz insert returned no row', new Error('No row returned'), { table: 'quizzes' });
      throw new Error('Quiz could not be saved. Please check your connection and try again.');
    }
    savedQuizId = insertedQuiz.id;
    log('Quiz inserted:', savedQuizId, '| visibility:', insertedQuiz.visibility);

  } else {
    savedQuizId = quiz.id;
    log('Updating existing quiz:', savedQuizId);
    const { data: updatedQuiz, error: updateError } = await supabase
      .from('quizzes')
      .update({
        title: quiz.title,
        description: quiz.description || null,
        category: quiz.category || null,
        difficulty: quiz.difficulty || null,
        visibility,
        share_token: shareToken,
        shuffle_questions: quiz.shuffleQuestions ?? false,
        updated_at: now,
      })
      .eq('id', savedQuizId)
      .eq('user_id', user.id)   // safety: only update your own quiz
      .select('id, user_id, title, visibility')
      .single();

    if (updateError) {
      logError('Quiz update failed', updateError, { table: 'quizzes', quizId: savedQuizId });
      throw new Error(`Failed to update quiz: ${updateError.message}`);
    }
    if (!updatedQuiz?.id) {
      logError('Quiz update returned no row', new Error('No row returned'), { table: 'quizzes', quizId: savedQuizId });
      throw new Error('Quiz could not be updated. Make sure you own this quiz.');
    }
    log('Quiz updated:', updatedQuiz.id);
  }

  // ── Step 3: Delete existing questions (cascade-deletes choices) ──
  log('Deleting existing questions for quiz:', savedQuizId);
  const { error: delError } = await supabase
    .from('questions')
    .delete()
    .eq('quiz_id', savedQuizId);
  if (delError) {
    logError('Question delete failed', delError, { table: 'questions', quizId: savedQuizId });
    throw new Error(`Failed to clear old questions: ${delError.message}`);
  }

  // ── Step 4: Insert questions + choices OR accepted answers ──
  const allQuestions = quiz.questions || [];
  log(`Inserting ${allQuestions.length} question(s)…`);

  for (let qi = 0; qi < allQuestions.length; qi++) {
    const q = allQuestions[qi];
    const qType = q.questionType || 'single_choice';
    const isFillBlank = qType === 'fill_in_blank';

    // Insert the question, get back the DB-assigned id
    const { data: insertedQuestion, error: qError } = await supabase
      .from('questions')
      .insert({
        quiz_id: savedQuizId,
        question_text: q.questionText,
        question_type: qType,
        question_order: qi,
      })
      .select('id')
      .single();

    if (qError) {
      logError(`Question ${qi + 1} insert failed`, qError, { table: 'questions', questionIndex: qi });
      throw new Error(`Failed to save question ${qi + 1}: ${qError.message}`);
    }
    if (!insertedQuestion?.id) {
      logError(`Question ${qi + 1} insert returned no row`, new Error('No row returned'), { table: 'questions', questionIndex: qi });
      throw new Error(`Question ${qi + 1} could not be saved. Please try again.`);
    }
    const questionId = insertedQuestion.id;
    log(`Question ${qi + 1} inserted:`, questionId, '| type:', qType);

    if (isFillBlank) {
      // Insert accepted answers into question_answers (not choices)
      const answers = (q.acceptedAnswers || [])
        .map((a) => (typeof a === 'string' ? a : a.text || '').trim())
        .filter(Boolean);

      if (answers.length === 0) {
        throw new Error(`Question ${qi + 1}: at least one accepted answer is required.`);
      }

      const answerRows = answers.map((text) => ({
        question_id: questionId,
        answer_text: text,
      }));

      const { error: aError } = await supabase
        .from('question_answers')
        .insert(answerRows);

      if (aError) {
        logError(`Accepted answers for question ${qi + 1} failed`, aError, { table: 'question_answers', questionId });
        throw new Error(`Failed to save accepted answers for question ${qi + 1}: ${aError.message}`);
      }
      log(`Accepted answers for question ${qi + 1} inserted (${answerRows.length} rows)`);
    } else {
      // Insert choices for single_choice / multiple_choice
      const correctSet = new Set(q.correctAnswers || []);
      const choiceRows = (q.choices || []).map((c, ci) => ({
        question_id: questionId,
        choice_text: c.text,
        choice_order: ci,
        is_correct: correctSet.has(c.id),
      }));

      if (choiceRows.length > 0) {
        const { error: cError } = await supabase
          .from('choices')
          .insert(choiceRows);

        if (cError) {
          logError(`Choices for question ${qi + 1} failed`, cError, { table: 'choices', questionId });
          throw new Error(`Failed to save choices for question ${qi + 1}: ${cError.message}`);
        }
        log(`Choices for question ${qi + 1} inserted (${choiceRows.length} rows)`);
      }
    }
  }

  log('Quiz save completed successfully. Quiz ID:', savedQuizId);
  return { ...quiz, id: savedQuizId, userId: user.id, visibility, shareToken };
}

export async function deleteQuiz(id) {
  const { error } = await supabase.from('quizzes').delete().eq('id', id);
  if (error) throw error;
}

export async function duplicateQuiz(id) {
  const original = await getQuizById(id);
  if (!original) return null;

  const now = new Date().toISOString();
  const copyWithMappedAnswers = {
    ...original,
    id: uuidv4(),
    title: `${original.title} (Copy)`,
    shareToken: uuidv4(),
    createdAt: now,
    updatedAt: now,
    questions: original.questions.map((q) => {
      if (q.questionType === 'fill_in_blank') {
        // Preserve accepted answers as-is for the duplicate
        return {
          ...q,
          id: uuidv4(),
          acceptedAnswers: [...(q.acceptedAnswers || [])],
        };
      }
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

/**
 * If the user has no quizzes yet, insert the seed quizzes as their own quizzes.
 * Uses a stable localStorage flag per user to avoid re-seeding on every login.
 */
export async function seedQuizzesForNewUser(userId) {
  const flagKey = `quizly_seeded_${userId}`;
  if (localStorage.getItem(flagKey)) return; // already seeded for this user

  // Check whether the user already has quizzes in the DB
  const { count, error } = await supabase
    .from('quizzes')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId);

  if (error || count > 0) {
    // Has existing quizzes — mark as seeded and bail
    localStorage.setItem(flagKey, '1');
    return;
  }

  // Insert each seed quiz with fresh IDs so they don't collide across users
  for (const seed of SEED_QUIZZES) {
    const quizId = uuidv4();
    const now = new Date().toISOString();

    const { error: qErr } = await supabase.from('quizzes').insert({
      id: quizId,
      user_id: userId,
      title: seed.title,
      description: seed.description,
      category: seed.category,
      difficulty: seed.difficulty,
      visibility: 'private',
      share_token: uuidv4(),
      shuffle_questions: false,
      created_at: now,
      updated_at: now,
    });
    if (qErr) continue; // skip on error, don't block the user

    for (let qi = 0; qi < seed.questions.length; qi++) {
      const q = seed.questions[qi];
      const questionId = uuidv4();

      const { error: qqErr } = await supabase.from('questions').insert({
        id: questionId,
        quiz_id: quizId,
        question_text: q.questionText,
        question_type: q.questionType || 'single_choice',
        question_order: qi,
      });
      if (qqErr) continue;

      // Build a stable old→new choice ID mapping so correctAnswers translate correctly
      const choiceRows = q.choices.map((c, ci) => {
        const newId = uuidv4();
        return {
          id: newId,
          question_id: questionId,
          choice_text: c.text,
          choice_order: ci,
          is_correct: (q.correctAnswers || []).includes(c.id),
        };
      });

      await supabase.from('choices').insert(choiceRows);
    }
  }

  localStorage.setItem(flagKey, '1');
}

// Kept for backward-compat
export function ensureSeeded() {
  // No-op: seeding is handled by seedQuizzesForNewUser() in AuthContext
}
