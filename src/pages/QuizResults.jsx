import { useNavigate, useParams, useLocation } from 'react-router-dom';
import { getQuizById } from '../data/quizService';
import ProgressBar from '../components/ProgressBar';
import './QuizResults.css';

const CHOICE_LABELS = ['A', 'B', 'C', 'D'];

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
 * Exact-set scoring: correct only when selected set === correct set.
 * answers[q.id] is always string[] (may be undefined/empty for unanswered).
 */
function isQuestionCorrect(q, answers) {
  const selected = answers[q.id] || [];
  const correct = q.correctAnswers || [];
  if (selected.length !== correct.length) return false;
  return correct.every((id) => selected.includes(id));
}

export default function QuizResults() {
  const navigate = useNavigate();
  const { id } = useParams();
  const location = useLocation();

  const quiz = getQuizById(id);
  const state = location.state;

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
          const selectedIds = answers[q.id] || [];
          const correctIds = q.correctAnswers || [];
          const isMultiple = q.questionType === 'multiple_choice';

          return (
            <div
              key={q.id}
              className={`review-item ${qCorrect ? 'review-item--correct' : 'review-item--incorrect'} animate-in`}
            >
              <div className="review-item-header">
                <div className="review-item-header-left">
                  <span className="review-item-num">Q{i + 1}</span>
                  <span className={`review-type-tag ${isMultiple ? 'review-type-tag--multi' : 'review-type-tag--single'}`}>
                    {isMultiple ? '☑ Multiple' : '◉ Single'}
                  </span>
                </div>
                <span className={`review-item-badge ${qCorrect ? 'correct' : 'incorrect'}`}>
                  {qCorrect ? '✓ Correct' : '✗ Incorrect'}
                </span>
              </div>

              <p className="review-question">{q.questionText}</p>

              <div className="review-choices">
                {q.choices.map((choice, ci) => {
                  const wasSelected = selectedIds.includes(choice.id);
                  const isCorrectChoice = correctIds.includes(choice.id);

                  // Classify this row
                  // correct + selected  → green
                  // correct + not selected → yellow (missed)
                  // wrong + selected → red
                  // wrong + not selected → neutral
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

              {/* Legend */}
              <div className="review-legend">
                {selectedIds.length === 0 ? (
                  <span className="review-unanswered">⚠️ Not answered</span>
                ) : (
                  <>
                    {isMultiple && (
                      <span className="review-legend-item">
                        <span className="review-indicator review-indicator--missed">→</span> Correct answer you missed
                      </span>
                    )}
                  </>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Actions */}
      <div className="results-actions">
        <button className="btn btn-secondary" onClick={() => navigate('/')}>← Dashboard</button>
        <button className="btn btn-primary btn-lg" onClick={() => navigate(`/quiz/${id}`)}>🔁 Retake Quiz</button>
      </div>
    </div>
  );
}
