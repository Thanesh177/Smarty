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
  const [activeRoom, setActiveRoom] = useState(null);
  const [messages, setMessages] = useState([]);
  const [text, setText] = useState('');

  const [newRoomName, setNewRoomName] = useState('');
  const [newRoomPrivacy, setNewRoomPrivacy] = useState('public');

  const [roomSearch, setRoomSearch] = useState('');
  const [modalTitle, setModalTitle] = useState('Group Members');
  const [modalMode, setModalMode] = useState('members');
  const [modalRoom, setModalRoom] = useState(null);
  const [members, setMembers] = useState([]);
  const [showMembers, setShowMembers] = useState(false);

  const [status, setStatus] = useState('');

  useEffect(() => {
    activeRoomRef.current = activeRoom;
  }, [activeRoom]);

  async function loadRooms(searchValue = roomSearch) {
    try {
      setStatus('');

      const data = await roomApi.getRooms({
        search: searchValue.trim(),
      });

      setRooms(data.rooms || data || []);
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
      if (data.type !== 'roomMessage') return;

      const msg = data.message;
      const current = activeRoomRef.current;

      if (!current || msg.roomId !== current.roomId) return;

      setMessages((prev) => {
        if (prev.find((m) => m.messageId === msg.messageId)) return prev;
        return [...prev, msg];
      });
    });
  }, [userId]);

  async function createRoom(e) {
    e.preventDefault();

    const name = newRoomName.trim();
    if (!name) return;

    try {
      setStatus('');

      const room = await roomApi.createRoom({
        name,
        privacy: newRoomPrivacy,
      });

      setNewRoomName('');
      setNewRoomPrivacy('public');

      await loadRooms();
      await openRoom(room);
    } catch (err) {
      console.error(err);
      setStatus(err?.response?.data?.error || 'Failed to create room');
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

  async function openJoinRequests(room) {
    try {
      setStatus('');

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

    try {
      sendRoomMessage({
        action: 'sendRoomMessage',
        roomId: activeRoom.roomId,
        text: cleanText,
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

        <form onSubmit={createRoom} className="create-form">
          <input
            placeholder="Create room..."
            value={newRoomName}
            onChange={(e) => setNewRoomName(e.target.value)}
          />

          <select
            value={newRoomPrivacy}
            onChange={(e) => setNewRoomPrivacy(e.target.value)}
          >
            <option value="public">🌍 Public</option>
            <option value="private">🔒 Private</option>
          </select>

          <button type="submit">Create</button>
        </form>

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

            return (
              <div
                key={room.roomId}
                className={`room-item ${activeRoom?.roomId === room.roomId ? 'active' : ''}`}
                onClick={() => openRoom(room)}
              >
                <div className="room-info">
                  <strong>{room.name}</strong>
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
                messages.map((msg) => (
                  <div
                    key={msg.messageId}
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
    </main>
  );
}