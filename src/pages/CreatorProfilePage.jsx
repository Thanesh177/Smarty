import { useParams, useNavigate } from 'react-router-dom';
import { useState, useEffect, useRef } from 'react';
import { creatorApi, postApi } from '../api/client';
import './CreatorProfile.css';

export default function CreatorProfilePage() {
  const { userId } = useParams();
  const navigate = useNavigate();
  const mountedRef = useRef(true);

  const [profile, setProfile] = useState(null);
  const [creatorPosts, setCreatorPosts] = useState([]);
  const [followers, setFollowers] = useState([]);
  const [following, setFollowing] = useState([]);
  const [activeTab, setActiveTab] = useState('posts');
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [postsLoading, setPostsLoading] = useState(false);

  const displayName =
    profile?.name ||
    profile?.username ||
    profile?.email ||
    (userId?.length > 20 ? `Creator_${userId.substring(0, 5)}` : userId);

  useEffect(() => {
    mountedRef.current = true;

    async function loadCreatorData() {
      setLoading(true);
      setPostsLoading(false);

      try {
        const profileData = await creatorApi.getProfile(userId);
        if (!mountedRef.current) return;

        setProfile(profileData || null);
        setLoading(false);
        setPostsLoading(true);

        const [followersResult, followingResult, postsResult] = await Promise.allSettled([
          creatorApi.getFollowers(userId),
          creatorApi.getFollowing(userId),
          postApi.getPostsByCreator(userId),
        ]);

        if (!mountedRef.current) return;

        if (followersResult.status === 'fulfilled') {
          const followersData = followersResult.value;
          setFollowers(
            Array.isArray(followersData?.followers)
              ? followersData.followers
              : Array.isArray(followersData)
                ? followersData
                : []
          );
        }

        if (followingResult.status === 'fulfilled') {
          const followingData = followingResult.value;
          setFollowing(
            Array.isArray(followingData?.following)
              ? followingData.following
              : Array.isArray(followingData)
                ? followingData
                : []
          );
        }

        if (postsResult.status === 'fulfilled') {
          const posts = postsResult.value;
          setCreatorPosts(
            Array.isArray(posts?.posts)
              ? posts.posts
              : Array.isArray(posts?.reels)
                ? posts.reels
                : Array.isArray(posts)
                  ? posts
                  : []
          );
        }
      } catch (err) {
        console.error('Error fetching creator data:', err);
        if (mountedRef.current) setLoading(false);
      } finally {
        if (mountedRef.current) setPostsLoading(false);
      }
    }

    if (userId) loadCreatorData();

    return () => {
      mountedRef.current = false;
    };
  }, [userId]);

  const handleStartChat = () => {
    if (!userId) return;

    navigate('/chat', {
      state: {
        startWithUser: {
          userId,
          id: userId,
          sub: userId,
          email: profile?.email || '',
          username: profile?.username || profile?.email || userId,
          name: displayName,
        },
      },
    });
  };

const handleFollow = async () => {
  if (!profile || !userId || actionLoading || profile.requestPending) return;

  setActionLoading(true);

  try {
    if (profile.isFollowing) {
      await creatorApi.unfollow(userId);
      if (!mountedRef.current) return;

      setProfile((prev) => ({
        ...prev,
        isFollowing: false,
        requestPending: false,
        followersCount: Math.max(0, Number(prev?.followersCount || 0) - 1),
      }));

      return;
    }

    await creatorApi.follow(userId);
    if (!mountedRef.current) return;

    setProfile((prev) => ({
      ...prev,
      requestPending: true,
      isFollowing: false,
    }));
  } catch (err) {
    console.error(err);
  } finally {
    if (mountedRef.current) setActionLoading(false);
  }
};

const getFollowButtonText = () => {
  if (actionLoading) return 'Please wait...';
  if (profile?.requestPending) return 'Requested';
  if (profile?.isFollowing) return 'Following';
  return 'Follow';
};

  if (loading) {
    return (
      <main className="creator-profile-container">
        <div className="profile-card">
          <p className="skeleton-loader">Loading creator profile...</p>
        </div>
      </main>
    );
  }

  return (
    <main className="creator-profile-container">
      <div className="profile-card">
        <button className="back-link" onClick={() => navigate(-1)}>
          ← Back to Feed
        </button>

        <header className="profile-header">
          <div className="avatar-wrapper">
            {profile?.avatarUrl ? (
              <img
                className="avatar-large image-avatar"
                src={profile.avatarUrl}
                alt={displayName}
                loading="eager"
                decoding="async"
                fetchpriority="high"
                referrerPolicy="no-referrer"
              />
            ) : (
              <div className="avatar-large">
                {displayName?.[0]?.toUpperCase() || 'C'}
              </div>
            )}

            <div className="online-status" />
          </div>

          <div className="profile-info">
            <h2>{displayName}</h2>
            <p className="profile-id">ID: {userId.substring(0, 8)}...</p>
            <p className="bio">
              {profile?.bio || 'Curated Educational Content & Expert Insights'}
            </p>
          </div>

          <div className="profile-actions">
            <button className="btn-primary" onClick={handleStartChat}>
              💬 Message
            </button>

            {!profile?.isMe && (
              <button
                className={profile?.isFollowing ? 'btn-secondary following' : 'btn-secondary'}
                onClick={handleFollow}
                disabled={actionLoading || profile?.requestPending}
              >
                {getFollowButtonText()}
              </button>
            )}
          </div>
        </header>

        <div className="stats-bar">
          <button className="stat" onClick={() => setActiveTab('posts')}>
            <strong>{creatorPosts.length || profile?.postsCount || profile?.reelsCount || 0}</strong>
            posts
          </button>

          <button className="stat" onClick={() => setActiveTab('followers')}>
            <strong>{followers.length || profile?.followersCount || 0}</strong>
            followers
          </button>

          <button className="stat" onClick={() => setActiveTab('following')}>
            <strong>{following.length || profile?.followingCount || 0}</strong>
            following
          </button>
        </div>

        {activeTab === 'posts' && (
          <section className="posts-section">
            <h3>Recent Contributions</h3>

            {postsLoading ? (
              <div className="empty-state">
                <p>Loading posts...</p>
              </div>
            ) : creatorPosts.length > 0 ? (
              <div className="creator-grid">
                {creatorPosts.map((post, index) => {
                  const postId = post.id || post.reelId;

                  return (
                    <button
                      key={postId || `creator-post-${index}`}
                      className="mini-post-card"
                      type="button"
                      disabled={!postId}
                      onClick={() => postId && navigate(`/reel/${postId}`)}
                    >
                      {post.imageUrl ? (
                        <img
                          src={post.imageUrl}
                          alt={post.title || 'Creator post'}
                          loading={index < 4 ? 'eager' : 'lazy'}
                          decoding="async"
                          fetchpriority={index < 4 ? 'high' : 'auto'}
                        />
                      ) : (
                        <div className="mini-placeholder">
                          {post.topic?.[0] || 'S'}
                        </div>
                      )}

                      <div className="mini-card-overlay">
                        <span>{post.topic}</span>
                        <h4>{post.title}</h4>
                      </div>
                    </button>
                  );
                })}
              </div>
            ) : (
              <div className="empty-state">
                <p>This creator has not posted anything yet.</p>
              </div>
            )}
          </section>
        )}

        {activeTab === 'followers' && (
          <section className="posts-section">
            <h3>Followers</h3>

            {followers.length > 0 ? (
              <div className="people-list">
                {followers.map((item, index) => {
                  const id = item.userId || item.followerId;

                  return (
                    <button key={id || `follower-${index}`} disabled={!id} onClick={() => id && navigate(`/creator/${id}`)}>
                      <strong>{item.name || item.email || id}</strong>
                      <span>{item.email || 'Follower'}</span>
                    </button>
                  );
                })}
              </div>
            ) : (
              <div className="empty-state">
                <p>No followers yet.</p>
              </div>
            )}
          </section>
        )}

        {activeTab === 'following' && (
          <section className="posts-section">
            <h3>Following</h3>

            {following.length > 0 ? (
              <div classNfame="people-list">
                {following.map((item, index) => {
                  const id = item.userId || item.followingId;

                  return (
                    <button key={id || `following-${index}`} disabled={!id} onClick={() => id && navigate(`/creator/${id}`)}>
                      <strong>{item.name || item.email || id}</strong>
                      <span>{item.email || 'Following'}</span>
                    </button>
                  );
                })}
              </div>
            ) : (
              <div className="empty-state">
                <p>This creator is not following anyone yet.</p>
              </div>
            )}
          </section>
        )}
      </div>
    </main>
  );
}