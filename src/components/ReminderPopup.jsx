import { useEffect, useState } from "react";
import "./ReminderPopup.css";

export default function ReminderPopup({ title, body, onClose, onClick }) {
  const [show, setShow] = useState(false);

  useEffect(() => {
    const enterTimer = setTimeout(() => setShow(true), 20);

    const hideTimer = setTimeout(() => {
      setShow(false);
      setTimeout(() => {
        onClose?.();
      }, 300);
    }, 4000);

    return () => {
      clearTimeout(enterTimer);
      clearTimeout(hideTimer);
    };
  }, [onClose]);

  return (
    <div className={`reminder-popup ${show ? "show" : ""}`} onClick={onClick}>
      <div className="reminder-popup-card">
        <strong>{title}</strong>
        <p>{body}</p>
      </div>
    </div>
  );
}