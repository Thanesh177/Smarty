import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { creatorApi, postApi, userApi } from '../api/client';
import './CreatorDashboardPage.css';

export default function CreatorDashboardPage() {
  const navigate = useNavigate();
  const mountedRef = useRef(true);

  const [profile, setProfile] = useState(null);
  const [requests, setRequests] = useState([]);
  const [myPosts, setMyPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState('');
  const [contentLoading, setContentLoading] = useState(false);
  const [processingKey, setProcessingKey] = useState('');

  const loadDashboard = async () => {
    try {
      setLoading(true);
      setContentLoading(false);
      setStatus('');

      const me = await userApi.getMe();
      if (!mountedRef.current) return;

      setProfile(me || null);
      setLoading(false);
      setContentLoading(true);

      const [requestResult, postsResult] = await Promise.allSettled([
        creatorApi.getFollowRequests(),
        postApi.getMyReels(),
      ]);

      if (!mountedRef.current) return;

      if (requestResult.status === 'fulfilled') {
        const requestData = requestResult.value;
        setRequests(
          Array.isArray(requestData?.requests)
            ? requestData.requests
            : Array.isArray(requestData)
              ? requestData
              : []
        );
      } else {
        console.error('Failed to load creator requests:', requestResult.reason);
      }

      if (postsResult.status === 'fulfilled') {
        const postsData = postsResult.value;
        setMyPosts(
          Array.isArray(postsData?.posts)
            ? postsData.posts
            : Array.isArray(postsData?.reels)
              ? postsData.reels
              : Array.isArray(postsData)
                ? postsData
                : []
        );
      } else {
        console.error('Failed to load creator posts:', postsResult.reason);
      }
    } catch (err) {
      console.error(err);
      if (mountedRef.current) setStatus('Failed to load creator dashboard.');
    } finally {
      if (mountedRef.current) {
        setLoading(false);
        setContentLoading(false);
      }
    }
  };

  useEffect(() => {
    mountedRef.current = true;
    loadDashboard();

    return () => {
      mountedRef.current = false;
    };
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
    if (!followerId || processingKey) return;

    const actionKey = `approve-${followerId}`;

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
    if (!followerId || processingKey) return;

    const actionKey = `reject-${followerId}`;

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

  const approveAll = async () => {
    const pendingIds = requests.map((item) => item.followerId).filter(Boolean);
    if (pendingIds.length === 0 || processingKey) return;

    try {
      setProcessingKey('approve-all');
      const results = await Promise.allSettled(
        pendingIds.map((followerId) => creatorApi.approveFollowRequest(followerId))
      );

      if (!mountedRef.current) return;

      const approvedIds = new Set(
        pendingIds.filter((_, index) => results[index]?.status === 'fulfilled')
      );

      setRequests((prev) => prev.filter((item) => !approvedIds.has(item.followerId)));

      const failedCount = results.filter((result) => result.status === 'rejected').length;
      setStatus(failedCount ? `${approvedIds.size} approved, ${failedCount} failed.` : 'All requests approved.');
    } catch (err) {
      console.error(err);
      if (mountedRef.current) setStatus('Failed to approve all requests.');
    } finally {
      if (mountedRef.current) setProcessingKey('');
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

        <button className="dashboard-primary" type="button" onClick={() => navigate('/create')}>
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
              <button className="small-action" type="button" disabled={processingKey === 'approve-all'} onClick={approveAll}>
                Approve All
              </button>
            )}
          </div>

          {contentLoading ? (
            <div className="dashboard-empty">
              <h3>Loading requests...</h3>
              <p>Checking for pending access requests.</p>
            </div>
          ) : requests.length === 0 ? (
            <div className="dashboard-empty">
              <h3>No pending requests</h3>
              <p>New requests will appear here.</p>
            </div>
          ) : (
            <div className="request-list">
              {requests.map((request, index) => {
                const followerId = request.followerId || request.userId || request.id;
                return (
                <article className="request-row" key={followerId || `request-${index}`}>
                  <div className="request-avatar">
                    {(request.followerName || request.followerEmail || 'U')[0].toUpperCase()}
                  </div>

                  <div>
                    <h3>{request.followerName || 'User'}</h3>
                    <p>{request.followerEmail || followerId}</p>
                  </div>

                  <div className="request-actions">
                    <button type="button" disabled={processingKey === `approve-${followerId}`} onClick={() => approve(followerId)}>Approve</button>
                    <button type="button" className="muted" disabled={processingKey === `reject-${followerId}`} onClick={() => reject(followerId)}>
                      Reject
                    </button>
                  </div>
                </article>
                );
              })}
            </div>
          )}
        </div>

        <div className="dashboard-panel">
          <h2>Profile</h2>
          <p className="profile-mini">{profile?.email || profile?.username || 'Creator'}</p>

          <button
            className="dashboard-secondary"
            disabled={!(profile?.id || profile?.userId || profile?.sub)}
            onClick={() => {
              const profileId = profile?.id || profile?.userId || profile?.sub;
              if (profileId) navigate(`/creator/${profileId}`);
            }}
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

        {contentLoading ? (
          <div className="dashboard-empty">
            <h3>Loading posts...</h3>
            <p>Fetching your latest posts.</p>
          </div>
        ) : myPosts.length === 0 ? (
          <div className="dashboard-empty">
            <h3>No posts yet</h3>
            <p>Create your first educational post.</p>
          </div>
        ) : (
          <div className="dashboard-post-grid">
            {myPosts.map((post, index) => {
              const postId = post.id || post.reelId;
              const isPrivate =
                post.visibility === 'private' ||
                post.isPrivate === true ||
                post.private === true;

              return (
                <button
                  key={postId || `dashboard-post-${index}`}
                  className="dashboard-post-card"
                  type="button"
                  disabled={!postId}
                  onClick={() => postId && navigate(`/reel/${postId}`)}
                >
                  {post.imageUrl ? (
                    <img
                      src={post.imageUrl}
                      alt={post.title || 'Post'}
                      loading={index < 4 ? 'eager' : 'lazy'}
                      decoding="async"
                      fetchpriority={index < 4 ? 'high' : 'auto'}
                    />
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