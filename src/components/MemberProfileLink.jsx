import { Link } from 'react-router-dom';
import { memberProfilePath } from '../lib/memberProfile';
import './PostAuthor.css';

export default function MemberProfileLink({ userId, children, className = '', label }) {
  const to = memberProfilePath(userId);
  if (!to) return <span className={className}>{children}</span>;
  return <Link to={to} className={`post-author-link ${className}`} aria-label={label}
    onClick={event => event.stopPropagation()}>{children}</Link>;
}
