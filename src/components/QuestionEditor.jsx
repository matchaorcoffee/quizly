import { v4 as uuidv4 } from 'uuid';
import './QuestionEditor.css';

const CHOICE_LABELS = ['A', 'B', 'C', 'D'];

// ── Single-choice row (radio) ──────────────────────────────────────────────
function SingleChoiceRow({ choiceIndex, choice, correctAnswers, questionId, onChoiceChange, onCorrectChange, hasChoiceError }) {
  const isCorrect = correctAnswers.includes(choice.id);
  const label = CHOICE_LABELS[choiceIndex];

  return (
    <label className={`choice-input ${isCorrect ? 'choice-input--correct' : ''} ${hasChoiceError && !choice.text ? 'choice-input--error' : ''}`}>
      <input
        type="radio"
        name={`correct-${questionId}`}
        checked={isCorrect}
        onChange={() => onCorrectChange(choice.id)}
        className="choice-control"
        aria-label={`Mark choice ${label} as correct`}
      />
      <span className="choice-label">{label}</span>
      <input
        type="text"
        className="form-input choice-text"
        value={choice.text}
        onChange={(e) => onChoiceChange(choice.id, e.target.value)}
        placeholder={`Choice ${label}…`}
        maxLength={200}
      />
      {isCorrect && <span className="choice-correct-badge">✓ Correct</span>}
    </label>
  );
}

// ── Multiple-choice row (checkbox) ────────────────────────────────────────
function MultiChoiceRow({ choiceIndex, choice, correctAnswers, onChoiceChange, onCorrectToggle, hasChoiceError }) {
  const isCorrect = correctAnswers.includes(choice.id);
  const label = CHOICE_LABELS[choiceIndex];

  return (
    <label className={`choice-input ${isCorrect ? 'choice-input--correct' : ''} ${hasChoiceError && !choice.text ? 'choice-input--error' : ''}`}>
      <input
        type="checkbox"
        checked={isCorrect}
        onChange={() => onCorrectToggle(choice.id)}
        className="choice-control choice-control--checkbox"
        aria-label={`Mark choice ${label} as correct`}
      />
      <span className="choice-label">{label}</span>
      <input
        type="text"
        className="form-input choice-text"
        value={choice.text}
        onChange={(e) => onChoiceChange(choice.id, e.target.value)}
        placeholder={`Choice ${label}…`}
        maxLength={200}
      />
      {isCorrect && <span className="choice-correct-badge">✓ Correct</span>}
    </label>
  );
}

// ── Question Editor ────────────────────────────────────────────────────────
export default function QuestionEditor({ question, index, onUpdate, onDelete, errors }) {
  const qErrors = errors || {};
  const correctAnswers = question.correctAnswers || [];
  const questionType = question.questionType || 'single_choice';

  const updateField = (field, value) => {
    onUpdate({ ...question, [field]: value });
  };

  const updateChoice = (choiceId, text) => {
    onUpdate({
      ...question,
      choices: question.choices.map((c) => c.id === choiceId ? { ...c, text } : c),
    });
  };

  // Single choice: replace the entire correctAnswers array with one id
  const setSingleCorrect = (choiceId) => {
    onUpdate({ ...question, correctAnswers: [choiceId] });
  };

  // Multiple choice: toggle a choice id in/out of correctAnswers
  const toggleMultiCorrect = (choiceId) => {
    const current = question.correctAnswers || [];
    const updated = current.includes(choiceId)
      ? current.filter((id) => id !== choiceId)
      : [...current, choiceId];
    onUpdate({ ...question, correctAnswers: updated });
  };

  const handleTypeChange = (newType) => {
    // Reset correctAnswers when switching types
    onUpdate({ ...question, questionType: newType, correctAnswers: [] });
  };

  const isMultiple = questionType === 'multiple_choice';

  return (
    <div className={`question-editor ${qErrors.any ? 'question-editor--error' : ''}`}>
      {/* Header */}
      <div className="question-editor-header">
        <span className="question-number">Q{index + 1}</span>
        <button
          type="button"
          className="btn btn-ghost btn-sm question-delete"
          onClick={onDelete}
          aria-label={`Delete question ${index + 1}`}
        >
          🗑️ Delete
        </button>
      </div>

      {/* Question type selector */}
      <div className="question-type-selector">
        <span className="form-label" style={{ marginBottom: 0 }}>Question Type</span>
        <div className="question-type-options">
          <label className={`type-option ${!isMultiple ? 'type-option--active' : ''}`}>
            <input
              type="radio"
              name={`type-${question.id}`}
              value="single_choice"
              checked={!isMultiple}
              onChange={() => handleTypeChange('single_choice')}
            />
            <span className="type-option-icon">◉</span>
            <span>
              <strong>Single Choice</strong>
              <small>One correct answer</small>
            </span>
          </label>
          <label className={`type-option ${isMultiple ? 'type-option--active' : ''}`}>
            <input
              type="radio"
              name={`type-${question.id}`}
              value="multiple_choice"
              checked={isMultiple}
              onChange={() => handleTypeChange('multiple_choice')}
            />
            <span className="type-option-icon">☑</span>
            <span>
              <strong>Checkbox</strong>
              <small>Multiple correct answers</small>
            </span>
          </label>
        </div>
      </div>

      {/* Question text */}
      <div className="form-group">
        <label className="form-label">
          Question <span className="required">*</span>
        </label>
        <textarea
          className={`form-textarea ${qErrors.questionText ? 'error' : ''}`}
          value={question.questionText}
          onChange={(e) => updateField('questionText', e.target.value)}
          placeholder="Enter your question here…"
          rows={2}
          maxLength={500}
        />
        {qErrors.questionText && <p className="form-error">{qErrors.questionText}</p>}
      </div>

      {/* Choices */}
      <div className="choices-section">
        <p className="form-label" style={{ marginBottom: 4 }}>
          Answer Choices <span className="required">*</span>
          <span className="form-hint" style={{ fontWeight: 400, marginLeft: 8 }}>
            {isMultiple
              ? '— check all correct answers (at least 2)'
              : '— select the radio button next to the correct answer'}
          </span>
        </p>
        {qErrors.choices && <p className="form-error" style={{ marginBottom: 6 }}>{qErrors.choices}</p>}
        {qErrors.correctAnswers && <p className="form-error" style={{ marginBottom: 6 }}>{qErrors.correctAnswers}</p>}

        <div className="choices-list">
          {question.choices.map((choice, ci) =>
            isMultiple ? (
              <MultiChoiceRow
                key={choice.id}
                choiceIndex={ci}
                choice={choice}
                correctAnswers={correctAnswers}
                onChoiceChange={updateChoice}
                onCorrectToggle={toggleMultiCorrect}
                hasChoiceError={!!qErrors.choices}
              />
            ) : (
              <SingleChoiceRow
                key={choice.id}
                choiceIndex={ci}
                choice={choice}
                correctAnswers={correctAnswers}
                questionId={question.id}
                onChoiceChange={updateChoice}
                onCorrectChange={setSingleCorrect}
                hasChoiceError={!!qErrors.choices}
              />
            )
          )}
        </div>
      </div>
    </div>
  );
}

export function createEmptyQuestion() {
  return {
    id: uuidv4(),
    questionText: '',
    questionType: 'single_choice',
    choices: [
      { id: uuidv4(), text: '' },
      { id: uuidv4(), text: '' },
      { id: uuidv4(), text: '' },
      { id: uuidv4(), text: '' },
    ],
    correctAnswers: [],
  };
}
