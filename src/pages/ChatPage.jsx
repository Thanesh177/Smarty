import { memo, useEffect, useMemo, useRef, useState, useCallback } from 'react';
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { chatApi } from '../api/client';
import { useAuth } from '../contexts/AuthContext';
import {
  connectChatSocket,
  sendChatMessage,
  setActiveChatOnSocket,
  subscribeChatSocket,
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

function getProfileUserId(person, currentUserId = '') {
  if (!person || typeof person !== 'object') return '';

  const selfId = String(currentUserId || '').trim();
  const candidates = [
    person.otherUserId,
    person.partnerId,
    person.participantId,
    person.receiverUserId,
    person.receiverId,
    person.senderId,
    person.userId,
    person.sub,
    person.receiver?.userId,
    person.receiver?.id,
    person.receiver?.sub,
    person.otherUser?.userId,
    person.otherUser?.id,
    person.otherUser?.sub,
    person.participant?.userId,
    person.participant?.id,
    person.participant?.sub,
    person.user?.userId,
    person.user?.id,
    person.user?.sub,
  ];

  if (!person.chatId) candidates.push(person.id);

  [person.participants, person.members, person.users, person.userIds]
    .filter(Array.isArray)
    .forEach((items) => {
      items.forEach((item) => {
        if (item && typeof item === 'object') {
          candidates.push(item.userId, item.id, item.sub);
        } else {
          candidates.push(item);
        }
      });
    });

  const normalizedCandidates = candidates
    .map((value) => String(value || '').trim())
    .filter(Boolean);

  const otherUserId = normalizedCandidates.find(
    (candidate) => !selfId || candidate !== selfId
  );

  if (otherUserId) return otherUserId;

  // A standalone user search result may intentionally be the signed-in user.
  return person.chatId ? '' : normalizedCandidates[0] || '';
}

function getUserAvatarUrl(person) {
  return String(
    person?.photoUrl ||
    person?.photoURL ||
    person?.profilePic ||
    person?.profilePictureUrl ||
    person?.profilePicture ||
    person?.avatarUrl ||
    person?.picture ||
    person?.receiverAvatarUrl ||
    ''
  ).trim();
}

// Chat avatar cache helpers
const CHAT_AVATAR_CACHE_KEY = 'smarty_chat_avatar_cache_v1';
const CHAT_AVATAR_CACHE_MAX_AGE = 1000 * 60 * 60 * 24 * 7;

const CHAT_LIST_CACHE_KEY = 'smarty_chat_list_cache_v1';
const CHAT_LIST_CACHE_MAX_AGE = 1000 * 60 * 3;

function readChatAvatarCache() {
  try {
    const raw = localStorage.getItem(CHAT_AVATAR_CACHE_KEY);
    const parsed = raw ? JSON.parse(raw) : {};
    if (!parsed || typeof parsed !== 'object') return {};
    return parsed;
  } catch {
    return {};
  }
}

function writeChatAvatarCache(cache) {
  try {
    localStorage.setItem(CHAT_AVATAR_CACHE_KEY, JSON.stringify(cache));
  } catch {
    // Ignore storage quota/private mode failures.
  }
}

function getCachedChatAvatar(cache, key) {
  const item = cache?.[key];
  if (!item?.url) return '';
  if (Date.now() - Number(item.savedAt || 0) > CHAT_AVATAR_CACHE_MAX_AGE) return '';
  return item.url;
}

function readChatListCache(userId) {
  try {
    const raw = sessionStorage.getItem(`${CHAT_LIST_CACHE_KEY}:${userId || 'guest'}`);
    const parsed = raw ? JSON.parse(raw) : null;

    if (!parsed || !Array.isArray(parsed.chats)) return [];
    if (Date.now() - Number(parsed.savedAt || 0) > CHAT_LIST_CACHE_MAX_AGE) return [];

    return parsed.chats.map(normalizeChatRecord);
  } catch {
    return [];
  }
}

function writeChatListCache(userId, chats) {
  if (!userId || !Array.isArray(chats)) return;

  try {
    sessionStorage.setItem(
      `${CHAT_LIST_CACHE_KEY}:${userId}`,
      JSON.stringify({
        savedAt: Date.now(),
        chats: chats.slice(0, 80),
      })
    );
  } catch {
    // Ignore storage failures.
  }
}

function deferChatStartup(callback) {
  if (typeof window === 'undefined') return undefined;

  if ('requestIdleCallback' in window) {
    const idleId = window.requestIdleCallback(callback, { timeout: 900 });
    return () => window.cancelIdleCallback?.(idleId);
  }

  const timer = window.setTimeout(callback, 120);
  return () => window.clearTimeout(timer);
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
  const numericTimestamp = Number(timestamp);
  const date = new Date(
    numericTimestamp > 0 && numericTimestamp < 1e12
      ? numericTimestamp * 1000
      : numericTimestamp
  );
  const today = new Date();
  const yesterday = new Date();

  if (Number.isNaN(date.getTime())) return 'Messages';

  yesterday.setDate(today.getDate() - 1);

  if (date.toDateString() === today.toDateString()) return 'Today';
  if (date.toDateString() === yesterday.toDateString()) return 'Yesterday';

  return date.toLocaleDateString(undefined, {
    weekday: 'long',
    month: 'short',
    day: 'numeric', 
  });
}

function formatMessageTime(timestamp) {
  const numericTimestamp = Number(timestamp);
  const date = new Date(
    numericTimestamp > 0 && numericTimestamp < 1e12
      ? numericTimestamp * 1000
      : numericTimestamp
  );

  if (!timestamp || Number.isNaN(date.getTime())) return '';

  return date.toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
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

function normalizeReactionMap(reactions) {
  if (!reactions) return {};

  if (!Array.isArray(reactions) && typeof reactions === 'object') {
    return Object.entries(reactions).reduce((acc, [key, value]) => {
      if (Array.isArray(value)) {
        acc[key] = value.map((item) => String(item));
      } else if (value && typeof value === 'object') {
        const users = value.users || value.userIds || value.reactors || [];
        acc[key] = Array.isArray(users) ? users.map((item) => String(item)) : [];
      } else {
        acc[key] = [];
      }

      return acc;
    }, {});
  }

  if (Array.isArray(reactions)) {
    return reactions.reduce((acc, item) => {
      const emoji = item?.emoji || item?.reaction || item?.type;
      const reactorId = item?.userId || item?.reactorId || item?.senderId;

      if (!emoji || !reactorId) return acc;

      const key = String(emoji);
      const id = String(reactorId);
      const users = Array.isArray(acc[key]) ? acc[key] : [];

      if (!users.includes(id)) {
        acc[key] = [...users, id];
      }

      return acc;
    }, {});
  }

  return {};
}

function toggleReactionForUser(reactions, emoji, userId) {
  const normalized = normalizeReactionMap(reactions);
  const key = String(emoji);
  const id = String(userId || '');
  const users = Array.isArray(normalized[key]) ? normalized[key].map((item) => String(item)) : [];
  const reacted = users.includes(id);

  return {
    ...normalized,
    [key]: reacted ? users.filter((item) => item !== id) : [...users, id],
  };
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
        onLoadedMetadata={(e) => {
          const nextDuration = e.currentTarget.duration || 0;
          setDuration(Number.isFinite(nextDuration) ? nextDuration : 0);
        }}
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
const ChatMediaPreview = memo(function ChatMediaPreview({ msg, onRefreshMediaUrl, onOpenImage }) {
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
          onClick={() => onOpenImage?.(mediaSource)}
          style={{ cursor: 'zoom-in' }}
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
  const navigate = useNavigate();
  const [isRecording, setIsRecording] = useState(false);
  const [mediaRecorder, setMediaRecorder] = useState(null);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const audioChunksRef = useRef([]);
  const recordingTimerRef = useRef(null);
  const recordingStreamRef = useRef(null);
  const { user } = useAuth();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const [isBlocked, setIsBlocked] = useState(false);
  const [query, setQuery] = useState('');
  const [users, setUsers] = useState([]);
  const [isSearchingUsers, setIsSearchingUsers] = useState(false);
  const [chats, setChats] = useState(() => readChatListCache(user?.id || user?.userId || user?.sub));
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
  const [fullscreenImage, setFullscreenImage] = useState('');

  // Avatar fallback/cache state
  const [failedProfileAvatarIds, setFailedProfileAvatarIds] = useState({});
  const [loadedProfileAvatarIds, setLoadedProfileAvatarIds] = useState({});
  const [chatAvatarCache, setChatAvatarCache] = useState(() => readChatAvatarCache());

  const mountedRef = useRef(true);
  const activeChatIdRef = useRef(null);
  const scrollRafRef = useRef(null);
  const scrollTimerRef = useRef(null);
  const chatRequestSeqRef = useRef(0);
  const searchRequestSeqRef = useRef(0);
  const searchDebounceRef = useRef(null);
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

function scrollMessagesToBottom(force = false) {
  if (scrollRafRef.current) window.cancelAnimationFrame(scrollRafRef.current);

  scrollRafRef.current = window.requestAnimationFrame(() => {
    if (!mountedRef.current || !scrollRef.current) return;

    const target = scrollRef.current;
    const distanceFromBottom = target.scrollHeight - target.scrollTop - target.clientHeight;

    if (!force && distanceFromBottom > 260) return;
    target.scrollTop = target.scrollHeight;
  });
}

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
      recordingStreamRef.current?.getTracks?.().forEach((track) => track.stop());
      recordingStreamRef.current = null;
      if (messagePollTimerRef.current) window.clearTimeout(messagePollTimerRef.current);
localStorage.removeItem('activeChatId');

try {
  setActiveChatOnSocket?.('');
} catch (err) {
  console.error('Could not clear active chat on socket:', err);
}
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
      reactions: normalizeReactionMap(msg.reactions),
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

  const buildMessagesSignature = useCallback((items) => {
    if (!Array.isArray(items) || items.length === 0) return 'empty';

    const lastMessage = items[items.length - 1] || {};

    return `${items.length}:${lastMessage.messageId || lastMessage.id || lastMessage.clientId || ''}:${lastMessage.createdAt || ''}:${lastMessage.editedAt || ''}:${lastMessage.deletedAt || ''}`;
  }, []);

  const refreshChatsSoon = useCallback(() => {
    const now = Date.now();
    if (now - lastChatsLoadRef.current < 6000) return;
    lastChatsLoadRef.current = now;

    deferChatStartup(() => {
      if (mountedRef.current) loadChats();
    });
  }, []);

  const loadChats = async () => {
    try {
      const data = await withTimeout(chatApi.getChats(), 10000, 'Chats took too long to load.');
      if (!mountedRef.current) return;
      const nextChats = Array.isArray(data) ? data : Array.isArray(data?.chats) ? data.chats : [];
      const normalizedChats = nextChats.map(normalizeChatRecord);
      writeChatListCache(userId, normalizedChats);
      setChats((prev) => {
        const prevSignature = prev.map((chat) => `${chat.chatId}:${chat.unreadCount || 0}:${chat.lastMessage || ''}`).join('|');
        const nextSignature = normalizedChats.map((chat) => `${chat.chatId}:${chat.unreadCount || 0}:${chat.lastMessage || ''}`).join('|');
        return prevSignature === nextSignature ? prev : normalizedChats;
      });
    } catch (err) {
      console.error('Failed to load chats:', err);
    }
  };

  useEffect(() => {
    if (!userId) return undefined;

    const cachedChats = readChatListCache(userId);
    if (cachedChats.length > 0) {
      setChats(cachedChats);
    }

    return deferChatStartup(() => {
      if (mountedRef.current) loadChats();
    });
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
    const chatId = activeChat?.chatId || '';
    activeChatIdRef.current = chatId || null;

    try {
      setActiveChatOnSocket?.(chatId);
    } catch (err) {
      console.error('Could not update active chat on socket:', err);
    }
  }, [activeChat?.chatId]);

  useEffect(() => {
    return () => {
      if (selectedMediaPreview) {
        URL.revokeObjectURL(selectedMediaPreview);
      }
    };
  }, [selectedMediaPreview]);

  useEffect(() => {
    writeChatAvatarCache(chatAvatarCache);
  }, [chatAvatarCache]);

  useEffect(() => {
    if (!userId) return undefined;

    let unsubscribeSocket = null;
    let cancelled = false;

    const cancelStartup = deferChatStartup(() => {
      if (cancelled || !mountedRef.current) return;

      connectChatSocket(userId);

      unsubscribeSocket = subscribeChatSocket((data) => {      if (!mountedRef.current) return;
      if (data.type === 'messageReaction') {
        const reactionMessage = data.message || data;
        const targetMessageId = reactionMessage.messageId;
        const emoji = reactionMessage.emoji;
        const reactorId = reactionMessage.userId || reactionMessage.reactorId;
        const nextReactions = reactionMessage.reactions;

        if (!targetMessageId || !emoji || !reactorId) return;

        if (reactorId === userId && !nextReactions) return;

        setMessages((prev) => {
          const nextMessages = prev.map((msg) => {
            if ((msg.messageId || msg.id) !== targetMessageId) return msg;

            return {
              ...msg,
              reactions: nextReactions
                ? normalizeReactionMap(nextReactions)
                : toggleReactionForUser(msg.reactions, emoji, reactorId),
            };
          });

          const activeChatId = activeChatIdRef.current;
          if (activeChatId) setCachedMessages(activeChatId, nextMessages);

          return nextMessages;
        });

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

    });
    return () => {
      cancelled = true;
      cancelStartup?.();
      localStorage.removeItem('activeChatId');
      unsubscribeSocket?.();
    };
  }, [userId, setCachedMessages]);

useEffect(() => {
  scrollMessagesToBottom();
}, [messages.length]);

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
}, [activeChat?.chatId]);

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
      latestMessagesSignatureRef.current = buildMessagesSignature(nextMessages);
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

  const runUserSearch = useCallback(async (searchTerm) => {
    const normalizedQuery = searchTerm.trim();
    if (!normalizedQuery) return;

    setStatus('');
    setIsSearchingUsers(true);
    const requestId = searchRequestSeqRef.current + 1;
    searchRequestSeqRef.current = requestId;

    try {
      // PACKET 3A: Use withTimeout for user search
      const data = await withTimeout(chatApi.searchUsers(normalizedQuery), 9000, 'Search took too long.');
      if (!mountedRef.current || requestId !== searchRequestSeqRef.current) return;
      setUsers(Array.isArray(data) ? data : Array.isArray(data?.users) ? data.users : []);
    } catch (err) {
      console.error('User search failed:', err);
      if (mountedRef.current && requestId === searchRequestSeqRef.current) {
        setUsers([]);
        setStatus('User search failed.');
      }
    } finally {
      if (mountedRef.current && requestId === searchRequestSeqRef.current) {
        setIsSearchingUsers(false);
      }
    }
  }, [withTimeout]);

  const searchUsers = useCallback((event) => {
    event.preventDefault();

    if (searchDebounceRef.current) {
      window.clearTimeout(searchDebounceRef.current);
      searchDebounceRef.current = null;
    }

    runUserSearch(query);
  }, [query, runUserSearch]);

  useEffect(() => {
    const normalizedQuery = query.trim();

    // Invalidate any request started for an older query immediately.
    searchRequestSeqRef.current += 1;

    if (searchDebounceRef.current) {
      window.clearTimeout(searchDebounceRef.current);
      searchDebounceRef.current = null;
    }

    if (!normalizedQuery) {
      setUsers([]);
      setIsSearchingUsers(false);
      return undefined;
    }

    searchDebounceRef.current = window.setTimeout(() => {
      searchDebounceRef.current = null;
      runUserSearch(normalizedQuery);
    }, 300);

    return () => {
      if (searchDebounceRef.current) {
        window.clearTimeout(searchDebounceRef.current);
        searchDebounceRef.current = null;
      }
    };
  }, [query, runUserSearch]);

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
    latestMessagesSignatureRef.current = buildMessagesSignature(nextMessages);
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
}, [getCachedMessages, normalizeMessages, refreshChatsSoon, setCachedMessages, userId, withTimeout, buildMessagesSignature]);
useEffect(() => {
  if (messagePollTimerRef.current) {
    window.clearTimeout(messagePollTimerRef.current);
    messagePollTimerRef.current = null;
  }

  if (!activeChat?.chatId || !userId) return undefined;

  let stopped = false;

  const pollMessages = async () => {
    const chatId = activeChat.chatId;

    try {
      const data = await withTimeout(chatApi.getMessages(chatId), 9000, 'Message refresh timed out.');
      if (!mountedRef.current || activeChatIdRef.current !== chatId || stopped) return;

      const nextMessages = normalizeMessages(data);
      const nextSignature = buildMessagesSignature(nextMessages);

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
}, [activeChat?.chatId, userId, normalizeMessages, setCachedMessages, withTimeout, buildMessagesSignature]);

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
      latestMessagesSignatureRef.current = buildMessagesSignature(nextMessages);
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
  }, [normalizeMessages, refreshChatsSoon, setCachedMessages, withTimeout, buildMessagesSignature]);

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

const cancelSelectedRecording = useCallback(() => {
  removeSelectedMedia(true);
  setShowComposerTools(false);
  setStatus('');
}, [removeSelectedMedia]);

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
    if (!navigator.mediaDevices?.getUserMedia) {
      setStatus('Voice recording is not supported in this browser.');
      return;
    }

    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    recordingStreamRef.current = stream;
    cancelRecordingRef.current = false;

    if (!mountedRef.current) {
      stream.getTracks().forEach((track) => track.stop());
      recordingStreamRef.current = null;
      return;
    }

    const supportedMimeType = [
      'audio/webm;codecs=opus',
      'audio/webm',
      'audio/mp4',
      'audio/mpeg',
    ].find((mimeType) => {
      try {
        return MediaRecorder.isTypeSupported(mimeType);
      } catch {
        return false;
      }
    });

    const recorder = supportedMimeType
      ? new MediaRecorder(stream, { mimeType: supportedMimeType })
      : new MediaRecorder(stream);

    audioChunksRef.current = [];

    recorder.ondataavailable = (event) => {
      if (event.data && event.data.size > 0) {
        audioChunksRef.current.push(event.data);
      }
    };

    recorder.onerror = (event) => {
      console.error('Voice recording recorder error:', event?.error || event);
      if (mountedRef.current) setStatus('Voice recording failed. Please try again.');
    };

    recorder.onstop = () => {
      const streamToStop = recordingStreamRef.current || stream;
      streamToStop?.getTracks?.().forEach((track) => track.stop());
      recordingStreamRef.current = null;

      if (recordingTimerRef.current) {
        window.clearInterval(recordingTimerRef.current);
        recordingTimerRef.current = null;
      }

      setIsRecording(false);
      setMediaRecorder(null);
      setRecordingSeconds(0);

      if (!mountedRef.current) {
        audioChunksRef.current = [];
        return;
      }

      if (cancelRecordingRef.current) {
        audioChunksRef.current = [];
        cancelRecordingRef.current = false;
        return;
      }

      const mimeType = recorder.mimeType || supportedMimeType || 'audio/webm';
      const extension = mimeType.includes('mp4') ? 'm4a' : mimeType.includes('mpeg') ? 'mp3' : 'webm';
      const audioBlob = new Blob(audioChunksRef.current, { type: mimeType });
      audioChunksRef.current = [];

      if (!audioBlob.size) {
        setStatus('No voice audio was recorded. Please try again.');
        return;
      }

      const audioFile = new File(
        [audioBlob],
        `voice-${Date.now()}.${extension}`,
        { type: mimeType }
      );

      if (selectedMediaPreview) URL.revokeObjectURL(selectedMediaPreview);

      setSelectedMedia(audioFile);
      setSelectedMediaPreview(URL.createObjectURL(audioBlob));
      setShowComposerTools(true);
      setStatus('');
    };

    recorder.start(250);
    setMediaRecorder(recorder);
    setIsRecording(true);
    setRecordingSeconds(0);
    setStatus('');

    if (recordingTimerRef.current) {
      window.clearInterval(recordingTimerRef.current);
    }

    recordingTimerRef.current = window.setInterval(() => {
      if (mountedRef.current) setRecordingSeconds((prev) => prev + 1);
    }, 1000);
  } catch (err) {
    console.error('Voice recording failed:', err);
    recordingStreamRef.current?.getTracks?.().forEach((track) => track.stop());
    recordingStreamRef.current = null;
    setIsRecording(false);
    setMediaRecorder(null);
    setRecordingSeconds(0);

    if (recordingTimerRef.current) {
      window.clearInterval(recordingTimerRef.current);
      recordingTimerRef.current = null;
    }

    if (mountedRef.current) setStatus('Microphone permission denied or unavailable.');
  }
};

const stopVoiceRecording = useCallback(() => {
  if (mediaRecorder && mediaRecorder.state !== 'inactive') {
    try {
      mediaRecorder.stop();
    } catch (err) {
      console.error('Could not stop recording:', err);
    }
  }
}, [mediaRecorder]);


const cancelVoiceRecording = useCallback(() => {
  cancelRecordingRef.current = true;

  if (mediaRecorder && mediaRecorder.state !== 'inactive') {
    try {
      mediaRecorder.stop();
    } catch (err) {
      console.error('Could not cancel recording:', err);
    }
  } else {
    audioChunksRef.current = [];
    recordingStreamRef.current?.getTracks?.().forEach((track) => track.stop());
    recordingStreamRef.current = null;
    setIsRecording(false);
    setMediaRecorder(null);
    setRecordingSeconds(0);

    if (recordingTimerRef.current) {
      clearInterval(recordingTimerRef.current);
      recordingTimerRef.current = null;
    }
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
}, []);

const handleTextFocus = useCallback(() => {
  if (scrollTimerRef.current) window.clearTimeout(scrollTimerRef.current);
  scrollTimerRef.current = window.setTimeout(scrollMessagesToBottom, 120);
}, []);


const closeMobileChat = useCallback(() => {
  setMobileChatOpen(false);
  setActiveChat(null);
  activeChatIdRef.current = null;
  setOpenReactionMenuId(null);
  setEditingMessageId(null);
  setEditingText('');
  localStorage.removeItem('activeChatId');
  try {
    setActiveChatOnSocket?.('');
  } catch (err) {
    console.error('Could not clear active chat on socket:', err);
  }
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

const openUserProfile = useCallback((person, event) => {
  event?.preventDefault?.();
  event?.stopPropagation?.();

  const profileUserId = getProfileUserId(person, userId);

  if (profileUserId && String(profileUserId) === String(userId)) {
    navigate('/profile');
    return;
  }

  if (profileUserId) {
    navigate(`/creator/${encodeURIComponent(profileUserId)}`);
    return;
  }

  setStatus('This profile is unavailable.');
}, [navigate, userId]);


// Batch 4C: Memoized renderedChatList
const renderedChatList = useMemo(
  () => chats.map((chat) => {
    const active = activeChat?.chatId === chat.chatId;
    const unreadCount = Number(chat.unreadCount || 0);
    const avatarCacheKey = String(chat.receiverId || chat.userId || chat.id || chat.receiverEmail || chat.chatId || '').trim();
    const directAvatarSrc = String(chat.receiverAvatarUrl || '').trim();
    const cachedAvatarSrc = avatarCacheKey ? getCachedChatAvatar(chatAvatarCache, avatarCacheKey) : '';
    const realAvatarSrc = directAvatarSrc || cachedAvatarSrc;
    const avatarFailKey = `${chat.chatId}:${realAvatarSrc}`;
    const profileAvatarFailed = realAvatarSrc ? Boolean(failedProfileAvatarIds[avatarFailKey]) : false;
    const profileAvatarLoaded = realAvatarSrc ? Boolean(loadedProfileAvatarIds[avatarFailKey]) : false;

    const realAvatar = profileAvatarFailed ? '' : realAvatarSrc;
    const avatarInitials = getUserDisplayName({
      username: chat.receiverUsername,
      name: chat.receiverName,
      email: chat.receiverEmail,
    }).slice(0, 2).toUpperCase();
    return (
      <div
        key={chat.chatId}
        className={active ? 'chat-list-item active' : 'chat-list-item'}
      >
        <div className="chat-item">
          <button
            type="button"
            className="chat-avatar-wrap chat-profile-avatar-btn"
            aria-label={`Open ${getUserDisplayName(chat)}'s profile`}
            onClick={(event) => openUserProfile(chat, event)}
          >
            <div className="chat-avatar-stack">
              {(!realAvatar || !profileAvatarLoaded || profileAvatarFailed) && (
                <div
                  className="chat-avatar chat-avatar-fallback chat-avatar-default"
                  aria-label="Default avatar"
                  title="Default avatar"
                >
                  <span>{avatarInitials || 'US'}</span>
                </div>
              )}
              {realAvatar && !profileAvatarFailed && (
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
                  style={{ opacity: profileAvatarLoaded ? 1 : 0 }}
                  onError={() => {
                    setFailedProfileAvatarIds((prev) => ({
                      ...prev,
                      [avatarFailKey]: true,
                    }));
                  }}
                  onLoad={() => {
                    setLoadedProfileAvatarIds((prev) => ({
                      ...prev,
                      [avatarFailKey]: true,
                    }));

                    setFailedProfileAvatarIds((prev) => {
                      if (!prev[avatarFailKey]) return prev;
                      const next = { ...prev };
                      delete next[avatarFailKey];
                      return next;
                    });

                    if (avatarCacheKey && realAvatarSrc) {
                      setChatAvatarCache((prev) => {
                        const current = prev?.[avatarCacheKey];
                        if (current?.url === realAvatarSrc) return prev;

                        return {
                          ...prev,
                          [avatarCacheKey]: {
                            url: realAvatarSrc,
                            savedAt: Date.now(),
                          },
                        };
                      });
                    }
                  }}
                  data-avatar-url={realAvatarSrc}
                />
              )}
            </div>
          </button>

          <button
            type="button"
            className="chat-content chat-open-chat-btn"
            onClick={() => openChat(chat)}
          >
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
          </button>
        </div>
      </div>
    );
  }),
  [
    activeChat?.chatId,
    chats,
    chatAvatarCache,
    failedProfileAvatarIds,
    loadedProfileAvatarIds,
    openChat,
    openUserProfile,
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
scrollMessagesToBottom(true);

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
scrollMessagesToBottom(true);
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

  const previousMessages = messages;

  setMessages((prev) => {
    const nextMessages = prev.map((item) => {
      if ((item.messageId || item.id) !== messageId) return item;

      return {
        ...item,
        reactions: toggleReactionForUser(item.reactions, emoji, userId),
      };
    });

    setCachedMessages(activeChat.chatId, nextMessages);
    return nextMessages;
  });

  try {
    const data = await withTimeout(
      chatApi.reactToMessage({
        chatId: activeChat.chatId,
        messageId,
        emoji,
      }),
      8000,
      'Reaction took too long.'
    );

    const nextReactions = data?.reactions || data?.message?.reactions;

    if (nextReactions && mountedRef.current) {
      setMessages((prev) => {
        const nextMessages = prev.map((item) =>
          (item.messageId || item.id) === messageId
            ? { ...item, reactions: normalizeReactionMap(nextReactions) }
            : item
        );

        setCachedMessages(activeChat.chatId, nextMessages);
        return nextMessages;
      });
    }
  } catch (err) {
    console.error('Reaction failed:', err);

    if (mountedRef.current) {
      setMessages(previousMessages);
      setCachedMessages(activeChat.chatId, previousMessages);
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
      try {
        setActiveChatOnSocket?.('');
      } catch (err) {
        console.error('Could not clear active chat on socket:', err);
      }
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
        <header className="chat-sidebar-heading">
          <div>
            <span>Inbox</span>
            <h1>Messages</h1>
          </div>
          <span aria-label={`${chats.length} conversations`}>{chats.length}</span>
        </header>

       <div className="chat-search-wrap" ref={searchAreaRef}>
  <form className="chat-search" onSubmit={searchUsers}>
    <input
      placeholder="Search people..."
      value={query}
      autoComplete="off"
      aria-label="Search users"
      onChange={handleQueryChange}
    />
    <button type="submit" disabled={!query.trim() || isSearchingUsers}>
      {isSearchingUsers ? 'Searching…' : 'Search'}
    </button>
  </form>

  {users.length > 0 && (
    <div className="user-results">
      <h3>Search results</h3>
      {users.map((selectedUser) => {
        const resultName = getUserDisplayName(selectedUser);
        const resultAvatar = getUserAvatarUrl(selectedUser);

        return (
          <div
            className="user-result-row"
            key={selectedUser.userId || selectedUser.id || selectedUser.email}
          >
            <button
              type="button"
              className="user-result-avatar"
              aria-label={`Open ${resultName}'s profile`}
              onClick={(event) => openUserProfile(selectedUser, event)}
            >
              {resultAvatar ? (
                <img src={resultAvatar} alt="" loading="lazy" decoding="async" />
              ) : (
                <span>{resultName.slice(0, 2).toUpperCase()}</span>
              )}
            </button>

            <button
              type="button"
              className="user-result-chat"
              onClick={() => startChat(selectedUser)}
            >
              <span className="user-result-copy">
                <strong>{resultName}</strong>
                <span>{selectedUser.email || selectedUser.username || ''}</span>
              </span>
              <span className="user-result-start" aria-hidden="true">+</span>
            </button>
          </div>
        );
      })}
    </div>
  )}
</div>

{status && <p className="chat-status">{status}</p>}


        <div className="chat-list">
          <h3>Recent</h3>
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
              <button
                type="button"
                className="chat-header-avatar chat-profile-avatar-btn"
                aria-label={`Open ${getUserDisplayName(activeChat)}'s profile`}
                onClick={(event) => openUserProfile(activeChat, event)}
              >
                {getUserAvatarUrl(activeChat) ? (
                  <img src={getUserAvatarUrl(activeChat)} alt="" />
                ) : (
                  <span>{getUserDisplayName(activeChat).slice(0, 2).toUpperCase()}</span>
                )}
              </button>
              <div className="chat-info">
               <h2>
  {getUserDisplayName({
    username: activeChat.receiverUsername,
    name: activeChat.receiverName,
    email: activeChat.receiverEmail,
  })}
</h2>

                {status ? (
                  <span className="status-msg">{status}</span>
                ) : (
                  <span className="chat-context-label">Private conversation</span>
                )}
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
                          <ChatMediaPreview
                            msg={msg}
                            onRefreshMediaUrl={refreshMessageMediaUrl}
                            onOpenImage={setFullscreenImage}
                          />
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
  {formatMessageTime(msg.createdAt)}
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
        {['👍', '✅', '👀', '🔖'].map((emoji) => {
          const normalizedReactions = normalizeReactionMap(msg.reactions);
          const reactionUsers = Array.isArray(normalizedReactions[emoji])
            ? normalizedReactions[emoji]
            : [];
          const active = reactionUsers.map((id) => String(id)).includes(String(userId));

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
        {['👍', '👌', '✅', '❌'].map((emoji) => (
          <button key={emoji} type="button" onClick={() => addEmoji(emoji)}>
            {emoji}
          </button>
        ))}
      </div>
   {selectedMediaPreview && (
  <div className={selectedMedia?.type?.startsWith('audio/') || selectedMedia?.name?.startsWith('voice-') ? 'selected-media-card selected-voice-card' : 'selected-media-card'}>
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

<div className="selected-media-details">
  <strong>
    {selectedMedia?.type?.startsWith('audio/') || selectedMedia?.name?.startsWith('voice-')
      ? 'Voice note ready to send'
      : selectedMedia?.name || 'Selected media'}
  </strong>
  <span>
    {selectedMedia?.type?.startsWith('audio/') || selectedMedia?.name?.startsWith('voice-')
      ? 'Preview it, send it, or cancel it.'
      : selectedMedia?.type || 'File ready to send'}
  </span>
</div>

          {selectedMedia?.type?.startsWith('audio/') || selectedMedia?.name?.startsWith('voice-') ? (
<button
  type="button"
  className="voice-ready-cancel-btn"
  disabled={isUploading}
  onClick={cancelSelectedRecording}
>
  Cancel recording
</button>
          ) : (
            <button type="button" disabled={isUploading} onClick={removeSelectedMedia}>
              Remove
            </button>
          )}
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
      {fullscreenImage && (
        <div
          className="image-lightbox"
          onClick={() => setFullscreenImage('')}
        >
          <img
            src={fullscreenImage}
            alt="Expanded preview"
            className="image-lightbox-img"
          />
        </div>
      )}
    </main>
  );
}
