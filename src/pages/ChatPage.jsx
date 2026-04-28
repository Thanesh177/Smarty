import { useEffect, useMemo, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { chatApi } from '../api/client';
import { useAuth } from '../contexts/AuthContext';
import {
  connectChatSocket,
  disconnectChatSocket,
  sendChatMessage,
} from '../api/chatSocket';
import './ChatPage.css';

function getDayLabel(timestamp) {
  const date = new Date(Number(timestamp));
  const today = new Date();
  const yesterday = new Date();

  yesterday.setDate(today.getDate() - 1);

  if (date.toDateString() === today.toDateString()) return 'Today';
  if (date.toDateString() === yesterday.toDateString()) return 'Yesterday';

  return date.toLocaleDateString(undefined, {
    weekday: 'long',
    month: 'short',
    day: 'numeric',
  });
}

export default function ChatPage() {
  const { user } = useAuth();
  const location = useLocation();

  const [query, setQuery] = useState('');
  const [users, setUsers] = useState([]);
  const [chats, setChats] = useState([]);
  const [activeChat, setActiveChat] = useState(null);
  const [messages, setMessages] = useState([]);
  const [text, setText] = useState('');
  const [status, setStatus] = useState('');

  const scrollRef = useRef(null);
  const autoStartedRef = useRef(false);

  const userId = user?.id || user?.userId || user?.sub;

  const loadChats = async () => {
    try {
      const data = await chatApi.getChats();
      setChats(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error('Failed to load chats:', err);
    }
  };

  useEffect(() => {
    if (userId) loadChats();
  }, [userId]);

  useEffect(() => {
    if (!userId) return;

    connectChatSocket(userId, (data) => {
      if (data.type !== 'newMessage') return;

      const msg = data.message;

      setMessages((prev) => {
        if (prev.find((m) => m.messageId === msg.messageId)) return prev;

        return [
          ...prev,
          {
            ...msg,
            isMine: msg.senderId === userId,
          },
        ];
      });

      loadChats();
    });

    return () => {
      disconnectChatSocket();
    };
  }, [userId]);

  useEffect(() => {
    if (!scrollRef.current) return;
    scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages]);

useEffect(() => {
  const startWithUser = location.state?.startWithUser;

  if (!userId || !startWithUser || autoStartedRef.current) return;

  const targetUserId =
    startWithUser.userId || startWithUser.id || startWithUser.sub;

  if (!targetUserId) {
    setStatus('Could not open chat. Missing user ID.');
    return;
  }

  autoStartedRef.current = true;

  const autoStart = async () => {
    try {
      const normalizedUser = {
        userId: targetUserId,
        id: targetUserId,
        sub: targetUserId,
        email: startWithUser.email || '',
        username: startWithUser.username || startWithUser.email || '',
        name: startWithUser.name || startWithUser.email || 'User',
      };

      const chat = await chatApi.startChat(normalizedUser);
      setActiveChat(chat);

      const data = await chatApi.getMessages(chat.chatId);
      setMessages(
        data.map((msg) => ({
          ...msg,
          isMine: msg.senderId === userId,
        }))
      );

      await loadChats();
    } catch (err) {
      console.error('Auto start chat failed:', err);
      setStatus('Could not open chat with this user.');
    }
  };

  autoStart();
}, [location.state, userId]);

  const groupedMessages = useMemo(() => {
    const groups = {};

    messages.forEach((msg) => {
      const label = getDayLabel(msg.createdAt);
      if (!groups[label]) groups[label] = [];
      groups[label].push(msg);
    });

    return Object.keys(groups).map((label) => ({
      label,
      messages: groups[label],
    }));
  }, [messages]);

  const searchUsers = async (e) => {
    e.preventDefault();
    setStatus('');

    if (!query.trim()) return;

    try {
      const data = await chatApi.searchUsers(query.trim());
      setUsers(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error('User search failed:', err);
      setStatus('User search failed.');
    }
  };

  const openChat = async (chat) => {
    setActiveChat(chat);
    setStatus('');

    try {
      const data = await chatApi.getMessages(chat.chatId);

      setMessages(
        data.map((msg) => ({
          ...msg,
          isMine: msg.senderId === userId,
        }))
      );

      setChats((prev) =>
        prev.map((item) =>
          item.chatId === chat.chatId ? { ...item, unreadCount: 0 } : item
        )
      );
    } catch (err) {
      console.error('Could not load messages:', err);
      setStatus('Could not load messages.');
    }
  };

  const startChat = async (selectedUser) => {
    try {
      const chat = await chatApi.startChat(selectedUser);

      setActiveChat(chat);
      setUsers([]);
      setQuery('');

      const data = await chatApi.getMessages(chat.chatId);
      setMessages(
        data.map((msg) => ({
          ...msg,
          isMine: msg.senderId === userId,
        }))
      );

      await loadChats();
    } catch (err) {
      console.error('Could not start chat:', err);
      setStatus('Could not start chat.');
    }
  };

  const sendMessage = async (e) => {
    e.preventDefault();

    if (!text.trim() || !activeChat) return;

    try {
      sendChatMessage({
        chatId: activeChat.chatId,
        receiverId: activeChat.receiverId,
        text: text.trim(),
      });

      setText('');
    } catch (err) {
      console.error('Message send failed:', err);
      setStatus(err.message || 'Message failed.');
    }
  };

  const handleBlockUser = async () => {
    if (!activeChat) return;

    const confirmBlock = window.confirm(
      `Block ${activeChat.receiverName || activeChat.receiverEmail || 'this user'}?`
    );

    if (!confirmBlock) return;

    try {
      await chatApi.blockUser(activeChat.receiverId);
      setStatus('User blocked.');
      setActiveChat(null);
      setMessages([]);
      await loadChats();
    } catch (err) {
      console.error('Failed to block user:', err);
      setStatus('Failed to block user.');
    }
  };

  const handleReportUser = async () => {
    if (!activeChat) return;

    const reason = window.prompt('Reason for reporting:');

    if (!reason?.trim()) return;

    try {
      await chatApi.reportUser({
        reportedUserId: activeChat.receiverId,
        chatId: activeChat.chatId,
        reason: reason.trim(),
      });

      setStatus('Report submitted.');
    } catch (err) {
      console.error('Failed to submit report:', err);
      setStatus('Failed to submit report.');
    }
  };

  return (
    <main className="chat-page">
      <section className="chat-sidebar">
        <div className="chat-header">
          <h1>Private Chat</h1>
          <p>Search users and start secure private conversations.</p>
        </div>

        <form className="chat-search" onSubmit={searchUsers}>
          <input
            placeholder="Search users..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          <button type="submit">Search</button>
        </form>

        {status && <p className="chat-status">{status}</p>}

        {users.length > 0 && (
          <div className="user-results">
            <h3>Users</h3>

            {users.map((selectedUser) => (
              <button
                key={selectedUser.userId || selectedUser.id || selectedUser.email}
                type="button"
                onClick={() => startChat(selectedUser)}
              >
                <strong>{selectedUser.name || selectedUser.username || 'User'}</strong>
                <span>{selectedUser.email || selectedUser.username}</span>
              </button>
            ))}
          </div>
        )}

        <div className="chat-list">
          <h3>Your chats</h3>

          {chats.length === 0 ? (
            <p className="empty-chat">No chats yet.</p>
          ) : (
            chats.map((chat) => (
              <button
                key={chat.chatId}
                type="button"
                className={activeChat?.chatId === chat.chatId ? 'active' : ''}
                onClick={() => openChat(chat)}
              >
                <strong>{chat.receiverName || chat.receiverEmail || 'User'}</strong>

                <div className="chat-preview">
                  <span>{chat.lastMessage || 'Open conversation'}</span>
                  {Number(chat.unreadCount) > 0 && (
                    <span className="unread-badge">{chat.unreadCount}</span>
                  )}
                </div>
              </button>
            ))
          )}
        </div>
      </section>

      <section className="chat-window">
        {!activeChat ? (
          <div className="chat-empty-state">
            <h2>Select a chat</h2>
            <p>Your private messages will appear here.</p>
          </div>
        ) : (
          <>
            <div className="chat-window-top">
              <div className="chat-info">
                <h2>{activeChat.receiverName || activeChat.receiverEmail || 'Chat'}</h2>
                {status && <span className="status-msg">{status}</span>}
              </div>

              <div className="chat-actions">
                <button className="btn-report" type="button" onClick={handleReportUser}>
                  Report
                </button>
                <button className="btn-block" type="button" onClick={handleBlockUser}>
                  Block
                </button>
              </div>
            </div>

            <div className="messages" ref={scrollRef}>
              {groupedMessages.length === 0 ? (
                <p className="empty-chat">No messages yet. Say hello.</p>
              ) : (
                groupedMessages.map((group) => (
                  <div key={group.label}>
                    <div className="date-divider">
                      <span>{group.label}</span>
                    </div>

                    {group.messages.map((msg) => (
                      <div
                        key={msg.messageId || msg.id}
                        className={msg.isMine ? 'message mine' : 'message'}
                      >
                        <p>{msg.text || msg.message}</p>
                        <span className="timestamp">
                          {msg.createdAt
                            ? new Date(Number(msg.createdAt)).toLocaleTimeString([], {
                                hour: '2-digit',
                                minute: '2-digit',
                              })
                            : ''}
                        </span>
                      </div>
                    ))}
                  </div>
                ))
              )}
            </div>

            <form className="message-form" onSubmit={sendMessage}>
              <input
                placeholder="Type a message..."
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