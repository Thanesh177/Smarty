import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { roomApi, storePendingRoomInvite } from '../api/client';
import { useAuth } from '../contexts/AuthContext';
import './JoinRoomPage.css';

export default function JoinRoomPage() {
  const { inviteCode } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();

  const cleanInviteCode = useMemo(
    () => String(inviteCode || '').trim(),
    [inviteCode]
  );

  const [invite, setInvite] = useState(null);
  const [loading, setLoading] = useState(true);
  const [joining, setJoining] = useState(false);
  const [status, setStatus] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    async function loadInvite() {
      if (!cleanInviteCode) {
        setError('Invite code is missing.');
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        setError('');
        setStatus('');

        storePendingRoomInvite(cleanInviteCode);

        const data = await roomApi.getRoomInvite(cleanInviteCode);

        setInvite(data?.invite || data || null);
      } catch (err) {
        console.error('ROOM INVITE PREVIEW ERROR:', err);

        setError(
          err?.response?.data?.error ||
            err?.response?.data?.message ||
            err?.message ||
            'Could not load invite.'
        );
      } finally {
        setLoading(false);
      }
    }

    loadInvite();
  }, [cleanInviteCode]);

  async function handleJoinRoom() {
    if (!cleanInviteCode || joining) return;

    if (!user) {
      storePendingRoomInvite(cleanInviteCode);

      navigate('/login', {
        replace: false,
        state: {
          redirectTo: `/rooms/invite/${encodeURIComponent(cleanInviteCode)}`,
        },
      });

      return;
    }

    try {
      setJoining(true);
      setStatus('');
      setError('');

      console.log('JOIN BUTTON CLICKED', cleanInviteCode);

      const result = await roomApi.joinRoomFromInvite(cleanInviteCode);

      console.log('JOIN RESULT', result);

      if (result?.joined) {
        setStatus(result?.message || 'Joined room successfully.');

        navigate('/rooms', { replace: true });
        return;
      }

      if (result?.requested) {
        setStatus(result?.message || 'Join request sent.');
        return;
      }

      setStatus(result?.message || 'Invite processed.');
    } catch (err) {
      console.error('JOIN ROOM FROM INVITE ERROR:', err);

      setError(
        err?.response?.data?.error ||
          err?.response?.data?.message ||
          err?.message ||
          'Could not join this room.'
      );
    } finally {
      setJoining(false);
    }
  }

  if (loading) {
    return (
      <main className="room-invite-page">
        <section className="room-invite-card">
          <p>Loading invite...</p>
        </section>
      </main>
    );
  }

  if (error && !invite) {
    return (
      <main className="room-invite-page">
        <section className="room-invite-card">
          <h1>Invite unavailable</h1>

          <p>{error}</p>

          <button
            type="button"
            onClick={() => navigate('/rooms')}
          >
            Back to rooms
          </button>
        </section>
      </main>
    );
  }

  return (
    <main className="room-invite-page">
      <section className="room-invite-card">
        <div className="room-invite-cover">
          {invite?.roomImageUrl ? (
            <img
              src={invite.roomImageUrl}
              alt={invite.roomName || 'Room'}
            />
          ) : (
            <span>
              {(invite?.roomName || 'R').slice(0, 1).toUpperCase()}
            </span>
          )}
        </div>

        <p className="room-invite-kicker">
          Private room invite
        </p>

        <h1>{invite?.roomName || 'Room invite'}</h1>

        {invite?.description && (
          <p>{invite.description}</p>
        )}

        <p className="room-invite-meta">
          {invite?.privacy === 'private'
            ? 'Private room'
            : 'Public room'}

          {invite?.memberCount
            ? ` · ${invite.memberCount} members`
            : ''}
        </p>

        {invite?.requiresApproval ? (
          <p className="room-invite-note">
            This room requires creator approval before you can join.
          </p>
        ) : (
          <p className="room-invite-note">
            This invite allows you to join instantly.
          </p>
        )}

        {error && (
          <p className="room-invite-error">
            {error}
          </p>
        )}

        {status && (
          <p className="room-invite-status">
            {status}
          </p>
        )}

        <button
          type="button"
          className="room-invite-join-btn"
          disabled={joining}
          onClick={handleJoinRoom}
        >
          {joining
            ? 'Joining...'
            : user
              ? invite?.requiresApproval
                ? 'Request to Join'
                : 'Join Room'
              : 'Log in to Join'}
        </button>

        <button
          type="button"
          className="room-invite-secondary-btn"
          onClick={() => navigate('/rooms')}
        >
          Back to rooms
        </button>
      </section>
    </main>
  );
}