import { useCallback, useEffect, useMemo, useRef } from 'react';

export default function useSoundFeedback({ enabled = true } = {}) {
  const contextRef = useRef(null);
  const mountedRef = useRef(true);
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      const context = contextRef.current;
      contextRef.current = null;
      try { context?.close().catch(() => {}); } catch { /* Audio is optional. */ }
    };
  }, []);

  const playTone = useCallback((frequency, duration = 120) => {
    if (!enabled || !mountedRef.current) return;
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (!AudioContext) return;

    try {
      const ctx = contextRef.current || (contextRef.current = new AudioContext());
      const play = () => {
        if (!mountedRef.current || ctx.state === 'closed') return;
        try {
          const oscillator = ctx.createOscillator(), gain = ctx.createGain();
          oscillator.frequency.value = frequency;
          oscillator.type = 'sine';
          oscillator.connect(gain); gain.connect(ctx.destination);
          gain.gain.setValueAtTime(0.04, ctx.currentTime);
          gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration / 1000);
          oscillator.onended = () => { oscillator.disconnect(); gain.disconnect(); };
          oscillator.start(); oscillator.stop(ctx.currentTime + duration / 1000);
        } catch { /* Playback failure must never prevent an answer from counting. */ }
      };
      if (ctx.state === 'suspended') ctx.resume().then(play).catch(() => {});
      else play();
    } catch { /* Some embedded browsers disallow audio contexts. */ }
  }, [enabled]);

  return useMemo(() => ({
    correct: () => playTone(740, 120),
    wrong: () => playTone(180, 180),
    levelUp: () => playTone(980, 260),
    click: () => playTone(420, 80),
  }), [playTone]);
}
