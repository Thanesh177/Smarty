import { useRef, useState } from 'react';
import { Copy, Mail, Share2, Star, ChevronDown } from 'lucide-react';
import { APP_LINK, PLAY_REVIEW_LINK, SHARE_INVITATIONS, shareApp, shareEmail, shareText } from '../lib/appSharing';
import { recordRatingAction } from '../lib/appEngagement';
import { getProgressUserId } from '../lib/progressStore';
import './AppEngagement.css';

export default function AppSettingsEngagement({ user, onNavigate }) {
  const [invitation, setInvitation] = useState('curiosity');
  const [status, setStatus] = useState('');
  const [busy, setBusy] = useState(false);
  const pending = useRef(false);
  const supportsShare = typeof navigator !== 'undefined' && typeof navigator.share === 'function';
  const run = async action => {
    if (pending.current) return;
    pending.current = true; setBusy(true); setStatus('');
    try {
      if (action === 'copy') {
        if (!navigator.clipboard?.writeText) { setStatus('Copy the link below, or choose Email.'); return; }
        await navigator.clipboard.writeText(shareText(invitation));
        setStatus('Invitation copied.');
      } else {
        const result = await shareApp(invitation);
        if (result === 'shared') setStatus('Share options closed.');
        else if (result === 'unsupported') setStatus('Choose Copy invitation or Email below.');
      }
    } catch { setStatus('Sharing couldn’t open. You can copy the link below or use Email.'); }
    finally { pending.current = false; setBusy(false); }
  };
  return <section className="settings-engagement" aria-label="Share and review Smarty">
    <a className="settings-action-row" href={PLAY_REVIEW_LINK} target="_blank" rel="noopener noreferrer"
      onClick={() => { recordRatingAction(getProgressUserId(user), 'store'); onNavigate?.(); }}>
      <Star size={18} aria-hidden="true" /><span>Rate your app<small>Leave an honest review on Google Play</small></span>
    </a>
    <details className="settings-share">
      <summary className="settings-action-row"><Share2 size={18} aria-hidden="true" /><span>Share app<small>Send a little curiosity to someone</small></span><ChevronDown size={15} aria-hidden="true" /></summary>
      <div className="settings-share-body">
        <label htmlFor="smarty-share-invitation">Choose an invitation</label>
        <select id="smarty-share-invitation" value={invitation} disabled={busy} onChange={event => { setInvitation(event.target.value); setStatus(''); }}>
          {SHARE_INVITATIONS.map(item => <option key={item.id} value={item.id}>{item.label}</option>)}
        </select>
        <p className="settings-share-preview">{SHARE_INVITATIONS.find(item => item.id === invitation)?.text}</p>
        <label className="settings-share-link">App link<input readOnly value={APP_LINK} onFocus={event => event.target.select()} /></label>
        <div className="settings-share-actions">
          {supportsShare && <button type="button" disabled={busy} onClick={() => run('share')}><Share2 size={15} aria-hidden="true" />Share invitation</button>}
          <button type="button" disabled={busy} onClick={() => run('copy')}><Copy size={15} aria-hidden="true" />Copy invitation</button>
          <a href={shareEmail(invitation)}><Mail size={15} aria-hidden="true" />Email</a>
        </div>
        <p className="settings-action-status" role="status">{status}</p>
      </div>
    </details>
  </section>;
}
