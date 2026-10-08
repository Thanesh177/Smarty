import { useEffect, useRef } from "react";
import "./ReminderPopup.css";

export default function ReminderPopup({ title, body, visible = true, onClose, onClick }) {
  const close = useRef(onClose);
  close.current = onClose;
  useEffect(() => {
    if (!visible) return;
    const timer = setTimeout(() => close.current?.(), 6000);
    return () => clearTimeout(timer);
  }, [visible, title, body]);

  return (
    <button type="button" className={`reminder-popup ${visible ? "show" : ""}`} onClick={onClick}
      disabled={!visible} tabIndex={visible ? 0 : -1} aria-hidden={!visible} aria-live="polite">
      <div className="reminder-popup-card">
        <strong>{title}</strong>
        <p>{body}</p>
      </div>
    </button>
  );
}
