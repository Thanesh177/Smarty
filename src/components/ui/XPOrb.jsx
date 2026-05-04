import { useEffect, useMemo, useRef, useState } from "react";
import "./XPOrb.css";

export default function XPOrb({ xp, combo = 1 }) {
  const [visible, setVisible] = useState(false);
  const audioRef = useRef(null);

  const particles = useMemo(
    () =>
      Array.from({ length: 14 }, (_, i) => ({
        id: i,
        x: Math.round(Math.cos((i / 14) * Math.PI * 2) * (55 + (i % 4) * 10)),
        y: Math.round(Math.sin((i / 14) * Math.PI * 2) * (55 + (i % 3) * 12)),
      })),
    []
  );

  useEffect(() => {
    if (xp <= 0) return;

    setVisible(true);

    try {
      const audio = audioRef.current;
      if (audio) {
        audio.currentTime = 0;
        audio.volume = 0.35;
        audio.play().catch(() => {});
      }
    } catch {}

    const timer = setTimeout(() => setVisible(false), 1900);
    return () => clearTimeout(timer);
  }, [xp]);

  if (!visible) return null;

  return (
    <div className="xp-burst-layer">
      <audio ref={audioRef} src="/sounds/xp-gain.mp3" preload="auto" />

      <div className="xp-particles">
        {particles.map((p) => (
          <span
            key={p.id}
            className="xp-particle"
            style={{
              "--x": `${p.x}px`,
              "--y": `${p.y}px`,
              "--d": `${p.id * 0.025}s`,
            }}
          />
        ))}
      </div>

      <div className="xp-orb">
        <span>+{xp} XP</span>
        {combo > 1 && <strong>COMBO ×{combo}</strong>}
      </div>

      <div className="xp-fly-dot" />
    </div>
  );
}