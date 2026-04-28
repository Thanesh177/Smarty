import { useParams, useNavigate } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { creatorApi, postApi } from '../api/client';
import './CreatorProfile.css';

export default function CreatorProfilePage() {
  const { userId } = useParams();
  const navigate = useNavigate();

  const [profile, setProfile] = useState(null);
  const [creatorPosts, setCreatorPosts] = useState([]);
  const [followers, setFollowers] = useState([]);
  const [following, setFollowing] = useState([]);
  const [activeTab, setActiveTab] = useState('posts');
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);

  const displayName =
    profile?.name ||
    profile?.username ||
    profile?.email ||
    (userId?.length > 20 ? `Creator_${userId.substring(0, 5)}` : userId);

  useEffect(() => {
    async function loadCreatorData() {
      setLoading(true);

      try {
        const [profileData, followersData, followingData] = await Promise.all([
          creatorApi.getProfile(userId),
          creatorApi.getFollowers(userId),
          creatorApi.getFollowing(userId),
        ]);

        setProfile(profileData);
        setFollowers(followersData || []);
        setFollowing(followingData || []);

        const posts = await postApi.getPostsByCreator(userId);
        setCreatorPosts(posts || []);
      } catch (err) {
        console.error('Error fetching creator data:', err);
      } finally {
        setLoading(false);
      }
    }

    if (userId) loadCreatorData();
  }, [userId]);

  const handleStartChat = () => {
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
  if (!profile || actionLoading || profile.requestPending) return;

  setActionLoading(true);

  try {
    if (profile.isFollowing) {
      await creatorApi.unfollow(userId);

      setProfile((prev) => ({
        ...prev,
        isFollowing: false,
        requestPending: false,
      }));

      return;
    }

    // always send request first
    await creatorApi.follow(userId);

    setProfile((prev) => ({
      ...prev,
      requestPending: true,
      isFollowing: false,
    }));
  } catch (err) {
    console.error(err);
  } finally {
    setActionLoading(false);
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
            <strong>{creatorPosts.length || profile?.postsCount || 0}</strong>
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

            {creatorPosts.length > 0 ? (
              <div className="creator-grid">
                {creatorPosts.map((post) => {
                  const postId = post.id || post.reelId;

                  return (
                    <button
                      key={postId}
                      className="mini-post-card"
                      type="button"
                      onClick={() => navigate(`/reel/${postId}`)}
                    >
                      {post.imageUrl ? (
                        <img src={post.imageUrl} alt={post.title} />
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
                {followers.map((item) => {
                  const id = item.userId || item.followerId;

                  return (
                    <button key={id} onClick={() => navigate(`/creator/${id}`)}>
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
              <div className="people-list">
                {following.map((item) => {
                  const id = item.userId || item.followingId;

                  return (
                    <button key={id} onClick={() => navigate(`/creator/${id}`)}>
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