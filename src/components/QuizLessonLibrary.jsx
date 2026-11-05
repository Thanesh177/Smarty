import { useMemo, useRef, useState, useEffect } from 'react';
import { Search, Play, Grid2X2, BookOpen, Check } from 'lucide-react';
import { getLessonQuizId, getQuizLessons, makeLessonQuizTopic } from '../data/quizLessons.js';
import { getLessonQuestions } from '../data/quizLessonQuestions.js';

const PAGE_SIZE = 6;

export default function QuizLessonLibrary({ subject, progress, onStart, onBack, onMixedStart, initialView }) {
  const [query, setQuery] = useState(initialView?.query ?? '');
  const [branch, setBranch] = useState(initialView?.branch ?? 'All lessons');
  const [limit, setLimit] = useState(initialView?.limit ?? PAGE_SIZE);
  const heading = useRef(null);
  const list = useRef(null);
  const firstNewIndex = useRef(null);
  const returnLesson = useRef(initialView?.lessonId);
  useEffect(() => {
    const card = Array.from(list.current?.children || []).find(item => item.dataset.lessonId === returnLesson.current);
    if (card) card.querySelector('h2')?.focus();
    else heading.current?.focus({ preventScroll: true });
  }, []);
  useEffect(() => {
    if (firstNewIndex.current === null) return;
    list.current?.children[firstNewIndex.current]?.querySelector('h2')?.focus();
    firstNewIndex.current = null;
  }, [limit]);
  const lessons = getQuizLessons(subject.id);
  const branches = useMemo(() => ['All lessons', ...new Set(lessons.map(item => item.branch))], [lessons]);
  const filtered = useMemo(() => {
    const terms = query.trim().toLocaleLowerCase().split(/\s+/).filter(Boolean);
    return lessons.filter(item => {
      if (branch !== 'All lessons' && branch !== item.branch) return false;
      const searchable = `${item.title} ${item.branch} ${item.outcome} ${item.concepts.join(' ')}`.toLocaleLowerCase();
      return terms.every(term => searchable.includes(term));
    });
  }, [lessons, query, branch]);
  const visible = filtered.slice(0, limit);
  const remaining = filtered.length - visible.length;
  return <section className="quiz-lesson-library" aria-labelledby="quiz-lesson-title">
    <button type="button" className="quiz-text-control" onClick={onBack}><Grid2X2 size={16} aria-hidden="true" />All subjects</button>
    <header className="quiz-lesson-intro">
      <h1 id="quiz-lesson-title" ref={heading} tabIndex={-1}>{subject.title} lessons</h1>
      <p>Choose a lesson. One quiz connects its key ideas through examples and explanations.</p>
      {onMixedStart && <button type="button" className="quiz-text-control" onClick={onMixedStart}>Start subject challenge</button>}
    </header>
    <div className="quiz-lesson-tools">
      <label className="quiz-lesson-search"><Search size={17} aria-hidden="true" /><span className="sr-only">Search lessons in {subject.title}</span>
        <input type="search" value={query} onChange={event => { setQuery(event.target.value); setLimit(PAGE_SIZE); }} maxLength={120} placeholder="Find a lesson or idea" /></label>
      <p role="status">Showing {visible.length} of {filtered.length} lessons</p>
    </div>
    <div className="quiz-lesson-branches" aria-label="Filter lessons by area">{branches.map(item => <button key={item} type="button" aria-pressed={branch === item} onClick={() => { if (branch !== item) { setBranch(item); setLimit(PAGE_SIZE); } }}>{item}</button>)}</div>
    <div className="quiz-lesson-list" ref={list}>{visible.map(item => {
      const id = getLessonQuizId(subject.id, item.id);
      const record = progress[id];
      const practisedTopics = item.concepts.filter(concept => progress[getLessonQuizId(subject.id, item.id, concept)]?.attempts).length;
      const builtIn = getLessonQuestions(id).length;
      return <article key={id} className="quiz-lesson-card" data-lesson-id={item.id}>
        <div className="quiz-lesson-meta"><span>{item.branch}</span><span>{record?.attempts || practisedTopics ? <><Check size={13} aria-hidden="true" />Practised</> : builtIn ? <><BookOpen size={13} aria-hidden="true" />Built-in practice</> : 'Online questions'}</span></div>
        <h2 tabIndex={-1}>{item.title}</h2><p>{item.outcome}</p>
        <ul aria-label="Concepts in this lesson">{item.concepts.map(concept => <li key={concept}>{concept}</li>)}</ul>
        <div className="quiz-lesson-card-foot">
          <button type="button" onClick={() => onStart(makeLessonQuizTopic(subject, item), { query, branch, limit, lessonId: item.id })} aria-label={`Start quiz: ${item.title}`}><Play size={15} aria-hidden="true" />Start quiz</button>
          {record?.attempts > 0 && <span>Last practice {record.lastPercent ?? record.bestPercent ?? 0}%</span>}
        </div>
      </article>;
    })}</div>
    {remaining > 0 && <div className="quiz-lesson-more"><button type="button" onClick={() => { firstNewIndex.current = visible.length; setLimit(count => count + PAGE_SIZE); }}>Load more lessons <span aria-hidden="true">+{Math.min(PAGE_SIZE, remaining)}</span></button></div>}
    {!filtered.length && <div className="quiz-lesson-empty"><h2>No lessons match yet</h2><p>Try another idea or clear the filters.</p><button type="button" onClick={() => { setQuery(''); setBranch('All lessons'); setLimit(PAGE_SIZE); }}>Show all lessons</button></div>}
    <p className="quiz-lesson-note">Built-in practice opens without generating a new set. Other lessons and fresh question sets need a connection. This is study practice, not a complete or official exam syllabus.</p>
  </section>;
}
