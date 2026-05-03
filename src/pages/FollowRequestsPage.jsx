import { useEffect, useState } from 'react';
import { creatorApi, roomApi } from '../api/client';
import './FollowRequestsPage.css';

export default function FollowRequestsPage() {
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState('');
  const [roomInvites, setRoomInvites] = useState([]);
  const [roomJoinRequests, setRoomJoinRequests] = useState([]);

  const loadRequests = async () => {
    try {
      setLoading(true);
      const data = await creatorApi.getFollowRequests();
      setRequests(Array.isArray(data) ? data : []);

      // 🔥 Load room invites
      try {
        const inviteData = await creatorApi.getRoomInvites();
        setRoomInvites(Array.isArray(inviteData) ? inviteData : []);
      } catch (err) {
        console.error('Failed to load room invites', err);
      }

      // 🔥 Load room join requests for rooms created by this user
      try {
        const roomsData = await roomApi.getRooms({ search: '' });
        const allRooms = roomsData.rooms || roomsData || [];
        const ownedRooms = allRooms.filter(
          (room) => room.ownerId || room.createdBy
        );

        const requestsByRoom = await Promise.all(
          ownedRooms.map(async (room) => {
            try {
              const requestData = await roomApi.getRoomJoinRequests(room.roomId);
              const roomRequests = requestData.requests || requestData || [];

              return roomRequests.map((request) => ({
                ...request,
                roomId: room.roomId,
                roomName: room.name,
              }));
            } catch (err) {
              console.error('Failed to load join requests for room', room.roomId, err);
              return [];
            }
          })
        );

        setRoomJoinRequests(requestsByRoom.flat());
      } catch (err) {
        console.error('Failed to load room join requests', err);
      }
    } catch (err) {
      console.error(err);
      setStatus('Failed to load follow requests.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadRequests();
  }, []);

  const approve = async (followerId) => {
    try {
      await creatorApi.approveFollowRequest(followerId);
      setRequests((prev) => prev.filter((item) => item.followerId !== followerId));
      setStatus('Request approved.');
    } catch (err) {
      console.error(err);
      setStatus('Failed to approve request.');
    }
  };

  const reject = async (followerId) => {
    try {
      await creatorApi.rejectFollowRequest(followerId);
      setRequests((prev) => prev.filter((item) => item.followerId !== followerId));
      setStatus('Request rejected.');
    } catch (err) {
      console.error(err);
      setStatus('Failed to reject request.');
    }
  };

  const acceptInvite = async (roomId) => {
    try {
      await creatorApi.acceptRoomInvite(roomId);
      setRoomInvites((prev) => prev.filter((r) => r.roomId !== roomId));
      setStatus('Joined room successfully.');
    } catch (err) {
      console.error(err);
      setStatus('Failed to accept invite.');
    }
  };

  const declineInvite = async (roomId) => {
    try {
      await creatorApi.declineRoomInvite(roomId);
      setRoomInvites((prev) => prev.filter((r) => r.roomId !== roomId));
      setStatus('Invite declined.');
    } catch (err) {
      console.error(err);
      setStatus('Failed to decline invite.');
    }
  };

  const approveRoomJoinRequest = async (roomId, requestUserId) => {
    try {
      await roomApi.approveRoomJoinRequest(roomId, requestUserId);
      setRoomJoinRequests((prev) =>
        prev.filter(
          (request) =>
            !(request.roomId === roomId && request.userId === requestUserId)
        )
      );
      setStatus('Room join request approved.');
    } catch (err) {
      console.error(err);
      setStatus('Failed to approve room request.');
    }
  };

  const rejectRoomJoinRequest = async (roomId, requestUserId) => {
    try {
      if (roomApi.rejectRoomJoinRequest) {
        await roomApi.rejectRoomJoinRequest(roomId, requestUserId);
      }

      setRoomJoinRequests((prev) =>
        prev.filter(
          (request) =>
            !(request.roomId === roomId && request.userId === requestUserId)
        )
      );
      setStatus('Room join request rejected.');
    } catch (err) {
      console.error(err);
      setStatus('Failed to reject room request.');
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

          {roomJoinRequests.map((request) => (
            <article
              className="request-card"
              key={`${request.roomId}-${request.userId}`}
            >
              <div className="request-avatar">
                {(request.name || request.email || 'U')[0].toUpperCase()}
              </div>

              <div className="request-info">
                <h3>{request.name || 'User'}</h3>
                <p>{request.email || request.userId}</p>
                <small>Wants to join {request.roomName || 'your room'}</small>
              </div>

              <div className="request-actions">
                <button
                  className="approve-btn"
                  type="button"
                  onClick={() => approveRoomJoinRequest(request.roomId, request.userId)}
                >
                  Approve
                </button>

                <button
                  className="reject-btn"
                  type="button"
                  onClick={() => rejectRoomJoinRequest(request.roomId, request.userId)}
                >
                  Reject
                </button>
              </div>
            </article>
          ))}
        </section>
      )}

      {/* 🔥 ROOM INVITES */}
      {!loading && roomInvites.length > 0 && (
        <section className="request-list">
          <h2>Room Invites</h2>

          {roomInvites.map((invite) => (
            <article className="request-card" key={invite.roomId}>
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
                  onClick={() => acceptInvite(invite.roomId)}
                >
                  Join
                </button>

                <button
                  className="reject-btn"
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
          {requests.map((request) => (
            <article className="request-card" key={request.followerId}>
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
                  onClick={() => approve(request.followerId)}
                >
                  Approve
                </button>

                <button
                  className="reject-btn"
                  type="button"
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