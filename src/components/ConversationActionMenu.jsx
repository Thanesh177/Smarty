import { useEffect, useId, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import './ConversationActionMenu.css';

export default function ConversationActionMenu({ anchorRef, id, label, onDismiss, keyboard, children }) {
  const panelRef = useRef(null);

  useLayoutEffect(() => {
    const panel = panelRef.current;
    const anchor = anchorRef.current;
    if (!anchor || !panel) return undefined;
    const viewport = window.visualViewport;
    let frame = 0;
    const position = () => {
      const anchorBounds = anchor.getBoundingClientRect();
      const edge = 8, gap = 6;
      const left = viewport?.offsetLeft ?? 0;
      const top = viewport?.offsetTop ?? 0;
      const width = viewport?.width ?? document.documentElement.clientWidth;
      const height = viewport?.height ?? window.innerHeight;
      const panelWidth = Math.min(236, width - edge * 2);
      const below = top + height - anchorBounds.bottom - gap - edge;
      const above = anchorBounds.top - top - gap - edge;
      const placeAbove = below < Math.min(190, panel.scrollHeight) && above > below;
      panel.style.left = `${Math.max(left + edge, Math.min(anchorBounds.right - panelWidth, left + width - panelWidth - edge))}px`;
      panel.style.width = `${panelWidth}px`;
      panel.style.maxHeight = `${Math.max(44, placeAbove ? above : below)}px`;
      panel.style.top = `${placeAbove ? anchorBounds.top - gap - panel.offsetHeight : anchorBounds.bottom + gap}px`;
    };
    const schedule = event => {
      if (frame || (event?.target instanceof Node && panel.contains(event.target))) return;
      frame = requestAnimationFrame(() => { frame = 0; position(); });
    };
    const outside = event => {
      if (!anchor.contains(event.target) && !panel.contains(event.target)) onDismiss();
    };
    const escape = event => {
      if (event.key !== 'Escape') return;
      event.preventDefault();
      onDismiss();
      anchor.focus({ preventScroll: true });
    };
    position();
    if (keyboard) panel.querySelector('button:not([disabled])')?.focus({ preventScroll: true });
    document.addEventListener('pointerdown', outside, true);
    document.addEventListener('keydown', escape);
    window.addEventListener('resize', schedule);
    window.addEventListener('scroll', schedule, true);
    viewport?.addEventListener('resize', schedule);
    viewport?.addEventListener('scroll', schedule);
    return () => {
      cancelAnimationFrame(frame);
      document.removeEventListener('pointerdown', outside, true);
      document.removeEventListener('keydown', escape);
      window.removeEventListener('resize', schedule);
      window.removeEventListener('scroll', schedule, true);
      viewport?.removeEventListener('resize', schedule);
      viewport?.removeEventListener('scroll', schedule);
    };
  }, [anchorRef, keyboard, onDismiss]);

  return createPortal(
    <div ref={panelRef} className="conversation-actions-panel" id={id} role="group" aria-label={label}
      onClick={event => event.stopPropagation()} onTouchStart={event => event.stopPropagation()}
      onTouchEnd={event => event.stopPropagation()}>
      {children}
    </div>, document.body,
  );
}

export function ConversationReportDialog({ name, onClose, onReport }) {
  const panel = useRef(null);
  const id = useId();
  const pending = useRef(false);
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  useEffect(() => {
    const dialog = panel.current;
    dialog.showModal();
    return () => dialog.close();
  }, []);

  const submit = async event => {
    event.preventDefault();
    if (!reason.trim() || pending.current) return;
    pending.current = true;
    setBusy(true);
    setError('');
    try {
      await onReport(reason.trim());
      onClose();
    } catch {
      pending.current = false;
      setBusy(false);
      setError('Couldn’t send the report. Please try again.');
    }
  };

  return <dialog ref={panel} className="conversation-report-dialog" aria-labelledby={id} onCancel={event => {
    event.preventDefault();
    if (!pending.current) onClose();
  }}>
    <form onSubmit={submit}>
      <h2 id={id}>Report {name}</h2>
      <p>Tell Smarty’s moderation team what happened.</p>
      <label htmlFor={id + '-reason'}>Reason</label>
      <textarea id={id + '-reason'} rows={4} maxLength={500} value={reason} onChange={event => setReason(event.target.value)} disabled={busy} required />
      {error && <p className="conversation-report-error" role="alert">{error}</p>}
      <footer className="action-confirm-buttons">
        <button type="button" disabled={busy} onClick={onClose}>Cancel</button>
        <button type="submit" className="is-primary" disabled={busy || !reason.trim()}>{busy ? 'Sending…' : 'Send report'}</button>
      </footer>
    </form>
  </dialog>;
}
