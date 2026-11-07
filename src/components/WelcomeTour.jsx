import { useEffect, useId, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { ArrowRight, BookOpen, Brain, Compass, Grid2X2, ListChecks, MessageCircle, Newspaper, Play, ScanSearch } from 'lucide-react';
import './WelcomeTour.css';

const STEPS = [
  {
    title: 'Find an idea',
    copy: 'Pick a subject in Topics or browse All posts and Videos. Tap Go deeper on a post for an AI-assisted explanation and related ideas.',
    tools: [[Grid2X2, 'Topics'], [Play, 'Videos'], [ScanSearch, 'Go deeper']],
  },
  {
    title: 'Make it stick',
    copy: 'Pick a lesson and difficulty in Quiz, then review the answers. Try Books for a longer read, or find posts you’ve bookmarked in Settings → Saved.',
    tools: [[Brain, 'Quiz'], [ListChecks, 'Review'], [BookOpen, 'Books']],
  },
  {
    title: 'Stay curious together',
    copy: 'Start with the daily briefing in News. Open an article to find its sources or follow the story where available. In Rooms, talk about what you’re learning.',
    tools: [[Newspaper, 'News'], [Compass, 'Follow a story'], [MessageCircle, 'Rooms']],
  },
];

export default function WelcomeTour({ onClose, replay = false }) {
  const dialogRef = useRef(null);
  const headingRef = useRef(null);
  const id = useId();
  const [index, setIndex] = useState(0);
  const step = STEPS[index];
  const lastStep = index === STEPS.length - 1;

  useEffect(() => {
    const dialog = dialogRef.current;
    const previousFocus = document.activeElement;
    const previousOverflow = document.body.style.overflow;
    if (typeof dialog.showModal !== 'function') return undefined;
    dialog.showModal();
    document.body.style.overflow = 'hidden';
    return () => {
      dialog.close();
      document.body.style.overflow = previousOverflow;
      if (previousFocus?.isConnected) previousFocus.focus({ preventScroll: true });
    };
  }, []);

  useEffect(() => {
    dialogRef.current.scrollTop = 0;
    headingRef.current?.focus({ preventScroll: true });
  }, [index]);

  return createPortal(
    <dialog ref={dialogRef} className="welcome-tour" aria-labelledby={id + '-title'} aria-describedby={id + '-description'}
      onCancel={event => { event.preventDefault(); onClose(); }}
      onKeyDown={event => {
        if (event.key === '/' || ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k')) {
          event.preventDefault();
          event.stopPropagation();
        }
      }}>
      <header className="welcome-tour-header">
        <span><span className="welcome-tour-mark" aria-hidden="true">S</span>Smarty tour</span>
        <button type="button" className="welcome-tour-skip" onClick={onClose}>Skip tour</button>
      </header>
      <div className="welcome-tour-content">
        <p className="welcome-tour-count">Step {index + 1} of {STEPS.length}</p>
        <h2 ref={headingRef} tabIndex={-1} id={id + '-title'}>{step.title}</h2>
        <p id={id + '-description'}>{step.copy}</p>
        <ul className="welcome-tour-tools" aria-label="Features in this step">
          {step.tools.map(([Icon, label]) => <li key={label}><Icon size={20} aria-hidden="true" /><span>{label}</span></li>)}
        </ul>
      </div>
      <footer className="welcome-tour-footer">
        {index > 0 && <button type="button" className="welcome-tour-back" onClick={() => setIndex(current => Math.max(0, current - 1))}>Back</button>}
        <button type="button" className="welcome-tour-next" onClick={lastStep ? onClose : () => setIndex(current => Math.min(STEPS.length - 1, current + 1))}>
          {lastStep ? (replay ? 'Done' : 'Start exploring') : 'Next'}<ArrowRight size={16} aria-hidden="true" />
        </button>
      </footer>
    </dialog>, document.body
  );
}
