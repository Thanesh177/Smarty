import { useEffect, useRef, useState } from 'react';
import { creatorApi, roomApi } from '../api/client';
import './FollowRequestsPage.css';

export default function FollowRequestsPage() {
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState('');
  const [roomInvites, setRoomInvites] = useState([]);
  const [roomJoinRequests, setRoomJoinRequests] = useState([]);
  const mountedRef = useRef(true);
  const [processingKey, setProcessingKey] = useState('');

  const loadRequests = async () => {
    try {
      setLoading(true);
      setStatus('');

      const [followResult, inviteResult, roomsResult] = await Promise.allSettled([
        creatorApi.getFollowRequests(),
        creatorApi.getRoomInvites(),
        roomApi.getRooms({ search: '' }),
      ]);

      if (!mountedRef.current) return;

      if (followResult.status === 'fulfilled') {
        const data = followResult.value;
        const followRequests = Array.isArray(data?.requests)
          ? data.requests
          : Array.isArray(data)
            ? data
            : [];
        setRequests(followRequests);
      } else {
        console.error('Failed to load follow requests', followResult.reason);
      }

      if (inviteResult.status === 'fulfilled') {
        const inviteData = inviteResult.value;
        const invites = Array.isArray(inviteData?.invites)
          ? inviteData.invites
          : Array.isArray(inviteData)
            ? inviteData
            : [];
        setRoomInvites(invites);
      } else {
        console.error('Failed to load room invites', inviteResult.reason);
      }

      if (roomsResult.status === 'fulfilled') {
        const roomsData = roomsResult.value;
        const allRooms = Array.isArray(roomsData?.rooms)
          ? roomsData.rooms
          : Array.isArray(roomsData)
            ? roomsData
            : [];

        const ownedRooms = allRooms.filter((room) => room?.roomId && (room.ownerId || room.createdBy));

        const requestsByRoom = await Promise.allSettled(
          ownedRooms.map(async (room) => {
            const requestData = await roomApi.getRoomJoinRequests(room.roomId);
            const roomRequests = Array.isArray(requestData?.requests)
              ? requestData.requests
              : Array.isArray(requestData)
                ? requestData
                : [];

            return roomRequests.map((request) => ({
              ...request,
              roomId: room.roomId,
              roomName: room.name,
            }));
          })
        );

        if (!mountedRef.current) return;

        setRoomJoinRequests(
          requestsByRoom
            .filter((result) => result.status === 'fulfilled')
            .flatMap((result) => result.value)
        );

        requestsByRoom
          .filter((result) => result.status === 'rejected')
          .forEach((result) => console.error('Failed to load join requests for room', result.reason));
      } else {
        console.error('Failed to load room join requests', roomsResult.reason);
      }
    } catch (err) {
      console.error(err);
      if (mountedRef.current) setStatus('Failed to load requests.');
    } finally {
      if (mountedRef.current) setLoading(false);
    }
  };

  useEffect(() => {
    mountedRef.current = true;
    loadRequests();

    return () => {
      mountedRef.current = false;
    };
  }, []);

  const approve = async (followerId) => {
    const actionKey = `approve-follow-${followerId}`;
    if (processingKey) return;

    try {
      setProcessingKey(actionKey);
      await creatorApi.approveFollowRequest(followerId);
      if (!mountedRef.current) return;
      setRequests((prev) => prev.filter((item) => item.followerId !== followerId));
      setStatus('Request approved.');
    } catch (err) {
      console.error(err);
      if (mountedRef.current) setStatus('Failed to approve request.');
    } finally {
      if (mountedRef.current) setProcessingKey('');
    }
  };

  const reject = async (followerId) => {
    const actionKey = `reject-follow-${followerId}`;
    if (processingKey) return;

    try {
      setProcessingKey(actionKey);
      await creatorApi.rejectFollowRequest(followerId);
      if (!mountedRef.current) return;
      setRequests((prev) => prev.filter((item) => item.followerId !== followerId));
      setStatus('Request rejected.');
    } catch (err) {
      console.error(err);
      if (mountedRef.current) setStatus('Failed to reject request.');
    } finally {
      if (mountedRef.current) setProcessingKey('');
    }
  };

  const acceptInvite = async (roomId) => {
    const actionKey = `accept-invite-${roomId}`;
    if (processingKey) return;

    try {
      setProcessingKey(actionKey);
      await creatorApi.acceptRoomInvite(roomId);
      if (!mountedRef.current) return;
      setRoomInvites((prev) => prev.filter((r) => r.roomId !== roomId));
      setStatus('Joined room successfully.');
    } catch (err) {
      console.error(err);
      if (mountedRef.current) setStatus('Failed to accept invite.');
    } finally {
      if (mountedRef.current) setProcessingKey('');
    }
  };

  const declineInvite = async (roomId) => {
    const actionKey = `decline-invite-${roomId}`;
    if (processingKey) return;

    try {
      setProcessingKey(actionKey);
      await creatorApi.declineRoomInvite(roomId);
      if (!mountedRef.current) return;
      setRoomInvites((prev) => prev.filter((r) => r.roomId !== roomId));
      setStatus('Invite declined.');
    } catch (err) {
      console.error(err);
      if (mountedRef.current) setStatus('Failed to decline invite.');
    } finally {
      if (mountedRef.current) setProcessingKey('');
    }
  };

  const approveRoomJoinRequest = async (roomId, requestUserId) => {
    const actionKey = `approve-room-${roomId}-${requestUserId}`;
    if (processingKey) return;

    try {
      setProcessingKey(actionKey);
      await roomApi.approveRoomJoinRequest(roomId, requestUserId);
      if (!mountedRef.current) return;
      setRoomJoinRequests((prev) =>
        prev.filter(
          (request) =>
            !(request.roomId === roomId && request.userId === requestUserId)
        )
      );
      setStatus('Room join request approved.');
    } catch (err) {
      console.error(err);
      if (mountedRef.current) setStatus('Failed to approve room request.');
    } finally {
      if (mountedRef.current) setProcessingKey('');
    }
  };

  const rejectRoomJoinRequest = async (roomId, requestUserId) => {
    const actionKey = `reject-room-${roomId}-${requestUserId}`;
    if (processingKey) return;

    try {
      setProcessingKey(actionKey);
      if (roomApi.rejectRoomJoinRequest) {
        await roomApi.rejectRoomJoinRequest(roomId, requestUserId);
      }

      if (!mountedRef.current) return;
      setRoomJoinRequests((prev) =>
        prev.filter(
          (request) =>
            !(request.roomId === roomId && request.userId === requestUserId)
        )
      );
      setStatus('Room join request rejected.');
    } catch (err) {
      console.error(err);
      if (mountedRef.current) setStatus('Failed to reject room request.');
    } finally {
      if (mountedRef.current) setProcessingKey('');
    }
  };

  return (
    <main className="follow-requests-page">
      <section className="follow-requests-header">
        <span>Creator privacy</span>
        <h1>Follow Requests</h1>
        <p>Approve users before they can view your private posts.</p>
      </section>

      {status && <p className="request-status">{status}</p>}

      {/* 🔥 ROOM JOIN REQUESTS TO APPROVE */}
      {!loading && roomJoinRequests.length > 0 && (
        <section className="request-list">
          <h2>Room Join Requests</h2>
          {roomJoinRequests.map((request, index) => {
            const requestUserId = request.userId || request.requestUserId || request.followerId;
            const requestKey = `${request.roomId}-${requestUserId || index}`;
            return (
            <article
              className="request-card"
              key={requestKey}
            >
              <div className="request-avatar">
                {(request.name || request.email || 'U')[0].toUpperCase()}
              </div>

              <div className="request-info">
                <h3>{request.name || 'User'}</h3>
                <p>{request.email || requestUserId}</p>
                <small>Wants to join {request.roomName || 'your room'}</small>
              </div>

              <div className="request-actions">
                <button
                  className="approve-btn"
                  type="button"
                  disabled={processingKey === `approve-room-${request.roomId}-${requestUserId}`}
                  onClick={() => approveRoomJoinRequest(request.roomId, requestUserId)}
                >
                  Approve
                </button>

                <button
                  className="reject-btn"
                  type="button"
                  disabled={processingKey === `reject-room-${request.roomId}-${requestUserId}`}
                  onClick={() => rejectRoomJoinRequest(request.roomId, requestUserId)}
                >
                  Reject
                </button>
              </div>
            </article>
            );
          })}
        </section>
      )}

      {/* 🔥 ROOM INVITES */}
      {!loading && roomInvites.length > 0 && (
        <section className="request-list">
          <h2>Room Invites</h2>
          {roomInvites.map((invite, index) => (
            <article className="request-card" key={invite.roomId || `invite-${index}`}>
              <div className="request-avatar">
                {(invite.roomName || 'R')[0].toUpperCase()}
              </div>

              <div className="request-info">
                <h3>{invite.roomName || 'Room'}</h3>
                <p>Invited by {invite.invitedByName || invite.invitedBy}</p>
              </div>

              <div className="request-actions">
                <button
                  className="approve-btn"
                  type="button"
                  disabled={processingKey === `accept-invite-${invite.roomId}`}
                  onClick={() => acceptInvite(invite.roomId)}
                >
                  Join
                </button>

                <button
                  className="reject-btn"
                  type="button"
                  disabled={processingKey === `decline-invite-${invite.roomId}`}
                  onClick={() => declineInvite(invite.roomId)}
                >
                  Decline
                </button>
              </div>
            </article>
          ))}
        </section>
      )}

      {loading ? (
        <p className="request-empty">Loading requests...</p>
      ) : requests.length === 0 && roomInvites.length === 0 && roomJoinRequests.length === 0 ? (
        <div className="request-empty-card">
          <h2>No pending requests</h2>
          <p>When someone requests access to your private posts, it will appear here.</p>
        </div>
      ) : (
        <section className="request-list">
          {requests.map((request, index) => (
            <article className="request-card" key={request.followerId || `follow-${index}`}>
              <div className="request-avatar">
                {(request.followerName || request.followerEmail || 'U')[0].toUpperCase()}
              </div>

              <div className="request-info">
                <h3>{request.followerName || 'User'}</h3>
                <p>{request.followerEmail || request.followerId}</p>
                <small>
                  Requested{' '}
                  {request.createdAt
                    ? new Date(Number(request.createdAt)).toLocaleString()
                    : ''}
                </small>
              </div>

              <div className="request-actions">
                <button
                  className="approve-btn"
                  type="button"
                  disabled={processingKey === `approve-follow-${request.followerId}`}
                  onClick={() => approve(request.followerId)}
                >
                  Approve
                </button>

                <button
                  className="reject-btn"
                  type="button"
                  disabled={processingKey === `reject-follow-${request.followerId}`}
                  onClick={() => reject(request.followerId)}
                >
                  Reject
                </button>
              </div>
            </article>
          ))}
        </section>
      )}
    </main>
  );
}