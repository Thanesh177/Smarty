import { useEffect, useRef, useState } from 'react';
import { roomApi } from '../api/client';
import { useAuth } from '../contexts/AuthContext';
import { connectChatSocket, sendRoomMessage } from '../api/chatSocket';
import './TopicRoomsPage.css';

export default function TopicRoomsPage() {
  const { user } = useAuth();
  const userId = user?.id || user?.userId || user?.sub;

  const activeRoomRef = useRef(null);

  const [rooms, setRooms] = useState([]);
  const [activeRoom, setActiveRoom] = useState(null);
  const [messages, setMessages] = useState([]);
  const [text, setText] = useState('');
  const [newRoomName, setNewRoomName] = useState('');
  const [status, setStatus] = useState('');

  useEffect(() => {
    activeRoomRef.current = activeRoom;
  }, [activeRoom]);

  const loadRooms = async () => {
    try {
      const data = await roomApi.getRooms();
      setRooms(data);
    } catch (err) {
      console.error(err);
      setStatus('Could not load rooms.');
    }
  };

  useEffect(() => {
    loadRooms();
  }, []);

  useEffect(() => {
    if (!userId) return;

    connectChatSocket(userId, (data) => {
      if (data.type !== 'roomMessage') return;

      const msg = data.message;
      const currentRoom = activeRoomRef.current;

      if (currentRoom?.roomId && msg.roomId !== currentRoom.roomId) return;

      setMessages((prev) => {
        if (prev.find((m) => m.messageId === msg.messageId)) return prev;
        return [...prev, msg];
      });
    });
  }, [userId]);

  const openRoom = async (room) => {
    try {
      setStatus('');
      setActiveRoom(room);
      activeRoomRef.current = room;

      await roomApi.joinRoom(room.roomId);

      const data = await roomApi.getRoomMessages(room.roomId);
      setMessages(data);
    } catch (err) {
      console.error(err);
      setStatus('Could not open room.');
    }
  };

  const createRoom = async (e) => {
    e.preventDefault();

    if (!newRoomName.trim()) return;

    try {
      const room = await roomApi.createRoom({
        name: newRoomName.trim(),
      });

      setNewRoomName('');
      await loadRooms();
      await openRoom(room);
    } catch (err) {
      console.error(err);
      setStatus('Could not create room.');
    }
  };

  const submitMessage = (e) => {
    e.preventDefault();

    if (!text.trim() || !activeRoom) return;

    try {
      sendRoomMessage({
        roomId: activeRoom.roomId,
        text: text.trim(),
      });

      setText('');
      setStatus('');
    } catch (err) {
      console.error(err);
      setStatus('WebSocket still connecting. Try again in 1 second.');
    }
  };

  return (
    <main className="topic-rooms-page">
      <aside className="rooms-sidebar">
        <div className="rooms-header">
          <h1>Topic Rooms</h1>
          <p>Join public topic chats or create your own group.</p>
        </div>

        <form className="create-room-form" onSubmit={createRoom}>
          <input
            placeholder="Create group chat..."
            value={newRoomName}
            onChange={(e) => setNewRoomName(e.target.value)}
          />
          <button type="submit">Create</button>
        </form>

        {status && <p className="room-status">{status}</p>}

        <div className="rooms-list">
          {rooms.map((room) => (
            <button
              key={room.roomId}
              type="button"
              className={activeRoom?.roomId === room.roomId ? 'active' : ''}
              onClick={() => openRoom(room)}
            >
              <strong>{room.name}</strong>
              <span>{room.type === 'custom' ? 'Group chat' : 'Topic room'}</span>
            </button>
          ))}
        </div>
      </aside>

      <section className="room-chat-window">
        {!activeRoom ? (
          <div className="room-empty">
            <h2>Select a room</h2>
            <p>Discuss topics with everyone in real time.</p>
          </div>
        ) : (
          <>
            <div className="room-top">
              <h2>{activeRoom.name}</h2>
              <p>
                {activeRoom.type === 'custom'
                  ? 'Custom group chat'
                  : 'Public topic discussion'}
              </p>
            </div>

            <div className="room-messages">
              {messages.length === 0 ? (
                <p className="room-empty-text">No messages yet. Start the discussion.</p>
              ) : (
                messages.map((msg) => (
                  <div
                    key={msg.messageId}
                    className={msg.senderId === userId ? 'room-message mine' : 'room-message'}
                  >
                    <strong>{msg.senderName || 'User'}</strong>
                    <p>{msg.text}</p>
                    <span>
                      {msg.createdAt
                        ? new Date(Number(msg.createdAt)).toLocaleTimeString([], {
                            hour: '2-digit',
                            minute: '2-digit',
                          })
                        : ''}
                    </span>
                  </div>
                ))
              )}
            </div>

            <form className="room-message-form" onSubmit={submitMessage}>
              <input
                placeholder={`Message ${activeRoom.name}...`}
                value={text}
                onChange={(e) => setText(e.target.value)}
              />
              <button type="submit">Send</button>
            </form>
          </>
        )}
      </section>
    </main>
  );
}