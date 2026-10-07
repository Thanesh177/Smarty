import { useEffect, useState } from 'react';
import { WifiOff } from 'lucide-react';
import './AppResilience.css';

export default function ConnectionStatus() {
  const [offline, setOffline] = useState(() => navigator.onLine === false);
  useEffect(() => {
    const update = () => setOffline(navigator.onLine === false);
    window.addEventListener('online', update);
    window.addEventListener('offline', update);
    return () => {
      window.removeEventListener('online', update);
      window.removeEventListener('offline', update);
    };
  }, []);
  // Do not interrupt reading or clear the remembered account when offline.
  return <div className="app-connection-status" role="status" aria-live="polite" aria-atomic="true">
    {offline && <span><WifiOff size={15} aria-hidden="true" />You’re offline. Reconnect to get updates.</span>}
  </div>;
}
