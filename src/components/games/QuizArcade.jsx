import { useLayoutEffect, useRef } from 'react';
import { ArrowLeft, ArrowRight, Brain, FlaskConical, Gamepad2, Link2, Volume2, VolumeX } from 'lucide-react';

const PICKS = [
  { id: 'mind-health', title: 'Memory & focus', description: 'Recall a sequence and build a memory palace.', Icon: Brain, color: 'iris' },
  { id: 'science-mathematics', title: 'Science lab', description: 'Connect ideas and put an experiment in order.', Icon: FlaskConical, color: 'sky' },
  { id: 'life-sciences', title: 'Life sciences', description: 'Match related ideas and test your recall.', Icon: Link2, color: 'mint' },
];

export function ArcadeEntry({ onOpen, title = 'Smarty Arcade', description = 'Try a subject challenge with questions and mini-games.' }) {
  return <button type="button" className="arcade-entry" onClick={onOpen}>
    <span className="arcade-entry-icon"><Gamepad2 size={22} aria-hidden="true" /></span>
    <span><strong>{title}</strong><small>{description}</small></span>
    <ArrowRight size={19} aria-hidden="true" />
  </button>;
}

export function ArcadeLobby({ onChoose }) {
  const headingRef = useRef(null);
  useLayoutEffect(() => {
    headingRef.current?.scrollIntoView({ block: 'nearest', behavior: 'instant' });
    headingRef.current?.focus({ preventScroll: true });
  }, []);
  return <section className="arcade-lobby" aria-labelledby="arcade-lobby-title">
    <div className="arcade-lobby-screen">
      <div className="arcade-lobby-copy">
        <p><Gamepad2 size={18} aria-hidden="true" /> Questions + games</p>
        <h1 id="arcade-lobby-title" ref={headingRef} tabIndex={-1}>Smarty Arcade</h1>
        <p>Pick a subject challenge. Answer questions, then put what you know to work in a mini-game.</p>
      </div>
      <div className="arcade-pad-art" aria-hidden="true">
        <span /><span /><span /><span /><span /><span /><span /><span /><span />
      </div>
    </div>
    <div className="arcade-picks" aria-label="Featured game challenges">
      {PICKS.map(({ id, title, description, Icon, color }) => <button type="button" key={id} className={`arcade-pick is-${color}`} onClick={() => onChoose(id)}>
        <span className="arcade-pick-icon"><Icon size={22} aria-hidden="true" /></span>
        <span><strong>{title}</strong><small>{description}</small></span>
        <ArrowRight size={16} aria-hidden="true" />
      </button>)}
    </div>
  </section>;
}

export function ArcadeStage({ subject, round, total, boss = false, survivalTime, onExit, soundEnabled, onToggleSound, children }) {
  const headingRef = useRef(null);
  useLayoutEffect(() => {
    const heading = headingRef.current;
    heading?.closest('.content')?.scrollTo({ top: 0, behavior: 'instant' });
    heading?.focus({ preventScroll: true });
  }, [round, boss]);
  return <main className={`quiz-page quiz-workspace quiz-arcade${boss ? ' is-boss-round' : ''}`}>
    <div className="arcade-console">
      <header className="arcade-console-bar">
        <button type="button" className="arcade-console-control" onClick={onExit}><ArrowLeft size={17} aria-hidden="true" /> Subjects</button>
        <span className="arcade-console-brand"><Gamepad2 size={17} aria-hidden="true" /> Smarty Arcade</span>
        <button type="button" className="arcade-console-control arcade-sound" aria-label="Game sound" aria-pressed={soundEnabled} onClick={onToggleSound}>
          {soundEnabled ? <Volume2 size={19} aria-hidden="true" /> : <VolumeX size={19} aria-hidden="true" />}
        </button>
      </header>
      <div className="arcade-screen">
        <div className="arcade-round-header">
          <div><span>{boss ? 'Boss level' : 'Mini-game'}</span><h1 ref={headingRef} tabIndex={-1}>{subject}</h1></div>
          {!boss && <div className="arcade-round-count"><strong>{round}</strong><span> / {total}</span></div>}
        </div>
        {!boss && <div className="arcade-round-meter" role="progressbar" aria-label="Challenge rounds" aria-valuemin={0} aria-valuemax={total} aria-valuenow={round} aria-valuetext={`Round ${round} of ${total}`}>
          {Array.from({ length: total }, (_, index) => <span aria-hidden="true" key={index} className={index < round - 1 ? 'is-complete' : index === round - 1 ? 'is-current' : undefined} />)}
        </div>}
        {survivalTime != null && <p className="arcade-survival-time">Survival <strong>{survivalTime}s</strong></p>}
        {children}
      </div>
    </div>
  </main>;
}
