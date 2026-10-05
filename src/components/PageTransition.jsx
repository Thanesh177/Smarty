import { useLayoutEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';

export default function PageTransition() {
  const { pathname, search } = useLocation();
  const previousRef = useRef('');
  // Only page/topic navigation animates. Search typing and chat selection stay instant.
  const pageKey = pathname + (pathname.startsWith('/feed') ? new URLSearchParams(search).get('topic') || '' : '');
  useLayoutEffect(() => {
    const previous = previousRef.current;
    previousRef.current = pageKey;
    if (!previous || previous === pageKey || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return undefined;
    const content = document.querySelector('.app-shell > .content');
    if (!content?.animate) return undefined;
    const animation = content.animate([{ opacity: .72 }, { opacity: 1 }], {
      duration: 220, easing: 'cubic-bezier(.2,.7,.2,1)',
    });
    return () => animation.cancel();
  }, [pageKey]);
  return null;
}
