import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { getStableGuestId, roomApi } from '../api/client';
import { useAuth } from '../contexts/AuthContext';
import { connectChatSocket, sendRoomMessage } from '../api/chatSocket';
import { Download, Trash2, X } from 'lucide-react';
import { useLocation, useNavigate } from 'react-router-dom';
import './TopicRoomsPage.css';
import RoomMediaModal from './RoomMediaModal';
import RoomMediaPreview from './RoomMediaPreview';
import RoomInfoPage from './RoomInfoPage';

const ROOM_IMAGE_CACHE_KEY = 'smarty_room_images_v1';
const JOINED_INVITE_ROOMS_CACHE_KEY = 'smarty_joined_invite_rooms_v1';
const API_ORIGIN = 'https://po2hwyb2c6.execute-api.us-east-1.amazonaws.com';
const APP_ORIGIN = import.meta.env.PROD
  ? 'https://main.d3qiuefonbp8n9.amplifyapp.com'
  : window.location.origin;

const ROOM_IMAGE_MAX_BYTES = 4 * 1024 * 1024;
const ROOM_IMAGE_PICKER_MAX_BYTES = 8 * 1024 * 1024;
const ROOM_MEDIA_MAX_BYTES = 80 * 1024 * 1024;
const ROOM_MEDIA_MAX_FILES_PER_BATCH = 50;
const ROOM_MEDIA_MAX_BATCH_BYTES = 1024 * 1024 * 1024;
const ROOM_LIST_CACHE_MS = 25_000;
const ROOM_MEMBERS_CACHE_MS = 30_000;
const USER_SEARCH_DEBOUNCE_MS = 350;
const ROOM_INVITES_REFRESH_MS = 45_000;
const MAX_RENDERED_ROOMS = 250;
const ROOM_IMAGE_EAGER_LIMIT = 2;
const ROOM_IMAGE_RENDER_LIMIT = 10;
const ROOM_PRELOADED_VISIBLE_MEDIA = 5;
const MAX_RENDERED_MEDIA_MESSAGES = 600;
const ROOM_MESSAGES_FETCH_LIMIT = 120;
const ROOM_MESSAGES_REVEAL_STEP = 20;

const ROOM_INITIAL_VISIBLE_MESSAGES = 20;
const ROOM_OLDER_MESSAGES_LAYOUT_STABILIZE_MS = 260;
const ROOM_PAGE_DEFERRED_LOAD_MS = 450;
const ROOM_MEDIA_UPLOAD_TIMEOUT_MS = 45000;
const ROOM_MAX_CACHED_MESSAGE_ROOMS = 25;
const ROOM_MESSAGE_BATCH_RENDER_SIZE = 40;
const ROOM_SCROLL_BOTTOM_DEBOUNCE_MS = 80;

const ROOM_LOAD_TIMEOUT_MS = /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent)
  ? 30000
  : 18000;


