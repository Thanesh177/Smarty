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

function AudioMiniPlayer({ src, title = 'Voice note', onError }) {
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
}

// ===== ChatMediaPreview component =====
function ChatMediaPreview({ msg, onRefreshMediaUrl }) {
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
          onError={refreshMedia}
        />
      ) : mediaKind === 'video' ? (
        <video src={mediaSource} controls playsInline onError={refreshMedia} />
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
}

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
    scrollMessagesToBottom();
  }, [chats]);

  useEffect(() => {
    return () => {
      localStorage.removeItem('activeChatId');
    };
  }, []);

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

        const isOwnMessage = msg.senderId === userId;

        if (isOwnMessage) {
          const matchingLocalIndex = prev.findIndex(
            (m) =>
              (m.clientId && msg.clientId && m.clientId === msg.clientId) ||
              (
                String(m.messageId || '').startsWith('local-') &&
                m.text === msg.text &&
                (
                  (m.mediaKey || '') === (msg.mediaKey || '') ||
                  (m.mediaUrl || '') === (msg.mediaUrl || '')
                ) &&
                Math.abs(Number(m.createdAt || 0) - Number(msg.createdAt || Date.now())) < 15000
              )
          );

          if (matchingLocalIndex !== -1) {
            return prev.map((m, index) =>
              index === matchingLocalIndex
                ? {
                    ...msg,
                    isMine: true,
                  }
                : m
            );
          }
        }

        return [
          ...prev,
          {
            ...msg,
            isMine: isOwnMessage,
          },
        ];
      });

      scrollMessagesToBottom();
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
  setOpenReactionMenuId(null);
  setEditingMessageId(null);
  setEditingText('');
  setIsBlocked(chat?.isBlocked || false);

  try {
    if (chatApi.markAsRead) {
      await chatApi.markAsRead(chat.chatId);
    }
  } catch (e) {
    console.error('Mark as read failed', e);
  }

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

    setTimeout(scrollMessagesToBottom, 50);

    setChats((prev) =>
      prev.map((item) =>
        item.chatId === chat.chatId ? { ...item, unreadCount: 0 } : item
      )
    );

    window.dispatchEvent(new Event('chat-unread-refresh'));
    scrollMessagesToBottom();
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

      setActiveChat({
        ...chat,
        receiverUsername: chat.receiverUsername || selectedUser.username || selectedUser.userName,
        receiverName: chat.receiverName || selectedUser.name || selectedUser.username,
        receiverEmail: chat.receiverEmail || selectedUser.email,
      });
      localStorage.setItem('activeChatId', chat.chatId);
      setMobileChatOpen(true);
      setOpenReactionMenuId(null);
      setEditingMessageId(null);
      setEditingText('');
      setUsers([]);
      setQuery('');

      const data = await chatApi.getMessages(chat.chatId);
      setMessages(
        data.map((msg) => ({
          ...msg,
          isMine: msg.senderId === userId,
        }))
      );

      setTimeout(scrollMessagesToBottom, 50);

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

  const addEmoji = (emoji) => {
  setText((prev) => `${prev}${emoji}`);
};

const handleMediaSelect = (event) => {
  const file = event.target.files?.[0];
  if (!file) return;

  if (selectedMediaPreview) URL.revokeObjectURL(selectedMediaPreview);

  setSelectedMedia(file);
  setSelectedMediaPreview(URL.createObjectURL(file));
  setShowComposerTools(true);
};

const handleDrop = (e) => {
  e.preventDefault();
  const file = e.dataTransfer.files?.[0];
  if (!file) return;

  if (selectedMediaPreview) URL.revokeObjectURL(selectedMediaPreview);

  setSelectedMedia(file);
  setSelectedMediaPreview(URL.createObjectURL(file));
  setShowComposerTools(true);
};

const handleDragOver = (e) => {
  e.preventDefault();
};

const removeSelectedMedia = (shouldRevoke = true) => {
  if (shouldRevoke && selectedMediaPreview) {
    URL.revokeObjectURL(selectedMediaPreview);
  }

  setSelectedMedia(null);
  setSelectedMediaPreview('');

  if (mediaInputRef.current) {
    mediaInputRef.current.value = '';
  }
};

