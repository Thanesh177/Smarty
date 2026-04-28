import { useEffect, useState } from 'react';
import { creatorApi } from '../api/client';
import './FollowRequestsPage.css';

export default function FollowRequestsPage() {
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState('');

  const loadRequests = async () => {
    try {
      setLoading(true);
      const data = await creatorApi.getFollowRequests();
      setRequests(Array.isArray(data) ? data : []);
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

  return (
    <main className="follow-requests-page">
      <section className="follow-requests-header">
        <span>Creator privacy</span>
        <h1>Follow Requests</h1>
        <p>Approve users before they can view your private posts.</p>
      </section>

      {status && <p className="request-status">{status}</p>}

      {loading ? (
        <p className="request-empty">Loading requests...</p>
      ) : requests.length === 0 ? (
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