const ROOM_MEDIA_IMAGE_EXTENSIONS = /\.(jpg|jpeg|png|webp|gif|avif)(\?|#|$)/i;
const ROOM_MEDIA_VIDEO_EXTENSIONS = /\.(mp4|webm|mov|m4v)(\?|#|$)/i;
const ROOM_MEDIA_DOCUMENT_EXTENSIONS = /\.(pdf|doc|docx|ppt|pptx|xls|xlsx|csv|txt|rtf|zip|rar|7z)(\?|#|$)/i;
const ROOM_MEDIA_ALLOWED_TYPES = /^(image\/|video\/|application\/pdf|application\/msword|application\/vnd\.openxmlformats-officedocument|application\/vnd\.ms-|text\/plain|text\/csv|application\/zip|application\/x-zip-compressed|application\/x-rar-compressed|application\/x-7z-compressed|application\/octet-stream)/i;

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

// --- Joined Invite Rooms Fallback Cache ---
function getStoredJoinedInviteRooms() {
  try {
    const stored = JSON.parse(localStorage.getItem(JOINED_INVITE_ROOMS_CACHE_KEY) || '[]');
    return Array.isArray(stored) ? stored.filter((room) => room?.roomId || room?.id) : [];
  } catch {
    return [];
  }
}

function persistJoinedInviteRoom(room) {
  const roomId = String(room?.roomId || room?.id || '').trim();
  if (!roomId) return;

  try {
    const current = getStoredJoinedInviteRooms();
    const normalizedRoom = {
      ...room,
      roomId,
      id: roomId,
      name: room?.name || room?.roomName || 'Joined group',
      roomName: room?.roomName || room?.name || 'Joined group',
      privacy: normalizeRoomPrivacy({ ...room, privacy: room?.privacy || room?.visibility || 'private' }),
      type: room?.type || 'custom',
      isPrivate: normalizeRoomPrivacy({ ...room, privacy: room?.privacy || room?.visibility || 'private' }) === 'private',
      joinedViaInvite: true,
      joinedAt: room?.joinedAt || Date.now(),
    };

    const next = [
      normalizedRoom,
      ...current.filter((item) => String(item?.roomId || item?.id || '') !== roomId),
    ].slice(0, 50);

    localStorage.setItem(JOINED_INVITE_ROOMS_CACHE_KEY, JSON.stringify(next));
  } catch {
    // Ignore storage errors.
  }
}

function mergeJoinedInviteRooms(rooms = [], extraRoom = null) {
  const joinedRooms = getStoredJoinedInviteRooms();
  const candidates = extraRoom ? [extraRoom, ...joinedRooms] : joinedRooms;
  const nextRooms = Array.isArray(rooms) ? [...rooms] : [];

  candidates.forEach((room) => {
    const roomId = String(room?.roomId || room?.id || '').trim();
    if (!roomId) return;

    const normalizedRoom = {
      ...room,
      roomId,
      id: roomId,
      name: room?.name || room?.roomName || 'Joined group',
      roomName: room?.roomName || room?.name || 'Joined group',
      privacy: normalizeRoomPrivacy({ ...room, privacy: room?.privacy || room?.visibility || 'private' }),
      type: room?.type || 'custom',
      isPrivate: normalizeRoomPrivacy({ ...room, privacy: room?.privacy || room?.visibility || 'private' }) === 'private',
      joinedViaInvite: true,
    };

    const existingIndex = nextRooms.findIndex(
      (item) => String(item?.roomId || item?.id || '') === roomId
    );

    if (existingIndex >= 0) {
      nextRooms[existingIndex] = {
        ...normalizedRoom,
        ...nextRooms[existingIndex],
      };
    } else {
      nextRooms.unshift(normalizedRoom);
    }
  });

  return nextRooms;
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

function normalizeRoomPrivacy(room = {}) {
  const privacy = String(room?.privacy || '').trim().toLowerCase();
  const visibility = String(room?.visibility || '').trim().toLowerCase();

  if (privacy === 'private' || privacy === 'public') {
    return privacy;
  }

  if (visibility === 'private' || visibility === 'public') {
    return visibility;
  }

  if (room?.isPrivate === true) {
    return 'private';
  }

  if (room?.isPrivate === false) {
    return 'public';
  }

  return 'public';
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


function getRoomMessageTimeValue(message = {}) {
  const rawValue =
    message.createdAtMs ||
    message.createdAt ||
    message.timestamp ||
    message.sentAt ||
    0;

  if (typeof rawValue === 'number') return rawValue;

  const numericValue = Number(rawValue);
  if (Number.isFinite(numericValue) && numericValue > 0) return numericValue;

  const parsedValue = Date.parse(String(rawValue || ''));
  return Number.isFinite(parsedValue) ? parsedValue : 0;
}

function sortRoomMessages(messages = []) {
  return [...messages].sort((a, b) => getRoomMessageTimeValue(a) - getRoomMessageTimeValue(b));
}

function formatRoomMessageTime(message = {}) {
  const value = getRoomMessageTimeValue(message);
  if (!value) return '';

  return new Intl.DateTimeFormat(undefined, {
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value));
}



function extractRoomArray(data, keys = []) {
  const { payload, body } = parseApiPayload(data);
  const responseData = body?.data || payload?.data || body || payload || data || {};

  for (const key of keys) {
    if (Array.isArray(data?.[key])) return data[key];
    if (Array.isArray(payload?.[key])) return payload[key];
    if (Array.isArray(body?.[key])) return body[key];
    if (Array.isArray(responseData?.[key])) return responseData[key];
    if (Array.isArray(responseData?.data?.[key])) return responseData.data[key];
  }

  if (Array.isArray(responseData?.Items)) return responseData.Items;
  if (Array.isArray(responseData?.users)) return responseData.users;
  if (Array.isArray(data)) return data;
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(body)) return body;
  if (Array.isArray(responseData)) return responseData;

  return [];
}

function getRoomMembersFromResponse(data) {
  const { payload, body } = parseApiPayload(data);
  const responseData = body?.data || payload?.data || body || payload || data || {};

  const candidates = [
    data?.members,
    data?.Items,
    data?.users,
    data?.roomMembers,
    data?.data?.members,
    data?.data?.Items,
    data?.data?.users,
    data?.data?.roomMembers,
    payload?.members,
    payload?.Items,
    payload?.users,
    payload?.roomMembers,
    payload?.data?.members,
    payload?.data?.Items,
    payload?.data?.users,
    payload?.data?.roomMembers,
    body?.members,
    body?.Items,
    body?.users,
    body?.roomMembers,
    body?.data?.members,
    body?.data?.Items,
    body?.data?.users,
    body?.data?.roomMembers,
    responseData?.members,
    responseData?.Items,
    responseData?.users,
    responseData?.roomMembers,
  ];

  const members = candidates.find((candidate) => Array.isArray(candidate));
  return members || [];
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

function preserveScrollAnchor(element, delta) {
  if (!element || !Number.isFinite(delta) || Math.abs(delta) < 0.5) return;

  const previousScrollBehavior = element.style.scrollBehavior;
  const previousOverflowAnchor = element.style.overflowAnchor;

  element.style.scrollBehavior = 'auto';
  element.style.overflowAnchor = 'none';
  element.scrollTop = Math.max(0, element.scrollTop + delta);

  window.requestAnimationFrame(() => {
    element.style.scrollBehavior = previousScrollBehavior;
    element.style.overflowAnchor = previousOverflowAnchor;
  });
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
  const mediaUrl = String(
    message.mediaUrl ||
      message.fileUrl ||
      message.url ||
      message.attachmentUrl ||
      message.downloadUrl ||
      message.location ||
      ''
  ).trim();
  const contentType = String(message.contentType || message.mimeType || message.type || '').trim();
  const fileName = String(
    message.fileName ||
      message.mediaName ||
      message.name ||
      (mediaUrl ? mediaUrl.split('/').filter(Boolean).pop()?.split('?')[0] : '') ||
      ''
  ).trim();
  const lowerUrl = String(mediaUrl || fileName || '').toLowerCase();

  let mediaType = message.mediaType || '';

  if (mediaUrl) {
    if (String(contentType).startsWith('image/') || ROOM_MEDIA_IMAGE_EXTENSIONS.test(lowerUrl)) {
      mediaType = 'image';
    } else if (String(contentType).startsWith('video/') || ROOM_MEDIA_VIDEO_EXTENSIONS.test(lowerUrl)) {
      mediaType = 'video';
    } else if (
      mediaType === 'document' ||
      mediaType === 'attachment' ||
      mediaType === 'file' ||
      ROOM_MEDIA_DOCUMENT_EXTENSIONS.test(lowerUrl) ||
      ROOM_MEDIA_ALLOWED_TYPES.test(String(contentType))
    ) {
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
    fileUrl: message.fileUrl || message.mediaUrl || mediaUrl,
    mediaType,
    contentType,
    fileName,
    mediaName: message.mediaName || fileName,
    hasMediaPreview: Boolean(mediaUrl && (mediaType === 'image' || mediaType === 'video' || mediaType === 'file')),
  };
}

// Merge two room messages, preserving media fields from the existing message if incoming has no media
function mergeRoomMessagePreservingMedia(existingMessage = {}, incomingMessage = {}) {
  const normalizedExisting = normalizeRoomMessageMedia(existingMessage);
  const normalizedIncoming = normalizeRoomMessageMedia(incomingMessage);

  const incomingHasMedia = Boolean(
    normalizedIncoming.mediaUrl ||
    normalizedIncoming.fileUrl ||
    normalizedIncoming.mediaKey ||
    normalizedIncoming.mediaType ||
    normalizedIncoming.fileName ||
    normalizedIncoming.mediaName
  );

  const merged = {
    ...normalizedExisting,
    ...normalizedIncoming,
  };

  if (!incomingHasMedia) {
    merged.mediaKey = normalizedExisting.mediaKey || merged.mediaKey || '';
    merged.mediaUrl = normalizedExisting.mediaUrl || merged.mediaUrl || '';
    merged.fileUrl = normalizedExisting.fileUrl || normalizedExisting.mediaUrl || merged.fileUrl || '';
    merged.mediaType = normalizedExisting.mediaType || merged.mediaType || '';
    merged.contentType = normalizedExisting.contentType || merged.contentType || '';
    merged.fileName = normalizedExisting.fileName || merged.fileName || '';
    merged.mediaName = normalizedExisting.mediaName || normalizedExisting.fileName || merged.mediaName || '';
  }

  return normalizeRoomMessageMedia(merged);
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
      `${msg.createdAt || 'msg'}-${msg.senderId || 'user'}-${String(msg.text || msg.message || '')}`;

    if (!key || seen.has(key)) continue;

    seen.add(key);
    unique.push(msg);
  }

  return unique;
}



function trimRoomMessagesForMemory(messages = []) {
  const normalizedMessages = Array.isArray(messages)
    ? sortRoomMessages(dedupeMessages(messages.map(normalizeRoomMessageMedia)))
    : [];

  if (normalizedMessages.length <= MAX_RENDERED_MEDIA_MESSAGES) {
    return normalizedMessages;
  }

  return normalizedMessages.slice(-MAX_RENDERED_MEDIA_MESSAGES);
}


function getLoadedRoomMessages(data) {
  return extractRoomArray(data, ['messages', 'Items']).map(normalizeRoomMessageMedia);
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

async function persistRoomImageToTable(roomId, imageUrl) {
  if (!roomId || !imageUrl) return false;

  try {
    if (typeof roomApi.updateRoomImage === 'function') {
      await roomApi.updateRoomImage(roomId, imageUrl);
      return true;
    }

    if (typeof roomApi.updateRoom === 'function') {
      await roomApi.updateRoom(roomId, getRoomImagePatch(imageUrl));
      return true;
    }

    console.warn('No dedicated room image update API found. Using local state only.');
    return true;
  } catch (err) {
    console.error('Failed to persist room image:', err);
    throw err;
  }
}

function getRoomMessageId(message) {
  return message?.messageId || message?.id || message?.clientId || '';
}

function getStableRoomMessageKey(message = {}) {
  return String(
    message.messageId ||
      message.id ||
      message.clientId ||
      message.mediaKey ||
      message.mediaUrl ||
      message.fileUrl ||
      `${message.createdAt || message.createdAtMs || 'msg'}-${message.senderId || 'user'}-${String(message.text || message.message || '').slice(0, 80)}`
  );
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

function getNavigationRoomOpenId(locationState = {}) {
  if (!locationState || typeof locationState !== 'object') return '';
  if (locationState.openJoinedRoom !== true) return '';

  return String(
    locationState?.openRoomId ||
      locationState?.selectedRoomId ||
      locationState?.activeRoomId ||
      locationState?.roomId ||
      locationState?.joinedRoom?.roomId ||
      locationState?.joinedRoom?.id ||
      ''
  ).trim();
}

function renderMessageWithLinks(value = '') {
  const text = String(value || '');
  if (!text) return null;

  const urlRegex = /(https?:\/\/[^\s<]+|www\.[^\s<]+)/gi;
  const parts = text.split(urlRegex);

  return parts.map((part, index) => {
    if (!part) return null;
    urlRegex.lastIndex = 0;

    if (urlRegex.test(part)) {
      const href = part.toLowerCase().startsWith('http') ? part : `https://${part}`;

      return (
        <a
          key={`${part}-${index}`}
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          className="room-message-link"
          onClick={(event) => event.stopPropagation()}
        >
          {part}
        </a>
      );
    }

    return <span key={`${part}-${index}`}>{part}</span>;
  });
}




export default function TopicRoomsPage() {
  const { user } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const authUserId = user?.sub || user?.userId || user?.id || '';
  const guestUserId = getStableGuestId();
  const userId = authUserId || guestUserId;
  const isGuestUser = !authUserId;

  // --- Patch: getRoomsForCurrentSession ---
  async function getRoomsForCurrentSession(params = {}) {
    if (!isGuestUser) {
      return roomApi.getRooms(params);
    }

    const query = new URLSearchParams();

    Object.entries(params || {}).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== '') {
        query.set(key, String(value));
      }
    });

    const requestUrl = `${API_ORIGIN}/rooms/public${query.toString() ? `?${query.toString()}` : ''}`;
    const response = await fetch(requestUrl, {
      method: 'GET',
      headers: {
        Accept: 'application/json',
      },
    });

    let payload = null;

    try {
      payload = await response.json();
    } catch {
      payload = null;
    }

    if (!response.ok) {
      const error = new Error(payload?.error || payload?.message || `Failed to load rooms (${response.status})`);
      error.response = {
        status: response.status,
        data: payload || {},
      };
      throw error;
    }

    return payload || {};
  }

  function requireLoggedInAction(actionLabel = 'do this') {
  if (!isGuestUser) return false;

  setStatus(`Only logged-in users can ${actionLabel}. Please log in first.`);
  setShowCreateModal(false);
  setShowInvite(false);
  setInviteLinkModalOpen(false);
  setShowRoomMenu(false);
  setShowActiveRoomMenu(false);
  setOpenRoomActionMenuId('');

  return true;
}

  function getInviteUserId(userValue) {
    if (typeof userValue === 'string') return userValue;

    return String(
      userValue?.userId ||
        userValue?.id ||
        userValue?.sub ||
        userValue?.invitedUserId ||
        userValue?.requestUserId ||
        userValue?.requestedUserId ||
        userValue?.memberId ||
        userValue?.profileId ||
        ''
    ).trim();
  }

  const activeRoomRef = useRef(null);
  const messagesRef = useRef(null);
  const shouldAutoScrollToNewestRef = useRef(false);
  const roomMediaViewerOpenerRef = useRef(null);
  const [roomImageCache, setRoomImageCache] = useState(() => getStoredRoomImages());
  const [failedRoomImages, setFailedRoomImages] = useState(() => ({}));
  const [mobileChatOpen, setMobileChatOpen] = useState(false);
  const [hiddenRooms, setHiddenRooms] = useState([]);
  const [showHidden, setShowHidden] = useState(false);
  const [roomsLoading, setRoomsLoading] = useState(false);
  const [initialRoomsReady, setInitialRoomsReady] = useState(false);
  const [messagesLoading, setMessagesLoading] = useState(false);
  const [olderMessagesLoading, setOlderMessagesLoading] = useState(false);
  const [hasOlderMessages, setHasOlderMessages] = useState(true);
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
  const [selectedMediaFiles, setSelectedMediaFiles] = useState([]);
  const [selectedMediaPreview, setSelectedMediaPreview] = useState('');
  const [selectedMediaPreviews, setSelectedMediaPreviews] = useState([]);
  const [selectedMediaType, setSelectedMediaType] = useState('');
  const [uploadingMedia, setUploadingMedia] = useState(false);
  const [mediaUploadProgress, setMediaUploadProgress] = useState(0);
  const [mediaUploadLabel, setMediaUploadLabel] = useState('');
  const roomMessagesCacheRef = useRef({});
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
  const [imageCropModalOpen, setImageCropModalOpen] = useState(false);
  const [imageCropTarget, setImageCropTarget] = useState('');
  const [imageCropSourceFile, setImageCropSourceFile] = useState(null);
  const [imageCropSourceUrl, setImageCropSourceUrl] = useState('');
  const [imageCropZoom, setImageCropZoom] = useState(1);
  const [imageCropOffset, setImageCropOffset] = useState({ x: 0, y: 0 });
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
  const [activeInfoLoading, setActiveInfoLoading] = useState(false);
  const [activeInfoMembers, setActiveInfoMembers] = useState([]);
  const [activeInfoRequests, setActiveInfoRequests] = useState([]);
  const [showMembers, setShowMembers] = useState(false);
  const [status, setStatus] = useState('');
  const [creatingRoom, setCreatingRoom] = useState(false);
  const [deletingMessageId, setDeletingMessageId] = useState('');
  const [showScrollToBottom, setShowScrollToBottom] = useState(false);
  const messagesStateRef = useRef([]);
  const roomMediaCacheRef = useRef({});
  const mountedRef = useRef(true);
  const loadingRoomRef = useRef(false);
  const roomOpenRequestIdRef = useRef(0);
  const pendingNavigationOpenRoomIdRef = useRef('');
  const handledNavigationOpenKeyRef = useRef('');
  const olderMessagesLoadingRef = useRef(false);
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
  const [showRoomMediaGrid, setShowRoomMediaGrid] = useState(false);


  const roomMenuRef = useRef(null);
  const olderScrollAnchorRef = useRef(null);
  const roomActionMenuRef = useRef(null);
  const activeRoomMenuRef = useRef(null);



  const initialRoomScrollDoneRef = useRef('');
  const selectedMediaPreviewsRef = useRef([]);
  const pendingMessageIdsRef = useRef(new Set());

const scrollBottomTimeoutRef = useRef(null);

const scrollMessagesToBottom = useCallback((options = {}) => {
  const {
    behavior = 'auto',
    settle = false,
    restoreDelay = 220,
  } = options;

  const container = messagesRef.current;
  if (!container) return;

  const previousBehavior = container.style.scrollBehavior;

  const jumpToBottom = () => {
    const latestContainer = messagesRef.current;
    if (!latestContainer) return;

    latestContainer.style.scrollBehavior = behavior;
    latestContainer.scrollTop = latestContainer.scrollHeight;
  };

  jumpToBottom();

  if (settle) {
    requestAnimationFrame(() => {
      jumpToBottom();

      requestAnimationFrame(() => {
        jumpToBottom();
        setTimeout(jumpToBottom, 80);
      });
    });
  }

  if (scrollBottomTimeoutRef.current) {
    window.clearTimeout(scrollBottomTimeoutRef.current);
  }

  scrollBottomTimeoutRef.current = window.setTimeout(() => {
    const latestContainer = messagesRef.current;

    if (latestContainer) {
      latestContainer.style.scrollBehavior = previousBehavior;
    }

    scrollBottomTimeoutRef.current = null;
  }, restoreDelay);
}, []);

const jumpMessagesToBottomOnce = useCallback(() => {
  shouldAutoScrollToNewestRef.current = true;

  scrollMessagesToBottom({
    behavior: 'auto',
    settle: true,
    restoreDelay: 220,
  });
}, [scrollMessagesToBottom]);

const isMessagesNearBottom = useCallback((threshold = 320) => {
  const el = messagesRef.current;
  if (!el) return true;

  const distanceFromBottom =
    el.scrollHeight - el.scrollTop - el.clientHeight;

  return distanceFromBottom <= threshold;
}, []);
  

  const activeRoomCanDeleteMessages = useMemo(
    () => activeRoom?.type === 'custom' && activeRoom?.privacy === 'private' && isRoomOwner(activeRoom, userId),
    [activeRoom, userId]
  );

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
     .filter((room) => {
  const privacy = normalizeRoomPrivacy(room);

  if (roomPrivacyFilter === 'private') {
    return privacy === 'private';
  }

  return privacy !== 'private';
})
      .filter((room) => {
        if (!normalizedSearch) return true;
        return String(room.name || '').toLowerCase().includes(normalizedSearch);
      })
      .slice(0, MAX_RENDERED_ROOMS);
  }, [rooms, roomPrivacyFilter, roomSearch]);

const renderedMessages = useMemo(() => {
  if (!Array.isArray(messages)) return [];

  if (messages.length <= MAX_RENDERED_MEDIA_MESSAGES) {
    return messages;
  }

  return messages.slice(-MAX_RENDERED_MEDIA_MESSAGES);
}, [messages]);

const MessageRow = useCallback((msg) => {
  const messageKey = getStableRoomMessageKey(msg);

  const messageIndex = renderedMessages.findIndex(
    (item) => getStableRoomMessageKey(item) === messageKey
  );

  // Removed unused preloadMedia block

  return (
    <div
      key={messageKey}
      data-message-key={messageKey}
      className={msg.senderId === userId ? 'msg mine' : 'msg'}
    >
      {activeRoomCanDeleteMessages && getRoomMessageId(msg) && (
        <button
          type="button"
          className="room-message-delete-btn"
          disabled={deletingMessageId === getRoomMessageId(msg)}
          onClick={(event) => {
            event.preventDefault();
            event.stopPropagation();
            deleteRoomMessage(msg);
          }}
          aria-label="Delete message"
          title="Delete message"
        >
          {deletingMessageId === getRoomMessageId(msg)
            ? '…'
            : <Trash2 size={15} strokeWidth={2.4} />}
        </button>
      )}

      <b>{msg.senderName || msg.name || 'User'}</b>

      <div className="room-message-content">
        {(msg.text || msg.message) && (
          <p>
            {renderMessageWithLinks(msg.text || msg.message || '')}

            {msg.pending && (
              <span className="msg-state"> Sending...</span>
            )}

            {msg.failed && (
              <span className="msg-state failed"> Failed</span>
            )}
          </p>
        )}

        {msg.hasMediaPreview && (msg.mediaUrl || msg.fileUrl) && (
          <div className="room-message-media-stable">
              <RoomMediaPreview
                item={msg}
                variant="message"
                onOpen={(item) => {
                  if (
                    item?.mediaType === 'image' ||
                    item?.mediaType === 'video'
                  ) {
                    setShowRoomMediaGrid(false);

                    window.setTimeout(() => {
                      if (
                        typeof roomMediaViewerOpenerRef.current === 'function'
                      ) {
                        roomMediaViewerOpenerRef.current(item);
                      }
                    }, 0);

                    return;
                  }

                  const url = item?.mediaUrl || item?.fileUrl;

                  if (url) {
                    window.open(
                      url,
                      '_blank',
                      'noopener,noreferrer'
                    );
                  }
                }}
                onDownload={downloadRoomMedia}
              />
          </div>
        )}
      </div>
    </div>
  );
}, [
  activeRoomCanDeleteMessages,
  deletingMessageId,
  deleteRoomMessage,
  downloadRoomMedia,
  renderMessageWithLinks,
  renderedMessages,
  setShowRoomMediaGrid,
  userId,
]);

  const activeRoomImageUrl = useMemo(
    () => getRoomImageUrl(activeRoom),
    [activeRoom, getRoomImageUrl]
  );
  



  const activeRoomCanEdit = useMemo(
    () => activeRoom?.type === 'custom' && isRoomOwner(activeRoom, userId),
    [activeRoom, userId]
  );

  useEffect(() => {
    selectedMediaPreviewsRef.current = selectedMediaPreviews;
  }, [selectedMediaPreviews]);

  useEffect(() => {
    activeRoomImageUrlRef.current = activeRoomImageUrl;
  }, [activeRoomImageUrl]);

  useEffect(() => {
    activeRoomRef.current = activeRoom;
  }, [activeRoom]);

  useEffect(() => {
    pendingMessageIdsRef.current.clear();
    sendingMessageRef.current = false;

    if (!activeRoom?.roomId) {
      setUploadingMedia(false);
      setMediaUploadProgress(0);
      setMediaUploadLabel('');
      return;
    }

    setShowScrollToBottom(false);
  }, [activeRoom?.roomId]);

useEffect(() => {
  messagesStateRef.current = messages;
}, [messages]);

useEffect(() => {
  return () => {
    if (scrollBottomTimeoutRef.current) {
      window.clearTimeout(scrollBottomTimeoutRef.current);
      scrollBottomTimeoutRef.current = null;
    }
  };
}, []);


  useLayoutEffect(() => {
    const anchor = olderScrollAnchorRef.current;
    if (!anchor) return;

    const container = messagesRef.current;
    if (!container) {
      olderScrollAnchorRef.current = null;
      return;
    }

    const safeMessageKey = String(anchor.key || '')
      .replace(/\\/g, '\\\\')
      .replace(/"/g, '\\"');

    const selector = `[data-message-key="${safeMessageKey}"]`;


    
    const anchoredElement = container.querySelector(selector);

    if (!anchoredElement) {
      olderScrollAnchorRef.current = null;
      return;
    }

    const containerTop = container.getBoundingClientRect().top;
    const nextTop = anchoredElement.getBoundingClientRect().top - containerTop;
    const delta = nextTop - anchor.top;

    if (Math.abs(delta) > 0.5) {
      preserveScrollAnchor(container, delta);
    }

    const restoreLateLayoutShift = () => {
      const lateAnchor = olderScrollAnchorRef.current;
      if (!lateAnchor) return;

      const lateContainer = messagesRef.current;
      if (!lateContainer) {
        olderScrollAnchorRef.current = null;
        return;
      }

      const lateSafeMessageKey = String(lateAnchor.key || '')
        .replace(/\\/g, '\\\\')
        .replace(/"/g, '\\"');

      const lateSelector = `[data-message-key="${lateSafeMessageKey}"]`;
      const lateElement = lateContainer.querySelector(lateSelector);

      if (!lateElement) {
        olderScrollAnchorRef.current = null;
        return;
      }

      const lateContainerTop = lateContainer.getBoundingClientRect().top;
      const lateTop = lateElement.getBoundingClientRect().top - lateContainerTop;
      const lateDelta = lateTop - lateAnchor.top;

      if (Math.abs(lateDelta) > 0.5) {
        preserveScrollAnchor(lateContainer, lateDelta);
      }

      olderScrollAnchorRef.current = {
        ...lateAnchor,
        top: lateElement.getBoundingClientRect().top - lateContainerTop,
        scrollHeight: lateContainer.scrollHeight,
        scrollTop: lateContainer.scrollTop,
        clientHeight: lateContainer.clientHeight,
      };
    };

    const rafOne = window.requestAnimationFrame(restoreLateLayoutShift);

    const timerOne = window.setTimeout(() => {
      restoreLateLayoutShift();
      olderScrollAnchorRef.current = null;
    }, 120);

    return () => {
      window.cancelAnimationFrame(rafOne);
      window.clearTimeout(timerOne);
    };
  }, [renderedMessages.length]);



useLayoutEffect(() => {
  if (!activeRoom?.roomId) return;
  if (!shouldAutoScrollToNewestRef.current) return;
  if (olderMessagesLoadingRef.current) return;

  const runScroll = () => {
    const latestContainer = messagesRef.current;

    if (!latestContainer) return;

    latestContainer.style.scrollBehavior = 'auto';
    latestContainer.scrollTop = latestContainer.scrollHeight + 999999;
  };

  runScroll();

  const rafOne = window.requestAnimationFrame(() => {
    runScroll();

    const rafTwo = window.requestAnimationFrame(() => {
      runScroll();

      const timerOne = window.setTimeout(runScroll, 40);
      const timerTwo = window.setTimeout(runScroll, 120);
      const timerThree = window.setTimeout(() => {
        runScroll();
        shouldAutoScrollToNewestRef.current = false;
      }, 260);

      window.setTimeout(() => {
        window.clearTimeout(timerOne);
        window.clearTimeout(timerTwo);
        window.clearTimeout(timerThree);
      }, 340);
    });

    window.setTimeout(() => {
      window.cancelAnimationFrame(rafTwo);
    }, 340);
  });

  return () => {
    window.cancelAnimationFrame(rafOne);
  };
}, [activeRoom?.roomId, renderedMessages.length, messagesLoading]);

  useEffect(() => {
    mountedRef.current = true;

    return () => {
      mountedRef.current = false;
    };
  }, []);




  async function loadOlderRoomMessages() {
    await new Promise((resolve) => requestAnimationFrame(resolve));
    const room = activeRoomRef.current;
    const cachedRoomMessages = room?.roomId ? roomMessagesCacheRef.current[room.roomId] || [] : [];
    const oldestCursor = getOldestMessageCursor(messagesStateRef.current);

    if (!room?.roomId || olderMessagesLoadingRef.current || messagesLoading || !hasOlderMessages) {
      return;
    }

    if (cachedRoomMessages.length > messagesStateRef.current.length) {
      captureOlderScrollAnchor();

      const currentlyVisible = messagesStateRef.current.length;
      const nextVisibleCount = Math.min(
        cachedRoomMessages.length,
        currentlyVisible + ROOM_MESSAGES_REVEAL_STEP
      );

      const nextMessages = cachedRoomMessages.slice(-nextVisibleCount);

      shouldAutoScrollToNewestRef.current = false;
      setMessages((prev) => {
        const merged = sortRoomMessages(
          dedupeMessages([
            ...nextMessages,
            ...prev,
          ])
        );

        return merged.slice(-nextVisibleCount);
      });
      syncRoomMessageCache(room.roomId, cachedRoomMessages);
      setHasOlderMessages(nextVisibleCount < cachedRoomMessages.length);

      window.requestAnimationFrame(() => {
        const container = messagesRef.current;
        if (!container) return;

        container.style.scrollBehavior = 'auto';
        preserveScrollAnchor(container, 0);

        window.setTimeout(() => {
          preserveScrollAnchor(messagesRef.current, 0);
        }, ROOM_OLDER_MESSAGES_LAYOUT_STABILIZE_MS);
      });

      return;
    }

    if (!oldestCursor) return;

    olderMessagesLoadingRef.current = true;
    setOlderMessagesLoading(true);

    try {
      const data = await roomApi.getRoomMessages(room.roomId, {
        guestId: getStableGuestId(),
        clientGuestId: getStableGuestId(),
        before: oldestCursor,
        beforeMessageId: oldestCursor,
        cursor: oldestCursor,
        limit: ROOM_MESSAGES_FETCH_LIMIT,
      });

      const older = extractRoomArray(data, ['messages', 'Items']).map(normalizeRoomMessageMedia);

      if (!mountedRef.current || activeRoomRef.current?.roomId !== room.roomId) {
        return;
      }

      if (older.length === 0) {
        setHasOlderMessages(false);
        return;
      }



      captureOlderScrollAnchor();
      shouldAutoScrollToNewestRef.current = false;

      setMessages((prev) => {
        const expandedMessages = sortRoomMessages(dedupeMessages(
          [...older, ...prev].map(normalizeRoomMessageMedia)
        ));
        const nextVisibleCount = Math.min(
          expandedMessages.length,
          prev.length + ROOM_MESSAGES_REVEAL_STEP
        );
        const nextMessages = expandedMessages.slice(-nextVisibleCount);

        syncRoomMessageCache(room.roomId, expandedMessages);
        return nextMessages;
      });
      setHasOlderMessages(older.length >= ROOM_MESSAGES_FETCH_LIMIT);

      window.requestAnimationFrame(() => {
        const container = messagesRef.current;
        if (!container) return;

        container.style.scrollBehavior = 'auto';
        preserveScrollAnchor(container, 0);

        window.setTimeout(() => {
          preserveScrollAnchor(messagesRef.current, 0);
        }, ROOM_OLDER_MESSAGES_LAYOUT_STABILIZE_MS);
      });

    } catch (err) {
      console.error(err);
      setStatus(err?.response?.data?.error || 'Could not load older messages');
    } finally {
      olderMessagesLoadingRef.current = false;
      if (mountedRef.current) setOlderMessagesLoading(false);
    }
  }



const setMessagesContainerRef = useCallback((node) => {
  messagesRef.current = node;
}, []);




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
      if (imageCropSourceUrl?.startsWith('blob:')) {
        URL.revokeObjectURL(imageCropSourceUrl);
      }
    };
  }, [imageCropSourceUrl]);

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
      selectedMediaPreviewsRef.current.forEach((item) => {
        if (item.preview?.startsWith('blob:')) {
          URL.revokeObjectURL(item.preview);
        }
      });
    };
  }, []);
  function captureOlderScrollAnchor() {
    const container = messagesRef.current;
    if (!container) {
      olderScrollAnchorRef.current = null;
      return;
    }

    const containerRect = container.getBoundingClientRect();
    const visibleElements = Array.from(container.querySelectorAll('[data-message-key]'))
      .map((element) => {
        const rect = element.getBoundingClientRect();
        return {
          element,
          rect,
          distanceFromTop: Math.abs(rect.top - containerRect.top),
        };
      })
      .filter(({ rect }) => rect.bottom > containerRect.top + 12 && rect.top < containerRect.bottom - 12);

    const firstStableVisible =
      visibleElements.find(({ rect }) => rect.top >= containerRect.top + 12)?.element ||
      visibleElements.sort((a, b) => a.distanceFromTop - b.distanceFromTop)[0]?.element;

    if (!firstStableVisible) {
      olderScrollAnchorRef.current = null;
      return;
    }

    olderScrollAnchorRef.current = {
      key: firstStableVisible.getAttribute('data-message-key') || '',
      top: firstStableVisible.getBoundingClientRect().top - containerRect.top,
      scrollHeight: container.scrollHeight,
      scrollTop: container.scrollTop,
      clientHeight: container.clientHeight,
    };
  }

  function removeSelectedMedia() {
    selectedMediaPreviews.forEach((item) => {
      if (item.preview?.startsWith('blob:')) {
        URL.revokeObjectURL(item.preview);
      }
    });

    setSelectedMediaFile(null);
    setSelectedMediaFiles([]);
    setSelectedMediaPreview('');
    setSelectedMediaPreviews([]);
    setSelectedMediaType('');
    if (!sendingMessageRef.current) {
      setUploadingMedia(false);
      setMediaUploadProgress(0);
      setMediaUploadLabel('');
    }
    if (sendingMessageRef.current) {
      sendingMessageRef.current = false;
    }
  }

