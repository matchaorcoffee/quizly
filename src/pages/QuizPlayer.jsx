import { useState, useEffect, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { getQuizById } from '../data/quizService';
import ProgressBar from '../components/ProgressBar';
import ConfirmationModal from '../components/ConfirmationModal';
import './QuizPlayer.css';

const CHOICE_LABELS = ['A', 'B', 'C', 'D'];

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
 * answers shape: { [questionId]: string[] }
 * Always an array of selected choice IDs, even for single-choice.
 */
export default function QuizPlayer() {
  const navigate = useNavigate();
  const { id } = useParams();
  const [quiz, setQuiz] = useState(null);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers, setAnswers] = useState({});
  const [showSubmitModal, setShowSubmitModal] = useState(false);
  const [notFound, setNotFound] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');

  // Stable ref so shuffled order is computed exactly once per mount.
  const sessionQuestionsRef = useRef(null);

  useEffect(() => {
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
  }, [id]);

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
        <button className="btn btn-secondary" style={{ marginTop: 16 }} onClick={() => navigate('/')}>← Back to Dashboard</button>
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
            <p>This quiz doesn't exist or may have been deleted.</p>
            <button className="btn btn-primary" onClick={() => navigate('/')}>Back to Dashboard</button>
          </div>
        </div>
      </div>
    );
  }

  if (!quiz || !sessionQuestionsRef.current) return null;

  // Use the stable session order for all rendering and navigation.
  const questions = sessionQuestionsRef.current;
  const totalQ = questions.length;
  const currentQ = questions[currentIndex];
  const isMultiple = currentQ.questionType === 'multiple_choice';

  // Selected IDs for the current question (always an array)
  const selectedIds = answers[currentQ.id] || [];

  // A question is "answered" if at least one choice is selected
  const answeredCount = Object.values(answers).filter((arr) => arr.length > 0).length;
  const isLast = currentIndex === totalQ - 1;

  // Single choice: replace selection
  const selectSingle = (choiceId) => {
    setAnswers((prev) => ({ ...prev, [currentQ.id]: [choiceId] }));
  };

  // Multiple choice: toggle
  const toggleMulti = (choiceId) => {
    const current = answers[currentQ.id] || [];
    const updated = current.includes(choiceId)
      ? current.filter((c) => c !== choiceId)
      : [...current, choiceId];
    setAnswers((prev) => ({ ...prev, [currentQ.id]: updated }));
  };

  const goNext = () => { if (currentIndex < totalQ - 1) setCurrentIndex(currentIndex + 1); };
  const goPrev = () => { if (currentIndex > 0) setCurrentIndex(currentIndex - 1); };

  const submitQuiz = () => {
    const unanswered = totalQ - answeredCount;
    if (unanswered > 0) setShowSubmitModal(true);
    else doSubmit();
  };

  const doSubmit = () => {
    navigate(`/results/${id}`, { state: { answers, questions } });
  };

  return (
    <div className="page-container-narrow quiz-player">
      {/* Quiz Header */}
      <div className="player-header">
        <div className="player-header-top">
          <button className="btn btn-ghost btn-sm" onClick={() => navigate('/')}>← Back</button>
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
          {questions.map((q, i) => (
            <button
              key={q.id}
              className={`player-dot ${i === currentIndex ? 'current' : ''} ${(answers[q.id] || []).length > 0 ? 'answered' : ''}`}
              onClick={() => setCurrentIndex(i)}
              aria-label={`Go to question ${i + 1}${(answers[q.id] || []).length > 0 ? ' (answered)' : ''}`}
              title={`Q${i + 1}`}
            />
          ))}
        </div>
      </div>

      {/* Question Card */}
      <div className="card player-question-card animate-in" key={currentQ.id}>
        {/* Type badge */}
        <div className="player-question-type-badge">
          {isMultiple
            ? <span className="player-type-tag player-type-tag--multi">☑ Select all that apply</span>
            : <span className="player-type-tag player-type-tag--single">◉ Choose one answer</span>
          }
        </div>

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
