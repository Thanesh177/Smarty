import { useLocation } from 'react-router-dom';
import './RouteSkeleton.css';

export default function RouteSkeleton() {
  const { pathname } = useLocation();
  const conversation = /^\/(chat|rooms)(\/|$)/.test(pathname);
  return <div className={`route-skeleton${conversation ? ' route-skeleton--conversation' : ''}`} role="status" aria-label="Loading page" aria-busy="true">
    <span className="route-skeleton-label">Opening your space…</span>
    <div aria-hidden="true" className="route-skeleton-heading" />
    <div aria-hidden="true" className="route-skeleton-layout">
      {[0, 1, 2].map(index => <div className="route-skeleton-block" key={index}><i /><i /><i /></div>)}
    </div>
  </div>;
}
