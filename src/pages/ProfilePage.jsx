import { memo, useEffect, useMemo, useRef, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { userApi, postApi, creatorApi, roomApi } from '../api/client';
import { flushNativeSessionStorage } from '../lib/nativeSessionStorage';
import './ProfilePage.css';
import ProfileEditor from '../components/ProfileEditor';
import DeleteAccountDialog from '../components/DeleteAccountDialog';
import { Search, X, Users, ArrowUpRight } from 'lucide-react';
import './CommunityWorkspace.css';

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

function normalizeProfileResponse(value) {
  return value?.profile || value || null;
}

function normalizeItemsResponse(value, key) {
  if (Array.isArray(value)) return value;
  if (Array.isArray(value?.[key])) return value[key];
  if (Array.isArray(value?.items)) return value.items;
  return [];
}

function withCacheBuster(url, value) {
  if (!url) return '';

  const separator = String(url).includes('?') ? '&' : '?';
  return `${url}${separator}v=${encodeURIComponent(value || Date.now())}`;
}

function isLikelyCognitoSub(value) {
  const text = String(value || '').trim();
  return /^[a-f0-9-]{24,}$/i.test(text) || /^[a-z0-9]{20,}$/i.test(text);
}

function getCleanProfileName(profile) {
  const emailName = profile?.email ? String(profile.email).split('@')[0] : '';
  const candidates = [
    profile?.username,
    profile?.name,
    profile?.displayName,
    emailName,
  ];

  for (const candidate of candidates) {
    const value = String(candidate || '').trim();
    if (!value) continue;
    if (value.includes('@')) return value.split('@')[0];
    if (isLikelyCognitoSub(value)) continue;
    return value;
  }

  return 'User';
}

const StatNumber = memo(function StatNumber({ value }) {
  return <>{Number(value || 0).toLocaleString()}</>;
});

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
            fetchPriority="low"
            sizes="(max-width: 768px) 92vw, 320px"
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

const FriendResultCard = memo(function FriendResultCard({ item, loadingId, onInvite, onOpen }) {
  const [imageFailed,setImageFailed]=useState(false);
  const itemId = item.userId || item.id || item.sub;
  const itemName = getCleanProfileName(item);
  const itemInitial = String(itemName).charAt(0).toUpperCase();

  return (
    <div className="friend-result-card">
      <button type="button" className="friend-result-person" disabled={!itemId} onClick={()=>onOpen(itemId)} aria-label={`View ${itemName} profile`}>
      <div className="friend-result-avatar">{(item.photoUrl||item.profilePic)&&!imageFailed?<img src={item.photoUrl||item.profilePic} alt="" loading="lazy" onError={()=>setImageFailed(true)}/>:itemInitial}</div><div>
        <strong>{itemName}</strong>
        <span>{item.username ? `@${item.username}` : 'Smarty member'}</span>
      </div><ArrowUpRight size={14}/></button>

      <button
        type="button"
        onClick={() => onInvite(item)}
        disabled={!itemId || item.invited || Boolean(loadingId)}
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
  const [friendSearchError, setFriendSearchError] = useState('');
  const [friendSearchComplete, setFriendSearchComplete] = useState(false);
  const [friendActionLoading, setFriendActionLoading] = useState('');
  const [profile, setProfile] = useState(null);
  const [tab, setTab] = useState('overview');
  const [myPosts, setMyPosts] = useState([]);
  const [following, setFollowing] = useState([]);
  const [creatorPrivatePosts, setCreatorPrivatePosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadingCreator, setLoadingCreator] = useState(false);
  const [status, setStatus] = useState('');
const [deleteAccountLoading, setDeleteAccountLoading] = useState(false);
const [showDeleteAccountConfirm, setShowDeleteAccountConfirm] = useState(false);
const [deleteConfirmationText, setDeleteConfirmationText] = useState('');
  const [deleteAccountError, setDeleteAccountError] = useState('');
  const deletingAccountRef = useRef(false);
  const [editingProfile, setEditingProfile] = useState(false);
  const [savingProfile, setSavingProfile] = useState(false);
  const [profileEditorError, setProfileEditorError] = useState('');
  const editingProfileRef = useRef(false);
  const savingProfileRef = useRef(false);
  const [newUsername, setNewUsername] = useState('');
  const [newPhoto, setNewPhoto] = useState(null);
  const [photoPreview, setPhotoPreview] = useState('');
  const [cropZoom, setCropZoom] = useState(1);
  const [cropX, setCropX] = useState(50);
  const [cropY, setCropY] = useState(50);
  const cropDragRef = useRef(null);
  const mountedRef = useRef(false);
  const profileLoadIdRef = useRef(0);
  const friendSearchRequestSeqRef = useRef(0);
  const friendSearchTimerRef = useRef(null);
  const friendActionLockedRef = useRef(false);
  const [avatarImageFailed, setAvatarImageFailed] = useState(false);
  const [avatarImageLoaded, setAvatarImageLoaded] = useState(false);

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
      friendSearchRequestSeqRef.current += 1;
      if (friendSearchTimerRef.current) {
        window.clearTimeout(friendSearchTimerRef.current);
        friendSearchTimerRef.current = null;
      }
      window.removeEventListener('pageshow', handlePageShow);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, []);

  useEffect(() => {
    return () => {
      if (photoPreview) URL.revokeObjectURL(photoPreview);
    };
  }, [photoPreview]);

  const displayName = useMemo(() => getCleanProfileName(profile), [profile]);

  const initials = useMemo(() => {
    return displayName.substring(0, 2).toUpperCase();
  }, [displayName]);

  const profileImageSrc = useMemo(() => {
    const rawImage = profile?.photoUrl || profile?.profilePic || '';
    const version = profile?.updatedAt || profile?.lastSeenAt || profile?.photoKey || '';
    return withCacheBuster(rawImage, version);
  }, [profile]);

  useEffect(() => {
    setAvatarImageFailed(false);
    setAvatarImageLoaded(false);
  }, [profileImageSrc]);

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

  const runFriendSearch = useCallback(async (searchValue) => {
    const query = String(searchValue || '').trim();

    if (query.length < 2) {
      setFriendResults([]);
      setSearchingFriends(false);
      return;
    }

    const requestId = friendSearchRequestSeqRef.current + 1;
    friendSearchRequestSeqRef.current = requestId;

    try {
      setSearchingFriends(true);
      setFriendSearchError('');setFriendSearchComplete(false);

      const data = await withTimeout(roomApi.searchUsers(query), 12000);
      if (!mountedRef.current || requestId !== friendSearchRequestSeqRef.current) return;

      const users = normalizeItemsResponse(data,'users');
      const myId = profile?.id || profile?.userId || profile?.sub;
      const myEmail = profile?.email;

      setFriendResults(
        users.filter(Boolean).filter((item,index,array) => {
          const itemId = item.userId || item.id || item.sub;
          return Boolean(itemId) && String(itemId) !== String(myId) && (!myEmail || item.email !== myEmail) && array.findIndex(value=>String(value.userId||value.id||value.sub)===String(itemId))===index;
        })
      );
      setFriendSearchComplete(true);
    } catch (err) {
      console.error(err);
      if (mountedRef.current && requestId === friendSearchRequestSeqRef.current) {
        setFriendResults([]);
        setFriendSearchError('People could not be loaded. Check your connection and try again.');
      }
    } finally {
      if (mountedRef.current && requestId === friendSearchRequestSeqRef.current) {
        setSearchingFriends(false);
      }
    }
  }, [profile, withTimeout]);

  const searchFriends = useCallback(() => {
    if (friendSearchTimerRef.current) {
      window.clearTimeout(friendSearchTimerRef.current);
      friendSearchTimerRef.current = null;
    }

    runFriendSearch(friendSearch);
  }, [friendSearch, runFriendSearch]);

  useEffect(() => {
    const query = friendSearch.trim();

    friendSearchRequestSeqRef.current += 1;

    if (friendSearchTimerRef.current) {
      window.clearTimeout(friendSearchTimerRef.current);
      friendSearchTimerRef.current = null;
    }

    setFriendSearchError('');setFriendSearchComplete(false);setFriendResults([]);
    if (query.length < 2) {
      setFriendResults([]);
      setSearchingFriends(false);
      return undefined;
    }

    setSearchingFriends(true);

    friendSearchTimerRef.current = window.setTimeout(() => {
      friendSearchTimerRef.current = null;
      runFriendSearch(query);
    }, 300);

    return () => {
      if (friendSearchTimerRef.current) {
        window.clearTimeout(friendSearchTimerRef.current);
        friendSearchTimerRef.current = null;
      }
    };
  }, [friendSearch, runFriendSearch]);

  async function inviteFriend(targetUser) {
    if (!targetUser || friendActionLockedRef.current) return;

    const targetId = targetUser.userId || targetUser.id || targetUser.sub;
    if (!targetId) {
      setStatus('Could not find this user id.');
      return;
    }

    friendActionLockedRef.current=true;
    try {
      setFriendActionLoading(targetId);
      setStatus('Sending follow request...');

      await withTimeout(userApi.followUser(targetId), 12000);
      if(!mountedRef.current)return;

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
      if(!mountedRef.current)return;
      setStatus(err?.response?.data?.error || 'Follow request failed');
    } finally {
      friendActionLockedRef.current=false;
      if(mountedRef.current)setFriendActionLoading('');
    }
  }

  async function loadProfileData(options = {}) {
    const { silent = false } = options;
    if (savingProfileRef.current) return;
    const loadId = profileLoadIdRef.current + 1;
    profileLoadIdRef.current = loadId;

    try {
      if (!silent) {
        setLoading(true);
        setStatus('');
      }

      const meResponse = await withTimeout(userApi.getMe(), 12000);
      const me = normalizeProfileResponse(meResponse);

      if (!mountedRef.current || profileLoadIdRef.current !== loadId) return;

      if (!me) {
        throw new Error('Profile response was empty.');
      }

      setProfile(me);

      const safeUsername = getCleanProfileName(me);
      if (!editingProfileRef.current) setNewUsername(safeUsername);
      setLoading(false);

      const userId = me.id || me.userId || me.sub;

      const [postsResult, followingResult] = await Promise.allSettled([
        withTimeout(postApi.getMyReels(), 12000),
        userId ? withTimeout(creatorApi.getFollowing(userId), 12000) : Promise.resolve([]),
      ]);

      if (!mountedRef.current || profileLoadIdRef.current !== loadId) return;

      if (postsResult.status === 'fulfilled') {
        const posts = normalizeItemsResponse(postsResult.value, 'posts');
        setMyPosts(posts);
      } else if (!silent) {
        console.error(postsResult.reason);
      }

      if (followingResult.status === 'fulfilled') {
        const followingData = normalizeItemsResponse(followingResult.value, 'following');
        setFollowing(followingData);
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
    setNewUsername(getCleanProfileName(profile));
    setNewPhoto(null);
    setPhotoPreview('');
    setProfileEditorError('');
    editingProfileRef.current = true;
    setEditingProfile(true);
    setStatus('');
  }, [profile]);

  const closeProfileEditor = useCallback(() => {
    if (savingProfileRef.current) return;
    editingProfileRef.current = false;
    setEditingProfile(false);
    setNewPhoto(null);
    setPhotoPreview('');
    setProfileEditorError('');
  }, []);

  const handlePhotoSelect = useCallback((file) => {
    if (!file) return;

    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp'];
    const maxSize = 6 * 1024 * 1024;

    if (!allowedTypes.includes(file.type)) {
      setProfileEditorError('Please choose a JPG, PNG, or WebP image.');
      return;
    }

    if (!file.size || file.size > maxSize) {
      setProfileEditorError('Choose a valid profile image under 6 MB.');
      return;
    }

    setProfileEditorError('');
    setNewPhoto(file);
    setPhotoPreview(URL.createObjectURL(file));
    setCropZoom(1);
    setCropX(50);
    setCropY(50);
    setEditingProfile(true);
    editingProfileRef.current = true;
  }, []);

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

    const type = String(file.type || '').toLowerCase();
    if (!type.startsWith('image/') || type === 'image/gif' || type === 'image/svg+xml') {
      return file;
    }

    const imageUrl = URL.createObjectURL(file);

    try {
      const image = await new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => resolve(img);
        img.onerror = reject;
        img.src = imageUrl;
      });

      const canvasSize = 384;
      const canvas = document.createElement('canvas');
      canvas.width = canvasSize;
      canvas.height = canvasSize;

      const ctx = canvas.getContext('2d', { alpha: false });
      if (!ctx) return file;

      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, canvasSize, canvasSize);
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

      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(image, -offsetX, -offsetY, drawWidth, drawHeight);
      ctx.restore();

      const blob = await new Promise((resolve) => {
        canvas.toBlob(resolve, 'image/jpeg', 0.78);
      });

      if (!blob) return file;

      return new File([blob], `profile-${Date.now()}.jpg`, {
        type: 'image/jpeg',
        lastModified: Date.now(),
      });
    } catch (err) {
      console.error('Profile image compression failed:', err);
      return file;
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
    if (savingProfileRef.current) return;
    const cleanName = newUsername.trim();
    if (!cleanName || cleanName.length > 40 || /[\u0000-\u001f\u007f]/.test(cleanName)) {
      setProfileEditorError('Enter a display name of 1–40 characters.');
      return;
    }
    savingProfileRef.current = true;
    profileLoadIdRef.current += 1;
    try {
      setSavingProfile(true);
      setProfileEditorError('');

      let photoValue = profile?.photoKey || profile?.photoUrl || profile?.profilePic || '';
      let uploadedPhotoUrl = '';

      if (newPhoto) {
        const croppedPhoto = await createCroppedProfileImage(newPhoto);
        if (!croppedPhoto) throw new Error('Could not process profile image.');

        const uploadPayload = {
          fileName: croppedPhoto.name,
          fileType: croppedPhoto.type,
          contentType: croppedPhoto.type,
          folder: 'profiles',
          type: 'profile',
        };

        const upload = await withTimeout(
          postApi.getUploadUrl(uploadPayload),
          12000
        );

        const uploaded = await withTimeout(
          fetch(upload.uploadUrl, {
            method: 'PUT',
            body: croppedPhoto,
            headers: { 'Content-Type': croppedPhoto.type },
          }),
          20000
        );
        if (!uploaded.ok) throw new Error('Your photo could not upload. Please try again.');

        photoValue =
          upload.fileKey ||
          upload.mediaKey ||
          upload.key ||
          upload.photoKey ||
          upload.imageKey ||
          upload.fileUrl ||
          upload.mediaUrl ||
          upload.photoUrl ||
          '';

        if (!photoValue) {
          throw new Error('Upload succeeded but no image key was returned.');
        }
        uploadedPhotoUrl = upload.fileUrl || upload.mediaUrl || upload.photoUrl || '';
      }

      const payload = {
        username: cleanName,
        name: cleanName,
        photoUrl: photoValue,
        profilePic: photoValue,
        photoKey: photoValue,
      };

      const updatedResponse = await withTimeout(userApi.updateProfile(payload), 12000);
      const updated = normalizeProfileResponse(updatedResponse);
      const updatedAt = Date.now();

      setProfile((prev) => ({
        ...prev,
        username: cleanName,
        name: cleanName,
        ...(updated || {}),
        photoUrl: updated?.photoUrl || updated?.profilePic || uploadedPhotoUrl || prev?.photoUrl || photoValue,
        profilePic: updated?.profilePic || updated?.photoUrl || uploadedPhotoUrl || prev?.profilePic || photoValue,
        photoKey: updated?.photoKey || photoValue || prev?.photoKey || '',
        updatedAt: updated?.updatedAt || updatedAt,
      }));

      setAvatarImageFailed(false);
      setAvatarImageLoaded(false);

      editingProfileRef.current = false;
      setEditingProfile(false);
      setNewPhoto(null);
      setPhotoPreview('');
      setCropZoom(1);
      setCropX(50);
      setCropY(50);
      setStatus('Profile updated.');
    } catch (err) {
      console.error('PROFILE UPDATE ERROR:', err?.response?.data || err);
      setProfileEditorError(err?.response?.data?.error || err?.message || 'Your profile could not save. Please try again.');
    } finally {
      setSavingProfile(false);
      savingProfileRef.current = false;
    }
  }

  

const openDeleteAccountConfirm = useCallback(() => {
  if (deletingAccountRef.current) return;

  setDeleteConfirmationText('');
  setStatus('');
  setDeleteAccountError('');
  setShowDeleteAccountConfirm(true);
}, []);

const closeDeleteAccountConfirm = useCallback(() => {
  if (deletingAccountRef.current) return;

  setShowDeleteAccountConfirm(false);
  setDeleteConfirmationText('');
  setDeleteAccountError('');
}, []);

const handleDeleteAccount = useCallback(async () => {
  if (deletingAccountRef.current) return;

  if (deleteConfirmationText.trim() !== 'DELETE') {
    setDeleteAccountError('Type DELETE to confirm account deletion.');
    return;
  }

  deletingAccountRef.current = true;
  try {
    setDeleteAccountLoading(true);
    setDeleteAccountError('');

    const deleteAccountRequest =
      typeof userApi.deleteAccount === 'function'
        ? userApi.deleteAccount()
        : creatorApi.deleteAccount();

    const response = await withTimeout(deleteAccountRequest, 30000);
    let result = response;
    if (typeof response?.body === 'string') {
      try { result = JSON.parse(response.body); } catch { throw new Error('We could not confirm deletion. Please try again.'); }
    }
    if (response?.statusCode >= 400 || result?.success === false || result?.error) {
      throw new Error(result?.message || result?.error || 'Your account could not be deleted. Please try again.');
    }

    try {
      localStorage.clear();
      sessionStorage.clear();
    } catch (storageError) {
      console.warn(
        'Could not clear browser storage after account deletion:',
        storageError
      );
    }

    try {
      await flushNativeSessionStorage();
    } catch (storageError) {
      console.warn('Account deleted, but device storage could not be synchronized:', storageError);
    }
    window.location.replace('/login?accountDeleted=1');
  } catch (err) {
    console.error('DELETE ACCOUNT ERROR:', err?.response?.data || err);

    setDeleteAccountError(
      err?.response?.data?.message ||
        err?.response?.data?.error ||
        err?.message ||
        'Unable to delete your account. Please try again.'
    );
  } finally {
    deletingAccountRef.current = false;
    if (mountedRef.current) {
      setDeleteAccountLoading(false);
    }
  }
}, [deleteConfirmationText, withTimeout]);

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

      const postsResponse = await withTimeout(postApi.getCreatorPrivatePosts(creatorId), 12000);
      const posts = normalizeItemsResponse(postsResponse, 'posts');
      setCreatorPrivatePosts(posts);
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
              fetchPriority="low"
              sizes="(max-width: 768px) 92vw, 320px"
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
        <div className="profile-loading" role="status" aria-label="Loading your profile">
          <div className="profile-loading-avatar" aria-hidden="true" />
          <div><h1>Your space</h1><p>Getting your profile ready…</p></div>
        </div>
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
            {profileImageSrc && !avatarImageFailed ? (
              <img
                key={profileImageSrc}
                src={profileImageSrc}
                alt="Profile"
                className="avatar-photo"
                loading="eager"
                decoding="async"
                fetchPriority="high"
                style={{ opacity: avatarImageLoaded ? 1 : 0 }}
                onLoad={() => setAvatarImageLoaded(true)}
                onError={() => {
                  setAvatarImageFailed(true);
                  setAvatarImageLoaded(false);
                }}
              />
            ) : null}

            <div
              className="avatar-xl"
              style={{
                display: !profileImageSrc || avatarImageFailed || !avatarImageLoaded ? 'grid' : 'none',
              }}
            >
              {initials}
            </div>

            <span className="avatar-edit-overlay">Edit</span>
          </button>

          <div className="profile-identity-copy">
            <span className="profile-pill">Your profile</span>
            <h1>{displayName}</h1>
            <p className="profile-email">{profile?.email}</p>
            <p className="profile-bio">A little more curious, every day.</p>
          </div>

            <div className="profile-action-row" aria-label="Profile actions">
              <button
                type="button"
                className="profile-edit-btn"
                onClick={openProfileEditor}
              >
                Edit profile
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

        <div className="profile-stats">
          <div className="stat-card">
            <strong><StatNumber value={myPosts.length} /></strong>
            <span>Posts</span>
          </div>

          <div className="stat-card">
            <strong><StatNumber value={myPublicPosts.length} /></strong>
            <span>Public</span>
          </div>

          <div className="stat-card">
            <strong><StatNumber value={following.length} /></strong>
            <span>Following</span>
          </div>
        </div>
      </section>

      {status && <p className="status">{status}</p>}

      <nav className="profile-tabs" aria-label="Profile sections">
        <button
          type="button"
          className={tab === 'overview' ? 'active' : ''}
          aria-pressed={tab === 'overview'}
          onClick={() => setTab('overview')}
        >
          Overview
        </button>

        <button
          type="button"
          className={tab === 'public' ? 'active' : ''}
          aria-pressed={tab === 'public'}
          onClick={() => setTab('public')}
        >
          Public
        </button>

        <button
          type="button"
          className={tab === 'private' ? 'active' : ''}
          aria-pressed={tab === 'private'}
          onClick={() => setTab('private')}
        >
          Private
        </button>

        <button
          type="button"
          className={tab === 'approved' || tab === 'approved-private' ? 'active' : ''}
          aria-pressed={tab === 'approved' || tab === 'approved-private'}
          onClick={() => setTab('approved')}
        >
          Friends
        </button>
      </nav>

      {tab === 'overview' && (
        <section className="profile-content">
          <div className="profile-card profile-library-card">
            <span className="profile-card-kicker">Your library</span>
            <h3>Worth coming back to.</h3>
            <p>Keep the ideas you love. Share something you’ve learned.</p>
            <div className="profile-shortcuts">
              <button type="button" onClick={() => navigate('/saved')}>Saved posts <span aria-hidden="true">↗</span></button>
              <button type="button" onClick={() => navigate('/create')}>Write a post <span aria-hidden="true">↗</span></button>
            </div>
          </div>

          <div className="profile-card profile-account-card">
            <span className="profile-card-kicker">Profile details</span>
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

          <div className="profile-card profile-learning-card">
            <span className="profile-card-kicker">Keep exploring</span>
            <h3>Pick up your next idea.</h3>
            <p>Follow a learning path or test what you remember.</p>
            <div className="profile-shortcuts">
              <button type="button" onClick={() => navigate('/learn')}>Learning paths <span aria-hidden="true">↗</span></button>
              <button type="button" onClick={() => navigate('/quiz')}>Take a quiz <span aria-hidden="true">↗</span></button>
            </div>
          </div>

          <div className="profile-card profile-delete-card">
            <span className="profile-delete-card-kicker">Your choice</span>
            <h3>Account controls</h3>
            <p>
              Permanently remove your Smarty account and associated account data.
            </p>

            <button
              type="button"
              className="profile-delete-account-btn"
              onClick={openDeleteAccountConfirm}
              disabled={deleteAccountLoading}
              aria-busy={deleteAccountLoading}
            >
              {deleteAccountLoading ? 'Deleting...' : 'Delete account'}
            </button>
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
            <div className="friend-search-heading"><Users size={20}/><div><h2>Find your people.</h2><p>Search for a friend, or someone you’d like to learn from.</p></div></div>

            <div className="friend-search-row">
              <Search size={18} aria-hidden="true"/>
              <input
                type="search" maxLength={100} autoComplete="off"
                value={friendSearch}
                placeholder="Search username or email"
                aria-label="Search for people"
                onChange={(e) => setFriendSearch(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') searchFriends();
                }}
              />

              {friendSearch&&<button type="button" aria-label="Clear people search" onClick={()=>setFriendSearch('')}><X size={17}/></button>}
            </div>
            <p className="friend-search-feedback" role="status">{searchingFriends?'Finding people…':friendSearchError?'':friendSearchComplete?`${friendResults.length} ${friendResults.length===1?'person':'people'} found`:friendSearch.trim().length===1?'Type at least two characters.':'Search by username or email. Results appear as you type.'}</p>
            {status&&<p className="friend-search-feedback" role="status">{status}</p>}
            {friendSearchError&&<div className="community-error" role="alert"><p>{friendSearchError}</p><button type="button" onClick={searchFriends}>Try again</button></div>}
            {searchingFriends&&<div className="friend-search-skeleton" aria-hidden="true"><i/><i/><i/></div>}
            {!searchingFriends&&!friendSearchError&&friendSearchComplete&&friendResults.length===0&&<div className="community-empty"><h3>No people found.</h3><p>Try a username or the full email address.</p></div>}

            {friendResults.length > 0 && (
              <div className="friend-results-list">
                {friendResults.map((item) => {
                  const itemId = item.userId || item.id || item.sub || item.email;

                  return (
                    <FriendResultCard
                      key={itemId || item.email || item.username || item.name}
                      item={item}
                      loadingId={friendActionLoading}
                      onInvite={inviteFriend}
                      onOpen={id=>navigate(`/creator/${encodeURIComponent(id)}`)}
                    />
                  );
                })}
              </div>
            )}
          </div>
          <h2 className="friend-following-heading">Following <span>{following.length}</span></h2>
          {following.length === 0 ? (
            <p className="status">You are not following anyone yet.</p>
          ) : (
            <div className="approved-creators-list">
              {following.map((creator) => {
                const creatorId = creator.userId || creator.followingId || creator.id || creator.sub;

                return (
                  <ApprovedCreatorCard
                    key={creatorId || creator.email || creator.username || creator.name}
                    creator={creator}
                    onOpen={openApprovedCreator}
                  />
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
                        fetchPriority="low"
                        sizes="(max-width: 768px) 92vw, 320px"
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

      {showDeleteAccountConfirm && (
        <DeleteAccountDialog
          name={displayName}
          email={profile?.email}
          confirmation={deleteConfirmationText}
          onConfirmationChange={(value) => {
            setDeleteConfirmationText(value);
            setDeleteAccountError('');
          }}
          busy={deleteAccountLoading}
          error={deleteAccountError}
          onClose={closeDeleteAccountConfirm}
          onDelete={handleDeleteAccount}
        />
      )}

      {editingProfile && <ProfileEditor
        name={newUsername} onNameChange={value => { setNewUsername(value); setProfileEditorError(''); }}
        photo={newPhoto} preview={photoPreview} currentPhoto={profileImageSrc} initials={initials} email={profile?.email}
        onPhotoSelect={handlePhotoSelect}
        onPhotoReset={() => { setNewPhoto(null); setPhotoPreview(''); setProfileEditorError(''); }}
        zoom={cropZoom} x={cropX} y={cropY} onZoomChange={setCropZoom}
        onCropReset={() => { setCropZoom(1); setCropX(50); setCropY(50); }}
        onDragStart={startCropDrag} onDragMove={moveCropDrag} onDragEnd={endCropDrag}
        saving={savingProfile} error={profileEditorError} onSave={saveProfile} onClose={closeProfileEditor}
      />}
    </main>
  );
}
