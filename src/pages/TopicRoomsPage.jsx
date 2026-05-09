import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { roomApi } from '../api/client';
import { useAuth } from '../contexts/AuthContext';
import { connectChatSocket, sendRoomMessage } from '../api/chatSocket';

import './TopicRoomsPage.css';

const ROOM_IMAGE_CACHE_KEY = 'smarty_room_images_v1';
const API_ORIGIN = 'https://po2hwyb2c6.execute-api.us-east-1.amazonaws.com';
const APP_ORIGIN = import.meta.env.PROD
  ? 'https://main.d3qiuefonbp8n9.amplifyapp.com'
  : window.location.origin;

const ROOM_IMAGE_MAX_BYTES = 4 * 1024 * 1024;
const ROOM_IMAGE_PICKER_MAX_BYTES = 8 * 1024 * 1024;
const ROOM_MEDIA_MAX_BYTES = 80 * 1024 * 1024;
const ROOM_LIST_CACHE_MS = 25_000;
const ROOM_MEMBERS_CACHE_MS = 30_000;
const USER_SEARCH_DEBOUNCE_MS = 350;
const ROOM_INVITES_REFRESH_MS = 45_000;
const MAX_RENDERED_MESSAGES = 35;
const MAX_RENDERED_MEDIA_MESSAGES = 80;
const MAX_RENDERED_ROOMS = 50;
const ROOM_IMAGE_EAGER_LIMIT = 4;
const ROOM_IMAGE_RENDER_LIMIT = 16;

