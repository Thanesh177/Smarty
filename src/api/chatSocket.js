let socket = null;
let messageHandler = null;
let connected = false;
let reconnectTimer = null;
let reconnectAttempts = 0;
let currentUserId = '';
let manuallyClosed = false;

const MAX_RECONNECT_ATTEMPTS = 5;
const BASE_RECONNECT_DELAY = 1200;
const MAX_RECONNECT_DELAY = 10000;

const WS_URL = import.meta.env.VITE_WS_CHAT_URL;

const clearReconnectTimer = () => {
  if (reconnectTimer) {
    clearTimeout(reconnectTimer);
    reconnectTimer = null;
  }
};

const safeParseMessage = (value) => {
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
};

const getReconnectDelay = () => {
  const delay = BASE_RECONNECT_DELAY * 2 ** reconnectAttempts;
  return Math.min(delay, MAX_RECONNECT_DELAY);
};

export function connectChatSocket(userId, onMessage) {
  if (!userId) return null;

  manuallyClosed = false;
  currentUserId = userId;

  messageHandler = onMessage;

  if (socket && socket.readyState === WebSocket.OPEN) {
    connected = true;
    return socket;
  }

  if (socket && socket.readyState === WebSocket.CONNECTING) {
    return socket;
  }

  clearReconnectTimer();

  socket = new WebSocket(`${WS_URL}?userId=${encodeURIComponent(userId)}`);

  socket.onopen = () => {
    connected = true;
    reconnectAttempts = 0;

    if (import.meta.env.DEV) {
      console.log('Chat WebSocket connected as:', userId);
    }
  };

  socket.onmessage = (event) => {
    const data = safeParseMessage(event.data);

    if (!data) {
      if (import.meta.env.DEV) {
        console.error('Invalid WebSocket message');
      }
      return;
    }

    if (messageHandler) {
      messageHandler(data);
    }
  };

  socket.onerror = () => {
    if (import.meta.env.DEV) {
      console.error('Chat WebSocket error');
    }
  };

  socket.onclose = () => {
    connected = false;
    socket = null;

    if (import.meta.env.DEV) {
      console.log('Chat WebSocket disconnected');
    }

    if (
      manuallyClosed ||
      !currentUserId ||
      reconnectAttempts >= MAX_RECONNECT_ATTEMPTS
    ) {
      return;
    }

    reconnectAttempts += 1;

    clearReconnectTimer();

    reconnectTimer = setTimeout(() => {
      connectChatSocket(currentUserId, messageHandler);
    }, getReconnectDelay());
  };

  return socket;
}

export function disconnectChatSocket() {
  clearReconnectTimer();
}

export function forceDisconnectChatSocket() {
  manuallyClosed = true;

  clearReconnectTimer();

  if (socket) {
    socket.close();
    socket = null;
  }

  connected = false;
  reconnectAttempts = 0;
  currentUserId = '';
}

const sendSocketPayload = (payload) => {
  if (!socket || socket.readyState !== WebSocket.OPEN) {
    return false;
  }

  try {
    socket.send(JSON.stringify(payload));
    return true;
  } catch {
    return false;
  }
};

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
  sendSocketPayload({
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
  sendSocketPayload({
    action: 'setActiveChat',
    type: 'setActiveChat',
    chatId: chatId || null,
  });
}

export function sendRoomMessage(payload) {
  const success = sendSocketPayload({
    action: 'sendRoomMessage',
    roomId: payload.roomId,
    text: payload.text,
    clientId: payload.clientId,
  });

  if (!success && import.meta.env.DEV) {
    console.warn('WebSocket not connected');
  }
}

export function isChatSocketConnected() {
  return connected && socket?.readyState === WebSocket.OPEN;
}