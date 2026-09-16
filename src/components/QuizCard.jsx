import { useNavigate } from 'react-router-dom';
import { useToast } from './Toast';
import './QuizCard.css';

const CATEGORY_EMOJI = {
  General: '🌐',
  Programming: '💻',
  Geography: '🗺️',
  Language: '📝',
  Science: '🔬',
  History: '📜',
  Math: '➗',
  Other: '📋',
};

function formatDate(iso) {
  if (!iso) return '';
  return new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric' }).format(new Date(iso));
}

export default function QuizCard({ quiz, currentUserId, onDelete, onDuplicate }) {
  const navigate = useNavigate();
  const { showToast } = useToast();
  const emoji = CATEGORY_EMOJI[quiz.category] || '📋';
  const qCount = quiz.questions?.length || 0;

  const isOwner = Boolean(currentUserId && quiz.userId === currentUserId);
  const isPublic = quiz.visibility === 'public';

  const handleCopyLink = (e) => {
    e.stopPropagation();
    const origin = window.location.origin;
    const base = '/quizly';
    const link = isPublic
      ? `${origin}${base}/quiz/${quiz.id}`
      : `${origin}${base}/quiz/private/${quiz.shareToken}`;

    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(link)
        .then(() => showToast('Link copied to clipboard! 📋', 'success'))
        .catch(() => showToast('Failed to copy link', 'error'));
    } else {
      showToast('Clipboard not supported', 'error');
    }
  };

  return (
    <article className="quiz-card animate-in">
      <div className="quiz-card-top">
        <div className="quiz-card-icon">{emoji}</div>
        <div className="quiz-card-badges">
          {/* Visibility badge */}
          {isPublic ? (
            <span className="badge badge-public" title="Anyone can discover and play this quiz">
              🌎 Public
            </span>
          ) : (
            <span className="badge badge-private" title="Only people with the private link can play">
              🔒 Private
            </span>
          )}

          {quiz.isSeed && <span className="badge badge-default">Sample</span>}
          {quiz.category && <span className="badge badge-default">{quiz.category}</span>}
          {quiz.difficulty && (
            <span className={`badge badge-${quiz.difficulty.toLowerCase()}`}>
              {quiz.difficulty}
            </span>
          )}
          {quiz.shuffleQuestions && (
            <span className="badge badge-default" title="Questions are shuffled each attempt">🔀 Shuffled</span>
          )}
        </div>
      </div>

      <div className="quiz-card-body">
        <h3 className="quiz-card-title">{quiz.title}</h3>
        {quiz.description && (
          <p className="quiz-card-desc">{quiz.description}</p>
        )}
        <p className="quiz-card-meta">
          {qCount} question{qCount !== 1 ? 's' : ''}
          {quiz.creatorName ? ` · By ${quiz.creatorName}` : ''}
          {quiz.createdAt ? ` · ${formatDate(quiz.createdAt)}` : ''}
        </p>
      </div>

      <div className="quiz-card-footer">
        <button
          className="btn btn-primary"
          onClick={() => navigate(`/quiz/${quiz.id}`)}
        >
          ▶ Take Quiz
        </button>
        <div className="quiz-card-actions">
          {/* Copy link button */}
          <button
            className="btn btn-secondary btn-sm"
            onClick={handleCopyLink}
            title={isPublic ? 'Copy public quiz link' : 'Copy private share link'}
          >
            🔗 Link
          </button>

          {/* Owner-only controls */}
          {isOwner && (
            <>
              {onDuplicate && (
                <button
                  className="btn btn-secondary btn-sm"
                  onClick={() => onDuplicate(quiz.id)}
                  title="Duplicate quiz"
                >
                  📋 Copy
                </button>
              )}
              <button
                className="btn btn-secondary btn-sm"
                onClick={() => navigate(`/edit/${quiz.id}`)}
                title="Edit quiz"
              >
                ✏️ Edit
              </button>
              {onDelete && (
                <button
                  className="btn btn-ghost btn-sm"
                  onClick={() => onDelete(quiz.id)}
                  title="Delete quiz"
                >
                  🗑️
                </button>
              )}
            </>
          )}
        </div>
      </div>
    </article>
  );
}
