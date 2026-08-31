import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Activity,
  CheckCircle2,
  Clock3,
  RefreshCw,
  Search,
  ShieldCheck,
  Trash2,
  Undo2,
  UserCheck,
  UserRoundCog,
  UserX,
} from 'lucide-react';
import { moderationApi } from '../api/client';
import { useAuth } from '../contexts/AuthContext';
import { isAdminUser } from '../lib/adminAccess';
import './AdminModerationPage.css';

const STATUS_OPTIONS = [
  ['pending', 'Pending'],
  ['removed', 'Removed'],
  ['dismissed', 'Dismissed'],
  ['approved', 'Approved'],
  ['admin_action', 'Activity'],
];

function formatDate(value) {
  const timestamp = Number(value || 0);
  if (!timestamp) return 'Unknown time';

  return new Intl.DateTimeFormat(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(timestamp));
}

function ModerationCaseCard({ item, onDecision, onManageUser, busy }) {
  const snapshot = item.snapshot || {};
  const isPost = item.contentType === 'post';
  const isAdminAction = item.status === 'admin_action';

  return (
    <article className="moderation-case-card">
      <header>
        <div>
          <span className={`moderation-status is-${item.status || 'pending'}`}>
            {item.status || 'pending'}
          </span>
          <span className="moderation-content-type">{item.contentType || 'content'}</span>
        </div>
        <time dateTime={item.createdAt ? new Date(Number(item.createdAt)).toISOString() : undefined}>
          {formatDate(item.createdAt)}
        </time>
      </header>

      <div className="moderation-case-content">
        {snapshot.imageUrl && (
          <img src={snapshot.imageUrl} alt="Reported content preview" loading="lazy" />
        )}

        <div>
          <p className="moderation-case-topic">{snapshot.topic || item.source || 'Smarty report'}</p>
          <h2>
            {isAdminAction
              ? `${item.action === 'reactivate' ? 'Reactivated' : 'Suspended'} user access`
              : snapshot.title || `Reported ${item.contentType || 'content'}`}
          </h2>
          <p className="moderation-case-body">
            {snapshot.body || item.reason || 'No content preview was available. Review the identifiers and report context below.'}
          </p>
        </div>
      </div>

      <dl className="moderation-case-facts">
        <div>
          <dt>Reason</dt>
          <dd>{item.reason || 'No reason provided'}</dd>
        </div>
        <div>
          <dt>Reported user</dt>
          <dd>{snapshot.creatorName || item.reportedUserId || 'Unknown'}</dd>
        </div>
        <div>
          <dt>Content ID</dt>
          <dd title={item.contentId}>{item.contentId || 'Not provided'}</dd>
        </div>
        <div>
          <dt>Reporter ID</dt>
          <dd title={item.reporterId}>{item.reporterId || 'Unknown'}</dd>
        </div>
      </dl>

      {!isAdminAction && (
        <div className="moderation-case-actions">
          {item.reportedUserId && (
            <button
              type="button"
              className="moderation-user-btn"
              disabled={busy}
              onClick={() => onManageUser(item.reportedUserId)}
            >
              <UserRoundCog size={17} />
              Manage user
            </button>
          )}
          {item.status === 'pending' && (
            <>
              <button
                type="button"
                className="moderation-dismiss-btn"
                disabled={busy}
                onClick={() => onDecision(item, 'dismiss')}
              >
                <Undo2 size={17} />
                {isPost ? 'Dismiss and restore' : 'Dismiss report'}
              </button>
              <button
                type="button"
                className="moderation-remove-btn"
                disabled={busy}
                onClick={() => onDecision(item, 'remove')}
              >
                <Trash2 size={17} />
                {isPost ? 'Remove content' : 'Confirm violation'}
              </button>
            </>
          )}
        </div>
      )}
    </article>
  );
}

