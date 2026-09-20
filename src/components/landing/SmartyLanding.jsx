import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import {
  ArrowRight, ArrowUpRight, ArrowDown, Search, X, Check, BookOpen,
  Brain, Cpu, Globe2, FlaskConical, HeartPulse, Landmark, Palette,
  Sprout, TrendingUp, Wrench, UsersRound, Newspaper, MessageCircle,
  Bookmark, Languages, PenLine, ChartNoAxesCombined, Gamepad2, Route, UserRound, Bell,
} from 'lucide-react';
import SmartyBrand from '../SmartyBrand';
import { MAIN_TOPICS, getMainTopicDefinition } from '../../data/topicTaxonomy';
import './SmartyLanding.css';

const TOPIC_ICONS = [Newspaper, Cpu, Wrench, FlaskConical, HeartPulse, Globe2, Brain,
  TrendingUp, Sprout, Landmark, UsersRound, Palette, MessageCircle];

const FEATURES = [
  { name: 'Your learning feed', text: 'Small reads. Specific ideas. Follow the subjects that make you curious.', route: '/feed?topic=All', icon: BookOpen, kind: 'read', label: 'Discover something', sample: 'Why does a touch screen know where you tapped?' },
  { name: 'Quizzes & games', text: 'Put an idea to the test, find the gaps, and come back a little sharper.', route: '/quiz', icon: Gamepad2, kind: 'play', label: 'Make it stick', sample: 'A little challenge goes a long way.' },
  { name: 'News, with context', text: 'A daily world briefing, sector summaries, and original stories to explore.', route: '/feed?topic=News', icon: Newspaper, kind: 'news', label: 'Stay in the picture', sample: 'The day, made easier to understand.' },
  { name: 'A place to read', text: 'Find a book, settle into a longer read, and follow your curiosity further.', route: '/read-books', icon: BookOpen, kind: 'books', label: 'Take your time', sample: 'There is always another chapter.' },
];

const TOOLS = [
  { name: 'Learning paths', text: 'Keep the next idea in sight.', route: '/learn', icon: Route },
  { name: 'AI explanations', text: 'Open a post and ask for clarity.', route: '/feed?topic=All', icon: Brain },
  { name: 'Translation', text: 'Read posts in another language.', route: '/feed?topic=All', icon: Languages },
  { name: 'Topic discussions', text: 'Think it through together.', route: '/rooms', icon: UsersRound },
  { name: 'Messages', text: 'Keep the conversation going.', route: '/chat', icon: MessageCircle },
  { name: 'Saved posts', text: 'Keep the ideas worth returning to.', route: '/saved', icon: Bookmark },
  { name: 'Create a post', text: 'Share something worth knowing.', route: '/create', icon: PenLine },
  { name: 'Your progress', text: 'See how far you have come.', route: '/progress', icon: ChartNoAxesCombined },
  { name: 'Games & achievements', text: 'Build skills through play.', route: '/game-profile', icon: Gamepad2 },
  { name: 'Your profile', text: 'Your posts, interests, and account.', route: '/profile', icon: UserRound },
  { name: 'Notifications', text: 'Choose what you want to hear about.', route: '/notifications', icon: Bell },
];

