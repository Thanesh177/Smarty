import { useEffect, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { getFeedView } from '../lib/feedViews';
import { swipeDestination, swipeTargetAllowed } from '../lib/feedSwipe';

// One active route only: no duplicate feeds, video decoders, or API requests.
export default function FeedViewSwipe() {
  const location = useLocation(), navigate = useNavigate();
  const view = getFeedView(location);
  const suppressClickUntil = useRef(0);
  useEffect(() => {
    if (!view) return undefined;
    const content = document.querySelector('.app-shell > .content');
    const toggle = document.querySelector('.feed-view-switch');
    let gesture = null, frame = 0;
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const reset = (settle = false) => {
      cancelAnimationFrame(frame); frame = 0;
      if (gesture?.target) {
        const target = gesture.target;
        if (settle && target.animate && !reduced) target.animate([{ transform: target.style.transform }, { transform: 'translateX(0)' }], { duration: 180, easing: 'cubic-bezier(.2,.8,.2,1)' });
        target.style.removeProperty('transform'); target.style.removeProperty('will-change');
      }
      gesture = null;
    };
    const start = event => {
      reset();
      const touch = event.touches?.[0];
      if (!touch || event.touches.length !== 1 || !swipeTargetAllowed(event.target, content)) return;
      // Preserve native/back-edge gestures; App also owns the left edge.
      if (touch.clientX <= 45 || touch.clientX >= window.innerWidth - 24) return;
      gesture = { x: touch.clientX, y: touch.clientY, started: performance.now(), dx: 0, dy: 0, locked: false,
        target: content?.querySelector(':scope > main, :scope > section') };
    };
    const move = event => {
      if (!gesture) return;
      if (event.touches.length !== 1) { reset(true); return; }
      gesture.dx = event.touches[0].clientX - gesture.x; gesture.dy = event.touches[0].clientY - gesture.y;
      if (!gesture.locked) {
        if (Math.abs(gesture.dy) > 12 && Math.abs(gesture.dy) > Math.abs(gesture.dx)) { reset(); return; }
        if (Math.abs(gesture.dx) < 12 || Math.abs(gesture.dx) < Math.abs(gesture.dy) * 1.7) return;
        gesture.locked = true;
      }
      if (event.cancelable) event.preventDefault();
      if (reduced || !gesture.target || frame) return;
      frame = requestAnimationFrame(() => {
        frame = 0; if (!gesture) return;
        const distance = Math.max(-180, Math.min(180, gesture.dx * .65));
        gesture.target.style.willChange = 'transform'; gesture.target.style.transform = `translateX(${distance}px)`;
      });
    };
    const end = event => {
      if (!gesture) return;
      const touch = event.changedTouches?.[0];
      const destination = gesture.locked && swipeDestination(view, { dx: touch ? touch.clientX - gesture.x : gesture.dx,
        dy: touch ? touch.clientY - gesture.y : gesture.dy, elapsed: performance.now() - gesture.started, width: window.innerWidth });
      if (destination) {
        suppressClickUntil.current = performance.now() + 500;
        if (event.cancelable) event.preventDefault();
        reset(); navigate(destination.to);
      } else reset(true);
    };
    const cancel = () => reset(true);
    const click = event => { if (performance.now() < suppressClickUntil.current) { event.preventDefault(); event.stopPropagation(); } };
    const surfaces = [content, toggle].filter(Boolean);
    surfaces.forEach(element => {
      element.addEventListener('touchstart', start, { passive: true });
      element.addEventListener('touchmove', move, { passive: false });
      element.addEventListener('touchend', end, { passive: false });
      element.addEventListener('touchcancel', cancel);
    });
    // Kept briefly across route commits so a toggle swipe cannot also tap a tab.
    document.addEventListener('click', click, true);
    return () => {
      reset(); surfaces.forEach(element => {
        element.removeEventListener('touchstart', start); element.removeEventListener('touchmove', move);
        element.removeEventListener('touchend', end); element.removeEventListener('touchcancel', cancel);
      });
      document.removeEventListener('click', click, true);
    };
  }, [view, location.pathname, location.search, navigate]);
  return null;
}