export default function AdminModerationPage() {
  const { user } = useAuth();
  const mountedRef = useRef(true);
  const [status, setStatus] = useState('pending');
  const [cases, setCases] = useState([]);
  const [nextCursor, setNextCursor] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [busyCaseId, setBusyCaseId] = useState('');
  const [decisionTarget, setDecisionTarget] = useState(null);
  const [decision, setDecision] = useState('');
  const [notes, setNotes] = useState('');
  const [overview, setOverview] = useState({});
  const [userQuery, setUserQuery] = useState('');
  const [userResults, setUserResults] = useState([]);
  const [userSearching, setUserSearching] = useState(false);
  const [hasUserSearched, setHasUserSearched] = useState(false);
  const [userActionTarget, setUserActionTarget] = useState(null);
  const [userAction, setUserAction] = useState('');
  const [userActionReason, setUserActionReason] = useState('');
  const [userActionBusy, setUserActionBusy] = useState(false);

  useEffect(() => () => {
    mountedRef.current = false;
  }, []);

  const loadCases = useCallback(async ({ append = false } = {}) => {
    if (!isAdminUser(user)) {
      setCases([]);
      setNextCursor('');
      setLoading(false);
      setError('Admin access is required.');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const data = await moderationApi.getCases({
        status,
        limit: 50,
        cursor: append ? nextCursor : '',
      });
      if (!mountedRef.current) return;
      const incoming = Array.isArray(data?.items) ? data.items : [];
      setCases((current) => append ? [...current, ...incoming] : incoming);
      setNextCursor(data?.nextCursor || '');
    } catch (loadError) {
      console.error('Could not load moderation cases:', loadError);
      if (!mountedRef.current) return;
      setError(
        Number(loadError?.response?.status) === 403
          ? 'Your account is not authorized for moderation.'
          : 'The moderation queue could not be loaded.'
      );
    } finally {
      if (mountedRef.current) setLoading(false);
    }
  }, [nextCursor, status, user]);

  const loadOverview = useCallback(async () => {
    if (!isAdminUser(user)) return;
    try {
      const data = await moderationApi.getOverview();
      if (mountedRef.current) setOverview(data?.counts || {});
    } catch (overviewError) {
      console.error('Could not load moderation overview:', overviewError);
    }
  }, [user]);

  useEffect(() => {
    loadCases({ append: false });
    loadOverview();
    // Cursor changes are pagination state, not a reason to reload page one.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, user]);

  const findUsers = useCallback(async (query = userQuery) => {
    const normalized = String(query || '').trim();
    if (!normalized || userSearching) return;
    setUserSearching(true);
    setError('');
    try {
      const data = await moderationApi.findUsers(normalized);
      if (!mountedRef.current) return;
      setUserResults(Array.isArray(data?.items) ? data.items : []);
      setHasUserSearched(true);
      setUserQuery(normalized);
    } catch (searchError) {
      console.error('Admin user lookup failed:', searchError);
      if (mountedRef.current) {
        setError(searchError?.response?.data?.error || 'Account lookup failed.');
      }
    } finally {
      if (mountedRef.current) setUserSearching(false);
    }
  }, [userQuery, userSearching]);

  const openManageUser = useCallback((userId) => {
    const normalized = String(userId || '').trim();
    if (!normalized) return;
    setUserQuery(normalized);
    findUsers(normalized);
  }, [findUsers]);

  const openUserAction = useCallback((account, action) => {
    setUserActionTarget(account);
    setUserAction(action);
    setUserActionReason('');
  }, []);

  const closeUserAction = useCallback(() => {
    if (userActionBusy) return;
    setUserActionTarget(null);
    setUserAction('');
    setUserActionReason('');
  }, [userActionBusy]);

  const confirmUserAction = useCallback(async () => {
    if (!userActionTarget?.username || !userAction || userActionBusy) return;
    if (userActionReason.trim().length < 8) {
      setError('Add a clear reason of at least 8 characters.');
      return;
    }

    setUserActionBusy(true);
    setError('');
    try {
      const data = await moderationApi.setUserStatus(userActionTarget.username, {
        action: userAction,
        reason: userActionReason.trim(),
      });
      if (!mountedRef.current) return;
      setUserResults((current) => current.map((account) =>
        account.username === userActionTarget.username
          ? { ...account, ...(data?.user || {}) }
          : account
      ));
      setUserActionTarget(null);
      setUserAction('');
      setUserActionReason('');
      loadOverview();
    } catch (actionError) {
      console.error('Admin user action failed:', actionError);
      if (mountedRef.current) {
        setError(actionError?.response?.data?.error || 'Account access could not be changed.');
      }
    } finally {
      if (mountedRef.current) setUserActionBusy(false);
    }
  }, [loadOverview, userAction, userActionBusy, userActionReason, userActionTarget]);

  const openDecision = useCallback((item, nextDecision) => {
    setDecisionTarget(item);
    setDecision(nextDecision);
    setNotes('');
  }, []);

  const closeDecision = useCallback(() => {
    if (busyCaseId) return;
    setDecisionTarget(null);
    setDecision('');
    setNotes('');
  }, [busyCaseId]);

  const confirmDecision = useCallback(async () => {
    if (!decisionTarget?.caseId || !decision || busyCaseId) return;

    setBusyCaseId(decisionTarget.caseId);
    setError('');

    try {
      await moderationApi.decideCase(decisionTarget.caseId, { decision, notes });
      if (!mountedRef.current) return;

      setCases((current) => current.filter(
        (item) => item.contentId !== decisionTarget.contentId
      ));
      setDecisionTarget(null);
      setDecision('');
      setNotes('');
    } catch (decisionError) {
      console.error('Moderation decision failed:', decisionError);
      if (mountedRef.current) {
        setError(
          decisionError?.response?.data?.error ||
          'The moderation decision could not be saved.'
        );
      }
    } finally {
      if (mountedRef.current) setBusyCaseId('');
    }
  }, [busyCaseId, decision, decisionTarget, notes]);

  return (
    <main className="admin-moderation-page">
      <section className="admin-moderation-hero">
        <div className="admin-moderation-icon" aria-hidden="true">
          <ShieldCheck size={24} />
        </div>
        <div>
          <span>Smarty safety</span>
          <h1>Moderation control</h1>
          <p>Reported posts stay hidden until an authorized reviewer makes a decision.</p>
        </div>
        <button
          type="button"
          onClick={() => {
            loadCases({ append: false });
            loadOverview();
          }}
          disabled={loading}
        >
          <RefreshCw size={17} className={loading ? 'is-spinning' : ''} />
          Refresh
        </button>
      </section>

      <section className="moderation-summary" aria-label="Moderation queue summary">
        <div>
          <Clock3 size={18} />
          <strong>{overview.pending ?? 0}</strong>
          <span>Awaiting review</span>
        </div>
        <div>
          <Trash2 size={18} />
          <strong>{overview.removed ?? 0}</strong>
          <span>Content removed</span>
        </div>
        <div>
          <Activity size={18} />
          <strong>{overview.admin_action ?? 0}</strong>
          <span>Account actions</span>
        </div>
      </section>

      <section className="admin-account-tools" aria-labelledby="admin-account-tools-title">
        <div className="admin-account-tools-copy">
          <span>Admin power</span>
          <h2 id="admin-account-tools-title">Account access control</h2>
          <p>Find an exact email or user ID. Suspensions disable sign-in, revoke sessions, and create an audit record.</p>
        </div>
        <form
          className="admin-user-search"
          onSubmit={(event) => {
            event.preventDefault();
            findUsers();
          }}
        >
          <Search size={18} aria-hidden="true" />
          <input
            type="search"
            value={userQuery}
            placeholder="Email address or user ID"
            aria-label="Find a user account"
            onChange={(event) => setUserQuery(event.target.value)}
          />
          <button type="submit" disabled={userSearching || !userQuery.trim()}>
            {userSearching ? 'Searching…' : 'Find account'}
          </button>
        </form>

        {userResults.length > 0 && (
          <div className="admin-user-results" aria-live="polite">
            {userResults.map((account) => (
              <article className="admin-user-result" key={account.username}>
                <div className="admin-user-avatar" aria-hidden="true">
                  {(account.name || account.email || 'U').slice(0, 1).toUpperCase()}
                </div>
                <div className="admin-user-identity">
                  <strong>{account.name || 'Smarty user'}</strong>
                  <span>{account.email || account.username}</span>
                  <small title={account.username}>{account.username}</small>
                </div>
                <span className={`admin-user-state ${account.enabled ? 'is-active' : 'is-suspended'}`}>
                  {account.enabled ? 'Active' : 'Suspended'}
                </span>
                <button
                  type="button"
                  className={account.enabled ? 'suspend' : 'reactivate'}
                  onClick={() => openUserAction(account, account.enabled ? 'suspend' : 'reactivate')}
                >
                  {account.enabled ? <UserX size={17} /> : <UserCheck size={17} />}
                  {account.enabled ? 'Suspend access' : 'Reactivate'}
                </button>
              </article>
            ))}
          </div>
        )}
        {hasUserSearched && !userSearching && userResults.length === 0 && (
          <p className="admin-user-empty">No account matched that exact email or user ID.</p>
        )}
      </section>

      <nav className="moderation-status-tabs" aria-label="Moderation status">
        {STATUS_OPTIONS.map(([value, label]) => (
          <button
            key={value}
            type="button"
            className={status === value ? 'active' : ''}
            aria-pressed={status === value}
            onClick={() => setStatus(value)}
          >
            {label}
          </button>
        ))}
      </nav>

      {error && <p className="moderation-page-message error" role="alert">{error}</p>}
      {loading && <p className="moderation-page-message">Loading moderation cases…</p>}

      {!loading && !error && cases.length === 0 && (
        <section className="moderation-empty-state">
          <CheckCircle2 size={28} />
          <h2>No {status} cases</h2>
          <p>The moderation queue is clear for this status.</p>
        </section>
      )}

      <section className="moderation-case-list" aria-live="polite">
        {cases.map((item) => (
          <ModerationCaseCard
            key={item.caseId}
            item={item}
            busy={busyCaseId === item.caseId}
            onDecision={openDecision}
            onManageUser={openManageUser}
          />
        ))}
      </section>

      {!loading && nextCursor && (
        <div className="moderation-load-more">
          <button type="button" onClick={() => loadCases({ append: true })}>
            Load more cases
          </button>
        </div>
      )}

      {decisionTarget && (
        <div className="moderation-decision-backdrop" role="presentation" onClick={closeDecision}>
          <section
            className="moderation-decision-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="moderation-decision-title"
            onClick={(event) => event.stopPropagation()}
          >
            <span>Confirm moderation decision</span>
            <h2 id="moderation-decision-title">
              {decision === 'remove' ? 'Keep this content removed?' : 'Dismiss this report and restore content?'}
            </h2>
            <p>
              {decision === 'remove'
                ? 'The content will remain unavailable to every user.'
                : 'The post will return to its previous visibility immediately.'}
            </p>
            <label>
              Internal review notes
              <textarea
                value={notes}
                maxLength={2000}
                placeholder="Add the evidence or policy reason for this decision"
                onChange={(event) => setNotes(event.target.value)}
              />
            </label>
            <div>
              <button type="button" onClick={closeDecision} disabled={Boolean(busyCaseId)}>
                Cancel
              </button>
              <button
                type="button"
                className={decision === 'remove' ? 'danger' : 'restore'}
                onClick={confirmDecision}
                disabled={Boolean(busyCaseId)}
              >
                {busyCaseId
                  ? 'Saving…'
                  : decision === 'remove'
                    ? 'Keep removed'
                    : 'Dismiss and restore'}
              </button>
            </div>
          </section>
        </div>
      )}

      {userActionTarget && (
        <div className="moderation-decision-backdrop" role="presentation" onClick={closeUserAction}>
          <section
            className="moderation-decision-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="admin-user-action-title"
            onClick={(event) => event.stopPropagation()}
          >
            <span>Admin account control</span>
            <h2 id="admin-user-action-title">
              {userAction === 'suspend' ? 'Suspend this account?' : 'Reactivate this account?'}
            </h2>
            <p>
              {userAction === 'suspend'
                ? 'The user will be signed out globally and unable to sign in. Existing moderation decisions remain unchanged.'
                : 'The user will be able to sign in again. Removed content will not be restored automatically.'}
            </p>
            <div className="admin-action-account">
              <strong>{userActionTarget.name || userActionTarget.email || 'Smarty user'}</strong>
              <span>{userActionTarget.email || userActionTarget.username}</span>
            </div>
            <label>
              Required internal reason
              <textarea
                autoFocus
                value={userActionReason}
                maxLength={2000}
                placeholder="Record the policy or support reason for this action"
                onChange={(event) => setUserActionReason(event.target.value)}
              />
            </label>
            <div>
              <button type="button" onClick={closeUserAction} disabled={userActionBusy}>
                Cancel
              </button>
              <button
                type="button"
                className={userAction === 'suspend' ? 'danger' : 'restore'}
                onClick={confirmUserAction}
                disabled={userActionBusy || userActionReason.trim().length < 8}
              >
                {userActionBusy
                  ? 'Saving…'
                  : userAction === 'suspend'
                    ? 'Suspend and sign out'
                    : 'Reactivate account'}
              </button>
            </div>
          </section>
        </div>
      )}
    </main>
  );
}
