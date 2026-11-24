import { memo, useEffect, useId, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { splitGlossaryText } from '../lib/postGlossary';
import { manageVocabularyDialog, vocabularyPanelPosition } from '../lib/postVocabularyDialog';
import './PostVocabulary.css';

const EMPTY_TERMS = [];

export default memo(function PostVocabulary({ text, terms = EMPTY_TERMS }) {
  const parts = useMemo(() => splitGlossaryText(text, terms), [text, terms]);
  const [opened, setOpened] = useState(null);
  const panelRef = useRef(null), id = useId();
  const visible = opened?.text === text && opened?.terms === terms ? opened : null;
  useEffect(() => {
    if (!visible) return undefined;
    return manageVocabularyDialog({ panel: panelRef.current, trigger: visible.trigger, onClose: () => setOpened(null) });
  }, [visible]);
  const open = (event, word, index) => {
    event.stopPropagation();
    const rect = event.currentTarget.getBoundingClientRect();
    setOpened({ word, text, terms, index, trigger: event.currentTarget, style: vocabularyPanelPosition(rect) });
  };
  return <>
    {parts.map((part, index) => typeof part === 'string' ? part : <button type="button" key={index}
      className="post-vocabulary-word" aria-label={`Explain ${part.text}`} aria-haspopup="dialog"
      aria-expanded={Boolean(visible && visible.index === index)} aria-controls={visible?.index === index ? `${id}-dialog` : undefined}
      onClick={event => open(event, part, index)}>{part.text}</button>)}
    {visible && createPortal(<div className="post-vocabulary-layer" onClick={event => {
      event.stopPropagation(); if (event.target === event.currentTarget) setOpened(null);
    }}>
      <aside ref={panelRef} id={`${id}-dialog`} style={visible.style} className="post-vocabulary-meaning" role="dialog" aria-modal="true" aria-labelledby={`${id}-heading`} aria-describedby={`${id}-meaning`} tabIndex={-1}>
        <header><strong id={`${id}-heading`}>{visible.word.text}</strong><button type="button" aria-label="Close word explanation" onClick={() => setOpened(null)}>×</button></header>
        <p id={`${id}-meaning`}>{visible.word.meaning}</p><small>AI-assisted meaning in this post</small>
      </aside>
    </div>, document.body)}
  </>;
});
