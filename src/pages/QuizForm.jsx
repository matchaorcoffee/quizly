import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { saveQuiz, getQuizById, regenerateShareToken } from '../data/quizService';
import QuestionEditor, { createEmptyQuestion } from '../components/QuestionEditor';
import { CATEGORIES, DIFFICULTIES } from '../components/FilterControls';
import ConfirmationModal from '../components/ConfirmationModal';
import { useToast } from '../components/Toast';
import './QuizForm.css';

const FORM_CATEGORIES = CATEGORIES.filter((c) => c !== 'All');
const FORM_DIFFICULTIES = DIFFICULTIES.filter((d) => d !== 'All');

const BLANK_TOKEN = '{{blank}}';

function validateQuiz(form, questions) {
  const errors = {};
  const questionErrors = {};

  if (!form.title.trim()) errors.title = 'Quiz title is required.';

  if (questions.length === 0) {
    errors.questions = 'Add at least one question.';
  }

  let hasQuestionErrors = false;
  questions.forEach((q, i) => {
    const qErr = {};
    const qType = q.questionType || 'single_choice';
    const isFillBlank = qType === 'fill_in_blank';
    const isMultiple = qType === 'multiple_choice';

    if (!q.questionText.trim()) {
      qErr.questionText = 'Question text is required.';
    }

    if (isFillBlank) {
      // Must contain exactly one {{blank}}
      const blankCount = (q.questionText.match(/\{\{blank\}\}/g) || []).length;
      if (blankCount === 0) {
        qErr.questionText = `Please add ${BLANK_TOKEN} to indicate where the learner should enter the answer.`;
      } else if (blankCount > 1) {
        qErr.questionText = `Only one ${BLANK_TOKEN} is supported per question.`;
      }

      // Must have at least one non-empty accepted answer, and prevent duplicate accepted answers
      const answers = (q.acceptedAnswers || []).map((a) => (typeof a === 'string' ? a : '').trim()).filter(Boolean);
      if (answers.length === 0) {
        qErr.acceptedAnswers = 'At least one correct answer is required.';
      } else {
        const normalizedSet = new Set();
        let hasDuplicates = false;
        for (const ans of answers) {
          const norm = ans.toLowerCase().replace(/\s+/g, ' ');
          if (normalizedSet.has(norm)) {
            hasDuplicates = true;
            break;
          }
          normalizedSet.add(norm);
        }
        if (hasDuplicates) {
          qErr.acceptedAnswers = 'Duplicate accepted answers are not allowed.';
        }
      }
    } else {
      const emptyChoices = (q.choices || []).filter((c) => !c.text.trim());
      if (emptyChoices.length > 0) qErr.choices = 'All 4 choices must have text.';

      const correctAnswers = q.correctAnswers || [];

      if (isMultiple) {
        if (correctAnswers.length < 2) {
          qErr.correctAnswers = correctAnswers.length === 0
            ? 'Select at least 2 correct answers for a Checkbox question.'
            : 'Checkbox questions must have at least 2 correct answers.';
        }
      } else {
        if (correctAnswers.length === 0) {
          qErr.correctAnswers = 'Select the correct answer.';
        } else if (correctAnswers.length > 1) {
          qErr.correctAnswers = 'Single Choice questions must have exactly 1 correct answer.';
        }
      }
    }

    if (Object.keys(qErr).length) {
      qErr.any = true;
      questionErrors[i] = qErr;
      hasQuestionErrors = true;
    }
  });

  if (hasQuestionErrors) errors.questionErrors = true;

  return { errors, questionErrors, isValid: Object.keys(errors).length === 0 };
}

