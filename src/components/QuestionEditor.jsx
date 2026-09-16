import { v4 as uuidv4 } from 'uuid';
import './QuestionEditor.css';

const CHOICE_LABELS = ['A', 'B', 'C', 'D'];
const BLANK_TOKEN = '{{blank}}';

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

// ── Fill-in-blank preview renderer ───────────────────────────────────────
function FillBlankPreview({ questionText }) {
  if (!questionText) return null;
  const parts = questionText.split(BLANK_TOKEN);
  if (parts.length === 1) {
    return (
      <p className="fib-preview-text">
        {questionText || <em className="fib-preview-empty">Start typing your question above…</em>}
      </p>
    );
  }
  return (
    <p className="fib-preview-text">
      {parts.map((part, i) => (
        <span key={i}>
          {part}
          {i < parts.length - 1 && (
            <span className="fib-blank-preview">________</span>
          )}
        </span>
      ))}
    </p>
  );
}

// ── Accepted Answers Editor ───────────────────────────────────────────────
function AcceptedAnswersEditor({ acceptedAnswers, onChange, errors }) {
  const answers = acceptedAnswers || [''];

  const update = (index, value) => {
    const next = [...answers];
    next[index] = value;
    onChange(next);
  };

  const addAnswer = () => {
    onChange([...answers, '']);
  };

  const removeAnswer = (index) => {
    if (answers.length <= 1) return; // always keep at least one
    onChange(answers.filter((_, i) => i !== index));
  };

  return (
    <div className="fib-answers-section">
      <p className="form-label" style={{ marginBottom: 4 }}>
        Accepted Answers <span className="required">*</span>
        <span className="form-hint" style={{ fontWeight: 400, marginLeft: 8 }}>
          — all listed answers are treated as correct (case-insensitive)
        </span>
      </p>
      {errors?.acceptedAnswers && (
        <p className="form-error" style={{ marginBottom: 6 }}>{errors.acceptedAnswers}</p>
      )}

      <div className="fib-answers-list">
        {answers.map((answer, i) => (
          <div key={i} className="fib-answer-row">
            <span className="fib-answer-num">{i + 1}</span>
            <input
              type="text"
              className={`form-input fib-answer-input ${errors?.acceptedAnswers && !answer.trim() ? 'error' : ''}`}
              value={answer}
              onChange={(e) => update(i, e.target.value)}
              placeholder={i === 0 ? 'e.g. Wind' : 'Alternative accepted answer…'}
              maxLength={200}
            />
            {answers.length > 1 && (
              <button
                type="button"
                className="btn btn-ghost btn-sm fib-answer-remove"
                onClick={() => removeAnswer(i)}
                aria-label={`Remove accepted answer ${i + 1}`}
                title="Remove this answer"
              >
                ✕
              </button>
            )}
          </div>
        ))}
      </div>

      <button
        type="button"
        className="btn btn-secondary btn-sm fib-add-answer-btn"
        onClick={addAnswer}
      >
        + Add accepted answer
      </button>
    </div>
  );
}

// ── Question Editor ────────────────────────────────────────────────────────
export default function QuestionEditor({ question, index, onUpdate, onDelete, errors }) {
  const qErrors = errors || {};
  const correctAnswers = question.correctAnswers || [];
  const questionType = question.questionType || 'single_choice';
  const isFillBlank = questionType === 'fill_in_blank';
  const isMultiple = questionType === 'multiple_choice';

  const updateField = (field, value) => {
    onUpdate({ ...question, [field]: value });
  };

  const updateChoice = (choiceId, text) => {
    onUpdate({
      ...question,
      choices: question.choices.map((c) => c.id === choiceId ? { ...c, text } : c),
    });
  };

  const setSingleCorrect = (choiceId) => {
    onUpdate({ ...question, correctAnswers: [choiceId] });
  };

  const toggleMultiCorrect = (choiceId) => {
    const current = question.correctAnswers || [];
    const updated = current.includes(choiceId)
      ? current.filter((id) => id !== choiceId)
      : [...current, choiceId];
    onUpdate({ ...question, correctAnswers: updated });
  };

  const handleTypeChange = (newType) => {
    onUpdate({
      ...question,
      questionType: newType,
      correctAnswers: [],
      acceptedAnswers: newType === 'fill_in_blank' ? (question.acceptedAnswers?.length ? question.acceptedAnswers : ['']) : (question.acceptedAnswers || []),
    });
  };

  const updateAcceptedAnswers = (answers) => {
    onUpdate({ ...question, acceptedAnswers: answers });
  };

  const hasBlank = question.questionText?.includes(BLANK_TOKEN);

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
          <label className={`type-option ${questionType === 'single_choice' ? 'type-option--active' : ''}`}>
            <input
              type="radio"
              name={`type-${question.id}`}
              value="single_choice"
              checked={questionType === 'single_choice'}
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
          <label className={`type-option ${isFillBlank ? 'type-option--active' : ''}`}>
            <input
              type="radio"
              name={`type-${question.id}`}
              value="fill_in_blank"
              checked={isFillBlank}
              onChange={() => handleTypeChange('fill_in_blank')}
            />
            <span className="type-option-icon">▭</span>
            <span>
              <strong>Fill in the Blank</strong>
              <small>Type the answer</small>
            </span>
          </label>
        </div>
      </div>

      {/* Question text */}
      <div className="form-group">
        <label className="form-label">
          Question <span className="required">*</span>
        </label>
        {isFillBlank && (
          <p className="form-hint" style={{ marginBottom: 6 }}>
            Use <code className="fib-token-hint">{BLANK_TOKEN}</code> where the learner should type the answer.
          </p>
        )}
        <textarea
          className={`form-textarea ${qErrors.questionText ? 'error' : ''}`}
          value={question.questionText}
          onChange={(e) => updateField('questionText', e.target.value)}
          placeholder={isFillBlank
            ? `e.g. The classic film "Gone with the ${BLANK_TOKEN}" is based on the novel by Margaret Mitchell.`
            : 'Enter your question here…'}
          rows={isFillBlank ? 3 : 2}
          maxLength={500}
        />
        {qErrors.questionText && <p className="form-error">{qErrors.questionText}</p>}
      </div>

      {/* Fill-in-blank: live preview + accepted answers */}
      {isFillBlank ? (
        <>
          {/* Live preview */}
          <div className={`fib-preview-box ${!hasBlank && question.questionText ? 'fib-preview-box--warn' : ''}`}>
            <p className="fib-preview-label">
              Preview
              {!hasBlank && question.questionText && (
                <span className="fib-preview-warn">
                  ⚠ Add <code>{BLANK_TOKEN}</code> to show where the learner types
                </span>
              )}
            </p>
            <FillBlankPreview questionText={question.questionText} />
          </div>

          {/* Accepted answers */}
          <AcceptedAnswersEditor
            acceptedAnswers={question.acceptedAnswers || ['']}
            onChange={updateAcceptedAnswers}
            errors={qErrors}
          />
        </>
      ) : (
        /* Choices for single / multiple choice */
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
      )}
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
    acceptedAnswers: [],
  };
}
