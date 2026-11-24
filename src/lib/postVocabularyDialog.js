const FOCUSABLE = 'button:not(:disabled),a[href],input:not(:disabled),select:not(:disabled),textarea:not(:disabled),[tabindex="0"]';

export function vocabularyPanelPosition(anchor, view = window) {
  const visual = view.visualViewport;
  const viewport = visual && visual.width > 0 && visual.height > 0
    ? { left: visual.offsetLeft || 0, top: visual.offsetTop || 0, width: visual.width, height: visual.height }
    : { left: 0, top: 0, width: view.innerWidth, height: view.innerHeight };
  const margin = 16;
  const width = Math.max(0, Math.min(340, viewport.width - margin * 2));
  const top = Math.max(viewport.top + margin, Math.min(anchor.bottom + 10, viewport.top + viewport.height - 230));
  const left = Math.max(viewport.left + margin, Math.min(anchor.left, viewport.left + viewport.width - width - margin));
  return { width, left, top, maxHeight: Math.max(0, viewport.top + viewport.height - top - margin) };
}

// The dialog lives outside the app shell so its own controls remain usable while
// the underlying navigation and nested page scroller are inert.
export function manageVocabularyDialog({ panel, trigger, onClose, doc = document, view = window }) {
  if (!panel) return () => {};
  const shell = doc.querySelector('.app-shell');
  const scroller = shell?.querySelector('.content');
  const previous = { inert: shell?.inert, overflow: doc.body.style.overflow, scrollOverflow: scroller?.style.overflowY };
  if (shell) shell.inert = true;
  doc.body.style.overflow = 'hidden';
  if (scroller) scroller.style.overflowY = 'hidden';
  panel.focus({ preventScroll: true });

  const handleKeys = event => {
    if (event.key === 'Escape') {
      event.preventDefault(); event.stopImmediatePropagation(); onClose();
    } else if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
      event.preventDefault(); event.stopImmediatePropagation();
    } else if (event.key === 'Tab') {
      const controls = [...panel.querySelectorAll(FOCUSABLE)].filter(item => item.getClientRects().length);
      const first = controls[0], last = controls.at(-1);
      if (!first) { event.preventDefault(); panel.focus({ preventScroll: true }); }
      else if (event.shiftKey && (doc.activeElement === first || !panel.contains(doc.activeElement) || doc.activeElement === panel)) {
        event.preventDefault(); last.focus({ preventScroll: true });
      } else if (!event.shiftKey && (doc.activeElement === last || !panel.contains(doc.activeElement) || doc.activeElement === panel)) {
        event.preventDefault(); first.focus({ preventScroll: true });
      }
    }
  };
  const containFocus = event => { if (!panel.contains(event.target)) panel.focus({ preventScroll: true }); };
  const closeOutsideScroll = event => { if (!panel.contains(event.target)) onClose(); };
  const closeViewportChange = () => onClose();
  const preventOutsideTouchScroll = event => {
    if (event.touches?.length > 1) return;
    if (!panel.contains(event.target) && event.cancelable) event.preventDefault();
  };
  view.addEventListener('keydown', handleKeys, true);
  view.addEventListener('resize', closeViewportChange);
  view.visualViewport?.addEventListener('resize', closeViewportChange);
  view.visualViewport?.addEventListener('scroll', closeViewportChange);
  doc.addEventListener('focusin', containFocus, true);
  doc.addEventListener('scroll', closeOutsideScroll, true);
  doc.addEventListener('touchmove', preventOutsideTouchScroll, { passive: false });
  return () => {
    view.removeEventListener('keydown', handleKeys, true);
    view.removeEventListener('resize', closeViewportChange);
    view.visualViewport?.removeEventListener('resize', closeViewportChange);
    view.visualViewport?.removeEventListener('scroll', closeViewportChange);
    doc.removeEventListener('focusin', containFocus, true);
    doc.removeEventListener('scroll', closeOutsideScroll, true);
    doc.removeEventListener('touchmove', preventOutsideTouchScroll);
    if (shell) shell.inert = previous.inert;
    doc.body.style.overflow = previous.overflow;
    if (scroller) scroller.style.overflowY = previous.scrollOverflow;
    if (trigger?.isConnected && trigger.getClientRects().length) trigger.focus({ preventScroll: true });
  };
}
