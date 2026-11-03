import { useEffect, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { Star, X } from 'lucide-react';
import { getProgressUserId } from '../lib/progressStore';
import { getUserScope } from '../lib/userScopedStorage';
import { PLAY_REVIEW_LINK } from '../lib/appSharing';
import { canOfferRating, ENGAGEMENT_EVENT, initializeEngagement, readEngagement, recordRatingAction } from '../lib/appEngagement';
import './AppEngagement.css';

export default function EngagementNudge({ user }) {
  const account = getProgressUserId(user);
  return <ScopedNudge key={account} account={account} />;
}
function ScopedNudge({ account }) {
  const location = useLocation();
  const [pending, setPending] = useState(0), [open, setOpen] = useState(false);
  const timer = useRef(null);
  useEffect(() => {
    initializeEngagement(account);
    const receive = event => {
      if (getUserScope(event.detail?.userId) !== getUserScope(account)) return;
      setPending(count => count + 1);
    };
    window.addEventListener(ENGAGEMENT_EVENT, receive);
    return () => window.removeEventListener(ENGAGEMENT_EVENT, receive);
  }, [account]);
  useEffect(() => {
    setOpen(false);
    const android = /Android/i.test(navigator.userAgent) || window.__SMARTY_PLATFORM__ === 'android';
    const safePage = ['/learn', '/progress'].includes(location.pathname) ||
      (location.pathname === '/feed' && new URLSearchParams(location.search).get('topic') === 'All');
    if (!pending || !android || !safePage || !canOfferRating(readEngagement(account))) return;
    timer.current = window.setTimeout(() => {
      if (document.visibilityState === 'hidden' || document.querySelector('[aria-modal="true"]') ||
          document.activeElement?.matches('input,textarea,select,[contenteditable="true"]')) return;
      if (recordRatingAction(account, 'shown')) setOpen(true);
    }, 8000);
    return () => window.clearTimeout(timer.current);
  }, [account, location.pathname, location.search, pending]);
  const dismiss = action => { recordRatingAction(account, action); setOpen(false); setPending(0); };
  if (!open) return null;
  return <aside className="rating-nudge" aria-label="Rate Smarty">
    <button className="rating-nudge-close" type="button" aria-label="Dismiss rating prompt" onClick={() => dismiss('later')}><X size={17} aria-hidden="true" /></button>
    <Star size={20} aria-hidden="true" /><h2>Rate Smarty</h2>
    <p>Share an honest review on Google Play. It helps others decide whether Smarty is for them.</p>
    <div className="rating-nudge-actions"><a href={PLAY_REVIEW_LINK} target="_blank" rel="noopener noreferrer" onClick={() => dismiss('store')}>Rate app</a><button type="button" onClick={() => dismiss('later')}>Not now</button></div>
    <button className="rating-nudge-never" type="button" onClick={() => dismiss('never')}>Don’t ask again</button>
  </aside>;
}
