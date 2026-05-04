import { useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useSearchParams } from 'react-router-dom';
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
  const [searchParams] = useSearchParams();
  const [isBlocked, setIsBlocked] = useState(false);
  const [query, setQuery] = useState('');
  const [users, setUsers] = useState([]);
  const [chats, setChats] = useState([]);
  const [activeChat, setActiveChat] = useState(null);
  const [messages, setMessages] = useState([]);
  const [text, setText] = useState('');
  const [status, setStatus] = useState('');
  const [mobileChatOpen, setMobileChatOpen] = useState(false);

  const scrollRef = useRef(null);
  const autoStartedRef = useRef(false);
  const touchStartXRef = useRef(0);
  const touchStartYRef = useRef(0);
  const touchEndXRef = useRef(0);

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
    const totalUnread = chats.reduce(
      (sum, chat) => sum + Number(chat.unreadCount || 0),
      0
    );

    window.dispatchEvent(
      new CustomEvent('chat-unread-update', {
        detail: { totalUnread },
      })
    );

    window.dispatchEvent(new Event('chat-unread-refresh'));
  }, [chats]);

  useEffect(() => {
    return () => {
      localStorage.removeItem('activeChatId');
    };
  }, []);

  useEffect(() => {
    if (!userId) return;

    connectChatSocket(userId, (data) => {
      if (data.type !== 'newMessage') return;

      const activeChatId = activeChat?.chatId;

      // If message belongs to currently open chat, do not increase unread
      if (data.message.chatId === activeChatId) {
        // skip unread increment
      } else {
        // Increment unread count for that chat
        setChats((prev) =>
          prev.map((chat) =>
            chat.chatId === data.message.chatId
              ? { ...chat, unreadCount: (chat.unreadCount || 0) + 1 }
              : chat
          )
        );
        window.dispatchEvent(new Event('chat-unread-refresh'));
        // Do not append message if chat not open
        return;
      }

      // Only append message if chat is open
      if (data.message.chatId !== activeChatId) {
        return;
      }

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
      localStorage.removeItem('activeChatId');
      disconnectChatSocket();
    };
  }, [userId, activeChat?.chatId]);

const scrollMessagesToBottom = () => {
  window.requestAnimationFrame(() => {
    if (!scrollRef.current) return;
    scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  });
};

useEffect(() => {
  scrollMessagesToBottom();
}, [messages]);

useEffect(() => {
  if (!activeChat) return undefined;

  const handleViewportResize = () => {
    scrollMessagesToBottom();
  };

  window.visualViewport?.addEventListener('resize', handleViewportResize);
  window.addEventListener('resize', handleViewportResize);

  return () => {
    window.visualViewport?.removeEventListener('resize', handleViewportResize);
    window.removeEventListener('resize', handleViewportResize);
  };
}, [activeChat]);

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

      const fixedChat = {
        ...chat,
        receiverId: chat.receiverId || targetUserId,
        receiverName: chat.receiverName || normalizedUser.name,
        receiverEmail: chat.receiverEmail || normalizedUser.email,
      };

      setActiveChat(fixedChat);
      localStorage.setItem('activeChatId', fixedChat.chatId);
      setIsBlocked(fixedChat?.isBlocked || false);
      setMobileChatOpen(true);

      const data = await chatApi.getMessages(fixedChat.chatId);

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
  localStorage.setItem('activeChatId', chat.chatId);
  setMobileChatOpen(true);
  setStatus('');
  setIsBlocked(chat?.isBlocked || false);
try {
  if (chatApi.markAsRead) {
    await chatApi.markAsRead(chat.chatId);
  }
} catch (e) {
  console.error('Mark as read failed', e);
}
  // check block status from backend
  try {
    const blockStatus = await chatApi.checkBlockStatus(chat.receiverId);
    setIsBlocked(blockStatus?.isBlocked || false);
  } catch (e) {
    console.error('Block status check failed', e);
  }

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

    window.dispatchEvent(new Event('chat-unread-refresh'));
  } catch (err) {
    console.error('Could not load messages:', err);
    setStatus('Could not load messages.');
  }
};

