import { useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Check, ChevronDown, LayoutGrid, Search } from 'lucide-react';

export default function FeedTopicPicker({ selected, choices, onSelect, onBrowse }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [active, setActive] = useState(0);
  const [position, setPosition] = useState({ left: 12, top: 60, maxHeight: 420 });
  const triggerRef = useRef(null);
  const panelRef = useRef(null);
  const inputRef = useRef(null);
  const listId = useId();
  const filtered = useMemo(() => choices.filter(choice =>
    (choice === 'All' ? 'All posts' : choice).toLowerCase().includes(query.trim().toLowerCase())
  ), [choices, query]);
  const label = selected === 'All' ? 'All posts' : selected;

  function close(restoreFocus = true) {
    setOpen(false);
    if (restoreFocus) triggerRef.current?.focus();
  }
  function choose(value) {
    close();
    onSelect(value);
  }

  useEffect(() => { setOpen(false); setQuery(''); }, [selected]);
  useEffect(() => {
    setActive(query ? 0 : Math.max(0, filtered.indexOf(selected)));
  }, [query, selected, filtered]);
  useLayoutEffect(() => {
    if (!open) return undefined;
    const place = () => {
      const rect = triggerRef.current?.getBoundingClientRect();
      if (!rect) return;
      const width = Math.min(320, window.innerWidth - 24);
      setPosition({
        left: Math.max(12, Math.min(rect.left, window.innerWidth - width - 12)),
        top: rect.bottom + 8,
        maxHeight: Math.max(160, Math.min(440, window.innerHeight - rect.bottom - 24)),
      });
    };
    place();
    const frame = requestAnimationFrame(() => inputRef.current?.focus());
    const outside = event => {
      if (!panelRef.current?.contains(event.target) && !triggerRef.current?.contains(event.target)) close(false);
    };
    const escape = event => {
      if (event.key === 'Escape') { event.preventDefault(); close(); }
    };
    window.addEventListener('resize', place);
    document.addEventListener('pointerdown', outside);
    document.addEventListener('keydown', escape);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener('resize', place);
      document.removeEventListener('pointerdown', outside);
      document.removeEventListener('keydown', escape);
    };
  }, [open]);
  useEffect(() => {
    if (open) document.getElementById(`${listId}-${active}`)?.scrollIntoView({ block: 'nearest' });
  }, [active, open, listId]);

  function handleKeys(event) {
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      setActive(index => filtered.length ? (index + (event.key === 'ArrowDown' ? 1 : -1) + filtered.length) % filtered.length : 0);
      inputRef.current?.focus();
    } else if (event.key === 'Enter' && event.target === inputRef.current && filtered[active]) {
      event.preventDefault(); choose(filtered[active]);
    }
  }

  return <>
    <button ref={triggerRef} type="button" className="feed-topic-select feed-topic-trigger"
      aria-label={`Change feed topic: ${label}`} aria-haspopup="dialog" aria-expanded={open}
      aria-controls={open ? `${listId}-panel` : undefined}
      onClick={() => { setQuery(''); setOpen(value => !value); }}>
      <span>{label}</span><ChevronDown size={14} aria-hidden="true" />
    </button>
    {open && createPortal(<section ref={panelRef} id={`${listId}-panel`} className="feed-topic-picker"
      role="dialog" aria-label="Choose a feed topic" style={position} onKeyDown={handleKeys}
      onBlur={event => {
        if (event.relatedTarget && !event.currentTarget.contains(event.relatedTarget) && event.relatedTarget !== triggerRef.current) close(false);
      }}>
      <div className="feed-topic-picker-search"><Search size={17} aria-hidden="true" />
        <input ref={inputRef} type="search" placeholder="Find a topic" aria-label="Find a feed topic"
          role="combobox" aria-expanded="true" aria-controls={listId} aria-autocomplete="list"
          aria-activedescendant={filtered[active] ? `${listId}-${active}` : undefined}
          value={query} onChange={event => setQuery(event.target.value)} autoComplete="off" />
      </div>
      <div className="feed-topic-picker-list" role="listbox" id={listId} aria-label="Feed topics">
        {filtered.map((choice, index) => <button key={choice} id={`${listId}-${index}`} type="button"
          role="option" aria-selected={choice === selected} className={index === active ? 'is-active' : ''}
          onPointerMove={() => setActive(index)} onClick={() => choose(choice)}>
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
