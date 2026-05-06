import { memo, useEffect, useMemo, useRef, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { userApi, postApi, creatorApi, roomApi } from '../api/client';
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
const ProfilePostCard = memo(function ProfilePostCard({ post, label, onOpen, onEdit, editable = true }) {
  const postId = post.id || post.reelId;
  const image = getPostImage(post);

  return (
    <div className="private-card profile-post-card">
      <button
        className="post-card-main"
        type="button"
        onClick={() => onOpen(postId)}
      >
        {image ? (
          <img
            src={image}
            alt={post.title || 'Post'}
            loading="lazy"
            decoding="async"
          />
        ) : (
          <div className="private-placeholder">{post.topic?.[0] || 'S'}</div>
        )}

        <div className="private-info">
          <h4>{post.title}</h4>
          <span>{label}</span>
        </div>
      </button>

      {editable && (
        <button
          className="edit-post-btn"
          type="button"
          onClick={() => onEdit(postId)}
        >
          Edit
        </button>
      )}
    </div>
  );
});

const FriendResultCard = memo(function FriendResultCard({ item, loadingId, onInvite }) {
  const itemId = item.userId || item.id || item.sub || item.email;
  const itemName = item.username || item.name || item.email || 'User';
  const itemInitial = String(itemName).charAt(0).toUpperCase();

  return (
    <div className="friend-result-card">
      <div className="friend-result-avatar">{itemInitial}</div>

      <div>
        <strong>{itemName}</strong>
        <span>{item.email || 'Smarty user'}</span>
      </div>

      <button
        type="button"
        onClick={() => onInvite(item)}
        disabled={item.invited || loadingId === itemId}
      >
        {item.invited ? 'Requested' : loadingId === itemId ? 'Sending...' : 'Follow'}
      </button>
    </div>
  );
});

const ApprovedCreatorCard = memo(function ApprovedCreatorCard({ creator, onOpen }) {
  const creatorId = creator.userId || creator.followingId || creator.id || creator.sub;
  const name = creator.username || creator.name || creator.email?.split('@')[0] || 'Creator';

  return (
    <button
      key={creatorId || name}
      type="button"
      className="approved-creator-card"
      onClick={() => onOpen(creator)}
    >
      <div className="approved-avatar">{name[0].toUpperCase()}</div>

      <div>
        <h4>{name}</h4>
        <p>Following</p>
      </div>

      <span>Open private posts</span>
    </button>
  );
});
export default function ProfilePage() {
  const navigate = useNavigate();
  const [friendSearch, setFriendSearch] = useState('');
  const [friendResults, setFriendResults] = useState([]);
  const [searchingFriends, setSearchingFriends] = useState(false);
  const [friendActionLoading, setFriendActionLoading] = useState('');
  const [profile, setProfile] = useState(null);
  const [tab, setTab] = useState('overview');
  const [myPosts, setMyPosts] = useState([]);
  const [following, setFollowing] = useState([]);
  const [creatorPrivatePosts, setCreatorPrivatePosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadingCreator, setLoadingCreator] = useState(false);
  const [status, setStatus] = useState('');

  const [editingProfile, setEditingProfile] = useState(false);
  const [savingProfile, setSavingProfile] = useState(false);
  const [newUsername, setNewUsername] = useState('');
  const [newPhoto, setNewPhoto] = useState(null);
  const [photoPreview, setPhotoPreview] = useState('');
  const [cropZoom, setCropZoom] = useState(1);
  const [cropX, setCropX] = useState(50);
  const [cropY, setCropY] = useState(50);
  const cropDragRef = useRef(null);
  const mountedRef = useRef(false);
  const profileLoadIdRef = useRef(0);

  useEffect(() => {
    mountedRef.current = true;
    loadProfileData();

    const handlePageShow = () => loadProfileData({ silent: true });
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        loadProfileData({ silent: true });
      }
    };

    window.addEventListener('pageshow', handlePageShow);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      mountedRef.current = false;
      window.removeEventListener('pageshow', handlePageShow);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, []);

  useEffect(() => {
    return () => {
      if (photoPreview) URL.revokeObjectURL(photoPreview);
    };
  }, [photoPreview]);

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

  const withTimeout = useCallback((promise, ms = 12000) => {
    let timer;

    const timeout = new Promise((_, reject) => {
      timer = window.setTimeout(() => {
        reject(new Error('Request timed out. Please check your connection.'));
      }, ms);
    });

    return Promise.race([promise, timeout]).finally(() => {
      window.clearTimeout(timer);
    });
  }, []);

  const searchFriends = useCallback(async () => {
    const query = friendSearch.trim();

    if (!query) {
      setFriendResults([]);
      return;
    }

    try {
      setSearchingFriends(true);
      setStatus('');

      const data = await withTimeout(roomApi.searchUsers(query), 12000);
      const users = data.users || data || [];
      const myId = profile?.id || profile?.userId || profile?.sub;
      const myEmail = profile?.email;

      setFriendResults(
        users.filter((item) => {
          const itemId = item.userId || item.id || item.sub;
          return itemId !== myId && item.email !== myEmail;
        })
      );
    } catch (err) {
      console.error(err);
      setStatus(err?.response?.data?.error || 'Search failed');
    } finally {
      setSearchingFriends(false);
    }
  }, [friendSearch, profile, withTimeout]);

  async function inviteFriend(targetUser) {
    if (!targetUser) return;

    const targetId = targetUser.userId || targetUser.id || targetUser.sub;
    if (!targetId) {
      setStatus('Could not find this user id.');
      return;
    }

    try {
      setFriendActionLoading(targetId);
      setStatus('Sending follow request...');

      await withTimeout(userApi.followUser(targetId), 12000);

      setStatus('Follow request sent. Waiting for approval.');
      setFriendResults((prev) =>
        prev.map((item) =>
          (item.userId || item.id || item.sub) === targetId
            ? { ...item, invited: true }
            : item
        )
      );
    } catch (err) {
      console.error(err);
      setStatus(err?.response?.data?.error || 'Follow request failed');
    } finally {
      setFriendActionLoading('');
    }
  }

  async function loadProfileData(options = {}) {
    const { silent = false } = options;
    const loadId = profileLoadIdRef.current + 1;
    profileLoadIdRef.current = loadId;

    try {
      if (!silent) {
        setLoading(true);
        setStatus('');
      }

      const me = await withTimeout(userApi.getMe(), 12000);

      if (!mountedRef.current || profileLoadIdRef.current !== loadId) return;

      setProfile(me);

      const safeUsername =
        me.username && !String(me.username).includes('-')
          ? me.username
          : me.email?.split('@')[0] || me.name || '';

      setNewUsername(safeUsername);
      setLoading(false);

      const userId = me.id || me.userId || me.sub;

      const [postsResult, followingResult] = await Promise.allSettled([
        withTimeout(postApi.getMyReels(), 12000),
        userId ? withTimeout(creatorApi.getFollowing(userId), 12000) : Promise.resolve([]),
      ]);

      if (!mountedRef.current || profileLoadIdRef.current !== loadId) return;

      if (postsResult.status === 'fulfilled') {
        const posts = postsResult.value;
        setMyPosts(Array.isArray(posts) ? posts : []);
      } else if (!silent) {
        console.error(postsResult.reason);
      }

      if (followingResult.status === 'fulfilled') {
        const followingData = followingResult.value;
        setFollowing(Array.isArray(followingData) ? followingData : []);
      } else if (!silent) {
        console.error(followingResult.reason);
      }
    } catch (err) {
      console.error(err);

      if (!mountedRef.current || profileLoadIdRef.current !== loadId) return;

      setStatus(err?.message || 'Failed to load profile.');
      setLoading(false);
    }
  }

  const openProfileEditor = useCallback(() => {
    setEditingProfile(true);
    setStatus('');
  }, []);

  const handlePhotoSelect = useCallback((file) => {
    if (!file) return;

    if (photoPreview) URL.revokeObjectURL(photoPreview);

    setNewPhoto(file);
    setPhotoPreview(URL.createObjectURL(file));
    setCropZoom(1);
    setCropX(50);
    setCropY(50);
    setEditingProfile(true);
  }, [photoPreview]);

  const startCropDrag = useCallback((event) => {
    const pointer = event.touches?.[0] || event;

    cropDragRef.current = {
      startX: pointer.clientX,
      startY: pointer.clientY,
      cropX,
      cropY,
    };

    event.currentTarget.setPointerCapture?.(event.pointerId);
  }, [cropX, cropY]);

  const moveCropDrag = useCallback((event) => {
    if (!cropDragRef.current) return;

    const pointer = event.touches?.[0] || event;
    const deltaX = pointer.clientX - cropDragRef.current.startX;
    const deltaY = pointer.clientY - cropDragRef.current.startY;
    const sensitivity = 0.38;

    setCropX(Math.max(0, Math.min(100, cropDragRef.current.cropX - deltaX * sensitivity)));
    setCropY(Math.max(0, Math.min(100, cropDragRef.current.cropY - deltaY * sensitivity)));
  }, []);

  const endCropDrag = useCallback(() => {
    cropDragRef.current = null;
  }, []);

  const createCroppedProfileImage = useCallback(async (file) => {
    if (!file) return null;

    const imageUrl = URL.createObjectURL(file);

    try {
      const image = await new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => resolve(img);
        img.onerror = reject;
        img.src = imageUrl;
      });

      const canvasSize = 512;
      const canvas = document.createElement('canvas');
      canvas.width = canvasSize;
      canvas.height = canvasSize;

      const ctx = canvas.getContext('2d');
      if (!ctx) return file;

      ctx.clearRect(0, 0, canvasSize, canvasSize);
      ctx.save();
      ctx.beginPath();
      ctx.arc(canvasSize / 2, canvasSize / 2, canvasSize / 2, 0, Math.PI * 2);
      ctx.closePath();
      ctx.clip();

      const sourceWidth = image.naturalWidth || image.width;
      const sourceHeight = image.naturalHeight || image.height;
      const baseScale = Math.max(canvasSize / sourceWidth, canvasSize / sourceHeight);
      const finalScale = baseScale * cropZoom;
      const drawWidth = sourceWidth * finalScale;
      const drawHeight = sourceHeight * finalScale;

      const maxOffsetX = Math.max(0, drawWidth - canvasSize);
      const maxOffsetY = Math.max(0, drawHeight - canvasSize);
      const offsetX = (cropX / 100) * maxOffsetX;
      const offsetY = (cropY / 100) * maxOffsetY;

      ctx.drawImage(image, -offsetX, -offsetY, drawWidth, drawHeight);
      ctx.restore();

      const blob = await new Promise((resolve) => {
        canvas.toBlob(resolve, 'image/jpeg', 0.92);
      });

      if (!blob) return file;

      return new File([blob], `profile-${Date.now()}.jpg`, { type: 'image/jpeg' });
    } finally {
      URL.revokeObjectURL(imageUrl);
    }
  }, [cropX, cropY, cropZoom]);

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
      setSavingProfile(true);
      setStatus('Saving profile...');

      let photoValue = profile?.photoKey || profile?.photoUrl || profile?.profilePic || '';

      if (newPhoto) {
        const croppedPhoto = await createCroppedProfileImage(newPhoto);

        const upload = await withTimeout(
          postApi.getUploadUrl({
            fileName: croppedPhoto.name,
            fileType: croppedPhoto.type,
          }),
          12000
        );

        await withTimeout(
          fetch(upload.uploadUrl, {
            method: 'PUT',
            body: croppedPhoto,
            headers: { 'Content-Type': croppedPhoto.type },
          }),
          20000
        );

        photoValue = upload.fileKey || upload.fileUrl;
      }

      const payload = {
        username: newUsername.trim(),
        name: newUsername.trim(),
        photoUrl: photoValue,
        profilePic: photoValue,
        photoKey: photoValue,
      };

      const updated = await withTimeout(userApi.updateProfile(payload), 12000);

      console.log('UPDATED PROFILE:', updated);

      setProfile((prev) => ({
        ...prev,
        ...updated,
      }));

      setEditingProfile(false);
      setNewPhoto(null);
      setPhotoPreview('');
      setCropZoom(1);
      setCropX(50);
      setCropY(50);
      setStatus('Profile updated.');
    } catch (err) {
      console.error(err);
      setStatus('Failed to update profile.');
    } finally {
      setSavingProfile(false);
    }
  }

  async function openApprovedCreator(creator) {
    const creatorId = creator.userId || creator.followingId || creator.id || creator.sub;

    if (!creatorId) {
      setStatus('Could not find this creator id.');
      return;
    }

    try {
      setLoadingCreator(true);
      setStatus('');
      setTab('approved-private');

      const posts = await withTimeout(postApi.getCreatorPrivatePosts(creatorId), 12000);
      setCreatorPrivatePosts(Array.isArray(posts) ? posts : []);
    } catch (err) {
      console.error(err);

      if (err?.response?.status === 403) {
        setStatus('This creator has not approved your follow request yet.');
      } else {
        setStatus(err?.response?.data?.error || 'Could not load creator posts.');
      }

      setCreatorPrivatePosts([]);
      setTab('approved');
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
            <img
              src={getPostImage(post)}
              alt={post.title || 'Post'}
              loading="lazy"
              decoding="async"
            />
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
          <button
            type="button"
            className="profile-avatar-button"
            onClick={openProfileEditor}
            aria-label="Edit profile photo"
          >
            {profile?.photoUrl || profile?.profilePic ? (
              <img
                src={profile.photoUrl || profile.profilePic}
                alt="Profile"
                className="avatar-photo"
                loading="eager"
                decoding="async"
                fetchpriority="high"
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

            <span className="avatar-edit-overlay">Edit</span>
          </button>

          <div>
            <span className="profile-pill">Your profile</span>
            <h1>{displayName}</h1>
            <p className="profile-email">{profile?.email}</p>
            <p className="profile-bio">Learn. Share. Grow with Smarty.</p>

            <div className="profile-action-row">
              <button
                type="button"
                className="profile-edit-btn"
                onClick={() => {
                  setStatus('');
                  setEditingProfile((prev) => !prev);
                }}
              >
                {editingProfile ? 'Close' : 'Edit'}
              </button>

              <button
                type="button"
                className="profile-dashboard-btn"
                onClick={() => navigate('/creator-dashboard')}
              >
                Dashboard
              </button>

              <button
                type="button"
                className="profile-saved-btn"
                onClick={() => navigate('/saved')}
              >
                Saved
              </button>

            </div>


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
            <span>Following</span>
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
          Public
        </button>

        <button
          type="button"
          className={tab === 'private' ? 'active' : ''}
          onClick={() => setTab('private')}
        >
          Private
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
          <div className="friend-search-card">
            <div>
              <span className="friend-search-eyebrow">Find your friend</span>
            </div>

            <div className="friend-search-row">
              <input
                value={friendSearch}
                placeholder="Search username or email"
                onChange={(e) => setFriendSearch(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') searchFriends();
                }}
              />

              <button type="button" onClick={searchFriends} disabled={searchingFriends}>
                {searchingFriends ? 'Searching...' : 'Search'}
              </button>
            </div>

            {friendResults.length > 0 && (
              <div className="friend-results-list">
                {friendResults.map((item) => {
                  const itemId = item.userId || item.id || item.sub || item.email;
                  const itemName = item.username || item.name || item.email || 'User';
                  const itemInitial = String(itemName).charAt(0).toUpperCase();

                  return (
                    <div className="friend-result-card" key={itemId || itemName}>
                      <div className="friend-result-avatar">{itemInitial}</div>

                      <div>
                        <strong>{itemName}</strong>
                        <span>{item.email || 'Smarty user'}</span>
                      </div>

                      <button
                        type="button"
                        onClick={() => inviteFriend(item)}
                        disabled={item.invited || friendActionLoading === itemId}
                      >
                        {item.invited ? 'Requested' : friendActionLoading === itemId ? 'Sending...' : 'Follow'}
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
          {following.length === 0 ? (
            <p className="status">You are not following anyone yet.</p>
          ) : (
            <div className="approved-creators-list">
              {following.map((creator) => {
const creatorId =
  creator.userId ||
  creator.followingId ||
  creator.id ||
  creator.sub;

const name =
  creator.username ||
  creator.name ||
  creator.email?.split('@')[0] ||
  'Creator';

                return (
                  <button
                    key={creatorId || name}
                    type="button"
                    className="approved-creator-card"
                    onClick={() => openApprovedCreator(creator)}
                  >
                    <div className="approved-avatar">{name[0].toUpperCase()}</div>

                    <div>
                      <h4>{name}</h4>
                      <p>Following</p>
                    </div>

                    <span>Open private posts</span>
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
                      <img
                        src={getPostImage(post)}
                        alt={post.title || 'Post'}
                        loading="lazy"
                        decoding="async"
                      />
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

      {editingProfile && (
        <div
          className="profile-modal-overlay"
          role="presentation"
          onClick={() => {
            if (!savingProfile) setEditingProfile(false);
          }}
        >
          <section
            className="profile-modal profile-edit-box"
            role="dialog"
            aria-modal="true"
            aria-label="Edit profile"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="profile-modal-header">
              <div>
                <h2>Update your profile</h2>
              </div>

              <button
                type="button"
                className="profile-modal-close"
                onClick={() => setEditingProfile(false)}
                disabled={savingProfile}
                aria-label="Close edit profile"
              >
                ✕
              </button>
            </div>

            <div className="profile-modal-body">
              <input
                value={newUsername}
                placeholder="Username"
                onChange={(e) => setNewUsername(e.target.value)}
              />

              <label className="profile-photo-upload">
                <span>Choose profile image</span>
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) => handlePhotoSelect(e.target.files?.[0] || null)}
                />
              </label>

              {(photoPreview || profile?.photoUrl || profile?.profilePic) && (
                <div className="profile-crop-box">
                  <div
                    className="profile-crop-preview touch-crop-preview"
                    onPointerDown={startCropDrag}
                    onPointerMove={moveCropDrag}
                    onPointerUp={endCropDrag}
                    onPointerCancel={endCropDrag}
                    onPointerLeave={endCropDrag}
                  >
                    <img
                      src={photoPreview || profile?.photoUrl || profile?.profilePic}
                      alt="Profile crop preview"
                      draggable="false"
                      style={{
                        transform: `scale(${cropZoom})`,
                        objectPosition: `${cropX}% ${cropY}%`,
                        transformOrigin: `${cropX}% ${cropY}%`,
                      }}
                    />
                    <span className="crop-drag-hint">Drag to adjust</span>
                  </div>

                  <div className="crop-controls">
                    <label>
                      Zoom
                      <input
                        type="range"
                        min="1"
                        max="2.4"
                        step="0.05"
                        value={cropZoom}
                        onChange={(e) => setCropZoom(Number(e.target.value))}
                      />
                    </label>

                    <button
                      type="button"
                      className="crop-reset-btn"
                      onClick={() => {
                        setCropZoom(1);
                        setCropX(50);
                        setCropY(50);
                      }}
                    >
                      Reset image position
                    </button>
                  </div>
                </div>
              )}
            </div>

            <div className="profile-modal-footer">
              <button
                type="button"
                className="profile-modal-cancel"
                onClick={() => setEditingProfile(false)}
                disabled={savingProfile}
              >
                Cancel
              </button>

              <button
                type="button"
                className="profile-modal-save"
                onClick={saveProfile}
                disabled={savingProfile}
              >
                {savingProfile ? (
                  <span className="saving-profile-label">
                    <span className="saving-spinner" />
                    Updating...
                  </span>
                ) : (
                  'Save Changes'
                )}
              </button>
            </div>
          </section>
        </div>
      )}
    </main>
  );
}