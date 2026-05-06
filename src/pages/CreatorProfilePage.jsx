import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { creatorApi, postApi } from '../api/client';
import './CreatorProfile.css';

const CreatorPostCard = memo(function CreatorPostCard({ post, index, onOpen }) {
  const postId = post.id || post.reelId;

  return (
    <button
      className="mini-post-card"
      type="button"
      disabled={!postId}
      onClick={() => onOpen(postId)}
    >
      {post.imageUrl ? (
        <img
          src={post.imageUrl}
          alt={post.title || 'Creator post'}
          loading={index < 2 ? 'eager' : 'lazy'}
          decoding="async"
          fetchPriority={index < 2 ? 'high' : 'auto'}
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
});

const PersonRow = memo(function PersonRow({ item, fallbackLabel, onOpen }) {
  const id = item.userId || item.followerId || item.followingId;

  return (
    <button disabled={!id} onClick={() => onOpen(id)}>
      <strong>{item.name || item.email || id}</strong>
      <span>{item.email || fallbackLabel}</span>
    </button>
  );
});

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

  const displayName = useMemo(
    () =>
      profile?.name ||
      profile?.username ||
      profile?.email ||
      (userId?.length > 20 ? `Creator_${userId.substring(0, 5)}` : userId),
    [profile, userId]
  );

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

  const handleStartChat = useCallback(() => {
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
  }, [displayName, navigate, profile, userId]);

  const handleFollow = useCallback(async () => {
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
  }, [actionLoading, profile, userId]);

  const followButtonText = useMemo(() => {
    if (actionLoading) return 'Please wait...';
    if (profile?.requestPending) return 'Requested';
    if (profile?.isFollowing) return 'Following';
    return 'Follow';
  }, [actionLoading, profile]);

  const goBack = useCallback(() => {
    navigate(-1);
  }, [navigate]);

  const openCreator = useCallback(
    (id) => {
      if (id) navigate(`/creator/${id}`);
    },
    [navigate]
  );

  const openPost = useCallback(
    (postId) => {
      if (postId) navigate(`/reel/${postId}`);
    },
    [navigate]
  );

  const showPosts = useCallback(() => {
    setActiveTab('posts');
  }, []);

  const showFollowers = useCallback(() => {
    setActiveTab('followers');
  }, []);

  const showFollowing = useCallback(() => {
    setActiveTab('following');
  }, []);

  const renderedPosts = useMemo(
    () => creatorPosts.map((post, index) => (
      <CreatorPostCard
        key={post.id || post.reelId || `creator-post-${index}`}
        post={post}
        index={index}
        onOpen={openPost}
      />
    )),
    [creatorPosts, openPost]
  );

  const renderedFollowers = useMemo(
    () => followers.map((item, index) => (
      <PersonRow
        key={item.userId || item.followerId || `follower-${index}`}
        item={item}
        fallbackLabel="Follower"
        onOpen={openCreator}
      />
    )),
    [followers, openCreator]
  );

  const renderedFollowing = useMemo(
    () => following.map((item, index) => (
      <PersonRow
        key={item.userId || item.followingId || `following-${index}`}
        item={item}
        fallbackLabel="Following"
        onOpen={openCreator}
      />
    )),
    [following, openCreator]
  );

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
        <button className="back-link" onClick={goBack}>
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
                fetchPriority="high"
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
                {followButtonText}
              </button>
            )}
          </div>
        </header>

        <div className="stats-bar">
          <button className="stat" onClick={showPosts}>
            <strong>{creatorPosts.length || profile?.postsCount || profile?.reelsCount || 0}</strong>
            posts
          </button>

          <button className="stat" onClick={showFollowers}>
            <strong>{followers.length || profile?.followersCount || 0}</strong>
            followers
          </button>

          <button className="stat" onClick={showFollowing}>
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
                {renderedPosts}
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
                {renderedFollowers}
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
              <div className="people-list">
                {renderedFollowing}
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