import './SmartyBrand.css';

export default function SmartyBrand({
  className = '',
  compact = false,
  tagline = '',
}) {
  return (
    <span
      className={`smarty-brand-lockup ${
        compact ? 'smarty-brand-lockup--compact' : ''
      } ${className}`.trim()}
      aria-label={tagline ? `Smarty — ${tagline}` : 'Smarty'}
    >
      <span className="smarty-brand-mark" aria-hidden="true">
        <span>S</span>
      </span>

      <span className="smarty-brand-copy">
        <strong>Smarty</strong>
        {tagline && <small>{tagline}</small>}
      </span>
    </span>
  );
}
