let socket = null;
let messageHandler = null;
const socketListeners = new Set();

let connected = false;
let reconnectTimer = null;
let heartbeatTimer = null;
let reconnectAttempts = 0;
let currentUserId = '';
let currentActiveChatId = '';
let manuallyClosed = false;
let lastUrl = '';
let outboundQueue = [];

const MAX_RECONNECT_ATTEMPTS = 10;
const BASE_RECONNECT_DELAY = 1000;
const MAX_RECONNECT_DELAY = 12000;
const HEARTBEAT_INTERVAL = 25000;
const MAX_QUEUE_SIZE = 30;

const WS_URL = import.meta.env.VITE_WS_CHAT_URL;

const clearReconnectTimer = () => {
  if (reconnectTimer) {
    clearTimeout(reconnectTimer);
    reconnectTimer = null;
  }
};

const clearHeartbeatTimer = () => {
  if (heartbeatTimer) {
    clearInterval(heartbeatTimer);
    heartbeatTimer = null;
  }
};

const hasSocketDemand = () => {
  return Boolean(messageHandler) || socketListeners.size > 0 || outboundQueue.length > 0;
};

const closeSocketIfIdle = () => {
  if (!socket) return;
  if (hasSocketDemand()) return;

  manuallyClosed = true;
  clearReconnectTimer();
  clearHeartbeatTimer();

  try {
    socket.close(1000, 'Idle socket');
  } catch {
    // ignore close errors
  }

  socket = null;
  connected = false;
  reconnectAttempts = 0;
  currentUserId = '';
  currentActiveChatId = '';
  lastUrl = '';
};

const safeParseMessage = (value) => {
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
};

const getReconnectDelay = () => {
  const exponentialDelay = BASE_RECONNECT_DELAY * 2 ** Math.max(0, reconnectAttempts - 1);
  const jitter = Math.floor(Math.random() * 350);
  return Math.min(exponentialDelay + jitter, MAX_RECONNECT_DELAY);
};

const getSocketUrl = (userId) => {
  if (!WS_URL) return '';
  return `${WS_URL}?userId=${encodeURIComponent(userId)}`;
};

const flushQueue = () => {
  if (!socket || socket.readyState !== WebSocket.OPEN) return;

  const queued = [...outboundQueue];
  outboundQueue = [];

  queued.forEach((payload) => {
    sendSocketPayload(payload, { queueIfClosed: false });
  });
};

const startHeartbeat = () => {
  clearHeartbeatTimer();

  heartbeatTimer = setInterval(() => {
    sendSocketPayload(
      {
        action: 'ping',
        type: 'ping',
        timestamp: Date.now(),
      },
      { queueIfClosed: false }
    );
  }, HEARTBEAT_INTERVAL);
};

const scheduleReconnect = () => {
  if (manuallyClosed || !currentUserId || !hasSocketDemand()) return;

  if (reconnectAttempts >= MAX_RECONNECT_ATTEMPTS) {
    if (import.meta.env.DEV) {
      console.error('Chat WebSocket max reconnect attempts reached');
    }
    return;
  }

  reconnectAttempts += 1;
  clearReconnectTimer();

  reconnectTimer = setTimeout(() => {
    connectChatSocket(currentUserId, messageHandler);
  }, getReconnectDelay());
};

export function connectChatSocket(userId, onMessage) {
  if (!userId) return null;

  if (!WS_URL) {
    if (import.meta.env.DEV) {
      console.error('VITE_WS_CHAT_URL is missing. Chat WebSocket cannot connect.');
    }
    return null;
  }

  manuallyClosed = false;
  currentUserId = userId;

  if (typeof onMessage === 'function') {
    messageHandler = onMessage;
  }

  const nextUrl = getSocketUrl(userId);

  if (
    socket &&
    (socket.readyState === WebSocket.OPEN || socket.readyState === WebSocket.CONNECTING) &&
    lastUrl === nextUrl
  ) {
    connected = socket.readyState === WebSocket.OPEN;
    return socket;
  }

  if (socket && lastUrl !== nextUrl) {
    try {
      socket.close(1000, 'Switching user');
    } catch {
      // ignore close errors
    }

    socket = null;
    connected = false;
  }

  clearReconnectTimer();
  clearHeartbeatTimer();

  lastUrl = nextUrl;
  socket = new WebSocket(nextUrl);

  socket.onopen = () => {
    connected = true;
    reconnectAttempts = 0;

    if (import.meta.env.DEV) {
      console.log('Chat WebSocket connected as:', userId);
    }

    startHeartbeat();

    if (currentActiveChatId) {
      sendSocketPayload(
        {
          action: 'setActiveChat',
          type: 'setActiveChat',
          chatId: currentActiveChatId,
        },
        { queueIfClosed: false }
      );
    }

    flushQueue();
  };

  socket.onmessage = (event) => {
    const data = safeParseMessage(event.data);

    if (!data) {
      if (import.meta.env.DEV) {
        console.error('Invalid WebSocket message');
      }
      return;
    }

    if (data.type === 'pong' || data.action === 'pong') return;

    if (messageHandler) {
      messageHandler(data);
    }

    socketListeners.forEach((listener) => {
      try {
        listener(data);
      } catch (listenerError) {
        if (import.meta.env.DEV) {
          console.error('Chat WebSocket listener error:', listenerError);
        }
      }
    });
  };

  socket.onerror = () => {
    if (import.meta.env.DEV) {
      console.error('Chat WebSocket error');
    }
  };

  socket.onclose = () => {
    connected = false;
    socket = null;
    clearHeartbeatTimer();

    if (import.meta.env.DEV) {
      console.log('Chat WebSocket disconnected');
    }

    if (!hasSocketDemand()) {
      currentUserId = '';
      currentActiveChatId = '';
      lastUrl = '';
      reconnectAttempts = 0;
      return;
    }

    scheduleReconnect();
  };

  return socket;
}