const refreshMessageMediaUrl = async (msg) => {
  if (!msg?.mediaKey) return '';

  const data = await chatApi.getMediaViewUrl({
    mediaKey: msg.mediaKey,
  });

  const freshUrl = data?.mediaUrl || data?.fileUrl || data?.url || '';

  if (!freshUrl) return '';

  setMessages((prev) =>
    prev.map((item) =>
      (item.messageId || item.id) === (msg.messageId || msg.id)
        ? { ...item, mediaUrl: freshUrl }
        : item
    )
  );

  return freshUrl;
};

const startVoiceRecording = async () => {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });

    const recorder = new MediaRecorder(stream);
    audioChunksRef.current = [];

    recorder.ondataavailable = (event) => {
      if (event.data.size > 0) {
        audioChunksRef.current.push(event.data);
      }
    };

    recorder.onstop = () => {
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
      setRecordingSeconds((prev) => prev + 1);
    }, 1000);
  } catch (err) {
    console.error('Voice recording failed:', err);
    setStatus('Microphone permission denied.');
  }
};

const stopVoiceRecording = () => {
  if (mediaRecorder && mediaRecorder.state !== 'inactive') {
    mediaRecorder.stop();
  }

  setIsRecording(false);
  setMediaRecorder(null);

  if (recordingTimerRef.current) {
    clearInterval(recordingTimerRef.current);
    recordingTimerRef.current = null;
  }
};

const cancelVoiceRecording = () => {
  if (mediaRecorder && mediaRecorder.state !== 'inactive') {
    mediaRecorder.stop();
  }

  audioChunksRef.current = [];
  setIsRecording(false);
  setMediaRecorder(null);
  setRecordingSeconds(0);

  if (recordingTimerRef.current) {
    clearInterval(recordingTimerRef.current);
    recordingTimerRef.current = null;
  }
};

