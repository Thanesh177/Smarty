import { useEffect, useRef, useState } from 'react';
import { roomApi } from '../api/client';
import { useAuth } from '../contexts/AuthContext';
import { connectChatSocket, sendRoomMessage } from '../api/chatSocket';
import './TopicRoomsPage.css';

export default function TopicRoomsPage() {
  const { user } = useAuth();
  const userId = user?.id || user?.userId || user?.sub;
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
  const [newRoomName, setNewRoomName] = useState('');
  const [newRoomPrivacy, setNewRoomPrivacy] = useState('public');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showRoomMenu, setShowRoomMenu] = useState(false);
  const [openRoomActionMenuId, setOpenRoomActionMenuId] = useState('');

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

const scrollMessagesToBottom = () => {
  const el = messagesRef.current;
  if (!el) return;
  el.scrollTop = el.scrollHeight;
};

useEffect(() => {
  scrollMessagesToBottom();
}, [messages]);

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
}, [activeRoom]);

  async function loadRooms(searchValue = roomSearch) {
    try {
      setStatus('');
      setRoomsLoading(true);

      const data = await roomApi.getRooms({
        search: searchValue.trim(),
      });

      if (!mountedRef.current) return;

      const allRooms = Array.isArray(data?.rooms) ? data.rooms : Array.isArray(data) ? data : [];
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
            return alreadyExists ? prev : [...prev, msg];
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
        return [...prev, msg];
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

    const name = newRoomName.trim();
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

      console.log('CREATE ROOM RESPONSE:', data);

      let parsedData = data;
      try {
        parsedData = typeof data === 'string' ? JSON.parse(data) : data;
      } catch {
        parsedData = data;
      }
      const parsedBody =
        typeof parsedData?.body === 'string'
          ? JSON.parse(parsedData.body)
          : parsedData?.body;

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

      setNewRoomName('');
      setNewRoomPrivacy('public');
      setShowCreateModal(false);

      await loadRooms();

      // Creator is already added as owner/member by backend, so do not call joinRoom here.
      setActiveRoom(createdRoom);
      activeRoomRef.current = createdRoom;
      setMessages([]);
      setMobileChatOpen(true);

      if (createdRoom.privacy === 'private') {
        setModalTitle(`Invite users to ${createdRoom.name}`);
        setModalMode('members');
        setModalRoom(createdRoom);
        setMembers([]);
        setInviteSearch('');
        setInviteResults([]);
        setShowInvite(true);
        setShowMembers(true);
      }
      setRoomUnreadCounts((prev) => ({
        ...prev,
        [createdRoom.roomId]: 0,
      }));

      try {
        setMessagesLoading(true);
        const messageData = await roomApi.getRoomMessages(createdRoom.roomId);
        if (mountedRef.current) {
          const loadedMessages = Array.isArray(messageData?.messages)
            ? messageData.messages
            : Array.isArray(messageData)
              ? messageData
              : [];
          setMessages(loadedMessages);
        }
      } catch (messageErr) {
        console.error('Could not load new room messages:', messageErr);
      } finally {
        if (mountedRef.current) setMessagesLoading(false);
      }

      setStatus('Room created successfully');
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
      setCreatingRoom(false);
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

      setMessages(loadedMessages);
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

async function inviteUser(userIdToInvite) {
  if (!modalRoom?.roomId || !userIdToInvite) return;
if (inviteResults.some((item) => item.userId === userIdToInvite && item.invited)) return;
  try {
    setStatus('');

    const data = await roomApi.inviteUserToRoom(
      modalRoom.roomId,
      userIdToInvite
    );

    setStatus(data?.message || 'Invite request sent. The user must accept before joining.');

    setInviteResults((prev) =>
      prev.map((item) =>
        item.userId === userIdToInvite
          ? { ...item, invited: true }
          : item
      )
    );
  } catch (err) {
    console.error(err);
    setStatus(err?.response?.data?.error || 'Invite failed');
  }
}

  async function openJoinRequests(room) {
    try {
      setStatus('');
      setShowInvite(false);
      setInviteSearch('');
      setInviteResults([]);

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
    return [...prev, tempMessage];
  });

  window.setTimeout(scrollMessagesToBottom, 0);

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
          ) : rooms.map((room) => {
            const isOwner = room.ownerId === userId || room.createdBy === userId;
            const isPrivateCustom = room.type === 'custom' && room.privacy === 'private';
            const canLeave = isPrivateCustom && !isOwner;
            const canDelete = room.type === 'custom' && isOwner;
            const canViewRequests = isPrivateCustom && isOwner;
            const unreadCount = roomUnreadCounts[room.roomId] || room.unreadCount || 0;

            return (
              <div
                key={room.roomId}
                className={`room-item ${activeRoom?.roomId === room.roomId ? 'active' : ''}`}
                onClick={() => openRoom(room)}
              >
                <div className="room-info">
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

  <span>{activeRoom.name}</span>
</div>
<div className="messages" ref={messagesRef}>
                {messagesLoading ? (
  <p className="empty">Loading messages...</p>
) : messages.length === 0 ? (
  <p className="empty">No messages yet</p>
) : (
  Array.from(
    new Map(
      messages.map((msg, index) => [msg.messageId || msg.clientId || `${msg.createdAt || 'msg'}-${index}`, msg])
    ).values()
  ).map((msg, index) => (
    <div
      key={msg.messageId || msg.clientId || `${msg.createdAt || 'msg'}-${msg.senderId || 'user'}-${index}`}
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
  onFocus={() => {
    window.setTimeout(scrollMessagesToBottom, 120);
  }}
/>

              <button type="submit" disabled={!text.trim() || !activeRoom}>Send</button>
            </form>
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
        inviteResults.map((u) => (
          <div key={u.userId} className="member-row">
            <div>
              <strong>{u.name || u.email || 'User'}</strong>
              {u.email && <small>{u.email}</small>}
            </div>

            <button
              type="button"
              onClick={() => inviteUser(u.userId)}
              className="approve-request-btn"
              disabled={u.invited || !u.userId}
            >
              {u.invited ? 'Request Sent' : 'Send Request'}
            </button>
          </div>
        ))
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
              onClick={() => setShowCreateModal(false)}
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
                onChange={(e) => setNewRoomName(e.target.value)}
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

              <button type="submit" className="approve-request-btn" disabled={creatingRoom || !newRoomName.trim()}>
                {creatingRoom ? 'Creating...' : 'Create Room'}
              </button>
            </form>
          </div>
        </div>
      )}
    </main>
  );
}