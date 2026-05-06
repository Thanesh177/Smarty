import { memo, useEffect, useMemo, useRef, useState, useCallback } from 'react';
import { useLocation, useSearchParams } from 'react-router-dom';
import { chatApi } from '../api/client';
import { useAuth } from '../contexts/AuthContext';
import {
  connectChatSocket,
  disconnectChatSocket,
  sendChatMessage,
} from '../api/chatSocket';

import './ChatPage.css';

const CHAT_FALLBACK_AVATARS = [
  { id: 'sky', emoji: '🦋', label: 'Sky' },
  { id: 'spark', emoji: '✨', label: 'Spark' },
  { id: 'leaf', emoji: '🌿', label: 'Leaf' },
  { id: 'moon', emoji: '🌙', label: 'Moon' },
  { id: 'star', emoji: '⭐', label: 'Star' },
  { id: 'fire', emoji: '🔥', label: 'Fire' },
  { id: 'wave', emoji: '🌊', label: 'Wave' },
  { id: 'fox', emoji: '🦊', label: 'Fox' },
];

const CHAT_AVATAR_STORAGE_KEY = 'smarty-chat-avatar-choices';

function getUserDisplayName(person) {
  const candidates = [
    person?.username,
    person?.userName,
    person?.displayName,
    person?.name,
    person?.receiverUsername,
    person?.receiverName,
  ];

  const realName = candidates
    .map((value) => String(value || '').trim())
    .find((value) => value && !value.includes('@') && !(value.includes('-') && value.length > 20));

  if (realName) return realName;

  const email = String(person?.email || person?.receiverEmail || '').trim();
  if (email.includes('@')) return email.split('@')[0];

  return 'User';

}

function getChatAvatarSeed(chat) {
  return String(
    chat?.receiverId ||
    chat?.userId ||
    chat?.id ||
    chat?.receiverEmail ||
    chat?.receiverUsername ||
    chat?.chatId ||
    'chat'
  );
}

