import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { roomApi } from '../api/client';
import { useAuth } from '../contexts/AuthContext';
import './JoinRoomPage.css';

function parseApiPayload(payload) {
  let parsedPayload = payload;

  try {
    parsedPayload = typeof payload === 'string' ? JSON.parse(payload) : payload;
  } catch {
    parsedPayload = payload;
  }

  let parsedBody = parsedPayload?.body;

  try {
    parsedBody = typeof parsedBody === 'string' ? JSON.parse(parsedBody) : parsedBody;
  } catch {
    parsedBody = parsedPayload?.body;
  }

  return {
    payload: parsedPayload,
    body: parsedBody,
  };
}

function normalizeInvitePayload(data) {
  const { payload, body } = parseApiPayload(data);

  const rawInvite =
    payload?.invite ||
    payload?.data?.invite ||
    body?.invite ||
    body?.data?.invite ||
    payload ||
    body ||
    null;

  if (!rawInvite || typeof rawInvite !== 'object') return null;

  const requiresApproval =
    rawInvite.requiresApproval === false || rawInvite.requiresApproval === 'false'
      ? false
      : true;

  return {
    ...rawInvite,
    inviteCode: rawInvite.inviteCode || rawInvite.code || '',
    roomId: rawInvite.roomId || rawInvite.topicRoomId || rawInvite.groupId || rawInvite.room?.roomId || '',
    roomName: rawInvite.roomName || rawInvite.name || rawInvite.room?.name || 'Private Room',
    description: rawInvite.description || rawInvite.roomDescription || rawInvite.about || rawInvite.room?.description || '',
    roomImageUrl: rawInvite.roomImageUrl || rawInvite.imageUrl || rawInvite.coverImageUrl || rawInvite.room?.imageUrl || '',
    privacy: rawInvite.privacy || rawInvite.room?.privacy || 'private',
    memberCount: Number(rawInvite.memberCount || rawInvite.room?.memberCount || 0),
    requiresApproval,
  };
}

