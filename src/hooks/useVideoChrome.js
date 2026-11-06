import { useCallback, useEffect, useRef, useState } from 'react';
import { VIDEO_CONTROLS_IDLE_MS } from '../lib/reelPlayback';

export default function useVideoChrome(pageRef, activeId, playing) {
  const [idle, setIdle] = useState(false);
  const timer = useRef(0);
  const clear = useCallback(() => window.clearTimeout(timer.current), []);
  const arm = useCallback(() => {
    clear();
    if (!playing) return;
    timer.current = window.setTimeout(() => {
      const page = pageRef.current;
      // Keep navigation accessible while someone is using the keyboard,
      // reading the caption, or interacting with a picker.
      if (page?.querySelector(':focus-visible, [aria-expanded="true"], .reel-video.is-active details[open]')) {
        arm();
      } else {
        setIdle(true);
      }
    }, VIDEO_CONTROLS_IDLE_MS);
  }, [clear, pageRef, playing]);

  const reveal = useCallback(() => {
    setIdle(false);
    arm();
  }, [arm]);

  useEffect(() => {
    reveal();
    return clear;
  }, [activeId, reveal, clear]);

  return { idle: idle && playing, reveal };
}