const ROOM_MEDIA_IMAGE_EXTENSIONS = /\.(jpg|jpeg|png|webp|gif|avif)(\?|#|$)/i;
const ROOM_MEDIA_VIDEO_EXTENSIONS = /\.(mp4|webm|mov|m4v)(\?|#|$)/i;
const ROOM_MEDIA_DOCUMENT_EXTENSIONS = /\.(pdf|doc|docx|ppt|pptx|xls|xlsx|csv|txt|rtf|zip|rar)(\?|#|$)/i;
const ROOM_MEDIA_ALLOWED_TYPES = /^(image\/|video\/|application\/pdf|application\/msword|application\/vnd\.openxmlformats-officedocument|application\/vnd\.ms-|text\/plain|text\/csv|application\/zip|application\/x-zip-compressed|application\/x-rar-compressed)/i;

function getStoredRoomImages() {
  try {
    return JSON.parse(localStorage.getItem(ROOM_IMAGE_CACHE_KEY) || '{}');
  } catch {
    return {};
  }
}

function persistStoredRoomImage(roomId, imageUrl) {
  if (!roomId || !imageUrl) return;

  try {
    const current = getStoredRoomImages();
    current[roomId] = imageUrl;
    localStorage.setItem(ROOM_IMAGE_CACHE_KEY, JSON.stringify(current));
  } catch {
    // Ignore storage errors.
  }
}

function removeStoredRoomImage(roomId) {
  if (!roomId) return;

  try {
    const current = getStoredRoomImages();
    delete current[roomId];
    localStorage.setItem(ROOM_IMAGE_CACHE_KEY, JSON.stringify(current));
  } catch {
    // Ignore storage errors.
  }
}

function normalizeRoomImageUrl(imageUrl) {
  const cleanUrl = String(imageUrl || '').trim();
  if (!cleanUrl) return '';

  if (cleanUrl.startsWith('blob:') || cleanUrl.startsWith('data:')) return cleanUrl;
  if (/^https?:\/\//i.test(cleanUrl)) return cleanUrl;

  if (cleanUrl.startsWith('//')) {
    return `${window.location.protocol}${cleanUrl}`;
  }

  if (cleanUrl.startsWith('/')) {
    return `${API_ORIGIN}${cleanUrl}`;
  }

  return cleanUrl;
}

function parseApiPayload(payload) {
  let parsedPayload = payload;

  try {
    parsedPayload = typeof payload === 'string' ? JSON.parse(payload) : payload;
  } catch {
    parsedPayload = payload;
  }

  let parsedBody = parsedPayload?.body;

  try {
    parsedBody = typeof parsedBody === 'string' ? JSON.parse(parsedBody) : parsedBody;
  } catch {
    parsedBody = parsedPayload?.body;
  }

  return {
    payload: parsedPayload,
    body: parsedBody,
  };
}

function getUploadedRoomImageUrl(uploadResponse) {
  const { payload, body } = parseApiPayload(uploadResponse);

  return normalizeRoomImageUrl(
    payload?.imageUrl ||
      payload?.roomImageUrl ||
      payload?.coverImageUrl ||
      payload?.room?.imageUrl ||
      payload?.room?.roomImageUrl ||
      payload?.room?.coverImageUrl ||
      payload?.url ||
      payload?.location ||
      payload?.data?.imageUrl ||
      payload?.data?.roomImageUrl ||
      payload?.data?.coverImageUrl ||
      payload?.data?.room?.imageUrl ||
      payload?.data?.room?.roomImageUrl ||
      payload?.data?.room?.coverImageUrl ||
      payload?.data?.url ||
      payload?.data?.location ||
      body?.imageUrl ||
      body?.roomImageUrl ||
      body?.coverImageUrl ||
      body?.room?.imageUrl ||
      body?.room?.roomImageUrl ||
      body?.room?.coverImageUrl ||
      body?.url ||
      body?.location ||
      body?.data?.imageUrl ||
      body?.data?.roomImageUrl ||
      body?.data?.coverImageUrl ||
      body?.data?.room?.imageUrl ||
      body?.data?.room?.roomImageUrl ||
      body?.data?.room?.coverImageUrl ||
      body?.data?.url ||
      body?.data?.location ||
      ''
  );
}

function getApproxBase64SizeBytes(base64Value) {
  const cleanBase64 = String(base64Value || '')
    .replace(/^data:[^,]+,/, '')
    .replace(/\s/g, '');

  if (!cleanBase64) return 0;

  const padding = cleanBase64.endsWith('==') ? 2 : cleanBase64.endsWith('=') ? 1 : 0;

  return Math.max(0, Math.floor((cleanBase64.length * 3) / 4) - padding);
}

function validatePreparedRoomImagePayload(payload) {
  if (!payload?.imageBase64) {
    throw new Error('Image data is missing');
  }

  if (getApproxBase64SizeBytes(payload.imageBase64) > ROOM_IMAGE_MAX_BYTES) {
    throw new Error('Image must be smaller than 4 MB after optimization');
  }

  return payload;
}

function normalizeRoomMessageMedia(message = {}) {
  const mediaUrl = message.mediaUrl || message.fileUrl || message.url || '';
  const contentType = message.contentType || '';
  const fileName = message.fileName || message.mediaName || '';
  const lowerUrl = String(mediaUrl || fileName || '').toLowerCase();

  let mediaType = message.mediaType || '';

  if (!mediaType && mediaUrl) {
    if (String(contentType).startsWith('image/') || ROOM_MEDIA_IMAGE_EXTENSIONS.test(lowerUrl)) {
      mediaType = 'image';
    } else if (String(contentType).startsWith('video/') || ROOM_MEDIA_VIDEO_EXTENSIONS.test(lowerUrl)) {
      mediaType = 'video';
    } else if (ROOM_MEDIA_DOCUMENT_EXTENSIONS.test(lowerUrl) || ROOM_MEDIA_ALLOWED_TYPES.test(String(contentType))) {
      mediaType = 'file';
    }
  }

  if (mediaType !== 'image' && mediaType !== 'video' && mediaType !== 'file') {
    mediaType = '';
  }

  return {
    ...message,
    mediaKey: message.mediaKey || message.key || '',
    mediaUrl,
    fileUrl: message.fileUrl || mediaUrl,
    mediaType,
    contentType,
    fileName,
    mediaName: message.mediaName || fileName,
  };
}

function getShortRoomFileName(name = '') {
  const cleanName = String(name || 'Attachment').trim() || 'Attachment';
  if (cleanName.length <= 34) return cleanName;

  const extension = cleanName.includes('.') ? `.${cleanName.split('.').pop()}` : '';
  const baseName = extension ? cleanName.slice(0, -extension.length) : cleanName;

  return `${baseName.slice(0, 24)}…${extension}`;
}

function isRoomOwner(room, userId) {
  return Boolean(room && userId && (room.ownerId === userId || room.createdBy === userId));
}

function dedupeMessages(messages = []) {
  const seen = new Set();
  const unique = [];

  for (const msg of messages) {
    const key =
      msg.messageId ||
      msg.clientId ||
      `${msg.createdAt || 'msg'}-${msg.senderId || 'user'}-${msg.text || msg.message || ''}`;

    if (!key || seen.has(key)) continue;

    seen.add(key);
    unique.push(msg);
  }

  return unique;
}

function getLoadedRoomMessages(data) {
  const loadedMessages = Array.isArray(data?.messages)
    ? data.messages
    : Array.isArray(data)
      ? data
      : [];

  return loadedMessages.map(normalizeRoomMessageMedia).slice(-MAX_RENDERED_MEDIA_MESSAGES);
}

function areRoomsEqualForList(currentRoom, nextRoom) {
  return (
    currentRoom.roomId === nextRoom.roomId &&
    currentRoom.imageUrl === nextRoom.imageUrl &&
    currentRoom.roomImageUrl === nextRoom.roomImageUrl &&
    currentRoom.coverImageUrl === nextRoom.coverImageUrl &&
    currentRoom.memberCount === nextRoom.memberCount &&
    currentRoom.name === nextRoom.name &&
    currentRoom.privacy === nextRoom.privacy &&
    currentRoom.ownerId === nextRoom.ownerId &&
    currentRoom.createdBy === nextRoom.createdBy
  );
}

function areRoomListsEqual(currentRooms = [], nextRooms = []) {
  return (
    currentRooms.length === nextRooms.length &&
    currentRooms.every((room, index) => areRoomsEqualForList(room, nextRooms[index]))
  );
}

function getRoomImagePatch(imageUrl) {
  return {
    imageUrl,
    roomImageUrl: imageUrl,
    coverImageUrl: imageUrl,
  };
}

function getRoomInviteRoomId(invite) {
  if (typeof invite === 'string') return invite;

  return (
    invite?.roomId ||
    invite?.topicRoomId ||
    invite?.groupId ||
    invite?.room?.roomId ||
    invite?.room?.id ||
    invite?.id ||
    ''
  );
}

export default function TopicRoomsPage() {
  const { user } = useAuth();
  const userId = user?.id || user?.userId || user?.sub;

  const [roomImageCache, setRoomImageCache] = useState(() => getStoredRoomImages());
  const [failedRoomImages, setFailedRoomImages] = useState(() => ({}));
  const [mobileChatOpen, setMobileChatOpen] = useState(false);
  const [hiddenRooms, setHiddenRooms] = useState([]);
  const [showHidden, setShowHidden] = useState(false);
  const [roomsLoading, setRoomsLoading] = useState(false);
  const [messagesLoading, setMessagesLoading] = useState(false);
  const [roomInvites, setRoomInvites] = useState([]);
  const [showRoomInvites, setShowRoomInvites] = useState(false);
  const [roomInvitesLoading, setRoomInvitesLoading] = useState(false);
  const [processingInviteId, setProcessingInviteId] = useState('');
  const [inviteLinkLoading, setInviteLinkLoading] = useState(false);
  const [inviteLinkDisabling, setInviteLinkDisabling] = useState(false);
  const [inviteLinkModalOpen, setInviteLinkModalOpen] = useState(false);
  const [inviteLinkAutoAccept, setInviteLinkAutoAccept] = useState(false);
  const [generatedInviteLink, setGeneratedInviteLink] = useState('');
  const [generatedInviteCode, setGeneratedInviteCode] = useState('');
  const [inviteLinkCopied, setInviteLinkCopied] = useState(false);
  const [rooms, setRooms] = useState([]);
  const [roomUnreadCounts, setRoomUnreadCounts] = useState({});
  const [activeRoom, setActiveRoom] = useState(null);
  const [messages, setMessages] = useState([]);
  const [text, setText] = useState('');
  const [selectedMediaFile, setSelectedMediaFile] = useState(null);
  const [selectedMediaPreview, setSelectedMediaPreview] = useState('');
  const [selectedMediaType, setSelectedMediaType] = useState('');
  const [uploadingMedia, setUploadingMedia] = useState(false);
  const [mediaUploadProgress, setMediaUploadProgress] = useState(0);
  const [mediaViewer, setMediaViewer] = useState(null);
  const [mediaViewerReturnToGrid, setMediaViewerReturnToGrid] = useState(false);
  const [showRoomMediaGrid, setShowRoomMediaGrid] = useState(false);
  const [showInvite, setShowInvite] = useState(false);
  const [inviteSearch, setInviteSearch] = useState('');
  const [inviteResults, setInviteResults] = useState([]);
  const [pendingInviteUserIds, setPendingInviteUserIds] = useState(() => new Set());
  const [newRoomName, setNewRoomName] = useState('');
  const [newRoomPrivacy, setNewRoomPrivacy] = useState('public');
  const [newRoomImageFile, setNewRoomImageFile] = useState(null);
  const [newRoomImagePreview, setNewRoomImagePreview] = useState('');
  const [uploadingRoomImageId, setUploadingRoomImageId] = useState('');
  const [renamingRoomId, setRenamingRoomId] = useState('');
  const [showEditRoomModal, setShowEditRoomModal] = useState(false);
  const [editRoomTarget, setEditRoomTarget] = useState(null);
  const [editRoomName, setEditRoomName] = useState('');
  const [editRoomImageFile, setEditRoomImageFile] = useState(null);
  const [editRoomImagePreview, setEditRoomImagePreview] = useState('');
  const [editRoomSaving, setEditRoomSaving] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showRoomMenu, setShowRoomMenu] = useState(false);
  const [showActiveRoomMenu, setShowActiveRoomMenu] = useState(false);
  const [showActiveRoomInfo, setShowActiveRoomInfo] = useState(false);
  const [activeInfoSection, setActiveInfoSection] = useState('');
  const [openRoomActionMenuId, setOpenRoomActionMenuId] = useState('');
  const [roomSearch, setRoomSearch] = useState('');
  const [roomPrivacyFilter, setRoomPrivacyFilter] = useState('private');
  const [modalTitle, setModalTitle] = useState('Group Members');
  const [modalMode, setModalMode] = useState('members');
  const [modalRoom, setModalRoom] = useState(null);
  const [members, setMembers] = useState([]);
  const [showMembers, setShowMembers] = useState(false);
  const [status, setStatus] = useState('');
  const [creatingRoom, setCreatingRoom] = useState(false);

  const activeRoomRef = useRef(null);
  const messagesRef = useRef(null);
  const mountedRef = useRef(true);
  const loadingRoomRef = useRef(false);
  const roomsLoadingRef = useRef(false);
  const roomsLoadInFlightKeyRef = useRef('');
  const initialRoomsLoadedForUserRef = useRef('');
  const roomsCacheRef = useRef({ key: '', timestamp: 0, rooms: [] });
  const pendingRoomsReloadRef = useRef(false);
  const activeRoomImageUrlRef = useRef('');
  const membersCacheRef = useRef({});
  const joinRequestsCacheRef = useRef({});
  const userSearchCacheRef = useRef({});
  const userSearchTimerRef = useRef(null);
  const inviteCopiedTimerRef = useRef(null);
  const roomInvitesLoadingRef = useRef(false);
  const sendingMessageRef = useRef(false);
  const mediaViewerTouchStartRef = useRef(null);
  const mediaViewerVideoRef = useRef(null);
  const roomMenuRef = useRef(null);
  const roomActionMenuRef = useRef(null);
  const activeRoomMenuRef = useRef(null);

  const getRoomImageUrl = useCallback((room) => {
    if (!room?.roomId) return '';

    const imageUrl = normalizeRoomImageUrl(
      room.imageUrl ||
        room.roomImageUrl ||
        room.coverImageUrl ||
        room.avatarUrl ||
        room.coverUrl ||
        roomImageCache[room.roomId] ||
        ''
    );

    if (!imageUrl) return '';
    if (failedRoomImages[room.roomId] === imageUrl) return '';

    return imageUrl;
  }, [failedRoomImages, roomImageCache]);

  const sortedVisibleRooms = useMemo(() => {
    const normalizedSearch = roomSearch.trim().toLowerCase();

    return rooms
      .filter((room) =>
        roomPrivacyFilter === 'private'
          ? room.privacy === 'private'
          : room.privacy !== 'private'
      )
      .filter((room) => {
        if (!normalizedSearch) return true;
        return String(room.name || '').toLowerCase().includes(normalizedSearch);
      })
      .slice(0, MAX_RENDERED_ROOMS);
  }, [rooms, roomPrivacyFilter, roomSearch]);

  const renderedMessages = useMemo(() => {
    if (!Array.isArray(messages) || messages.length === 0) return [];

    const uniqueMessages = dedupeMessages(messages);

    return uniqueMessages.length > MAX_RENDERED_MESSAGES
      ? uniqueMessages.slice(-MAX_RENDERED_MESSAGES)
      : uniqueMessages;
  }, [messages]);

  const activeRoomImageUrl = useMemo(
    () => getRoomImageUrl(activeRoom),
    [activeRoom, getRoomImageUrl]
  );

  const renderedMediaMessages = useMemo(() => {
    const seen = new Set();
    const mediaItems = [];

    for (let index = messages.length - 1; index >= 0; index -= 1) {
      const normalized = normalizeRoomMessageMedia(messages[index]);
      const mediaUrl = normalized.mediaUrl || normalized.fileUrl || '';

      if (
        !mediaUrl ||
        (normalized.mediaType !== 'image' &&
          normalized.mediaType !== 'video' &&
          normalized.mediaType !== 'file')
      ) {
        continue;
      }

      const key = normalized.messageId || normalized.clientId || mediaUrl;
      if (seen.has(key)) continue;

      seen.add(key);
      mediaItems.unshift(normalized);

      if (mediaItems.length >= MAX_RENDERED_MEDIA_MESSAGES) break;
    }

    return mediaItems;
  }, [messages]);

  const viewableMediaMessages = useMemo(
    () => renderedMediaMessages.filter((item) => item.mediaType === 'image' || item.mediaType === 'video'),
    [renderedMediaMessages]
  );

  const mediaViewerCount = viewableMediaMessages.length;

  const activeRoomCanEdit = useMemo(
    () => activeRoom?.type === 'custom' && isRoomOwner(activeRoom, userId),
    [activeRoom, userId]
  );

  useEffect(() => {
    activeRoomImageUrlRef.current = activeRoomImageUrl;
  }, [activeRoomImageUrl]);

  useEffect(() => {
    activeRoomRef.current = activeRoom;
  }, [activeRoom]);

  useEffect(() => {
    mountedRef.current = true;

    return () => {
      mountedRef.current = false;
    };
  }, []);

  const scrollMessagesToBottom = useCallback(() => {
    const el = messagesRef.current;
    if (!el) return;

    requestAnimationFrame(() => {
      el.scrollTop = el.scrollHeight;
    });
  }, []);

  useEffect(() => {
    if (!activeRoom) return;
    scrollMessagesToBottom();
  }, [activeRoom, renderedMessages.length, scrollMessagesToBottom]);

  useEffect(() => {
    if (!activeRoom) return undefined;

    const handleViewportResize = () => {
      scrollMessagesToBottom();
    };

    window.visualViewport?.addEventListener('resize', handleViewportResize);
    window.addEventListener('resize', handleViewportResize);

    return () => {
      window.visualViewport?.removeEventListener('resize', handleViewportResize);
      window.removeEventListener('resize', handleViewportResize);
    };
  }, [activeRoom, scrollMessagesToBottom]);

  useEffect(() => {
    const handleOutsidePointerDown = (event) => {
      const target = event.target;

      if (roomMenuRef.current && !roomMenuRef.current.contains(target)) {
        setShowRoomMenu(false);
      }

      if (roomActionMenuRef.current && !roomActionMenuRef.current.contains(target)) {
        setOpenRoomActionMenuId('');
      }

      if (activeRoomMenuRef.current && !activeRoomMenuRef.current.contains(target)) {
        setShowActiveRoomMenu(false);
      }
    };

    document.addEventListener('pointerdown', handleOutsidePointerDown);

    return () => {
      document.removeEventListener('pointerdown', handleOutsidePointerDown);
    };
  }, []);

  useEffect(() => {
    return () => {
      if (newRoomImagePreview?.startsWith('blob:')) {
        URL.revokeObjectURL(newRoomImagePreview);
      }
    };
  }, [newRoomImagePreview]);

  useEffect(() => {
    return () => {
      if (editRoomImagePreview?.startsWith('blob:')) {
        URL.revokeObjectURL(editRoomImagePreview);
      }
    };
  }, [editRoomImagePreview]);

  useEffect(() => {
    return () => {
      if (userSearchTimerRef.current) {
        window.clearTimeout(userSearchTimerRef.current);
      }
    };
  }, []);

  useEffect(() => {
    return () => {
      if (inviteCopiedTimerRef.current) {
        window.clearTimeout(inviteCopiedTimerRef.current);
        inviteCopiedTimerRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    return () => {
      if (selectedMediaPreview?.startsWith('blob:')) {
        URL.revokeObjectURL(selectedMediaPreview);
      }
    };
  }, [selectedMediaPreview]);

  function removeSelectedMedia() {
    if (selectedMediaPreview?.startsWith('blob:')) {
      URL.revokeObjectURL(selectedMediaPreview);
    }

    setSelectedMediaFile(null);
    setSelectedMediaPreview('');
    setSelectedMediaType('');
    setMediaUploadProgress(0);
  }





  function handleRoomMediaChange(event) {
    const file = event.target.files?.[0] || null;
    event.target.value = '';

    removeSelectedMedia();

    if (!file) return;

    const fileType = String(file.type || '').toLowerCase();
    const lowerName = String(file.name || '').toLowerCase();
    const isImage = fileType.startsWith('image/') || ROOM_MEDIA_IMAGE_EXTENSIONS.test(lowerName);
    const isVideo = fileType.startsWith('video/') || ROOM_MEDIA_VIDEO_EXTENSIONS.test(lowerName);
    const isFile =
      !isImage &&
      !isVideo &&
      (ROOM_MEDIA_ALLOWED_TYPES.test(fileType) || ROOM_MEDIA_DOCUMENT_EXTENSIONS.test(lowerName));

    if (!isImage && !isVideo && !isFile) {
      setStatus('Only images, videos, PDFs, documents, spreadsheets, text files, and zip files are allowed.');
      return;
    }

    if (file.size > ROOM_MEDIA_MAX_BYTES) {
      setStatus('Media must be smaller than 80 MB.');
      return;
    }

    setStatus('');
    setSelectedMediaFile(file);
    setSelectedMediaType(isVideo ? 'video' : isImage ? 'image' : 'file');
    setSelectedMediaPreview(URL.createObjectURL(file));
  }

  function openMediaViewer(message, options = {}) {
    const normalizedMessage = normalizeRoomMessageMedia(message);
    const mediaUrl = normalizedMessage.mediaUrl || normalizedMessage.fileUrl || '';

    if (!mediaUrl) return;

    if (normalizedMessage.mediaType === 'file') {
      const openedWindow = window.open(mediaUrl, '_blank', 'noopener,noreferrer');

      if (!openedWindow) {
        setStatus('Pop-up blocked. Please allow pop-ups to open this file.');
      }

      return;
    }

    if (normalizedMessage.mediaType !== 'image' && normalizedMessage.mediaType !== 'video') return;

    const mediaIndex = viewableMediaMessages.findIndex((item) => {
      const itemUrl = item.mediaUrl || item.fileUrl || '';

      return (
        item.messageId === normalizedMessage.messageId ||
        item.clientId === normalizedMessage.clientId ||
        itemUrl === mediaUrl
      );
    });

    setMediaViewerReturnToGrid(Boolean(options.fromGrid));
    setMediaViewer({
      index: mediaIndex >= 0 ? mediaIndex : 0,
      openedAt: Date.now(),
    });
  }

  function closeMediaViewer() {
    setMediaViewer(null);
    setMediaViewerReturnToGrid(false);
  }

  function backToRoomMediaGrid() {
    setMediaViewer(null);
    setMediaViewerReturnToGrid(false);
    setShowRoomMediaGrid(true);
  }

  function openRoomMediaGrid(event) {
    event?.preventDefault?.();
    event?.stopPropagation?.();
    event?.nativeEvent?.stopImmediatePropagation?.();

    setShowActiveRoomMenu(false);
    setShowRoomMenu(false);
    setOpenRoomActionMenuId('');
    setMediaViewer(null);
    setMediaViewerReturnToGrid(false);
    setShowRoomMediaGrid(true);
  }

  function closeRoomMediaGrid() {
    setShowRoomMediaGrid(false);
    setMediaViewerReturnToGrid(false);
  }

  function openActiveRoomInfo(event) {
    event?.preventDefault?.();
    event?.stopPropagation?.();

    if (!activeRoom) return;

    setShowActiveRoomMenu(false);
    setOpenRoomActionMenuId('');
    setShowRoomMenu(false);
    setActiveInfoSection('media');
    setShowActiveRoomInfo(true);
  }

  async function toggleActiveInfoSection(section) {
    if (!activeRoom?.roomId) return;

    const nextSection = activeInfoSection === section ? '' : section;
    setActiveInfoSection(nextSection);

    if (!nextSection) return;

    if (section === 'members') {
      await openMembers(activeRoom);
      setShowMembers(false);
      setShowActiveRoomInfo(true);
      setModalRoom(activeRoom);
      setModalMode('members');
      return;
    }

    if (section === 'requests') {
      await openJoinRequests(activeRoom);
      setShowMembers(false);
      setShowActiveRoomInfo(true);
      setModalRoom(activeRoom);
      setModalMode('requests');
      return;
    }

    if (section === 'invite') {
      setInviteLinkModalOpen(false);
      setShowActiveRoomInfo(true);
    }
  }

  function openMediaFromGrid(message) {
    const normalizedMessage = normalizeRoomMessageMedia(message);

    if (normalizedMessage.mediaType === 'file') {
      const fileUrl = normalizedMessage.mediaUrl || normalizedMessage.fileUrl;

      if (fileUrl) {
        const openedWindow = window.open(fileUrl, '_blank', 'noopener,noreferrer');

        if (!openedWindow) {
          setStatus('Pop-up blocked. Please allow pop-ups to open this file.');
        }
      }

      return;
    }

    setShowRoomMediaGrid(false);
    openMediaViewer(normalizedMessage, { fromGrid: true });
  }

  function openMediaGridFromMessage(message) {
    const normalizedMessage = normalizeRoomMessageMedia(message);
    const mediaUrl = normalizedMessage.mediaUrl || normalizedMessage.fileUrl || '';

    if (!mediaUrl) return;

    if (normalizedMessage.mediaType === 'file') {
      openMediaViewer(normalizedMessage);
      return;
    }

    if (normalizedMessage.mediaType !== 'image' && normalizedMessage.mediaType !== 'video') return;

    setMediaViewer(null);
    setMediaViewerReturnToGrid(false);
    setShowRoomMediaGrid(true);
  }

  const moveMediaViewer = useCallback((direction) => {
    if (!viewableMediaMessages.length) return;

    setMediaViewer((current) => {
      if (!current) return current;

      const currentIndex = Math.min(
        Math.max(Number(current.index || 0), 0),
        viewableMediaMessages.length - 1
      );

      const nextIndex =
        (currentIndex + direction + viewableMediaMessages.length) %
        viewableMediaMessages.length;

      return {
        ...current,
        index: nextIndex,
        openedAt: Date.now(),
      };
    });
  }, [viewableMediaMessages.length]);

  function handleMediaViewerTouchStart(event) {
    const touch = event.touches?.[0];
    if (!touch) return;

    mediaViewerTouchStartRef.current = {
      x: touch.clientX,
      y: touch.clientY,
    };
  }

  function handleMediaViewerTouchEnd(event) {
    const start = mediaViewerTouchStartRef.current;
    const touch = event.changedTouches?.[0];
    mediaViewerTouchStartRef.current = null;

    if (!start || !touch) return;

    const deltaX = touch.clientX - start.x;
    const deltaY = touch.clientY - start.y;

    if (Math.abs(deltaX) < 45 || Math.abs(deltaX) < Math.abs(deltaY)) return;

    moveMediaViewer(deltaX < 0 ? 1 : -1);
  }

  const activeMediaViewerItem = mediaViewer
    ? viewableMediaMessages[
        Math.min(
          Math.max(Number(mediaViewer.index || 0), 0),
          Math.max(viewableMediaMessages.length - 1, 0)
        )
      ] || null
    : null;

  useEffect(() => {
    if (!mediaViewer) return;

    if (!mediaViewerCount) {
      setMediaViewer(null);
      return;
    }

    const safeIndex = Math.min(
      Math.max(Number(mediaViewer.index || 0), 0),
      mediaViewerCount - 1
    );

    if (safeIndex !== mediaViewer.index) {
      setMediaViewer((current) => (current ? { ...current, index: safeIndex } : current));
    }
  }, [mediaViewer, mediaViewerCount]);

  useEffect(() => {
    if (!activeMediaViewerItem || activeMediaViewerItem.mediaType !== 'video') return;

    const video = mediaViewerVideoRef.current;
    if (!video) return;

    video.currentTime = 0;
    const playPromise = video.play?.();
    playPromise?.catch?.(() => {});
  }, [
    activeMediaViewerItem?.messageId,
    activeMediaViewerItem?.clientId,
    activeMediaViewerItem?.mediaUrl,
    activeMediaViewerItem?.fileUrl,
    activeMediaViewerItem?.mediaType,
    mediaViewer?.openedAt,
  ]);

  useEffect(() => {
    if (!mediaViewer) return undefined;

    const handleViewerKeyDown = (event) => {
      if (event.key === 'ArrowLeft') {
        event.preventDefault();
        moveMediaViewer(-1);
      }

      if (event.key === 'ArrowRight') {
        event.preventDefault();
        moveMediaViewer(1);
      }

      if (event.key === 'Escape') {
        event.preventDefault();
        closeMediaViewer();
      }
    };

    window.addEventListener('keydown', handleViewerKeyDown);

    return () => {
      window.removeEventListener('keydown', handleViewerKeyDown);
    };
  }, [mediaViewer, moveMediaViewer]);

  async function loadRooms(searchValue = roomSearch, options = {}) {
    const normalizedSearch = String(searchValue || '').trim().toLowerCase();
    const cacheKey = normalizedSearch;
    const force = Boolean(options.force);
    const now = Date.now();
    const cached = roomsCacheRef.current;

    if (
      !force &&
      cached.key === cacheKey &&
      cached.rooms.length > 0 &&
      now - cached.timestamp < ROOM_LIST_CACHE_MS
    ) {
      if (mountedRef.current) setRooms(cached.rooms);
      return;
    }

    if (roomsLoadingRef.current) {
      if (roomsLoadInFlightKeyRef.current === cacheKey) return;

      pendingRoomsReloadRef.current = true;
      return;
    }

    roomsLoadingRef.current = true;
    roomsLoadInFlightKeyRef.current = cacheKey;

    try {
      setStatus('');
      setRoomsLoading(true);

      const data = await roomApi.getRooms({ search: normalizedSearch });

      if (!mountedRef.current) return;

      const cachedRoomImages = getStoredRoomImages();

      setRoomImageCache((prev) => {
        const prevKeys = Object.keys(prev);
        const nextKeys = Object.keys(cachedRoomImages);

        if (
          prevKeys.length === nextKeys.length &&
          nextKeys.every((key) => prev[key] === cachedRoomImages[key])
        ) {
          return prev;
        }

        return cachedRoomImages;
      });

      const allRoomsRaw = Array.isArray(data?.rooms) ? data.rooms : Array.isArray(data) ? data : [];

      const allRooms = allRoomsRaw.map((room) => {
        const cachedImageUrl = cachedRoomImages[room.roomId];

        const imageUrl = normalizeRoomImageUrl(
          room.imageUrl ||
            room.roomImageUrl ||
            room.avatarUrl ||
            room.coverImageUrl ||
            room.coverUrl ||
            cachedImageUrl ||
            ''
        );

        return {
          ...room,
          imageUrl,
          roomImageUrl: room.roomImageUrl || imageUrl,
          coverImageUrl: room.coverImageUrl || imageUrl,
        };
      });

      const visibleRooms = allRooms.filter((room) => {
        const isOwner = isRoomOwner(room, userId);

        if (isOwner) return true;
        if (!normalizedSearch) return true;

        return String(room.name || '').toLowerCase().includes(normalizedSearch);
      });

      visibleRooms.sort((a, b) => {
        const aOwner = isRoomOwner(a, userId);
        const bOwner = isRoomOwner(b, userId);

        if (aOwner && !bOwner) return -1;
        if (!aOwner && bOwner) return 1;

        return Number(b.createdAt || 0) - Number(a.createdAt || 0);
      });

      roomsCacheRef.current = {
        key: cacheKey,
        timestamp: Date.now(),
        rooms: visibleRooms,
      };

      setRooms((prev) => (areRoomListsEqual(prev, visibleRooms) ? prev : visibleRooms));
    } catch (err) {
      console.error(err);
      if (mountedRef.current) setStatus('Failed to load rooms');
    } finally {
      roomsLoadingRef.current = false;
      roomsLoadInFlightKeyRef.current = '';

      if (mountedRef.current) setRoomsLoading(false);

      if (pendingRoomsReloadRef.current) {
        pendingRoomsReloadRef.current = false;

        window.setTimeout(() => {
          if (mountedRef.current) loadRooms(roomSearch, { force: true });
        }, 100);
      }
    }
  }

  useEffect(() => {
    if (!userId) return;
    if (initialRoomsLoadedForUserRef.current === userId) return;

    initialRoomsLoadedForUserRef.current = userId;
    loadRooms('', { force: true });
  }, [userId]);

  useEffect(() => {
    if (!userId) return undefined;

    const loadInitialInvites = () => loadRoomInvites(false);

    if ('requestIdleCallback' in window) {
      window.requestIdleCallback(loadInitialInvites, { timeout: 2500 });
    } else {
      window.setTimeout(loadInitialInvites, 800);
    }

    const intervalId = window.setInterval(() => {
      if (document.visibilityState === 'visible') {
        loadRoomInvites(false);
      }
    }, ROOM_INVITES_REFRESH_MS);

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        loadRoomInvites(false);
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      window.clearInterval(intervalId);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [userId]);

  useEffect(() => {
    if (!userId) return undefined;

    const unsubscribe = connectChatSocket(userId, (data) => {
      if (!mountedRef.current) return;

      const msg = data?.message ? normalizeRoomMessageMedia(data.message) : null;
      const current = activeRoomRef.current;

      if (data.type === 'roomInvite' && data.invite) {
        const invite = data.invite;
        const inviteRoomId = getRoomInviteRoomId(invite);

        if (inviteRoomId) {
          setRoomInvites((prev) => {
            if (prev.some((item) => getRoomInviteRoomId(item) === inviteRoomId)) {
              return prev;
            }

            return [invite, ...prev];
          });
        }

        return;
      }

      if (!msg) return;

      if (data.type === 'messageAck') {
        if (!msg.clientId) return;

        setMessages((prev) => {
          const index = prev.findIndex(
            (m) =>
              m.clientId === msg.clientId ||
              m.messageId === msg.clientId ||
              (msg.messageId && m.messageId === msg.messageId)
          );

          if (index === -1) {
            const alreadyExists = prev.some(
              (m) =>
                (msg.messageId && m.messageId === msg.messageId) ||
                (msg.clientId && m.clientId === msg.clientId)
            );

            return alreadyExists
              ? prev
              : [
                  ...prev.slice(-(MAX_RENDERED_MEDIA_MESSAGES - 1)),
                  normalizeRoomMessageMedia({ ...msg, pending: false, failed: false }),
                ];
          }

          const copy = [...prev];
          const existingMessage = copy[index] || {};

          copy[index] = normalizeRoomMessageMedia({
            ...existingMessage,
            ...msg,
            mediaKey: msg.mediaKey || existingMessage.mediaKey || '',
            mediaUrl: msg.mediaUrl || existingMessage.mediaUrl || existingMessage.fileUrl || '',
            fileUrl: msg.fileUrl || msg.mediaUrl || existingMessage.fileUrl || existingMessage.mediaUrl || '',
            mediaType: msg.mediaType || existingMessage.mediaType || '',
            contentType: msg.contentType || existingMessage.contentType || '',
            fileName: msg.fileName || existingMessage.fileName || existingMessage.mediaName || '',
            mediaName: msg.mediaName || msg.fileName || existingMessage.mediaName || existingMessage.fileName || '',
            pending: false,
            failed: false,
          });

          return copy;
        });

        return;
      }

      if (data.type !== 'roomMessage') return;
      if (msg.senderId === userId && msg.clientId) return;

      if (!current || msg.roomId !== current.roomId) {
        if (msg.senderId !== userId && msg.roomId) {
          setRoomUnreadCounts((prev) => ({
            ...prev,
            [msg.roomId]: Number(prev[msg.roomId] || 0) + 1,
          }));
        }

        return;
      }

      setMessages((prev) => {
        const key = msg.messageId || msg.clientId;
        if (!key) return prev;

        if (
          prev.some(
            (m) =>
              m.messageId === msg.messageId ||
              m.clientId === msg.clientId ||
              (m.messageId || m.clientId) === key
          )
        ) {
          return prev;
        }

        return [...prev.slice(-(MAX_RENDERED_MEDIA_MESSAGES - 1)), normalizeRoomMessageMedia(msg)];
      });
    });

    return () => {
      if (typeof unsubscribe === 'function') unsubscribe();
    };
  }, [userId]);

  async function createRoom(e) {
    e.preventDefault();

    if (creatingRoom) return false;
    setCreatingRoom(true);

    const name = newRoomName.trim().replace(/\s+/g, ' ');

    if (!name) {
      setStatus('Room name required');
      setCreatingRoom(false);
      return false;
    }

    try {
      setStatus('');

      const data = await roomApi.createRoom({
        name,
        privacy: newRoomPrivacy,
      });

      const { payload: parsedData, body: parsedBody } = parseApiPayload(data);

      const createdRoom =
        parsedData?.room ||
        parsedData?.data?.room ||
        parsedData?.Item ||
        parsedBody?.room ||
        parsedBody?.data?.room ||
        parsedBody?.Item ||
        parsedData;

      if (!createdRoom?.roomId) {
        console.error('Create room returned unexpected response:', data);
        setStatus('Room was created, but the response format was unexpected. Refreshing rooms...');
        await loadRooms(roomSearch, { force: true });
        return false;
      }

      let finalCreatedRoom = createdRoom;
      let roomImageUploadFailed = false;

      if (newRoomImageFile) {
        try {
          const optimizedImage = validatePreparedRoomImagePayload(
            await prepareRoomImageFile(newRoomImageFile)
          );

          const imageData = await roomApi.uploadRoomImage(createdRoom.roomId, optimizedImage);
          const imageUrl = getUploadedRoomImageUrl(imageData);

          if (imageUrl) {
            persistStoredRoomImage(createdRoom.roomId, imageUrl);

            setFailedRoomImages((prev) => {
              if (!prev[createdRoom.roomId]) return prev;

              const next = { ...prev };
              delete next[createdRoom.roomId];
              return next;
            });

            setRoomImageCache((prev) => ({
              ...prev,
              [createdRoom.roomId]: imageUrl,
            }));

            finalCreatedRoom = {
              ...createdRoom,
              ...getRoomImagePatch(imageUrl),
            };

            setRooms((prev) =>
              prev.map((item) =>
                item.roomId === createdRoom.roomId
                  ? { ...item, ...getRoomImagePatch(imageUrl) }
                  : item
              )
            );
          } else {
            setStatus('Room created, but no image URL was returned.');
          }
        } catch (imageErr) {
          roomImageUploadFailed = true;
          console.error('Could not upload room image during creation:', imageErr);

          setStatus(
            imageErr?.response?.data?.error ||
              imageErr?.response?.data?.message ||
              imageErr?.message ||
              'Room created, but image upload failed'
          );
        }
      }

      removeNewRoomImage();
      setNewRoomName('');
      setNewRoomPrivacy('public');
      setShowCreateModal(false);

      roomsCacheRef.current = { key: '', timestamp: 0, rooms: [] };
      await loadRooms(roomSearch, { force: true });

      setActiveRoom(finalCreatedRoom);
      activeRoomRef.current = finalCreatedRoom;
      setMessages([]);
      setMobileChatOpen(true);

      if (finalCreatedRoom.privacy === 'private') {
        setModalTitle(`Invite users to ${finalCreatedRoom.name}`);
        setModalMode('members');
        setModalRoom(finalCreatedRoom);
        setMembers([]);
        setInviteSearch('');
        setInviteResults([]);
        setShowInvite(true);
        setShowMembers(true);
      }

      setRoomUnreadCounts((prev) => ({
        ...prev,
        [finalCreatedRoom.roomId]: 0,
      }));

      try {
        setMessagesLoading(true);
        const messageData = await roomApi.getRoomMessages(finalCreatedRoom.roomId);

        if (mountedRef.current) {
          setMessages(getLoadedRoomMessages(messageData));
        }
      } catch (messageErr) {
        console.error('Could not load new room messages:', messageErr);
      } finally {
        if (mountedRef.current) setMessagesLoading(false);
      }

      if (!roomImageUploadFailed) {
        setStatus(newRoomImageFile ? 'Room created successfully with image' : 'Room created successfully');
      }

      return true;
    } catch (err) {
      console.error(err);

      if (err?.response?.status === 409) {
        setStatus('Room name already exists. Choose a different name.');
      } else {
        setStatus(err?.response?.data?.error || 'Failed to create room');
      }

      return false;
    } finally {
      if (mountedRef.current) setCreatingRoom(false);
    }
  }


  async function openHiddenRooms() {
    try {
      setShowRoomMenu(false);
      const data = await roomApi.getHiddenRooms();

      if (!mountedRef.current) return;

      setHiddenRooms(Array.isArray(data?.rooms) ? data.rooms : Array.isArray(data) ? data : []);
      setShowHidden(true);
    } catch (err) {
      console.error(err);
      if (mountedRef.current) setStatus('Could not load hidden rooms');
    }
  }

  async function unhideRoom(room) {
    if (!room?.roomId) return;

    try {
      setStatus('');
      await roomApi.unhideRoom(room.roomId);

      setHiddenRooms((prev) => prev.filter((item) => item.roomId !== room.roomId));
      roomsCacheRef.current = { key: '', timestamp: 0, rooms: [] };

      await loadRooms(roomSearch, { force: true });
    } catch (err) {
      console.error(err);
      setStatus(err?.response?.data?.error || 'Could not unhide room');
    }
  }

  async function loadRoomInvites(openPopup = false) {
    if (roomInvitesLoadingRef.current) {
      if (openPopup) setShowRoomInvites(true);
      return;
    }

    roomInvitesLoadingRef.current = true;

    try {
      if (openPopup) {
        setStatus('');
        setRoomInvitesLoading(true);
        setShowRoomInvites(true);
      }

      const data = await roomApi.getRoomInvites();

      if (!mountedRef.current) return;

      const invites = Array.isArray(data?.invites)
        ? data.invites
        : Array.isArray(data)
          ? data
          : [];

      setRoomInvites(invites);
    } catch (err) {
      if (openPopup) console.error(err);

      if (mountedRef.current && openPopup) {
        setStatus(
          err?.response?.data?.error ||
            err?.response?.data?.message ||
            err?.response?.data?.details ||
            'Could not load room invites'
        );
      }
    } finally {
      roomInvitesLoadingRef.current = false;
      if (mountedRef.current && openPopup) setRoomInvitesLoading(false);
    }
  }

  async function openRoomInvites() {
    setShowRoomMenu(false);
    await loadRoomInvites(true);
  }

  async function acceptRoomInvite(invite) {
    const roomId = getRoomInviteRoomId(invite);

    if (!roomId || processingInviteId) return;

    try {
      setProcessingInviteId(roomId);
      setStatus('');

      await roomApi.acceptRoomInvite(roomId);

      if (!mountedRef.current) return;

      setRoomInvites((prev) =>
        prev.filter((item) => getRoomInviteRoomId(item) !== roomId)
      );

      setStatus('Room invite accepted');

      membersCacheRef.current = {};
      joinRequestsCacheRef.current = {};
      roomsCacheRef.current = { key: '', timestamp: 0, rooms: [] };

      await loadRooms(roomSearch, { force: true });
      setShowRoomInvites(false);
    } catch (err) {
      console.error(err);

      if (mountedRef.current) {
        setStatus(err?.response?.data?.error || 'Could not accept invite');
      }
    } finally {
      if (mountedRef.current) setProcessingInviteId('');
    }
  }

  async function rejectRoomInvite(invite) {
    const roomId = getRoomInviteRoomId(invite);

    if (!roomId || processingInviteId) return;

    try {
      setProcessingInviteId(roomId);
      setStatus('');

      await roomApi.declineRoomInvite(roomId);

      if (!mountedRef.current) return;

      setRoomInvites((prev) =>
        prev.filter((item) => getRoomInviteRoomId(item) !== roomId)
      );

      setStatus('Room invite rejected');

      if (roomInvites.length <= 1) {
        setShowRoomInvites(false);
      }
    } catch (err) {
      console.error(err);

      if (mountedRef.current) {
        setStatus(err?.response?.data?.error || 'Could not reject invite');
      }
    } finally {
      if (mountedRef.current) setProcessingInviteId('');
    }
  }

  async function generatePrivateRoomInviteLink(room = activeRoom) {
    if (!room?.roomId || inviteLinkLoading) return;

    if (room.privacy !== 'private') {
      setStatus('Invite links are only available for private rooms.');
      return;
    }

    if (!isRoomOwner(room, userId)) {
      setStatus('Only the room creator can generate an invite link.');
      return;
    }

    try {
      setStatus('');
      setInviteLinkLoading(true);
      setShowActiveRoomMenu(false);

      const data = await roomApi.createRoomInviteLink(room.roomId, {
        // Backend Lambda uses requiresApproval. UI toggle uses the opposite meaning.
        requiresApproval: !inviteLinkAutoAccept,
        autoAccept: inviteLinkAutoAccept,
        maxUses: 100,
      });

      const inviteCode = data?.inviteCode || data?.code || '';
      const inviteUrl =
        data?.inviteUrl ||
        data?.url ||
        (inviteCode ? `${APP_ORIGIN}/rooms/invite/${inviteCode}` : '');

      if (!inviteUrl) {
        throw new Error('Invite link was created, but no invite URL was returned');
      }

      setGeneratedInviteCode(
        inviteCode || String(inviteUrl).split('/').filter(Boolean).pop() || ''
      );
      setGeneratedInviteLink(inviteUrl);
      setInviteLinkCopied(false);
      setInviteLinkModalOpen(true);
    } catch (err) {
      console.error(err);

      setStatus(
        err?.response?.data?.details?.message ||
          err?.response?.data?.details?.Message ||
          err?.response?.data?.error ||
          err?.response?.data?.message ||
          err?.message ||
          'Could not generate invite link'
      );
    } finally {
      if (mountedRef.current) setInviteLinkLoading(false);
    }
  }

  async function copyGeneratedInviteLink() {
    if (!generatedInviteLink) return;

    try {
      await navigator.clipboard.writeText(generatedInviteLink);
      setInviteLinkCopied(true);
      setStatus('Copied to clipboard');

      if (inviteCopiedTimerRef.current) {
        window.clearTimeout(inviteCopiedTimerRef.current);
      }

      inviteCopiedTimerRef.current = window.setTimeout(() => {
        if (mountedRef.current) setInviteLinkCopied(false);
        inviteCopiedTimerRef.current = null;
      }, 1800);
    } catch {
      setInviteLinkCopied(false);
      setStatus('Could not copy invite link. Please copy it manually.');
    }
  }

  async function disableGeneratedInviteLink() {
    const inviteCode =
      generatedInviteCode ||
      String(generatedInviteLink || '').split('/').filter(Boolean).pop() ||
      '';

    if (!inviteCode || inviteLinkDisabling) return;

    try {
      setInviteLinkDisabling(true);
      setStatus('');

      await roomApi.disableInviteLink(inviteCode);

      setStatus('Invite link disabled');
      setGeneratedInviteCode('');
      setGeneratedInviteLink('');
      setInviteLinkCopied(false);
      setInviteLinkAutoAccept(false);
      setInviteLinkModalOpen(false);
    } catch (err) {
      setStatus(
        err?.response?.data?.error ||
          err?.response?.data?.message ||
          err?.message ||
          'Could not disable invite link'
      );
    } finally {
      if (mountedRef.current) setInviteLinkDisabling(false);
    }
  }

  function readFileAsBase64(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();

      reader.onload = () => {
        const result = String(reader.result || '');
        resolve(result.includes(',') ? result.split(',')[1] : result);
      };

      reader.onerror = () => reject(reader.error || new Error('Could not read image'));
      reader.readAsDataURL(file);
    });
  }

  async function prepareRoomImageFile(file) {
    if (!file) throw new Error('No image selected');

    if (!file.type?.startsWith('image/')) {
      throw new Error('Please choose an image file');
    }

    if (file.size <= 1024 * 1024 || typeof createImageBitmap !== 'function') {
      return validatePreparedRoomImagePayload({
        fileName: file.name || 'room-image.jpg',
        contentType: file.type || 'image/jpeg',
        imageBase64: await readFileAsBase64(file),
      });
    }

    const bitmap = await createImageBitmap(file);
    const maxDimension = 800;
    const scale = Math.min(1, maxDimension / Math.max(bitmap.width, bitmap.height));
    const width = Math.max(1, Math.round(bitmap.width * scale));
    const height = Math.max(1, Math.round(bitmap.height * scale));

    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;

    const ctx = canvas.getContext('2d', { alpha: false });

    if (!ctx) {
      bitmap.close?.();

      return validatePreparedRoomImagePayload({
        fileName: file.name || 'room-image.jpg',
        contentType: file.type || 'image/jpeg',
        imageBase64: await readFileAsBase64(file),
      });
    }

    ctx.drawImage(bitmap, 0, 0, width, height);
    bitmap.close?.();

    const blob = await new Promise((resolve) => {
      canvas.toBlob(resolve, 'image/jpeg', 0.78);
    });

    if (!blob) throw new Error('Could not optimize image');

    return validatePreparedRoomImagePayload({
      fileName: `${String(file.name || 'room-image').replace(/\.[^.]+$/, '')}.jpg`,
      contentType: 'image/jpeg',
      imageBase64: await readFileAsBase64(blob),
    });
  }

  async function uploadRoomImage(room, file) {
    if (!room?.roomId || !file || uploadingRoomImageId) return false;

    if (!file.type?.startsWith('image/')) {
      setStatus('Please choose an image file');
      return false;
    }

    if (file.size > ROOM_IMAGE_PICKER_MAX_BYTES) {
      setStatus('Image must be smaller than 8 MB before optimization');
      return false;
    }

    try {
      setStatus('');
      setUploadingRoomImageId(room.roomId);

      const optimizedImage = validatePreparedRoomImagePayload(
        await prepareRoomImageFile(file)
      );

      const data = await roomApi.uploadRoomImage(room.roomId, optimizedImage);
      const imageUrl = getUploadedRoomImageUrl(data);

      if (!imageUrl) {
        setStatus('Image uploaded, but no image URL was returned');
        await loadRooms(roomSearch, { force: true });
        return false;
      }

      persistStoredRoomImage(room.roomId, imageUrl);

      setFailedRoomImages((prev) => {
        if (!prev[room.roomId]) return prev;

        const next = { ...prev };
        delete next[room.roomId];
        return next;
      });

      setRoomImageCache((prev) => ({
        ...prev,
        [room.roomId]: imageUrl,
      }));

      setRooms((prev) =>
        prev.map((item) =>
          item.roomId === room.roomId
            ? { ...item, ...getRoomImagePatch(imageUrl) }
            : item
        )
      );

      if (activeRoomRef.current?.roomId === room.roomId) {
        const updatedRoom = {
          ...activeRoomRef.current,
          ...getRoomImagePatch(imageUrl),
        };

        activeRoomRef.current = updatedRoom;
        setActiveRoom(updatedRoom);
      }

      roomsCacheRef.current = { key: '', timestamp: 0, rooms: [] };

      setOpenRoomActionMenuId('');
      setShowActiveRoomMenu(false);
      setStatus('Room image updated');

      return true;
    } catch (err) {
      console.error(err);

      if (err?.response?.status === 403) {
        setStatus('Only the room creator can change this room image');
      } else {
        setStatus(err?.response?.data?.error || 'Could not upload room image');
      }

      return false;
    } finally {
      if (mountedRef.current) setUploadingRoomImageId('');
    }
  }

  async function renameRoom(room, providedName) {
    if (!room?.roomId || renamingRoomId) return false;

    if (!isRoomOwner(room, userId)) {
      setStatus('Only the room creator can edit the topic name');
      return false;
    }

    const currentName = String(room.name || '').trim();
    const cleanName = String(providedName || '').trim().replace(/\s+/g, ' ');

    if (!cleanName) {
      setStatus('Topic name cannot be empty');
      return false;
    }

    if (cleanName.length > 60) {
      setStatus('Topic name must be 60 characters or fewer');
      return false;
    }

    if (cleanName.toLowerCase() === currentName.toLowerCase()) {
      return true;
    }

    try {
      setStatus('');
      setRenamingRoomId(room.roomId);
      setShowActiveRoomMenu(false);

      if (typeof roomApi.renameRoom !== 'function') {
        throw new Error('renameRoom API method is missing in client.js');
      }

      const data = await roomApi.renameRoom(room.roomId, cleanName);
      const { payload, body } = parseApiPayload(data);

      const updatedRoom =
        payload?.room ||
        payload?.data?.room ||
        body?.room ||
        body?.data?.room ||
        null;

      const nextRoomPatch = {
        name: updatedRoom?.name || cleanName,
        nameLower: updatedRoom?.nameLower || cleanName.toLowerCase(),
      };

      setRooms((prev) =>
        prev.map((item) =>
          item.roomId === room.roomId ? { ...item, ...nextRoomPatch } : item
        )
      );

      roomsCacheRef.current = { key: '', timestamp: 0, rooms: [] };

      if (activeRoomRef.current?.roomId === room.roomId) {
        const nextActiveRoom = {
          ...activeRoomRef.current,
          ...nextRoomPatch,
        };

        activeRoomRef.current = nextActiveRoom;
        setActiveRoom(nextActiveRoom);
      }

      if (modalRoom?.roomId === room.roomId) {
        setModalRoom((prev) => (prev ? { ...prev, ...nextRoomPatch } : prev));
      }

      setStatus('Topic name updated');
      return true;
    } catch (err) {
      console.error(err);

      if (err?.response?.status === 409) {
        setStatus('A room with this topic name already exists');
      } else if (err?.response?.status === 403) {
        setStatus('Only the room creator can edit the topic name');
      } else {
        setStatus(
          err?.response?.data?.error ||
            err?.response?.data?.message ||
            err?.message ||
            'Could not update topic name'
        );
      }

      return false;
    } finally {
      if (mountedRef.current) setRenamingRoomId('');
    }
  }

  function closeEditRoomModal() {
    if (editRoomSaving) return;

    if (editRoomImagePreview?.startsWith('blob:')) {
      URL.revokeObjectURL(editRoomImagePreview);
    }

    setShowEditRoomModal(false);
    setEditRoomTarget(null);
    setEditRoomName('');
    setEditRoomImageFile(null);
    setEditRoomImagePreview('');
  }

  function openEditRoomModal(room) {
    if (!room?.roomId) return;

    if (!isRoomOwner(room, userId)) {
      setStatus('Only the room creator can edit this topic');
      return;
    }

    if (editRoomImagePreview?.startsWith('blob:')) {
      URL.revokeObjectURL(editRoomImagePreview);
    }

    setShowActiveRoomMenu(false);
    setEditRoomTarget(room);
    setEditRoomName(room.name || '');
    setEditRoomImageFile(null);
    setEditRoomImagePreview('');
    setShowEditRoomModal(true);
  }

  function handleEditRoomImageChange(event) {
    const file = event.target.files?.[0] || null;
    event.target.value = '';

    if (editRoomImagePreview?.startsWith('blob:')) {
      URL.revokeObjectURL(editRoomImagePreview);
    }

    if (!file) {
      setEditRoomImageFile(null);
      setEditRoomImagePreview('');
      return;
    }

    if (!file.type?.startsWith('image/')) {
      setEditRoomImageFile(null);
      setEditRoomImagePreview('');
      setStatus('Please choose an image file');
      return;
    }

    if (file.size > ROOM_IMAGE_PICKER_MAX_BYTES) {
      setEditRoomImageFile(null);
      setEditRoomImagePreview('');
      setStatus('Image must be smaller than 8 MB before optimization');
      return;
    }

    setStatus('');
    setEditRoomImageFile(file);
    setEditRoomImagePreview(URL.createObjectURL(file));
  }

  function removeEditRoomImage() {
    if (editRoomImagePreview?.startsWith('blob:')) {
      URL.revokeObjectURL(editRoomImagePreview);
    }

    setEditRoomImageFile(null);
    setEditRoomImagePreview('');
  }

  async function saveEditRoom(e) {
    e.preventDefault();

    if (!editRoomTarget?.roomId || editRoomSaving) return;

    const cleanName = editRoomName.trim().replace(/\s+/g, ' ');
    const currentName = String(editRoomTarget.name || '').trim();
    const shouldRename = cleanName.toLowerCase() !== currentName.toLowerCase();

    if (!cleanName) {
      setStatus('Topic name cannot be empty');
      return;
    }

    if (cleanName.length > 60) {
      setStatus('Topic name must be 60 characters or fewer');
      return;
    }

    try {
      setStatus('');
      setEditRoomSaving(true);

      if (shouldRename) {
        const renamed = await renameRoom(editRoomTarget, cleanName);
        if (!renamed) return;
      }

      if (editRoomImageFile) {
        const uploaded = await uploadRoomImage(editRoomTarget, editRoomImageFile);
        if (!uploaded) return;
      }

      roomsCacheRef.current = { key: '', timestamp: 0, rooms: [] };
      setStatus('Topic updated');
      closeEditRoomModal();
    } finally {
      if (mountedRef.current) setEditRoomSaving(false);
    }
  }



  function handleNewRoomImageChange(event) {
  const file = event.target.files?.[0] || null;
  event.target.value = '';

  if (newRoomImagePreview?.startsWith('blob:')) {
    URL.revokeObjectURL(newRoomImagePreview);
  }

  if (!file) {
    setNewRoomImageFile(null);
    setNewRoomImagePreview('');
    return;
  }

  if (!file.type?.startsWith('image/')) {
    setNewRoomImageFile(null);
    setNewRoomImagePreview('');
    setStatus('Please choose an image file');
    return;
  }

  if (file.size > ROOM_IMAGE_PICKER_MAX_BYTES) {
    setNewRoomImageFile(null);
    setNewRoomImagePreview('');
    setStatus('Image must be smaller than 8 MB before optimization');
    return;
  }

  setStatus('');
  setNewRoomImageFile(file);
  setNewRoomImagePreview(URL.createObjectURL(file));
}

function removeNewRoomImage() {
  if (newRoomImagePreview?.startsWith('blob:')) {
    URL.revokeObjectURL(newRoomImagePreview);
  }

  setNewRoomImageFile(null);
  setNewRoomImagePreview('');
}

async function openRoom(room) {
  if (!room?.roomId || loadingRoomRef.current) return;

  if (activeRoomRef.current?.roomId === room.roomId) {
    setMobileChatOpen(true);
    return;
  }

  loadingRoomRef.current = true;

  try {
    setStatus('');
    setOpenRoomActionMenuId('');
    setShowActiveRoomMenu(false);
    setShowActiveRoomInfo(false);
    setActiveInfoSection('');
    setShowRoomMediaGrid(false);
    setMediaViewer(null);
    setMediaViewerReturnToGrid(false);

    setActiveRoom(room);
    activeRoomRef.current = room;
    setMessages((prev) => (prev.length ? [] : prev));
    setMobileChatOpen(true);
    setMessagesLoading(true);

    setRoomUnreadCounts((prev) => ({
      ...prev,
      [room.roomId]: 0,
    }));

    const data = await roomApi.getRoomMessages(room.roomId);

    if (!mountedRef.current || activeRoomRef.current?.roomId !== room.roomId) return;

    setMessages(getLoadedRoomMessages(data));
  } catch (err) {
    console.error(err);

    if (mountedRef.current) {
      setActiveRoom(null);
      activeRoomRef.current = null;
      setMessages([]);
      setMobileChatOpen(false);
      setStatus(err?.response?.data?.error || 'Could not open room');
    }
  } finally {
    loadingRoomRef.current = false;
    if (mountedRef.current) setMessagesLoading(false);
  }
}

async function openMembers(room) {
  if (!room?.roomId) return;

  const cacheKey = room.roomId;
  const cached = membersCacheRef.current[cacheKey];
  const now = Date.now();

  setStatus('');
  setShowInvite(false);
  setInviteSearch('');
  setInviteResults([]);
  setPendingInviteUserIds(new Set());
  setModalTitle(`${room.name} members`);
  setModalMode('members');
  setModalRoom(room);
  setShowMembers(true);

  if (modalRoom?.roomId === room.roomId && modalMode === 'members' && members.length > 0) {
    return;
  }

  if (cached && now - cached.timestamp < ROOM_MEMBERS_CACHE_MS) {
    setMembers(cached.members);
    return;
  }

  setMembers([]);

  try {
    const data = await roomApi.getRoomMembers(room.roomId);

    if (!mountedRef.current) return;

    const nextMembers = Array.isArray(data?.members)
      ? data.members
      : Array.isArray(data)
        ? data
        : [];

    membersCacheRef.current[cacheKey] = {
      timestamp: Date.now(),
      members: nextMembers,
    };

    setMembers(nextMembers);
  } catch (err) {
    console.error(err);
    setStatus(err?.response?.data?.error || 'Could not load members');
  }
}

async function searchUsers(searchValue = inviteSearch) {
  const query = String(searchValue || '').trim().toLowerCase();

  if (!query) {
    setInviteResults([]);
    return;
  }

  const cached = userSearchCacheRef.current[query];
  const now = Date.now();

  if (cached && now - cached.timestamp < ROOM_MEMBERS_CACHE_MS) {
    setInviteResults(dedupeInviteUsers(cached.users));
    return;
  }

  try {
    setStatus('');

    const data = await roomApi.searchUsers(query);

    if (!mountedRef.current) return;

    const users = dedupeInviteUsers(
      Array.isArray(data?.users) ? data.users : Array.isArray(data) ? data : []
    );

    userSearchCacheRef.current[query] = {
      timestamp: Date.now(),
      users,
    };

    setInviteResults(users);
  } catch (err) {
    console.error(err);
    setStatus(err?.response?.data?.error || 'Search failed');
  }
}

function getInviteUserId(user) {
  if (typeof user === 'string') return user;
  return user?.userId || user?.id || user?.sub || user?.invitedUserId || '';
}

function getInviteUserEmail(user) {
  return String(user?.email || '').trim().toLowerCase();
}

function normalizeInviteKey(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/^mailto:/, '')
    .replace(/\s+/g, '');
}

function getEmailLocalPart(email) {
  const cleanEmail = normalizeInviteKey(email);
  return cleanEmail.includes('@') ? cleanEmail.split('@')[0] : '';
}

function dedupeInviteUsers(users = []) {
  const seen = new Set();
  const unique = [];

  for (const user of users) {
    const userIdValue = normalizeInviteKey(getInviteUserId(user));
    const emailValue = normalizeInviteKey(getInviteUserEmail(user));
    const usernameValue = normalizeInviteKey(user?.username);
    const nameValue = normalizeInviteKey(user?.name || user?.displayName);
    const emailLocalValue = getEmailLocalPart(emailValue);

    const keys = [
      userIdValue && `id:${userIdValue}`,
      emailValue && `email:${emailValue}`,
      usernameValue && `username:${usernameValue}`,
      emailLocalValue && `username:${emailLocalValue}`,
      nameValue && emailValue && `name-email:${nameValue}:${emailValue}`,
      nameValue && userIdValue && `name-id:${nameValue}:${userIdValue}`,
    ].filter(Boolean);

    if (keys.some((key) => seen.has(key))) continue;

    keys.forEach((key) => seen.add(key));
    unique.push(user);
  }

  return unique;
}

function isExistingRoomMember(user) {
  const targetId = getInviteUserId(user);
  const targetEmail = getInviteUserEmail(user);

  return members.some((member) => {
    const memberId = getInviteUserId(member);
    const memberEmail = getInviteUserEmail(member);

    return (
      (targetId && memberId && targetId === memberId) ||
      (targetEmail && memberEmail && targetEmail === memberEmail)
    );
  });
}

function isRoomOwnerUser(user, room = modalRoom || activeRoom) {
  const targetId = getInviteUserId(user);
  const ownerId = room?.ownerId || room?.createdBy || '';
  return Boolean(targetId && ownerId && targetId === ownerId);
}

function canInviteUserToCurrentRoom(user) {
  const targetId = getInviteUserId(user);
  if (!targetId) return false;

  return (
    !pendingInviteUserIds.has(targetId) &&
    !isExistingRoomMember(user) &&
    !isRoomOwnerUser(user)
  );
}

async function inviteUser(userToInvite) {
  const targetUserId = getInviteUserId(userToInvite);

  if (!modalRoom?.roomId || !targetUserId) {
    setStatus('Could not find user to invite');
    return;
  }

  const selectedUser =
    typeof userToInvite === 'string'
      ? inviteResults.find((item) => getInviteUserId(item) === userToInvite) || { userId: userToInvite }
      : userToInvite;

  if (!canInviteUserToCurrentRoom(selectedUser)) {
    setPendingInviteUserIds((prev) => {
      const next = new Set(prev);
      next.add(targetUserId);
      return next;
    });

    setStatus('This user is already invited or already a member.');
    return;
  }

  try {
    setStatus('');

    const data = await roomApi.inviteUserToRoom(modalRoom.roomId, targetUserId);

    setPendingInviteUserIds((prev) => {
      const next = new Set(prev);
      next.add(targetUserId);
      return next;
    });

    setInviteResults((prev) =>
      prev.map((item) =>
        getInviteUserId(item) === targetUserId ? { ...item, invited: true } : item
      )
    );

    setStatus(data?.message || 'Invite request sent. The user must accept before joining.');
  } catch (err) {
    const statusCode = err?.response?.status;
    const message = err?.response?.data?.error || err?.response?.data?.message || '';

    if (statusCode === 409) {
      setPendingInviteUserIds((prev) => {
        const next = new Set(prev);
        next.add(targetUserId);
        return next;
      });

      setInviteResults((prev) =>
        prev.map((item) =>
          getInviteUserId(item) === targetUserId ? { ...item, invited: true } : item
        )
      );

      setStatus(message || 'Invite already sent');
      return;
    }

    console.error(err);
    setStatus(statusCode === 403 ? message || 'Only the room creator can invite users.' : message || 'Invite failed');
  }
}

async function openJoinRequests(room) {
  if (!room?.roomId) return;

  const cacheKey = room.roomId;
  const cached = joinRequestsCacheRef.current[cacheKey];
  const now = Date.now();

  setStatus('');
  setShowInvite(false);
  setInviteSearch('');
  setInviteResults([]);
  setPendingInviteUserIds(new Set());
  setModalTitle(`${room.name} join requests`);
  setModalMode('requests');
  setModalRoom(room);
  setShowMembers(true);

  if (modalRoom?.roomId === room.roomId && modalMode === 'requests' && members.length > 0) {
    return;
  }

  if (cached && now - cached.timestamp < ROOM_MEMBERS_CACHE_MS) {
    setMembers(cached.requests);
    return;
  }

  setMembers([]);

  try {
    const data = await roomApi.getRoomJoinRequests(room.roomId);

    if (!mountedRef.current) return;

    const nextRequests = Array.isArray(data?.requests)
      ? data.requests
      : Array.isArray(data)
        ? data
        : [];

    joinRequestsCacheRef.current[cacheKey] = {
      timestamp: Date.now(),
      requests: nextRequests,
    };

    setMembers(nextRequests);
  } catch (err) {
    console.error(err);
    setStatus(err?.response?.data?.error || 'Could not load join requests');
  }
}

async function approveJoinRequest(requestUserId) {
  if (!modalRoom?.roomId || !requestUserId) return;

  const approvedRoom = modalRoom;

  try {
    setStatus('');

    await roomApi.approveRoomJoinRequest(approvedRoom.roomId, requestUserId);

    setMembers((prev) => prev.filter((member) => member.userId !== requestUserId));

    delete joinRequestsCacheRef.current[approvedRoom.roomId];
    delete membersCacheRef.current[approvedRoom.roomId];
    roomsCacheRef.current = { key: '', timestamp: 0, rooms: [] };

    setShowMembers(false);
    setShowInvite(false);
    setModalMode('members');
    setModalRoom(null);
    setMembers([]);

    setStatus('Join request approved');

    await loadRooms(roomSearch, { force: true });

    const latestRoom =
      roomsCacheRef.current.rooms.find((room) => room.roomId === approvedRoom.roomId) ||
      rooms.find((room) => room.roomId === approvedRoom.roomId) ||
      approvedRoom;

    await openRoom(latestRoom);
  } catch (err) {
    console.error(err);
    setStatus(err?.response?.data?.error || 'Could not approve request');
  }
}

async function removeRoomMember(member) {
  if (!modalRoom?.roomId || !member?.userId) return;

  const isCreator = isRoomOwner(modalRoom, userId);
  const isTargetOwner = member.userId === modalRoom.ownerId || member.userId === modalRoom.createdBy;

  if (!isCreator) {
    setStatus('Only the group creator can remove members');
    return;
  }

  if (isTargetOwner) {
    setStatus('You cannot remove the group creator');
    return;
  }

  const ok = window.confirm(`Remove ${member.name || member.email || 'this member'} from ${modalRoom.name}?`);
  if (!ok) return;

  try {
    setStatus('');

    await roomApi.removeRoomMember(modalRoom.roomId, member.userId);

    setMembers((prev) => prev.filter((item) => item.userId !== member.userId));

    delete membersCacheRef.current[modalRoom.roomId];
    delete joinRequestsCacheRef.current[modalRoom.roomId];
    roomsCacheRef.current = { key: '', timestamp: 0, rooms: [] };

    setStatus('Member removed from group');
    await loadRooms(roomSearch, { force: true });
  } catch (err) {
    console.error(err);
    setStatus(err?.response?.data?.error || err?.response?.data?.message || 'Could not remove member');
  }
}

async function leaveRoom(room) {
  if (!room?.roomId) return;

  const ok = window.confirm(`Leave "${room.name}"? You will need creator approval to join again.`);
  if (!ok) return;

  setOpenRoomActionMenuId('');

  if (activeRoomRef.current?.roomId === room.roomId) {
    setActiveRoom(null);
    activeRoomRef.current = null;
    setMessages([]);
    setMobileChatOpen(false);
    setShowActiveRoomInfo(false);
    setActiveInfoSection('');
    setShowRoomMediaGrid(false);
    setMediaViewer(null);
    setMediaViewerReturnToGrid(false);
  }

  setRooms((prev) => prev.filter((item) => item.roomId !== room.roomId));

  setRoomUnreadCounts((prev) => {
    const copy = { ...prev };
    delete copy[room.roomId];
    return copy;
  });

  try {
    setStatus('');

    await roomApi.leaveRoom(room.roomId);

    roomsCacheRef.current = { key: '', timestamp: 0, rooms: [] };
    setStatus('Left private group');

    window.setTimeout(() => {
      if (mountedRef.current) loadRooms(roomSearch, { force: true });
    }, 150);
  } catch (err) {
    console.error(err);
    setStatus(err?.response?.data?.error || 'Could not leave room');

    if (mountedRef.current) loadRooms(roomSearch, { force: true });
  }
}

async function hideRoom(room) {
  if (!room?.roomId) return;

  try {
    setStatus('');

    await roomApi.hideRoom(room.roomId);

    setRoomUnreadCounts((prev) => {
      const copy = { ...prev };
      delete copy[room.roomId];
      return copy;
    });

    if (activeRoomRef.current?.roomId === room.roomId) {
      setActiveRoom(null);
      activeRoomRef.current = null;
      setMessages([]);
      setMobileChatOpen(false);
      setShowActiveRoomInfo(false);
      setActiveInfoSection('');
      setShowRoomMediaGrid(false);
      setMediaViewer(null);
      setMediaViewerReturnToGrid(false);
    }

    roomsCacheRef.current = { key: '', timestamp: 0, rooms: [] };
    await loadRooms(roomSearch, { force: true });
  } catch (err) {
    console.error(err);
    setStatus(err?.response?.data?.error || 'Could not hide room');
  }
}

async function deleteRoom(room) {
  if (!room?.roomId) return;

  const ok = window.confirm(`Delete "${room.name}"?`);
  if (!ok) return;

  try {
    setStatus('');

    await roomApi.deleteRoom(room.roomId);

    setRoomUnreadCounts((prev) => {
      const copy = { ...prev };
      delete copy[room.roomId];
      return copy;
    });

    if (activeRoomRef.current?.roomId === room.roomId) {
      setActiveRoom(null);
      activeRoomRef.current = null;
      setMessages([]);
      setMobileChatOpen(false);
      setShowActiveRoomInfo(false);
      setActiveInfoSection('');
      setShowRoomMediaGrid(false);
      setMediaViewer(null);
      setMediaViewerReturnToGrid(false);
    }

    roomsCacheRef.current = { key: '', timestamp: 0, rooms: [] };
    await loadRooms(roomSearch, { force: true });
  } catch (err) {
    console.error(err);
    setStatus(err?.response?.data?.error || 'Failed to delete room');
  }
}

async function sendMessage(e) {
  e.preventDefault();

  const cleanText = text.trim();
  const room = activeRoomRef.current;

  if ((!cleanText && !selectedMediaFile) || !room || sendingMessageRef.current) {
    return;
  }

  sendingMessageRef.current = true;

  const clientId = `temp-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  let uploadedMedia = null;

  try {
    if (selectedMediaFile) {
      if (selectedMediaFile.size > ROOM_MEDIA_MAX_BYTES) {
        throw new Error('Media must be smaller than 80 MB.');
      }

      setUploadingMedia(true);
      setMediaUploadProgress(0);

      uploadedMedia = await roomApi.uploadRoomMediaFile(
        room.roomId,
        selectedMediaFile,
        setMediaUploadProgress
      );
    }

    const tempMessage = normalizeRoomMessageMedia({
      messageId: clientId,
      clientId,
      roomId: room.roomId,
      senderId: userId,
      senderName: user?.name || user?.email || 'You',
      text: cleanText,
      message: cleanText,
      createdAt: String(Date.now()),
      createdAtMs: Date.now(),
      pending: true,
      mediaKey: uploadedMedia?.mediaKey || '',
      mediaUrl: uploadedMedia?.mediaUrl || uploadedMedia?.fileUrl || '',
      fileUrl: uploadedMedia?.fileUrl || uploadedMedia?.mediaUrl || '',
      mediaType: uploadedMedia?.mediaType || selectedMediaType || '',
      contentType: uploadedMedia?.contentType || selectedMediaFile?.type || '',
      fileName: uploadedMedia?.fileName || selectedMediaFile?.name || '',
      mediaName: uploadedMedia?.fileName || selectedMediaFile?.name || '',
    });

    setText('');
    removeSelectedMedia();

    setMessages((prev) => {
      if (prev.some((msg) => (msg.messageId || msg.clientId) === clientId)) return prev;
      return [...prev.slice(-(MAX_RENDERED_MEDIA_MESSAGES - 1)), tempMessage];
    });

    const socketSent = sendRoomMessage({
      action: 'sendRoomMessage',
      roomId: room.roomId,
      text: cleanText,
      message: cleanText,
      mediaKey: tempMessage.mediaKey,
      mediaUrl: tempMessage.mediaUrl,
      fileUrl: tempMessage.fileUrl,
      mediaType: tempMessage.mediaType,
      contentType: tempMessage.contentType,
      fileName: tempMessage.fileName,
      mediaName: tempMessage.mediaName,
      clientId,
    });

    setMessages((prev) =>
      prev.map((msg) =>
        msg.clientId === clientId
          ? { ...msg, pending: false, failed: !socketSent }
          : msg
      )
    );

    if (!socketSent) {
      setStatus('Message saved locally, but chat socket is not connected. Try again.');
    }
  } catch (err) {
    const errorData = err?.response?.data || {};
    const errorMessage =
      errorData?.details?.message ||
      errorData?.details?.Message ||
      errorData?.details?.code ||
      errorData?.details?.Code ||
      errorData?.error ||
      errorData?.message ||
      err?.message ||
      'Failed to send message';

    console.error('Room media/message send failed:', {
      status: err?.response?.status,
      data: errorData,
      message: err?.message,
    });

    setStatus(errorMessage);

    setMessages((prev) =>
      prev.map((msg) =>
        msg.clientId === clientId ? { ...msg, pending: false, failed: true } : msg
      )
    );
  } finally {
    sendingMessageRef.current = false;

    if (mountedRef.current) {
      setUploadingMedia(false);
      setMediaUploadProgress(0);
    }
  }
}

return (
  <main className={`rooms-page ${mobileChatOpen && activeRoom ? 'mobile-chat-open' : ''}`}>
    <aside className="sidebar">
      <div className="rooms-title-row">
        <div className="room-privacy-toggle room-privacy-toggle-title">
          <button
            type="button"
            className={roomPrivacyFilter === 'private' ? 'active' : ''}
            onClick={() => setRoomPrivacyFilter('private')}
          >
            Private
          </button>

          <button
            type="button"
            className={roomPrivacyFilter === 'public' ? 'active' : ''}
            onClick={() => setRoomPrivacyFilter('public')}
          >
            Public
          </button>
        </div>

        <div
          className="rooms-menu-wrap"
          ref={roomMenuRef}
          onClick={(e) => e.stopPropagation()}
          onPointerDown={(e) => e.stopPropagation()}
        >
          <button
            type="button"
            className="rooms-create-plus-btn"
            aria-label="Create room"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              e.nativeEvent?.stopImmediatePropagation?.();
              setStatus('');
              setShowRoomMenu(false);
              setOpenRoomActionMenuId('');
              setShowCreateModal(true);
            }}
          >
            +
          </button>

          <button
            type="button"
            className="rooms-menu-btn"
            aria-label="Room options"
            aria-expanded={showRoomMenu}
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              e.nativeEvent?.stopImmediatePropagation?.();
              setOpenRoomActionMenuId('');
              setShowRoomMenu((prev) => !prev);
            }}
          >
            ⋯
            {roomInvites.length > 0 && (
              <span className="rooms-menu-badge">
                {roomInvites.length > 9 ? '9+' : roomInvites.length}
              </span>
            )}
          </button>

          {showRoomMenu && (
            <div className="rooms-menu-popover">
              <button
                type="button"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setShowRoomMenu(false);
                  openHiddenRooms();
                }}
              >
                Hidden Groups
              </button>

              <button
                type="button"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  openRoomInvites();
                }}
              >
                Room Invites
                {roomInvites.length > 0 && (
                  <span className="rooms-invite-count">
                    {roomInvites.length > 9 ? '9+' : roomInvites.length}
                  </span>
                )}
              </button>
            </div>
          )}
        </div>
      </div>

      {status && <p className="room-status">{status}</p>}

      <div className="room-list">
        {roomsLoading ? (
          <p className="empty">Loading rooms...</p>
        ) : rooms.length === 0 ? (
          <p className="empty">No rooms found</p>
        ) : sortedVisibleRooms.length === 0 ? (
          <p className="empty">No {roomPrivacyFilter} rooms found</p>
        ) : (
          sortedVisibleRooms.map((room, roomIndex) => {
            const isOwner = isRoomOwner(room, userId);
            const isPrivateCustom = room.type === 'custom' && room.privacy === 'private';
            const canLeave = isPrivateCustom && !isOwner;
            const canDelete = room.type === 'custom' && isOwner;
            const unreadCount = roomUnreadCounts[room.roomId] || room.unreadCount || 0;
            const roomImageUrl = roomIndex < ROOM_IMAGE_RENDER_LIMIT ? getRoomImageUrl(room) : '';
            const shouldEagerLoadRoomImage = roomIndex < ROOM_IMAGE_EAGER_LIMIT;

            return (
              <div
                key={room.roomId}
                className={`room-item ${roomImageUrl ? 'room-has-image room-image-full-card' : ''} ${
                  activeRoom?.roomId === room.roomId ? 'active' : ''
                }`}
                onClick={(event) => {
                  if (event.target.closest('.room-card-menu-wrap')) return;
                  openRoom(room);
                }}
              >
                {roomImageUrl && (
                  <img
                    className="room-full-bg-image"
                    src={roomImageUrl}
                    alt=""
                    loading={shouldEagerLoadRoomImage ? 'eager' : 'lazy'}
                    fetchPriority={shouldEagerLoadRoomImage ? 'high' : 'low'}
                    decoding="async"
                    referrerPolicy="no-referrer"
                    aria-hidden="true"
                    draggable="false"
                    style={{ pointerEvents: 'none', userSelect: 'none' }}
                    onError={(event) => {
                      const failedUrl = event.currentTarget.currentSrc || roomImageUrl;
                      event.currentTarget.style.display = 'none';
                      removeStoredRoomImage(room.roomId);

                      setFailedRoomImages((prev) => ({
                        ...prev,
                        [room.roomId]: failedUrl,
                      }));

                      setRoomImageCache((prev) => {
                        if (!prev[room.roomId]) return prev;

                        const next = { ...prev };
                        delete next[room.roomId];
                        return next;
                      });
                    }}
                  />
                )}

                <div className="room-info">
                  <div className="room-item-main">
                    <div className="room-image-wrap">
                      {roomImageUrl ? (
                        <img
                          className="room-small-image"
                          src={roomImageUrl}
                          alt=""
                          width="44"
                          height="44"
                          loading="lazy"
                          fetchPriority="low"
                          decoding="async"
                          referrerPolicy="no-referrer"
                          onError={(event) => {
                            event.currentTarget.style.display = 'none';
                          }}
                        />
                      ) : (
                        <span>{(room.name || 'R').trim().slice(0, 1).toUpperCase()}</span>
                      )}
                    </div>

                    <div className="room-text-block">
                      <div className="room-title-row">
                        <div className="room-name-badge-row">
                          <strong>{room.name}</strong>
                          {isOwner && <span className="room-owner-badge">You</span>}
                        </div>

                        {unreadCount > 0 && (
                          <span className="room-unread-badge">
                            {unreadCount > 99 ? '99+' : unreadCount}
                          </span>
                        )}
                      </div>

                      <span>{room.privacy === 'private' ? ' Private' : ' Public'}</span>
                    </div>
                  </div>
                </div>

                <div
                  className="room-card-menu-wrap"
                  ref={openRoomActionMenuId === room.roomId ? roomActionMenuRef : null}
                  style={{ position: 'relative', zIndex: 20 }}
                  onClick={(e) => e.stopPropagation()}
                  onMouseDown={(e) => e.stopPropagation()}
                  onPointerDown={(e) => e.stopPropagation()}
                  onTouchStart={(e) => e.stopPropagation()}
                >
                  <button
                    type="button"
                    className="room-card-menu-btn"
                    aria-label="Room actions"
                    aria-expanded={openRoomActionMenuId === room.roomId}
                    style={{ position: 'relative', zIndex: 21, pointerEvents: 'auto' }}
                    onMouseDown={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                    }}
                    onPointerDown={(e) => e.stopPropagation()}
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      e.nativeEvent?.stopImmediatePropagation?.();
                      setShowRoomMenu(false);
                      setOpenRoomActionMenuId((current) =>
                        current === room.roomId ? '' : room.roomId
                      );
                    }}
                  >
                    ⋯
                  </button>

                  {openRoomActionMenuId === room.roomId && (
                    <div
                      className="room-card-menu-popover"
                      onClick={(e) => e.stopPropagation()}
                      onPointerDown={(e) => e.stopPropagation()}
                    >
                      {canLeave && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            setOpenRoomActionMenuId('');
                            leaveRoom(room);
                          }}
                        >
                          Leave
                        </button>
                      )}

                      <button
                        type="button"
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          setOpenRoomActionMenuId('');
                          hideRoom(room);
                        }}
                      >
                        Hide
                      </button>

                      {canDelete && (
                        <button
                          type="button"
                          className="danger-menu-item"
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            setOpenRoomActionMenuId('');
                            deleteRoom(room);
                          }}
                        >
                          Delete
                        </button>
                      )}
                    </div>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>
    </aside>

    <section className="chat">
      {!activeRoom ? (
        <div className="empty">Select a room</div>
      ) : (
        <>
          <div className="chat-header">
            <button
              type="button"
              className="mobile-back-btn"
              onClick={() => {
                setMobileChatOpen(false);
                setActiveRoom(null);
                activeRoomRef.current = null;
                setMessages([]);
                setShowActiveRoomMenu(false);
              }}
            >
              ←
            </button>

            <span className="active-room-title-wrap">
              {activeRoomImageUrl && (
                <img
                  className="active-room-image"
                  src={activeRoomImageUrl}
                  alt=""
                  width="36"
                  height="36"
                  loading="lazy"
                  fetchPriority="low"
                  decoding="async"
                  referrerPolicy="no-referrer"
                  onError={(event) => {
                    const failedUrl = event.currentTarget.currentSrc || activeRoomImageUrlRef.current;
                    event.currentTarget.style.display = 'none';

                    if (activeRoom?.roomId) {
                      removeStoredRoomImage(activeRoom.roomId);
                      setFailedRoomImages((prev) => ({
                        ...prev,
                        [activeRoom.roomId]: failedUrl,
                      }));
                    }
                  }}
                />
              )}

              <span>{activeRoom.name}</span>
            </span>

            <div
              className="active-room-menu-wrap"
              ref={activeRoomMenuRef}
              style={{ position: 'relative', zIndex: 30 }}
              onClick={(e) => e.stopPropagation()}
              onMouseDown={(e) => e.stopPropagation()}
              onPointerDown={(e) => e.stopPropagation()}
              onTouchStart={(e) => e.stopPropagation()}
            >
              <button
                type="button"
                className="active-room-menu-btn"
                aria-label="Active room actions"
                aria-expanded={showActiveRoomMenu}
                onPointerDown={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setShowRoomMenu(false);
                  setOpenRoomActionMenuId('');
                  setShowActiveRoomMenu((prev) => !prev);
                }}
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                }}
              >
                ⋯
              </button>

              {showActiveRoomMenu && (
                <div className="active-room-menu-popover">
                  <button type="button" onClick={openActiveRoomInfo}>
                    Group Info
                  </button>

                  <button
                    type="button"
                    disabled={renderedMediaMessages.length === 0}
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      e.nativeEvent?.stopImmediatePropagation?.();
                      openRoomMediaGrid(e);
                    }}
                  >
                    Media
                    {renderedMediaMessages.length > 0 && (
                      <span className="active-room-menu-count">
                        {renderedMediaMessages.length > 99 ? '99+' : renderedMediaMessages.length}
                      </span>
                    )}
                  </button>
                </div>
              )}
            </div>
          </div>

          <div className="messages" ref={messagesRef}>
            {messagesLoading ? (
              <p className="empty">Loading messages...</p>
            ) : renderedMessages.length === 0 ? (
              <p className="empty">No messages yet</p>
            ) : (
              renderedMessages.map((msg, index) => (
                <div
                  key={msg.messageId || msg.clientId || `${msg.createdAt || 'msg'}-${index}`}
                  className={msg.senderId === userId ? 'msg mine' : 'msg'}
                >
                  <b>{msg.senderName || msg.name || 'User'}</b>

                  <div className="room-message-content">
                    {(msg.text || msg.message) && (
                      <p>
                        {msg.text || msg.message || ''}
                        {msg.pending && <span className="msg-state"> Sending...</span>}
                        {msg.failed && <span className="msg-state failed"> Failed</span>}
                      </p>
                    )}

                    {msg.mediaType === 'image' && (msg.mediaUrl || msg.fileUrl) && (
                      <button
                        type="button"
                        className="room-message-media-tap"
                        onClick={(event) => {
                          event.preventDefault();
                          event.stopPropagation();
                          openMediaViewer(msg);
                        }}
                        aria-label="Open image"
                      >
                        <img
                          src={msg.mediaUrl || msg.fileUrl}
                          alt={msg.fileName || 'Shared image'}
                          className="room-message-image"
                          loading="lazy"
                          decoding="async"
                        />
                      </button>
                    )}

                    {msg.mediaType === 'video' && (msg.mediaUrl || msg.fileUrl) && (
                      <button
                        type="button"
                        className="room-message-media-tap"
                        onClick={(event) => {
                          event.preventDefault();
                          event.stopPropagation();
                          openMediaViewer(msg);
                        }}
                        aria-label="Play video"
                      >
                        <video
                          className="room-message-video"
                          src={msg.mediaUrl || msg.fileUrl}
                          muted
                          preload="metadata"
                          playsInline
                        />
                        <span className="room-video-play-badge">▶</span>
                      </button>
                    )}

                    {msg.mediaType === 'file' && (msg.mediaUrl || msg.fileUrl) && (
                      <button
                        type="button"
                        className="room-message-file"
                        onClick={(event) => {
                          event.preventDefault();
                          event.stopPropagation();
                          openMediaViewer(msg);
                        }}
                      >
                        📎 {getShortRoomFileName(msg.fileName || msg.mediaName || 'Attachment')}
                      </button>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>

          <form className="input" onSubmit={sendMessage}>
            {selectedMediaPreview && (
              <div className="selected-room-media-preview">
                {selectedMediaType === 'image' ? (
                  <img src={selectedMediaPreview} alt="Preview" />
                ) : selectedMediaType === 'video' ? (
                  <video src={selectedMediaPreview} muted playsInline />
                ) : (
                  <span>📎 {selectedMediaFile?.name || 'Attachment'}</span>
                )}

                <button
                  type="button"
                  className="remove-selected-room-media"
                  onClick={removeSelectedMedia}
                >
                  ✕
                </button>

                {uploadingMedia && (
                  <div className="room-media-upload-progress">
                    <span style={{ width: `${mediaUploadProgress}%` }} />
                  </div>
                )}
              </div>
            )}

            <input
              placeholder="Type message..."
              disabled={!activeRoom}
              value={text}
              onChange={(e) => setText(e.target.value)}
              onFocus={scrollMessagesToBottom}
            />

            <label className="room-media-picker-btn">
              ＋
              <input
                type="file"
                accept="image/*,video/*,.pdf,.doc,.docx,.ppt,.pptx,.xls,.xlsx,.csv,.txt,.rtf,.zip,.rar"
                hidden
                onChange={handleRoomMediaChange}
              />
            </label>

            <button
              type="submit"
              disabled={(!text.trim() && !selectedMediaFile) || !activeRoom || uploadingMedia}
            >
              {uploadingMedia ? `${mediaUploadProgress || 0}%` : 'Send'}
            </button>
          </form>
        </>
      )}
    </section>

    {showRoomMediaGrid && activeRoom && (
      <div
        className="room-media-grid-overlay"
        role="dialog"
        aria-modal="true"
        aria-label="Room media grid"
        onClick={closeRoomMediaGrid}
      >
        <div className="room-media-grid-panel" onClick={(event) => event.stopPropagation()}>
          <div className="room-media-grid-header">
            <div>
              <p>Room Media</p>
              <h3>{activeRoom.name}</h3>
            </div>

            <button type="button" className="room-media-grid-close" onClick={closeRoomMediaGrid}>
              ×
            </button>
          </div>

          {renderedMediaMessages.length === 0 ? (
            <p className="room-media-grid-empty">No photos, videos, or files shared yet.</p>
          ) : (
            <div className="room-media-grid-list">
              {renderedMediaMessages.map((item, index) => {
                const itemUrl = item.mediaUrl || item.fileUrl;

                return (
                  <button
                    type="button"
                    key={item.messageId || item.clientId || item.mediaKey || itemUrl || index}
                    className={`room-media-grid-item ${item.mediaType === 'file' ? 'room-media-grid-file-item' : ''}`}
                    onClick={(event) => {
                      event.preventDefault();
                      event.stopPropagation();
                      openMediaFromGrid(item);
                    }}
                  >
                    {item.mediaType === 'video' ? (
                      <>
                        <video src={itemUrl} muted preload="metadata" playsInline className="room-media-grid-video" />
                        <span className="room-media-grid-play">▶</span>
                      </>
                    ) : item.mediaType === 'file' ? (
                      <span className="room-media-grid-file-card">
                        <span className="room-media-grid-file-icon">📎</span>
                        <strong>{getShortRoomFileName(item.fileName || item.mediaName || 'Attachment')}</strong>
                        <small>{item.contentType || 'File'}</small>
                      </span>
                    ) : (
                      <img
                        src={itemUrl}
                        alt={item.fileName || item.mediaName || 'Room media'}
                        className="room-media-grid-image"
                        loading="lazy"
                        decoding="async"
                      />
                    )}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>
    )}

    {mediaViewer && activeMediaViewerItem && (
      <div
        className="room-media-viewer"
        role="dialog"
        aria-modal="true"
        aria-label="Media viewer"
        onClick={closeMediaViewer}
        onTouchStart={handleMediaViewerTouchStart}
        onTouchEnd={handleMediaViewerTouchEnd}
      >
        <div className="room-media-viewer-card" onClick={(event) => event.stopPropagation()}>
          <div className="room-media-viewer-topbar">
            <span>{activeMediaViewerItem.senderName || activeMediaViewerItem.name || 'User'}</span>

            <span className="room-media-viewer-count">
              {Number(mediaViewer.index || 0) + 1}/{mediaViewerCount}
            </span>

            <button
              type="button"
              className="room-media-viewer-back"
              onClick={(event) => {
                event.preventDefault();
                event.stopPropagation();
                backToRoomMediaGrid();
              }}
            >
              ← Grid
            </button>

            <button
              type="button"
              className="room-media-viewer-close"
              onClick={(event) => {
                event.preventDefault();
                event.stopPropagation();
                closeMediaViewer();
              }}
            >
              ✕
            </button>
          </div>

          {activeMediaViewerItem.mediaType === 'video' ? (
            <video
              key={activeMediaViewerItem.mediaUrl || activeMediaViewerItem.fileUrl}
              ref={mediaViewerVideoRef}
              src={activeMediaViewerItem.mediaUrl || activeMediaViewerItem.fileUrl}
              controls
              autoPlay
              playsInline
              className="room-media-viewer-video"
            />
          ) : (
            <img
              src={activeMediaViewerItem.mediaUrl || activeMediaViewerItem.fileUrl}
              alt={activeMediaViewerItem.fileName || activeMediaViewerItem.mediaName || 'Shared media'}
              className="room-media-viewer-image"
            />
          )}
        </div>
      </div>
    )}

    {showActiveRoomInfo && activeRoom && (
      <div
        className="active-room-info-shell"
        role="dialog"
        aria-modal="true"
        aria-label="Group information"
        onClick={() => setShowActiveRoomInfo(false)}
      >
        <section className="active-room-info-panel" onClick={(event) => event.stopPropagation()}>
          <div className="active-room-info-cover">
            {activeRoomImageUrl ? (
              <img src={activeRoomImageUrl} alt={activeRoom.name} />
            ) : (
              <span>{(activeRoom.name || 'G').slice(0, 1).toUpperCase()}</span>
            )}
          </div>

          <div className="active-room-info-header">
            <div>
              <p className="active-room-info-kicker">Group info</p>
              <h2>{activeRoom.name}</h2>
              <p>
                {activeRoom.privacy === 'private' ? 'Private group' : 'Public group'}
                {activeRoom.memberCount ? ` · ${activeRoom.memberCount} members` : ''}
              </p>

              {isRoomOwner(activeRoom, userId) && (
                <span className="room-owner-badge">You created this</span>
              )}
            </div>

            <button
              type="button"
              className="active-room-info-close"
              onClick={() => setShowActiveRoomInfo(false)}
            >
              ✕
            </button>
          </div>

          <div className="active-room-info-rows">
            <button
              type="button"
              className={`active-room-info-row ${activeInfoSection === 'media' ? 'open' : ''}`}
              onClick={() => toggleActiveInfoSection('media')}
            >
              Media
            </button>

            <button
              type="button"
              className={`active-room-info-row ${activeInfoSection === 'members' ? 'open' : ''}`}
              onClick={() => toggleActiveInfoSection('members')}
            >
              Members
            </button>

            {activeRoomCanEdit && activeRoom.privacy === 'private' && (
              <button
                type="button"
                className={`active-room-info-row ${activeInfoSection === 'requests' ? 'open' : ''}`}
                onClick={() => toggleActiveInfoSection('requests')}
              >
                Requests
              </button>
            )}

            {activeRoomCanEdit && (
              <button type="button" className="active-room-info-row" onClick={() => openEditRoomModal(activeRoom)}>
                Edit
              </button>
            )}

            {activeRoomCanEdit && activeRoom.privacy === 'private' && (
              <button
                type="button"
                className={`active-room-info-row ${activeInfoSection === 'invite' ? 'open' : ''}`}
                onClick={() => toggleActiveInfoSection('invite')}
              >
                Invite
              </button>
            )}
          </div>

          <div className="active-room-info-expanded-area">
            {activeInfoSection === 'members' && (
              <div className="active-room-info-inline-section">
                {modalMode !== 'members' ? (
                  <p className="active-room-info-empty">Loading members...</p>
                ) : members.length === 0 ? (
                  <p className="active-room-info-empty">No members loaded.</p>
                ) : (
                  members.map((member) => (
                    <div className="active-room-info-person" key={member.userId || member.email}>
                      <div className="active-room-info-avatar">
                        {member.avatarUrl || member.photoUrl || member.profilePic ? (
                          <img src={member.avatarUrl || member.photoUrl || member.profilePic} alt="" />
                        ) : (
                          <span>{(member.name || member.email || 'U').slice(0, 1).toUpperCase()}</span>
                        )}
                      </div>

                      <div>
                        <strong>{member.name || member.userName || member.email || 'User'}</strong>
                        <p>{member.email || member.userEmail || member.role || 'Member'}</p>
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}

            {activeInfoSection === 'media' && (
              <div className="active-room-info-inline-section media-grid">
                {renderedMediaMessages.length === 0 ? (
                  <p className="active-room-info-empty">No media shared yet.</p>
                ) : (
                  renderedMediaMessages.map((item) => (
                    <button
                      type="button"
                      className={`active-room-info-media-tile ${item.mediaType}`}
                      key={item.messageId || item.clientId || item.mediaUrl || item.fileUrl}
                      onClick={() => openMediaFromGrid(item)}
                    >
                      {item.mediaType === 'image' && (
                        <img src={item.mediaUrl || item.fileUrl} alt={item.fileName || 'Shared media'} />
                      )}

                      {item.mediaType === 'video' && (
                        <>
                          <video src={item.mediaUrl || item.fileUrl} muted playsInline preload="metadata" />
                          <span>▶</span>
                        </>
                      )}

                      {item.mediaType === 'file' && (
                        <div className="active-room-info-file-tile">
                          <strong>FILE</strong>
                          <small>{getShortRoomFileName(item.fileName || item.mediaName)}</small>
                        </div>
                      )}
                    </button>
                  ))
                )}
              </div>
            )}

            {activeInfoSection === 'requests' && activeRoomCanEdit && activeRoom.privacy === 'private' && (
              <div className="active-room-info-inline-section">
                {modalMode !== 'requests' ? (
                  <p className="active-room-info-empty">Loading requests...</p>
                ) : members.length === 0 ? (
                  <p className="active-room-info-empty">No pending requests.</p>
                ) : (
                  members.map((request) => (
                    <div className="active-room-info-person request" key={request.userId || request.email}>
                      <div className="active-room-info-avatar">
                        {request.avatarUrl || request.photoUrl || request.profilePic ? (
                          <img src={request.avatarUrl || request.photoUrl || request.profilePic} alt="" />
                        ) : (
                          <span>{(request.name || request.userName || request.email || 'U').slice(0, 1).toUpperCase()}</span>
                        )}
                      </div>

                      <div>
                        <strong>{request.name || request.userName || request.email || 'User'}</strong>
                        <p>
                          {request.source === 'inviteLink'
                            ? 'Requested through invite link'
                            : request.email || request.userEmail || 'Requested to join'}
                        </p>
                      </div>

                      <button
                        type="button"
                        className="active-room-info-approve"
                        onClick={() => approveJoinRequest(request.userId)}
                      >
                        Accept
                      </button>
                    </div>
                  ))
                )}
              </div>
            )}

            {activeInfoSection === 'invite' && activeRoomCanEdit && activeRoom.privacy === 'private' && (
              <div className="active-room-info-inline-section invite-link-inline">
                {inviteLinkLoading ? (
                  <p className="active-room-info-empty">Generating invite link...</p>
                ) : generatedInviteLink ? (
                  <>
                    <input value={generatedInviteLink} readOnly />
                    <button type="button" onClick={copyGeneratedInviteLink}>
                      {inviteLinkCopied ? 'Copied' : 'Copy link'}
                    </button>
                  </>
                ) : (
                  <>
                    <label className="invite-link-auto-accept-toggle">
                      <input
                        type="checkbox"
                        checked={inviteLinkAutoAccept}
                        onChange={(event) => setInviteLinkAutoAccept(event.target.checked)}
                        disabled={inviteLinkLoading || Boolean(generatedInviteLink)}
                      />

                      <div className="invite-link-auto-accept-content">
                        <div className="invite-link-auto-accept-header">
                          <span>Auto accept members</span>
                          <strong>{inviteLinkAutoAccept ? 'ON' : 'OFF'}</strong>
                        </div>

                        <small>
                          Users joining with this link will instantly enter the group without approval.
                        </small>
                      </div>
                    </label>

                    <button type="button" onClick={() => generatePrivateRoomInviteLink(activeRoom)}>
                      {inviteLinkAutoAccept ? 'Generate auto-join link' : 'Generate approval link'}
                    </button>
                  </>
                )}
              </div>
            )}
          </div>
        </section>
      </div>
    )}

    {inviteLinkModalOpen && (
      <div className="members-modal">
        <div className="members-card create-room-modal">
          <button
            type="button"
            className="close-members"
            onClick={() => {
              if (inviteCopiedTimerRef.current) {
                window.clearTimeout(inviteCopiedTimerRef.current);
                inviteCopiedTimerRef.current = null;
              }

              setInviteLinkModalOpen(false);
              setGeneratedInviteCode('');
              setGeneratedInviteLink('');
              setInviteLinkCopied(false);
              setInviteLinkLoading(false);
              setInviteLinkDisabling(false);
            }}
          >
            ✕
          </button>

          <h3>Private Room Invite Link</h3>
          <p className="member-empty">
            Share this link with users you want to invite.
          </p>

          <div className="invite-search-row">
            <input readOnly value={generatedInviteLink} onFocus={(event) => event.target.select()} />

            <button
              type="button"
              className="approve-request-btn"
              disabled={!generatedInviteLink}
              onClick={copyGeneratedInviteLink}
            >
              {inviteLinkCopied ? 'Copied' : 'Copy'}
            </button>

            <button
              type="button"
              className="approve-request-btn"
              disabled={!generatedInviteLink}
              onClick={() => window.open(generatedInviteLink, '_blank', 'noopener,noreferrer')}
            >
              Open
            </button>

            <button
              type="button"
              className="reject-request-btn"
              disabled={!generatedInviteLink || inviteLinkDisabling}
              onClick={disableGeneratedInviteLink}
            >
              {inviteLinkDisabling ? 'Disabling...' : 'Disable'}
            </button>
          </div>
        </div>
      </div>
    )}

    {showHidden && (
      <div className="members-modal">
        <div className="members-card">
          <button type="button" className="close-members" onClick={() => setShowHidden(false)}>
            ✕
          </button>

          <h3>Hidden Groups</h3>

          {hiddenRooms.length === 0 ? (
            <p className="member-empty">No hidden groups.</p>
          ) : (
            hiddenRooms.map((room) => (
              <div key={room.roomId} className="member-row hidden-room-row">
                <strong>{room.name}</strong>

                <button
                  type="button"
                  className="approve-request-btn unhide-room-btn"
                  onClick={() => unhideRoom(room)}
                >
                  Unhide
                </button>
              </div>
            ))
          )}
        </div>
      </div>
    )}

    {showRoomInvites && (
      <div className="members-modal">
        <div className="members-card">
          <button type="button" className="close-members" onClick={() => setShowRoomInvites(false)}>
            ✕
          </button>

          <h3>Room Invites</h3>

          {roomInvitesLoading ? (
            <p className="member-empty">Loading invites...</p>
          ) : roomInvites.length === 0 ? (
            <p className="member-empty">No pending room invites.</p>
          ) : (
            roomInvites.map((invite, index) => {
              const inviteRoomId = getRoomInviteRoomId(invite);

              return (
                <div key={inviteRoomId || `invite-${index}`} className="member-row room-invite-row">
                  <div>
                    <strong>{invite.roomName || invite.name || 'Room invite'}</strong>

                    {(invite.inviterName || invite.inviterEmail || invite.createdByName) && (
                      <small>
                        Invited by {invite.inviterName || invite.inviterEmail || invite.createdByName}
                      </small>
                    )}
                  </div>

                  <div className="room-invite-actions">
                    <button
                      type="button"
                      className="approve-request-btn room-invite-action-btn icon-action-btn"
                      aria-label="Accept invite"
                      title="Accept invite"
                      disabled={!inviteRoomId || processingInviteId === inviteRoomId}
                      onClick={() => acceptRoomInvite({ ...invite, roomId: inviteRoomId })}
                    >
                      {processingInviteId === inviteRoomId ? '...' : '✓'}
                    </button>

                    <button
                      type="button"
                      className="delete-room-btn room-invite-action-btn icon-action-btn"
                      aria-label="Reject invite"
                      title="Reject invite"
                      disabled={!inviteRoomId || processingInviteId === inviteRoomId}
                      onClick={() => rejectRoomInvite({ ...invite, roomId: inviteRoomId })}
                    >
                      ✕
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    )}

    {showMembers && (
      <div className="members-modal">
        <div className="members-card">
          <button type="button" className="close-members" onClick={() => setShowMembers(false)}>
            ✕
          </button>

          <h3>{modalTitle}</h3>

          {showInvite && (
            <div className="invite-box">
              <div className="invite-search-row">
                <input
                  placeholder="Search by email or ID..."
                  value={inviteSearch}
                  onChange={(e) => {
                    const value = e.target.value;
                    setInviteSearch(value);

                    if (userSearchTimerRef.current) {
                      window.clearTimeout(userSearchTimerRef.current);
                    }

                    const query = value.trim();

                    if (!query) {
                      setInviteResults([]);
                      return;
                    }

                    userSearchTimerRef.current = window.setTimeout(() => {
                      searchUsers(query);
                    }, USER_SEARCH_DEBOUNCE_MS);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();

                      if (userSearchTimerRef.current) {
                        window.clearTimeout(userSearchTimerRef.current);
                      }

                      searchUsers(inviteSearch);
                    }
                  }}
                />

                <button type="button" className="approve-request-btn" onClick={() => searchUsers(inviteSearch)}>
                  Search
                </button>
              </div>

              <div className="invite-results">
                {inviteResults.length === 0 ? (
                  <p className="member-empty">
                    Search for users and send them an invite request.
                  </p>
                ) : (
                  inviteResults.map((u) => {
                    const targetUserId = getInviteUserId(u);
                    const alreadyMember = isExistingRoomMember(u) || isRoomOwnerUser(u);
                    const alreadyInvited = Boolean(u.invited || pendingInviteUserIds.has(targetUserId));
                    const canInvite = canInviteUserToCurrentRoom(u);

                    return (
                      <div key={targetUserId || u.email} className="member-row invite-result-row">
                        <div className="invite-inline-row">
                          <div className="invite-user-info">
                            <strong>{u.name || u.email || 'User'}</strong>
                            {u.email && <small>{u.email}</small>}
                          </div>

                          <div className="invite-result-action">
                            {alreadyMember ? (
                              <span className="member-role-pill">Already in room</span>
                            ) : alreadyInvited ? (
                              <span className="member-role-pill">Invite sent</span>
                            ) : (
                              <button
                                type="button"
                                onClick={() => inviteUser(u)}
                                className="approve-request-btn invite-send-btn"
                                disabled={!canInvite}
                              >
                                Send Request
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          )}

          {members.length === 0 ? (
            <p className="member-empty">
              {modalMode === 'requests' ? 'No pending join requests.' : 'No members found.'}
            </p>
          ) : (
            members.map((member) => (
              <div key={member.userId || member.email} className="member-row">
                <div>
                  <strong>{member.name || member.userName || 'User'}</strong>
                  {(member.email || member.userEmail) && <small>{member.email || member.userEmail}</small>}
                </div>

                {modalMode === 'requests' ? (
                  <button
                    type="button"
                    className="approve-request-btn icon-action-btn"
                    aria-label="Accept join request"
                    title="Accept join request"
                    disabled={!member.userId}
                    onClick={() => approveJoinRequest(member.userId)}
                  >
                    ✓
                  </button>
                ) : (
                  <div className="member-actions">
                    <span>{member.role || 'member'}</span>

                    {isRoomOwner(modalRoom, userId) &&
                      member.userId !== userId &&
                      member.userId !== modalRoom?.ownerId &&
                      member.userId !== modalRoom?.createdBy && (
                        <button
                          type="button"
                          className="delete-room-btn member-remove-btn"
                          onClick={() => removeRoomMember(member)}
                        >
                          Kick Out
                        </button>
                      )}
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      </div>
    )}

    {showEditRoomModal && editRoomTarget && (
      <div className="members-modal">
        <div className="members-card create-room-modal">
          <button
            type="button"
            className="close-members"
            disabled={editRoomSaving}
            onClick={closeEditRoomModal}
          >
            ✕
          </button>

          <h3>Edit Topic</h3>
          {status && <p className="room-status">{status}</p>}

          <form onSubmit={saveEditRoom} className="create-form">
            <label className="edit-room-field-label">
              <span>Topic name</span>
              <input
                placeholder="Topic name..."
                value={editRoomName}
                maxLength={60}
                autoFocus
                disabled={editRoomSaving}
                onChange={(event) => {
                  setStatus('');
                  setEditRoomName(event.target.value);
                }}
              />
            </label>

            <label className="create-room-image-picker">
              <span>Topic image</span>
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp,image/gif"
                disabled={editRoomSaving}
                onChange={handleEditRoomImageChange}
              />
            </label>

            {(editRoomImagePreview || getRoomImageUrl(editRoomTarget)) && (
              <div className="create-room-image-preview-row">
                <img
                  src={editRoomImagePreview || getRoomImageUrl(editRoomTarget)}
                  alt="Topic preview"
                  width="56"
                  height="56"
                />

                {editRoomImagePreview && (
                  <button
                    type="button"
                    className="delete-room-btn"
                    disabled={editRoomSaving}
                    onClick={removeEditRoomImage}
                  >
                    Remove selected image
                  </button>
                )}
              </div>
            )}

            <button
              type="submit"
              className="approve-request-btn"
              disabled={editRoomSaving || !editRoomName.trim()}
            >
              {editRoomSaving ? 'Saving...' : 'Save Changes'}
            </button>
          </form>
        </div>
      </div>
    )}

    {showCreateModal && (
      <div className="members-modal">
        <div className="members-card create-room-modal">
          <button
            type="button"
            className="close-members"
            disabled={creatingRoom}
            onClick={() => {
              if (!creatingRoom) {
                removeNewRoomImage();
                setShowCreateModal(false);
              }
            }}
          >
            ✕
          </button>

          <h3>Create New Room</h3>
          {status && <p className="room-status">{status}</p>}

          <form onSubmit={createRoom} className="create-form">
            <input
              placeholder="Room name..."
              value={newRoomName}
              maxLength={60}
              autoFocus
              onChange={(e) => {
                setStatus('');
                setNewRoomName(e.target.value);
              }}
              disabled={creatingRoom}
            />

            <select
              value={newRoomPrivacy}
              onChange={(e) => setNewRoomPrivacy(e.target.value)}
              disabled={creatingRoom}
            >
              <option value="public"> Public Room</option>
              <option value="private"> Private Room</option>
            </select>

            <label className="create-room-image-picker">
              <span>Room image</span>
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp,image/gif"
                disabled={creatingRoom}
                onChange={handleNewRoomImageChange}
              />
            </label>

            {newRoomImagePreview && (
              <div className="create-room-image-preview-row">
                <img src={newRoomImagePreview} alt="Room preview" width="56" height="56" />

                <button
                  type="button"
                  className="delete-room-btn"
                  disabled={creatingRoom}
                  onClick={removeNewRoomImage}
                >
                  Remove image
                </button>
              </div>
            )}

            <button
              type="submit"
              className="approve-request-btn"
              disabled={creatingRoom || !newRoomName.trim()}
            >
              {creatingRoom
                ? newRoomImageFile
                  ? 'Creating and uploading...'
                  : 'Creating...'
                : 'Create Room'}
            </button>
          </form>
        </div>
      </div>
    )}
  </main>
);
}