const sendMessage = async (e) => {
  e.preventDefault();

  if ((!text.trim() && !selectedMedia) || !activeChat || isBlocked || isUploading) return;

  const cleanText = text.trim();
  const clientId = `local-${Date.now()}`;
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

      const uploadData = await chatApi.getMediaUploadUrl({
        fileName: selectedMedia.name,
        fileType: selectedMedia.type,
      });

      const uploadUrl = uploadData?.uploadUrl || '';
      mediaKey = uploadData?.mediaKey || uploadData?.key || '';
      mediaUrl = uploadData?.mediaUrl || uploadData?.fileUrl || '';

      if (!uploadUrl || !mediaKey) {
        throw new Error('Upload URL or media key missing');
      }

      const uploadRes = await fetch(uploadUrl, {
        method: 'PUT',
        body: selectedMedia,
        headers: {
          'Content-Type': selectedMedia.type || 'application/octet-stream',
        },
      });

      if (!uploadRes.ok) {
        throw new Error('Media upload failed');
      }
    }

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

    setMessages((prev) => [...prev, tempMessage]);
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

    window.setTimeout(() => {
      setIsUploading(false);
      setUploadProgress(0);
    }, selectedMedia ? 350 : 0);

    setText('');
    removeSelectedMedia(false);
    setShowComposerTools(false);
    scrollMessagesToBottom();
  } catch (err) {
    if (progressTimer) window.clearInterval(progressTimer);
    setIsUploading(false);
    setUploadProgress(0);
    console.error('Message send failed:', err);
    setStatus(err.message || 'Message failed.');
  }
};
const reactToMessage = async (msg, emoji) => {
  const messageId = msg.messageId || msg.id;
  if (!messageId || String(messageId).startsWith('local-') || !activeChat) return;

  setMessages((prev) =>
    prev.map((item) => {
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
    })
  );

  try {
    await chatApi.reactToMessage({
      chatId: activeChat.chatId,
      messageId,
      emoji,
    });
  } catch (err) {
    console.error('Reaction failed:', err);

    setMessages((prev) =>
      prev.map((item) => {
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
      })
    );

    setStatus(err?.response?.status === 401 ? 'Reaction route is not authorized. Check API Gateway auth for /messages/react.' : 'Could not react to message.');
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

  const previousMessages = messages;

  setMessages((prev) =>
    prev.map((item) =>
      (item.messageId || item.id) === messageId
        ? { ...item, text: nextText, message: nextText, editedAt: Date.now() }
        : item
    )
  );

  setEditingMessageId(null);
  setEditingText('');

  try {
    await chatApi.editMessage({
      chatId: activeChat.chatId,
      messageId,
      text: nextText,
    });
  } catch (err) {
    console.error('Edit message failed:', err);
    setMessages(previousMessages);
    setStatus('Could not edit message.');
  }
};

const deleteMessage = async (msg) => {
  const messageId = msg.messageId || msg.id;
  if (!messageId || String(messageId).startsWith('local-') || !activeChat || !msg.isMine) return;

  if (!window.confirm('Delete this message?')) return;

  const previousMessages = messages;

  setOpenReactionMenuId(null);
  setEditingMessageId(null);
  setEditingText('');

  setMessages((prev) =>
    prev.map((item) =>
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
    )
  );

  try {
    await chatApi.deleteMessage({
      chatId: activeChat.chatId,
      messageId,
    });
  } catch (err) {
    console.error('Delete message failed:', err);
    setMessages(previousMessages);
    setStatus('Could not delete message.');
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
      setOpenReactionMenuId(null);
      setEditingMessageId(null);
      setEditingText('');
      localStorage.removeItem('activeChatId');
      setMessages([]);
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
      onChange={(e) => setQuery(e.target.value)}
    />
    <button type="submit">Search</button>
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
            chats.map((chat) => (
              <button
                key={chat.chatId}
                type="button"
                className={activeChat?.chatId === chat.chatId ? 'active' : ''}
                onClick={() => openChat(chat)}
              >

<div className="chat-item">
  <img
    className="chat-avatar"
    src={
      chat.receiverAvatar ||
      chat.receiverPhoto ||
      chat.receiverImage ||
      chat.profilePicture ||
      `https://ui-avatars.com/api/?name=${encodeURIComponent(
        getUserDisplayName({ username: chat.receiverUsername, name: chat.receiverName, email: chat.receiverEmail })
      )}&background=7dd3fc&color=07111f&bold=true`
    }
    alt=""
    loading="lazy"
    referrerPolicy="no-referrer"
  />

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
      {activeChat?.chatId !== chat.chatId && Number(chat.unreadCount) > 0 && (
        <span className="unread-badge">{chat.unreadCount}</span>
      )}
    </div>
  </div>
</div>
              </button>
            ))
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
                onClick={() => {
                  setMobileChatOpen(false);
                  setActiveChat(null);
                  setOpenReactionMenuId(null);
                  setEditingMessageId(null);
                  setEditingText('');
                  localStorage.removeItem('activeChatId');
                  setMessages([]);
                }}
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
    onClick={() => setActionsOpen((prev) => !prev)}
    aria-label="Chat actions"
    aria-expanded={actionsOpen}
  >
    ⋮
  </button>

  {actionsOpen && (
    <div className="chat-actions-menu">
      <button className="btn-report" type="button" onClick={handleReportUser}>
        Report
      </button>
      <button className="btn-block" type="button" onClick={handleBlockUser}>
        {isBlocked ? 'Unblock' : 'Block'}
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

                    {group.messages.map((msg) => (
                      <div
                        key={msg.messageId || msg.id}
                        className={msg.isMine ? 'message mine' : 'message'}
                      >
                        {(msg.mediaUrl || msg.mediaPreview || msg.mediaKey) && (
                          <ChatMediaPreview msg={msg} onRefreshMediaUrl={refreshMessageMediaUrl} />
                        )}

{editingMessageId === (msg.messageId || msg.id) ? (
  <div className="message-edit-box">
    <input
      value={editingText}
      onChange={(event) => setEditingText(event.target.value)}
      autoFocus
    />
    <div className="message-edit-actions">
      <button type="button" onClick={() => saveEditedMessage(msg)}>Save</button>
      <button type="button" onClick={cancelEditMessage}>Cancel</button>
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

      {msg.isMine && !msg.isDeleted && !String(msg.messageId || msg.id || '').startsWith('local-') && (
        <div className="message-action-row">
          {(msg.text || msg.message) && (
            <button type="button" onClick={() => startEditMessage(msg)}>
              Edit
            </button>
          )}
          <button type="button" className="message-delete-btn" onClick={() => deleteMessage(msg)}>
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
            <img src={selectedMediaPreview} alt={selectedMedia?.name || 'Selected media'} />
          ) : selectedMedia?.type?.startsWith('video/') ? (
            <video src={selectedMediaPreview} controls playsInline />
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

          <button type="button" onClick={removeSelectedMedia}>✕</button>
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
      disabled={isBlocked}
    />

    <button type="button" className="composer-icon-btn" onClick={() => mediaInputRef.current?.click()}>
      ＋
    </button>

    {/* <button type="button" className="composer-icon-btn" onClick={() => setShowComposerTools((prev) => !prev)}>
      ☺
    </button> */}

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