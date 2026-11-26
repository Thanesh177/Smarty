import { useEffect, useId, useRef } from 'react';
import { createPortal } from 'react-dom';
import { LockKeyhole, X } from 'lucide-react';

export default function QuizPremiumDialog({ onClose }) {
  const dialogRef = useRef(null);
  const id = useId();
  useEffect(() => {
    const dialog = dialogRef.current;
    const previousFocus = document.activeElement;
    const previousOverflow = document.body.style.overflow;
    dialog.showModal();
    document.body.style.overflow = 'hidden';
    return () => {
      dialog.close();
      document.body.style.overflow = previousOverflow;
      if (previousFocus?.isConnected) previousFocus.focus({ preventScroll: true });
    };
  }, []);
  return createPortal(<dialog ref={dialogRef} className="quiz-premium-dialog" aria-labelledby={id+'-title'} aria-describedby={id+'-description'}
    onCancel={event=>{event.preventDefault();onClose();}} onClick={event=>{if(event.target===event.currentTarget)onClose();}}>
    <section>
      <button type="button" className="quiz-premium-close" onClick={onClose} aria-label="Close premium information"><X size={18} aria-hidden="true" /></button>
      <LockKeyhole size={21} aria-hidden="true" />
      <h2 id={id+'-title'}>Go further with Premium</h2>
      <p id={id+'-description'}>Hard and Challenge quizzes are reserved for Smarty Premium, with deeper reasoning and more demanding questions.</p>
      <p>Premium subscriptions aren’t available yet. Easy and Medium quizzes remain free.</p>
      <button type="button" className="quiz-premium-continue" onClick={onClose}>Continue free practice</button>
    </section>
  </dialog>,document.body);
}
