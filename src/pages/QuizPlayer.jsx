import { useState, useEffect, useRef } from 'react';
import { useNavigate, useParams, useLocation } from 'react-router-dom';
import { getQuizById } from '../data/quizService';
import ProgressBar from '../components/ProgressBar';
import ConfirmationModal from '../components/ConfirmationModal';
import './QuizPlayer.css';

const CHOICE_LABELS = ['A', 'B', 'C', 'D'];
const BLANK_TOKEN = '{{blank}}';

/**
 * Fisher-Yates shuffle — returns a NEW array, never mutates the original.
 */
function shuffleArray(arr) {
  const out = [...arr];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

/**
 * Renders a fill-in-blank question with an inline text input replacing {{blank}}.
 * answers shape: { [questionId]: string[] }  — for FIB the array holds [typedText]
 */
function FillInBlankQuestion({ question, answers, onAnswer }) {
  const parts = question.questionText.split(BLANK_TOKEN);
  const typed = (answers[question.id] || [])[0] ?? '';

  return (
    <div className="fib-question-wrap">
      <p className="fib-inline-text" aria-label={`Question: ${question.questionText}`}>
        {parts.map((part, i) => (
          <span key={i}>
            {part}
            {i < parts.length - 1 && (
              <input
                type="text"
                className="fib-inline-input"
                value={typed}
                onChange={(e) => onAnswer(question.id, e.target.value)}
                placeholder="Type answer…"
                aria-label="Fill in the blank"
                autoComplete="off"
                spellCheck="false"
                maxLength={200}
              />
            )}
          </span>
        ))}
      </p>
    </div>
  );
}

/**
 * answers shape: { [questionId]: string[] }
 * For single/multiple choice: array of selected choice IDs
 * For fill_in_blank: array with one string [typedText]
 */
export default function QuizPlayer() {
  const navigate = useNavigate();
  const { id } = useParams();
  const location = useLocation();
  const preloadedQuiz = location.state?.preloadedQuiz;

  const [quiz, setQuiz] = useState(preloadedQuiz || null);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers, setAnswers] = useState({});
  const [showSubmitModal, setShowSubmitModal] = useState(false);
  const [notFound, setNotFound] = useState(false);
  const [loading, setLoading] = useState(!preloadedQuiz);
  const [loadError, setLoadError] = useState('');

  // Stable ref so shuffled order is computed exactly once per mount.
  const sessionQuestionsRef = useRef(null);

  useEffect(() => {
    if (preloadedQuiz && preloadedQuiz.questions?.length > 0) {
      setQuiz(preloadedQuiz);
      sessionQuestionsRef.current = preloadedQuiz.shuffleQuestions
        ? shuffleArray(preloadedQuiz.questions)
        : [...preloadedQuiz.questions];
      setLoading(false);
      return;
    }

    setLoading(true);
    getQuizById(id)
      .then((q) => {
        if (!q || !q.questions || q.questions.length === 0) {
          setNotFound(true);
          return;
        }
        setQuiz(q);
        sessionQuestionsRef.current = q.shuffleQuestions
          ? shuffleArray(q.questions)
          : [...q.questions];
      })
      .catch((err) => {
        setLoadError(err.message || 'Failed to load quiz.');
      })
      .finally(() => setLoading(false));
  }, [id, preloadedQuiz]);

  if (loading) {
    return (
      <div className="page-container-narrow" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 300 }}>
        <div style={{ width: 36, height: 36, border: '3px solid var(--color-border)', borderTopColor: 'var(--color-primary)', borderRadius: '50%', animation: 'spin 0.7s linear infinite' }} />
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="page-container-narrow">
        <div className="alert alert-error" role="alert">{loadError}</div>
        <button className="btn btn-secondary" style={{ marginTop: 16 }} onClick={() => navigate('/explore')}>← Browse Quizzes</button>
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
            <p>This quiz doesn't exist, is private, or may have been deleted.</p>
            <div style={{ display: 'flex', gap: 10, marginTop: 8 }}>
              <button className="btn btn-primary" onClick={() => navigate('/explore')}>Explore Quizzes</button>
              <button className="btn btn-secondary" onClick={() => navigate('/')}>Dashboard</button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!quiz || !sessionQuestionsRef.current) return null;

  const questions = sessionQuestionsRef.current;
  const totalQ = questions.length;
  const currentQ = questions[currentIndex];
  const isMultiple = currentQ.questionType === 'multiple_choice';
  const isFillBlank = currentQ.questionType === 'fill_in_blank';

  // Selected IDs for choice questions; typed text for fill-in-blank
  const selectedIds = answers[currentQ.id] || [];

  // A question is "answered" if:
  // - choice: at least one ID selected
  // - fill_in_blank: typed text is non-empty
  const answeredCount = Object.values(answers).filter((arr) => arr.length > 0 && (arr[0] !== '')).length;
  const isLast = currentIndex === totalQ - 1;

  const selectSingle = (choiceId) => {
    setAnswers((prev) => ({ ...prev, [currentQ.id]: [choiceId] }));
  };

  const toggleMulti = (choiceId) => {
    const current = answers[currentQ.id] || [];
    const updated = current.includes(choiceId)
      ? current.filter((c) => c !== choiceId)
      : [...current, choiceId];
    setAnswers((prev) => ({ ...prev, [currentQ.id]: updated }));
  };

  const setFillBlankAnswer = (questionId, text) => {
    setAnswers((prev) => ({ ...prev, [questionId]: text ? [text] : [] }));
  };

  const goNext = () => { if (currentIndex < totalQ - 1) setCurrentIndex(currentIndex + 1); };
  const goPrev = () => { if (currentIndex > 0) setCurrentIndex(currentIndex - 1); };

  const submitQuiz = () => {
    const unanswered = totalQ - answeredCount;
    if (unanswered > 0) setShowSubmitModal(true);
    else doSubmit();
  };

  const doSubmit = () => {
    navigate(`/results/${id}`, { state: { answers, questions, quiz } });
  };

  // Type tag for the current question
  const typeTag = isFillBlank
    ? <span className="player-type-tag player-type-tag--fib">▭ Fill in the blank</span>
    : isMultiple
      ? <span className="player-type-tag player-type-tag--multi">☑ Select all that apply</span>
      : <span className="player-type-tag player-type-tag--single">◉ Choose one answer</span>;

  return (
    <div className="page-container-narrow quiz-player">
      {/* Quiz Header */}
      <div className="player-header">
        <div className="player-header-top">
          <button className="btn btn-ghost btn-sm" onClick={() => navigate(-1)}>← Back</button>
          <div className="player-header-top-right">
            {quiz.shuffleQuestions && (
              <span className="player-shuffle-badge" title="Questions are shuffled for this attempt">
                🔀 Shuffled
              </span>
            )}
            <span className="player-progress-label">Question {currentIndex + 1} of {totalQ}</span>
          </div>
        </div>
        <h1 className="player-title">{quiz.title}</h1>
        <div className="player-progress-wrap">
          <ProgressBar
            value={answeredCount}
            max={totalQ}
            label={`${answeredCount} of ${totalQ} answered`}
            animated={answeredCount < totalQ}
          />
        </div>
        <div className="player-dots">
          {questions.map((q, i) => {
            const ans = answers[q.id] || [];
            const isAnswered = ans.length > 0 && ans[0] !== '';
            return (
              <button
                key={q.id}
                className={`player-dot ${i === currentIndex ? 'current' : ''} ${isAnswered ? 'answered' : ''}`}
                onClick={() => setCurrentIndex(i)}
                aria-label={`Go to question ${i + 1}${isAnswered ? ' (answered)' : ''}`}
                title={`Q${i + 1}`}
              />
            );
          })}
        </div>
      </div>

      {/* Question Card */}
      <div className="card player-question-card animate-in" key={currentQ.id}>
        <div className="player-question-type-badge">{typeTag}</div>

        {isFillBlank ? (
          <FillInBlankQuestion
            question={currentQ}
            answers={answers}
            onAnswer={setFillBlankAnswer}
          />
        ) : (
          <>
            <p className="player-question-text">{currentQ.questionText}</p>
            <div className="player-choices">
              {currentQ.choices.map((choice, ci) => {
                const isSelected = selectedIds.includes(choice.id);
                return (
                  <button
                    key={choice.id}
                    className={`player-choice ${isSelected ? 'player-choice--selected' : ''}`}
                    onClick={() => isMultiple ? toggleMulti(choice.id) : selectSingle(choice.id)}
                    role={isMultiple ? 'checkbox' : 'radio'}
                    aria-checked={isSelected}
                  >
                    <span className={`player-choice-control ${isMultiple ? 'player-choice-control--checkbox' : ''} ${isSelected ? 'player-choice-control--checked' : ''}`}>
                      {isSelected ? (isMultiple ? '✓' : '●') : ''}
                    </span>
                    <span className="player-choice-label">{CHOICE_LABELS[ci]}</span>
                    <span className="player-choice-text">{choice.text}</span>
                  </button>
                );
              })}
            </div>
            {isMultiple && selectedIds.length > 0 && (
              <p className="player-multi-hint">
                {selectedIds.length} answer{selectedIds.length !== 1 ? 's' : ''} selected
              </p>
            )}
          </>
        )}
      </div>

      {/* Navigation */}
      <div className="player-nav">
        <button className="btn btn-secondary" onClick={goPrev} disabled={currentIndex === 0}>
          ← Previous
        </button>
        <div className="player-nav-center">
          {isLast ? (
            <button className="btn btn-success btn-lg" onClick={submitQuiz}>Submit Quiz ✓</button>
          ) : (
            <button className="btn btn-primary" onClick={goNext}>Next →</button>
          )}
        </div>
        {!isLast ? (
          <button className="btn btn-ghost btn-sm" onClick={submitQuiz}>Submit</button>
        ) : (
          <div />
        )}
      </div>

      <ConfirmationModal
        isOpen={showSubmitModal}
        title="Submit Quiz?"
        message={`You have answered ${answeredCount} of ${totalQ} question${totalQ !== 1 ? 's' : ''}. Unanswered questions will be marked incorrect. Submit anyway?`}
        confirmLabel="Submit Quiz"
        cancelLabel="Keep Answering"
        variant="primary"
        onConfirm={doSubmit}
        onCancel={() => setShowSubmitModal(false)}
      />
    </div>
  );
}