function getStoredAvatarChoices() {
  try {
    const raw = localStorage.getItem(CHAT_AVATAR_STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : {};
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

function saveStoredAvatarChoices(nextChoices) {
  try {
    localStorage.setItem(CHAT_AVATAR_STORAGE_KEY, JSON.stringify(nextChoices || {}));
  } catch {
    // Ignore private browsing/storage errors.
  }
}

function getDefaultAvatarId(chat) {
  const seed = getChatAvatarSeed(chat);
  const total = seed.split('').reduce((sum, char) => sum + char.charCodeAt(0), 0);
  return CHAT_FALLBACK_AVATARS[total % CHAT_FALLBACK_AVATARS.length]?.id || CHAT_FALLBACK_AVATARS[0].id;
}

function getAvatarOptionById(avatarId) {
  return CHAT_FALLBACK_AVATARS.find((avatar) => avatar.id === avatarId) || CHAT_FALLBACK_AVATARS[0];
}

function getChatRealAvatar(chat) {
  return (
    chat?.receiverAvatar ||
    chat?.receiverPhoto ||
    chat?.receiverImage ||
    chat?.profilePicture ||
    chat?.photoURL ||
    ''
  );
}


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


function getMediaKind(msg) {
  const type = String(msg?.mediaType || '').toLowerCase();
  const name = String(msg?.mediaName || '').toLowerCase();
  const source = String(msg?.mediaName || msg?.mediaUrl || msg?.mediaPreview || '').toLowerCase();

  const looksLikeVoiceNote =
    name.startsWith('voice-') ||
    name.includes('voice') ||
    type.startsWith('audio/');

  if (
    looksLikeVoiceNote ||
    type.startsWith('audio/') ||
    /\.(mp3|wav|m4a|aac|oga|opus)(\?|#|$)/i.test(source)
  ) {
    return 'audio';
  }

  if (type.startsWith('image/') || /\.(png|jpe?g|webp|gif|avif|bmp|svg)(\?|#|$)/i.test(source)) {
    return 'image';
  }

  if (type.startsWith('video/') || /\.(mp4|mov|m4v|ogv)(\?|#|$)/i.test(source)) {
    return 'video';
  }

  if (/\.(webm|ogg)(\?|#|$)/i.test(source)) {
    return looksLikeVoiceNote ? 'audio' : 'video';
  }

  return 'file';
}

function formatAudioTime(seconds) {
  if (!Number.isFinite(seconds) || seconds <= 0) return '0:00';

  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${String(secs).padStart(2, '0')}`;
}

const AudioMiniPlayer = memo(function AudioMiniPlayer({ src, title = 'Voice note', onError }) {
  const audioRef = useRef(null);
  const [playing, setPlaying] = useState(false);
  const [duration, setDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);

  const togglePlay = async () => {
    const audio = audioRef.current;
    if (!audio) return;

    try {
      if (audio.paused) await audio.play();
      else audio.pause();
    } catch (err) {
      console.error('Audio play failed:', err);
    }
  };

  return (
    <div className="audio-mini-card" title={title}>
      <button type="button" className="audio-mini-play" onClick={togglePlay}>
        {playing ? '❚❚' : '▶'}
      </button>

      <div className={playing ? 'audio-mini-wave playing' : 'audio-mini-wave'}>
        {Array.from({ length: 18 }).map((_, index) => (
          <span key={index} />
        ))}
      </div>

      <span className="audio-mini-time">
        {playing ? formatAudioTime(currentTime) : formatAudioTime(duration)}
      </span>

      <audio
        ref={audioRef}
        src={src}
        preload="metadata"
        controls={false}
        style={{ display: 'none' }}
        onLoadedMetadata={(e) => setDuration(e.currentTarget.duration || 0)}
        onTimeUpdate={(e) => setCurrentTime(e.currentTarget.currentTime || 0)}
        onEnded={() => {
          setPlaying(false);
          setCurrentTime(0);
        }}
        onPause={() => setPlaying(false)}
        onPlay={() => setPlaying(true)}
        onError={onError}
      />
    </div>
  );
});

// ===== ChatMediaPreview component =====
const ChatMediaPreview = memo(function ChatMediaPreview({ msg, onRefreshMediaUrl }) {
  const [mediaSource, setMediaSource] = useState(msg.mediaUrl || msg.mediaPreview || '');
  const [refreshing, setRefreshing] = useState(false);
  const [failed, setFailed] = useState(false);
  const mediaKind = getMediaKind(msg);

  useEffect(() => {
    const nextSource = msg.mediaUrl || msg.mediaPreview || '';
    setMediaSource(nextSource);
    setFailed(false);

    if (!nextSource && msg.mediaKey) {
      refreshMedia();
    }
  }, [msg.mediaUrl, msg.mediaPreview, msg.mediaKey]);

  const refreshMedia = async () => {
    if (!msg.mediaKey || refreshing) {
      setFailed(true);
      return;
    }

    try {
      setRefreshing(true);
      const freshUrl = await onRefreshMediaUrl(msg);

      if (!freshUrl) {
        setFailed(true);
        return;
      }

      setMediaSource(freshUrl);
      setFailed(false);
    } catch (err) {
      console.error('Media URL refresh failed:', err);
      setFailed(true);
    } finally {
      setRefreshing(false);
    }
  };

  if (!mediaSource && msg.mediaKey) {
    return (
      <div className="message-media-preview media-fallback">
        <span>{refreshing ? 'Loading preview...' : msg.mediaName || 'Loading attachment...'}</span>
        <button type="button" onClick={refreshMedia} disabled={refreshing}>
          {refreshing ? 'Loading...' : 'Load preview'}
        </button>
      </div>
    );
  }

  if (!mediaSource) return null;

  if (failed) {
    return (
      <div className="message-media-preview media-fallback">
        <span>{msg.mediaName || 'Attachment preview unavailable'}</span>
        <button type="button" onClick={refreshMedia} disabled={refreshing || !msg.mediaKey}>
          {refreshing ? 'Refreshing...' : 'Retry preview'}
        </button>
      </div>
    );
  }

  return (
    <div className="message-media-preview">
      {mediaKind === 'image' ? (
        <img
          src={mediaSource}
          alt={msg.mediaName || 'Shared media'}
          loading="lazy"
          decoding="async"
          onError={refreshMedia}
        />
      ) : mediaKind === 'video' ? (
        <video src={mediaSource} controls playsInline preload="metadata" onError={refreshMedia} />
      ) : mediaKind === 'audio' ? (
        <AudioMiniPlayer
          src={mediaSource}
          title={msg.mediaName || 'Voice note'}
          onError={refreshMedia}
        />
      ) : (
        <a href={mediaSource} target="_blank" rel="noreferrer">
          {msg.mediaName || 'Open attachment'}
        </a>
      )}
    </div>
  );
});

export default function ChatPage() {
  const [isRecording, setIsRecording] = useState(false);
  const [mediaRecorder, setMediaRecorder] = useState(null);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const audioChunksRef = useRef([]);
  const recordingTimerRef = useRef(null);
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
  const [showComposerTools, setShowComposerTools] = useState(false);
  const [selectedMedia, setSelectedMedia] = useState(null);
  const [selectedMediaPreview, setSelectedMediaPreview] = useState('');
  const [status, setStatus] = useState('');
  const [mobileChatOpen, setMobileChatOpen] = useState(false);
  const [actionsOpen, setActionsOpen] = useState(false);
  const [openReactionMenuId, setOpenReactionMenuId] = useState(null);
  const [editingMessageId, setEditingMessageId] = useState(null);
  const [editingText, setEditingText] = useState('');
  const scrollRef = useRef(null);
  const searchAreaRef = useRef(null);
  const autoStartedRef = useRef(false);
  const touchStartXRef = useRef(0);
  const touchStartYRef = useRef(0);
  const touchEndXRef = useRef(0);
  const mediaInputRef = useRef(null);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [isUploading, setIsUploading] = useState(false);

  // Avatar fallback state
  const [avatarChoices, setAvatarChoices] = useState(() => getStoredAvatarChoices());
  const [avatarPickerChatId, setAvatarPickerChatId] = useState('');

  const mountedRef = useRef(true);
  const activeChatIdRef = useRef(null);
  const scrollRafRef = useRef(null);
  const scrollTimerRef = useRef(null);
  const chatRequestSeqRef = useRef(0);
  const searchRequestSeqRef = useRef(0);
  const openedChatIdsRef = useRef(new Set());
  const activeUploadAbortRef = useRef(null);
  const uploadResetTimerRef = useRef(null);
  const cancelRecordingRef = useRef(false);
  const messagePollTimerRef = useRef(null);
  const messageCacheRef = useRef(new Map());
  const lastChatsLoadRef = useRef(0);

  const userId = useMemo(
    () => user?.id || user?.userId || user?.sub,
    [user]
  );

  // ====== Avatar fallback helpers ======
  const getFallbackAvatarForChat = (chat) => {
    const chatId = chat?.chatId || getChatAvatarSeed(chat);
    const avatarId = avatarChoices[chatId] || getDefaultAvatarId(chat);
    return getAvatarOptionById(avatarId);
  };

  const chooseFallbackAvatar = (chat, avatarId) => {
    const chatId = chat?.chatId;
    if (!chatId) return;

    setAvatarChoices((prev) => {
      const nextChoices = {
        ...prev,
        [chatId]: avatarId,
      };

      saveStoredAvatarChoices(nextChoices);
      return nextChoices;
    });

    setAvatarPickerChatId('');
  };

  const toggleAvatarPicker = (event, chat) => {
    event.preventDefault();
    event.stopPropagation();

    if (getChatRealAvatar(chat)) return;

    setAvatarPickerChatId((current) => (current === chat.chatId ? '' : chat.chatId));
  };

  useEffect(() => {
    mountedRef.current = true;

    return () => {
      mountedRef.current = false;
      activeUploadAbortRef.current?.abort();
      if (uploadResetTimerRef.current) window.clearTimeout(uploadResetTimerRef.current);
      if (scrollRafRef.current) window.cancelAnimationFrame(scrollRafRef.current);
      if (scrollTimerRef.current) window.clearTimeout(scrollTimerRef.current);
      if (recordingTimerRef.current) window.clearInterval(recordingTimerRef.current);
      if (messagePollTimerRef.current) window.clearInterval(messagePollTimerRef.current);
      localStorage.removeItem('activeChatId');
      disconnectChatSocket();
    };
  }, []);

  // === Fast request helpers, message cache, polling refs ===
  const normalizeMessages = (data) =>
    (Array.isArray(data) ? data : Array.isArray(data?.messages) ? data.messages : []).map((msg) => ({
      ...msg,
      isMine: msg.senderId === userId,
    }));

  const withTimeout = (promise, ms = 12000, message = 'Request timed out. Please try again.') => {
    let timer;

    const timeout = new Promise((_, reject) => {
      timer = window.setTimeout(() => reject(new Error(message)), ms);
    });

    return Promise.race([promise, timeout]).finally(() => {
      window.clearTimeout(timer);
    });
  };

  const getCachedMessages = (chatId) => messageCacheRef.current.get(chatId) || [];

  const setCachedMessages = (chatId, nextMessages) => {
    if (!chatId) return;
    messageCacheRef.current.set(chatId, nextMessages);
  };

  const refreshChatsSoon = () => {
    const now = Date.now();
    if (now - lastChatsLoadRef.current < 1500) return;
    lastChatsLoadRef.current = now;
    loadChats();
  };

  const loadChats = async () => {
    try {
      const data = await withTimeout(chatApi.getChats(), 10000, 'Chats took too long to load.');
      if (!mountedRef.current) return;
      setChats(Array.isArray(data) ? data : Array.isArray(data?.chats) ? data.chats : []);
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
    scrollMessagesToBottom();
  }, [chats]);

  useEffect(() => {
    activeChatIdRef.current = activeChat?.chatId || null;
  }, [activeChat?.chatId]);

  useEffect(() => {
    return () => {
      if (selectedMediaPreview) {
        URL.revokeObjectURL(selectedMediaPreview);
      }
    };
  }, [selectedMediaPreview]);

  useEffect(() => {
    if (!userId) return;

    connectChatSocket(userId, (data) => {
      if (!mountedRef.current) return;
      if (data.type === 'messageReaction') {
        const reactionMessage = data.message || data;
        const targetMessageId = reactionMessage.messageId;
        const emoji = reactionMessage.emoji;
        const reactorId = reactionMessage.userId || reactionMessage.reactorId;
        const nextReactions = reactionMessage.reactions;

        if (!targetMessageId || !emoji || !reactorId) return;

        if (reactorId === userId && !nextReactions) return;

        setMessages((prev) =>
          prev.map((msg) => {
            if ((msg.messageId || msg.id) !== targetMessageId) return msg;

            if (nextReactions) {
              return {
                ...msg,
                reactions: nextReactions,
              };
            }

            const reactions = msg.reactions || {};
            const users = Array.isArray(reactions[emoji]) ? reactions[emoji] : [];
            const reacted = users.includes(reactorId);

            return {
              ...msg,
              reactions: {
                ...reactions,
                [emoji]: reacted
                  ? users.filter((id) => id !== reactorId)
                  : [...users, reactorId],
              },
            };
          })
        );

        return;
      }
      if (data.type !== 'newMessage') return;

      const activeChatId = activeChatIdRef.current;

      // If message belongs to currently open chat, do not increase unread
      if (data.message?.chatId === activeChatId) {
        // skip unread increment
      } else {
        // Increment unread count for that chat
        setChats((prev) =>
          prev.map((chat) =>
            chat.chatId === data.message?.chatId
              ? { ...chat, unreadCount: (chat.unreadCount || 0) + 1 }
              : chat
          )
        );
        window.dispatchEvent(new Event('chat-unread-refresh'));
        // Do not append message if chat not open
        return;
      }

      // Only append message if chat is open
      if (data.message?.chatId !== activeChatId) {
        return;
      }

      const msg = data.message || {};
      if (!msg.chatId) return;

      setMessages((prev) => {
        let nextMessages;

        if (prev.find((m) => m.messageId === msg.messageId)) {
          nextMessages = prev;
        } else {
          const isOwnMessage = msg.senderId === userId;

          if (isOwnMessage) {
            const matchingLocalIndex = prev.findIndex(
              (m) =>
                (m.clientId && msg.clientId && m.clientId === msg.clientId) ||
                (
                  String(m.messageId || '').startsWith('local-') &&
                  (m.text || m.message || '') === (msg.text || msg.message || '') &&
                  (
                    (m.mediaKey || '') === (msg.mediaKey || '') ||
                    (m.mediaUrl || '') === (msg.mediaUrl || '')
                  ) &&
                  Math.abs(Number(m.createdAt || 0) - Number(msg.createdAt || Date.now())) < 15000
                )
            );

            if (matchingLocalIndex !== -1) {
              nextMessages = prev.map((m, index) =>
                index === matchingLocalIndex
                  ? {
                      ...msg,
                      isMine: true,
                    }
                  : m
              );
            } else {
              nextMessages = [
                ...prev,
                {
                  ...msg,
                  isMine: true,
                },
              ];
            }
          } else {
            nextMessages = [
              ...prev,
              {
                ...msg,
                isMine: false,
              },
            ];
          }
        }

        setCachedMessages(activeChatId, nextMessages);
        return nextMessages;
      });

      scrollMessagesToBottom();
      if (mountedRef.current) refreshChatsSoon();
    });

    return () => {
      localStorage.removeItem('activeChatId');
      disconnectChatSocket();
    };
  }, [userId]);

const scrollMessagesToBottom = () => {
  if (scrollRafRef.current) window.cancelAnimationFrame(scrollRafRef.current);

  scrollRafRef.current = window.requestAnimationFrame(() => {
    if (!mountedRef.current || !scrollRef.current) return;
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

      const chat = await withTimeout(chatApi.startChat(normalizedUser), 10000, 'Starting chat took too long.');
      if (!mountedRef.current) return;

      const fixedChat = {
        ...chat,
        receiverId: chat.receiverId || targetUserId,
        receiverName: chat.receiverName || normalizedUser.name,
        receiverEmail: chat.receiverEmail || normalizedUser.email,
      };

      setActiveChat(fixedChat);
      activeChatIdRef.current = fixedChat.chatId;
      localStorage.setItem('activeChatId', fixedChat.chatId);
      setIsBlocked(fixedChat?.isBlocked || false);
      setMobileChatOpen(true);

      const data = await withTimeout(chatApi.getMessages(fixedChat.chatId), 10000, 'Messages took too long to load.');
      if (!mountedRef.current || activeChatIdRef.current !== fixedChat.chatId) return;

      const nextMessages = normalizeMessages(data);
      setCachedMessages(fixedChat.chatId, nextMessages);
      setMessages(nextMessages);

      refreshChatsSoon();
    } catch (err) {
      console.error('Auto start chat failed:', err);
      if (mountedRef.current) setStatus('Could not open chat with this user.');
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

  useEffect(() => {
    const closeSearchResults = (event) => {
      if (!searchAreaRef.current) return;

      if (!searchAreaRef.current.contains(event.target)) {
        setUsers([]);
      }
    };

    document.addEventListener('mousedown', closeSearchResults);
    document.addEventListener('touchstart', closeSearchResults);

    return () => {
      document.removeEventListener('mousedown', closeSearchResults);
      document.removeEventListener('touchstart', closeSearchResults);
    };
  }, []);

  // PACKET 3A: Add outside-click menu cleanup for floating menus
  useEffect(() => {
    const closeFloatingMenus = (event) => {
      const target = event.target;

      if (!target.closest?.('.message-menu-wrap')) {
        setOpenReactionMenuId(null);
      }

      if (!target.closest?.('.dropdown-actions')) {
        setActionsOpen(false);
      }

      if (!target.closest?.('.chat-avatar-wrap')) {
        setAvatarPickerChatId('');
      }
    };

    document.addEventListener('mousedown', closeFloatingMenus);
    document.addEventListener('touchstart', closeFloatingMenus);

    return () => {
      document.removeEventListener('mousedown', closeFloatingMenus);
      document.removeEventListener('touchstart', closeFloatingMenus);
    };
  }, []);

  const searchUsers = useCallback(async (e) => {
    e.preventDefault();
    setStatus('');

    if (!query.trim()) return;

    try {
      const requestId = searchRequestSeqRef.current + 1;
      searchRequestSeqRef.current = requestId;
      // PACKET 3A: Use withTimeout for user search
      const data = await withTimeout(chatApi.searchUsers(query.trim()), 9000, 'Search took too long.');
      if (!mountedRef.current || requestId !== searchRequestSeqRef.current) return;
      setUsers(Array.isArray(data) ? data : Array.isArray(data?.users) ? data.users : []);
    } catch (err) {
      console.error('User search failed:', err);
      if (mountedRef.current) setStatus('User search failed.');
    }
  }, [query, withTimeout]);

const openChat = useCallback(async (chat) => {
  if (!chat?.chatId) return;

  const requestId = chatRequestSeqRef.current + 1;
  chatRequestSeqRef.current = requestId;

  const cachedMessages = getCachedMessages(chat.chatId);

  setActiveChat(chat);
  activeChatIdRef.current = chat.chatId;
  localStorage.setItem('activeChatId', chat.chatId);
  setMobileChatOpen(true);
  setMessages(cachedMessages);
  setActionsOpen(false);
  setStatus('');
  setOpenReactionMenuId(null);
  setEditingMessageId(null);
  setEditingText('');
  setIsBlocked(chat?.isBlocked || false);
  setUsers([]);

  setChats((prev) =>
    prev.map((item) =>
      item.chatId === chat.chatId ? { ...item, unreadCount: 0 } : item
    )
  );

  window.dispatchEvent(new Event('chat-unread-refresh'));

  if (cachedMessages.length > 0) {
    scrollMessagesToBottom();
  }

  Promise.resolve()
    .then(async () => {
      try {
        if (chatApi.markAsRead) {
          await withTimeout(chatApi.markAsRead(chat.chatId), 5000, 'Mark read timed out.');
        }
      } catch (e) {
        console.error('Mark as read failed', e);
      }
    });

  Promise.resolve()
    .then(async () => {
      try {
        const receiverId = chat.receiverId || chat.userId || chat.id;
        if (!receiverId || !chatApi.checkBlockStatus) return;

        const blockStatus = await withTimeout(
          chatApi.checkBlockStatus(receiverId),
          7000,
          'Block status check timed out.'
        );

        if (!mountedRef.current || requestId !== chatRequestSeqRef.current) return;
        setIsBlocked(blockStatus?.isBlocked || false);
      } catch (e) {
        console.error('Block status check failed', e);
      }
    });

  try {
    const data = await withTimeout(chatApi.getMessages(chat.chatId), 10000, 'Messages took too long to load.');
    if (!mountedRef.current || requestId !== chatRequestSeqRef.current || activeChatIdRef.current !== chat.chatId) return;

    const nextMessages = normalizeMessages(data);
    setCachedMessages(chat.chatId, nextMessages);
    setMessages(nextMessages);

    if (scrollTimerRef.current) window.clearTimeout(scrollTimerRef.current);
    scrollTimerRef.current = window.setTimeout(scrollMessagesToBottom, 40);

    scrollMessagesToBottom();
  } catch (err) {
    console.error('Could not load messages:', err);
    if (mountedRef.current && requestId === chatRequestSeqRef.current) {
      setStatus(cachedMessages.length ? '' : 'Could not load messages.');
    }
  }
}, [getCachedMessages, normalizeMessages, refreshChatsSoon, scrollMessagesToBottom, setCachedMessages, userId, withTimeout]);
useEffect(() => {
  if (messagePollTimerRef.current) {
    window.clearInterval(messagePollTimerRef.current);
    messagePollTimerRef.current = null;
  }

  if (!activeChat?.chatId || !userId) return undefined;

  const pollMessages = async () => {
    const chatId = activeChat.chatId;

    try {
      const data = await withTimeout(chatApi.getMessages(chatId), 9000, 'Message refresh timed out.');
      if (!mountedRef.current || activeChatIdRef.current !== chatId) return;

      const nextMessages = normalizeMessages(data);

      setMessages((prev) => {
        const prevLast = prev[prev.length - 1]?.messageId || prev[prev.length - 1]?.id || prev[prev.length - 1]?.clientId;
        const nextLast = nextMessages[nextMessages.length - 1]?.messageId || nextMessages[nextMessages.length - 1]?.id || nextMessages[nextMessages.length - 1]?.clientId;

        if (prev.length === nextMessages.length && prevLast === nextLast) {
          return prev;
        }

        setCachedMessages(chatId, nextMessages);
        return nextMessages;
      });
    } catch (err) {
      console.error('Fallback message polling failed:', err);
    }
  };

  messagePollTimerRef.current = window.setInterval(pollMessages, 5000);

  return () => {
    if (messagePollTimerRef.current) {
      window.clearInterval(messagePollTimerRef.current);
      messagePollTimerRef.current = null;
    }
  };
}, [activeChat?.chatId, userId]);

useEffect(() => {
  const chatIdFromUrl = searchParams.get('chatId');

  if (!chatIdFromUrl || chats.length === 0) return;

  const targetChat = chats.find((chat) => chat.chatId === chatIdFromUrl);

  if (targetChat && activeChat?.chatId !== targetChat.chatId && !openedChatIdsRef.current.has(targetChat.chatId)) {
    openedChatIdsRef.current.add(targetChat.chatId);
    openChat(targetChat);
  }
}, [searchParams, chats, activeChat?.chatId, openChat]);

  const startChat = useCallback(async (selectedUser) => {
    try {
      const chat = await withTimeout(chatApi.startChat(selectedUser), 10000, 'Starting chat took too long.');
      if (!mountedRef.current) return;
      activeChatIdRef.current = chat.chatId;

      setActiveChat({
        ...chat,
        receiverUsername: chat.receiverUsername || selectedUser.username || selectedUser.userName,
        receiverName: chat.receiverName || selectedUser.name || selectedUser.username,
        receiverEmail: chat.receiverEmail || selectedUser.email,
      });
      localStorage.setItem('activeChatId', chat.chatId);
      setMobileChatOpen(true);
      setMessages([]);
      setActionsOpen(false);
      setOpenReactionMenuId(null);
      setEditingMessageId(null);
      setEditingText('');
      setUsers([]);
      setQuery('');

      const data = await withTimeout(chatApi.getMessages(chat.chatId), 10000, 'Messages took too long to load.');
      if (!mountedRef.current || activeChatIdRef.current !== chat.chatId) return;
      const nextMessages = normalizeMessages(data);
      setCachedMessages(chat.chatId, nextMessages);
      setMessages(nextMessages);

      if (scrollTimerRef.current) window.clearTimeout(scrollTimerRef.current);
      scrollTimerRef.current = window.setTimeout(scrollMessagesToBottom, 50);

      // check block status from backend
      try {
        const blockStatus = await withTimeout(chatApi.checkBlockStatus(chat.receiverId), 7000, 'Block status check timed out.');
        if (!mountedRef.current || activeChatIdRef.current !== chat.chatId) return;
        setIsBlocked(blockStatus?.isBlocked || false);
      } catch (e) {
        console.error('Block status check failed', e);
      }

      refreshChatsSoon();
    } catch (err) {
      console.error('Could not start chat:', err);
      if (mountedRef.current) setStatus('Could not start chat.');
    }
  }, [normalizeMessages, refreshChatsSoon, scrollMessagesToBottom, setCachedMessages, withTimeout]);

  const addEmoji = useCallback((emoji) => {
    setText((prev) => `${prev}${emoji}`);
  }, []);

const handleMediaSelect = useCallback((event) => {
  const file = event.target.files?.[0];
  if (!file) return;

  if (selectedMediaPreview) URL.revokeObjectURL(selectedMediaPreview);

  setSelectedMedia(file);
  setSelectedMediaPreview(URL.createObjectURL(file));
  setShowComposerTools(true);
}, [selectedMediaPreview]);

const handleDrop = useCallback((e) => {
  e.preventDefault();
  const file = e.dataTransfer.files?.[0];
  if (!file) return;

  if (selectedMediaPreview) URL.revokeObjectURL(selectedMediaPreview);

  setSelectedMedia(file);
  setSelectedMediaPreview(URL.createObjectURL(file));
  setShowComposerTools(true);
}, [selectedMediaPreview]);

const handleDragOver = useCallback((e) => {
  e.preventDefault();
}, []);

const removeSelectedMedia = useCallback((shouldRevoke = true) => {
  if (shouldRevoke && selectedMediaPreview) {
    URL.revokeObjectURL(selectedMediaPreview);
  }

  setSelectedMedia(null);
  setSelectedMediaPreview('');

  if (mediaInputRef.current) {
    mediaInputRef.current.value = '';
  }
}, [selectedMediaPreview]);

const refreshMessageMediaUrl = useCallback(async (msg) => {
  if (!msg?.mediaKey) return '';

  // PACKET 3A: Use withTimeout for media preview refresh
  const data = await withTimeout(
    chatApi.getMediaViewUrl({
      mediaKey: msg.mediaKey,
    }),
    9000,
    'Media preview took too long.'
  );

  const freshUrl = data?.mediaUrl || data?.fileUrl || data?.url || '';

  if (!freshUrl) return '';

  if (!mountedRef.current) return freshUrl;
  setMessages((prev) =>
    prev.map((item) =>
      (item.messageId || item.id) === (msg.messageId || msg.id)
        ? { ...item, mediaUrl: freshUrl }
        : item
    )
  );

  return freshUrl;
}, [withTimeout]);

const startVoiceRecording = async () => {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    cancelRecordingRef.current = false;
    if (!mountedRef.current) {
      stream.getTracks().forEach((track) => track.stop());
      return;
    }

    const recorder = new MediaRecorder(stream);
    audioChunksRef.current = [];

    recorder.ondataavailable = (event) => {
      if (event.data.size > 0) {
        audioChunksRef.current.push(event.data);
      }
    };

    recorder.onstop = () => {
      if (!mountedRef.current) {
        stream.getTracks().forEach((track) => track.stop());
        return;
      }
      if (cancelRecordingRef.current) {
        audioChunksRef.current = [];
        stream.getTracks().forEach((track) => track.stop());
        return;
      }
      const audioBlob = new Blob(audioChunksRef.current, {
        type: 'audio/webm',
      });

      const audioFile = new File(
        [audioBlob],
        `voice-${Date.now()}.webm`,
        { type: 'audio/webm' }
      );

      setSelectedMedia(audioFile);
      setSelectedMediaPreview(URL.createObjectURL(audioBlob));

      stream.getTracks().forEach((track) => track.stop());
    };

    recorder.start();
    setMediaRecorder(recorder);
    setIsRecording(true);
    setRecordingSeconds(0);

    recordingTimerRef.current = window.setInterval(() => {
      if (mountedRef.current) setRecordingSeconds((prev) => prev + 1);
    }, 1000);
  } catch (err) {
    console.error('Voice recording failed:', err);
    if (mountedRef.current) setStatus('Microphone permission denied.');
  }
};

const stopVoiceRecording = useCallback(() => {
  if (mediaRecorder && mediaRecorder.state !== 'inactive') {
    mediaRecorder.stop();
    mediaRecorder.stream?.getTracks?.().forEach((track) => track.stop());
  }

  setIsRecording(false);
  setMediaRecorder(null);

  if (recordingTimerRef.current) {
    clearInterval(recordingTimerRef.current);
    recordingTimerRef.current = null;
  }
}, [mediaRecorder]);


const cancelVoiceRecording = useCallback(() => {
  cancelRecordingRef.current = true;
  if (mediaRecorder && mediaRecorder.state !== 'inactive') {
    mediaRecorder.stop();
    mediaRecorder.stream?.getTracks?.().forEach((track) => track.stop());
  }

  audioChunksRef.current = [];
  setIsRecording(false);
  setMediaRecorder(null);
  setRecordingSeconds(0);

  if (recordingTimerRef.current) {
    clearInterval(recordingTimerRef.current);
    recordingTimerRef.current = null;
  }
}, [mediaRecorder]);

const handleQueryChange = useCallback((event) => {
  setQuery(event.target.value);
}, []);

const openMediaPicker = useCallback(() => {
  mediaInputRef.current?.click();
}, []);

const handleTextChange = useCallback((event) => {
  setText(event.target.value);
  scrollMessagesToBottom();
}, [scrollMessagesToBottom]);

const handleTextFocus = useCallback(() => {
  if (scrollTimerRef.current) window.clearTimeout(scrollTimerRef.current);
  scrollTimerRef.current = window.setTimeout(scrollMessagesToBottom, 120);
}, [scrollMessagesToBottom]);


const closeMobileChat = useCallback(() => {
  setMobileChatOpen(false);
  setActiveChat(null);
  activeChatIdRef.current = null;
  setOpenReactionMenuId(null);
  setEditingMessageId(null);
  setEditingText('');
  localStorage.removeItem('activeChatId');
  setMessages([]);
  setActionsOpen(false);

  if (messagePollTimerRef.current) {
    window.clearInterval(messagePollTimerRef.current);
    messagePollTimerRef.current = null;
  }
}, []);

const toggleActionsMenu = useCallback(() => {
  setActionsOpen((prev) => !prev);
}, []);


// Batch 4C: Memoized renderedChatList
const renderedChatList = useMemo(
  () => chats.map((chat) => {
    const active = activeChat?.chatId === chat.chatId;
    const unreadCount = Number(chat.unreadCount || 0);
    const realAvatar = getChatRealAvatar(chat);
    const fallbackAvatar = getFallbackAvatarForChat(chat);

    return (
      <div
        key={chat.chatId}
        role="button"
        tabIndex={0}
        className={active ? 'chat-list-item active' : 'chat-list-item'}
        onClick={() => openChat(chat)}
        onKeyDown={(event) => {
          if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            openChat(chat);
          }
        }}
      >
        <div className="chat-item">
          <div className="chat-avatar-wrap">
            {realAvatar ? (
              <img
                className="chat-avatar"
                src={realAvatar}
                alt=""
                loading="lazy"
                decoding="async"
                referrerPolicy="no-referrer"
              />
            ) : (
              <button
                type="button"
                className="chat-avatar chat-avatar-fallback"
                title="Choose avatar"
                aria-label="Choose chat avatar"
                onClick={(event) => toggleAvatarPicker(event, chat)}
              >
                {fallbackAvatar.emoji}
              </button>
            )}

            {!realAvatar && avatarPickerChatId === chat.chatId && (
              <div className="chat-avatar-picker" onClick={(event) => event.stopPropagation()}>
                <span>Choose avatar</span>
                <div className="chat-avatar-options">
                  {CHAT_FALLBACK_AVATARS.map((avatar) => (
                    <button
                      key={avatar.id}
                      type="button"
                      className={fallbackAvatar.id === avatar.id ? 'active' : ''}
                      title={avatar.label}
                      aria-label={`Use ${avatar.label} avatar`}
                      onClick={(event) => {
                        event.preventDefault();
                        event.stopPropagation();
                        chooseFallbackAvatar(chat, avatar.id);
                      }}
                    >
                      {avatar.emoji}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          <div className="chat-content">
            <strong>
              {getUserDisplayName({
                username: chat.receiverUsername,
                name: chat.receiverName,
                email: chat.receiverEmail,
              })}
            </strong>

            <div className="chat-preview">
              <span>{chat.lastMessage || 'Open conversation'}</span>
              {!active && unreadCount > 0 && (
                <span className="unread-badge">{unreadCount}</span>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }),
  [
    activeChat?.chatId,
    avatarPickerChatId,
    chats,
    chooseFallbackAvatar,
    getFallbackAvatarForChat,
    openChat,
    toggleAvatarPicker,
  ]
);

  const sendMessage = async (e) => {
    e.preventDefault();

    if ((!text.trim() && !selectedMedia) || !activeChat || isBlocked || isUploading) return;

    const cleanText = text.trim();
    const clientId = `local-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    let progressTimer;
    let mediaKey = '';
    let mediaUrl = '';

    try {
      if (selectedMedia) {
        setIsUploading(true);
        setUploadProgress(8);

        progressTimer = window.setInterval(() => {
          setUploadProgress((prev) => Math.min(prev + 18, 92));
        }, 140);

        const uploadData = await withTimeout(
          chatApi.getMediaUploadUrl({
            fileName: selectedMedia.name,
            fileType: selectedMedia.type,
          }),
          10000,
          'Preparing upload took too long.'
        );

        const uploadUrl = uploadData?.uploadUrl || '';
        mediaKey = uploadData?.mediaKey || uploadData?.key || '';
        mediaUrl = uploadData?.mediaUrl || uploadData?.fileUrl || '';

        if (!uploadUrl || !mediaKey) {
          throw new Error('Upload URL or media key missing');
        }

        const uploadAbortController = new AbortController();
        activeUploadAbortRef.current = uploadAbortController;

        const uploadRes = await withTimeout(
          fetch(uploadUrl, {
            method: 'PUT',
            body: selectedMedia,
            signal: uploadAbortController.signal,
            headers: {
              'Content-Type': selectedMedia.type || 'application/octet-stream',
            },
          }),
          25000,
          'Media upload took too long.'
        );

        activeUploadAbortRef.current = null;

        if (!uploadRes.ok) {
          throw new Error('Media upload failed');
        }
      }

      if (!mountedRef.current) return;
      const tempMessage = {
        messageId: clientId,
        clientId,
        chatId: activeChat.chatId,
        senderId: userId,
        text: cleanText,
        mediaKey,
        mediaUrl,
        mediaName: selectedMedia?.name || '',
        mediaType: selectedMedia?.type || '',
        mediaPreview: selectedMediaPreview || '',
        createdAt: Date.now(),
        isMine: true,
        reactions: {},
      };

      setMessages((prev) => {
        const nextMessages = [...prev, tempMessage];
        setCachedMessages(activeChat.chatId, nextMessages);
        return nextMessages;
      });
      scrollMessagesToBottom();

      sendChatMessage({
        chatId: activeChat.chatId,
        receiverId: activeChat.receiverId,
        text: cleanText,
        mediaKey,
        mediaUrl,
        mediaName: selectedMedia?.name || '',
        mediaType: selectedMedia?.type || '',
        clientId,
      });

      if (progressTimer) window.clearInterval(progressTimer);
      setUploadProgress(selectedMedia ? 100 : 0);

      if (uploadResetTimerRef.current) window.clearTimeout(uploadResetTimerRef.current);
      uploadResetTimerRef.current = window.setTimeout(() => {
        if (!mountedRef.current) return;
        setIsUploading(false);
        setUploadProgress(0);
      }, selectedMedia ? 350 : 0);

      setText('');
      removeSelectedMedia(false);
      setShowComposerTools(false);
      scrollMessagesToBottom();
    } catch (err) {
      if (progressTimer) window.clearInterval(progressTimer);
      activeUploadAbortRef.current = null;
      if (!mountedRef.current) return;
      setIsUploading(false);
      setUploadProgress(0);
      console.error('Message send failed:', err);
      setStatus(err.message || 'Message failed.');
    }
  };
const reactToMessage = async (msg, emoji) => {
  const messageId = msg.messageId || msg.id;
  if (!messageId || String(messageId).startsWith('local-') || !activeChat) return;

  setMessages((prev) => {
    const nextMessages = prev.map((item) => {
      if ((item.messageId || item.id) !== messageId) return item;

      const reactions = item.reactions || {};
      const users = Array.isArray(reactions[emoji]) ? reactions[emoji] : [];
      const reacted = users.includes(userId);

      return {
        ...item,
        reactions: {
          ...reactions,
          [emoji]: reacted
            ? users.filter((id) => id !== userId)
            : [...users, userId],
        },
      };
    });

    setCachedMessages(activeChat.chatId, nextMessages);
    return nextMessages;
  });

  try {
    await withTimeout(
      chatApi.reactToMessage({
        chatId: activeChat.chatId,
        messageId,
        emoji,
      }),
      8000,
      'Reaction took too long.'
    );
  } catch (err) {
    console.error('Reaction failed:', err);

    setMessages((prev) => {
      const nextMessages = prev.map((item) => {
        if ((item.messageId || item.id) !== messageId) return item;

        const currentReactions = item.reactions || {};
        const currentUsers = Array.isArray(currentReactions[emoji]) ? currentReactions[emoji] : [];
        const currentlyReacted = currentUsers.includes(userId);

        return {
          ...item,
          reactions: {
            ...currentReactions,
            [emoji]: currentlyReacted
              ? currentUsers.filter((id) => id !== userId)
              : [...currentUsers, userId],
          },
        };
      });

      setCachedMessages(activeChat.chatId, nextMessages);
      return nextMessages;
    });

    if (mountedRef.current) {
      setStatus(err?.response?.status === 401 ? 'Reaction route is not authorized. Check API Gateway auth for /messages/react.' : 'Could not react to message.');
    }
  }
};

const startEditMessage = (msg) => {
  const messageId = msg.messageId || msg.id;
  if (!messageId || String(messageId).startsWith('local-') || !msg.isMine || msg.isDeleted) return;

  setEditingMessageId(messageId);
  setEditingText(msg.text || msg.message || '');
  setOpenReactionMenuId(null);
};

const cancelEditMessage = () => {
  setEditingMessageId(null);
  setEditingText('');
};

const saveEditedMessage = async (msg) => {
  const messageId = msg.messageId || msg.id;
  const nextText = editingText.trim();

  if (!messageId || !activeChat || !nextText) return;

  const previousMessages = [...messages];

  setMessages((prev) => {
    const nextMessages = prev.map((item) =>
      (item.messageId || item.id) === messageId
        ? { ...item, text: nextText, message: nextText, editedAt: Date.now() }
        : item
    );

    setCachedMessages(activeChat.chatId, nextMessages);
    return nextMessages;
  });

  setEditingMessageId(null);
  setEditingText('');

  try {
    await withTimeout(
      chatApi.editMessage({
        chatId: activeChat.chatId,
        messageId,
        text: nextText,
      }),
      9000,
      'Edit took too long.'
    );
  } catch (err) {
    console.error('Edit message failed:', err);
    if (mountedRef.current) {
      setMessages(previousMessages);
      setCachedMessages(activeChat.chatId, previousMessages);
      setStatus('Could not edit message.');
    }
  }
};

const deleteMessage = async (msg) => {
  const messageId = msg.messageId || msg.id || msg._id;
  const isOwnMessage = msg.isMine || msg.senderId === userId;

  if (!messageId || String(messageId).startsWith('local-') || !activeChat || !isOwnMessage) return;

  if (!window.confirm('Delete this message?')) return;

  const previousMessages = [...messages];

  setOpenReactionMenuId(null);
  setEditingMessageId(null);
  setEditingText('');

  setMessages((prev) => {
    const nextMessages = prev.map((item) =>
      (item.messageId || item.id) === messageId
        ? {
            ...item,
            text: 'This message was deleted',
            message: 'This message was deleted',
            mediaKey: '',
            mediaUrl: '',
            mediaPreview: '',
            mediaName: '',
            mediaType: '',
            isDeleted: true,
            deletedAt: Date.now(),
            reactions: {},
          }
        : item
    );

    setCachedMessages(activeChat.chatId, nextMessages);
    return nextMessages;
  });

  try {
    await withTimeout(
      chatApi.deleteMessage({
        chatId: activeChat.chatId,
        messageId,
      }),
      9000,
      'Delete took too long.'
    );
    refreshChatsSoon();
  } catch (err) {
    console.error('Delete message failed:', err);
    if (mountedRef.current) {
      setMessages(previousMessages);
      setCachedMessages(activeChat.chatId, previousMessages);
      setStatus('Could not delete message.');
    }
  }
};
const handleBlockUser = async () => {
  if (!activeChat) return;

  try {
    if (isBlocked) {
      await withTimeout(chatApi.unblockUser(activeChat.receiverId), 9000, 'Unblock took too long.');
      if (!mountedRef.current) return;
      setIsBlocked(false);
      setStatus('User unblocked.');
      refreshChatsSoon();
      return;
    }

    const confirmBlock = window.confirm(
      `Block ${activeChat.receiverName || activeChat.receiverEmail || 'this user'}?`
    );

    if (!confirmBlock) return;

    await withTimeout(chatApi.blockUser(activeChat.receiverId), 9000, 'Block took too long.');
    if (!mountedRef.current) return;
    setIsBlocked(true);
    setStatus('User blocked.');
    setMessages([]);
    setCachedMessages(activeChat.chatId, []);
    refreshChatsSoon();
  } catch (err) {
    console.error('Block toggle failed:', err);
    if (mountedRef.current) setStatus(err?.message || 'Block action failed.');
  }
};

  const handleReportUser = async () => {
    if (!activeChat) return;

    const reason = window.prompt('Reason for reporting:');

    if (!reason?.trim()) return;

    try {
      await withTimeout(
        chatApi.reportUser({
          reportedUserId: activeChat.receiverId,
          chatId: activeChat.chatId,
          reason: reason.trim(),
        }),
        9000,
        'Report took too long.'
      );
      if (!mountedRef.current) return;
      setStatus('Report submitted.');
    } catch (err) {
      console.error('Failed to submit report:', err);
      if (mountedRef.current) setStatus(err?.message || 'Failed to submit report.');
    }
  };

  const handleDeleteChat = async () => {
    if (!activeChat?.chatId) return;

    const confirmDelete = window.confirm(
      `Delete chat with ${
        getUserDisplayName({
          username: activeChat.receiverUsername,
          name: activeChat.receiverName,
          email: activeChat.receiverEmail,
        })
      }? This will remove the conversation from your chat list.`
    );

    if (!confirmDelete) return;

    try {
      setActionsOpen(false);
      setStatus('Deleting chat...');

      const deleteChatRequest =
        chatApi.deleteChat ||
        chatApi.deleteConversation ||
        chatApi.removeChat;

      if (!deleteChatRequest) {
        setStatus('Delete chat API is not connected yet. Add deleteChat to chatApi.');
        return;
      }

      await withTimeout(
        deleteChatRequest(activeChat.chatId),
        9000,
        'Delete chat took too long.'
      );

      if (!mountedRef.current) return;

      messageCacheRef.current.delete(activeChat.chatId);
      setChats((prev) => prev.filter((chat) => chat.chatId !== activeChat.chatId));
      setMessages([]);
      setActiveChat(null);
      activeChatIdRef.current = null;
      setMobileChatOpen(false);
      setOpenReactionMenuId(null);
      setEditingMessageId(null);
      setEditingText('');
      localStorage.removeItem('activeChatId');
      setStatus('Chat deleted.');

      if (messagePollTimerRef.current) {
        window.clearInterval(messagePollTimerRef.current);
        messagePollTimerRef.current = null;
      }

      window.dispatchEvent(new Event('chat-unread-refresh'));
      refreshChatsSoon();
    } catch (err) {
      console.error('Delete chat failed:', err);
      if (mountedRef.current) {
        setStatus(err?.message || 'Could not delete chat.');
      }
    }
  };

const runReportUser = useCallback(() => {
  setActionsOpen(false);
  handleReportUser();
}, [handleReportUser]);

const runBlockUser = useCallback(() => {
  setActionsOpen(false);
  handleBlockUser();
}, [handleBlockUser]);

const runDeleteChat = useCallback(() => {
  setActionsOpen(false);
  handleDeleteChat();
}, [handleDeleteChat]);

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
      activeChatIdRef.current = null;
      setOpenReactionMenuId(null);
      setEditingMessageId(null);
      setEditingText('');
      localStorage.removeItem('activeChatId');
      setMessages([]);
      setActionsOpen(false);
      if (messagePollTimerRef.current) {
        window.clearInterval(messagePollTimerRef.current);
        messagePollTimerRef.current = null;
      }
    }
  };

  return (
<main className={`chat-page ${mobileChatOpen && activeChat ? 'mobile-chat-open' : ''}`}>
      <section className="chat-sidebar">
       <div className="chat-search-wrap" ref={searchAreaRef}>
  <form className="chat-search" onSubmit={searchUsers}>
    <input
      placeholder="Search by username or email..."
      value={query}
      autoComplete="off"
      onChange={handleQueryChange}
    />
    <button type="submit" disabled={!query.trim()}>Search</button>
  </form>

  {users.length > 0 && (
    <div className="user-results">
      <h3>Search results</h3>
      {users.map((selectedUser) => (
        <button
          key={selectedUser.userId || selectedUser.id || selectedUser.email}
          type="button"
          data-initial={getUserDisplayName(selectedUser).slice(0, 2).toUpperCase()}
          onClick={() => startChat(selectedUser)}
        >
          <strong>{getUserDisplayName(selectedUser)}</strong>
          <span>{selectedUser.email || selectedUser.username || ''}</span>
        </button>
      ))}
    </div>
  )}
</div>

{status && <p className="chat-status">{status}</p>}


        <div className="chat-list">
          <h3>Your chats</h3>
          {chats.length === 0 ? (
            <p className="empty-chat">No chats yet.</p>
          ) : (
            renderedChatList
          )}
        </div>
      </section>

<section className="chat-window" onDrop={handleDrop} onDragOver={handleDragOver}>
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
                onClick={closeMobileChat}
              >
                ←
              </button>
              <div className="chat-info">
               <h2>
  {getUserDisplayName({
    username: activeChat.receiverUsername,
    name: activeChat.receiverName,
    email: activeChat.receiverEmail,
  })}
</h2>

                {status && <span className="status-msg">{status}</span>}
              </div>
<div className="chat-actions dropdown-actions">
  <button
    type="button"
    className="chat-more-btn"
    onClick={toggleActionsMenu}
    aria-label="Chat actions"
    aria-expanded={actionsOpen}
  >
    ⋮
  </button>

  {actionsOpen && (
    <div className="chat-actions-menu">
      <button className="btn-report" type="button" onClick={runReportUser}>
        Report
      </button>
      <button className="btn-block" type="button" onClick={runBlockUser}>
        {isBlocked ? 'Unblock' : 'Block'}
      </button>
      <button className="btn-delete-chat" type="button" onClick={runDeleteChat}>
        Delete Chat
      </button>
    </div>
  )}
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

                    {group.messages.map((msg, index) => (
                      <div
                        key={msg.messageId || msg.id || msg.clientId || `${msg.createdAt || 'msg'}-${index}`}
                        className={msg.isMine ? 'message mine' : 'message'}
                      >
                        {(msg.mediaUrl || msg.mediaPreview || msg.mediaKey) && (
                          <ChatMediaPreview msg={msg} onRefreshMediaUrl={refreshMessageMediaUrl} />
                        )}

{editingMessageId === (msg.messageId || msg.id) ? (
  <div className="message-edit-box">
    <input
      value={editingText}
      autoComplete="off"
      disabled={isUploading}
      onChange={(event) => setEditingText(event.target.value)}
      autoFocus
    />
    <div className="message-edit-actions">
      <button type="button" disabled={isUploading || !editingText.trim()} onClick={() => saveEditedMessage(msg)}>Save</button>
      <button type="button" disabled={isUploading} onClick={cancelEditMessage}>Cancel</button>
    </div>
  </div>
) : (
  (msg.text || msg.message) && <p>{msg.text || msg.message}</p>
)}
<span className="timestamp">
  {msg.createdAt
    ? new Date(Number(msg.createdAt)).toLocaleTimeString([], {
        hour: '2-digit',
        minute: '2-digit',
      })
    : ''}
  {msg.editedAt && !msg.isDeleted ? ' · edited' : ''}
</span>

<div className="message-menu-wrap">
  <button
    type="button"
    className="message-menu-btn"
    disabled={isUploading}
    aria-label="Show reactions"
    aria-expanded={openReactionMenuId === (msg.messageId || msg.id)}
    onClick={() => {
      const currentMessageId = msg.messageId || msg.id;
      setOpenReactionMenuId((prev) =>
        prev === currentMessageId ? null : currentMessageId
      );
    }}
  >
    ˅
  </button>

  {openReactionMenuId === (msg.messageId || msg.id) && (
    <div className="message-options-menu">
      <div className="message-reaction-row">
        {['👍', '❤️', '😂', '🔥'].map((emoji) => {
          const reactionUsers = Array.isArray(msg.reactions?.[emoji])
            ? msg.reactions[emoji]
            : [];
          const active = reactionUsers.includes(userId);

          return (
            <button
              key={emoji}
              type="button"
              className={active ? 'reaction-chip active' : 'reaction-chip'}
              onClick={() => {
                reactToMessage(msg, emoji);
                setOpenReactionMenuId(null);
              }}
              disabled={String(msg.messageId || msg.id || '').startsWith('local-') || msg.isDeleted}
            >
              <span>{emoji}</span>
              {reactionUsers.length > 0 && <strong>{reactionUsers.length}</strong>}
            </button>
          );
        })}
      </div>

      {(msg.isMine || msg.senderId === userId) && !msg.isDeleted && !String(msg.messageId || msg.id || msg._id || '').startsWith('local-') && (
        <div className="message-action-row">
          {(msg.text || msg.message) && (
            <button type="button" disabled={isUploading} onClick={() => startEditMessage(msg)}>
              Edit
            </button>
          )}
          <button
            type="button"
            className="message-delete-btn"
            disabled={isUploading}
            onClick={(event) => {
              event.preventDefault();
              event.stopPropagation();
              deleteMessage(msg);
            }}
          >
            Delete
          </button>
        </div>
      )}
    </div>
  )}
</div>
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

             <div className="composer-shell">
  {showComposerTools && !isBlocked && (
    <div className="composer-tools-panel">
      <div className="emoji-row">
        {['😀', '😂', '😍', '🔥', '❤️', '👍', '🙏', '🎉'].map((emoji) => (
          <button key={emoji} type="button" onClick={() => addEmoji(emoji)}>
            {emoji}
          </button>
        ))}
      </div>
      {selectedMediaPreview && (
        <div className="selected-media-card">
          {selectedMedia?.type?.startsWith('image/') ? (
            <img
              src={selectedMediaPreview}
              alt={selectedMedia?.name || 'Selected media'}
              loading="lazy"
              decoding="async"
            />
          ) : selectedMedia?.type?.startsWith('video/') ? (
            <video src={selectedMediaPreview} controls playsInline preload="metadata" />
          ) : selectedMedia?.type?.startsWith('audio/') ? (
            <div className="selected-audio-preview">
              <AudioMiniPlayer
                src={selectedMediaPreview}
                title={selectedMedia?.name || 'Voice note ready'}
              />
            </div>
          ) : (
            <div className="selected-file-icon">📎</div>
          )}

          <div>
            <strong>{selectedMedia?.name || 'Selected media'}</strong>
            <span>{selectedMedia?.type || 'File ready to send'}</span>
          </div>

          <button type="button" disabled={isUploading} onClick={removeSelectedMedia}>✕</button>
        </div>
      )}
    </div>
  )}

  {isUploading && (
  <div className="upload-bar" aria-label="Uploading media">
    <div style={{ width: `${uploadProgress}%` }} />
  </div>
)}

  <form className="message-form" onSubmit={sendMessage}>
    <input
      ref={mediaInputRef}
      type="file"
      accept="image/*,video/*,audio/*"
      className="media-input-hidden"
      onChange={handleMediaSelect}
      disabled={isBlocked || isUploading}
    />

    <button type="button" className="composer-icon-btn" disabled={isBlocked || isUploading} onClick={openMediaPicker}>
      ＋
    </button>

    {/* <button type="button" className="composer-icon-btn" onClick={() => setShowComposerTools((prev) => !prev)}>
      ☺
    </button> */}

    <input
      placeholder={isBlocked ? 'Unblock this user to send messages' : 'Type a message...'}
      value={text}
      onChange={handleTextChange}
      onFocus={handleTextFocus}
      disabled={isBlocked || isUploading}
    />

    <button
  type="button"
  className={isRecording ? 'voice-btn recording' : 'voice-btn'}
  onClick={isRecording ? stopVoiceRecording : startVoiceRecording}
  disabled={isBlocked || isUploading}
>
  {isRecording ? `⏹ ${recordingSeconds}s` : '🎤'}
</button>
{isRecording && (
  <button
    type="button"
    className="voice-cancel-btn"
    disabled={isUploading}
    onClick={cancelVoiceRecording}
  >
    ✕
  </button>
)}
    
<button type="submit" disabled={isBlocked || isUploading || (!text.trim() && !selectedMedia)}>
  Send
</button>
  </form>
</div>
          </>
        )}
      </section>
    </main>
  );
}