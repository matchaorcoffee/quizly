import { useState, useEffect } from 'react';
import { useNavigate, useParams, useLocation } from 'react-router-dom';
import { getQuizById } from '../data/quizService';
import ProgressBar from '../components/ProgressBar';
import './QuizResults.css';

const CHOICE_LABELS = ['A', 'B', 'C', 'D'];
const BLANK_TOKEN = '{{blank}}';

/** Normalise a string for case-insensitive, whitespace-tolerant comparison. */
function normAnswer(str) {
  return (str || '').trim().toLowerCase().replace(/\s+/g, ' ');
}

/** Render a fill-in-blank question text with blanks shown as underscores. */
function FibQuestionDisplay({ text }) {
  const parts = text.split(BLANK_TOKEN);
  return (
    <p className="review-question">
      {parts.map((part, i) => (
        <span key={i}>
          {part}
          {i < parts.length - 1 && <span className="fib-blank-display">______</span>}
        </span>
      ))}
    </p>
  );
}

function getScoreVariant(pct) {
  if (pct >= 80) return 'success';
  if (pct >= 50) return 'primary';
  return 'danger';
}

function getScoreEmoji(pct) {
  if (pct === 100) return '🏆';
  if (pct >= 80) return '🎉';
  if (pct >= 60) return '👍';
  if (pct >= 40) return '📚';
  return '💪';
}

function getScoreMessage(pct) {
  if (pct === 100) return 'Perfect score! Outstanding work!';
  if (pct >= 80) return 'Excellent! You really know this topic.';
  if (pct >= 60) return "Good job! A bit more practice and you'll ace it.";
  if (pct >= 40) return "Keep studying — you're making progress!";
  return "Don't give up! Review the material and try again.";
}

/**
 * Unified scoring for all question types.
 * - single_choice / multiple_choice: exact set match on IDs
 * - fill_in_blank: typed answer matches any acceptedAnswer (case-insensitive, trimmed)
 */
function isQuestionCorrect(q, answers) {
  if (q.questionType === 'fill_in_blank') {
    const typed = normAnswer((answers[q.id] || [])[0]);
    if (!typed) return false;
    const accepted = (q.acceptedAnswers || []).map(normAnswer);
    return accepted.some((a) => a === typed);
  }
  // single / multiple choice
  const selected = answers[q.id] || [];
  const correct = q.correctAnswers || [];
  if (selected.length !== correct.length) return false;
  return correct.every((id) => selected.includes(id));
}

