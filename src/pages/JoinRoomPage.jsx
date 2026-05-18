import { useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { roomApi, storePendingRoomInvite } from '../api/client';
import { useAuth } from '../contexts/AuthContext';
import './JoinRoomPage.css';

export default function JoinRoomPage() {
  const { inviteCode } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  const autoJoinAttemptedRef = useRef('');

  const cleanInviteCode = useMemo(
    () => String(inviteCode || '').trim(),
    [inviteCode]
  );

  const loggedInUserId = useMemo(
    () => String(user?.id || user?.userId || user?.sub || user?.email || '').trim(),
    [user]
  );

  const normalizeRoomId = (value = '') => {
    const normalized = String(value || '').trim();

    if (!normalized) return '';

    return normalized.startsWith('group#')
      ? normalized
      : `group#${normalized}`;
  };

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

    if (!loggedInUserId) {
      storePendingRoomInvite(cleanInviteCode);
      navigate('/login', {
        replace: true,
        state: {
          from: location,
          pendingRoomInvite: cleanInviteCode,
        },
      });
      return;
    }

    try {
      setJoining(true);
      setStatus('');
      setError('');

      const result = await roomApi.joinRoomFromInvite(cleanInviteCode);
      console.log('ROOM INVITE JOIN RESULT:', result);

      const joinedRoom = result?.room || result?.data?.room || result?.joinedRoom || invite || null;
      const joinedRoomId = normalizeRoomId(
        result?.roomId ||
          result?.data?.roomId ||
          result?.joinedRoomId ||
          joinedRoom?.roomId ||
          joinedRoom?.id ||
          invite?.roomId ||
          invite?.id ||
          ''
      );
      const joinedRoomName =
        result?.roomName ||
        result?.data?.roomName ||
        result?.joinedRoomName ||
        joinedRoom?.roomName ||
        joinedRoom?.name ||
        invite?.roomName ||
        invite?.name ||
        '';

      const normalizedJoinedRoom = {
        ...(joinedRoom || {}),
        roomId: joinedRoomId,
        id: joinedRoomId,
        name: joinedRoomName || joinedRoom?.name || joinedRoom?.roomName || 'Joined group',
        roomName: joinedRoomName || joinedRoom?.roomName || joinedRoom?.name || 'Joined group',
        privacy:
          result?.privacy ||
          result?.data?.privacy ||
          joinedRoom?.privacy ||
          invite?.privacy ||
          'private',
        type:
          result?.type ||
          result?.data?.type ||
          joinedRoom?.type ||
          invite?.type ||
          'custom',
        memberType:
          result?.memberType ||
          result?.data?.memberType ||
          joinedRoom?.memberType ||
          'member',
      };

      const resultMessage = String(result?.message || result?.status || '').toLowerCase();
      const joinedSuccessfully =
        result?.joined === true ||
        result?.success === true ||
        result?.alreadyJoined === true ||
        result?.alreadyMember === true ||
        result?.isMember === true ||
        result?.requested !== true ||
        Boolean(result?.room) ||
        Boolean(result?.data?.room) ||
        Boolean(result?.joinedRoom) ||
        Boolean(joinedRoomId) ||
        resultMessage.includes('joined') ||
        resultMessage.includes('already a member') ||
        resultMessage.includes('already joined') ||
        resultMessage.includes('joined room successfully');

      if (result?.requested) {
        setStatus(result?.message || 'Join request sent.');
        return;
      }

      if (joinedSuccessfully) {
        setStatus(result?.message || 'Joined room successfully.');
        storePendingRoomInvite('');

        navigate('/rooms', {
          replace: true,
          state: {
            openRoomId: joinedRoomId,
            autoOpenRoomId: joinedRoomId,
            initialRoomId: joinedRoomId,
            focusRoomId: joinedRoomId,
            selectedRoomId: joinedRoomId,
            activeRoomId: joinedRoomId,
            roomId: joinedRoomId,
            openRoomName: normalizedJoinedRoom.name,
            joinedRoom: normalizedJoinedRoom,
            room: normalizedJoinedRoom,
            selectedRoom: normalizedJoinedRoom,
            autoOpenRoom: normalizedJoinedRoom,
            openJoinedRoom: true,
            source: 'roomInviteJoin',
            refreshRooms: true,
            forceRoomRefresh: true,
            inviteCode: cleanInviteCode,
            joinedAt: Date.now(),
            inviteNavigationVersion: Date.now(),
          },
        });
        return;
      }

      if (joinedRoomId) {
        navigate(`/rooms?room=${encodeURIComponent(joinedRoomId)}`, {
          replace: true,
          state: {
            openRoomId: joinedRoomId,
            autoOpenRoomId: joinedRoomId,
            selectedRoomId: joinedRoomId,
            activeRoomId: joinedRoomId,
            roomId: joinedRoomId,
            joinedRoom: normalizedJoinedRoom,
            room: normalizedJoinedRoom,
            source: 'roomInviteFallbackJoin',
            refreshRooms: true,
            forceRoomRefresh: true,
          },
        });
        return;
      }

      setStatus(result?.message || 'Invite processed, but the room could not be opened automatically.');
    } catch (err) {
      console.error('JOIN ROOM FROM INVITE ERROR:', err);

      const statusCode = err?.response?.status;

      if (statusCode === 401 || statusCode === 403) {
        storePendingRoomInvite(cleanInviteCode);
        navigate('/login', {
          replace: true,
          state: {
            from: location,
            pendingRoomInvite: cleanInviteCode,
            reason: 'authRequiredForRoomInvite',
          },
        });
        return;
      }

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

  useEffect(() => {
    if (loading || joining || !cleanInviteCode || !loggedInUserId) return;

    const autoJoinKey = `${loggedInUserId}:${cleanInviteCode}`;
    if (autoJoinAttemptedRef.current === autoJoinKey) return;

    autoJoinAttemptedRef.current = autoJoinKey;
    window.requestAnimationFrame(() => {
      handleJoinRoom();
    });
  }, [loggedInUserId, loading, joining, cleanInviteCode]);

  if (loading) {
    return (
      <main className="room-invite-page">
        <section className="room-invite-card">
          <p>Loading invite...</p>
        </section>
      </main>
    );
  }

  if (error && !invite && !user) {
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

        {!user && (
          <p className="room-invite-note">
            Log in to join or request access to this room.
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
            : !user
              ? 'Log in to join'
              : invite?.requiresApproval
                ? 'Request to Join'
                : 'Join Room'}
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