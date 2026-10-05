import { useEffect, useId, useRef } from 'react';
import { createPortal } from 'react-dom';
import { Camera, RotateCcw, X } from 'lucide-react';
import './ProfileEditor.css';

export default function ProfileEditor({ name, onNameChange, photo, preview, currentPhoto, initials, email,
  onPhotoSelect, onPhotoReset, zoom, x, y, onZoomChange, onCropReset, onDragStart, onDragMove, onDragEnd,
  saving, error, onSave, onClose }) {
  const panelRef = useRef(null);
  const nameRef = useRef(null);
  const savingRef = useRef(saving);
  const closeRef = useRef(onClose);
  savingRef.current = saving;
  closeRef.current = onClose;
  const fieldId = useId();
  const changedPhoto = Boolean(photo && preview);

  useEffect(() => {
    const previousFocus = document.activeElement;
    const previousOverflow = document.body.style.overflow;
    const content = document.querySelector('.app-shell > .content');
    const previousContentOverflow = content?.style.overflowY;
    document.body.style.overflow = 'hidden';
    if (content) content.style.overflowY = 'hidden';
    nameRef.current?.focus({ preventScroll: true });
    const keys = event => {
      if (event.key === 'Escape' && !savingRef.current) { event.preventDefault(); closeRef.current(); }
      if (event.key !== 'Tab') return;
      const fields = [...(panelRef.current?.querySelectorAll('button:not(:disabled), input:not(:disabled), [tabindex="0"]') || [])]
        .filter(element => element.getClientRects().length);
      const first = fields[0], last = fields.at(-1);
      if (!first) return;
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

  return createPortal(<div className="profile-editor-layer" onPointerDown={event => {
    if (event.target === event.currentTarget && !saving) onClose();
  }}>
    <form className="profile-editor-panel" ref={panelRef} role="dialog" aria-modal="true"
      aria-labelledby={`${fieldId}-title`} aria-busy={saving}
      onSubmit={event => { event.preventDefault(); onSave(); }}>
      <header className="profile-editor-header"><div><h2 id={`${fieldId}-title`}>Edit profile</h2><p>Make this space yours.</p></div>
        <button type="button" className="profile-editor-close" onClick={onClose} disabled={saving} aria-label="Close edit profile"><X size={19} /></button>
      </header>
      <div className="profile-editor-body">
        <div className="profile-editor-photo-section">
          <div className={`profile-editor-avatar${changedPhoto ? ' is-cropping' : ''}`}
            onPointerDown={changedPhoto && !saving ? onDragStart : undefined} onPointerMove={changedPhoto && !saving ? onDragMove : undefined}
            onPointerUp={onDragEnd} onPointerCancel={onDragEnd}>
            {preview || currentPhoto ? <img src={preview || currentPhoto} alt="Profile photo preview" draggable="false"
              style={changedPhoto ? { transform: `scale(${zoom})`, objectPosition: `${x}% ${y}%`, transformOrigin: `${x}% ${y}%` } : undefined} /> : <span>{initials}</span>}
          </div>
          <div className="profile-editor-photo-actions">
            <label className="profile-editor-upload"><Camera size={16} aria-hidden="true" /><span>Change photo</span>
              <input type="file" aria-label="Change profile photo" accept="image/jpeg,image/png,image/webp" disabled={saving}
                onChange={event => { onPhotoSelect(event.target.files?.[0]); event.target.value = ''; }} />
            </label>
            <small>JPG, PNG, WebP · 6 MB max</small>
            {changedPhoto && <button type="button" className="profile-editor-text-button" onClick={onPhotoReset} disabled={saving}>Use current photo</button>}
          </div>
        </div>
        {changedPhoto && <div className="profile-editor-crop-controls">
          <label htmlFor={`${fieldId}-zoom`}>Zoom <span>Drag the photo to reposition</span></label>
          <input id={`${fieldId}-zoom`} type="range" min="1" max="2.4" step="0.05" value={zoom} disabled={saving} onChange={event => onZoomChange(Number(event.target.value))} />
          <button type="button" className="profile-editor-text-button" onClick={onCropReset} disabled={saving}><RotateCcw size={13} />Reset position</button>
        </div>}
        <div className="profile-editor-field"><label htmlFor={`${fieldId}-name`}>Display name <span>{name.length}/40</span></label>
          <input id={`${fieldId}-name`} ref={nameRef} value={name} onChange={event => onNameChange(event.target.value)}
            maxLength={40} autoComplete="nickname" placeholder="Your name" disabled={saving} required
            aria-invalid={Boolean(error)} aria-describedby={`${fieldId}-hint${error ? ` ${fieldId}-error` : ''}`} />
          <p id={`${fieldId}-hint`}>Shown on your posts and in conversations.</p>
        </div>
        {email && <div className="profile-editor-account"><span>Account email</span><strong>{email}</strong></div>}
        {error && <p className="profile-editor-error" id={`${fieldId}-error`} role="alert">{error}</p>}
      </div>
      <footer className="profile-editor-footer"><button type="button" onClick={onClose} disabled={saving}>Cancel</button>
        <button type="submit" className="profile-editor-save" disabled={saving || !name.trim()}>{saving ? 'Saving…' : 'Save changes'}</button>
      </footer>
    </form>
  </div>, document.body);
}
