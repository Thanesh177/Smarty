import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { creatorApi, postApi, userApi } from '../api/client';
import './CreatorDashboardPage.css';

export default function CreatorDashboardPage() {
  const navigate = useNavigate();

  const [profile, setProfile] = useState(null);
  const [requests, setRequests] = useState([]);
  const [myPosts, setMyPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState('');

  const loadDashboard = async () => {
    try {
      setLoading(true);

      const me = await userApi.getMe();
      setProfile(me);

      const [requestData, postsData] = await Promise.all([
        creatorApi.getFollowRequests(),
        postApi.getMyReels(),
      ]);

      setRequests(Array.isArray(requestData) ? requestData : []);
      setMyPosts(Array.isArray(postsData) ? postsData : []);
    } catch (err) {
      console.error(err);
      setStatus('Failed to load creator dashboard.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDashboard();
  }, []);

  const privatePosts = useMemo(
    () =>
      myPosts.filter(
        (post) =>
          post.visibility === 'private' ||
          post.isPrivate === true ||
          post.private === true
      ),
    [myPosts]
  );

  const publicPosts = useMemo(
    () =>
      myPosts.filter(
        (post) =>
          post.visibility !== 'private' &&
          post.isPrivate !== true &&
          post.private !== true
      ),
    [myPosts]
  );

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

  const approveAll = async () => {
    try {
      await Promise.all(requests.map((item) => creatorApi.approveFollowRequest(item.followerId)));
      setRequests([]);
      setStatus('All requests approved.');
    } catch (err) {
      console.error(err);
      setStatus('Failed to approve all requests.');
    }
  };

  if (loading) {
    return (
      <main className="creator-dashboard-page">
        <p className="dashboard-status">Loading creator dashboard...</p>
      </main>
    );
  }

  return (
    <main className="creator-dashboard-page">
      <section className="dashboard-hero">
        <div>
          <span>Creator Center</span>
          <h1>Manage your learning audience</h1>
          <p>
            Review access requests, manage private posts, and track your creator activity.
          </p>
        </div>

        <button className="dashboard-primary" onClick={() => navigate('/create')}>
          Create New Post
        </button>
      </section>

      {status && <p className="dashboard-status">{status}</p>}

      <section className="dashboard-stats">
        <div>
          <strong>{myPosts.length}</strong>
          <span>Total Posts</span>
        </div>

        <div>
          <strong>{privatePosts.length}</strong>
          <span>Private Posts</span>
        </div>

        <div>
          <strong>{publicPosts.length}</strong>
          <span>Public Posts</span>
        </div>

        <div>
          <strong>{requests.length}</strong>
          <span>Pending Requests</span>
        </div>
      </section>

      <section className="dashboard-grid">
        <div className="dashboard-panel large">
          <div className="panel-head">
            <div>
              <h2>Follow Requests</h2>
              <p>Approve users before they can access your private posts.</p>
            </div>

            {requests.length > 0 && (
              <button className="small-action" onClick={approveAll}>
                Approve All
              </button>
            )}
          </div>

          {requests.length === 0 ? (
            <div className="dashboard-empty">
              <h3>No pending requests</h3>
              <p>New requests will appear here.</p>
            </div>
          ) : (
            <div className="request-list">
              {requests.map((request) => (
                <article className="request-row" key={request.followerId}>
                  <div className="request-avatar">
                    {(request.followerName || request.followerEmail || 'U')[0].toUpperCase()}
                  </div>

                  <div>
                    <h3>{request.followerName || 'User'}</h3>
                    <p>{request.followerEmail || request.followerId}</p>
                  </div>

                  <div className="request-actions">
                    <button onClick={() => approve(request.followerId)}>Approve</button>
                    <button className="muted" onClick={() => reject(request.followerId)}>
                      Reject
                    </button>
                  </div>
                </article>
              ))}
            </div>
          )}
        </div>

        <div className="dashboard-panel">
          <h2>Profile</h2>
          <p className="profile-mini">{profile?.email || profile?.username || 'Creator'}</p>

          <button
            className="dashboard-secondary"
            onClick={() => navigate(`/creator/${profile?.id || profile?.userId || profile?.sub}`)}
          >
            View Public Profile
          </button>
        </div>
      </section>

      <section className="dashboard-panel posts-panel">
        <div className="panel-head">
          <div>
            <h2>Your Posts</h2>
            <p>Open any post to preview it.</p>
          </div>
        </div>

        {myPosts.length === 0 ? (
          <div className="dashboard-empty">
            <h3>No posts yet</h3>
            <p>Create your first educational post.</p>
          </div>
        ) : (
          <div className="dashboard-post-grid">
            {myPosts.map((post) => {
              const postId = post.id || post.reelId;
              const isPrivate =
                post.visibility === 'private' ||
                post.isPrivate === true ||
                post.private === true;

              return (
                <button
                  key={postId}
                  className="dashboard-post-card"
                  onClick={() => navigate(`/reel/${postId}`)}
                >
                  {post.imageUrl ? (
                    <img src={post.imageUrl} alt={post.title} />
                  ) : (
                    <div className="dashboard-post-placeholder">
                      {post.topic?.[0] || 'S'}
                    </div>
                  )}

                  <div>
                    <span>{isPrivate ? '🔒 Private' : '🌍 Public'}</span>
                    <h3>{post.title}</h3>
                    <p>{post.topic || 'Smarty'}</p>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </section>
    </main>
  );
}