function syncRoomMessageCache(roomId, nextMessages) {
  if (!roomId) return [];

  const normalizedMessages = trimRoomMessagesForMemory(
    Array.isArray(nextMessages) ? nextMessages : []
  );

  roomMessagesCacheRef.current[roomId] = normalizedMessages;

  const cachedRoomIds = Object.keys(roomMessagesCacheRef.current || {});

  if (cachedRoomIds.length > ROOM_MAX_CACHED_MESSAGE_ROOMS) {
    const removableRooms = cachedRoomIds.filter(
      (id) => id !== activeRoomRef.current?.roomId
    );

    while (
      removableRooms.length > 0 &&
      Object.keys(roomMessagesCacheRef.current).length >
        ROOM_MAX_CACHED_MESSAGE_ROOMS
    ) {
      const roomToDelete = removableRooms.shift();

      if (roomToDelete) {
        delete roomMessagesCacheRef.current[roomToDelete];
      }
    }
  }

  return normalizedMessages;
}

const appendRoomMessage = useCallback((roomId, message, options = {}) => {
  if (!roomId || !message) return;

  const normalizedMessage = normalizeRoomMessageMedia(message);

  if (!normalizedMessage?.roomId && roomId) {
    normalizedMessage.roomId = roomId;
  }
  const activeRoomId = activeRoomRef.current?.roomId;
  const shouldUpdateVisibleRoom = activeRoomId === roomId;

  const messageKey = getStableRoomMessageKey(normalizedMessage);
  const shouldFollowMessage =
    options.forceScroll ||
    normalizedMessage.senderId === userId ||
    isMessagesNearBottom(360);

  const existing = roomMessagesCacheRef.current[roomId] || [];
  const existsInCache = existing.some(
    (item) => getStableRoomMessageKey(item) === messageKey
  );

  const mergedCache = existsInCache
    ? trimRoomMessagesForMemory(
        existing.map((item) =>
          getStableRoomMessageKey(item) === messageKey
            ? mergeRoomMessagePreservingMedia(item, normalizedMessage)
            : item
        )
      )
    : trimRoomMessagesForMemory([
        ...existing,
        normalizedMessage,
      ]);

  syncRoomMessageCache(roomId, mergedCache);

  if (!shouldUpdateVisibleRoom) return;

  if (!shouldFollowMessage) {
    shouldAutoScrollToNewestRef.current = false;
  }

  setMessages((prev) => {
    const existsInVisible = prev.some(
      (item) => getStableRoomMessageKey(item) === messageKey
    );

    const nextMessages = existsInVisible
      ? prev.map((item) =>
          getStableRoomMessageKey(item) === messageKey
            ? mergeRoomMessagePreservingMedia(item, normalizedMessage)
            : item
        )
      : [...prev, normalizedMessage];

    return trimRoomMessagesForMemory(nextMessages);
  });

  if (shouldFollowMessage) {
    shouldAutoScrollToNewestRef.current = true;

    window.requestAnimationFrame(() => {
      scrollMessagesToBottom({
        behavior: options.behavior || 'smooth',
        restoreDelay: options.restoreDelay || 360,
      });
    });
  }
}, [
  isMessagesNearBottom,
  scrollMessagesToBottom,
  userId,
]);

