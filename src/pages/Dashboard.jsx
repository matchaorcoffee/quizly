import { useState, useEffect, useCallback } from 'react';
import { getAllQuizzes, deleteQuiz, duplicateQuiz } from '../data/quizService';
import { useAuth } from '../context/AuthContext';
import QuizCard from '../components/QuizCard';
import SearchBar from '../components/SearchBar';
import FilterControls from '../components/FilterControls';
import ConfirmationModal from '../components/ConfirmationModal';
import { useNavigate } from 'react-router-dom';
import './Dashboard.css';

function applyFilters(quizzes, search, category, difficulty, sort) {
  let result = [...quizzes];

  if (search.trim()) {
    const q = search.toLowerCase();
    result = result.filter(
      (quiz) =>
        quiz.title.toLowerCase().includes(q) ||
        (quiz.description || '').toLowerCase().includes(q)
    );
  }

  if (category !== 'All') {
    result = result.filter((quiz) => quiz.category === category);
  }

  if (difficulty !== 'All') {
    result = result.filter((quiz) => quiz.difficulty === difficulty);
  }

  if (sort === 'newest') {
    result.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  } else if (sort === 'oldest') {
    result.sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
  } else if (sort === 'alpha') {
    result.sort((a, b) => a.title.localeCompare(b.title));
  }

  return result;
}

export default function Dashboard() {
  const navigate = useNavigate();
  const { profile, user } = useAuth();
  const [quizzes, setQuizzes] = useState([]);
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('All');
  const [difficulty, setDifficulty] = useState('All');
  const [sort, setSort] = useState('newest');
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [loadingQuizzes, setLoadingQuizzes] = useState(true);
  const [loadError, setLoadError] = useState('');

  const loadQuizzes = useCallback(async () => {
    setLoadingQuizzes(true);
    setLoadError('');
    try {
      const data = await getAllQuizzes();
      setQuizzes(data);
    } catch (err) {
      setLoadError(err.message || 'Failed to load quizzes.');
    } finally {
      setLoadingQuizzes(false);
    }
  }, []);

  useEffect(() => {
    loadQuizzes();
  }, [loadQuizzes]);

  const handleDelete = (id) => setDeleteTarget(id);

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    try {
      await deleteQuiz(deleteTarget);
      setDeleteTarget(null);
      await loadQuizzes();
    } catch (err) {
      setLoadError(err.message || 'Failed to delete quiz.');
      setDeleteTarget(null);
    }
  };

  const handleDuplicate = async (id) => {
    try {
      await duplicateQuiz(id);
      await loadQuizzes();
    } catch (err) {
      setLoadError(err.message || 'Failed to duplicate quiz.');
    }
  };

  const greeting = profile?.full_name
    ? `Welcome back, ${profile.full_name.split(' ')[0]}! ⚡`
    : user?.email
      ? `Welcome back! ⚡`
      : 'Welcome to Quizly ⚡';

  const filtered = applyFilters(quizzes, search, category, difficulty, sort);
  const hasFilters = search || category !== 'All' || difficulty !== 'All';

  return (
    <div className="page-container">
      {/* Hero */}
      <section className="dashboard-hero">
        <div>
          <h1 className="dashboard-hero-title">{greeting}</h1>
          <p className="dashboard-hero-sub">
            Create, study, and master any subject with custom quizzes.
          </p>
        </div>
        <button className="btn btn-primary btn-lg" onClick={() => navigate('/create')}>
          + Create Quiz
        </button>
      </section>

      {loadError && (
        <div className="alert alert-error" style={{ marginBottom: 16 }} role="alert">
          {loadError}
        </div>
      )}

      {/* Controls */}
      <section className="dashboard-controls">
        <SearchBar value={search} onChange={setSearch} />
        <FilterControls
          category={category}
          difficulty={difficulty}
          sort={sort}
          onCategory={setCategory}
          onDifficulty={setDifficulty}
          onSort={setSort}
        />
      </section>

      {/* Header */}
      <div className="dashboard-list-header">
        <h2 className="dashboard-section-title">
          My Quizzes
          {!loadingQuizzes && quizzes.length > 0 && (
            <span className="dashboard-count">{filtered.length} of {quizzes.length}</span>
          )}
        </h2>
      </div>

      {/* Loading */}
      {loadingQuizzes ? (
        <div className="dashboard-loading">
          <div className="dashboard-spinner" />
          <p>Loading your quizzes…</p>
        </div>
      ) : filtered.length > 0 ? (
        <div className="quiz-grid">
          {filtered.map((quiz) => (
            <QuizCard
              key={quiz.id}
              quiz={quiz}
              currentUserId={user?.id}
              onDelete={handleDelete}
              onDuplicate={handleDuplicate}
            />
          ))}
        </div>
      ) : (
        loadError ? null : (
          <div className="card">
            {quizzes.length === 0 ? (
              <div className="empty-state">
                <div className="empty-state-icon">📚</div>
                <h3>No quizzes yet</h3>
                <p>Create your first quiz to get started. It only takes a minute!</p>
                <button className="btn btn-primary" onClick={() => navigate('/create')}>
                  + Create your first quiz
                </button>
              </div>
            ) : (
              <div className="empty-state">
                <div className="empty-state-icon">🔍</div>
                <h3>No matches found</h3>
                <p>
                  {hasFilters
                    ? 'Try adjusting your search or filters.'
                    : 'No quizzes match your current filters.'}
                </p>
                <button className="btn btn-secondary" onClick={() => { setSearch(''); setCategory('All'); setDifficulty('All'); }}>
                  Clear filters
                </button>
              </div>
            )}
          </div>
        )
      )}

      <ConfirmationModal
        isOpen={!!deleteTarget}
        title="Delete Quiz"
        message="Are you sure you want to delete this quiz? This action cannot be undone."
        confirmLabel="Delete"
        cancelLabel="Keep it"
        variant="danger"
        onConfirm={confirmDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
}
