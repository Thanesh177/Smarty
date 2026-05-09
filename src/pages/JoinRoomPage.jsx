import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { roomApi } from '../api/client';
import { useAuth } from '../contexts/AuthContext';
import './JoinRoomPage.css';

export default function JoinRoomPage() {
  const { inviteCode } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const autoJoinAttemptedRef = useRef('');
  const pendingInviteKey = `smarty-pending-room-invite-${inviteCode || ''}`;
  const joinPath = `/rooms/invite/${inviteCode || ''}`;

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

        const data = await roomApi.getRoomInvite(inviteCode);
        setInvite(data?.invite || data);
      } catch (err) {
        setInvite(null);
        setLoadError(err?.response?.data?.error || 'Invite link could not be loaded.');
      } finally {
        setLoading(false);
      }
    }

    if (inviteCode) loadInvite();
  }, [inviteCode]);

  const joinRoom = useCallback(async () => {
    if (!user) {
      sessionStorage.setItem('smarty-post-login-redirect', joinPath);
      localStorage.setItem('smarty-post-login-redirect', joinPath);
      sessionStorage.setItem(pendingInviteKey, '1');
      localStorage.setItem(pendingInviteKey, '1');
      navigate(`/login?redirect=${encodeURIComponent(joinPath)}`, { state: { from: joinPath } });
      return;
    }

    try {
      setJoining(true);
      setStatus('');

      const data = await roomApi.joinRoomFromInvite(inviteCode);
      sessionStorage.removeItem(pendingInviteKey);
      localStorage.removeItem(pendingInviteKey);
      sessionStorage.removeItem('smarty-post-login-redirect');
      localStorage.removeItem('smarty-post-login-redirect');

      if (data?.joined) {
        setStatus('Joined room successfully. Opening room...');
        window.setTimeout(() => {
          if (data?.roomId) {
            navigate(`/rooms?roomId=${encodeURIComponent(data.roomId)}`);
          } else {
            navigate('/rooms');
          }
        }, 700);
        return;
      }

      if (data?.requested) {
        setStatus('Join request sent. The room creator must approve you.');
        return;
      }

      setStatus(data?.message || 'Request completed.');
    } catch (err) {
      setStatus(err?.response?.data?.error || 'Could not join this room.');
    } finally {
      setJoining(false);
    }
  }, [inviteCode, joinPath, navigate, pendingInviteKey, user]);

  useEffect(() => {
    if (!inviteCode || !user || !invite || loadError || loading) return;
    if (autoJoinAttemptedRef.current === inviteCode) return;

    const pendingInvite =
      sessionStorage.getItem(pendingInviteKey) === '1' ||
      localStorage.getItem(pendingInviteKey) === '1' ||
      sessionStorage.getItem('smarty-post-login-redirect') === joinPath ||
      localStorage.getItem('smarty-post-login-redirect') === joinPath;

    if (invite.requiresApproval !== false && !pendingInvite) return;

    autoJoinAttemptedRef.current = inviteCode;
    setStatus(invite.requiresApproval ? 'Sending join request...' : 'Instant join enabled. Joining room...');
    joinRoom();
  }, [invite, inviteCode, joinPath, joinRoom, loadError, loading, pendingInviteKey, user]);

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
              <span>{invite?.requiresApproval ? 'Approval required' : 'Instant join'}</span>
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
              disabled={joining || !invite || Boolean(loadError)}
              onClick={joinRoom}
            >
              {joining
                ? 'Please wait...'
                : invite?.requiresApproval
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