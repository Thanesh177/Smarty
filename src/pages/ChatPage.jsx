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



// Optimize image files for upload (resize or compress if needed)
async function optimizeImageForUpload(file) {
  const type = String(file?.type || '').toLowerCase();

  if (!file || !type.startsWith('image/')) return file;
  if (type === 'image/gif' || type === 'image/svg+xml') return file;
  if (file.size <= 350 * 1024) return file;

  const imageUrl = URL.createObjectURL(file);

  try {
    const image = await new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = reject;
      img.src = imageUrl;
    });

    const maxDimension = 1600;
    const scale = Math.min(1, maxDimension / Math.max(image.width, image.height));
    const width = Math.max(1, Math.round(image.width * scale));
    const height = Math.max(1, Math.round(image.height * scale));

    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;

    const ctx = canvas.getContext('2d', { alpha: type === 'image/png' || type === 'image/webp' });
    if (!ctx) return file;

    ctx.drawImage(image, 0, 0, width, height);

    const outputType = type === 'image/png' ? 'image/png' : 'image/jpeg';
    const outputName = outputType === 'image/jpeg'
      ? file.name.replace(/\.(png|jpe?g|webp)$/i, '.jpg')
      : file.name;

    const blob = await new Promise((resolve) => {
      canvas.toBlob(resolve, outputType, outputType === 'image/jpeg' ? 0.82 : 0.88);
    });

    if (!blob || blob.size >= file.size) return file;

    return new File([blob], outputName, {
      type: outputType,
      lastModified: Date.now(),
    });
  } catch (err) {
    console.error('Image optimization failed:', err);
    return file;
  } finally {
    URL.revokeObjectURL(imageUrl);
  }
}


function normalizeChatRecord(chat) {
  if (!chat || typeof chat !== 'object') return chat;

  return {
    ...chat,
    receiverName: chat.receiverName || chat.receiverUsername || chat.receiverEmail || 'User',
    receiverEmail: chat.receiverEmail || '',
  };
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
        {playing ? 'Pause' : 'Play'}
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
          fetchPriority="low"
          sizes="(max-width: 768px) 92vw, 520px"
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
  const [failedProfileAvatarIds, setFailedProfileAvatarIds] = useState({});

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
  const MAX_RENDERED_MESSAGES = 180;
  const POLL_INTERVAL_VISIBLE = 12000;
  const POLL_INTERVAL_HIDDEN = 45000;
  const latestMessagesSignatureRef = useRef('');

  const userId = useMemo(
    () => user?.id || user?.userId || user?.sub,
    [user]
  );

  // =

  useEffect(() => {
    mountedRef.current = true;

    return () => {
      mountedRef.current = false;
      activeUploadAbortRef.current?.abort();
      if (uploadResetTimerRef.current) window.clearTimeout(uploadResetTimerRef.current);
      if (scrollRafRef.current) window.cancelAnimationFrame(scrollRafRef.current);
      if (scrollTimerRef.current) window.clearTimeout(scrollTimerRef.current);
      if (recordingTimerRef.current) window.clearInterval(recordingTimerRef.current);
      if (messagePollTimerRef.current) window.clearTimeout(messagePollTimerRef.current);
      localStorage.removeItem('activeChatId');
      disconnectChatSocket();
    };
  }, []);

  // === Fast request helpers, message cache, polling refs ===
  const normalizeMessages = useCallback((data) => {
    const rawMessages = Array.isArray(data)
      ? data
      : Array.isArray(data?.messages)
        ? data.messages
        : [];

    return rawMessages.slice(-MAX_RENDERED_MESSAGES).map((msg) => ({
      ...msg,
      isMine: msg.senderId === userId,
    }));
  }, [userId]);

  const withTimeout = useCallback((promise, ms = 12000, message = 'Request timed out. Please try again.') => {
    let timer;

    const timeout = new Promise((_, reject) => {
      timer = window.setTimeout(() => reject(new Error(message)), ms);
    });

    return Promise.race([promise, timeout]).finally(() => {
      window.clearTimeout(timer);
    });
  }, []);

  const getCachedMessages = useCallback((chatId) => messageCacheRef.current.get(chatId) || [], []);

  const setCachedMessages = useCallback((chatId, nextMessages) => {
    if (!chatId) return;
    const safeMessages = Array.isArray(nextMessages)
      ? nextMessages.slice(-MAX_RENDERED_MESSAGES)
      : [];
    messageCacheRef.current.set(chatId, safeMessages);
  }, []);

  const refreshChatsSoon = useCallback(() => {
    const now = Date.now();
    if (now - lastChatsLoadRef.current < 6000) return;
    lastChatsLoadRef.current = now;
    loadChats();
  }, []);

  const loadChats = async () => {
    try {
      const data = await withTimeout(chatApi.getChats(), 10000, 'Chats took too long to load.');
      if (!mountedRef.current) return;
      const nextChats = Array.isArray(data) ? data : Array.isArray(data?.chats) ? data.chats : [];
      const normalizedChats = nextChats.map(normalizeChatRecord);
      setChats(normalizedChats);
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
    });

    return () => {
      localStorage.removeItem('activeChatId');
      disconnectChatSocket();
    };
  }, [userId]);

