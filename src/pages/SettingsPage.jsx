import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowUpRight, Bell, Bookmark, ChartNoAxesCombined, ChevronRight, CircleUserRound, Download, FileText, HelpCircle, LogOut, Shield, ShieldCheck } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { isAdminUser } from '../lib/adminAccess';
import AppSettingsEngagement from '../components/AppSettingsEngagement';
import './SettingsPage.css';

function SettingsLink({ to, icon: Icon, title, description }) {
  return <Link className="settings-page-row" to={to}><Icon size={20} aria-hidden="true" /><span><strong>{title}</strong><small>{description}</small></span><ChevronRight size={17} aria-hidden="true" /></Link>;
}

export default function SettingsPage() {
  const { user, logout } = useAuth();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const pending = useRef(false), mounted = useRef(true);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  const native = typeof window.webkit?.messageHandlers?.smartyNative?.postMessage === 'function';
  const signOut = async () => {
    if (pending.current) return;
    pending.current = true; setBusy(true); setError('');
    try { await logout(); }
    catch { if (mounted.current) setError('Could not sign out. Check your connection and try again.'); }
    finally { pending.current = false; if (mounted.current) setBusy(false); }
  };
  return <main className="settings-page" aria-labelledby="settings-page-title">
    <header className="settings-page-heading"><div><h1 id="settings-page-title">Settings</h1><p>Your library, account, and everyday preferences.</p></div><Link to="/feed?topic=All">Back to feed<ArrowUpRight size={16} aria-hidden="true" /></Link></header>
    <div className="settings-page-grid">
      <section aria-labelledby="settings-account-title"><h2 id="settings-account-title">Account</h2><div className="settings-page-group">
        {user ? <><SettingsLink to="/profile" icon={CircleUserRound} title="Profile & account" description="Edit your details and manage your account" />
          <SettingsLink to="/creator-dashboard" icon={ChartNoAxesCombined} title="Creator dashboard" description="Your posts and follow requests" /></>
          : <SettingsLink to="/login" icon={CircleUserRound} title="Sign in" description="Keep your saved posts and conversations together" />}
        {user && isAdminUser(user) && <SettingsLink to="/admin" icon={ShieldCheck} title="Admin control" description="Moderation and app management" />}
      </div></section>
      <section aria-labelledby="settings-library-title"><h2 id="settings-library-title">Library & notifications</h2><div className="settings-page-group">
        <SettingsLink to="/saved" icon={Bookmark} title="Saved" description="Posts and videos you want to return to" />
        <SettingsLink to="/notifications" icon={Bell} title="Notifications" description="Reminders, story updates, and alerts" />
        {native && <button type="button" className="settings-page-row" data-smarty-native-screen="downloads" onClick={() => window.webkit.messageHandlers.smartyNative.postMessage({ action: 'nativeScreen', screen: 'downloads' })}><Download size={20} aria-hidden="true" /><span><strong>Offline library</strong><small>Downloaded books, media, and chat backups</small></span><ChevronRight size={17} aria-hidden="true" /></button>}
      </div></section>
      <section aria-labelledby="settings-help-title"><h2 id="settings-help-title">Help & privacy</h2><div className="settings-page-group">
        <SettingsLink to="/support" icon={HelpCircle} title="Support" description="Get help or tell us what could work better" />
        <SettingsLink to="/privacy" icon={Shield} title="Privacy" description="How your information is handled" />
        <SettingsLink to="/terms" icon={FileText} title="Terms of use" description="Community rules and your rights" />
      </div></section>
      <section aria-labelledby="settings-share-title"><h2 id="settings-share-title">Share Smarty</h2><AppSettingsEngagement user={user} /></section>
    </div>
    {user && <footer className="settings-page-footer"><button type="button" onClick={signOut} disabled={busy}><LogOut size={17} aria-hidden="true" />{busy ? 'Signing out…' : 'Sign out'}</button><p>{error || 'You stay signed in until you choose to sign out.'}</p>{error && <span className="sr-only" role="alert">{error}</span>}</footer>}
  </main>;
}
