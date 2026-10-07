import { createContext, useCallback, useContext, useEffect, useId, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { createActionConfirmation } from '../lib/actionConfirmation';
import './AppResilience.css';

const ConfirmationContext = createContext(null);

function ConfirmationDialog({ decision, onDecision }) {
  const panelRef = useRef(null);
  const cancelRef = useRef(null);
  const id = useId();
  useEffect(() => {
    const focus = document.activeElement;
    const shell = document.querySelector('.app-shell');
    const wasInert = shell?.inert;
    const overflow = document.body.style.overflow;
    if (shell) shell.inert = true;
    document.body.style.overflow = 'hidden';
    cancelRef.current?.focus({ preventScroll: true });
    const handleKeys = event => {
      if (event.key === 'Escape') {
        event.preventDefault(); event.stopImmediatePropagation(); onDecision(false);
      } else if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault(); event.stopImmediatePropagation();
      } else if (event.key === 'Tab') {
        const buttons = [...panelRef.current.querySelectorAll('button')];
        const first = buttons[0], last = buttons.at(-1);
        if (event.shiftKey && (document.activeElement === first || !panelRef.current.contains(document.activeElement))) {
          event.preventDefault(); last.focus();
        } else if (!event.shiftKey && (document.activeElement === last || !panelRef.current.contains(document.activeElement))) {
          event.preventDefault(); first.focus();
        }
      }
    };
    window.addEventListener('keydown', handleKeys, true);
    return () => {
      window.removeEventListener('keydown', handleKeys, true);
      if (shell) shell.inert = wasInert;
      document.body.style.overflow = overflow;
      if (focus?.isConnected && focus.getClientRects().length) focus.focus({ preventScroll: true });
    };
  }, [onDecision]);
  return createPortal(
    <div className="action-confirm-layer" onPointerDown={event => {
      if (event.target === event.currentTarget) onDecision(false);
    }}>
      <section ref={panelRef} className="action-confirm-panel" role="alertdialog" aria-modal="true"
        aria-labelledby={`${id}-title`} aria-describedby={`${id}-description`}>
        <h2 id={`${id}-title`}>{decision.title}</h2>
        <p id={`${id}-description`}>{decision.description}</p>
        <div className="action-confirm-buttons">
          <button ref={cancelRef} type="button" onClick={() => onDecision(false)}>{decision.cancelLabel}</button>
          <button type="button" className={decision.danger ? 'is-destructive' : 'is-primary'} onClick={() => onDecision(true)}>{decision.confirmLabel}</button>
        </div>
      </section>
    </div>, document.body
  );
}

export function ActionConfirmationProvider({ children }) {
  const controllerRef = useRef(null);
  if (!controllerRef.current) controllerRef.current = createActionConfirmation();
  const controller = controllerRef.current;
  const [decision, setDecision] = useState(null);
  const location = useLocation();
  const { user } = useAuth();
  const account = user?.sub || user?.userId || user?.id || '';
  useEffect(() => {
    const unsubscribe = controller.subscribe(setDecision);
    return () => { unsubscribe(); controller.cancel(); };
  }, [controller]);
  useEffect(() => { controller.cancel(); }, [controller, location.key, location.pathname, location.search, account]);
  const confirm = useCallback(options => controller.request(options), [controller]);
  return <ConfirmationContext.Provider value={confirm}>
    {children}
    {decision && <ConfirmationDialog decision={decision} onDecision={controller.finish} />}
  </ConfirmationContext.Provider>;
}

export function useActionConfirmation() {
  const confirm = useContext(ConfirmationContext);
  if (!confirm) throw new Error('ActionConfirmationProvider is required');
  return confirm;
}