const scrollMessagesToBottom = useCallback(() => {
  if (scrollRafRef.current) window.cancelAnimationFrame(scrollRafRef.current);

  scrollRafRef.current = window.requestAnimationFrame(() => {
    if (!mountedRef.current || !scrollRef.current) return;

    const target = scrollRef.current;
    const distanceFromBottom = target.scrollHeight - target.scrollTop - target.clientHeight;

    if (distanceFromBottom > 260) return;
    target.scrollTop = target.scrollHeight;
  });
}, []);

useEffect(() => {
  scrollMessagesToBottom();
}, [messages.length, scrollMessagesToBottom]);

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
        photoUrl: startWithUser.photoUrl || startWithUser.photoURL || '',
        profilePic: startWithUser.profilePic || '',
        profilePictureUrl: startWithUser.profilePictureUrl || '',
        profilePicture: startWithUser.profilePicture || '',
        avatarUrl: startWithUser.avatarUrl || '',
      };

      const chat = await withTimeout(chatApi.startChat(normalizedUser), 10000, 'Starting chat took too long.');
      if (!mountedRef.current) return;

      const fixedChat = normalizeChatRecord({
        ...chat,
        receiverId: chat.receiverId || targetUserId,
        receiverName: chat.receiverName || normalizedUser.name,
        receiverEmail: chat.receiverEmail || normalizedUser.email,
        receiverAvatarUrl:
          chat.receiverAvatarUrl ||
          chat.receiverPhotoUrl ||
          chat.receiverProfilePic ||
          chat.receiverProfilePictureUrl ||
          chat.receiverAvatar ||
          normalizedUser.photoUrl ||
          normalizedUser.profilePic ||
          normalizedUser.profilePictureUrl ||
          normalizedUser.profilePicture ||
          normalizedUser.avatarUrl ||
          '',
      });

      setActiveChat(fixedChat);
      activeChatIdRef.current = fixedChat.chatId;
      localStorage.setItem('activeChatId', fixedChat.chatId);
      setIsBlocked(fixedChat?.isBlocked || false);
      setMobileChatOpen(true);

      const data = await withTimeout(chatApi.getMessages(fixedChat.chatId), 10000, 'Messages took too long to load.');
      if (!mountedRef.current || activeChatIdRef.current !== fixedChat.chatId) return;

      const nextMessages = normalizeMessages(data);
      const lastMessage = nextMessages[nextMessages.length - 1] || {};
      latestMessagesSignatureRef.current = `${nextMessages.length}:${lastMessage.messageId || lastMessage.id || lastMessage.clientId || ''}:${lastMessage.createdAt || ''}:${lastMessage.editedAt || ''}:${lastMessage.deletedAt || ''}`;
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

  const fixedChat = normalizeChatRecord(chat);
  setActiveChat(fixedChat);
  activeChatIdRef.current = fixedChat.chatId;
  localStorage.setItem('activeChatId', fixedChat.chatId);
  setMobileChatOpen(true);
  setMessages(cachedMessages);
  setActionsOpen(false);
  setStatus('');
  setOpenReactionMenuId(null);
  setEditingMessageId(null);
  setEditingText('');
  setIsBlocked(fixedChat?.isBlocked || false);
  setUsers([]);

  setChats((prev) =>
    prev.map((item) =>
      item.chatId === fixedChat.chatId ? { ...item, unreadCount: 0 } : item
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
          await withTimeout(chatApi.markAsRead(fixedChat.chatId), 5000, 'Mark read timed out.');
        }
      } catch (e) {
        console.error('Mark as read failed', e);
      }
    });

  Promise.resolve()
    .then(async () => {
      try {
        const receiverId = fixedChat.receiverId || fixedChat.userId || fixedChat.id;
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
    const data = await withTimeout(chatApi.getMessages(fixedChat.chatId), 10000, 'Messages took too long to load.');
    if (!mountedRef.current || requestId !== chatRequestSeqRef.current || activeChatIdRef.current !== fixedChat.chatId) return;

    const nextMessages = normalizeMessages(data);
    const lastMessage = nextMessages[nextMessages.length - 1] || {};
    latestMessagesSignatureRef.current = `${nextMessages.length}:${lastMessage.messageId || lastMessage.id || lastMessage.clientId || ''}:${lastMessage.createdAt || ''}:${lastMessage.editedAt || ''}:${lastMessage.deletedAt || ''}`;
    setCachedMessages(fixedChat.chatId, nextMessages);
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
    window.clearTimeout(messagePollTimerRef.current);
    messagePollTimerRef.current = null;
  }

  if (!activeChat?.chatId || !userId) return undefined;

  let stopped = false;

  const getMessageSignature = (items) => {
    if (!Array.isArray(items) || items.length === 0) return 'empty';
    const last = items[items.length - 1] || {};
    return `${items.length}:${last.messageId || last.id || last.clientId || ''}:${last.createdAt || ''}:${last.editedAt || ''}:${last.deletedAt || ''}`;
  };

  const pollMessages = async () => {
    const chatId = activeChat.chatId;

    try {
      const data = await withTimeout(chatApi.getMessages(chatId), 9000, 'Message refresh timed out.');
      if (!mountedRef.current || activeChatIdRef.current !== chatId || stopped) return;

      const nextMessages = normalizeMessages(data);
      const nextSignature = getMessageSignature(nextMessages);

      if (latestMessagesSignatureRef.current !== nextSignature) {
        latestMessagesSignatureRef.current = nextSignature;
        setCachedMessages(chatId, nextMessages);
        setMessages(nextMessages);
      }
    } catch (err) {
      console.error('Fallback message polling failed:', err);
    } finally {
      if (stopped || !mountedRef.current || activeChatIdRef.current !== chatId) return;
      const delay = document.hidden ? POLL_INTERVAL_HIDDEN : POLL_INTERVAL_VISIBLE;
      messagePollTimerRef.current = window.setTimeout(pollMessages, delay);
    }
  };

  const handleVisibilityChange = () => {
    if (!document.hidden) {
      if (messagePollTimerRef.current) window.clearTimeout(messagePollTimerRef.current);
      pollMessages();
    }
  };

  document.addEventListener('visibilitychange', handleVisibilityChange);
  messagePollTimerRef.current = window.setTimeout(pollMessages, POLL_INTERVAL_VISIBLE);

  return () => {
    stopped = true;
    document.removeEventListener('visibilitychange', handleVisibilityChange);
    if (messagePollTimerRef.current) {
      window.clearTimeout(messagePollTimerRef.current);
      messagePollTimerRef.current = null;
    }
  };
}, [activeChat?.chatId, userId, normalizeMessages, setCachedMessages, withTimeout]);

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

      const fixedChat = normalizeChatRecord({
        ...chat,
        receiverUsername: chat.receiverUsername || selectedUser.username || selectedUser.userName,
        receiverName: chat.receiverName || selectedUser.name || selectedUser.username,
        receiverEmail: chat.receiverEmail || selectedUser.email,
        receiverAvatarUrl:
          chat.receiverAvatarUrl ||
          chat.receiverPhotoUrl ||
          chat.receiverProfilePic ||
          chat.receiverProfilePictureUrl ||
          chat.receiverAvatar ||
          selectedUser.photoUrl ||
          selectedUser.photoURL ||
          selectedUser.profilePic ||
          selectedUser.profilePictureUrl ||
          selectedUser.profilePicture ||
          selectedUser.avatarUrl ||
          selectedUser.picture ||
          '',
      });

      setActiveChat(fixedChat);
      localStorage.setItem('activeChatId', fixedChat.chatId);
      setMobileChatOpen(true);
      setMessages([]);
      setActionsOpen(false);
      setOpenReactionMenuId(null);
      setEditingMessageId(null);
      setEditingText('');
      setUsers([]);
      setQuery('');

      const data = await withTimeout(chatApi.getMessages(fixedChat.chatId), 10000, 'Messages took too long to load.');
      if (!mountedRef.current || activeChatIdRef.current !== fixedChat.chatId) return;
      const nextMessages = normalizeMessages(data);
      const lastMessage = nextMessages[nextMessages.length - 1] || {};
      latestMessagesSignatureRef.current = `${nextMessages.length}:${lastMessage.messageId || lastMessage.id || lastMessage.clientId || ''}:${lastMessage.createdAt || ''}:${lastMessage.editedAt || ''}:${lastMessage.deletedAt || ''}`;
      setCachedMessages(fixedChat.chatId, nextMessages);
      setMessages(nextMessages);

      if (scrollTimerRef.current) window.clearTimeout(scrollTimerRef.current);
      scrollTimerRef.current = window.setTimeout(scrollMessagesToBottom, 50);

      // check block status from backend
      try {
        const blockStatus = await withTimeout(chatApi.checkBlockStatus(fixedChat.receiverId), 7000, 'Block status check timed out.');
        if (!mountedRef.current || activeChatIdRef.current !== fixedChat.chatId) return;
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
    window.clearTimeout(messagePollTimerRef.current);
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
    const realAvatarSrc = String(chat.receiverAvatarUrl || '').trim();
    const avatarFailKey = `${chat.chatId}:${realAvatarSrc}`;
    const profileAvatarFailed = realAvatarSrc ? Boolean(failedProfileAvatarIds[avatarFailKey]) : false;

    const realAvatar = profileAvatarFailed ? '' : realAvatarSrc;
    const avatarInitials = getUserDisplayName({
      username: chat.receiverUsername,
      name: chat.receiverName,
      email: chat.receiverEmail,
    }).slice(0, 2).toUpperCase();
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
                src={realAvatarSrc}
                alt={getUserDisplayName({
                  username: chat.receiverUsername,
                  name: chat.receiverName,
                  email: chat.receiverEmail,
                })}
                loading="lazy"
                decoding="async"
                referrerPolicy="no-referrer"
                onError={() => {
                  setFailedProfileAvatarIds((prev) => ({
                    ...prev,
                    [avatarFailKey]: true,
                  }));
                }}
                onLoad={() => {
                  setFailedProfileAvatarIds((prev) => {
                    if (!prev[avatarFailKey]) return prev;
                    const next = { ...prev };
                    delete next[avatarFailKey];
                    return next;
                  });
                }}
                data-avatar-url={realAvatarSrc}
              />
            ) : (
              <div
                className="chat-avatar chat-avatar-fallback chat-avatar-default"
                aria-label="Default avatar"
                title="Default avatar"
              >
                <span>{avatarInitials || 'US'}</span>
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
    chats,
    failedProfileAvatarIds,
    openChat,
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
    let uploadFile = selectedMedia;

    try {
      if (selectedMedia) {
        setIsUploading(true);
        setUploadProgress(8);

        uploadFile = await optimizeImageForUpload(selectedMedia);
        if (!mountedRef.current) return;

        progressTimer = window.setInterval(() => {
          setUploadProgress((prev) => Math.min(prev + 18, 92));
        }, 140);

        const uploadData = await withTimeout(
          chatApi.getMediaUploadUrl({
            fileName: uploadFile.name,
            fileType: uploadFile.type || selectedMedia.type,
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
            body: uploadFile,
            signal: uploadAbortController.signal,
            headers: {
              'Content-Type': uploadFile.type || selectedMedia.type || 'application/octet-stream',
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
        mediaName: uploadFile?.name || selectedMedia?.name || '',
        mediaType: uploadFile?.type || selectedMedia?.type || '',
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
        mediaName: uploadFile?.name || selectedMedia?.name || '',
        mediaType: uploadFile?.type || selectedMedia?.type || '',
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
        window.clearTimeout(messagePollTimerRef.current);
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
        window.clearTimeout(messagePollTimerRef.current);
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

            <div className="messages" ref={scrollRef} aria-live="polite">
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
        {['like', 'yes', 'seen', 'saved'].map((emoji) => {
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
        {['like', 'ok', 'yes', 'no'].map((emoji) => (
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
              fetchPriority="low"
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
            <div className="selected-file-icon">file</div>
          )}

          <div>
            <strong>{selectedMedia?.name || 'Selected media'}</strong>
            <span>{selectedMedia?.type || 'File ready to send'}</span>
          </div>

          <button type="button" disabled={isUploading} onClick={removeSelectedMedia}>Remove</button>
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
      +
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
  {isRecording ? `Stop ${recordingSeconds}s` : 'Voice'}
</button>
{isRecording && (
  <button
    type="button"
    className="voice-cancel-btn"
    disabled={isUploading}
    onClick={cancelVoiceRecording}
  >
    Cancel
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