export function disconnectChatSocket() {
  // Soft disconnect.
  // Do not close the socket here because App.jsx uses it globally for badges.
  clearReconnectTimer();
  currentActiveChatId = '';
  messageHandler = null;
  closeSocketIfIdle();
}

export function forceDisconnectChatSocket() {
  manuallyClosed = true;

  clearReconnectTimer();
  clearHeartbeatTimer();

  if (socket) {
    try {
      socket.close(1000, 'Manual disconnect');
    } catch {
      // ignore close errors
    }

    socket = null;
  }

  connected = false;
  reconnectAttempts = 0;
  currentUserId = '';
  currentActiveChatId = '';
  lastUrl = '';
  messageHandler = null;
  socketListeners.clear();
  outboundQueue = [];
}

function sendSocketPayload(payload, options = {}) {
  const { queueIfClosed = true } = options;

  if (!payload || typeof payload !== 'object') return false;

  if (!socket || socket.readyState !== WebSocket.OPEN) {
    if (queueIfClosed) {
      const clientId = payload.clientId || '';

      if (clientId) {
        outboundQueue = outboundQueue.filter((item) => item.clientId !== clientId);
      }

      outboundQueue.push(payload);

      if (outboundQueue.length > MAX_QUEUE_SIZE) {
        outboundQueue = outboundQueue.slice(-MAX_QUEUE_SIZE);
      }

      if (currentUserId && !manuallyClosed) {
        connectChatSocket(currentUserId, messageHandler);
      }
    }

    return false;
  }

  try {
    socket.send(JSON.stringify(payload));
    return true;
  } catch {
    return false;
  }
}

export function sendChatMessage({
  chatId,
  receiverId,
  text = '',
  mediaKey = '',
  mediaUrl = '',
  mediaName = '',
  mediaType = '',
  clientId = '',
}) {
  return sendSocketPayload({
    action: 'sendMessage',
    chatId,
    receiverId,
    text,
    mediaKey,
    mediaUrl,
    mediaName,
    mediaType,
    clientId,
  });
}

export function setActiveChat(chatId) {
  currentActiveChatId = String(chatId || '');

  return sendSocketPayload({
    action: 'setActiveChat',
    type: 'setActiveChat',
    chatId: currentActiveChatId,
  });
}

export function setActiveChatOnSocket(chatId = '') {
  return setActiveChat(chatId);
}

export function sendRoomMessage(payload = {}) {
  const success = sendSocketPayload({
    action: 'sendRoomMessage',
    roomId: payload.roomId,
    text: payload.text || '',
    mediaKey: payload.mediaKey || '',
    mediaUrl: payload.mediaUrl || payload.fileUrl || '',
    fileUrl: payload.fileUrl || payload.mediaUrl || '',
    mediaType: payload.mediaType || '',
    contentType: payload.contentType || '',
    fileName: payload.fileName || payload.mediaName || '',
    mediaName: payload.mediaName || payload.fileName || '',
    clientId: payload.clientId || '',
  });

  if (!success && import.meta.env.DEV) {
    console.warn('WebSocket not connected. Room message queued if possible.');
  }

  return success;
}

export function subscribeChatSocket(listener) {
  if (typeof listener !== 'function') {
    return () => {};
  }

  socketListeners.add(listener);

  return () => {
    socketListeners.delete(listener);
    closeSocketIfIdle();
  };
}

export function isChatSocketConnected() {
  return connected && socket?.readyState === WebSocket.OPEN;
}

export function getChatSocketState() {
  return {
    connected: isChatSocketConnected(),
    readyState: socket?.readyState ?? null,
    reconnectAttempts,
    currentUserId,
    currentActiveChatId,
    queuedMessages: outboundQueue.length,
  };
}