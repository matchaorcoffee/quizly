import { useState, useEffect, useCallback } from 'react';
import { getAllQuizzes, deleteQuiz, duplicateQuiz, ensureSeeded } from '../data/quizService';
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
  const [quizzes, setQuizzes] = useState([]);
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('All');
  const [difficulty, setDifficulty] = useState('All');
  const [sort, setSort] = useState('newest');
  const [deleteTarget, setDeleteTarget] = useState(null);

  const loadQuizzes = useCallback(() => {
    ensureSeeded();
    setQuizzes(getAllQuizzes());
  }, []);

  useEffect(() => {
    loadQuizzes();
  }, [loadQuizzes]);

  const handleDelete = (id) => setDeleteTarget(id);

  const confirmDelete = () => {
    if (deleteTarget) {
      deleteQuiz(deleteTarget);
      setDeleteTarget(null);
      loadQuizzes();
    }
  };

  const handleDuplicate = (id) => {
    duplicateQuiz(id);
    loadQuizzes();
  };

  const filtered = applyFilters(quizzes, search, category, difficulty, sort);
  const hasFilters = search || category !== 'All' || difficulty !== 'All';

  return (
    <div className="page-container">
      {/* Hero */}
      <section className="dashboard-hero">
        <div>
          <h1 className="dashboard-hero-title">Welcome to Quizly ⚡</h1>
          <p className="dashboard-hero-sub">
            Create, study, and master any subject with custom quizzes.
          </p>
        </div>
        <button className="btn btn-primary btn-lg" onClick={() => navigate('/create')}>
          + Create Quiz
        </button>
      </section>

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
          {quizzes.length > 0 && (
            <span className="dashboard-count">{filtered.length} of {quizzes.length}</span>
          )}
        </h2>
      </div>

      {/* Grid */}
      {filtered.length > 0 ? (
        <div className="quiz-grid">
          {filtered.map((quiz) => (
            <QuizCard
              key={quiz.id}
              quiz={quiz}
              onDelete={handleDelete}
              onDuplicate={handleDuplicate}
            />
          ))}
        </div>
      ) : (
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
