import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { roomApi } from '../api/client';
import { useAuth } from '../contexts/AuthContext';
import { connectChatSocket, sendRoomMessage } from '../api/chatSocket';

import './TopicRoomsPage.css';

const ROOM_IMAGE_CACHE_KEY = 'smarty_room_images_v1';
const API_ORIGIN = 'https://po2hwyb2c6.execute-api.us-east-1.amazonaws.com';
const ROOM_IMAGE_MAX_BYTES = 4 * 1024 * 1024;
const ROOM_IMAGE_PICKER_MAX_BYTES = 8 * 1024 * 1024;

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
    // Ignore storage errors in private mode or low-storage environments.
  }
}

function removeStoredRoomImage(roomId) {
  if (!roomId) return;

  try {
    const current = getStoredRoomImages();
    delete current[roomId];
    localStorage.setItem(ROOM_IMAGE_CACHE_KEY, JSON.stringify(current));
  } catch {
    // Ignore storage errors in private mode or low-storage environments.
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

  const padding = cleanBase64.endsWith('==')
    ? 2
    : cleanBase64.endsWith('=')
      ? 1
      : 0;

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

export default function TopicRoomsPage() {
  const { user } = useAuth();
  const userId = user?.id || user?.userId || user?.sub;
  const [roomImageCache, setRoomImageCache] = useState(() => getStoredRoomImages());
  const [failedRoomImageIds, setFailedRoomImageIds] = useState(() => new Set());
  const [mobileChatOpen, setMobileChatOpen] = useState(false);
  const activeRoomRef = useRef(null);
  const messagesRef = useRef(null);
  const mountedRef = useRef(true);
  const loadingRoomRef = useRef(false);
  const sendingMessageRef = useRef(false);
  const [hiddenRooms, setHiddenRooms] = useState([]);
  const [showHidden, setShowHidden] = useState(false);
  const [roomsLoading, setRoomsLoading] = useState(false);
  const [messagesLoading, setMessagesLoading] = useState(false);
  const [roomInvites, setRoomInvites] = useState([]);
  const [showRoomInvites, setShowRoomInvites] = useState(false);
  const [roomInvitesLoading, setRoomInvitesLoading] = useState(false);
  const [processingInviteId, setProcessingInviteId] = useState('');
  const [rooms, setRooms] = useState([]);
  const [roomUnreadCounts, setRoomUnreadCounts] = useState({});
  const [activeRoom, setActiveRoom] = useState(null);
  const [messages, setMessages] = useState([]);
  const [text, setText] = useState('');
  const [showInvite, setShowInvite] = useState(false);
  const [inviteSearch, setInviteSearch] = useState('');
  const [inviteResults, setInviteResults] = useState([]);
  const [pendingInviteUserIds, setPendingInviteUserIds] = useState(() => new Set());
  const [newRoomName, setNewRoomName] = useState('');
  const [newRoomPrivacy, setNewRoomPrivacy] = useState('public');
  const [newRoomImageFile, setNewRoomImageFile] = useState(null);
  const [newRoomImagePreview, setNewRoomImagePreview] = useState('');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showRoomMenu, setShowRoomMenu] = useState(false);
  const [openRoomActionMenuId, setOpenRoomActionMenuId] = useState('');
  const [uploadingRoomImageId, setUploadingRoomImageId] = useState('');

  const roomMenuRef = useRef(null);
  const roomActionMenuRef = useRef(null);

  const [roomSearch, setRoomSearch] = useState('');
  const [modalTitle, setModalTitle] = useState('Group Members');
  const [modalMode, setModalMode] = useState('members');
  const [modalRoom, setModalRoom] = useState(null);
  const [members, setMembers] = useState([]);
  const [showMembers, setShowMembers] = useState(false);

  const [status, setStatus] = useState('');

  // Prevent duplicate room creation submissions
  const [creatingRoom, setCreatingRoom] = useState(false);

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

  return imageUrl;
}, [roomImageCache]);

  const sortedVisibleRooms = useMemo(() => rooms, [rooms]);

  const renderedMessages = useMemo(() => {
    if (!Array.isArray(messages) || messages.length === 0) return [];

    const seen = new Set();
    const unique = [];

    for (const msg of messages) {
      const key =
        msg.messageId ||
        msg.clientId ||
        `${msg.createdAt || 'msg'}-${msg.senderId || 'user'}-${msg.text || msg.message || ''}`;

      if (seen.has(key)) continue;

      seen.add(key);
      unique.push(msg);
    }

    return unique.length > 180 ? unique.slice(-180) : unique;
  }, [messages]);
  useEffect(() => {
    activeRoomRef.current = activeRoom;
  }, [activeRoom]);

  useEffect(() => {
    const handleOutsidePointerDown = (event) => {
      const target = event.target;

      if (roomMenuRef.current && !roomMenuRef.current.contains(target)) {
        setShowRoomMenu(false);
      }

      if (roomActionMenuRef.current && !roomActionMenuRef.current.contains(target)) {
        setOpenRoomActionMenuId('');
      }
    };

    document.addEventListener('pointerdown', handleOutsidePointerDown);

    return () => {
      document.removeEventListener('pointerdown', handleOutsidePointerDown);
    };
  }, []);

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
  return () => {
    if (newRoomImagePreview?.startsWith('blob:')) {
      URL.revokeObjectURL(newRoomImagePreview);
    }
  };
}, [newRoomImagePreview]);

  async function loadRooms(searchValue = roomSearch) {
    try {
      setStatus('');
      setRoomsLoading(true);

      const data = await roomApi.getRooms({
        search: searchValue.trim(),
      });

      if (!mountedRef.current) return;

      const cachedRoomImages = getStoredRoomImages();
      setRoomImageCache(cachedRoomImages);
      const allRoomsRaw = Array.isArray(data?.rooms) ? data.rooms : Array.isArray(data) ? data : [];
      const allRooms = allRoomsRaw.map((room) => {
        const cachedImageUrl = cachedRoomImages[room.roomId];
        const imageUrl = normalizeRoomImageUrl(room.imageUrl || room.roomImageUrl || room.avatarUrl || room.coverImageUrl || room.coverUrl || cachedImageUrl || '');

        return {
  ...room,
  imageUrl,
  roomImageUrl: room.roomImageUrl || imageUrl,
  coverImageUrl: room.coverImageUrl || imageUrl,
};
      });
      const normalizedSearch = searchValue.trim().toLowerCase();

      const visibleRooms = allRooms.filter((room) => {
        const isOwner = room.ownerId === userId || room.createdBy === userId;

        if (isOwner) return true;
        if (!normalizedSearch) return true;

        return (room.name || '').toLowerCase().includes(normalizedSearch);
      });

      visibleRooms.sort((a, b) => {
        const aOwner = a.ownerId === userId || a.createdBy === userId;
        const bOwner = b.ownerId === userId || b.createdBy === userId;

        if (aOwner && !bOwner) return -1;
        if (!aOwner && bOwner) return 1;

        return Number(b.createdAt || 0) - Number(a.createdAt || 0);
      });

      setRooms(visibleRooms);
    } catch (err) {
      console.error(err);
      if (mountedRef.current) setStatus('Failed to load rooms');
    } finally {
      if (mountedRef.current) setRoomsLoading(false);
    }
  }