function markPendingRoomMessageFailed(clientId) {
  if (!clientId) return;

  setMessages((prev) => {
    const nextMessages = prev.map((message) =>
      message.clientId === clientId || message.messageId === clientId
        ? normalizeRoomMessageMedia({ ...message, pending: false, failed: true })
        : message
    );

    syncRoomMessageCache(activeRoomRef.current?.roomId, nextMessages);
    return nextMessages;
  });

  pendingMessageIdsRef.current.delete(clientId);
  setUploadingMedia(false);
  setMediaUploadProgress(0);
  setMediaUploadLabel('');
}

  function getRoomMediaType(file) {
    const fileType = String(file?.type || '').toLowerCase();
    const lowerName = String(file?.name || '').toLowerCase();
    const isImage = fileType.startsWith('image/') || ROOM_MEDIA_IMAGE_EXTENSIONS.test(lowerName);
    const isVideo = fileType.startsWith('video/') || ROOM_MEDIA_VIDEO_EXTENSIONS.test(lowerName);
    const isArchiveFile = /\.(zip|rar|7z)$/i.test(lowerName);
    const isFile =
      !isImage &&
      !isVideo &&
      (isArchiveFile || ROOM_MEDIA_ALLOWED_TYPES.test(fileType) || ROOM_MEDIA_DOCUMENT_EXTENSIONS.test(lowerName));

    return {
      isImage,
      isVideo,
      isFile,
      mediaType: isVideo ? 'video' : isImage ? 'image' : isFile ? 'file' : '',
    };
  }

  function removeSelectedMediaAt(indexToRemove) {
    const targetPreview = selectedMediaPreviews[indexToRemove]?.preview;

    if (targetPreview?.startsWith('blob:')) {
      URL.revokeObjectURL(targetPreview);
    }

    const nextPreviews = selectedMediaPreviews.filter((_, index) => index !== indexToRemove);

    setSelectedMediaPreviews(nextPreviews);
    setSelectedMediaFiles((prev) => {
      const nextFiles = prev.filter((_, index) => index !== indexToRemove);
      const firstFile = nextFiles[0] || null;

      setSelectedMediaFile(firstFile);
      setSelectedMediaType(firstFile ? getRoomMediaType(firstFile).mediaType : '');
      setSelectedMediaPreview(nextPreviews[0]?.preview || '');

      if (nextFiles.length === 0) {
        setMediaUploadLabel('');
      }

      return nextFiles;
    });
  }

  function getOldestMessageCursor(messages = []) {
    const firstMessage = Array.isArray(messages) && messages.length > 0 ? messages[0] : null;

    return (
      firstMessage?.createdAtMs ||
      firstMessage?.createdAt ||
      firstMessage?.messageId ||
      firstMessage?.clientId ||
      ''
    );
  }



  function handleRoomMediaChange(event) {
    const files = Array.from(event.target.files || []);
    event.target.value = '';

    if (files.length === 0) return;

    removeSelectedMedia();

    if (files.length > ROOM_MEDIA_MAX_FILES_PER_BATCH) {
      setStatus(`You can upload up to ${ROOM_MEDIA_MAX_FILES_PER_BATCH} files at once.`);
      return;
    }

    const totalBytes = files.reduce((sum, file) => sum + Number(file.size || 0), 0);

    if (totalBytes > ROOM_MEDIA_MAX_BATCH_BYTES) {
      setStatus('This batch is too large. Upload fewer files at once.');
      return;
    }

    const validFiles = [];
    const previewItems = [];

    for (const file of files) {
      const { isImage, isVideo, isFile, mediaType } = getRoomMediaType(file);

      if (!isImage && !isVideo && !isFile) {
        setStatus('Only images, videos, PDFs, documents, spreadsheets, text files, ZIP, RAR, and 7z files are allowed.');
        previewItems.forEach((item) => {
          if (item.preview?.startsWith('blob:')) URL.revokeObjectURL(item.preview);
        });
        return;
      }

      if (file.size > ROOM_MEDIA_MAX_BYTES) {
        setStatus('Each media file must be smaller than 80 MB.');
        previewItems.forEach((item) => {
          if (item.preview?.startsWith('blob:')) URL.revokeObjectURL(item.preview);
        });
        return;
      }

      validFiles.push(file);
      let previewUrl = '';

      try {
        previewUrl = URL.createObjectURL(file);
      } catch {
        previewUrl = '';
      }

      previewItems.push({
        file,
        preview: previewUrl,
        mediaType,
      });
    }

    setStatus('');
    setSelectedMediaFiles(validFiles);
    setSelectedMediaPreviews(previewItems);
    setSelectedMediaFile(validFiles[0] || null);
    setSelectedMediaType(previewItems[0]?.mediaType || '');
    setSelectedMediaPreview(previewItems[0]?.preview || '');
  }

  

function openActiveRoomMediaPopup(event) {
  event?.preventDefault?.();
  event?.stopPropagation?.();

  const room = activeRoomRef.current || activeRoom;
  if (!room?.roomId) return;

  setShowActiveRoomMenu(false);
  setOpenRoomActionMenuId('');
  setShowRoomMenu(false);
  setShowActiveRoomInfo(false);
  setActiveInfoSection('');
  setShowRoomMediaGrid(true);
}

async function openActiveRoomInfo(event) {
  event?.preventDefault?.();
  event?.stopPropagation?.();

  const room = activeRoomRef.current || activeRoom;
  if (!room?.roomId) return;

  activeRoomRef.current = room;

  setShowActiveRoomMenu(false);
  setShowRoomMenu(false);
  setOpenRoomActionMenuId('');
  setShowRoomMediaGrid(false);

  setShowActiveRoomInfo(true);
  setActiveInfoSection('members');
  setActiveInfoMembers([]);
  setActiveInfoRequests([]);
  setActiveInfoLoading(true);

  await loadActiveRoomInfoMembers(room, { force: true });
}

async function toggleActiveInfoSection(section) {
  const room = activeRoomRef.current || activeRoom;
  if (!room?.roomId) return;

  const nextSection = activeInfoSection === section ? '' : section;
  setActiveInfoSection(nextSection);

  if (!nextSection) return;

  if (section === 'members') {
    activeRoomRef.current = room;
    setActiveInfoMembers([]);
    await loadActiveRoomInfoMembers(room, { force: true });
    return;
  }

  if (section === 'requests') {
    setActiveInfoLoading(true);
    setActiveInfoRequests([]);

    try {
      const data = await roomApi.getRoomJoinRequests(room.roomId, {
        guestId: getStableGuestId(),
        clientGuestId: getStableGuestId(),
      });
      const nextRequests = extractRoomArray(data, ['requests']);
      setActiveInfoRequests(nextRequests);
    } catch (err) {
      console.error(err);
      setStatus(err?.response?.data?.error || 'Could not load join requests');
    } finally {
      if (mountedRef.current) setActiveInfoLoading(false);
    }

    return;
  }

  if (section === 'invite') {
    setInviteLinkModalOpen(false);
    setShowActiveRoomInfo(true);
  }
}

async function loadActiveRoomInfoMembers(room = activeRoomRef.current || activeRoom, options = {}) {
  if (!room?.roomId) return;

  activeRoomRef.current = room;

  const cacheKey = room.roomId;
  const cached = membersCacheRef.current[cacheKey];
  const now = Date.now();

  if (
    !options.force &&
    cached &&
    Array.isArray(cached.members) &&
    cached.members.length > 0 &&
    now - cached.timestamp < ROOM_MEMBERS_CACHE_MS
  ) {
    setActiveInfoMembers(cached.members);
    setActiveInfoLoading(false);
    return;
  }

  setActiveInfoLoading(true);

  try {
    const data = await roomApi.getRoomMembers(room.roomId, {
      guestId: getStableGuestId(),
      clientGuestId: getStableGuestId(),
    });
    if (!mountedRef.current) return;

    const nextMembers = getRoomMembersFromResponse(data).filter(Boolean);

    membersCacheRef.current[cacheKey] = {
      timestamp: Date.now(),
      members: nextMembers,
    };

    setActiveInfoMembers(nextMembers);
  } catch (err) {
    console.error(err);
    setActiveInfoMembers([]);
    setStatus(err?.response?.data?.error || 'Could not load members');
  } finally {
    if (mountedRef.current) setActiveInfoLoading(false);
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
      requiresApproval: !inviteLinkAutoAccept,
      autoAccept: inviteLinkAutoAccept,
      maxUses: 100,
    });

    const { payload, body } = parseApiPayload(data);
    const responseData = body?.data || payload?.data || body || payload || {};

    const inviteCode =
      responseData?.inviteCode ||
      responseData?.code ||
      responseData?.invite?.inviteCode ||
      responseData?.invite?.code ||
      '';

    const inviteUrl =
      responseData?.inviteUrl ||
      responseData?.url ||
      responseData?.invite?.inviteUrl ||
      responseData?.invite?.url ||
      (inviteCode ? `${APP_ORIGIN}/rooms/invite/${inviteCode}` : '');

    if (!inviteUrl) {
      console.error('Invite link response missing URL:', data);
      throw new Error('Invite link was created, but no invite URL was returned');
    }

    const finalInviteCode = inviteCode || String(inviteUrl).split('/').filter(Boolean).pop() || '';

    setGeneratedInviteCode(finalInviteCode);
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

