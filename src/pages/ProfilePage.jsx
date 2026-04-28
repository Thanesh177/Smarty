import { useEffect, useMemo, useState } from 'react';
import { userApi, postApi, creatorApi } from '../api/client';
import { useNavigate } from 'react-router-dom';
import './ProfilePage.css';

export default function ProfilePage() {
  const navigate = useNavigate();

  const [profile, setProfile] = useState(null);
  const [tab, setTab] = useState('overview');
  const [myPosts, setMyPosts] = useState([]);
  const [following, setFollowing] = useState([]);
  const [selectedCreator, setSelectedCreator] = useState(null);
  const [creatorPrivatePosts, setCreatorPrivatePosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadingCreator, setLoadingCreator] = useState(false);
  const [status, setStatus] = useState('');

  useEffect(() => {
    loadProfileData();
  }, []);

  const loadProfileData = async () => {
    try {
      setLoading(true);

      const me = await userApi.getMe();
      setProfile(me);

      const [posts, followingData] = await Promise.all([
        postApi.getMyReels(),
        creatorApi.getFollowing(me.id || me.userId || me.sub),
      ]);

      setMyPosts(Array.isArray(posts) ? posts : []);
      setFollowing(Array.isArray(followingData) ? followingData : []);
    } catch (err) {
      console.error(err);
      setStatus('Failed to load profile.');
    } finally {
      setLoading(false);
    }
  };

  const myPrivatePosts = useMemo(() => {
    return myPosts.filter(
      (item) =>
        item.visibility === 'private' ||
        item.isPrivate === true ||
        item.private === true
    );
  }, [myPosts]);

  const initials = useMemo(() => {
    if (!profile?.name) return 'U';

    const parts = profile.name.trim().split(' ');
    const first = parts[0]?.[0] || '';
    const second = parts[1]?.[0] || '';

    return `${first}${second}`.toUpperCase();
  }, [profile]);

  const openApprovedCreator = async (creator) => {
    const creatorId = creator.userId || creator.followingId;

    if (!creatorId) return;

    try {
      setLoadingCreator(true);
      setSelectedCreator(creator);
      setTab('approved-private');

      const [creatorProfile, posts] = await Promise.all([
        creatorApi.getProfile(creatorId),
        postApi.getCreatorPrivatePosts(creatorId)
      ]);

      setSelectedCreator({
        ...creator,
        ...creatorProfile,
        userId: creatorId,
      });

      const privateOnly = (posts || []).filter(
        (post) =>
          post.visibility === 'private' ||
          post.isPrivate === true ||
          post.private === true
      );

      setCreatorPrivatePosts(privateOnly);
    } catch (err) {
      console.error(err);
      setStatus('Could not load creator private posts.');
    } finally {
      setLoadingCreator(false);
    }
  };

  if (loading) {
    return (
      <main className="profile-page">
        <p className="status">Loading profile...</p>
      </main>
    );
  }

  if (!profile) {
    return (
      <main className="profile-page">
        <p className="status">Profile not found.</p>
      </main>
    );
  }

  const stats = [
    { label: 'Saved', value: profile.savedCount ?? 0 },
    { label: 'Posts', value: myPosts.length },
    { label: 'Following', value: following.length },
  ];

  return (
    <main className="profile-page">
      <section className="profile-hero">
        <div className="profile-left">
          <div className="avatar-xl">{initials}</div>

          <div>
            <span className="profile-pill">Your profile</span>
            <h1>{profile.name || profile.email || 'User'}</h1>
            <p className="profile-email">{profile.email}</p>

            <p className="profile-bio">
              {profile.bio ||
                'Curious mind exploring psychology, science, technology, and practical knowledge.'}
            </p>
          </div>
        </div>

        <div className="profile-stats">
          {stats.map((item) => (
            <div key={item.label} className="stat-card">
              <strong>{item.value}</strong>
              <span>{item.label}</span>
            </div>
          ))}
        </div>
      </section>

      {status && <p className="status">{status}</p>}

      <section className="profile-tabs">
        <button
          className={tab === 'overview' ? 'active' : ''}
          onClick={() => setTab('overview')}
        >
          Overview
        </button>

        <button
          className={tab === 'private' ? 'active' : ''}
          onClick={() => setTab('private')}
        >
          My Private Posts
        </button>

        <button
          className={tab === 'approved' || tab === 'approved-private' ? 'active' : ''}
          onClick={() => setTab('approved')}
        >
          Approved Creators
        </button>
      </section>

      {tab === 'overview' && (
        <section className="profile-content">
          <div className="profile-card">
            <h3>About</h3>
            <p>
              Smarty helps users learn through scrollable educational content.
              Build your personal feed, save useful reels, and publish ideas worth sharing.
            </p>
          </div>

          <div className="profile-card">
            <h3>Account Details</h3>

            <div className="detail-row">
              <span>Name</span>
              <strong>{profile.name || 'Not set'}</strong>
            </div>

            <div className="detail-row">
              <span>Email</span>
              <strong>{profile.email || 'Not set'}</strong>
            </div>

            <div className="detail-row">
              <span>Status</span>
              <strong>Active</strong>
            </div>
          </div>

          <div className="profile-card">
            <h3>Creator Tip</h3>
            <p>
              Short, useful, and memorable content performs best.
              Teach one strong idea at a time.
            </p>
          </div>
        </section>
      )}

      {tab === 'private' && (
        <section className="profile-private-posts">
          {myPrivatePosts.length === 0 ? (
            <p className="status">No private posts found.</p>
          ) : (
            <div className="private-grid">
              {myPrivatePosts.map((post) => {
                const postId = post.id || post.reelId;

                return (
                  <button
                    key={postId}
                    className="private-card"
                    type="button"
                    onClick={() => navigate(`/reel/${postId}`)}
                  >
                    {post.imageUrl ? (
                      <img src={post.imageUrl} alt={post.title} />
                    ) : (
                      <div className="private-placeholder">{post.topic?.[0] || 'S'}</div>
                    )}

                    <div className="private-info">
                      <h4>{post.title}</h4>
                      <span>🔒 Private</span>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </section>
      )}

      {tab === 'approved' && (
        <section className="profile-private-posts">
          {following.length === 0 ? (
            <p className="status">No approved creators yet.</p>
          ) : (
            <div className="approved-creators-list">
              {following.map((creator) => {
                const creatorId = creator.userId || creator.followingId;

                return (
                  <button
                    key={creatorId}
                    type="button"
                    className="approved-creator-card"
                    onClick={() => openApprovedCreator(creator)}
                  >
                    <div className="approved-avatar">
                      {(creator.name || creator.email || 'C')[0].toUpperCase()}
                    </div>

                    <div>
                      <h4>{creator.name || creator.email || creatorId}</h4>
                      <p>{creator.email || 'Approved creator'}</p>
                    </div>

                    <span>View private posts →</span>
                  </button>
                );
              })}
            </div>
          )}
        </section>
      )}

      {tab === 'approved-private' && (
        <section className="profile-private-posts">
          <button className="back-link" type="button" onClick={() => setTab('approved')}>
            ← Back to approved creators
          </button>

          <div className="creator-private-header">
            <div>
              <h3>{selectedCreator?.name || selectedCreator?.email || 'Creator'}</h3>
              <p>{selectedCreator?.bio || selectedCreator?.email}</p>
            </div>

            <button
              className="view-profile-btn"
              type="button"
              onClick={() => navigate(`/creator/${selectedCreator?.userId}`)}
            >
              View Profile
            </button>
          </div>

          {loadingCreator ? (
            <p className="status">Loading creator private posts...</p>
          ) : creatorPrivatePosts.length === 0 ? (
            <p className="status">No private posts available from this creator.</p>
          ) : (
            <div className="private-grid">
              {creatorPrivatePosts.map((post) => {
                const postId = post.id || post.reelId;

                return (
                  <button
                    key={postId}
                    className="private-card"
                    type="button"
                    onClick={() => navigate(`/reel/${postId}`)}
                  >
                    {post.imageUrl ? (
                      <img src={post.imageUrl} alt={post.title} />
                    ) : (
                      <div className="private-placeholder">{post.topic?.[0] || 'S'}</div>
                    )}

                    <div className="private-info">
                      <h4>{post.title}</h4>
                      <span>🔓 Approved access</span>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </section>
      )}
    </main>
  );
}