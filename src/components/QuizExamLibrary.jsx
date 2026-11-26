import { useMemo, useState } from 'react';
import { ArrowUpRight, BookOpen, ChevronRight, Search } from 'lucide-react';
import { EXAM_BLUEPRINTS, makeExamTopic } from '../data/examPractice.js';

export default function QuizExamLibrary({ examId, onChoose, onStart }) {
  const [query, setQuery] = useState('');
  const exam = EXAM_BLUEPRINTS.find(item => item.id === examId);
  const matches = useMemo(() => {
    const terms = query.toLocaleLowerCase().trim().split(/\s+/).filter(Boolean);
    return EXAM_BLUEPRINTS.filter(item => terms.every(term => `${item.title} ${item.provider} ${item.area} ${item.code} ${item.description}`.toLocaleLowerCase().includes(term)));
  }, [query]);
  if (exam) return <section className="quiz-exam-library" aria-labelledby="exam-title">
    <button type="button" className="quiz-text-control" onClick={() => onChoose('')}>All exam tracks</button>
    <header><p>{exam.provider} · {exam.code}</p><h1 id="exam-title">{exam.title}</h1><p>{exam.description}</p></header>
    <p className="quiz-exam-scope">{exam.coverage}</p>
    <button type="button" className="learning-primary-action" onClick={() => onStart(makeExamTopic(exam.id))}><BookOpen size={17} />Start mixed-area practice<ChevronRight size={16} /></button>
    <div className="quiz-exam-domains" aria-label="Choose a practice area">{exam.domains.map(domain => <button type="button" key={domain.id} onClick={() => onStart(makeExamTopic(exam.id, domain.id))}>
      <span><strong>{domain.title}</strong><small>{domain.focus}</small></span><ChevronRight size={17} aria-hidden="true" />
    </button>)}</div>
    <a href={exam.url} target="_blank" rel="noopener noreferrer">Provider’s exam guide<ArrowUpRight size={15} aria-hidden="true" /></a>
    <p className="quiz-exam-disclaimer">Original, independent practice. Not affiliated with or endorsed by the exam provider. No leaked or recalled exam questions. Verify the required version before booking.</p>
  </section>;
  return <section className="quiz-exam-library" aria-labelledby="exam-library-title">
    <header><h2 id="exam-library-title">Practise for a specific exam</h2><p>Choose a named track, then a practice area. Your selected difficulty still applies.</p></header>
    <label className="quiz-exam-search"><Search size={17} aria-hidden="true" /><span className="sr-only">Search exam tracks</span><input type="search" value={query} maxLength={100} onChange={event => setQuery(event.target.value)} placeholder="IELTS, cybersecurity, Terraform, AWS…" /></label>
    <div className="quiz-exam-tracks">{matches.map(item => <button type="button" key={item.id} onClick={() => onChoose(item.id)}>
      <span className="quiz-exam-provider">{item.provider}</span><strong>{item.title}</strong><span>{item.code} · {item.area}</span><p>{item.description}</p><span className="quiz-exam-open">Choose practice area<ChevronRight size={15} /></span>
    </button>)}</div>
    {!matches.length && <p role="status">No matching track. Try the exam name, provider or subject.</p>}
  </section>;
}
