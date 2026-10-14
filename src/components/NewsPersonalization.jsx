import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Bell, BellOff, Globe2, MapPin, X } from 'lucide-react';
import useNewsPersonalization from '../hooks/useNewsPersonalization';
import { NEWS_COUNTRIES, NEWS_REGIONS, getDefaultNewsCountry } from '../data/newsLocations';
import { cleanStoryQuery, storyQuery } from '../lib/newsStories';
import './NewsPersonalization.css';

export function NewsBriefingChoice({ personal, activePlace, onChange }) {
  const { preferences, savePreference, syncWarning } = personal;
  const [editing, setEditing] = useState(false), [country, setCountry] = useState(preferences?.country || getDefaultNewsCountry());
  const [region, setRegion] = useState(preferences?.region || ''), [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const actionRef = useRef(null), mountedRef = useRef(true);
  useEffect(() => {
    mountedRef.current = true;
    actionRef.current = null; setSaving(false); setError('');
    return () => { mountedRef.current = false; actionRef.current = null; };
  }, [personal.account]);
  useEffect(() => { setCountry(preferences?.country || (activePlace?.country !== 'GLOBAL' && activePlace?.country) || getDefaultNewsCountry()); setRegion(preferences?.region || activePlace?.region || ''); }, [preferences?.country, preferences?.region, activePlace?.country, activePlace?.region]);
  const apply = async mode => {
    if (actionRef.current) return;
    const action = {};
    actionRef.current = action;
    setSaving(true); setError('');
    try {
      await savePreference({ chosen: true, country, region, mode });
      if (!mountedRef.current || actionRef.current !== action) return;
      onChange?.({ country: mode === 'world' ? 'GLOBAL' : country, region: mode === 'world' ? '' : region });
      setEditing(false);
    } catch { if (mountedRef.current) setError('Could not save this place. Please try again.'); }
    finally { if (actionRef.current === action) { actionRef.current = null; if (mountedRef.current) setSaving(false); } }
  };
  const localCountry = activePlace?.country !== 'GLOBAL' && activePlace?.country || preferences?.country;
  const label = (activePlace?.country !== 'GLOBAL' ? activePlace?.region : '') || preferences?.region || NEWS_COUNTRIES.find(item => item.code === localCountry)?.name || 'Your place';
  const hasLocal = localCountry && localCountry !== 'GLOBAL';
  const mode = activePlace ? activePlace.country === 'GLOBAL' ? 'world' : 'local' : preferences?.mode || 'world';
  return <section className="news-place-choice" aria-label="Daily briefing location">
    {!editing ? <div className="news-place-switch">
      <div role="group" aria-label="Briefing edition"><button type="button" aria-pressed={mode === 'world'} disabled={saving} onClick={() => apply('world')}><Globe2 size={15}/>World</button>
        {hasLocal && <button type="button" aria-pressed={mode === 'local'} disabled={saving} onClick={() => apply('local')}><MapPin size={15}/>{label}</button>}</div>
      <button type="button" disabled={saving} onClick={() => setEditing(true)}><MapPin size={14}/>{preferences || hasLocal ? 'Change place' : 'Choose place'}</button>
    </div> : <form onSubmit={event => { event.preventDefault(); void apply('local'); }}>
      <header><div><h2>Your briefing, your place.</h2><p>Choose a country and region. Switch back to World anytime.</p></div>
        <button type="button" aria-label="Close location settings" disabled={saving} onClick={() => setEditing(false)}><X size={18}/></button></header>
      <div className="news-place-fields"><label>Country<select aria-label="Briefing country" value={country} disabled={saving} onChange={event => { setCountry(event.target.value); setRegion(''); }}>
        {NEWS_COUNTRIES.map(item => <option value={item.code} key={item.code}>{item.name}</option>)}</select></label>
        <label>State or region<select aria-label="Briefing state or region" value={region} disabled={saving || !NEWS_REGIONS[country]?.length} onChange={event => setRegion(event.target.value)}>
          <option value="">Countrywide</option>{(NEWS_REGIONS[country] || []).map(item => <option key={item}>{item}</option>)}</select></label></div>
      <footer><button type="submit" disabled={saving}>{saving ? 'Saving…' : country === 'GLOBAL' ? 'Use world briefing' : 'Use my place'}</button><button type="button" disabled={saving} onClick={() => apply('world')}>Keep world briefing</button></footer>
    </form>}
    {syncWarning && <p role="status" className="news-personal-note">{syncWarning}</p>}
    {error && <p role="alert" className="news-personal-note">{error}</p>}
  </section>;
}

export function NewsFollowButton({ story, query: supplied }) {
  const navigate = useNavigate(), personal = useNewsPersonalization();
  const [status, setStatus] = useState(''), [busy, setBusy] = useState(false);
  const actionRef = useRef(null), mountedRef = useRef(true);
  const query = cleanStoryQuery(supplied || storyQuery(story));
  const followed = personal.stories.find(item => item.query.toLowerCase() === query.toLowerCase());
  useEffect(() => {
    mountedRef.current = true;
    actionRef.current = null; setBusy(false); setStatus('');
    return () => { mountedRef.current = false; actionRef.current = null; };
  }, [query, personal.account]);
  if (query.length < 3) return null;
  const toggle = async () => {
    if (actionRef.current) return;
    if (!personal.account) { navigate('/login', { state: { from: { pathname: '/news/story', search: '?q=' + encodeURIComponent(query) } } }); return; }
    setBusy(true); setStatus('');
    const action = {};
    actionRef.current = action;
    try {
      if (!personal.ready) {
        const result = await personal.refresh();
        if (result.error) throw result.error;
        // A retry loads the real followed state first; it never toggles blindly.
        if (mountedRef.current && actionRef.current === action) setStatus('Updates reconnected. Choose follow or unfollow below.');
      } else {
        await personal.updateStory({ query, follow: !followed });
        if (mountedRef.current && actionRef.current === action) setStatus(followed ? 'Updates turned off.' : 'Subject followed. Open its timeline anytime to check the latest coverage.');
      }
    }
    catch { if (mountedRef.current && actionRef.current === action) setStatus('Story alerts could not be saved. Please try again after the news service reconnects.'); }
    finally { if (actionRef.current === action) { actionRef.current = null; if (mountedRef.current) setBusy(false); } }
  };
  const waiting = Boolean(personal.account && !personal.ready && !personal.error);
  return <div className="news-follow-control"><button type="button" disabled={busy || personal.pending || waiting} aria-pressed={Boolean(followed)} onClick={toggle}>
    {followed ? <BellOff size={15}/> : <Bell size={15}/>} {busy ? 'Saving…' : waiting ? 'Checking updates…' : personal.error && !personal.ready ? 'Retry updates' : followed ? 'Following updates' : 'Follow updates'}</button>
    {status && <p role="status">{status}</p>}</div>;
}

export function NewsUpdatesShelf({ personal }) {
  const [status, setStatus] = useState('');
  const unread = personal.updates.filter(item => !item.readAt);
  if (!personal.stories.length && !personal.updates.length) return null;
  return <details className="news-updates-shelf">
    <summary><Bell size={16}/>Your story updates <span>{unread.length ? `${unread.length} new` : `${personal.stories.length} followed`}</span></summary>
    <p>Related reporting matched to the subjects you follow. Updates are not live and may be delayed.</p>
    <ul>{personal.updates.slice(0,20).map(item => <li key={item.id}>
      <Link to={'/news/story?q=' + encodeURIComponent(item.query) + '&year=recent&order=newest'} onClick={() => {
        if (!item.readAt) personal.updateStory({ read: item.id }).catch(() => setStatus('Could not mark this update as read.'));
      }}><strong>{item.query}</strong><span>{item.body}</span><small>{item.readAt ? 'Opened' : 'New report'}</small></Link>
    </li>)}</ul>
    <div className="news-followed-list">{personal.stories.map(item => <div key={item.id}><Link to={'/news/story?q=' + encodeURIComponent(item.query)}>{item.query}</Link>
      <button type="button" disabled={personal.pending} aria-label={'Unfollow ' + item.query} onClick={() => personal.updateStory({ query: item.query, follow: false }).catch(() => setStatus('Could not turn off updates. Try again.'))}><X size={16}/></button></div>)}</div>
    {status && <p role="status">{status}</p>}
  </details>;
}

// One poller for the signed-in app, never one timer per card. Delivery obeys the
// app's notification policy; unread updates remain available in the newsroom.
export function NewsUpdateNotifier() {
  const personal = useNewsPersonalization({ poll: true }), account = personal.account;
  const seen = useRef({ account: '', ids: new Set() });
  useEffect(() => {
    if (!account) { seen.current = { account: '', ids: new Set() }; return; }
    if (seen.current.account !== account) {
      let ids = []; try { ids = JSON.parse(localStorage.getItem('smarty-news-alerts-seen-' + account) || '[]'); } catch { /* Memory only. */ }
      seen.current = { account, ids: new Set(Array.isArray(ids) ? ids.filter(id => typeof id === 'string').slice(-100) : []) };
    }
    const fresh = personal.updates.filter(item => !item.readAt && !seen.current.ids.has(item.id));
    if (!fresh.length) return;
    fresh.forEach(item => seen.current.ids.add(item.id));
    const ids = [...seen.current.ids].slice(-100); seen.current.ids = new Set(ids);
    try { localStorage.setItem('smarty-news-alerts-seen-' + account, JSON.stringify(ids)); } catch { /* Memory deduplication still works. */ }
    const latest = fresh[0];
    window.dispatchEvent(new CustomEvent('smarty-notification', { detail: { userId: account, notificationId: latest.id, type: 'news',
      title: 'New reporting: ' + latest.query, body: latest.body, url: '/news/story?q=' + encodeURIComponent(latest.query) + '&year=recent&order=newest' } }));
  }, [account, personal.updates]);
  return null;
}
