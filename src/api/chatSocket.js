let socket = null;
let messageHandler = null;
let connected = false;

const WS_URL = import.meta.env.VITE_WS_CHAT_URL;

export function connectChatSocket(userId, onMessage) {
  if (!userId) return null;

  messageHandler = onMessage;

  if (socket && socket.readyState === WebSocket.OPEN) {
    connected = true;
    return socket;
  }

  if (socket && socket.readyState === WebSocket.CONNECTING) {
    return socket;
  }

  socket = new WebSocket(`${WS_URL}?userId=${encodeURIComponent(userId)}`);

  socket.onopen = () => {
    connected = true;
    console.log('Chat WebSocket connected as:', userId);
  };

  socket.onmessage = (event) => {
    try {
      const data = JSON.parse(event.data);
      if (messageHandler) messageHandler(data);
    } catch (err) {
      console.error('Invalid WebSocket message:', err);
    }
  };

  socket.onerror = (event) => {
    console.error('Chat WebSocket error:', event);
  };

  socket.onclose = () => {
    connected = false;
    console.log('Chat WebSocket disconnected');
  };

  return socket;
}

export function disconnectChatSocket() {
  // Do not close immediately while moving between pages/components
  // This prevents React dev mode from killing the socket.
}

export function forceDisconnectChatSocket() {
  if (socket) {
    socket.close();
    socket = null;
    connected = false;
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
  if (!socket || socket.readyState !== WebSocket.OPEN) return;

  socket.send(
    JSON.stringify({
      action: 'sendMessage',
      chatId,
      receiverId,
      text,
      mediaKey,
      mediaUrl,
      mediaName,
      mediaType,
      clientId,
    })
  );
}

export function setActiveChat(chatId) {
  if (!socket || socket.readyState !== WebSocket.OPEN) {
    return;
  }

  socket.send(
    JSON.stringify({
      action: 'setActiveChat',
      type: 'setActiveChat',
      chatId: chatId || null,
    })
  );
}

export function sendRoomMessage(payload) {
  if (!socket || socket.readyState !== WebSocket.OPEN) {
    console.warn('WebSocket not connected');
    return;
  }

  socket.send(
    JSON.stringify({
      action: 'sendRoomMessage',
      roomId: payload.roomId,
      text: payload.text,
      clientId: payload.clientId,
    })
  );
}

export function isChatSocketConnected() {
  return connected && socket?.readyState === WebSocket.OPEN;
}