export default function QuizForm() {
  const navigate = useNavigate();
  const { id } = useParams();
  const { showToast } = useToast();
  const isEditing = Boolean(id);

  const [form, setForm] = useState({
    title: '',
    description: '',
    category: '',
    difficulty: '',
    visibility: 'private',
    shareToken: '',
    shuffleQuestions: false,
  });
  const [questions, setQuestions] = useState([createEmptyQuestion()]);
  const [errors, setErrors] = useState({});
  const [questionErrors, setQuestionErrors] = useState({});
  const [submitted, setSubmitted] = useState(false);
  const [notFound, setNotFound] = useState(false);
  const [loadingForm, setLoadingForm] = useState(isEditing);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');
  const [showRegenModal, setShowRegenModal] = useState(false);
  const [regenerating, setRegenerating] = useState(false);

  useEffect(() => {
    if (!isEditing) return;
    setLoadingForm(true);
    getQuizById(id)
      .then((existing) => {
        if (!existing) { setNotFound(true); return; }
        setForm({
          title: existing.title,
          description: existing.description || '',
          category: existing.category || '',
          difficulty: existing.difficulty || '',
          visibility: existing.visibility || 'private',
          shareToken: existing.shareToken || '',
          shuffleQuestions: existing.shuffleQuestions ?? false,
        });
        setQuestions(existing.questions.map((q) => ({
          ...q,
          questionType: q.questionType || 'single_choice',
          correctAnswers: q.correctAnswers || [],
          choices: (q.choices || []).map((c) => ({ ...c })),
          acceptedAnswers: q.questionType === 'fill_in_blank'
            ? (q.acceptedAnswers?.length ? [...q.acceptedAnswers] : [''])
            : (q.acceptedAnswers || []),
        })));
      })
      .catch(() => setNotFound(true))
      .finally(() => setLoadingForm(false));
  }, [id, isEditing]);

  const updateForm = (field, value) => {
    setForm((f) => ({ ...f, [field]: value }));
    if (submitted) revalidate({ ...form, [field]: value }, questions);
  };

  const updateQuestion = (index, updatedQ) => {
    const updated = questions.map((q, i) => i === index ? updatedQ : q);
    setQuestions(updated);
    if (submitted) revalidate(form, updated);
  };

  const addQuestion = () => {
    const updated = [...questions, createEmptyQuestion()];
    setQuestions(updated);
    if (submitted) revalidate(form, updated);
    setTimeout(() => {
      document.getElementById(`question-${updated.length - 1}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 50);
  };

  const deleteQuestion = (index) => {
    const updated = questions.filter((_, i) => i !== index);
    setQuestions(updated.length > 0 ? updated : [createEmptyQuestion()]);
    if (submitted) revalidate(form, updated);
  };

  const revalidate = (f, qs) => {
    const { errors: e, questionErrors: qe } = validateQuiz(f, qs);
    setErrors(e);
    setQuestionErrors(qe);
  };

  const handleCopyLink = () => {
    const origin = window.location.origin;
    const base = '/quizly';
    const isPub = form.visibility === 'public';
    const link = isPub
      ? `${origin}${base}/quiz/${id}`
      : `${origin}${base}/quiz/private/${form.shareToken}`;

    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(link)
        .then(() => showToast('Share link copied to clipboard! 📋', 'success'))
        .catch(() => showToast('Failed to copy link', 'error'));
    } else {
      showToast('Clipboard not supported', 'error');
    }
  };

  const handleConfirmRegenerate = async () => {
    if (!id) return;
    setRegenerating(true);
    try {
      const newToken = await regenerateShareToken(id);
      setForm((f) => ({ ...f, shareToken: newToken }));
      setShowRegenModal(false);
      showToast('Private share link regenerated!', 'success');
    } catch (err) {
      showToast(err.message || 'Failed to regenerate link', 'error');
    } finally {
      setRegenerating(false);
    }
  };

  const handleSave = async () => {
    setSubmitted(true);
    setSaveError('');
    const { errors: e, questionErrors: qe, isValid } = validateQuiz(form, questions);
    setErrors(e);
    setQuestionErrors(qe);
    if (!isValid) {
      const firstErrorEl = document.querySelector('.question-editor--error, .form-error');
      firstErrorEl?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      return;
    }

    setSaving(true);
    try {
      // For new quizzes, do NOT pass `id` — the database assigns it.
      // For edits, pass the existing id so saveQuiz knows to UPDATE.
      const quiz = {
        ...(isEditing ? { id } : {}),
        title: form.title.trim(),
        description: form.description.trim(),
        category: form.category || 'General',
        difficulty: form.difficulty || 'Easy',
        visibility: form.visibility || 'private',
        shareToken: form.shareToken || undefined,
        shuffleQuestions: form.shuffleQuestions,
        questions,
      };
      await saveQuiz(quiz);
      showToast(isEditing ? 'Quiz updated successfully! ✓' : 'Quiz created successfully! ✓', 'success');
      navigate('/');
    } catch (err) {
      setSaveError(err.message || 'Failed to save quiz. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  if (loadingForm) {
    return (
      <div className="page-container-narrow" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 300 }}>
        <div style={{ width: 36, height: 36, border: '3px solid var(--color-border)', borderTopColor: 'var(--color-primary)', borderRadius: '50%', animation: 'spin 0.7s linear infinite' }} />
      </div>
    );
  }

  if (notFound) {
    return (
      <div className="page-container-narrow">
        <div className="card">
          <div className="empty-state">
            <div className="empty-state-icon">❓</div>
            <h3>Quiz not found</h3>
            <p>The quiz you're trying to edit doesn't exist or may have been deleted.</p>
            <button className="btn btn-primary" onClick={() => navigate('/')}>Back to Dashboard</button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="page-container-narrow quiz-form-page">
      {/* Header */}
      <div className="quiz-form-header">
        <div>
          <h1 className="quiz-form-title">{isEditing ? 'Edit Quiz' : 'Create Quiz'}</h1>
          <p className="quiz-form-subtitle">
            {isEditing ? 'Update your quiz details and questions.' : 'Fill in the details and add your questions below.'}
          </p>
        </div>
      </div>

      {/* Validation summary */}
      {submitted && Object.keys(errors).length > 0 && (
        <div className="alert alert-error" role="alert">
          Please fix the errors below before saving.
        </div>
      )}

      {saveError && (
        <div className="alert alert-error" role="alert">{saveError}</div>
      )}

      {/* Quiz meta */}
      <section className="card quiz-form-section">
        <h2 className="quiz-form-section-title">Quiz Details</h2>
        <div className="quiz-form-fields">
          <div className="form-group">
            <label className="form-label">
              Quiz Title <span className="required">*</span>
            </label>
            <input
              type="text"
              className={`form-input ${errors.title ? 'error' : ''}`}
              value={form.title}
              onChange={(e) => updateForm('title', e.target.value)}
              placeholder="e.g. JavaScript Basics"
              maxLength={120}
            />
            {errors.title && <p className="form-error">{errors.title}</p>}
          </div>

          <div className="form-group">
            <label className="form-label">Description</label>
            <textarea
              className="form-textarea"
              value={form.description}
              onChange={(e) => updateForm('description', e.target.value)}
              placeholder="What is this quiz about? (optional)"
              rows={2}
              maxLength={500}
            />
          </div>

          <div className="quiz-form-row">
            <div className="form-group">
              <label className="form-label">Category</label>
              <select
                className="form-select"
                value={form.category}
                onChange={(e) => updateForm('category', e.target.value)}
              >
                <option value="">Select category…</option>
                {FORM_CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Difficulty</label>
              <select
                className="form-select"
                value={form.difficulty}
                onChange={(e) => updateForm('difficulty', e.target.value)}
              >
                <option value="">Select difficulty…</option>
                {FORM_DIFFICULTIES.map((d) => <option key={d} value={d}>{d}</option>)}
              </select>
            </div>
          </div>

          {/* Visibility Segmented Control */}
          <div className="form-group">
            <label className="form-label">Visibility</label>
            <div className="segmented-control" role="radiogroup" aria-label="Quiz visibility">
              <button
                type="button"
                role="radio"
                aria-checked={form.visibility === 'private'}
                className={`segmented-btn ${form.visibility === 'private' ? 'active' : ''}`}
                onClick={() => updateForm('visibility', 'private')}
              >
                <span className="segmented-icon">🔒</span> Private
              </button>
              <button
                type="button"
                role="radio"
                aria-checked={form.visibility === 'public'}
                className={`segmented-btn ${form.visibility === 'public' ? 'active' : ''}`}
                onClick={() => updateForm('visibility', 'public')}
              >
                <span className="segmented-icon">🌎</span> Public
              </button>
            </div>
            <span className="form-hint">
              {form.visibility === 'public'
                ? 'Anyone can find and play this quiz in the Explore tab.'
                : 'Hidden from Explore. Only accessible to you and anyone with the share link.'}
            </span>
          </div>

          {/* Shuffle toggle */}
          <div className="shuffle-toggle-row">
            <div className="shuffle-toggle-text">
              <span className="form-label" style={{ marginBottom: 0 }}>Shuffle Questions</span>
              <span className="form-hint">Randomize the order of questions each time this quiz is taken.</span>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={form.shuffleQuestions}
              className={`toggle-switch ${form.shuffleQuestions ? 'toggle-switch--on' : ''}`}
              onClick={() => updateForm('shuffleQuestions', !form.shuffleQuestions)}
              aria-label="Toggle shuffle questions"
            >
              <span className="toggle-switch-thumb" />
              <span className="toggle-switch-label">
                {form.shuffleQuestions ? 'ON' : 'OFF'}
              </span>
            </button>
          </div>
        </div>
      </section>

      {/* Sharing Section (shown when editing) */}
      {isEditing && (
        <section className="card quiz-form-section quiz-sharing-section animate-in">
          <h2 className="quiz-form-section-title">
            <span>🔗 Sharing & Link</span>
          </h2>
          <div className="sharing-content">
            <div className="sharing-status">
              <span className="sharing-status-label">Current Status:</span>
              <span className={`badge ${form.visibility === 'public' ? 'badge-public' : 'badge-private'}`}>
                {form.visibility === 'public' ? '🌎 Public' : '🔒 Private'}
              </span>
            </div>
            <p className="sharing-desc">
              {form.visibility === 'public'
                ? 'This quiz is public. Anyone with the direct link or browsing Explore can take it.'
                : 'This quiz is private. Only people who receive the secret link below can access it.'}
            </p>

            <div className="sharing-actions">
              <button
                type="button"
                className="btn btn-primary"
                onClick={handleCopyLink}
              >
                📋 Copy Share Link
              </button>
              {form.visibility === 'private' && (
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setShowRegenModal(true)}
                  disabled={regenerating}
                >
                  🔄 Regenerate Link
                </button>
              )}
            </div>
          </div>
        </section>
      )}

      {/* Questions */}
      <section className="quiz-form-section">
        <div className="quiz-form-questions-header">
          <h2 className="quiz-form-section-title">
            Questions
            <span className="dashboard-count">{questions.length}</span>
          </h2>
          <button type="button" className="btn btn-secondary" onClick={addQuestion}>
            + Add Question
          </button>
        </div>

        {errors.questions && (
          <div className="alert alert-error" style={{ marginBottom: 12 }}>{errors.questions}</div>
        )}

        <div className="questions-list">
          {questions.map((q, i) => (
            <div key={q.id} id={`question-${i}`}>
              <QuestionEditor
                question={q}
                index={i}
                onUpdate={(updated) => updateQuestion(i, updated)}
                onDelete={() => deleteQuestion(i)}
                errors={questionErrors[i]}
              />
            </div>
          ))}
        </div>

        <button type="button" className="btn btn-secondary add-question-btn" onClick={addQuestion}>
          + Add Question
        </button>
      </section>

      {/* Actions */}
      <div className="quiz-form-actions">
        <button type="button" className="btn btn-secondary" onClick={() => navigate('/')} disabled={saving}>
          Cancel
        </button>
        <button type="button" className="btn btn-primary btn-lg" onClick={handleSave} disabled={saving}>
          {saving ? <span style={{ display: 'inline-block', width: 14, height: 14, border: '2px solid rgba(255,255,255,0.4)', borderTopColor: '#fff', borderRadius: '50%', animation: 'spin 0.7s linear infinite' }} /> : null}
          {saving ? ' Saving…' : isEditing ? '💾 Save Changes' : '✓ Save Quiz'}
        </button>
      </div>

      {/* Regenerate Confirmation Modal */}
      <ConfirmationModal
        isOpen={showRegenModal}
        title="Regenerate Share Link"
        message="Are you sure you want to regenerate the share link? Anyone with the previous private link will immediately lose access."
        confirmLabel="Regenerate"
        cancelLabel="Cancel"
        variant="danger"
        onConfirm={handleConfirmRegenerate}
        onCancel={() => setShowRegenModal(false)}
      />
    </div>
  );
}
