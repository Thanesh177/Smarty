import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { userApi, postApi, creatorApi } from '../api/client';
import './ProfilePage.css';
function getPostImage(post) {
  return (
    post?.imageUrl ||
    post?.photoUrl ||
    post?.thumbnail ||
    post?.coverImage ||
    post?.image ||
    post?.mediaUrl ||
    ''
  );
}
export default function ProfilePage() {
  const navigate = useNavigate();

  const [profile, setProfile] = useState(null);
  const [tab, setTab] = useState('overview');
  const [myPosts, setMyPosts] = useState([]);
  const [following, setFollowing] = useState([]);
  const [creatorPrivatePosts, setCreatorPrivatePosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadingCreator, setLoadingCreator] = useState(false);
  const [status, setStatus] = useState('');

  const [editingProfile, setEditingProfile] = useState(false);
  const [newUsername, setNewUsername] = useState('');
  const [newPhoto, setNewPhoto] = useState(null);

  useEffect(() => {
    loadProfileData();
  }, []);

  const displayName = useMemo(() => {
    const raw = profile?.username || profile?.name || profile?.email || 'User';
    const value = String(raw).trim();

    if (value.includes('@')) return value.split('@')[0];

    if (value.includes('-') && value.length > 20) {
      return profile?.email ? profile.email.split('@')[0] : 'User';
    }

    return value || 'User';
  }, [profile]);

  const initials = useMemo(() => {
    return displayName.substring(0, 2).toUpperCase();
  }, [displayName]);

  async function loadProfileData() {
    try {
      setLoading(true);

      const me = await userApi.getMe();
      setProfile(me);

      const safeUsername =
        me.username && !String(me.username).includes('-')
          ? me.username
          : me.email?.split('@')[0] || me.name || '';

      setNewUsername(safeUsername);

      const userId = me.id || me.userId || me.sub;

      const [posts, followingData] = await Promise.all([
        postApi.getMyReels(),
        creatorApi.getFollowing(userId),
      ]);

      setMyPosts(Array.isArray(posts) ? posts : []);
      setFollowing(Array.isArray(followingData) ? followingData : []);
    } catch (err) {
      console.error(err);
      setStatus('Failed to load profile.');
    } finally {
      setLoading(false);
    }
  }

  const myPrivatePosts = useMemo(() => {
    return myPosts.filter((item) => {
      const v = String(item.visibility || '').toLowerCase();
      return v === 'private';
    });
  }, [myPosts]);

  const myPublicPosts = useMemo(() => {
    return myPosts.filter((item) => {
      const v = String(item.visibility || 'public').toLowerCase();
      return v === 'public' || v === '' || v === 'published';
    });
  }, [myPosts]);

async function saveProfile() {
  try {
    setStatus('Saving profile...');

    let photoValue = profile?.photoKey || profile?.photoUrl || profile?.profilePic || '';

    if (newPhoto) {
      const upload = await postApi.getUploadUrl({
        fileName: newPhoto.name,
        fileType: newPhoto.type,
      });

      await fetch(upload.uploadUrl, {
        method: 'PUT',
        body: newPhoto,
        headers: { 'Content-Type': newPhoto.type },
      });

      photoValue = upload.fileKey || upload.fileUrl;
    }

    const payload = {
      username: newUsername.trim(),
      name: newUsername.trim(),
      photoUrl: photoValue,
      profilePic: photoValue,
      photoKey: photoValue,
    };

    const updated = await userApi.updateProfile(payload);

    console.log('UPDATED PROFILE:', updated);

    setProfile((prev) => ({
      ...prev,
      ...updated,
    }));

    setEditingProfile(false);
    setNewPhoto(null);
    setStatus('Profile updated.');
  } catch (err) {
    console.error(err);
    setStatus('Failed to update profile.');
  }
}

  async function openApprovedCreator(creator) {
    const creatorId = creator.userId || creator.followingId;
    if (!creatorId) return;

    try {
      setLoadingCreator(true);
      setTab('approved-private');

      const posts = await postApi.getCreatorPrivatePosts(creatorId);
      setCreatorPrivatePosts(Array.isArray(posts) ? posts : []);
    } catch (err) {
      console.error(err);
      setStatus('Could not load creator posts.');
    } finally {
      setLoadingCreator(false);
    }
  }

  function renderOwnPost(post, label) {
    const postId = post.id || post.reelId;

    return (
      <div className="private-card profile-post-card" key={postId}>
        <button
          className="post-card-main"
          type="button"
          onClick={() => navigate(`/reel/${postId}`)}
        >
          {getPostImage(post) ? (
  <img src={getPostImage(post)} alt={post.title || 'Post'} />
) : (
  <div className="private-placeholder">{post.topic?.[0] || 'S'}</div>
)}

          <div className="private-info">
            <h4>{post.title}</h4>
            <span>{label}</span>
          </div>
        </button>

        <button
          className="edit-post-btn"
          type="button"
          onClick={() => navigate(`/edit/${postId}`)}
        >
          Edit
        </button>
      </div>
    );
  }

  if (loading) {
    return (
      <main className="profile-page">
        <p className="status">Loading profile...</p>
      </main>
    );
  }

  return (
    <main className="profile-page">
      <section className="profile-hero">
        <div className="profile-left">
          {profile?.photoUrl || profile?.profilePic ? (
  <img
    src={profile.photoUrl || profile.profilePic}
    alt="Profile"
    className="avatar-photo"
    onError={(e) => {
      e.currentTarget.style.display = 'none';
      e.currentTarget.nextElementSibling.style.display = 'grid';
    }}
  />
) : null}

<div
  className="avatar-xl"
  style={{
    display: profile?.photoUrl || profile?.profilePic ? 'none' : 'grid',
  }}
>
  {initials}
</div>

          <div>
            <span className="profile-pill">Your profile</span>
            <h1>{displayName}</h1>
            <p className="profile-email">{profile?.email}</p>
            <p className="profile-bio">Learn. Share. Grow with Smarty.</p>

            <button
              type="button"
              className="profile-edit-btn"
              onClick={() => setEditingProfile((prev) => !prev)}
            >
              {editingProfile ? 'Close' : 'Edit Profile'}
            </button>

            {editingProfile && (
              <div className="profile-edit-box">
                <input
                  value={newUsername}
                  placeholder="Username"
                  onChange={(e) => setNewUsername(e.target.value)}
                />

                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) => setNewPhoto(e.target.files?.[0] || null)}
                />

                <button type="button" onClick={saveProfile}>
                  Save Changes
                </button>
              </div>
            )}
          </div>
        </div>

        <div className="profile-stats">
          <div className="stat-card">
            <strong>{myPosts.length}</strong>
            <span>Posts</span>
          </div>

          <div className="stat-card">
            <strong>{myPublicPosts.length}</strong>
            <span>Public</span>
          </div>

          <div className="stat-card">
            <strong>{following.length}</strong>
            <span>Friends</span>
          </div>
        </div>
      </section>

      {status && <p className="status">{status}</p>}

      <section className="profile-tabs">
        <button
          type="button"
          className={tab === 'overview' ? 'active' : ''}
          onClick={() => setTab('overview')}
        >
          Overview
        </button>

        <button
          type="button"
          className={tab === 'public' ? 'active' : ''}
          onClick={() => setTab('public')}
        >
          My Public Posts
        </button>

        <button
          type="button"
          className={tab === 'private' ? 'active' : ''}
          onClick={() => setTab('private')}
        >
          My Private Posts
        </button>

        <button
          type="button"
          className={tab === 'approved' || tab === 'approved-private' ? 'active' : ''}
          onClick={() => setTab('approved')}
        >
          Friends
        </button>
      </section>

      {tab === 'overview' && (
        <section className="profile-content">
          <div className="profile-card">
            <h3>About</h3>
            <p>Manage your content, update your profile, and explore creators.</p>
          </div>

          <div className="profile-card">
            <h3>Account</h3>

            <div className="detail-row">
              <span>Username</span>
              <strong>{displayName}</strong>
            </div>

            <div className="detail-row">
              <span>Email</span>
              <strong>{profile?.email || 'Not set'}</strong>
            </div>
          </div>

          <div className="profile-card">
            <h3>Tips</h3>
            <p>Strong titles + clean visuals = better engagement.</p>
          </div>
        </section>
      )}

      {tab === 'public' && (
        <section className="profile-private-posts">
          {myPublicPosts.length === 0 ? (
            <p className="status">No public posts found.</p>
          ) : (
            <div className="private-grid">
              {myPublicPosts.map((post) => renderOwnPost(post, '🌍 Public'))}
            </div>
          )}
        </section>
      )}

      {tab === 'private' && (
        <section className="profile-private-posts">
          {myPrivatePosts.length === 0 ? (
            <p className="status">No private posts found.</p>
          ) : (
            <div className="private-grid">
              {myPrivatePosts.map((post) => renderOwnPost(post, '🔒 Private'))}
            </div>
          )}
        </section>
      )}

      {tab === 'approved' && (
        <section className="profile-private-posts">
          {following.length === 0 ? (
            <p className="status">No friends yet.</p>
          ) : (
            <div className="approved-creators-list">
              {following.map((creator) => {
                const creatorId = creator.userId || creator.followingId;
                const name =
                  creator.username ||
                  creator.name ||
                  creator.email?.split('@')[0] ||
                  'Creator';

                return (
                  <button
                    key={creatorId}
                    type="button"
                    className="approved-creator-card"
                    onClick={() => openApprovedCreator(creator)}
                  >
                    <div className="approved-avatar">{name[0].toUpperCase()}</div>

                    <div>
                      <h4>{name}</h4>
                      <p>Friend</p>
                    </div>

                    <span>Open</span>
                  </button>
                );
              })}
            </div>
          )}
        </section>
      )}

      {tab === 'approved-private' && (
        <section className="profile-private-posts">
          <button type="button" className="back-link" onClick={() => setTab('approved')}>
            ← Back
          </button>

          {loadingCreator ? (
            <p className="status">Loading...</p>
          ) : (
            <div className="private-grid">
              {creatorPrivatePosts.map((post) => {
                const postId = post.id || post.reelId;

                return (
                  <button
                    key={postId}
                    type="button"
                    className="private-card"
                    onClick={() => navigate(`/reel/${postId}`)}
                  >
                    {getPostImage(post) ? (
  <img src={getPostImage(post)} alt={post.title || 'Post'} />
) : (
  <div className="private-placeholder">{post.topic?.[0] || 'S'}</div>
)} 

                    <div className="private-info">
                      <h4>{post.title}</h4>
                      <span>🔓 Shared</span>
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