async function approveJoinRequest(requestUserId) {
  const targetRoom = activeRoomRef.current || activeRoom || modalRoom;

  if (!targetRoom?.roomId || !requestUserId) return;

  try {
    setStatus('');
    setActiveInfoLoading(true);

    await roomApi.approveRoomJoinRequest(targetRoom.roomId, requestUserId);

    setMembers((prev) =>
      Array.isArray(prev)
        ? prev.filter((member) => getInviteUserId(member) !== requestUserId)
        : prev
    );

    setActiveInfoRequests((prev) =>
      Array.isArray(prev)
        ? prev.filter((request) => getInviteUserId(request) !== requestUserId)
        : []
    );

    delete joinRequestsCacheRef.current[targetRoom.roomId];
    delete membersCacheRef.current[targetRoom.roomId];
    roomsCacheRef.current = { key: '', timestamp: 0, rooms: [] };

    setStatus('Join request approved');
        setRooms((prev) =>
      prev.map((room) => {
        if (String(room?.roomId || '') !== String(targetRoom.roomId || '')) {
          return room;
        }

        return {
          ...room,
          memberCount: Number(room?.memberCount || 0) + 1,
        };
      })
    );

    await loadRooms(roomSearch, { force: true });
    await loadActiveRoomInfoMembers(targetRoom, { force: true });
  } catch (err) {
    console.error(err);
    setStatus(err?.response?.data?.error || 'Could not approve request');
  } finally {
    if (mountedRef.current) setActiveInfoLoading(false);
  }
}


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
      if (mountedRef.current) {
        setRooms(cached.rooms);
        setInitialRoomsReady(true);
      }
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

      if (!navigator.onLine) {
        throw new Error('You are offline');
      }

      const roomLoadParams = {
        search: normalizedSearch,
      };

      if (isGuestUser) {
        const stableGuestId = getStableGuestId();
        roomLoadParams.guestId = stableGuestId;
        roomLoadParams.clientGuestId = stableGuestId;
      }

      const data = await Promise.race([
        getRoomsForCurrentSession(roomLoadParams),
        new Promise((_, reject) =>
          setTimeout(
            () => reject(new Error('Rooms load timeout')),
            ROOM_LOAD_TIMEOUT_MS
          )
        ),
      ]);

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
  const normalizedPrivacy = normalizeRoomPrivacy(room);
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
    privacy: normalizedPrivacy,
    isPrivate: normalizedPrivacy === 'private',
    imageUrl,
    roomImageUrl: room.roomImageUrl || imageUrl,
    coverImageUrl: room.coverImageUrl || imageUrl,
  };
});

const joinedInviteRooms = getStoredJoinedInviteRooms();
const joinedInviteRoomIds = new Set(
  joinedInviteRooms.map((room) => String(room?.roomId || room?.id || '').trim())
);

