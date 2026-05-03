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
const [hiddenRooms, setHiddenRooms] = useState([]);
const [showHidden, setShowHidden] = useState(false);
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

  async function loadRooms(searchValue = roomSearch) {
    try {
      setStatus('');

      const data = await roomApi.getRooms({
        search: searchValue.trim(),
      });

      const allRooms = data.rooms || data || [];
      // Always include rooms created by the user
      const visibleRooms = allRooms.filter((room) => {
        const isOwner = room.ownerId === userId || room.createdBy === userId;

        if (isOwner) return true;

        // For others, apply search filter if present
        if (!searchValue) return true;

        return (room.name || '').toLowerCase().includes(searchValue.toLowerCase());
      });

      // Sort: user's rooms first, then by latest created
      visibleRooms.sort((a, b) => {
        const aOwner = a.ownerId === userId || a.createdBy === userId;
        const bOwner = b.ownerId === userId || b.createdBy === userId;

        if (aOwner && !bOwner) return -1;
        if (!aOwner && bOwner) return 1;

        return (b.createdAt || 0) - (a.createdAt || 0);
      });

      setRooms(visibleRooms);
    } catch (err) {
      console.error(err);
      setStatus('Failed to load rooms');
    }
  }

  useEffect(() => {
    loadRooms('');
  }, []);

  useEffect(() => {
    if (!userId) return;

    connectChatSocket(userId, (data) => {
      const msg = data.message;
      const current = activeRoomRef.current;

      if (!msg) return;

      // Handle ACK separately (only replace temp message)
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
    copy[index] = msg;
    return copy;
  });

  return;
}

      // Handle real incoming message
      if (data.type !== 'roomMessage') return;
      if (msg.senderId === userId && msg.clientId) {
  return;
}

      if (!current || msg.roomId !== current.roomId) {
        if (msg.senderId !== userId) {
          setRoomUnreadCounts((prev) => ({
            ...prev,
            [msg.roomId]: Number(prev[msg.roomId] || 0) + 1,
          }));
        }
        return;
      }

      setMessages((prev) => {
        // prevent duplicates
        const exists = prev.some((m) => m.messageId === msg.messageId);
        if (exists) return prev;

        return [...prev, msg];
      });
    });
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

      const parsedData = typeof data === 'string' ? JSON.parse(data) : data;
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
      setRoomUnreadCounts((prev) => ({
        ...prev,
        [createdRoom.roomId]: 0,
      }));

      try {
        const messageData = await roomApi.getRoomMessages(createdRoom.roomId);
        setMessages(messageData.messages || messageData || []);
      } catch (messageErr) {
        console.error('Could not load new room messages:', messageErr);
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
    const data = await roomApi.getHiddenRooms();
    setHiddenRooms(data);
    setShowHidden(true);
  } catch (err) {
    console.error(err);
    setStatus('Could not load hidden rooms');
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

  async function openRoom(room) {
    const isOwner = room.ownerId === userId || room.createdBy === userId;
    const isPrivate = room.privacy === 'private';

    try {
      setStatus('');

      if (isPrivate && !isOwner) {
        const data = await roomApi.requestJoinRoom(room.roomId);
        setStatus(data.message || 'Join request sent to creator');
        return;
      }

      await roomApi.joinRoom(room.roomId);

      setActiveRoom(room);
      activeRoomRef.current = room;
      setMessages([]);
      setMobileChatOpen(true);
      setRoomUnreadCounts((prev) => ({
        ...prev,
        [room.roomId]: 0,
      }));

      try {
        const data = await roomApi.getRoomMessages(room.roomId);
        setMessages(data.messages || data || []);
      } catch (messageErr) {
        console.error('Could not load room messages:', messageErr);
        setStatus('Room opened, but old messages could not load.');
      }
    } catch (err) {
      console.error(err);
      setStatus(err?.response?.data?.error || 'Could not open room');
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

  try {
    setStatus('');

    const data = await roomApi.inviteUserToRoom(
      modalRoom.roomId,
      userIdToInvite
    );

    setStatus(data.message || 'User invited successfully');

    setInviteResults((prev) =>
      prev.map((item) =>
        item.userId === userIdToInvite
          ? { ...item, invited: true }
          : item
      )
    );

    await openMembers(modalRoom);
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

    try {
      setStatus('');

      await roomApi.leaveRoom(room.roomId);
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
      setStatus(err?.response?.data?.error || 'Could not leave room');
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
  if (!cleanText || !activeRoom) return;

  const clientId = `temp-${Date.now()}`;

  const tempMessage = {
    messageId: clientId,
    clientId,
    roomId: activeRoom.roomId,
    senderId: userId,
    senderName: user?.name || user?.email || 'You',
    text: cleanText,
    createdAt: Date.now(),
  };

  setMessages((prev) => [...prev, tempMessage]);

  try {
    sendRoomMessage({
      action: 'sendRoomMessage',
      roomId: activeRoom.roomId,
      text: cleanText,
      clientId,
    });

    setText('');
  } catch (err) {
    console.error(err);
    setStatus('Failed to send message');
  }
}

  return (
<main className={`rooms-page ${mobileChatOpen && activeRoom ? 'mobile-chat-open' : ''}`}>      <aside className="sidebar">
        <h2>Rooms</h2>

        <button
          type="button"
          className="create-room-btn"
          onClick={() => setShowCreateModal(true)}
        >
          ➕ Create Room
        </button>

        {status && <p className="room-status">{status}</p>}

        <input
          className="room-search"
          placeholder="Search rooms by name..."
          value={roomSearch}
          onChange={(e) => setRoomSearch(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') loadRooms(e.currentTarget.value);
          }}
        />

        <button type="button" className="hidden-rooms-btn" onClick={openHiddenRooms}>
  Hidden Groups
</button>

        <div className="room-list">
          {rooms.map((room) => {
            const isOwner = room.ownerId === userId || room.createdBy === userId;
            const isPrivateCustom = room.type === 'custom' && room.privacy === 'private';
            const canLeave = isPrivateCustom && !isOwner;
            const canDelete = room.type === 'custom' && isOwner;
            const canViewRequests = isPrivateCustom && isOwner;
            const unreadCount = Number(roomUnreadCounts[room.roomId] || room.unreadCount || 0);

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
                  <span>{room.privacy === 'private' ? '🔒 Private' : '🌍 Public'}</span>

                  <div className="room-actions">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        openMembers(room);
                      }}
                    >
                      Members
                    </button>

                    {canViewRequests && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
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
                          e.stopPropagation();
                          leaveRoom(room);
                        }}
                      >
                        Leave
                      </button>
                    )}

                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        hideRoom(room);
                      }}
                    >
                      Hide
                    </button>
                  </div>
                </div>

                {canDelete && (
                  <button
                    type="button"
                    className="delete-room-btn"
                    aria-label={`Delete ${room.name}`}
                    onClick={(e) => {
                      e.stopPropagation();
                      deleteRoom(room);
                    }}
                  >
                    ✕
                  </button>
                )}
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
            <div className="messages">
              {messages.length === 0 ? (
  <p className="empty">No messages yet</p>
) : (
  Array.from(
    new Map(
      messages.map((msg) => [msg.messageId || msg.clientId, msg])
    ).values()
  ).map((msg) => (
    <div
      key={msg.messageId || msg.clientId}
      className={msg.senderId === userId ? 'msg mine' : 'msg'}
    >
      <b>{msg.senderName || 'User'}</b>
      <p>{msg.text}</p>
    </div>
  ))
)}
            </div>

            <form className="input" onSubmit={sendMessage}>
              <input
                placeholder="Type message..."
                value={text}
                onChange={(e) => setText(e.target.value)}
              />

              <button type="submit">Send</button>
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
  ➕ Invite Users
</button>

{showInvite && (
  <div className="invite-box">
    <div className="invite-search-row">
      <input
        placeholder="Search users by email or ID..."
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
        <p className="member-empty">Search for users by email or user ID.</p>
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
              disabled={u.invited}
            >
              {u.invited ? 'Invited' : 'Invite'}
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
              />

              <select
                value={newRoomPrivacy}
                onChange={(e) => setNewRoomPrivacy(e.target.value)}
              >
                <option value="public">🌍 Public Room</option>
                <option value="private">🔒 Private Room</option>
              </select>

              <button type="submit" className="approve-request-btn" disabled={creatingRoom}>
                Create Room
              </button>
            </form>
          </div>
        </div>
      )}
    </main>
  );
}