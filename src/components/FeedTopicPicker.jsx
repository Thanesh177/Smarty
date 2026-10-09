import { useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useLocation } from 'react-router-dom';
import { Check, ChevronDown, LayoutGrid, Search } from 'lucide-react';
import { topicPickerPosition } from '../lib/topicPickerPosition';

export default function FeedTopicPicker({ selected, choices, onSelect, onBrowse, compact = false }) {
  const { pathname, search } = useLocation();
  const isFeedRoute = pathname === '/feed' || pathname.startsWith('/feed/');
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [active, setActive] = useState(0);
  const [position, setPosition] = useState({ left: 12, top: 60, maxHeight: 420 });
  const triggerRef = useRef(null);
  const panelRef = useRef(null);
  const inputRef = useRef(null);
  const listRef = useRef(null);
  const scrollActiveRef = useRef(true);
  const listId = useId();
  const filtered = useMemo(() => choices.filter(choice =>
    (choice === 'All' ? 'All posts' : choice).toLowerCase().includes(query.trim().toLowerCase())
  ), [choices, query]);
  const label = selected === 'All' ? 'All posts' : selected;

  function close(restoreFocus = true) {
    setOpen(false);
    if (restoreFocus) triggerRef.current?.focus({ preventScroll: true });
  }
  function choose(value) {
    close();
    onSelect(value);
  }

  useEffect(() => { setOpen(false); setQuery(''); }, [selected, pathname, search]);
  useEffect(() => {
    scrollActiveRef.current = true;
    setActive(query ? 0 : Math.max(0, filtered.indexOf(selected)));
  }, [query, selected, filtered]);
  useLayoutEffect(() => {
    if (!open) return undefined;
    const place = () => {
      const rect = triggerRef.current?.getBoundingClientRect();
      if (!rect) return;
      const viewport = window.visualViewport;
      setPosition(topicPickerPosition(rect, {
        left: viewport?.offsetLeft || 0,
        top: viewport?.offsetTop || 0,
        width: viewport?.width || window.innerWidth,
        height: viewport?.height || window.innerHeight,
      }));
    };
    place();
    // Touch users can browse immediately; only opening search should summon a keyboard.
    const frame = requestAnimationFrame(() => {
      if (window.matchMedia('(hover: hover) and (pointer: fine)').matches) {
        inputRef.current?.focus({ preventScroll: true });
      }
    });
    const outside = event => {
      if (!panelRef.current?.contains(event.target) && !triggerRef.current?.contains(event.target)) close(false);
    };
    const escape = event => {
      if (event.key === 'Escape') { event.preventDefault(); close(); }
    };
    window.addEventListener('resize', place);
    window.visualViewport?.addEventListener('resize', place);
    window.visualViewport?.addEventListener('scroll', place);
    document.addEventListener('pointerdown', outside);
    document.addEventListener('keydown', escape);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener('resize', place);
      window.visualViewport?.removeEventListener('resize', place);
      window.visualViewport?.removeEventListener('scroll', place);
      document.removeEventListener('pointerdown', outside);
      document.removeEventListener('keydown', escape);
    };
  }, [open]);
  useEffect(() => {
    if (!open || !scrollActiveRef.current) return;
    const list = listRef.current;
    const row = document.getElementById(`${listId}-${active}`);
    if (!list || !row) return;
    const bounds = list.getBoundingClientRect();
    const item = row.getBoundingClientRect();
    // Move only the list, never the feed behind this portalled menu.
    if (item.top < bounds.top + 6) list.scrollTop += item.top - bounds.top - 6;
    else if (item.bottom > bounds.bottom - 6) list.scrollTop += item.bottom - bounds.bottom + 6;
    scrollActiveRef.current = false;
  }, [active, open, listId, filtered]);

  function handleKeys(event) {
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      scrollActiveRef.current = true;
      setActive(index => filtered.length ? (index + (event.key === 'ArrowDown' ? 1 : -1) + filtered.length) % filtered.length : 0);
      inputRef.current?.focus();
    } else if (event.key === 'Enter' && event.target === inputRef.current && filtered.length) {
      event.preventDefault(); choose(filtered[active] || filtered[0]);
    }
  }

  // Never expose feed navigation inside direct or room conversations.
  if (!isFeedRoute) return null;

  return <>
    <button ref={triggerRef} type="button" className={`feed-topic-select feed-topic-trigger${compact ? ' is-compact' : ''}`}
      title={compact ? `Topics: ${label}` : undefined}
      aria-label={`Change feed topic: ${label}`} aria-haspopup="dialog" aria-expanded={open}
      aria-controls={open ? `${listId}-panel` : undefined}
      onClick={() => { scrollActiveRef.current = true; setQuery(''); setOpen(value => !value); }}>
      {compact ? <><LayoutGrid size={17} aria-hidden="true" /><span>Topics</span></> : <><span>{label}</span><ChevronDown size={14} aria-hidden="true" /></>}
    </button>
    {open && createPortal(<section ref={panelRef} id={`${listId}-panel`} className="feed-topic-picker"
      role="dialog" aria-label="Choose a feed topic" style={position} onKeyDown={handleKeys}
      onTouchStart={event => event.stopPropagation()}
      onTouchMove={event => event.stopPropagation()}
      onTouchEnd={event => event.stopPropagation()}
      onBlur={event => {
        if (event.relatedTarget && !event.currentTarget.contains(event.relatedTarget) && event.relatedTarget !== triggerRef.current) close(false);
      }}>
      <div className="feed-topic-picker-search"><Search size={17} aria-hidden="true" />
        <input ref={inputRef} type="search" placeholder="Find a topic" aria-label="Find a feed topic"
          role="combobox" aria-expanded="true" aria-controls={listId} aria-autocomplete="list"
          aria-activedescendant={filtered[active] ? `${listId}-${active}` : undefined}
          value={query} onChange={event => setQuery(event.target.value)} autoComplete="off" />
      </div>
      <div ref={listRef} className="feed-topic-picker-list" role="listbox" id={listId} aria-label="Feed topics">
        {filtered.map((choice, index) => <button key={choice} id={`${listId}-${index}`} type="button"
          role="option" aria-selected={choice === selected} className={index === active ? 'is-active' : ''}
          onPointerMove={event => { if (event.pointerType === 'mouse') setActive(index); }} onClick={() => choose(choice)}>
          <span>{choice === 'All' ? 'All posts' : choice}</span>{choice === selected && <Check size={16} aria-hidden="true" />}
        </button>)}
        {!filtered.length && <p className="feed-topic-picker-empty">No topics found. Try another word.</p>}
      </div>
      <button type="button" className="feed-topic-picker-browse" onClick={() => { close(); onBrowse(); }}>
        <LayoutGrid size={16} aria-hidden="true" />Browse all topics
      </button>
    </section>, document.body)}
  </>;
}
