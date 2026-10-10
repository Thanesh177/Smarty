import { useLayoutEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { getFeedView, getFeedViewDirection } from '../lib/feedViews';

export default function PageTransition() {
  const { pathname, search } = useLocation();
  const previousRef = useRef('');
  const previousViewRef = useRef(null);
  const view = getFeedView({ pathname, search });
  // Only page/topic navigation animates. Search typing and chat selection stay instant.
  const pageKey = pathname + (pathname.startsWith('/feed') ? new URLSearchParams(search).get('topic') || '' : '');
  useLayoutEffect(() => {
    const previous = previousRef.current;
    const previousView = previousViewRef.current;
    previousRef.current = pageKey;
    previousViewRef.current = view;
    if (!previous || previous === pageKey) return undefined;
    const content = document.querySelector('.app-shell > .content');
    const direction = getFeedViewDirection(previousView, view);
    // A new mode should not inherit a long scroll from the previous page.
    if (direction) content?.scrollTo({ top: 0, behavior: 'instant' });
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return undefined;
    // Animate only the new view. The shared toggle and fixed navigation stay still.
    const target = direction ? content?.querySelector(':scope > main, :scope > section') : content;
    if (!target?.animate) return undefined;
    const animation = target.animate(direction ? [
      { opacity: 1, transform: `translateX(${direction * 72}px)` },
      { opacity: 1, transform: 'translateX(0)' },
    ] : [{ opacity: .72 }, { opacity: 1 }], {
      duration: direction ? 360 : 220, easing: 'cubic-bezier(.22,.8,.25,1)',
    });
    return () => animation.cancel();
  }, [pageKey, view]);
  return null;
}