useEffect(() => {
  const chatIdFromUrl = searchParams.get('chatId');

  if (!chatIdFromUrl || chats.length === 0) return;

  const targetChat = chats.find((chat) => chat.chatId === chatIdFromUrl);

  if (targetChat && activeChat?.chatId !== targetChat.chatId) {
    openChat(targetChat);
  }
}, [searchParams, chats, activeChat?.chatId]);

  const startChat = async (selectedUser) => {
    try {
      const chat = await chatApi.startChat(selectedUser);

      setActiveChat(chat);
      localStorage.setItem('activeChatId', chat.chatId);
      setMobileChatOpen(true);
      setUsers([]);
      setQuery('');

      const data = await chatApi.getMessages(chat.chatId);
      setMessages(
        data.map((msg) => ({
          ...msg,
          isMine: msg.senderId === userId,
        }))
      );

      // check block status from backend
      try {
        const blockStatus = await chatApi.checkBlockStatus(chat.receiverId);
        setIsBlocked(blockStatus?.isBlocked || false);
      } catch (e) {
        console.error('Block status check failed', e);
      }

      await loadChats();
    } catch (err) {
      console.error('Could not start chat:', err);
      setStatus('Could not start chat.');
    }
  };

  const sendMessage = async (e) => {
    e.preventDefault();

    if (!text.trim() || !activeChat || isBlocked) return;

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

  try {
    if (isBlocked) {
      await chatApi.unblockUser(activeChat.receiverId);
      setIsBlocked(false);
      setStatus('User unblocked.');
      await loadChats();
      return;
    }

    const confirmBlock = window.confirm(
      `Block ${activeChat.receiverName || activeChat.receiverEmail || 'this user'}?`
    );

    if (!confirmBlock) return;

    await chatApi.blockUser(activeChat.receiverId);
    setIsBlocked(true);
    setStatus('User blocked.');
    setMessages([]);
    await loadChats();
  } catch (err) {
    console.error('Block toggle failed:', err);
    setStatus('Block action failed.');
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

  const handleTouchStart = (event) => {
    if (!mobileChatOpen || !activeChat) return;

    const touch = event.touches?.[0];
    if (!touch) return;

    touchStartXRef.current = touch.clientX;
    touchStartYRef.current = touch.clientY;
    touchEndXRef.current = touch.clientX;
  };

  const handleTouchMove = (event) => {
    if (!mobileChatOpen || !activeChat) return;

    const touch = event.touches?.[0];
    if (!touch) return;

    touchEndXRef.current = touch.clientX;
  };

  const handleTouchEnd = () => {
    if (!mobileChatOpen || !activeChat) return;

    const swipeDistance = touchEndXRef.current - touchStartXRef.current;
    const startedNearLeftEdge = touchStartXRef.current < 70;

    if (startedNearLeftEdge && swipeDistance > 90) {
      setMobileChatOpen(false);
      setActiveChat(null);
      localStorage.removeItem('activeChatId');
      setMessages([]);
    }
  };

  return (
<main className={`chat-page ${mobileChatOpen && activeChat ? 'mobile-chat-open' : ''}`}>
      <section className="chat-sidebar">
        <form className="chat-search" onSubmit={searchUsers}>
          <input
            placeholder="Search users by name or mail..."
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

      <section
        className="chat-window"
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        {!activeChat ? (
          <div className="chat-empty-state">
            <h2>Select a chat</h2>
            <p>Your private messages will appear here.</p>
          </div>
        ) : (
          <>
            <div className="chat-window-top">
              <button
                type="button"
                className="mobile-chat-back-btn"
                onClick={() => {
                  setMobileChatOpen(false);
                  setActiveChat(null);
                  localStorage.removeItem('activeChatId');
                  setMessages([]);
                }}
              >
                ←
              </button>
              <div className="chat-info">
                <h2>{activeChat.receiverName || activeChat.receiverEmail || 'Chat'}</h2>
                {status && <span className="status-msg">{status}</span>}
              </div>

              <div className="chat-actions">
                <button className="btn-report" type="button" onClick={handleReportUser}>
                  Report
                </button>
                <button className="btn-block" type="button" onClick={handleBlockUser}>
                  {isBlocked ? 'Unblock' : 'Block'}
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

              {isBlocked && (

                <div className="blocked-banner">

                  You blocked this user. Unblock them to send messages.

                </div>

              )}

              <form className="message-form" onSubmit={sendMessage}>
<input
  placeholder={isBlocked ? 'Unblock this user to send messages' : 'Type a message...'}
  value={text}
  onChange={(e) => {
    setText(e.target.value);
    scrollMessagesToBottom();
  }}
  onFocus={() => {
    setTimeout(scrollMessagesToBottom, 120);
    setTimeout(scrollMessagesToBottom, 320);
  }}
  disabled={isBlocked}
/>
              <button type="submit" disabled={isBlocked}>
                Send
              </button>
            </form>
          </>
        )}
      </section>
    </main>
  );
}