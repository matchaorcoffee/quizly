import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { v4 as uuidv4 } from 'uuid';
import { saveQuiz, getQuizById } from '../data/quizService';
import QuestionEditor, { createEmptyQuestion } from '../components/QuestionEditor';
import { CATEGORIES, DIFFICULTIES } from '../components/FilterControls';
import './QuizForm.css';

const FORM_CATEGORIES = CATEGORIES.filter((c) => c !== 'All');
const FORM_DIFFICULTIES = DIFFICULTIES.filter((d) => d !== 'All');

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
    if (!q.questionText.trim()) qErr.questionText = 'Question text is required.';
    const emptyChoices = q.choices.filter((c) => !c.text.trim());
    if (emptyChoices.length > 0) qErr.choices = 'All 4 choices must have text.';

    const correctAnswers = q.correctAnswers || [];
    const isMultiple = q.questionType === 'multiple_choice';

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
  const isEditing = Boolean(id);

  const [form, setForm] = useState({
    title: '',
    description: '',
    category: '',
    difficulty: '',
    shuffleQuestions: false,
  });
  const [questions, setQuestions] = useState([createEmptyQuestion()]);
  const [errors, setErrors] = useState({});
  const [questionErrors, setQuestionErrors] = useState({});
  const [submitted, setSubmitted] = useState(false);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    if (isEditing) {
      const existing = getQuizById(id);
      if (!existing) {
        setNotFound(true);
        return;
      }
      setForm({
        title: existing.title,
        description: existing.description || '',
        category: existing.category || '',
        difficulty: existing.difficulty || '',
        shuffleQuestions: existing.shuffleQuestions ?? false,
      });
      setQuestions(existing.questions.map((q) => ({
        ...q,
        questionType: q.questionType || 'single_choice',
        correctAnswers: q.correctAnswers || (q.correctAnswer ? [q.correctAnswer] : []),
        choices: q.choices.map((c) => ({ ...c })),
      })));
    }
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

  const handleSave = () => {
    setSubmitted(true);
    const { errors: e, questionErrors: qe, isValid } = validateQuiz(form, questions);
    setErrors(e);
    setQuestionErrors(qe);
    if (!isValid) {
      // Scroll to first error
      const firstErrorEl = document.querySelector('.question-editor--error, .form-error');
      firstErrorEl?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      return;
    }

    const now = new Date().toISOString();
    const quiz = {
      id: isEditing ? id : uuidv4(),
      title: form.title.trim(),
      description: form.description.trim(),
      category: form.category || 'General',
      difficulty: form.difficulty || 'Easy',
      shuffleQuestions: form.shuffleQuestions,
      isSeed: false,
      createdAt: isEditing ? getQuizById(id)?.createdAt || now : now,
      updatedAt: now,
      questions,
    };

    saveQuiz(quiz);
    navigate('/');
  };

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
        <button type="button" className="btn btn-secondary" onClick={() => navigate('/')}>
          Cancel
        </button>
        <button type="button" className="btn btn-primary btn-lg" onClick={handleSave}>
          {isEditing ? '💾 Save Changes' : '✓ Save Quiz'}
        </button>
      </div>
    </div>
  );
}