function AttentionDiagram() {
  return (
    <div className="sl-diagram" aria-label="Example: a language model uses the context of The sky is to predict blue.">
      <span className="sl-diagram-caption">A SIMPLE IDEA, CONNECTED</span>
      <svg viewBox="0 0 460 195" fill="none" aria-hidden="true">
        <defs>
          <linearGradient id="sl-connection" x1="65" y1="100" x2="400" y2="100" gradientUnits="userSpaceOnUse">
            <stop stopColor="var(--ui-accent)" stopOpacity=".08" />
            <stop offset=".55" stopColor="var(--ui-accent)" />
            <stop offset="1" stopColor="var(--ui-accent)" stopOpacity=".25" />
          </linearGradient>
        </defs>
        <g stroke="url(#sl-connection)" strokeWidth="1.25">
          <path d="M68 40C140 40 147 97 214 97" /><path d="M68 97H214" />
          <path d="M68 154C140 154 147 97 214 97" /><path d="M246 97H389" />
        </g>
        <path className="sl-signal" d="M68 40C140 40 147 97 214 97H389" stroke="var(--ui-accent-hover)" strokeWidth="2" strokeDasharray="12 350" />
        <g fill="var(--ui-control-bg)" stroke="var(--ui-accent-line)">
          <rect x="12" y="22" width="58" height="36" rx="9" /><rect x="12" y="79" width="58" height="36" rx="9" />
          <rect x="12" y="136" width="58" height="36" rx="9" />
          <rect x="203" y="70" width="54" height="54" rx="16" />
          <rect x="365" y="76" width="81" height="42" rx="10" fill="var(--ui-brand-bg)" stroke="var(--ui-brand-bg)" />
        </g>
        <g fontFamily="inherit" fontSize="14" textAnchor="middle" fill="var(--ui-secondary)">
          <text x="41" y="45">The</text><text x="41" y="102">sky</text><text x="41" y="159">is</text>
          <text x="405" y="102" fill="var(--ui-accent-ink)" fontWeight="650">blue</text>
        </g>
        <g stroke="var(--ui-accent)" strokeWidth="1.3">
          <path d="M217 97h26M230 84v26M221 88l18 18M221 106l18-18" />
          <circle cx="230" cy="97" r="7" fill="var(--ui-control-hover)" />
        </g>
        <g fontSize="10" fill="var(--ui-faint)" textAnchor="middle" fontFamily="inherit">
          <text x="230" y="147">ATTENTION</text><text x="405" y="143">NEXT TOKEN</text>
        </g>
      </svg>
      <div className="sl-diagram-legend"><span>Context in</span><span>A connection made</span></div>
    </div>
  );
}

function LearningPreview() {
  const [step, setStep] = useState(0);
  const [answer, setAnswer] = useState(null);
  const labels = ['Discover', 'Understand', 'Test yourself'];
  const chooseTab = (next) => {
    setStep(next);
    document.getElementById('sl-preview-tab-' + next)?.focus();
  };

  return (
    <div className="sl-preview">
      <div className="sl-preview-top"><span><i /> THE CURIOSITY LAB</span><span>Try it here</span></div>
      <AttentionDiagram />
      <div className="sl-preview-tabs" role="tablist" aria-label="Try the learning experience">
        {labels.map((label, index) => (
          <button key={label} id={'sl-preview-tab-' + index} role="tab"
            aria-selected={step === index} aria-controls="sl-preview-panel" tabIndex={step === index ? 0 : -1}
            onClick={() => setStep(index)}
            onKeyDown={(event) => {
              if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
              event.preventDefault();
              chooseTab(event.key === 'Home' ? 0 : event.key === 'End' ? 2 : (step + (event.key === 'ArrowRight' ? 1 : 2)) % 3);
            }}>
            <span>0{index + 1}</span>{label}
          </button>
        ))}
      </div>
      <div id="sl-preview-panel" role="tabpanel" aria-labelledby={'sl-preview-tab-' + step} tabIndex={0} className="sl-preview-panel">
        <div key={step} className="sl-preview-content">
          {step === 0 && <>
            <span className="sl-small-label">TECHNOLOGY / ARTIFICIAL INTELLIGENCE</span>
            <h2>How does AI know<br />what comes next?</h2>
            <p>A language model predicts the next token from the context before it. Attention helps it work out which parts of that context matter.</p>
            <button className="sl-text-action" onClick={() => setStep(1)}>Make it click <ArrowRight size={16} /></button>
          </>}
          {step === 1 && <>
            <span className="sl-small-label">ONE IDEA, A LITTLE CLEARER</span>
            <h2>Think of attention<br />as a highlighter.</h2>
            <p>In “The sky is…”, the word “sky” is a useful clue. Attention weighs connections between tokens, helping the model use relevant context to predict what follows.</p>
            <button className="sl-text-action" onClick={() => setStep(2)}>Try a quick question <ArrowRight size={16} /></button>
          </>}
          {step === 2 && <>
            <span className="sl-small-label">QUICK CHECK / TRY AN ANSWER</span>
            <h2>What does attention help a model do?</h2>
            <div className="sl-answers">
              {['Use the relevant parts of the context', 'Look up one fixed answer every time'].map((option, index) =>
                <button key={option} onClick={() => setAnswer(index)}
                  className={answer === index ? (index === 0 ? 'is-correct' : 'is-incorrect') : ''}
                  aria-pressed={answer === index}><span>{index === 0 ? 'A' : 'B'}</span>{option}{answer === index && index === 0 && <Check size={16} />}</button>)}
            </div>
            <p className="sl-answer-feedback" role="status">{answer === 0 ? 'Exactly. It weighs connections so useful context can guide the prediction.' : answer === 1 ? 'Try A. Attention weighs the context; it does not retrieve a fixed answer.' : 'No score to chase. Just a connection to make.'}</p>
          </>}
        </div>
      </div>
      <div className="sl-preview-bottom"><span>One idea. A deeper understanding.</span><span>SMARTY <ArrowUpRight size={12} /></span></div>
    </div>
  );
}

