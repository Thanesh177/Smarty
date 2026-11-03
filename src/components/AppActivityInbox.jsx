import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Bell, CheckCheck, ArrowUpRight } from 'lucide-react';
import { ACTIVITY_UPDATED, readAppActivity, markAppActivityRead } from '../lib/appActivity';
import './AppEngagement.css';

export default function AppActivityInbox({ userId }) {
  const [items, setItems] = useState(() => readAppActivity(userId));
  useEffect(() => {
    const refresh = event => { if (!event?.detail?.userId || event.detail.userId === userId) setItems(readAppActivity(userId)); };
    refresh(); window.addEventListener(ACTIVITY_UPDATED, refresh);
    const sync = () => refresh(); window.addEventListener('storage', sync);
    return () => { window.removeEventListener(ACTIVITY_UPDATED, refresh); window.removeEventListener('storage', sync); };
  }, [userId]);
  const unread = items.filter(item => !item.read).length;
  return <section className="app-activity" aria-labelledby="app-activity-title">
    <header><div><h2 id="app-activity-title">Your updates</h2><p>Learning, followed stories, and news from Smarty. Saved on this device.</p></div>
      {unread > 0 && <button type="button" onClick={() => markAppActivityRead(userId, 'all')}><CheckCheck size={16} aria-hidden="true" />Mark all read</button>}</header>
    {items.length ? <ul>{items.map(item => <li key={item.id}><Link to={item.url} onClick={() => markAppActivityRead(userId, item.id)} className={item.read ? '' : 'is-unread'}>
      <Bell size={17} aria-hidden="true" /><span><strong>{item.title}</strong><p>{item.body}</p>
        <small>{item.createdAt ? new Date(item.createdAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) : 'Update'}</small></span><ArrowUpRight size={16} aria-hidden="true" /></Link></li>)}</ul> :
      <div className="app-activity-empty"><Bell size={20} aria-hidden="true" /><p>You’re caught up. Follow a news story or complete a learning activity to find your updates here.</p></div>}
  </section>;
}