useEffect(() => {
  if (!userId) return;

  const timeout = setTimeout(() => {
    loadRooms('');
  }, 150);

  return () => clearTimeout(timeout);
}, [userId]);



  useEffect(() => {
    if (!userId) return undefined;

    const unsubscribe = connectChatSocket(userId, (data) => {
      if (!mountedRef.current) return;

      const msg = data?.message;
      const current = activeRoomRef.current;

      if (!msg) return;

      if (data.type === 'messageAck') {
        if (!msg.clientId) return;

        setMessages((prev) => {
          const index = prev.findIndex(
            (m) => m.clientId === msg.clientId || m.messageId === msg.clientId
          );

          if (index === -1) {
            const alreadyExists = prev.some((m) => m.messageId === msg.messageId);
            return alreadyExists ? prev : [...prev.slice(-179), msg];
          }

          const copy = [...prev];
          copy[index] = {
            ...copy[index],
            ...msg,
            pending: false,
            failed: false,
          };
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

if (prev.some((m) => (m.messageId || m.clientId) === key)) {
  return prev;
}
        return [...prev.slice(-179), msg];
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
        await loadRooms();
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
            setFailedRoomImageIds((prev) => {
              if (!prev.has(createdRoom.roomId)) return prev;
              const next = new Set(prev);
              next.delete(createdRoom.roomId);
              return next;
            });
            setRoomImageCache((prev) => ({
              ...prev,
              [createdRoom.roomId]: imageUrl,
            }));

            finalCreatedRoom = {
              ...createdRoom,
              imageUrl,
              roomImageUrl: imageUrl,
              coverImageUrl: imageUrl,
            };

            setRooms((prev) =>
              prev.map((item) =>
                item.roomId === createdRoom.roomId
                  ? { ...item, imageUrl, roomImageUrl: imageUrl, coverImageUrl: imageUrl }
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

      await loadRooms();

      // Creator is already added as owner/member by backend, so do not call joinRoom here.
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
          const loadedMessages = Array.isArray(messageData?.messages)
            ? messageData.messages
            : Array.isArray(messageData)
              ? messageData
              : [];
          setMessages(loadedMessages.slice(-180));
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
      setHiddenRooms(Array.isArray(data) ? data : Array.isArray(data?.rooms) ? data.rooms : []);
      setShowHidden(true);
    } catch (err) {
      console.error(err);
      if (mountedRef.current) setStatus('Could not load hidden rooms');
    }
  }

async function unhideRoom(room) {
  try {
    await roomApi.unhideRoom(room.roomId);
    setHiddenRooms((prev) => prev.filter((r) => r.roomId !== room.roomId));
    await loadRooms();
  } catch (err) {
    console.error(err);
    setStatus('Could not unhide room');
  }
}

// Room Invites popup logic
async function loadRoomInvites(openPopup = false) {
  try {
    if (openPopup) setStatus('');
    setRoomInvitesLoading(true);

    const data = await roomApi.getRoomInvites();
    if (!mountedRef.current) return;

    const invites = Array.isArray(data?.invites)
      ? data.invites
      : Array.isArray(data)
        ? data
        : [];

    setRoomInvites(invites);
    if (openPopup) setShowRoomInvites(true);
  } catch (err) {
    console.error(err);
    if (mountedRef.current && openPopup) {
      setStatus(err?.response?.data?.error || 'Could not load room invites');
    }
  } finally {
    if (mountedRef.current) setRoomInvitesLoading(false);
  }
}

async function openRoomInvites() {
  setShowRoomMenu(false);
  await loadRoomInvites(true);
}

async function acceptRoomInvite(invite) {
  const roomId = invite?.roomId;
  if (!roomId || processingInviteId) return;

  try {
    setProcessingInviteId(roomId);
    setStatus('');

    await roomApi.acceptRoomInvite(roomId);
    if (!mountedRef.current) return;

    setRoomInvites((prev) => {
  const updated = prev.filter((item) => (item.roomId || item.id) !== roomId);
  if (updated.length === 0) setShowRoomInvites(false);
  return updated;
});

setStatus('Room invite accepted');
await loadRooms();
  } catch (err) {
    console.error(err);
    if (mountedRef.current) setStatus(err?.response?.data?.error || 'Could not accept invite');
  } finally {
    if (mountedRef.current) setProcessingInviteId('');
  }
}

async function rejectRoomInvite(invite) {
  const roomId = invite?.roomId;
  if (!roomId || processingInviteId) return;

  try {
    setProcessingInviteId(roomId);
    setStatus('');

    await roomApi.declineRoomInvite(roomId);
    if (!mountedRef.current) return;

    setRoomInvites((prev) => {
      const updated = prev.filter((item) => (item.roomId || item.id) !== roomId);
      if (updated.length === 0) setShowRoomInvites(false);
      return updated;
    });

    setStatus('Room invite rejected');
  } catch (err) {
    console.error(err);
    if (mountedRef.current) setStatus(err?.response?.data?.error || 'Could not reject invite');
  } finally {
    if (mountedRef.current) setProcessingInviteId('');
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

// Optimize and prepare room image for upload
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
  const maxDimension = 1280;
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
  if (!room?.roomId || !file || uploadingRoomImageId) return;

  if (!file.type?.startsWith('image/')) {
    setStatus('Please choose an image file');
    return;
  }

  if (file.size > ROOM_IMAGE_PICKER_MAX_BYTES) {
    setStatus('Image must be smaller than 8 MB before optimization');
    return;
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
      await loadRooms();
      return;
    }

    persistStoredRoomImage(room.roomId, imageUrl);
    setFailedRoomImageIds((prev) => {
      if (!prev.has(room.roomId)) return prev;
      const next = new Set(prev);
      next.delete(room.roomId);
      return next;
    });
    setRoomImageCache((prev) => ({
      ...prev,
      [room.roomId]: imageUrl,
    }));

    setRooms((prev) =>
      prev.map((item) =>
        item.roomId === room.roomId
          ? { ...item, imageUrl, roomImageUrl: imageUrl, coverImageUrl: imageUrl }
          : item
      )
    );

    if (activeRoomRef.current?.roomId === room.roomId) {
      const updatedRoom = {
        ...activeRoomRef.current,
        imageUrl,
        roomImageUrl: imageUrl,
        coverImageUrl: imageUrl,
      };

      activeRoomRef.current = updatedRoom;
      setActiveRoom(updatedRoom);
    }

    setOpenRoomActionMenuId('');
    setStatus('Room image updated');
  } catch (err) {
  console.error(err);

  if (err?.response?.status === 403) {
    setStatus('Only the room creator can change this room image');
  } else {
    setStatus(err?.response?.data?.error || 'Could not upload room image');
  }
} finally {
    if (mountedRef.current) setUploadingRoomImageId('');
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
    loadingRoomRef.current = true;

    try {
      setStatus('');
      setOpenRoomActionMenuId('');

      setActiveRoom(room);
      activeRoomRef.current = room;
      setMessages([]);
      setMobileChatOpen(true);
      setMessagesLoading(true);
      setRoomUnreadCounts((prev) => ({
        ...prev,
        [room.roomId]: 0,
      }));

      const data = await roomApi.getRoomMessages(room.roomId);
      if (!mountedRef.current || activeRoomRef.current?.roomId !== room.roomId) return;

      const loadedMessages = Array.isArray(data?.messages)
        ? data.messages
        : Array.isArray(data)
          ? data
          : [];

      setMessages(loadedMessages.slice(-180));
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
    try {
      setStatus('');
      setShowInvite(false);
      setInviteSearch('');
      setInviteResults([]);
      setPendingInviteUserIds(new Set());

      const data = await roomApi.getRoomMembers(room.roomId);

      setModalTitle(`${room.name} members`);
      setModalMode('members');
      setModalRoom(room);
      setMembers(data.members || data || []);
      setShowMembers(true);
    } catch (err) {
      console.error(err);
      setStatus(err?.response?.data?.error || 'Could not load members');
    }
  }

async function searchUsers() {
  const query = inviteSearch.trim();

  if (!query) {
    setInviteResults([]);
    return;
  }

  try {
    setStatus('');
    const data = await roomApi.searchUsers(query);
    setInviteResults(data.users || data || []);
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

    const data = await roomApi.inviteUserToRoom(
      modalRoom.roomId,
      targetUserId
    );

    setPendingInviteUserIds((prev) => {
      const next = new Set(prev);
      next.add(targetUserId);
      return next;
    });

    setInviteResults((prev) =>
      prev.map((item) =>
        getInviteUserId(item) === targetUserId
          ? { ...item, invited: true }
          : item
      )
    );

    setStatus(data?.message || 'Invite request sent. The user must accept before joining.');
  } catch (err) {
    console.error(err);

    const message =
      err?.response?.data?.error ||
      err?.response?.data?.message ||
      '';

    if (err?.response?.status === 409) {
      setPendingInviteUserIds((prev) => {
        const next = new Set(prev);
        next.add(targetUserId);
        return next;
      });

      setInviteResults((prev) =>
        prev.map((item) =>
          getInviteUserId(item) === targetUserId
            ? { ...item, invited: true }
            : item
        )
      );

      setStatus(message || 'Invite already sent');
    } else if (err?.response?.status === 403) {
      setStatus(message || 'Only the room creator can invite users.');
    } else {
      setStatus(message || 'Invite failed');
    }
  }
}

  async function openJoinRequests(room) {
    try {
      setStatus('');
      setShowInvite(false);
      setInviteSearch('');
      setInviteResults([]);
      setPendingInviteUserIds(new Set());

      const data = await roomApi.getRoomJoinRequests(room.roomId);

      setModalTitle(`${room.name} join requests`);
      setModalMode('requests');
      setModalRoom(room);
      setMembers(data.requests || data || []);
      setShowMembers(true);
    } catch (err) {
      console.error(err);
      setStatus(err?.response?.data?.error || 'Could not load join requests');
    }
  }

  async function approveJoinRequest(requestUserId) {
    if (!modalRoom?.roomId) return;

    try {
      await roomApi.approveRoomJoinRequest(modalRoom.roomId, requestUserId);
      setMembers((prev) => prev.filter((member) => member.userId !== requestUserId));
      setStatus('Join request approved');
      await loadRooms();
    } catch (err) {
      console.error(err);
      setStatus(err?.response?.data?.error || 'Could not approve request');
    }
  }

  async function leaveRoom(room) {
    const ok = window.confirm(`Leave "${room.name}"? You will need creator approval to join again.`);
    if (!ok) return;

    setOpenRoomActionMenuId('');

    if (activeRoomRef.current?.roomId === room.roomId) {
      setActiveRoom(null);
      activeRoomRef.current = null;
      setMessages([]);
      setMobileChatOpen(false);
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
      setStatus('Left private group');

      window.setTimeout(() => {
        if (mountedRef.current) loadRooms();
      }, 150);
    } catch (err) {
      console.error(err);
      setStatus(err?.response?.data?.error || 'Could not leave room');
      if (mountedRef.current) loadRooms();
    }
  }

  async function hideRoom(room) {
    try {
      setStatus('');

      await roomApi.hideRoom(room.roomId);
      setRoomUnreadCounts((prev) => {
        const copy = { ...prev };
        delete copy[room.roomId];
        return copy;
      });

      if (activeRoom?.roomId === room.roomId) {
        setActiveRoom(null);
        activeRoomRef.current = null;
        setMessages([]);
      }

      await loadRooms();
    } catch (err) {
      console.error(err);
      setStatus(err?.response?.data?.error || 'Could not hide room');
    }
  }

  async function deleteRoom(room) {
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

      if (activeRoom?.roomId === room.roomId) {
        setActiveRoom(null);
        activeRoomRef.current = null;
        setMessages([]);
      }

      await loadRooms();
    } catch (err) {
      console.error(err);
      setStatus(err?.response?.data?.error || 'Failed to delete room');
    }
  }

function sendMessage(e) {
  e.preventDefault();

  const cleanText = text.trim();
  const room = activeRoomRef.current;

  if (!cleanText || !room || sendingMessageRef.current) return;

  sendingMessageRef.current = true;

  const clientId = `temp-${Date.now()}-${Math.random().toString(36).slice(2)}`;

  const tempMessage = {
    messageId: clientId,
    clientId,
    roomId: room.roomId,
    senderId: userId,
    senderName: user?.name || user?.email || 'You',
    text: cleanText,
    createdAt: Date.now(),
    pending: true,
  };

  setText('');
  setMessages((prev) => {
    if (prev.some((msg) => (msg.messageId || msg.clientId) === clientId)) return prev;
    return [...prev.slice(-179), tempMessage];
  });

  scrollMessagesToBottom();

  try {
    sendRoomMessage({
      action: 'sendRoomMessage',
      roomId: room.roomId,
      text: cleanText,
      clientId,
    });
  } catch (err) {
    console.error(err);
    setStatus('Failed to send message');
    setMessages((prev) =>
      prev.map((msg) =>
        msg.clientId === clientId
          ? { ...msg, pending: false, failed: true }
          : msg
      )
    );
  } finally {
    sendingMessageRef.current = false;
  }
}

  return (
<main className={`rooms-page ${mobileChatOpen && activeRoom ? 'mobile-chat-open' : ''}`}>
      <aside className="sidebar">
        <div className="rooms-title-row">
          <h2>Rooms</h2>

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
          ) : sortedVisibleRooms.map((room) => {
            const isOwner = room.ownerId === userId || room.createdBy === userId;
            const isPrivateCustom = room.type === 'custom' && room.privacy === 'private';
const canLeave = isPrivateCustom && !isOwner;
const canDelete = room.type === 'custom' && isOwner;
const canChangeImage = room.type === 'custom' && isOwner;
const canViewRequests = isPrivateCustom && isOwner;
            const unreadCount = roomUnreadCounts[room.roomId] || room.unreadCount || 0;
            const roomImageUrl = getRoomImageUrl(room);

            return (
              <div
                key={room.roomId}
                className={`room-item ${roomImageUrl ? 'room-has-image' : ''} ${activeRoom?.roomId === room.roomId ? 'active' : ''}`}
                style={roomImageUrl ? { '--room-bg-image': `url(${roomImageUrl})` } : undefined}
                onClick={() => openRoom(room)}
              >
                <div className="room-info">
                  <div className="room-item-main">
                    <div className="room-image-wrap">
                      {roomImageUrl ? (
                        <img
                          src={roomImageUrl}
                          alt=""
                          width="44"
                          height="44"
                          loading="lazy"
                          decoding="async"
                          referrerPolicy="no-referrer"
                          onError={(event) => {
  event.currentTarget.style.display = 'none';
  removeStoredRoomImage(room.roomId);
  setRoomImageCache((prev) => {
    if (!prev[room.roomId]) return prev;
    const next = { ...prev };
    delete next[room.roomId];
    return next;
  });
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
                          {(room.ownerId === userId || room.createdBy === userId) && (
                            <span className="room-owner-badge">You</span>
                          )}
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
                  onClick={(e) => e.stopPropagation()}
                  onPointerDown={(e) => e.stopPropagation()}
                >
                  <button
                    type="button"
                    className="room-card-menu-btn"
                    aria-label="Room actions"
                    aria-expanded={openRoomActionMenuId === room.roomId}
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
                   {canChangeImage && (
  <label className="room-image-upload-option">
    <input
      type="file"
      accept="image/jpeg,image/png,image/webp,image/gif"
      disabled={uploadingRoomImageId === room.roomId}
      onChange={(event) => {
        const file = event.target.files?.[0];
        event.target.value = '';
        if (file) uploadRoomImage(room, file);
      }}
    />
    {uploadingRoomImageId === room.roomId ? 'Uploading...' : 'Change Image'}
  </label>
)}
                      {room.privacy === 'private' && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            setOpenRoomActionMenuId('');
                            openMembers(room);
                          }}
                        >
                          Members
                        </button>
                      )}

                      {canViewRequests && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            setOpenRoomActionMenuId('');
                            openJoinRequests(room);
                          }}
                        >
                          Requests
                        </button>
                      )}

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
          })}
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
    }}
  >
    ←
  </button>

  <span className="active-room-title-wrap">
    {getRoomImageUrl(activeRoom) && (
      <img
        className="active-room-image"
        src={getRoomImageUrl(activeRoom)}
        alt=""
        width="36"
        height="36"
        loading="lazy"
        decoding="async"
        referrerPolicy="no-referrer"
        onError={(event) => {
  event.currentTarget.style.display = 'none';
  if (activeRoom?.roomId) {
    removeStoredRoomImage(activeRoom.roomId);
  }
}}
      />
    )}
    <span>{activeRoom.name}</span>
  </span>
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
                    <p>
                      {msg.text || msg.message || ''}
                      {msg.pending && <span className="msg-state"> Sending...</span>}
                      {msg.failed && <span className="msg-state failed"> Failed</span>}
                    </p>
                  </div>
                ))
              )}
            </div>

            <form className="input" onSubmit={sendMessage}>