function FeatureArtwork({ kind }) {
  return <div className={'sl-feature-art sl-art-' + kind} aria-hidden="true">
    {kind === 'read' && <><span className="sl-art-tag">A QUESTION WORTH ASKING</span><div className="sl-touch-rings"><span /><span /><span /><i /></div><span className="sl-art-caption">Everyday things. Unexpected answers.</span></>}
    {kind === 'play' && <><span className="sl-art-tag">CONNECT THE DOTS</span><div className="sl-play-tiles"><span><Brain /></span><span>?</span><span><Check /></span></div><span className="sl-art-caption">Discover → understand → remember</span></>}
    {kind === 'news' && <><span className="sl-art-tag">YOUR DAILY BRIEFING</span><div className="sl-news-lines"><span>Closer to home.</span><span>Connected to the world.</span><i /><i /></div><span className="sl-art-caption">Choose a country. Explore the stories.</span></>}
    {kind === 'books' && <><span className="sl-art-tag">MAKE ROOM FOR A LONGER READ</span><div className="sl-book-spines"><span>IDEAS</span><span>DISCOVERY</span><span>PERSPECTIVE</span><span>STORIES</span></div></>}
  </div>;
}

export default function SmartyLanding({ onSelect, onOpenSearch }) {
  const rootRef = useRef(null);
  const { hash } = useLocation();
  const [query, setQuery] = useState('');
  const filteredTopics = useMemo(() => {
    const search = query.trim().toLowerCase();
    const exactTopic = getMainTopicDefinition(search);
    return MAIN_TOPICS.filter((topic) => {
      if (!search || topic.id === exactTopic?.id) return true;
      const text = [topic.label, topic.description, ...topic.topics].join(' ').toLowerCase();
      return search.length <= 2
        ? text.split(/[^a-z0-9]+/).some((word) => word.startsWith(search))
        : text.includes(search);
    });
  }, [query]);

  const scrollToSection = (event, id) => {
    event?.preventDefault();
    rootRef.current?.querySelector('#' + id)?.scrollIntoView({
      behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth',
      block: 'start',
    });
  };

  useEffect(() => {
    if (!hash) return;
    const id = hash.slice(1);
    if (!['topic-catalog', 'smarty-features', 'smarty-tools'].includes(id)) return;
    const frame = requestAnimationFrame(() => scrollToSection(null, id));
    return () => cancelAnimationFrame(frame);
  }, [hash]);

  useEffect(() => {
    const root = rootRef.current;
    if (!root || !('IntersectionObserver' in window)) return;
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
    const animations = new Set();
    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        observer.unobserve(entry.target);
        if (reducedMotion.matches || !entry.target.animate) return;
        const animation = entry.target.animate(
          [{ opacity: 0.3, transform: 'translateY(24px)' }, { opacity: 1, transform: 'translateY(0)' }],
          { duration: 650, delay: Number(entry.target.dataset.revealDelay || 0), easing: 'cubic-bezier(.2,.7,.2,1)' }
        );
        animations.add(animation);
        animation.onfinish = () => animations.delete(animation);
      });
    }, { threshold: 0.08 });
    root.querySelectorAll('[data-reveal]').forEach((element) => observer.observe(element));
    const visibility = new IntersectionObserver(([entry]) => {
      root.classList.toggle('sl-hero-visible', entry.isIntersecting);
    });
    visibility.observe(root.querySelector('.sl-hero'));
    const stopMotion = () => { if (reducedMotion.matches) animations.forEach((animation) => animation.cancel()); };
    reducedMotion.addEventListener?.('change', stopMotion);
    return () => {
      observer.disconnect();
      visibility.disconnect();
      animations.forEach((animation) => animation.cancel());
      reducedMotion.removeEventListener?.('change', stopMotion);
    };
  }, []);

  return (
    <div ref={rootRef} className="smarty-landing">
      <a className="sl-skip" href="#topic-catalog" onClick={(event) => { scrollToSection(event, 'topic-catalog'); rootRef.current.querySelector('#sl-topic-search')?.focus({ preventScroll: true }); }}>Skip to topics</a>
      <header className="sl-nav">
        <button className="sl-brand-link" aria-label="Smarty — open all posts" onClick={() => onSelect('All')}><SmartyBrand /></button>
        <nav aria-label="Explore Smarty">
          <a href="#topic-catalog" onClick={(event) => scrollToSection(event, 'topic-catalog')}>Topics</a>
          <a href="#smarty-features" onClick={(event) => scrollToSection(event, 'smarty-features')}>Features</a>
          <button className="sl-nav-search" onClick={onOpenSearch} aria-label="Search Smarty"><Search size={17} strokeWidth={1.7} /></button>
          <Link className="sl-nav-open" to="/feed?topic=All">Open Smarty <ArrowUpRight size={15} /></Link>
        </nav>
      </header>

      <section className="sl-hero sl-wrap" aria-labelledby="sl-hero-title">
        <div className="sl-hero-copy">
          <div className="sl-overline"><span className="sl-live-dot" /> FOR THE EVER-CURIOUS</div>
          <h1 id="sl-hero-title">Follow an idea.<br />See where it<br /><span>takes you.</span></h1>
          <p>Discover something new. Understand it a little deeper. Turn an everyday scroll into a trail of things worth knowing.</p>
          <div className="sl-hero-actions">
            <button className="sl-action sl-action-primary" onClick={() => onSelect('All')}>Start exploring <ArrowUpRight size={18} /></button>
            <a className="sl-action sl-action-subtle" href="#topic-catalog" onClick={(event) => scrollToSection(event, 'topic-catalog')}>Find your topic <ArrowDown size={16} /></a>
          </div>
          <div className="sl-hero-note"><span className="sl-note-symbol">✳</span><span>Big questions. Small discoveries.<br /><strong>All connected.</strong></span></div>
        </div>
        <div className="sl-hero-visual"><div className="sl-visual-index"><span>01 / A SMALL TASTE OF SMARTY</span><span>INTERACTIVE PREVIEW</span></div><LearningPreview /></div>
      </section>

      <div className="sl-shortcuts sl-wrap" aria-label="Quick access to Smarty features">
        {[['Feed', BookOpen, '/feed?topic=All'], ['Learning', Route, '/learn'], ['Quizzes', Brain, '/quiz'], ['News', Newspaper, '/news'], ['Books', BookOpen, '/read-books'], ['Discuss', UsersRound, '/rooms']].map(([label, Icon, to]) => <Link to={to} key={label}><Icon size={18} strokeWidth={1.5} /><span>{label}</span><ArrowUpRight size={13} /></Link>)}
      </div>

      <section id="topic-catalog" className="sl-catalog sl-wrap" aria-labelledby="sl-topics-title">
        <header className="sl-section-heading" data-reveal>
          <div><span className="sl-overline">02 / FIND YOUR THREAD</span><h2 id="sl-topics-title">A world for every<br /><span>kind of curious.</span></h2></div>
          <p>Start with an interest. Follow it into the specific ideas, stories, and questions hiding underneath.</p>
        </header>
        <div className="sl-catalog-toolbar">
          <label className="sl-search" htmlFor="sl-topic-search"><Search size={18} aria-hidden="true" /><input id="sl-topic-search" type="search" placeholder="Try AI, sleep, history…" value={query} onChange={(event) => setQuery(event.target.value)} autoComplete="off" aria-label="Search topics and subjects" />{query && <button onClick={() => { setQuery(''); rootRef.current.querySelector('#sl-topic-search')?.focus(); }} aria-label="Clear topic search"><X size={16} /></button>}</label>
          <span className="sl-topic-count" role="status">{filteredTopics.length} {filteredTopics.length === 1 ? 'world' : 'worlds'} to explore</span>
          <button className="sl-text-action" onClick={() => onSelect('All')}>All posts <ArrowUpRight size={16} /></button>
        </div>
        <div className="sl-topics">
          {filteredTopics.map((topic) => {
            const index = MAIN_TOPICS.indexOf(topic);
            const Icon = TOPIC_ICONS[index] || BookOpen;
            return <button className="sl-topic" key={topic.id} onClick={() => onSelect(topic.label)} aria-label={'Explore ' + topic.label}>
              <div className="sl-topic-top"><Icon size={23} strokeWidth={1.4} /><span>{String(index + 1).padStart(2, '0')}</span></div>
              <h3>{topic.label}</h3><p>{topic.description}</p>
              <div className="sl-topic-bottom"><span>{topic.topics.slice(0, 2).join(' / ')}</span><ArrowUpRight size={17} /></div>
            </button>;
          })}
        </div>
        {filteredTopics.length === 0 && <div className="sl-empty"><Search size={24} /><h3>No worlds found for “{query}”</h3><p>Try a subject such as AI, music, or psychology.</p><button className="sl-action" onClick={() => setQuery('')}>See all topics <ArrowRight size={16} /></button></div>}
      </section>

      <section id="smarty-features" className="sl-features sl-wrap" aria-labelledby="sl-features-title">
        <header className="sl-section-heading" data-reveal><div><span className="sl-overline">03 / KEEP THE CURIOSITY GOING</span><h2 id="sl-features-title">More ways in.<br /><span>More to take away.</span></h2></div><p>A quick read or a longer rabbit hole. A challenge or a conversation. Make room for the way you like to learn.</p></header>
        <div className="sl-feature-grid">
          {FEATURES.map((feature, index) => <Link to={feature.route} className="sl-feature" key={feature.name} data-reveal data-reveal-delay={index % 2 * 65}>
            <FeatureArtwork kind={feature.kind} />
            <div className="sl-feature-copy"><span className="sl-small-label">{feature.label}</span><h3>{feature.name} <ArrowUpRight size={21} /></h3><p>{feature.text}</p></div>
          </Link>)}
        </div>
      </section>

      <section id="smarty-tools" className="sl-tools sl-wrap" aria-labelledby="sl-tools-title">
        <header className="sl-section-heading" data-reveal><div><span className="sl-overline">04 / MAKE IT YOUR OWN</span><h2 id="sl-tools-title">Every idea has<br /><span>a next step.</span></h2></div><p>Ask for a clearer explanation. Save a discovery. Share a thought. Everything you need is a tap away.</p></header>
        <div className="sl-tools-grid">
          {TOOLS.map(({ name, text, route, icon: Icon }) => <Link key={name} to={route} className="sl-tool"><Icon size={21} strokeWidth={1.5} /><div><h3>{name}</h3><p>{text}</p></div><ArrowUpRight size={15} /></Link>)}
          <button className="sl-tool sl-tool-search" onClick={onOpenSearch}><Search size={21} strokeWidth={1.5} /><div><h3>Search Smarty</h3><p>Find posts, people, topics, and more.</p></div><ArrowUpRight size={15} /></button>
        </div>
      </section>

      <section className="sl-closing sl-wrap" data-reveal>
        <span className="sl-closing-symbol" aria-hidden="true">✳</span><span className="sl-overline">LET ONE GOOD IDEA LEAD TO ANOTHER</span>
        <h2>Your next “I didn’t know that”<br /><span>starts here.</span></h2>
        <button className="sl-action sl-action-primary" onClick={() => onSelect('All')}>Find something new <ArrowUpRight size={18} /></button>
      </section>
      <footer className="sl-footer sl-wrap"><SmartyBrand /><span>A little more curious, every day.</span><nav aria-label="Smarty information"><Link to="/support">Help</Link><Link to="/privacy">Privacy</Link><Link to="/terms">Terms</Link></nav></footer>
    </div>
  );
}
