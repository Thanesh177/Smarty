import { useMemo, useRef, useState, useEffect } from 'react';
import { Search, Play, Grid2X2, BookOpen, Check } from 'lucide-react';
import { getLessonQuizId, getQuizChapters, makeLessonQuizTopic } from '../data/quizLessons.js';
import { getLessonTopicQuestions } from '../data/quizLessonQuestions.js';

const PAGE_SIZE = 6;

export default function QuizLessonLibrary({ subject, progress, onStart, onBack, onMixedStart, initialView }) {
  const [query, setQuery] = useState(initialView?.query ?? '');
  const [expandedLesson, setExpandedLesson] = useState(initialView?.expandedLesson ?? '');
  const [limit, setLimit] = useState(initialView?.limit ?? PAGE_SIZE);
  const heading = useRef(null);
  const list = useRef(null);
  const firstNewIndex = useRef(null);
  const returnLesson = useRef(initialView?.expandedLesson || initialView?.lessonId);
  useEffect(() => {
    const card = Array.from(list.current?.children || []).find(item => item.dataset.lessonId === returnLesson.current);
    if (card) card.querySelector('h2')?.focus();
    else {
      heading.current?.closest('.quiz-workspace')?.scrollIntoView({ block: 'start', behavior: 'instant' });
      heading.current?.focus({ preventScroll: true });
    }
  }, []);
  useEffect(() => {
    if (firstNewIndex.current === null) return;
    list.current?.children[firstNewIndex.current]?.querySelector('h2')?.focus();
    firstNewIndex.current = null;
  }, [limit]);
  const chapters = getQuizChapters(subject.id);
  const filtered = useMemo(() => {
    const terms = query.trim().toLocaleLowerCase().split(/\s+/).filter(Boolean);
    if (!terms.length) return chapters;
    const matches = value => terms.every(term => value.toLocaleLowerCase().includes(term));
    return chapters.flatMap(chapter => {
      if (matches(chapter.title)) return [chapter];
      return chapter.practiceSets.filter(item => matches(`${item.title} ${item.outcome} ${item.concepts.join(' ')}`));
    });
  }, [chapters, query]);
  const visible = filtered.slice(0, limit);
  const remaining = filtered.length - visible.length;
  const start = (item, chapterId = '') => onStart(makeLessonQuizTopic(subject, item), { query, limit, lessonId: item.id, expandedLesson: chapterId });
  return <section className="quiz-lesson-library" aria-labelledby="quiz-lesson-title">
    <button type="button" className="quiz-text-control" onClick={onBack}><Grid2X2 size={16} aria-hidden="true" />All subjects</button>
    <header className="quiz-lesson-intro">
      <h1 id="quiz-lesson-title" ref={heading} tabIndex={-1}>{subject.title} lessons</h1>
      <p>Choose a lesson for a quiz across its key ideas, or open one practice set to study something specific.</p>
      {onMixedStart && <button type="button" className="quiz-text-control" onClick={onMixedStart}>Start subject challenge</button>}
    </header>
    <div className="quiz-lesson-tools">
      <label className="quiz-lesson-search"><Search size={17} aria-hidden="true" /><span className="sr-only">Search lessons in {subject.title}</span>
        <input type="search" value={query} onChange={event => { setQuery(event.target.value); setLimit(PAGE_SIZE); setExpandedLesson(''); }} maxLength={120} placeholder="Find a lesson or idea" /></label>
      <p role="status">{visible.length} of {filtered.length} {query.trim() ? 'matches' : 'lessons'}</p>
    </div>
    <div className="quiz-lesson-list" ref={list}>{visible.map(item => {
      const id = getLessonQuizId(subject.id, item.id);
      const record = progress[id];
      const practisedTopics = item.concepts.filter(concept => progress[getLessonQuizId(subject.id, item.id, concept)]?.attempts).length;
      const builtIn = getLessonTopicQuestions(makeLessonQuizTopic(subject, item)).length;
      return <article key={id} className="quiz-lesson-card" data-lesson-id={item.id}>
        <div className="quiz-lesson-meta"><span>{item.practiceSets ? `${item.practiceSets.length} practice ${item.practiceSets.length === 1 ? 'set' : 'sets'}` : item.branch}</span><span>{record?.attempts || practisedTopics ? <><Check size={13} aria-hidden="true" />Practised</> : builtIn ? <><BookOpen size={13} aria-hidden="true" />Built-in practice</> : 'Online questions'}</span></div>
        <h2 tabIndex={-1}>{item.title}</h2>
        {(!item.practiceSets || item.practiceSets.length === 1) && <p>{item.outcome}</p>}
        <ul aria-label={item.practiceSets ? 'What this lesson covers' : 'Concepts in this practice set'}>{item.concepts.map(concept => <li key={concept}>{concept}</li>)}</ul>
        <div className="quiz-lesson-card-foot">
          <button type="button" onClick={() => start(item)} aria-label={`Start quiz: ${item.title}`}><Play size={15} aria-hidden="true" />Start quiz</button>
          {item.practiceSets?.length > 1 && <button type="button" className="quiz-lesson-expand" aria-expanded={expandedLesson === item.id} aria-controls={item.id + '-practice'}
            onClick={() => setExpandedLesson(previous => previous === item.id ? '' : item.id)}>Focused practice</button>}
          {record?.attempts > 0 && <span>Last practice {record.lastPercent ?? record.bestPercent ?? 0}%</span>}
        </div>
        {item.practiceSets?.length > 1 && <div id={item.id + '-practice'} className="quiz-lesson-practice" hidden={expandedLesson !== item.id}>
          {expandedLesson === item.id && item.practiceSets.map(set => <button type="button" key={set.id} onClick={() => start(set, item.id)} aria-label={`Start quiz: ${set.title}`}>
            <span>{set.title}</span><Play size={14} aria-hidden="true" />
          </button>)}
        </div>}
      </article>;
    })}</div>
    {remaining > 0 && <div className="quiz-lesson-more"><button type="button" onClick={() => { firstNewIndex.current = visible.length; setLimit(count => count + PAGE_SIZE); }}>Load more lessons <span aria-hidden="true">+{Math.min(PAGE_SIZE, remaining)}</span></button></div>}
    {!filtered.length && <div className="quiz-lesson-empty"><h2>No lessons match</h2><p>Try another idea or clear the search.</p><button type="button" onClick={() => { setQuery(''); setLimit(PAGE_SIZE); }}>Show all lessons</button></div>}
    <p className="quiz-lesson-note">Built-in practice opens without generating a new set. Other lessons and fresh question sets need a connection. This is study practice, not a complete or official exam syllabus.</p>
  </section>;
}
