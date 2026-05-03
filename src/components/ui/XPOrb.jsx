import { useEffect, useState } from "react";
import "./XPOrb.css";

export default function XPOrb({ xp }) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (xp > 0) {
      setVisible(true);
      setTimeout(() => setVisible(false), 1800);
    }
  }, [xp]);

  if (!visible) return null;

  return (
    <div className="xp-orb">
      +{xp} XP
    </div>
  );
}