export default function QuizResults() {
  const navigate = useNavigate();
  const { id } = useParams();
  const location = useLocation();
  const state = location.state;

  const [quiz, setQuiz] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (state?.quiz) {
      setQuiz(state.quiz);
      setLoading(false);
      return;
    }

    getQuizById(id)
      .then((q) => setQuiz(q))
      .catch(() => setQuiz(null))
      .finally(() => setLoading(false));
  }, [id, state]);

  if (loading) {
    return (
      <div className="page-container-narrow" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 300 }}>
        <div style={{ width: 36, height: 36, border: '3px solid var(--color-border)', borderTopColor: 'var(--color-primary)', borderRadius: '50%', animation: 'spin 0.7s linear infinite' }} />
      </div>
    );
  }

  if (!quiz || !state) {
    return (
      <div className="page-container-narrow">
        <div className="card">
          <div className="empty-state">
            <div className="empty-state-icon">❓</div>
            <h3>No results found</h3>
            <p>Please take the quiz first to see your results.</p>
            <button className="btn btn-primary" onClick={() => navigate('/')}>Back to Dashboard</button>
          </div>
        </div>
      </div>
    );
  }

  const { answers, questions } = state;
  const total = questions.length;
  const correct = questions.filter((q) => isQuestionCorrect(q, answers)).length;
  const incorrect = total - correct;
  const pct = total > 0 ? Math.round((correct / total) * 100) : 0;
  const variant = getScoreVariant(pct);

  return (
    <div className="page-container-narrow results-page">
      {/* Score card */}
      <div className={`results-score-card results-score-card--${variant} animate-in`}>
        <div className="results-emoji">{getScoreEmoji(pct)}</div>
        <h1 className="results-score-title">You scored {correct} / {total}</h1>
        <p className="results-pct">{pct}%</p>
        <p className="results-message">{getScoreMessage(pct)}</p>
        <div className="results-stats">
          <div className="results-stat results-stat--correct">
            <span className="results-stat-value">{correct}</span>
            <span className="results-stat-label">Correct</span>
          </div>
          <div className="results-stat results-stat--incorrect">
            <span className="results-stat-value">{incorrect}</span>
            <span className="results-stat-label">Incorrect</span>
          </div>
          <div className="results-stat">
            <span className="results-stat-value">{total}</span>
            <span className="results-stat-label">Total</span>
          </div>
        </div>
        <div className="results-bar">
          <ProgressBar value={correct} max={total} variant={variant} />
        </div>
      </div>

      {/* Review */}
      <div className="results-review-header">
        <h2 className="results-review-title">Answer Review</h2>
        <p className="results-review-sub">{quiz.title} · {total} questions</p>
      </div>

      <div className="review-list">
        {questions.map((q, i) => {
          const qCorrect = isQuestionCorrect(q, answers);
          const isFib = q.questionType === 'fill_in_blank';
          const isMultiple = q.questionType === 'multiple_choice';
          const selectedIds = answers[q.id] || [];
          const correctIds = q.correctAnswers || [];

          // FIB-specific values
          const typedAnswer = isFib ? ((answers[q.id] || [])[0] || '') : '';
          const acceptedAnswers = isFib ? (q.acceptedAnswers || []) : [];

          // Type tag
          const typeTagCls = isFib
            ? 'review-type-tag review-type-tag--fib'
            : isMultiple
              ? 'review-type-tag review-type-tag--multi'
              : 'review-type-tag review-type-tag--single';
          const typeLabel = isFib ? '▭ Fill Blank' : isMultiple ? '☑ Multiple' : '◉ Single';

          return (
            <div
              key={q.id}
              className={`review-item ${qCorrect ? 'review-item--correct' : 'review-item--incorrect'} animate-in`}
            >
              <div className="review-item-header">
                <div className="review-item-header-left">
                  <span className="review-item-num">Q{i + 1}</span>
                  <span className={typeTagCls}>{typeLabel}</span>
                </div>
                <span className={`review-item-badge ${qCorrect ? 'correct' : 'incorrect'}`}>
                  {qCorrect ? '✓ Correct' : '✗ Incorrect'}
                </span>
              </div>

              {/* Question text — FIB renders blanks as underscores */}
              {isFib
                ? <FibQuestionDisplay text={q.questionText} />
                : <p className="review-question">{q.questionText}</p>
              }

              {/* FIB answer review */}
              {isFib ? (
                <div className="fib-review-block">
                  <div className={`fib-review-row fib-review-row--typed ${qCorrect ? 'fib-review-row--ok' : 'fib-review-row--wrong'}`}>
                    <span className="fib-review-label">Your answer:</span>
                    <span className="fib-review-value">
                      {typedAnswer || <em className="fib-review-empty">Not answered</em>}
                    </span>
                    <span className={`review-indicator ${qCorrect ? 'review-indicator--correct' : 'review-indicator--wrong'}`}>
                      {qCorrect ? '✓' : '✗'}
                    </span>
                  </div>
                  {!qCorrect && (
                    <div className="fib-review-row fib-review-row--accepted">
                      <span className="fib-review-label">Accepted answer{acceptedAnswers.length > 1 ? 's' : ''}:</span>
                      <span className="fib-review-value fib-review-value--correct">
                        {acceptedAnswers.length > 0 ? acceptedAnswers.join(' / ') : '—'}
                      </span>
                      <span className="review-indicator review-indicator--missed">→</span>
                    </div>
                  )}
                </div>
              ) : (
                /* Choice-based review */
                <>
                  <div className="review-choices">
                    {q.choices.map((choice, ci) => {
                      const wasSelected = selectedIds.includes(choice.id);
                      const isCorrectChoice = correctIds.includes(choice.id);

                      let cls = 'review-choice';
                      let indicator = null;

                      if (isCorrectChoice && wasSelected) {
                        cls += ' review-choice--correct';
                        indicator = <span className="review-indicator review-indicator--correct">✓</span>;
                      } else if (isCorrectChoice && !wasSelected) {
                        cls += ' review-choice--missed';
                        indicator = <span className="review-indicator review-indicator--missed">→</span>;
                      } else if (!isCorrectChoice && wasSelected) {
                        cls += ' review-choice--wrong';
                        indicator = <span className="review-indicator review-indicator--wrong">✗</span>;
                      }

                      return (
                        <div key={choice.id} className={cls}>
                          <span className="review-choice-label">{CHOICE_LABELS[ci]}</span>
                          <span className="review-choice-text">{choice.text}</span>
                          {indicator}
                          {isCorrectChoice && (
                            <span className="review-correct-star" title="Correct answer">★</span>
                          )}
                        </div>
                      );
                    })}
                  </div>

                  <div className="review-legend">
                    {selectedIds.length === 0 ? (
                      <span className="review-unanswered">⚠️ Not answered</span>
                    ) : (
                      isMultiple && (
                        <span className="review-legend-item">
                          <span className="review-indicator review-indicator--missed">→</span> Correct answer you missed
                        </span>
                      )
                    )}
                  </div>
                </>
              )}
            </div>
          );
        })}
      </div>

      {/* Actions */}
      <div className="results-actions">
        <button className="btn btn-secondary" onClick={() => navigate('/explore')}>🌎 Explore More</button>
        <button className="btn btn-primary btn-lg" onClick={() => navigate(`/quiz/${id}`, { state: state?.quiz ? { preloadedQuiz: state.quiz } : undefined })}>🔁 Retake Quiz</button>
      </div>
    </div>
  );
}
