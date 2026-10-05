import { useEffect, useId, useRef } from 'react';
import { createPortal } from 'react-dom';
import { LoaderCircle, Trash2, X } from 'lucide-react';
import './ProfileEditor.css';
import './DeleteAccountDialog.css';

export default function DeleteAccountDialog({ email, name, confirmation, onConfirmationChange, busy, error, onClose, onDelete }) {
  const panelRef = useRef(null);
  const cancelRef = useRef(null);
  const stateRef = useRef({ busy, onClose });
  stateRef.current = { busy, onClose };
  const id = useId();
  const ready = confirmation.trim() === 'DELETE';
  useEffect(() => {
    const previousFocus = document.activeElement;
    const previousOverflow = document.body.style.overflow;
    const content = document.querySelector('.app-shell > .content');
    const previousContentOverflow = content?.style.overflowY;
    document.body.style.overflow = 'hidden';
    if (content) content.style.overflowY = 'hidden';
    cancelRef.current?.focus({ preventScroll: true });
    const keys = event => {
      if (event.key === 'Escape' && !stateRef.current.busy) { event.preventDefault(); stateRef.current.onClose(); }
      if (event.key !== 'Tab') return;
      const fields = [...(panelRef.current?.querySelectorAll('button:not(:disabled), input:not(:disabled)') || [])].filter(element => element.getClientRects().length);
      const first = fields[0], last = fields.at(-1);
      if (!first) { event.preventDefault(); return; }
      if (event.shiftKey && (document.activeElement === first || !panelRef.current.contains(document.activeElement))) {
        event.preventDefault(); last.focus();
      } else if (!event.shiftKey && (document.activeElement === last || !panelRef.current.contains(document.activeElement))) {
        event.preventDefault(); first.focus();
      }
    };
    document.addEventListener('keydown', keys);
    return () => {
      document.removeEventListener('keydown', keys);
      document.body.style.overflow = previousOverflow;
      if (content) content.style.overflowY = previousContentOverflow;
      previousFocus?.focus?.({ preventScroll: true });
    };
  }, []);
  return createPortal(<div className="profile-editor-layer account-delete-layer" onPointerDown={event => {
    if (event.target === event.currentTarget && !busy) onClose();
  }}>
    <form ref={panelRef} className="profile-editor-panel account-delete-panel" role="dialog" aria-modal="true"
      aria-labelledby={`${id}-title`} aria-describedby={`${id}-description`} aria-busy={busy}
      onSubmit={event => { event.preventDefault(); if (ready && !busy) onDelete(); }}>
      <header className="profile-editor-header"><div><span className="account-delete-icon"><Trash2 size={19} aria-hidden="true" /></span>
        <h2 id={`${id}-title`}>Delete account?</h2></div>
        <button type="button" className="profile-editor-close" onClick={onClose} disabled={busy} aria-label="Close delete account confirmation"><X size={19} /></button>
      </header>
      <div className="profile-editor-body">
        <div className="account-delete-identity"><strong>{name}</strong>{email && <span>{email}</span>}</div>
        <p id={`${id}-description`} className="account-delete-description">Your Smarty account and associated account data will be permanently deleted. This cannot be undone.</p>
        <div className="profile-editor-field"><label htmlFor={`${id}-confirmation`}>Type DELETE to confirm</label>
          <input id={`${id}-confirmation`} value={confirmation} onChange={event => onConfirmationChange(event.target.value)}
            maxLength={32} autoComplete="off" autoCorrect="off" autoCapitalize="characters" spellCheck={false}
            placeholder="DELETE" disabled={busy} aria-describedby={error ? `${id}-error` : undefined} />
        </div>
        {error && <p id={`${id}-error`} className="profile-editor-error" role="alert">{error}</p>}
        {busy && <p className="account-delete-progress" role="status"><LoaderCircle size={15} aria-hidden="true" />Deleting your account…</p>}
      </div>
      <footer className="profile-editor-footer"><button ref={cancelRef} type="button" onClick={onClose} disabled={busy}>Keep account</button>
        <button type="submit" className="account-delete-confirm" disabled={busy || !ready}>{busy ? 'Deleting…' : 'Delete account'}</button>
      </footer>
    </form>
  </div>, document.body);
}