const visibleRooms = allRooms.filter((room) => {
  const normalizedPrivacy = normalizeRoomPrivacy(room);
  const isPrivateRoom = normalizedPrivacy === 'private';
  const roomId = String(room?.roomId || room?.id || '').trim();
  const isJoinedInviteRoom = joinedInviteRoomIds.has(roomId);

  // Guests cannot see private rooms unless joined through invite link
  if (isGuestUser && isPrivateRoom && !isJoinedInviteRoom) {
    return false;
  }

  // Preserve joined private rooms after refresh
  if (!normalizedSearch) {
    return true;
  }

  const roomName = String(
    room.name || room.roomName || ''
  ).toLowerCase();

  return roomName.includes(normalizedSearch);
});

      visibleRooms.sort((a, b) => {
        const aOwner = isRoomOwner(a, userId);
        const bOwner = isRoomOwner(b, userId);

        if (aOwner && !bOwner) return -1;
        if (!aOwner && bOwner) return 1;

        return Number(b.createdAt || 0) - Number(a.createdAt || 0);
      });

      const navigationState =
        location.state && typeof location.state === 'object'
          ? location.state
          : {};

      const joinedRoomId = getNavigationRoomOpenId(navigationState);
      let navigationJoinedRoom = null;

      if (joinedRoomId) {
        navigationJoinedRoom = navigationState?.joinedRoom || {
          roomId: joinedRoomId,
          id: joinedRoomId,
          name: navigationState?.openRoomName || 'Joined group',
          roomName: navigationState?.openRoomName || 'Joined group',
          privacy: 'private',
          type: 'custom',
          guestId: navigationState?.guestId || getStableGuestId(),
          joinedAt: navigationState?.joinedAt || Date.now(),
        };

        navigationJoinedRoom = {
          ...navigationJoinedRoom,
          roomId: navigationJoinedRoom.roomId || navigationJoinedRoom.id || joinedRoomId,
          id: navigationJoinedRoom.id || navigationJoinedRoom.roomId || joinedRoomId,
          name: navigationJoinedRoom.name || navigationJoinedRoom.roomName || navigationState?.openRoomName || 'Joined group',
          roomName: navigationJoinedRoom.roomName || navigationJoinedRoom.name || navigationState?.openRoomName || 'Joined group',
          privacy: navigationJoinedRoom.privacy || 'private',
          type: navigationJoinedRoom.type || 'custom',
          guestId: navigationJoinedRoom.guestId || navigationState?.guestId || getStableGuestId(),
          joinedAt: navigationJoinedRoom.joinedAt || navigationState?.joinedAt || Date.now(),
        };

        persistJoinedInviteRoom(navigationJoinedRoom);
      }

      const mergedVisibleRooms = mergeJoinedInviteRooms(visibleRooms, navigationJoinedRoom);

      // Ensure joined invite rooms survive hard refreshes even if backend membership sync is delayed
      mergedVisibleRooms.forEach((room) => {
        const roomId = String(room?.roomId || room?.id || '').trim();

        if (!roomId) return;

        const privacy = normalizeRoomPrivacy(room);

        if (privacy === 'private') {
          persistJoinedInviteRoom(room);
        }
      });

      roomsCacheRef.current = {
        key: cacheKey,
        timestamp: Date.now(),
        rooms: mergedVisibleRooms,
      };

      const preloadRoomMessages = async () => {
        try {
          const preloadRooms = mergedVisibleRooms.slice(0, 8);
          const chunkSize = 4;

          for (let index = 0; index < preloadRooms.length; index += chunkSize) {
            const batch = preloadRooms.slice(index, index + chunkSize);

            await Promise.allSettled(
              batch.map(async (room) => {
                if (!room?.roomId) return;

                if (roomMessagesCacheRef.current[room.roomId]?.length > 0) {
                  return;
                }

                try {
                  const data = await Promise.race([
                    roomApi.getRoomMessages(room.roomId, {
                      guestId: getStableGuestId(),
                      clientGuestId: getStableGuestId(),
                      limit: ROOM_MESSAGES_FETCH_LIMIT,
                    }),
                    new Promise((_, reject) =>
                      setTimeout(
                        () => reject(new Error('Preload messages timeout')),
                        ROOM_LOAD_TIMEOUT_MS
                      )
                    ),
                  ]);

                  const messages = trimRoomMessagesForMemory(
                    getLoadedRoomMessages(data)
                  );

                  syncRoomMessageCache(room.roomId, messages);
                } catch (err) {
                  console.error(
                    `PRELOAD ROOM MESSAGES ERROR (${room.roomId}):`,
                    err
                  );
                }
              })
            );
          }
        } catch (err) {
          console.error('ROOM MESSAGE PRELOAD ERROR:', err);
        }
      };

      if ('requestIdleCallback' in window && typeof window.requestIdleCallback === 'function') {
        window.requestIdleCallback(preloadRoomMessages, { timeout: 2500 });
      } else {
        window.setTimeout(preloadRoomMessages, 600);
      }

      setRooms((prev) => (areRoomListsEqual(prev, mergedVisibleRooms) ? prev : mergedVisibleRooms));
      setInitialRoomsReady(true);
    } catch (err) {
  console.error('LOAD ROOMS ERROR:', err);

  if (mountedRef.current) {
    setInitialRoomsReady(true);

    const fallbackRooms = roomsCacheRef.current?.rooms || [];

    if (Array.isArray(fallbackRooms) && fallbackRooms.length > 0) {
      setRooms(fallbackRooms);
      setStatus('Connection is slow. Showing cached rooms.');
    } else {
      setStatus(
        err?.response?.data?.error ||
        err?.response?.data?.message ||
        err?.message ||
        'Failed to load rooms'
      );
    }
  }
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

  const openRoomFromNavigationState = useCallback(async (options = {}) => {
    const currentUserId = userId || getStableGuestId();
    const navigationState =
      location.state && typeof location.state === 'object' ? location.state : {};

    if (navigationState.openJoinedRoom !== true) return;

    const requestedRoomId = getNavigationRoomOpenId(navigationState);
    const navigationOpenKey = `${currentUserId}:${requestedRoomId}:${navigationState?.joinedAt || navigationState?.inviteCode || 'join-link'}`;

    if (!currentUserId || !requestedRoomId) return;
    if (handledNavigationOpenKeyRef.current === navigationOpenKey) return;
    if (!options.force && pendingNavigationOpenRoomIdRef.current === requestedRoomId) return;

    pendingNavigationOpenRoomIdRef.current = requestedRoomId;

    try {
      setStatus('');
      setRoomPrivacyFilter('private');
      setRoomSearch('');

      roomsCacheRef.current = { key: '', timestamp: 0, rooms: [] };
      await loadRooms('', { force: true });

      if (!mountedRef.current) return;

      const latestRooms = Array.isArray(roomsCacheRef.current.rooms)
        ? roomsCacheRef.current.rooms
        : [];

      const fallbackRoom = navigationState?.joinedRoom || null;
      const roomToOpen =
        latestRooms.find((room) => String(room.roomId || room.id || '') === requestedRoomId) ||
        rooms.find((room) => String(room.roomId || room.id || '') === requestedRoomId) ||
        (fallbackRoom
          ? {
              ...fallbackRoom,
              roomId: fallbackRoom.roomId || fallbackRoom.id || requestedRoomId,
              name:
                fallbackRoom.name ||
                fallbackRoom.roomName ||
                navigationState?.openRoomName ||
                'Joined group',
              privacy: fallbackRoom.privacy || 'private',
            }
          : {
              roomId: requestedRoomId,
              name: navigationState?.openRoomName || 'Joined group',
              privacy: 'private',
              type: 'custom',
            });

      if (!roomToOpen?.roomId) return;

      handledNavigationOpenKeyRef.current = navigationOpenKey;

      setRooms((prev) => {
        const alreadyExists = prev.some(
          (room) =>
            String(room.roomId || room.id || '') ===
            String(roomToOpen.roomId)
        );

        if (alreadyExists) {
          return prev.map((room) =>
            String(room.roomId || room.id || '') ===
            String(roomToOpen.roomId)
              ? {
                  ...room,
                  ...roomToOpen,
                }
              : room
          );
        }

        return [roomToOpen, ...prev];
      });

      const normalizedRoomToOpen = {
        ...roomToOpen,
        roomId: roomToOpen.roomId || roomToOpen.id || requestedRoomId,
        id: roomToOpen.id || roomToOpen.roomId || requestedRoomId,
        privacy: normalizeRoomPrivacy({
          ...roomToOpen,
          privacy: roomToOpen.privacy || roomToOpen.visibility || 'private',
        }),
        isPrivate:
          normalizeRoomPrivacy({
            ...roomToOpen,
            privacy: roomToOpen.privacy || roomToOpen.visibility || 'private',
          }) === 'private',
        joinedViaInvite: true,
        guestId: roomToOpen.guestId || navigationState?.guestId || getStableGuestId(),
      };

      persistJoinedInviteRoom(normalizedRoomToOpen);

      const hydratedRoom = {
        ...normalizedRoomToOpen,
        joinedViaInvite: true,
      };

      activeRoomRef.current = hydratedRoom;

      shouldAutoScrollToNewestRef.current = true;
      loadingRoomRef.current = false;
      roomOpenRequestIdRef.current += 1;

      setMessages([]);
      messagesStateRef.current = [];

      setMessagesLoading(true);
      setOlderMessagesLoading(false);
      olderMessagesLoadingRef.current = false;
      setHasOlderMessages(true);

      setActiveRoom(hydratedRoom);
      setMobileChatOpen(true);

      window.requestAnimationFrame(() => {
        if (!mountedRef.current) return;

        openRoom(hydratedRoom, {
          forceRefresh: true,
          skipCache: true,
          source: 'invite-link',
        });

        window.setTimeout(() => {
          if (
            mountedRef.current &&
            activeRoomRef.current?.roomId === hydratedRoom.roomId &&
            messagesStateRef.current.length === 0
          ) {
            loadingRoomRef.current = false;

            openRoom(hydratedRoom, {
              forceRefresh: true,
              skipCache: true,
              source: 'invite-link-retry',
            });
          }
        }, 900);
      });

      navigate('/rooms', {
        replace: true,
        state: null,
      });
    } catch (err) {
      console.error('OPEN JOINED ROOM FROM NAVIGATION ERROR:', err);
      handledNavigationOpenKeyRef.current = '';

      if (mountedRef.current) {
        setStatus(err?.response?.data?.error || 'Joined, but could not open the group automatically.');
      }
    } finally {
      window.setTimeout(() => {
        if (pendingNavigationOpenRoomIdRef.current === requestedRoomId) {
          pendingNavigationOpenRoomIdRef.current = '';
        }
      }, 1500);
    }
  }, [location.state, navigate, rooms, user, userId]);

  useEffect(() => {
    const currentUserId = userId || getStableGuestId();
    const navigationState =
      location.state && typeof location.state === 'object' ? location.state : {};

    if (navigationState.openJoinedRoom !== true) return;

    const requestedRoomId = getNavigationRoomOpenId(navigationState);

    if (!currentUserId || !requestedRoomId) return;

    const run = async () => {
      await openRoomFromNavigationState({ force: true });

      window.setTimeout(() => {
        if (
          mountedRef.current &&
          activeRoomRef.current?.roomId === requestedRoomId &&
          messagesStateRef.current.length === 0
        ) {
          loadingRoomRef.current = false;

          openRoom(activeRoomRef.current, {
            forceRefresh: true,
            skipCache: true,
            source: 'post-navigation-recovery',
          });
        }
      }, 1200);
    };

    run();
  }, [user, userId, location.state, openRoomFromNavigationState]);

  useEffect(() => {
    const effectiveUserId = userId || getStableGuestId();
    if (!effectiveUserId) return;

    setInitialRoomsReady(false);
    setRoomsLoading(true);

    const cachedRooms = roomsCacheRef.current?.rooms || [];

    if (Array.isArray(cachedRooms) && cachedRooms.length > 0) {
      setRooms(cachedRooms);
      setInitialRoomsReady(true);
      setRoomsLoading(false);
    }

    const timerId = window.setTimeout(async () => {
      if (!mountedRef.current) return;

      try {
        await loadRooms('', { force: true });
        initialRoomsLoadedForUserRef.current = effectiveUserId;
      } catch (err) {
        console.error('INITIAL ROOM LOAD ERROR:', err);
        setInitialRoomsReady(true);
      } finally {
        if (mountedRef.current) {
          setRoomsLoading(false);
        }
      }
    }, 0);

    return () => {
      window.clearTimeout(timerId);
    };
  }, [userId]);

  useEffect(() => {
    if (isGuestUser || !userId || !initialRoomsReady) return undefined;

    const loadInitialInvites = () => loadRoomInvites(false);
    let idleCallbackId = null;
    let inviteTimerId = null;

    if ('requestIdleCallback' in window) {
      idleCallbackId = window.requestIdleCallback(loadInitialInvites, { timeout: 3500 });
    } else {
      inviteTimerId = window.setTimeout(loadInitialInvites, ROOM_PAGE_DEFERRED_LOAD_MS);
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
      if (idleCallbackId && typeof window.cancelIdleCallback === 'function') {
        window.cancelIdleCallback(idleCallbackId);
      }

      if (inviteTimerId) {
        window.clearTimeout(inviteTimerId);
      }
      window.clearInterval(intervalId);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [userId, isGuestUser, initialRoomsReady]);

  useEffect(() => {
    if (!userId || !initialRoomsReady) return undefined;

    let unsubscribe = null;
    const socketTimerId = window.setTimeout(() => {
      if (!mountedRef.current) return;

      unsubscribe = connectChatSocket(userId, (data) => {
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

            let nextMessages = prev;

            if (index === -1) {
              const alreadyExists = prev.some(
                (m) =>
                  (msg.messageId && m.messageId === msg.messageId) ||
                  (msg.clientId && m.clientId === msg.clientId)
              );

              nextMessages = alreadyExists
                ? prev
                : trimRoomMessagesForMemory([
                    ...prev,
                    normalizeRoomMessageMedia({
                      ...msg,
                      pending: false,
                      failed: false,
                    }),
                  ]);
            } else {
              const copy = [...prev];
              const existingMessage = copy[index] || {};

              copy[index] = mergeRoomMessagePreservingMedia(existingMessage, {
                ...msg,
                pending: false,
                failed: false,
              });

              nextMessages = trimRoomMessagesForMemory(copy);
            }

            if (current?.roomId) {
              syncRoomMessageCache(current.roomId, nextMessages);
            }

            return nextMessages;
          });

          if (msg.clientId) {
            pendingMessageIdsRef.current.delete(msg.clientId);
          }

          if (msg.messageId) {
            pendingMessageIdsRef.current.delete(msg.messageId);
          }

          sendingMessageRef.current = false;
          setUploadingMedia(false);
          setMediaUploadProgress(0);
          setMediaUploadLabel('');

          if (current?.roomId && isMessagesNearBottom(420)) {
            shouldAutoScrollToNewestRef.current = true;

            window.requestAnimationFrame(() => {
              scrollMessagesToBottom({
                behavior: 'smooth',
                settle: true,
                restoreDelay: 360,
              });
            });
          }

          return;
        }

        if (data.type !== 'roomMessage') return;
    if (
  msg.senderId === userId &&
  msg.clientId &&
  pendingMessageIdsRef.current.has(msg.clientId)
) {
  return;
}

        if (!current || msg.roomId !== current.roomId) {
          if (msg.roomId) {
            appendRoomMessage(msg.roomId, msg, {
              behavior: 'auto',
              restoreDelay: 260,
            });
          }

          if (msg.senderId !== userId && msg.roomId) {
            setRoomUnreadCounts((prev) => ({
              ...prev,
              [msg.roomId]: Number(prev[msg.roomId] || 0) + 1,
            }));
          }

          return;
        }

        appendRoomMessage(msg.roomId, msg, {
          behavior: 'smooth',
          settle: true,
          restoreDelay: 360,
        });
      });
    }, ROOM_PAGE_DEFERRED_LOAD_MS);

    return () => {
      window.clearTimeout(socketTimerId);
      if (typeof unsubscribe === 'function') unsubscribe();
    };
  }, [
    appendRoomMessage,
    initialRoomsReady,
    isMessagesNearBottom,
    scrollMessagesToBottom,
    userId,
  ]);

  async function createRoom(e) {
    e.preventDefault();
    if (requireLoggedInAction('create a group')) return false;

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
      setShowActiveRoomMenu(false);
      setShowRoomMenu(false);
      setOpenRoomActionMenuId('');

      if (finalCreatedRoom.privacy === 'private') {
        setShowInvite(false);
        setShowMembers(false);
        setShowActiveRoomInfo(true);
        setActiveInfoSection('invite');
        setModalRoom(finalCreatedRoom);
      }

      setRoomUnreadCounts((prev) => ({
        ...prev,
        [finalCreatedRoom.roomId]: 0,
      }));

      try {
        setMessagesLoading(true);
        const messageData = await roomApi.getRoomMessages(finalCreatedRoom.roomId, {
          guestId: getStableGuestId(),
          clientGuestId: getStableGuestId(),
          limit: ROOM_MESSAGES_FETCH_LIMIT,
        });

        if (mountedRef.current) {
  const loadedMessages = trimRoomMessagesForMemory(
    getLoadedRoomMessages(messageData)
  );

syncRoomMessageCache(finalCreatedRoom.roomId, loadedMessages);

  const visibleMessages = loadedMessages.slice(
    -Math.max(ROOM_INITIAL_VISIBLE_MESSAGES, ROOM_MESSAGES_FETCH_LIMIT)
  );

  setMessages(visibleMessages);
  setHasOlderMessages(loadedMessages.length > visibleMessages.length);

  jumpMessagesToBottomOnce();
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
      const data = await roomApi.getHiddenRooms({
        guestId: getStableGuestId(),
        clientGuestId: getStableGuestId(),
      });

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
      await roomApi.unhideRoom(room.roomId, {
        guestId: getStableGuestId(),
        clientGuestId: getStableGuestId(),
      });

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

      const joinedRoom =
        roomsCacheRef.current.rooms.find((room) => room.roomId === roomId) ||
        rooms.find((room) => room.roomId === roomId) ||
        invite?.room ||
        null;

      setShowRoomInvites(false);

      if (joinedRoom?.roomId) {
        await openRoom(joinedRoom);
      }
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

      // Image persistence is already handled by the uploadRoomImage Lambda.

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
      return imageUrl;
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
    setStatus('');
    setShowActiveRoomMenu(false);
    setShowActiveRoomInfo(false);
    setActiveInfoSection('');
    setEditRoomTarget(room);
    setEditRoomName(room.name || '');
    setEditRoomImageFile(null);
    setEditRoomImagePreview('');
    setShowEditRoomModal(true);
  }

function handleCropPointerDown(event) {
  event.preventDefault();

  const startX = event.clientX;
  const startY = event.clientY;
  const startOffset = { ...imageCropOffset };

  function handlePointerMove(moveEvent) {
    setImageCropOffset({
      x: startOffset.x + moveEvent.clientX - startX,
      y: startOffset.y + moveEvent.clientY - startY,
    });
  }

  function handlePointerUp() {
    window.removeEventListener('pointermove', handlePointerMove);
    window.removeEventListener('pointerup', handlePointerUp);
  }

  window.addEventListener('pointermove', handlePointerMove);
  window.addEventListener('pointerup', handlePointerUp);
}

function handleEditRoomImageChange(event) {
  const file = event.target.files?.[0] || null;
  event.target.value = '';

  if (!file) return;

  if (!file.type?.startsWith('image/')) {
    setStatus('Please choose an image file');
    return;
  }

  if (file.size > ROOM_IMAGE_PICKER_MAX_BYTES) {
    setStatus('Image must be smaller than 8 MB before optimization');
    return;
  }

  if (imageCropSourceUrl?.startsWith('blob:')) {
    URL.revokeObjectURL(imageCropSourceUrl);
  }

  setStatus('');
  setImageCropTarget('edit');
  setImageCropSourceFile(file);
  setImageCropSourceUrl(URL.createObjectURL(file));
  setImageCropZoom(1);
  setImageCropOffset({ x: 0, y: 0 });
  setImageCropModalOpen(true);
}

  function removeEditRoomImage() {
    if (editRoomImagePreview?.startsWith('blob:')) {
      URL.revokeObjectURL(editRoomImagePreview);
    }

    setEditRoomImageFile(null);
    setEditRoomImagePreview('');
  }


function closeImageCropModal() {
  if (imageCropSourceUrl?.startsWith('blob:')) {
    URL.revokeObjectURL(imageCropSourceUrl);
  }

  setImageCropModalOpen(false);
  setImageCropTarget('');
  setImageCropSourceFile(null);
  setImageCropSourceUrl('');
  setImageCropZoom(1);
  setImageCropOffset({ x: 0, y: 0 });
}

function confirmImageCrop() {
  if (!imageCropSourceFile || !imageCropSourceUrl) return;

  if (imageCropTarget === 'edit') {
    if (editRoomImagePreview?.startsWith('blob:')) {
      URL.revokeObjectURL(editRoomImagePreview);
    }

    setEditRoomImageFile(imageCropSourceFile);
    setEditRoomImagePreview(imageCropSourceUrl);
  }

  if (imageCropTarget === 'create') {
    if (newRoomImagePreview?.startsWith('blob:')) {
      URL.revokeObjectURL(newRoomImagePreview);
    }

    setNewRoomImageFile(imageCropSourceFile);
    setNewRoomImagePreview(imageCropSourceUrl);
  }

  setImageCropModalOpen(false);
  setImageCropTarget('');
  setImageCropSourceFile(null);
  setImageCropSourceUrl('');
  setImageCropZoom(1);
  setImageCropOffset({ x: 0, y: 0 });
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

    let imagePatch = {};
    if (shouldRename) {
      const renamed = await renameRoom(editRoomTarget, cleanName);
      if (!renamed) return;
    }

    if (editRoomImageFile) {
      const uploadedImageUrl = await uploadRoomImage(editRoomTarget, editRoomImageFile);
      if (!uploadedImageUrl) return;

      imagePatch = getRoomImagePatch(uploadedImageUrl);
    }

    const nextPatch = {
      name: cleanName,
      nameLower: cleanName.toLowerCase(),
      ...imagePatch,
    };

    setRooms((prev) =>
      prev.map((room) =>
        room.roomId === editRoomTarget.roomId
          ? { ...room, ...nextPatch }
          : room
      )
    );

    if (activeRoomRef.current?.roomId === editRoomTarget.roomId) {
      const nextActiveRoom = {
        ...activeRoomRef.current,
        ...nextPatch,
      };

      activeRoomRef.current = nextActiveRoom;
      setActiveRoom(nextActiveRoom);
    }

    roomsCacheRef.current = { key: '', timestamp: 0, rooms: [] };

    setStatus('Topic updated');

    if (editRoomImagePreview?.startsWith('blob:')) {
      URL.revokeObjectURL(editRoomImagePreview);
    }

    setShowEditRoomModal(false);
    setEditRoomTarget(null);
    setEditRoomName('');
    setEditRoomImageFile(null);
    setEditRoomImagePreview('');

    window.setTimeout(() => {
      if (mountedRef.current) loadRooms(roomSearch, { force: true });
    }, 300);
  } catch (err) {
    console.error(err);
    setStatus(
      err?.response?.data?.error ||
        err?.response?.data?.message ||
        err?.message ||
        'Could not update topic'
    );
  } finally {
    if (mountedRef.current) setEditRoomSaving(false);
  }
}



  function handleNewRoomImageChange(event) {
    const file = event.target.files?.[0] || null;
    event.target.value = '';

    if (!file) return;

    if (!file.type?.startsWith('image/')) {
      setStatus('Please choose an image file');
      return;
    }

    if (file.size > ROOM_IMAGE_PICKER_MAX_BYTES) {
      setStatus('Image must be smaller than 8 MB before optimization');
      return;
    }

    if (imageCropSourceUrl?.startsWith('blob:')) {
      URL.revokeObjectURL(imageCropSourceUrl);
    }

    setStatus('');
    setImageCropTarget('create');
    setImageCropSourceFile(file);
    setImageCropSourceUrl(URL.createObjectURL(file));
    setImageCropZoom(1);
    setImageCropOffset({ x: 0, y: 0 });
    setImageCropModalOpen(true);
  }

  function removeNewRoomImage() {
    if (newRoomImagePreview?.startsWith('blob:')) {
      URL.revokeObjectURL(newRoomImagePreview);
    }

    setNewRoomImageFile(null);
    setNewRoomImagePreview('');
  }

async function openRoom(room) {
  if (!room?.roomId) return;

  const requestId = Date.now();
  roomOpenRequestIdRef.current = requestId;

  if (activeRoomRef.current?.roomId === room.roomId) {
    setMobileChatOpen(true);

    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        const el = messagesRef.current;

        if (!el) return;

        el.style.scrollBehavior = 'auto';
        el.scrollTop = el.scrollHeight + 999999;
      });
    });

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

    const latestLimit = Math.max(
      ROOM_INITIAL_VISIBLE_MESSAGES,
      ROOM_MESSAGES_FETCH_LIMIT
    );

    const cachedMessages =
      roomMessagesCacheRef.current[room.roomId] || [];

    const latestCachedMessages =
      cachedMessages.slice(-latestLimit);

    setMobileChatOpen(true);

    setActiveRoom(room);
    activeRoomRef.current = room;

    initialRoomScrollDoneRef.current = room.roomId;

    shouldAutoScrollToNewestRef.current = false;

    setMessages(latestCachedMessages);

    setHasOlderMessages(
      cachedMessages.length > latestCachedMessages.length
    );

    setOlderMessagesLoading(false);
    olderMessagesLoadingRef.current = false;

    setMessagesLoading(latestCachedMessages.length === 0);

    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        const el = messagesRef.current;

        if (!el) return;

        el.style.scrollBehavior = 'auto';
        el.scrollTop = el.scrollHeight + 999999;
      });
    });

    if (room?.roomId) {
      requestAnimationFrame(() => {
        if (!mountedRef.current) return;

        setRoomUnreadCounts((prev) => {
          if (prev?.[room.roomId] === 0) return prev;

          return {
            ...prev,
            [room.roomId]: 0,
          };
        });
      });
    }

    const data = await Promise.race([
      roomApi.getRoomMessages(room.roomId, {
        limit: ROOM_MESSAGES_FETCH_LIMIT,
      }),

      new Promise((_, reject) =>
        setTimeout(
          () =>
            reject(
              new Error(
                'Room messages are taking longer than expected'
              )
            ),
          ROOM_LOAD_TIMEOUT_MS
        )
      ),
    ]);

    if (!mountedRef.current) return;

    if (roomOpenRequestIdRef.current !== requestId) return;

    if (activeRoomRef.current?.roomId !== room.roomId) return;

    const loadedMessages = trimRoomMessagesForMemory(
      getLoadedRoomMessages(data)
    );

    syncRoomMessageCache(room.roomId, loadedMessages);

    const latestMessages =
      loadedMessages.slice(-latestLimit);

    shouldAutoScrollToNewestRef.current = false;

    setMessages(latestMessages);

    setHasOlderMessages(
      loadedMessages.length > latestMessages.length
    );

    setMessagesLoading(false);

    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        const el = messagesRef.current;

        if (!el) return;

        el.style.scrollBehavior = 'auto';
        el.scrollTop = el.scrollHeight + 999999;
      });
    });
  } catch (err) {
    console.error(err);

    if (!mountedRef.current) return;

    if (roomOpenRequestIdRef.current !== requestId) return;

    console.error('OPEN ROOM ERROR:', err);

    setStatus(
      err?.response?.data?.error ||
        err?.response?.data?.message ||
        err?.message ||
        'Could not open room'
    );
  } finally {
    loadingRoomRef.current = false;

    if (mountedRef.current) {
      setMessagesLoading(false);
    }
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

    if (
      modalRoom?.roomId === room.roomId &&
      modalMode === 'members' &&
      members.length > 0 &&
      showMembers
    ) {
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

      const nextMembers = extractRoomArray(data, ['members']);

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

    if (
      modalRoom?.roomId === room.roomId &&
      modalMode === 'requests' &&
      members.length > 0 &&
      showMembers
    ) {
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

      const nextRequests = extractRoomArray(data, ['requests']);

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
    }

    roomsCacheRef.current = { key: '', timestamp: 0, rooms: [] };
    await loadRooms(roomSearch, { force: true });
  } catch (err) {
    console.error(err);
    setStatus(err?.response?.data?.error || 'Failed to delete room');
  }
}


  function downloadRoomMedia(message) {
  const normalizedMessage = normalizeRoomMessageMedia(message);
  const mediaUrl = normalizedMessage.mediaUrl || normalizedMessage.fileUrl || '';

  if (!mediaUrl) return;

  const fileName =
    normalizedMessage.fileName ||
    normalizedMessage.mediaName ||
    String(mediaUrl).split('/').filter(Boolean).pop()?.split('?')[0] ||
    'smarty-room-media';

  const link = document.createElement('a');
  link.href = mediaUrl;
  link.download = fileName;
  link.target = '_blank';
  link.rel = 'noopener noreferrer';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

async function deleteRoomMessage(message) {
  const room = activeRoomRef.current;
  const messageId = getRoomMessageId(message);

  if (!room?.roomId || !messageId || deletingMessageId) return;

  if (!(room.type === 'custom' && String(room.privacy || '').toLowerCase() === 'private' && isRoomOwner(room, userId))) {
    setStatus('Only the private group creator can delete messages.');
    return;
  }

  const ok = window.confirm(message?.mediaUrl || message?.fileUrl ? 'Delete this media?' : 'Delete this message?');
  if (!ok) return;

  try {
    setDeletingMessageId(messageId);

    await roomApi.deleteRoomMessage(room.roomId, messageId);

    setMessages((prev) => prev.filter((item) => getRoomMessageId(item) !== messageId));
    setStatus('Deleted');
  } catch (err) {
    setStatus(err?.response?.data?.error || err?.message || 'Could not delete message');
  } finally {
    setDeletingMessageId('');
  }
}

async function sendMessage(e) {
  e.preventDefault();

  const cleanText = text.trim();
  const room = activeRoomRef.current;

  const filesToSend =
    selectedMediaFiles.length > 0
      ? [...selectedMediaFiles]
      : selectedMediaFile
        ? [selectedMediaFile]
        : [];

  if (
    (!cleanText && filesToSend.length === 0) ||
    !room ||
    sendingMessageRef.current
  ) {
    return;
  }

  if (filesToSend.length > ROOM_MEDIA_MAX_FILES_PER_BATCH) {
    setStatus(
      `You can upload up to ${ROOM_MEDIA_MAX_FILES_PER_BATCH} files at once.`
    );
    return;
  }

  const totalBytes = filesToSend.reduce(
    (sum, file) => sum + Number(file.size || 0),
    0
  );

  if (totalBytes > ROOM_MEDIA_MAX_BATCH_BYTES) {
    setStatus('This batch is too large. Upload fewer files at once.');
    return;
  }

  sendingMessageRef.current = true;

  try {
    setStatus('');
    setText('');

    const isGuest = !authUserId;
    const senderGuestId = getStableGuestId();

    // -------------------------
    // TEXT ONLY MESSAGE
    // -------------------------
    if (filesToSend.length === 0) {
      const clientId = `temp-${Date.now()}-${Math.random()
        .toString(36)
        .slice(2)}`;

      const optimisticMessage = normalizeRoomMessageMedia({
        messageId: clientId,
        clientId,
        roomId: room.roomId,
        senderId: userId,
        senderName:
          user?.name ||
          user?.email ||
          (isGuest ? 'Guest' : 'You'),
        text: cleanText,
        message: cleanText,
        createdAt: String(Date.now()),
        createdAtMs: Date.now(),
        pending: true,
      });

      appendRoomMessage(room.roomId, optimisticMessage, {
        forceScroll: true,
      });

      pendingMessageIdsRef.current.add(clientId);

      // GUEST USERS
      if (isGuest) {
        try {
          await roomApi.sendGuestRoomMessage(room.roomId, {
            text: cleanText,
            message: cleanText,
            guestId: senderGuestId,
            clientGuestId: senderGuestId,
            clientId,
          });
        } catch (err) {
          markPendingRoomMessageFailed(clientId);
          throw err;
        }

        removeSelectedMedia();
        return;
      }

      // LOGGED IN USERS
      sendRoomMessage({
        action: 'sendRoomMessage',
        roomId: room.roomId,
        text: cleanText,
        message: cleanText,
        clientId,
      });

      removeSelectedMedia();
      return;
    }

    // -------------------------
    // MEDIA MESSAGES
    // -------------------------
    setUploadingMedia(true);
    setMediaUploadProgress(0);

    for (let index = 0; index < filesToSend.length; index += 1) {
      const file = filesToSend[index];

      const { mediaType } = getRoomMediaType(file);

      setMediaUploadLabel(
        `Uploading ${index + 1}/${filesToSend.length}`
      );

      const uploadedMedia = await roomApi.uploadRoomMediaFile(
        room.roomId,
        file,
        (progressValue) => {
          const safeProgress = Math.max(
            0,
            Math.min(100, Number(progressValue || 0))
          );

          const totalProgress = Math.round(
            (
              (index + safeProgress / 100) /
              filesToSend.length
            ) * 100
          );

          setMediaUploadProgress(totalProgress);
        }
      );

      const clientId = `temp-${Date.now()}-${index}-${Math.random()
        .toString(36)
        .slice(2)}`;

      const messageText = index === 0 ? cleanText : '';

      const optimisticMessage = normalizeRoomMessageMedia({
        messageId: clientId,
        clientId,
        roomId: room.roomId,
        senderId: userId,
        senderName:
          user?.name ||
          user?.email ||
          (isGuest ? 'Guest' : 'You'),
        text: messageText,
        message: messageText,
        createdAt: String(Date.now() + index),
        createdAtMs: Date.now() + index,
        pending: true,
        mediaKey: uploadedMedia?.mediaKey || '',
        mediaUrl:
          uploadedMedia?.mediaUrl ||
          uploadedMedia?.fileUrl ||
          '',
        fileUrl:
          uploadedMedia?.fileUrl ||
          uploadedMedia?.mediaUrl ||
          '',
        mediaType:
          uploadedMedia?.mediaType ||
          mediaType ||
          '',
        contentType:
          uploadedMedia?.contentType ||
          file?.type ||
          '',
        fileName:
          uploadedMedia?.fileName ||
          file?.name ||
          '',
        mediaName:
          uploadedMedia?.fileName ||
          file?.name ||
          '',
      });

      appendRoomMessage(room.roomId, optimisticMessage, {
        forceScroll: true,
      });

      pendingMessageIdsRef.current.add(clientId);

      // -------------------------
      // GUEST USERS
      // -------------------------
      if (isGuest) {
        try {
          await roomApi.sendGuestRoomMessage(room.roomId, {
            text: messageText,
            message: messageText,
            mediaKey: optimisticMessage.mediaKey,
            mediaUrl: optimisticMessage.mediaUrl,
            fileUrl: optimisticMessage.fileUrl,
            mediaType: optimisticMessage.mediaType,
            contentType: optimisticMessage.contentType,
            fileName: optimisticMessage.fileName,
            mediaName: optimisticMessage.mediaName,
            guestId: senderGuestId,
            clientGuestId: senderGuestId,
            clientId,
          });
        } catch (err) {
          markPendingRoomMessageFailed(clientId);
          throw err;
        }

        continue;
      }

      // -------------------------
      // LOGGED IN USERS
      // -------------------------
      sendRoomMessage({
        action: 'sendRoomMessage',
        roomId: room.roomId,
        text: messageText,
        message: messageText,
        mediaKey: optimisticMessage.mediaKey,
        mediaUrl: optimisticMessage.mediaUrl,
        fileUrl: optimisticMessage.fileUrl,
        mediaType: optimisticMessage.mediaType,
        contentType: optimisticMessage.contentType,
        fileName: optimisticMessage.fileName,
        mediaName: optimisticMessage.mediaName,
        clientId,
      });
    }

    removeSelectedMedia();

    setStatus(
      filesToSend.length > 1
        ? 'Files uploaded'
        : 'File uploaded'
    );
  } catch (err) {
    console.error(err);

    setStatus(
      err?.response?.data?.error ||
      err?.response?.data?.message ||
      err?.message ||
      'Failed to send message'
    );
  } finally {
    sendingMessageRef.current = false;
    setUploadingMedia(false);
    setMediaUploadProgress(0);
    setMediaUploadLabel('');
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
            const isPrivateCustom = room.type === 'custom' && String(room.privacy || '').toLowerCase() === 'private';
            const canLeave = isPrivateCustom && !isOwner;
            const canDelete = room.type === 'custom' && String(room.privacy || '').toLowerCase() === 'private' && isOwner;
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

                      <span>{String(room.privacy || '').toLowerCase() === 'private' ? ' Private' : ' Public'}</span>
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
      {!activeRoom && !mobileChatOpen ? (
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
  <div
    className="active-room-menu-popover"
    onClick={(event) => event.stopPropagation()}
  >
<button type="button" onClick={openActiveRoomInfo}>
  Group Info
</button>

<button type="button" onClick={openActiveRoomMediaPopup}>
  Media
</button>
  </div>
)}
            </div>
          </div>

<div
  className="messages"
  ref={setMessagesContainerRef}
  onScrollCapture={(event) => {
    const element = event.currentTarget;

    if (element.scrollTop < 80) {
      loadOlderRoomMessages();
    }

    const distanceFromBottom =
      element.scrollHeight -
      element.scrollTop -
      element.clientHeight;

    setShowScrollToBottom(distanceFromBottom > 220);
  }}
>
  {olderMessagesLoading && (
    <div className="older-messages-loading">
      <span className="older-messages-loading-dot" />
      <span>Loading earlier messages</span>
    </div>
  )}

  {messagesLoading && renderedMessages.length === 0 ? (
    <div
      className="room-loading-shell"
      aria-label="Loading messages"
    >
      <div className="room-loading-bubble" />
      <div className="room-loading-bubble mine" />
      <div className="room-loading-bubble short" />
    </div>
  ) : renderedMessages.length === 0 ? (
    <p className="empty">No messages yet</p>
  ) : (
    renderedMessages.map((msg) => {
      const messageKey =
        getStableRoomMessageKey(msg);

      return (
        <div
          key={messageKey}
          data-message-key={messageKey}
          className={
            msg.senderId === userId
              ? 'msg mine'
              : 'msg'
          }
          style={{
            backfaceVisibility: 'hidden',
          }}
        >
          {activeRoomCanDeleteMessages &&
            getRoomMessageId(msg) && (
              <button
                type="button"
                className="room-message-delete-btn"
                disabled={
                  deletingMessageId ===
                  getRoomMessageId(msg)
                }
                onClick={(event) => {
                  event.preventDefault();
                  event.stopPropagation();
                  deleteRoomMessage(msg);
                }}
                aria-label="Delete message"
                title="Delete message"
              >
                {deletingMessageId ===
                getRoomMessageId(msg) ? (
                  '…'
                ) : (
                  <Trash2
                    size={15}
                    strokeWidth={2.4}
                  />
                )}
              </button>
            )}

          <b>
            {msg.senderName ||
              msg.name ||
              'User'}
          </b>

          <div
            className="room-message-content"
            style={{
              transform: 'translateZ(0)',
              backfaceVisibility: 'hidden',
            }}
          >
            {(msg.text || msg.message) && (
              <p>
                {renderMessageWithLinks(
                  msg.text ||
                    msg.message ||
                    ''
                )}

                {msg.pending && (
                  <span className="msg-state">
                    {' '}
                    Sending...
                  </span>
                )}

                {msg.failed && (
                  <span className="msg-state failed">
                    {' '}
                    Failed
                  </span>
                )}
              </p>
            )}

            {msg.hasMediaPreview &&
              (msg.mediaUrl ||
                msg.fileUrl) && (
                <div
                  style={{
                    transform:
                      'translateZ(0)',
                    contain:
                      'layout paint style',
                    backfaceVisibility:
                      'hidden',
                  }}
                >
                  <RoomMediaPreview
                    item={msg}
                    variant="message"
                    onOpen={(item) => {
                      if (
                        item?.mediaType ===
                          'image' ||
                        item?.mediaType ===
                          'video'
                      ) {
                        setShowRoomMediaGrid(
                          false
                        );

                        window.setTimeout(
                          () => {
                            if (
                              typeof roomMediaViewerOpenerRef.current ===
                              'function'
                            ) {
                              roomMediaViewerOpenerRef.current(
                                item
                              );
                            }
                          },
                          0
                        );

                        return;
                      }

                      const url =
                        item?.mediaUrl ||
                        item?.fileUrl;

                      if (url) {
                        window.open(
                          url,
                          '_blank',
                          'noopener,noreferrer'
                        );
                      }
                    }}
                    onDownload={
                      downloadRoomMedia
                    }
                  />
                </div>
              )}
          </div>
        </div>
      );
    })
  )}

</div>

{showScrollToBottom && (
  <button
    type="button"
    aria-label="Scroll to latest message"
onClick={() => {
  shouldAutoScrollToNewestRef.current = true;

  scrollMessagesToBottom({
    behavior: 'auto',
    restoreDelay: 520,
  });

  window.setTimeout(() => {
    scrollMessagesToBottom({
      behavior: 'auto',
      restoreDelay: 360,
    });

    setShowScrollToBottom(false);
  }, 180);
}}
    style={{
      position: 'absolute',
      left: '18px',
      bottom: '92px',
      width: '42px',
      height: '42px',
      borderRadius: '999px',
      border: '1px solid rgba(255,255,255,0.08)',
      background: 'rgba(15, 23, 42, 0.92)',
      color: '#fff',
      fontSize: '20px',
      fontWeight: 700,
      zIndex: 40,
      backdropFilter: 'blur(18px)',
      WebkitBackdropFilter: 'blur(18px)',
      boxShadow:
        '0 8px 30px rgba(0,0,0,0.35)',
    }}
  >
    ↓
  </button>
)}

<form
  className="input"
  onSubmit={(event) => {
    event.preventDefault();
    event.stopPropagation();

    if (
      (!text.trim() &&
        selectedMediaFiles.length === 0) ||
      !activeRoom ||
      uploadingMedia
    ) {
      return;
    }

    sendMessage(event);
  }}
>
  {selectedMediaPreviews.length > 0 && (
    <div className="selected-room-media-preview selected-room-media-preview-multiple">
      <div className="selected-room-media-preview-list">
        {selectedMediaPreviews.map((item, index) => (
          <div
            className="selected-room-media-preview-item"
            key={`${item.preview}-${index}`}
          >
            {item.mediaType === 'image' ? (
              <img
                src={item.preview}
                alt="Preview"
              />
            ) : item.mediaType === 'video' ? (
             <video
  preload="metadata"
  playsInline
  src={item.preview}
  muted
  controls={false}
/>
            ) : (
              <span>
                📎{' '}
                {item.file?.name ||
                  'Attachment'}
              </span>
            )}

            <button
              type="button"
              className="remove-selected-room-media"
              onClick={() =>
                removeSelectedMediaAt(index)
              }
            >
              <X
                size={18}
                strokeWidth={2.5}
              />
            </button>
          </div>
        ))}
      </div>

      {uploadingMedia && (
        <div className="room-media-upload-progress">
          <span
            style={{
              width: `${mediaUploadProgress}%`,
            }}
          />
        </div>
      )}
    </div>
  )}

  <input
    type="text"
    placeholder="Type message..."
    disabled={!activeRoom}
    value={text}
    inputMode="text"
    autoComplete="off"
    autoCorrect="on"
    spellCheck="true"
    onKeyDown={(event) => {
      if (
        event.key === 'Enter' &&
        !event.shiftKey
      ) {
        event.preventDefault();

        if (
          (text || '').trim() ||
          selectedMediaFiles.length > 0
        ) {
          sendMessage(event);
        }
      }
    }}
    onChange={(event) =>
      setText(event.target.value)
    }
  />

  <label className="room-media-picker-btn">
    ＋

    <input
      type="file"
      accept="image/*,video/*,.pdf,.doc,.docx,.ppt,.pptx,.xls,.xlsx,.csv,.txt,.rtf,.zip,.rar"
      multiple
      hidden
      onChange={handleRoomMediaChange}
    />
  </label>

  <button
    type="submit"
    className="send-message-btn"
    disabled={
      (!text.trim() &&
        selectedMediaFiles.length === 0) ||
      !activeRoom ||
      uploadingMedia
    }
  >
    {uploadingMedia
      ? `${mediaUploadProgress || 0}%`
      : 'Send'}
  </button>
</form>
        </>
      )}
    </section>



{showActiveRoomInfo && activeRoom && (
  <RoomInfoPage
    activeRoom={activeRoom}
    activeRoomImageUrl={activeRoomImageUrl}
    activeRoomCanEdit={activeRoomCanEdit}
    activeInfoSection={activeInfoSection}
    setActiveInfoSection={setActiveInfoSection}
    activeInfoLoading={activeInfoLoading}
    activeInfoMembers={activeInfoMembers}
    activeInfoRequests={activeInfoRequests}
    inviteLinkLoading={inviteLinkLoading}
    generatedInviteLink={generatedInviteLink}
    inviteLinkCopied={inviteLinkCopied}
    inviteLinkAutoAccept={inviteLinkAutoAccept}
    setInviteLinkAutoAccept={setInviteLinkAutoAccept}
    copyGeneratedInviteLink={copyGeneratedInviteLink}
    generatePrivateRoomInviteLink={generatePrivateRoomInviteLink}
    approveJoinRequest={approveJoinRequest}
    getInviteUserId={getInviteUserId}
    toggleActiveInfoSection={toggleActiveInfoSection}
    openEditRoomModal={openEditRoomModal}
    isRoomOwner={isRoomOwner}
    userId={userId}
    onClose={() => {
      setShowActiveRoomInfo(false);
      setActiveInfoSection('');
    }}
  />
)}


<RoomMediaModal
  show={showRoomMediaGrid}
  activeRoom={activeRoom}
  messages={messages}
  messagesLoading={messagesLoading}
  hasOlderMessages={hasOlderMessages}
  roomMediaCacheRef={roomMediaCacheRef}
  roomMessagesCacheRef={roomMessagesCacheRef}
  messagesStateRef={messagesStateRef}
  mountedRef={mountedRef}
  loadOlderRoomMessages={loadOlderRoomMessages}
  setMessages={setMessages}
  setMessagesLoading={setMessagesLoading}
  setHasOlderMessages={setHasOlderMessages}
  setStatus={setStatus}
  onOpenGrid={() => {
  setShowRoomMediaGrid(true);
}}
  registerMediaViewerOpener={(opener) => {
  roomMediaViewerOpenerRef.current = opener;
}}
  onClose={() => setShowRoomMediaGrid(false)}
/>


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
                    disabled={!getInviteUserId(member)}
                    onClick={() => approveJoinRequest(getInviteUserId(member))}
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
  <div className="members-modal" onClick={closeEditRoomModal}>
    <div
      className="members-card create-room-modal"
      onClick={(event) => event.stopPropagation()}
    >
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
            name="topicName"
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

    {imageCropModalOpen && imageCropSourceUrl && (
  <div className="members-modal" onClick={closeImageCropModal}>
    <div
      className="members-card create-room-modal image-crop-card"
      onClick={(event) => event.stopPropagation()}
    >
      <button type="button" className="close-members" onClick={closeImageCropModal}>
        ✕
      </button>

      <h3>Adjust Image</h3>

<div
  className="image-crop-preview"
  onPointerDown={handleCropPointerDown}
>
  <img
    src={imageCropSourceUrl}
    alt="Crop preview"
    draggable="false"
    style={{
      transform: `translate(${imageCropOffset.x}px, ${imageCropOffset.y}px) scale(${imageCropZoom})`,
    }}
  />
</div>

      <label className="edit-room-field-label">
        <span>Zoom</span>
        <input
          type="range"
          min="1"
          max="2.5"
          step="0.05"
          value={imageCropZoom}
          onChange={(event) => setImageCropZoom(Number(event.target.value))}
        />
      </label>

      <div className="crop-actions">
        <button type="button" className="delete-room-btn" onClick={closeImageCropModal}>
          Cancel
        </button>

        <button type="button" className="approve-request-btn" onClick={confirmImageCrop}>
          Use Image
        </button>
      </div>
    </div>
  </div>
)}
  </main>
);
}

