import { Link } from 'react-router-dom';
import './TermsAgreement.css';

export const EULA_VERSION = '2026-07-30';

export function recordTermsAcceptance(identifier = '') {
  try {
    localStorage.setItem(
      'smarty.eula.acceptance',
      JSON.stringify({
        version: EULA_VERSION,
        acceptedAt: new Date().toISOString(),
        identifier: String(identifier || '').trim().toLowerCase(),
      })
    );
  } catch {
    // Authentication should still work when local storage is unavailable.
  }
}

export default function TermsAgreement({ checked, disabled = false, onChange }) {
  return (
    <label className="terms-agreement">
      <input
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={(event) => onChange(event.target.checked)}
      />
      <span>
        I agree to the{' '}
        <Link to="/terms" target="_blank" rel="noreferrer">
          Terms of Use and EULA
        </Link>
        . I understand that Smarty has zero tolerance for objectionable content
        or abusive behavior.
      </span>
    </label>
  );
}