<input
  placeholder="Type message..."
  disabled={!activeRoom}
  value={text}
  onChange={(e) => {
    setText(e.target.value);
  }}
  onFocus={scrollMessagesToBottom}
/>
              <button type="submit" disabled={!text.trim() || !activeRoom}>Send</button>
            </form>

            {messages.length > 180 && (
              <button
                type="button"
                className="room-trim-messages-btn"
                onClick={() => setMessages((prev) => prev.slice(-120))}
              >
                Reduce loaded messages
              </button>
            )}
          </>
        )}
      </section>

      {showHidden && (
  <div className="members-modal">
    <div className="members-card">
      <button
        type="button"
        className="close-members"
        onClick={() => setShowHidden(false)}
      >
        ✕
      </button>

      <h3>Hidden Groups</h3>

      {hiddenRooms.length === 0 ? (
        <p className="member-empty">No hidden groups.</p>
      ) : (
        hiddenRooms.map((room) => (
          <div key={room.roomId} className="member-row">
            <strong>{room.name}</strong>

            <button
              type="button"
              className="approve-request-btn"
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
            <button
              type="button"
              className="close-members"
              onClick={() => setShowRoomInvites(false)}
            >
              ✕
            </button>

            <h3>Room Invites</h3>

            {roomInvitesLoading ? (
              <p className="member-empty">Loading invites...</p>
            ) : roomInvites.length === 0 ? (
              <p className="member-empty">No pending room invites.</p>
            ) : (
              roomInvites.map((invite, index) => {
                const inviteRoomId = invite.roomId || invite.id;

                return (
                  <div key={inviteRoomId || `invite-${index}`} className="member-row">
                    <div>
                      <strong>{invite.roomName || invite.name || 'Room invite'}</strong>
                      {(invite.inviterName || invite.inviterEmail || invite.createdByName) && (
                        <small>
                          Invited by {invite.inviterName || invite.inviterEmail || invite.createdByName}
                        </small>
                      )}
                    </div>

                    <div className="room-actions">
                      <button
                        type="button"
                        className="approve-request-btn"
                        disabled={!inviteRoomId || processingInviteId === inviteRoomId}
                        onClick={() => acceptRoomInvite({ ...invite, roomId: inviteRoomId })}
                      >
                        {processingInviteId === inviteRoomId ? 'Accepting...' : 'Accept'}
                      </button>

                      <button
                        type="button"
                        className="delete-room-btn"
                        disabled={!inviteRoomId || processingInviteId === inviteRoomId}
                        onClick={() => rejectRoomInvite({ ...invite, roomId: inviteRoomId })}
                      >
                        Reject
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
            <button
              type="button"
              className="close-members"
              onClick={() => setShowMembers(false)}
            >
              ✕
            </button>

            <h3>{modalTitle}</h3>

<button
  className="approve-request-btn"
  onClick={() => setShowInvite((prev) => !prev)}
>
  ➕ Send Invite Request
</button>

{showInvite && (
  <div className="invite-box">
    <div className="invite-search-row">
      <input
        placeholder="Search by email or ID..."
        value={inviteSearch}
        onChange={(e) => setInviteSearch(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault();
            searchUsers();
          }
        }}
      />

      <button
        type="button"
        className="approve-request-btn"
        onClick={searchUsers}
      >
        Search
      </button>
    </div>

    <div className="invite-results">
      {inviteResults.length === 0 ? (
        <p className="member-empty">Search for users and send them an invite request. They must accept before joining.</p>
      ) : (
        inviteResults.map((u) => {
          const targetUserId = getInviteUserId(u);
          const alreadyMember = isExistingRoomMember(u) || isRoomOwnerUser(u);
          const alreadyInvited = u.invited || pendingInviteUserIds.has(targetUserId);
          const canInvite = canInviteUserToCurrentRoom(u);

          return (
            <div key={targetUserId || u.email} className="member-row">
              <div>
                <strong>{u.name || u.email || 'User'}</strong>
                {u.email && <small>{u.email}</small>}
              </div>

              {alreadyMember ? (
                <span className="member-role-pill">Already in room</span>
              ) : alreadyInvited ? (
                <span className="member-role-pill">Invite sent</span>
              ) : (
                <button
                  type="button"
                  onClick={() => inviteUser(u)}
                  className="approve-request-btn"
                  disabled={!canInvite}
                >
                  Send Request
                </button>
              )}
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
                <div key={member.userId} className="member-row">
                  <div>
                    <strong>{member.name || 'User'}</strong>
                    {member.email && <small>{member.email}</small>}
                  </div>

                  {modalMode === 'requests' ? (
                    <button
                      type="button"
                      className="approve-request-btn"
                      onClick={() => approveJoinRequest(member.userId)}
                    >
                      Approve
                    </button>
                  ) : (
                    <span>{member.role || 'member'}</span>
                  )}
                </div>
              ))
            )}
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

            <form
              onSubmit={createRoom}
              className="create-form"
            >
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
                  <img
                    src={newRoomImagePreview}
                    alt="Room preview"
                    width="56"
                    height="56"
                  />

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

              <button type="submit" className="approve-request-btn" disabled={creatingRoom || !newRoomName.trim()}>
                {creatingRoom ? (newRoomImageFile ? 'Creating and uploading...' : 'Creating...') : 'Create Room'}
              </button>
            </form>
          </div>
        </div>
      )}
    </main>
  );
}