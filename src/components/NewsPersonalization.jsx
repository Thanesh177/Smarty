import { useEffect, useId, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Bell, BellOff, Globe2, MapPin, X } from 'lucide-react';
import useNewsPersonalization from '../hooks/useNewsPersonalization';
import { NEWS_COUNTRIES, NEWS_REGIONS, getDefaultNewsCountry } from '../data/newsLocations';
import { cleanStoryQuery, storyQuery } from '../lib/newsStories';
import { briefingPlace, normalizeNewsPreference } from '../lib/newsPreferences';
import './NewsPersonalization.css';

export function NewsBriefingChoice({ personal, activePlace, onChange, heading, actions }) {
  const { preferences, savePreference, syncWarning } = personal;
  const [editing, setEditing] = useState(false), [country, setCountry] = useState('GLOBAL');
  const [region, setRegion] = useState('');
  const [error, setError] = useState('');
  const actionRef = useRef(null), editorToggleRef = useRef(null);
  const editorId = useId();
  useEffect(() => {
    setEditing(false); setError('');
    return () => { actionRef.current = null; };
  }, [personal.account]);
  const local = activePlace?.country && activePlace.country !== 'GLOBAL' ? activePlace : preferences;
  const localCountry = local?.country;
  const localRegion = local?.region || '';
  const label = localRegion || NEWS_COUNTRIES.find(item => item.code === localCountry)?.name || 'Your place';
  const hasLocal = localCountry && localCountry !== 'GLOBAL';
  const mode = activePlace ? activePlace.country === 'GLOBAL' ? 'world' : 'local' : preferences?.mode || 'world';
  const closeEditor = () => { setEditing(false); editorToggleRef.current?.focus(); };
  const apply = (mode, fromEditor = false) => {
    const preference = normalizeNewsPreference({ chosen: true, mode,
      country: fromEditor ? country : localCountry || 'GLOBAL', region: fromEditor ? region : localRegion });
    const next = briefingPlace(preference);
    const alreadySelected = next.country === activePlace?.country && next.region === (activePlace?.region || '');
    setError('');
    if (fromEditor) closeEditor();
    else setEditing(false);
    // Opening an edition is a local action. Account sync must not lock the row
    // or change the visible edition after a newer selection has been made.
    onChange?.(next);
    if (!fromEditor && alreadySelected) return;
    const action = {};
    actionRef.current = action;
    void savePreference(preference).catch(() => {
      if (actionRef.current === action) setError('Could not save this place. You can still read this edition.');
    });
  };
  const placeAction = preferences || hasLocal ? 'Change place' : 'Choose place';
  return <section className="news-place-choice" aria-label="Daily briefing location">
    <div className="news-command-row">
      {heading}
      <div className="news-place-switch">
        <div role="group" aria-label="Briefing edition">
          <button type="button" aria-pressed={mode === 'world'} onClick={() => apply('world')}><Globe2 size={15} aria-hidden="true" />World</button>
          {hasLocal && <button type="button" aria-label={label} title={label} aria-pressed={mode === 'local'} onClick={() => apply('local')}>
            <span className="news-edition-local-label">{label}</span><span className="news-edition-local-short" aria-hidden="true">Local</span>
          </button>}
        </div>
        <button type="button" ref={editorToggleRef} className="news-edit-place" title={placeAction} aria-label={placeAction}
          aria-expanded={editing} aria-controls={editing ? editorId : undefined} onClick={() => {
            if (editing) { closeEditor(); return; }
            setCountry(hasLocal ? localCountry : getDefaultNewsCountry()); setRegion(localRegion); setEditing(true);
          }}><MapPin size={16} aria-hidden="true" /><span>{placeAction}</span></button>
      </div>
      {actions}
    </div>
    {editing && <form id={editorId} onSubmit={event => { event.preventDefault(); apply('local', true); }}>
      <header><div><h2>Your briefing, your place.</h2><p>Choose a country and region. Switch back to World anytime.</p></div>
        <button type="button" aria-label="Close location settings" onClick={closeEditor}><X size={18}/></button></header>
      <div className="news-place-fields"><label>Country<select aria-label="Briefing country" value={country} onChange={event => { setCountry(event.target.value); setRegion(''); }}>
        {NEWS_COUNTRIES.map(item => <option value={item.code} key={item.code}>{item.name}</option>)}</select></label>
        <label>State or region<select aria-label="Briefing state or region" value={region} disabled={!NEWS_REGIONS[country]?.length} onChange={event => setRegion(event.target.value)}>
          <option value="">Countrywide</option>{(NEWS_REGIONS[country] || []).map(item => <option key={item}>{item}</option>)}</select></label></div>
      <footer><button type="submit">{country === 'GLOBAL' ? 'Use world briefing' : 'Use my place'}</button><button type="button" onClick={() => apply('world', true)}>Keep world briefing</button></footer>
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
