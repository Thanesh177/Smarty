import { useState } from 'react';

export default function QuizRepairCheck({ question, onAnswered }) {
  const [open, setOpen] = useState(false), [selected, setSelected] = useState(''), [checked, setChecked] = useState(false);
  if (!question) return null;
  return <section className="quiz-repair-check" aria-label="Optional concept repair">
    {!open ? <button type="button" onClick={() => setOpen(true)}>Try a different question on this idea</button> : <>
      <h4>Check the idea again</h4>
      {question.passage && <details className="quiz-reading-passage" open><summary>Original practice passage</summary><p>{question.passage}</p></details>}
      <p>{question.q}</p>
      <div role="group" aria-label="Repair question choices">{question.options.map(option => <button type="button" key={option} disabled={checked} aria-pressed={selected === option} onClick={() => setSelected(option)}>{option}</button>)}</div>
      {!checked ? <button type="button" disabled={!selected} onClick={() => { setChecked(true); onAnswered?.({ ...question, selected, isCorrect: selected === question.answer }); }}>Check this answer</button>
        : <div role="status"><strong>{selected === question.answer ? 'That’s the distinction.' : `The answer is: ${question.answer}`}</strong><p>{question.explanation}</p></div>}
      <small>Optional practice. This does not change your first answer or round score.</small>
    </>}
  </section>;
}