export default function JoinRoomPage() {
  const { inviteCode } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const autoJoinAttemptedRef = useRef('');
  const safeInviteCode = String(inviteCode || '').trim();
  const pendingInviteKey = `smarty-pending-room-invite-${safeInviteCode}`;
  const joinPath = `/rooms/invite/${safeInviteCode}`;

  const [invite, setInvite] = useState(null);
  const [loading, setLoading] = useState(true);
  const [joining, setJoining] = useState(false);
  const [status, setStatus] = useState('');
  const [loadError, setLoadError] = useState('');

  useEffect(() => {
    async function loadInvite() {
      try {
        setLoading(true);
        setStatus('');
        setLoadError('');

        const data = await roomApi.getRoomInvite(safeInviteCode);
        const normalizedInvite = normalizeInvitePayload(data);

        if (!normalizedInvite?.inviteCode && !normalizedInvite?.roomId) {
          throw new Error('Invite response was empty or invalid.');
        }

        setInvite(normalizedInvite);
      } catch (err) {
        setInvite(null);
        setLoadError(
          err?.response?.data?.error ||
            err?.response?.data?.message ||
            err?.message ||
            'Invite link could not be loaded.'
        );
      } finally {
        setLoading(false);
      }
    }

    if (safeInviteCode) {
      loadInvite();
    } else {
      setLoading(false);
      setLoadError('Invite code is missing from the link.');
    }
  }, [safeInviteCode]);

  const joinRoom = useCallback(async () => {
    if (!user) {
      sessionStorage.setItem('smarty-post-login-redirect', joinPath);
      localStorage.setItem('smarty-post-login-redirect', joinPath);
      sessionStorage.setItem(pendingInviteKey, '1');
      localStorage.setItem(pendingInviteKey, '1');
      navigate(`/login?redirect=${encodeURIComponent(joinPath)}`, {
        replace: true,
        state: { from: joinPath },
      });
      return;
    }

    try {
      setJoining(true);
      setStatus('');

      const data = await roomApi.joinRoomFromInvite(safeInviteCode);
      const { payload, body } = parseApiPayload(data);
      const joinResult = body || payload || data || {};
      const joinedRoomId =
        joinResult?.roomId ||
        joinResult?.room?.roomId ||
        invite?.roomId ||
        '';

      sessionStorage.removeItem(pendingInviteKey);
      localStorage.removeItem(pendingInviteKey);
      sessionStorage.removeItem('smarty-post-login-redirect');
      localStorage.removeItem('smarty-post-login-redirect');

      if (joinResult?.joined) {
        setStatus('Joined room successfully. Opening room...');
        window.setTimeout(() => {
          if (joinedRoomId) {
            sessionStorage.setItem('smarty-open-room-id', joinedRoomId);
            localStorage.setItem('smarty-open-room-id', joinedRoomId);
            navigate(`/rooms?roomId=${encodeURIComponent(joinedRoomId)}`, { replace: true });
          } else {
            navigate('/rooms', { replace: true });
          }
        }, 700);
        return;
      }

      if (joinResult?.requested) {
        setStatus('Join request sent. The room creator must approve you.');
        return;
      }

      setStatus(joinResult?.message || 'Request completed.');
    } catch (err) {
      setStatus(
        err?.response?.data?.error ||
          err?.response?.data?.message ||
          err?.message ||
          'Could not join this room.'
      );
    } finally {
      setJoining(false);
    }
  }, [invite, joinPath, navigate, pendingInviteKey, safeInviteCode, user]);

  useEffect(() => {
    if (!safeInviteCode || !user || !invite || loadError || loading) return;
    if (autoJoinAttemptedRef.current === safeInviteCode) return;

    const pendingInvite =
      sessionStorage.getItem(pendingInviteKey) === '1' ||
      localStorage.getItem(pendingInviteKey) === '1' ||
      sessionStorage.getItem('smarty-post-login-redirect') === joinPath ||
      localStorage.getItem('smarty-post-login-redirect') === joinPath;

    if (invite.requiresApproval !== false && !pendingInvite) return;
    if (joining) return;

    autoJoinAttemptedRef.current = safeInviteCode;
    setStatus(invite.requiresApproval ? 'Sending join request...' : 'Instant join enabled. Joining room...');
    joinRoom();
  }, [invite, joinPath, joinRoom, joining, loadError, loading, pendingInviteKey, safeInviteCode, user]);

  const roomName = invite?.roomName || 'Private Room';
  const description =
    invite?.description ||
    invite?.roomDescription ||
    'This is a private Smarty room. Join to learn, chat, and share ideas with invited members.';

  const isInviteUnavailable = Boolean(loadError) && !invite;

  return (
    <main className="join-room-page">
      <section className="join-room-card">
        {loading ? (
          <div className="join-loader">
            <span />
            <p>Loading invite...</p>
          </div>
        ) : isInviteUnavailable ? (
          <div className="join-error-state">
            <div className="join-room-fallback">!</div>
            <p className="join-eyebrow">Invite Unavailable</p>
            <h1>Link can’t be opened</h1>
            <p className="join-status error">{loadError}</p>
            <button
              type="button"
              className="join-secondary-btn"
              onClick={() => navigate('/rooms')}
            >
              Back to Rooms
            </button>
          </div>
        ) : (
          <>
            <div className="join-room-hero">
              {invite?.roomImageUrl ? (
                <img src={invite.roomImageUrl} alt="" />
              ) : (
                <div className="join-room-fallback">
                  {roomName.slice(0, 1).toUpperCase()}
                </div>
              )}
            </div>

            <p className="join-eyebrow">Private Room Invite</p>
            <h1>{roomName}</h1>

            <div className="join-room-meta">
              <span>{invite?.privacy === 'private' ? 'Private' : 'Public'}</span>
              <span>{Number(invite?.memberCount || 0)} members</span>
              <span>{invite?.requiresApproval !== false ? 'Approval required' : 'Instant join'}</span>
            </div>

            <div className="join-description">
              <h2>Description</h2>
              <p>{description}</p>
            </div>

            {status && <p className="join-status">{status}</p>}
            {loadError && <p className="join-status error">{loadError}</p>}

            <button
              type="button"
              className="join-room-btn"
              disabled={joining || !invite || Boolean(loadError) || !safeInviteCode}
              onClick={joinRoom}
            >
              {joining
                ? 'Please wait...'
                : invite?.requiresApproval !== false
                  ? 'Request to Join'
                  : 'Join Room'}
            </button>

            <button
              type="button"
              className="join-secondary-btn"
              onClick={() => navigate('/rooms')}
            >
              Back to Rooms
            </button>
          </>
        )}
      </section>
    </main>
  );
}