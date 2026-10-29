import { Moon, Sun } from 'lucide-react';
import { useAppearance } from '../contexts/AppearanceContext';

export default function AppearanceSwitch({ compact = false, rail = false }) {
  const { theme, setTheme } = useAppearance();
  if (compact) {
    const next = theme === 'day' ? 'dark' : 'day';
    const label = `Switch to ${next === 'day' ? 'day' : 'night'} mode`;
    return <button type="button" className={`appearance-quick-toggle${rail ? ' quick-icon-link appearance-rail-toggle' : ''}`} aria-label={label} title={label}
      onClick={() => setTheme(next)}>
      {theme === 'day' ? <Moon size={18} aria-hidden="true" /> : <Sun size={18} aria-hidden="true" />}
      {rail && <span className="nav-control-label" aria-hidden="true">{next === 'day' ? 'Day mode' : 'Night mode'}</span>}
    </button>;
  }
  return <div className="appearance-setting">
    <span className="appearance-label">Appearance</span>
    <div className="appearance-options" role="group" aria-label="Appearance">
      <button type="button" aria-pressed={theme === 'day'} onClick={() => setTheme('day')}><Sun size={15} aria-hidden="true" />Day</button>
      <button type="button" aria-pressed={theme === 'dark'} onClick={() => setTheme('dark')}><Moon size={15} aria-hidden="true" />Night</button>
    </div>
  </div>;
}
