/**
 * Quiz Storage Service
 * Abstracts all quiz persistence. Currently uses localStorage.
 * Replace the read/write helpers to swap in a real backend.
 */

import { v4 as uuidv4 } from 'uuid';
import { SEED_QUIZZES } from './seedData';

const STORAGE_KEY = 'quizly_quizzes';
const SEEDED_KEY = 'quizly_seeded_v2'; // bumped when seed data changes

// ── Low-level helpers ──────────────────────────────────────────────────────

/** Migrate legacy single correctAnswer → correctAnswers array */
function migrateQuestion(q) {
  const hasLegacy = q.correctAnswer !== undefined && !q.correctAnswers;
  return {
    ...q,
    questionType: q.questionType || 'single_choice',
    correctAnswers: q.correctAnswers
      ? q.correctAnswers
      : hasLegacy && q.correctAnswer
        ? [q.correctAnswer]
        : [],
  };
}

function readAll() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const quizzes = JSON.parse(raw);
    return quizzes.map((quiz) => ({
      ...quiz,
      questions: (quiz.questions || []).map(migrateQuestion),
    }));
  } catch {
    return [];
  }
}

function writeAll(quizzes) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(quizzes));
    return true;
  } catch {
    return false;
  }
}

// ── Seeding ────────────────────────────────────────────────────────────────

export function ensureSeeded() {
  if (localStorage.getItem(SEEDED_KEY)) return;
  const existing = readAll();
  if (existing.length === 0) {
    writeAll(SEED_QUIZZES);
  }
  localStorage.setItem(SEEDED_KEY, '1');
}

// ── CRUD ───────────────────────────────────────────────────────────────────

export function getAllQuizzes() {
  return readAll();
}

export function getQuizById(id) {
  return readAll().find((q) => q.id === id) || null;
}

export function saveQuiz(quiz) {
  const all = readAll();
  const idx = all.findIndex((q) => q.id === quiz.id);
  const now = new Date().toISOString();
  if (idx >= 0) {
    all[idx] = { ...quiz, updatedAt: now };
  } else {
    all.push({ ...quiz, createdAt: now, updatedAt: now });
  }
  writeAll(all);
  return quiz;
}

export function deleteQuiz(id) {
  const all = readAll().filter((q) => q.id !== id);
  writeAll(all);
}

export function duplicateQuiz(id) {
  const original = getQuizById(id);
  if (!original) return null;
  const now = new Date().toISOString();
  const copy = {
    ...original,
    id: uuidv4(),
    title: `${original.title} (Copy)`,
    isSeed: false,
    createdAt: now,
    updatedAt: now,
    questions: original.questions.map((q) => ({
      ...q,
      id: uuidv4(),
      choices: q.choices.map((c) => ({ ...c, id: uuidv4() })),
    })),
  };
  saveQuiz(copy);
  return copy;
}
