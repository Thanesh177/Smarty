import { useMemo, useRef, useState, useEffect } from 'react';
import { Search, ArrowUpRight, Grid2X2, BookOpen, Check } from 'lucide-react';
import { getLessonQuizId, getQuizLessons, makeLessonQuizTopic } from '../data/quizLessons.js';
import { getLessonQuestions, getLessonTopicQuestions } from '../data/quizLessonQuestions.js';

export default function QuizLessonLibrary({ subject, progress, onStart, onBack }) {
  const [query, setQuery] = useState('');
  const [branch, setBranch] = useState('All lessons');
  const [openLesson, setOpenLesson] = useState('');
  const heading = useRef(null);
  useEffect(() => { heading.current?.focus({ preventScroll: true }); }, []);
  const lessons = getQuizLessons(subject.id);
  const branches = useMemo(() => ['All lessons', ...new Set(lessons.map(item => item.branch))], [lessons]);
  const filtered = useMemo(() => lessons.filter(item => (branch === 'All lessons' || branch === item.branch)
    && `${item.title} ${item.branch} ${item.outcome} ${item.concepts.join(' ')}`.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase())), [lessons, query, branch]);
  return <section className="quiz-lesson-library" aria-labelledby="quiz-lesson-title">
    <button type="button" className="quiz-text-control" onClick={onBack}><Grid2X2 size={16} aria-hidden="true" />All subjects</button>
    <header className="quiz-lesson-intro">
      <div><p>{subject.title}</p><h1 id="quiz-lesson-title" ref={heading} tabIndex={-1}>Open a lesson.<br />Explore what’s inside.</h1>
        <p>Like a book, one idea at a time. Choose a lesson, then a topic—or practise the whole lesson.</p></div>
      <button type="button" className="quiz-mixed-start" onClick={() => onStart(subject)}>Mix this subject<ArrowUpRight size={16} aria-hidden="true" /></button>
    </header>
    <div className="quiz-lesson-tools">
      <label className="quiz-lesson-search"><Search size={17} aria-hidden="true" /><span className="sr-only">Search lessons in {subject.title}</span>
        <input type="search" value={query} onChange={event => setQuery(event.target.value)} maxLength={120} placeholder="Find a concept or lesson" /></label>
      <p role="status">{filtered.length} of {lessons.length} lessons</p>
    </div>
    <div className="quiz-lesson-branches" aria-label="Filter lessons by area">{branches.map(item => <button key={item} type="button" aria-pressed={branch === item} onClick={() => setBranch(item)}>{item}</button>)}</div>
    <div className="quiz-lesson-list">{filtered.map(item => {
      const id = getLessonQuizId(subject.id, item.id);
      const record = progress[id];
      const practisedTopics = item.concepts.filter(concept => progress[getLessonQuizId(subject.id, item.id, concept)]?.attempts).length;
      const builtIn = getLessonQuestions(id).length;
      return <article key={id} className="quiz-lesson-card">
        <div className="quiz-lesson-meta"><span>{item.branch}</span><span>{record?.attempts || practisedTopics ? <><Check size={13} aria-hidden="true" />Practised</> : builtIn ? <><BookOpen size={13} aria-hidden="true" />Built-in practice</> : 'Online questions'}</span></div>
        <h3>{item.title}</h3><p>{item.outcome}</p>
        <ul aria-label="Concepts in this lesson">{item.concepts.map(concept => <li key={concept}>{concept}</li>)}</ul>
        <div className="quiz-lesson-card-foot"><span>{record?.attempts ? `Last practice ${record.lastPercent ?? record.bestPercent ?? 0}%` : practisedTopics ? `${practisedTopics} of ${item.concepts.length} topics practised` : 'Understand · apply · reason'}</span>
          <button type="button" onClick={() => setOpenLesson(value => value === item.id ? '' : item.id)} aria-expanded={openLesson === item.id} aria-controls={`lesson-topics-${item.id}`}>Open lesson<ArrowUpRight size={16} aria-hidden="true" /></button></div>
        {openLesson === item.id && <div className="quiz-lesson-topic-picker" id={`lesson-topics-${item.id}`}>
          <h4>Topics in this lesson</h4>
          {item.concepts.map(concept => {
            const focused = makeLessonQuizTopic(subject, item, concept);
            const questionCount = getLessonTopicQuestions(focused).length;
            const attempt = progress[focused.id];
            return <button type="button" key={concept} onClick={() => onStart(focused)}><span>{concept}<small>{attempt?.attempts ? `Last practice ${attempt.lastPercent ?? attempt.bestPercent ?? 0}%` : questionCount ? `${questionCount} built-in questions across levels` : 'Online questions'}</small></span><ArrowUpRight size={15} aria-hidden="true" /></button>;
          })}
          <button type="button" className="quiz-whole-lesson" onClick={() => onStart(makeLessonQuizTopic(subject, item))}>Mix the whole lesson<ArrowUpRight size={15} aria-hidden="true" /></button>
        </div>}
      </article>;
    })}</div>
    {!filtered.length && <div className="quiz-lesson-empty"><h3>No lessons match yet</h3><p>Try another concept or clear the filters.</p><button type="button" onClick={() => { setQuery(''); setBranch('All lessons'); }}>Show all lessons</button></div>}
    <p className="quiz-lesson-note">Built-in practice opens without generating a new set. Other lessons and fresh question sets need a connection. This is study practice, not a complete or official exam syllabus.</p>
  </section>;
}
