import { useEffect, useMemo, useRef, useState } from 'react';
import { Download } from 'lucide-react';
import { roomApi } from '../api/client';
import RoomMediaPreview from './RoomMediaPreview';

const ROOM_MESSAGES_FETCH_LIMIT = 10;
const ROOM_INITIAL_VISIBLE_MESSAGES = 10;
const ROOM_MEDIA_GRID_INITIAL_ITEMS = 24;
const ROOM_MEDIA_GRID_LOAD_STEP = 18;
const MAX_RENDERED_MEDIA_MESSAGES = 260;
const MAX_MEDIA_SCAN_MESSAGES = 1200;
const MAX_ROOM_MEDIA_GRID_ITEMS = 2000;

const ROOM_MEDIA_IMAGE_EXTENSIONS = /\.(jpg|jpeg|png|webp|gif|avif)(\?|#|$)/i;
const ROOM_MEDIA_VIDEO_EXTENSIONS = /\.(mp4|webm|mov|m4v)(\?|#|$)/i;
const ROOM_MEDIA_DOCUMENT_EXTENSIONS = /\.(pdf|doc|docx|ppt|pptx|xls|xlsx|csv|txt|rtf|zip|rar)(\?|#|$)/i;
const ROOM_MEDIA_ALLOWED_TYPES = /^(image\/|video\/|application\/pdf|application\/msword|application\/vnd\.openxmlformats-officedocument|application\/vnd\.ms-|text\/plain|text\/csv|application\/zip|application\/x-zip-compressed|application\/x-rar-compressed)/i;

function parseApiPayload(payload) {
  let parsedPayload = payload;
  try {
    parsedPayload = typeof payload === 'string' ? JSON.parse(payload) : payload;
  } catch {
    parsedPayload = payload;
  }

  let parsedBody = parsedPayload?.body;
  try {
    parsedBody = typeof parsedBody === 'string' ? JSON.parse(parsedBody) : parsedBody;
  } catch {
    parsedBody = parsedPayload?.body;
  }

  return { payload: parsedPayload, body: parsedBody };
}

function extractRoomArray(data, keys = []) {
  const { payload, body } = parseApiPayload(data);
  const responseData = body?.data || payload?.data || body || payload || data || {};

  for (const key of keys) {
    if (Array.isArray(data?.[key])) return data[key];
    if (Array.isArray(payload?.[key])) return payload[key];
    if (Array.isArray(body?.[key])) return body[key];
    if (Array.isArray(responseData?.[key])) return responseData[key];
    if (Array.isArray(responseData?.data?.[key])) return responseData.data[key];
  }

  if (Array.isArray(responseData?.Items)) return responseData.Items;
  if (Array.isArray(data)) return data;
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(body)) return body;
  if (Array.isArray(responseData)) return responseData;

  return [];
}

function getRoomMessageTimeValue(message = {}) {
  const rawValue =
    message.createdAtMs ||
    message.createdAt ||
    message.timestamp ||
    message.sentAt ||
    0;

  if (typeof rawValue === 'number') return rawValue;

  const numericValue = Number(rawValue);
  if (Number.isFinite(numericValue) && numericValue > 0) return numericValue;

  const parsedValue = Date.parse(String(rawValue || ''));
  return Number.isFinite(parsedValue) ? parsedValue : 0;
}

function sortRoomMessages(messages = []) {
  return [...messages].sort((a, b) => getRoomMessageTimeValue(a) - getRoomMessageTimeValue(b));
}

function normalizeRoomMessageMedia(message = {}) {
  const mediaUrl = String(
    message.mediaUrl ||
      message.fileUrl ||
      message.url ||
      message.attachmentUrl ||
      message.downloadUrl ||
      message.location ||
      ''
  ).trim();

  const contentType = String(message.contentType || message.mimeType || message.type || '').trim();

  const fileName = String(
    message.fileName ||
      message.mediaName ||
      message.name ||
      (mediaUrl ? mediaUrl.split('/').filter(Boolean).pop()?.split('?')[0] : '') ||
      ''
  ).trim();

  const lowerUrl = String(mediaUrl || fileName || '').toLowerCase();
  let mediaType = message.mediaType || '';

  if (mediaUrl) {
    if (String(contentType).startsWith('image/') || ROOM_MEDIA_IMAGE_EXTENSIONS.test(lowerUrl)) {
      mediaType = 'image';
    } else if (String(contentType).startsWith('video/') || ROOM_MEDIA_VIDEO_EXTENSIONS.test(lowerUrl)) {
      mediaType = 'video';
    } else if (
      mediaType === 'document' ||
      mediaType === 'attachment' ||
      mediaType === 'file' ||
      ROOM_MEDIA_DOCUMENT_EXTENSIONS.test(lowerUrl) ||
      ROOM_MEDIA_ALLOWED_TYPES.test(String(contentType))
    ) {
      mediaType = 'file';
    }
  }

  if (mediaType !== 'image' && mediaType !== 'video' && mediaType !== 'file') {
    mediaType = '';
  }

  return {
    ...message,
    mediaKey: message.mediaKey || message.key || '',
    mediaUrl,
    fileUrl: message.fileUrl || message.mediaUrl || mediaUrl,
    mediaType,
    contentType,
    fileName,
    mediaName: message.mediaName || fileName,
  };
}

function dedupeMessages(messages = []) {
  const seen = new Set();
  const unique = [];

  for (const msg of messages) {
    const key =
      msg.messageId ||
      msg.clientId ||
      `${msg.createdAt || 'msg'}-${msg.senderId || 'user'}-${String(msg.text || msg.message || '')}`;

    if (!key || seen.has(key)) continue;

    seen.add(key);
    unique.push(msg);
  }

  return unique;
}

function trimRoomMessagesForMemory(messages = []) {
  const normalizedMessages = Array.isArray(messages)
    ? sortRoomMessages(dedupeMessages(messages.map(normalizeRoomMessageMedia)))
    : [];

  if (normalizedMessages.length <= MAX_RENDERED_MEDIA_MESSAGES) return normalizedMessages;
  return normalizedMessages.slice(-MAX_RENDERED_MEDIA_MESSAGES);
}

function prepareRoomMessagesForMediaScan(messages = []) {
  const normalizedMessages = Array.isArray(messages)
    ? sortRoomMessages(dedupeMessages(messages.map(normalizeRoomMessageMedia)))
    : [];

  if (normalizedMessages.length <= MAX_MEDIA_SCAN_MESSAGES) return normalizedMessages;
  return normalizedMessages.slice(-MAX_MEDIA_SCAN_MESSAGES);
}

function getLoadedRoomMessages(data) {
  return extractRoomArray(data, ['messages', 'Items']).map(normalizeRoomMessageMedia);
}

function getOldestMessageCursor(messages = []) {
  const sortedMessages = sortRoomMessages(Array.isArray(messages) ? messages : []);
  const firstMessage = sortedMessages[0] || null;

  return (
    firstMessage?.createdAtMs ||
    firstMessage?.createdAt ||
    firstMessage?.messageId ||
    firstMessage?.clientId ||
    ''
  );
}

function getRoomMediaCacheKey(message = {}) {
  return (
    message.messageId ||
    message.clientId ||
    message.mediaKey ||
    message.mediaUrl ||
    message.fileUrl ||
    ''
  );
}

function mergeRoomMediaMessages(currentMedia = [], nextMessages = []) {
  const mediaMap = new Map();

  [...currentMedia, ...nextMessages.map(normalizeRoomMessageMedia)].forEach((message) => {
    const mediaUrl = message.mediaUrl || message.fileUrl || '';

    if (!mediaUrl || !['image', 'video', 'file'].includes(message.mediaType)) return;

    const key = getRoomMediaCacheKey(message);
    if (!key || mediaMap.has(key)) return;

    mediaMap.set(key, message);
  });

  return Array.from(mediaMap.values())
    .sort((a, b) => getRoomMessageTimeValue(b) - getRoomMessageTimeValue(a))
    .slice(0, MAX_ROOM_MEDIA_GRID_ITEMS);
}

function getStableRoomMessageKey(message = {}) {
  return String(
    message.messageId ||
      message.id ||
      message.clientId ||
      message.mediaKey ||
      message.mediaUrl ||
      message.fileUrl ||
      `${message.createdAt || message.createdAtMs || 'msg'}-${message.senderId || 'user'}`
  );
}

function areRoomMediaItemsSame(a = {}, b = {}) {
  const keys = ['messageId', 'id', 'clientId', 'mediaKey', 'mediaUrl', 'fileUrl'];

  return keys.some((key) => {
    const aValue = String(a[key] || '').trim();
    const bValue = String(b[key] || '').trim();
    return aValue && bValue && aValue === bValue;
  });
}


export default function RoomMediaModal({
  show,
  activeRoom,
  messages,
  messagesLoading,
  hasOlderMessages,
  roomMediaCacheRef,
  roomMessagesCacheRef,
  messagesStateRef,
  mountedRef,
  loadOlderRoomMessages,
  setMessages,
  setMessagesLoading,
  setHasOlderMessages,
  setStatus,
  onClose,
  onOpenGrid,
  registerMediaViewerOpener,
}) {
  const [mediaViewer, setMediaViewer] = useState(null);
  const [roomMediaGridVisibleCount, setRoomMediaGridVisibleCount] = useState(ROOM_MEDIA_GRID_INITIAL_ITEMS);

  const roomMediaGridListRef = useRef(null);
  const roomMediaGridLoadOlderRef = useRef(false);
  const mediaViewerTouchStartRef = useRef(null);
  const mediaViewerTapTimeoutRef = useRef(null);
  const mediaViewerLastTapRef = useRef(0);
  const mediaViewerLongPressTimeoutRef = useRef(null);
  const mediaViewerLongPressActiveRef = useRef(false);
  const mediaViewerSeekModeRef = useRef(null);
  const mediaViewerVideoRef = useRef(null);
  const mediaFetchInFlightRef = useRef(false);
  const mediaFetchCursorRef = useRef('');
  const mediaFetchDoneRef = useRef(false);

  const renderedMediaMessages = useMemo(() => {
    const roomId = activeRoom?.roomId;
    if (!roomId) return [];

    const cachedMedia = roomMediaCacheRef.current[roomId] || [];
    const cachedRoomMessages = roomMessagesCacheRef?.current?.[roomId] || [];
    const visibleMessages = Array.isArray(messages) ? messages : [];
    const stateMessages = Array.isArray(messagesStateRef?.current) ? messagesStateRef.current : [];

    const mergedMedia = mergeRoomMediaMessages(cachedMedia, [
      ...cachedRoomMessages,
      ...stateMessages,
      ...visibleMessages,
    ]);

    roomMediaCacheRef.current[roomId] = mergedMedia;
    return mergedMedia;
  }, [activeRoom?.roomId, messages, roomMediaCacheRef, roomMessagesCacheRef, messagesStateRef]);

  const visibleRoomMediaMessages = useMemo(
    () => renderedMediaMessages.slice(0, roomMediaGridVisibleCount),
    [renderedMediaMessages, roomMediaGridVisibleCount]
  );

  const viewableMediaMessages = useMemo(
    () => renderedMediaMessages.filter((item) => item.mediaType === 'image' || item.mediaType === 'video'),
    [renderedMediaMessages]
  );

  const mediaViewerCount = viewableMediaMessages.length;

  const activeMediaViewerIndex = mediaViewer
    ? (() => {
        const targetKey = String(mediaViewer.mediaKey || '').trim();

        const foundByKeyIndex = targetKey
          ? viewableMediaMessages.findIndex((item) => getStableRoomMessageKey(item) === targetKey)
          : -1;

        if (foundByKeyIndex >= 0) return foundByKeyIndex;

        return Math.min(
          Math.max(Number(mediaViewer.index || 0), 0),
          Math.max(viewableMediaMessages.length - 1, 0)
        );
      })()
    : -1;

  const activeMediaViewerItem = mediaViewer
    ? viewableMediaMessages[activeMediaViewerIndex] || null
    : null;


  async function ensureRoomMediaGridHasContent(options = {}) {
    if (!activeRoom?.roomId || mediaFetchInFlightRef.current) return;

    const roomId = activeRoom.roomId;
    const appendMode = Boolean(options.append);

    if (!appendMode) {
      mediaFetchCursorRef.current = '';
      mediaFetchDoneRef.current = false;
    }

    if (appendMode && mediaFetchDoneRef.current) return;

    mediaFetchInFlightRef.current = true;

    try {
      setMessagesLoading(true);

      let allMessages = prepareRoomMessagesForMediaScan([
        ...(roomMessagesCacheRef?.current?.[roomId] || []),
        ...(Array.isArray(messagesStateRef?.current) ? messagesStateRef.current : []),
        ...(Array.isArray(messages) ? messages : []),
      ]);

      let mergedMedia = mergeRoomMediaMessages(roomMediaCacheRef.current[roomId] || [], allMessages);
      let cursor = appendMode && mediaFetchCursorRef.current
        ? mediaFetchCursorRef.current
        : getOldestMessageCursor(allMessages);

      const fetchLimit = 80;
      const maxPages = appendMode ? 1 : 8;

      for (let page = 0; page < maxPages; page += 1) {
        const params = { limit: fetchLimit };

        if (cursor) {
          params.before = cursor;
          params.beforeMessageId = cursor;
          params.cursor = cursor;
        }

        const data = await roomApi.getRoomMessages(roomId, params);
        if (!mountedRef.current || activeRoom?.roomId !== roomId) return;

        const loadedMessages = getLoadedRoomMessages(data);

        if (loadedMessages.length === 0) {
          mediaFetchDoneRef.current = true;
          break;
        }

        allMessages = prepareRoomMessagesForMediaScan([
          ...loadedMessages,
          ...allMessages,
        ]);

        mergedMedia = mergeRoomMediaMessages(mergedMedia, allMessages);
        cursor = getOldestMessageCursor(allMessages);
        mediaFetchCursorRef.current = cursor;

        if (loadedMessages.length < fetchLimit) {
          mediaFetchDoneRef.current = true;
          break;
        }

        if (!appendMode && mergedMedia.length > 0) {
          break;
        }
      }

      if (roomMessagesCacheRef?.current) {
        roomMessagesCacheRef.current[roomId] = allMessages;
      }

      roomMediaCacheRef.current[roomId] = mergedMedia;

      setMessages(trimRoomMessagesForMemory(allMessages).slice(-80));
      setRoomMediaGridVisibleCount((current) =>
        appendMode
          ? Math.min(mergedMedia.length, current + ROOM_MEDIA_GRID_LOAD_STEP)
          : ROOM_MEDIA_GRID_INITIAL_ITEMS
      );
      setHasOlderMessages(!mediaFetchDoneRef.current);

      if (mergedMedia.length === 0 && mediaFetchDoneRef.current) {
        setStatus('No shared media found in this room yet.');
      }
    } catch (err) {
      console.error(err);
      setStatus(err?.response?.data?.error || 'Could not load media');
    } finally {
      mediaFetchInFlightRef.current = false;
      if (mountedRef.current) setMessagesLoading(false);
    }
  }

  function closeMediaViewer() {
    setMediaViewer(null);
  }


  function seekViewerVideo(seconds = 0) {
    const video = mediaViewerVideoRef.current;
    if (!video || !Number.isFinite(seconds)) return;

    try {
      video.currentTime = Math.max(0, Math.min(video.duration || Infinity, video.currentTime + seconds));
    } catch {
      // Ignore seek failures.
    }
  }

  function openMediaFromGrid(item) {
    if (!item) return;

    const normalizedItem = normalizeRoomMessageMedia(item);

    if (normalizedItem.mediaType === 'file') {
      const fileUrl = normalizedItem.mediaUrl || normalizedItem.fileUrl;
      if (fileUrl) window.open(fileUrl, '_blank', 'noopener,noreferrer');
      return;
    }

    if (normalizedItem.mediaType !== 'image' && normalizedItem.mediaType !== 'video') {
      return;
    }

    const mediaIndex = viewableMediaMessages.findIndex((mediaItem) =>
      areRoomMediaItemsSame(mediaItem, normalizedItem)
    );

    const selectedMediaItem = mediaIndex >= 0
      ? viewableMediaMessages[mediaIndex]
      : normalizedItem;

    onClose?.();

    window.setTimeout(() => {
      setMediaViewer({
        index: mediaIndex >= 0 ? mediaIndex : 0,
        mediaKey: getStableRoomMessageKey(selectedMediaItem),
        openedAt: Date.now(),
      });
    }, 0);
  }

  useEffect(() => {
    if (typeof registerMediaViewerOpener !== 'function') return undefined;

    registerMediaViewerOpener((item) => {
      openMediaFromGrid(item);
    });

    return () => {
      registerMediaViewerOpener(null);
    };
  }, [registerMediaViewerOpener, viewableMediaMessages]);

  function moveMediaViewer(direction) {
    if (!viewableMediaMessages.length) return;

    setMediaViewer((current) => {
      if (!current) return current;

      const currentKey = String(current.mediaKey || '').trim();
      const keyIndex = currentKey
        ? viewableMediaMessages.findIndex((item) => getStableRoomMessageKey(item) === currentKey)
        : -1;

      const currentIndex =
        keyIndex >= 0
          ? keyIndex
          : Math.min(Math.max(Number(current.index || 0), 0), viewableMediaMessages.length - 1);

      const nextIndex =
        (currentIndex + direction + viewableMediaMessages.length) % viewableMediaMessages.length;

      const nextItem = viewableMediaMessages[nextIndex] || {};

      return {
        ...current,
        index: nextIndex,
        mediaKey: getStableRoomMessageKey(nextItem),
        openedAt: Date.now(),
      };
    });
  }

  function handleRoomMediaGridScroll(event) {
    event.stopPropagation();

    const element = event.currentTarget;
    const distanceFromBottom = element.scrollHeight - element.scrollTop - element.clientHeight;

    if (distanceFromBottom > 420) return;

    if (roomMediaGridVisibleCount < renderedMediaMessages.length) {
      setRoomMediaGridVisibleCount((current) =>
        Math.min(renderedMediaMessages.length, current + ROOM_MEDIA_GRID_LOAD_STEP)
      );
      return;
    }

    if (mediaFetchDoneRef.current || roomMediaGridLoadOlderRef.current) return;

    roomMediaGridLoadOlderRef.current = true;

    Promise.resolve(ensureRoomMediaGridHasContent({ append: true }))
      .finally(() => {
        window.setTimeout(() => {
          roomMediaGridLoadOlderRef.current = false;
        }, 160);
      });
  }

  function downloadRoomMedia(message) {
    const normalizedMessage = normalizeRoomMessageMedia(message);
    const mediaUrl = normalizedMessage.mediaUrl || normalizedMessage.fileUrl || '';

    if (!mediaUrl) return;

    const fileName =
      normalizedMessage.fileName ||
      normalizedMessage.mediaName ||
      String(mediaUrl).split('/').filter(Boolean).pop()?.split('?')[0] ||
      'smarty-room-media';

    const link = document.createElement('a');
    link.href = mediaUrl;
    link.download = fileName;
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  function handleMediaViewerTouchStart(event) {
    const touch = event.touches?.[0];
    if (!touch) return;

    const viewerBounds = event.currentTarget?.getBoundingClientRect?.();

    mediaViewerTouchStartRef.current = {
      x: touch.clientX,
      y: touch.clientY,
      startedAt: Date.now(),
      side:
        viewerBounds && touch.clientX > viewerBounds.left + viewerBounds.width / 2
          ? 'right'
          : 'left',
    };

    mediaViewerLongPressActiveRef.current = false;

    window.clearTimeout(mediaViewerLongPressTimeoutRef.current);

    mediaViewerLongPressTimeoutRef.current = window.setTimeout(() => {
      const video = mediaViewerVideoRef.current;
      const currentTouch = mediaViewerTouchStartRef.current;

      if (!video || !currentTouch) return;

      mediaViewerLongPressActiveRef.current = true;
      mediaViewerSeekModeRef.current = currentTouch.side;

      video.playbackRate = 2;

      if (video.paused) {
        video.play?.().catch?.(() => {});
      }
    }, 420);
  }

  function handleMediaViewerTouchEnd(event) {
    const start = mediaViewerTouchStartRef.current;
    const touch = event.changedTouches?.[0];

    mediaViewerTouchStartRef.current = null;

    window.clearTimeout(mediaViewerLongPressTimeoutRef.current);

    const video = mediaViewerVideoRef.current;

    if (mediaViewerLongPressActiveRef.current) {
      mediaViewerLongPressActiveRef.current = false;

      if (video) {
        video.playbackRate = 1;

        if (mediaViewerSeekModeRef.current === 'left') {
          seekViewerVideo(-2);
        } else if (mediaViewerSeekModeRef.current === 'right') {
          seekViewerVideo(2);
        }
      }

      mediaViewerSeekModeRef.current = null;
      return;
    }

    if (!start || !touch) return;

    const deltaX = touch.clientX - start.x;
    const deltaY = touch.clientY - start.y;

    if (Math.abs(deltaY) > 70 && Math.abs(deltaY) > Math.abs(deltaX) * 1.15) {
      closeMediaViewer();
      return;
    }

    if (Math.abs(deltaX) > 45 && Math.abs(deltaX) > Math.abs(deltaY)) {
      moveMediaViewer(deltaX > 0 ? 1 : -1);
      return;
    }

    const now = Date.now();
    const isDoubleTap = now - mediaViewerLastTapRef.current < 260;

    mediaViewerLastTapRef.current = now;

    if (isDoubleTap) {
      window.clearTimeout(mediaViewerTapTimeoutRef.current);

      if (start.side === 'left') {
        seekViewerVideo(-10);
      } else {
        seekViewerVideo(10);
      }

      return;
    }

    mediaViewerTapTimeoutRef.current = window.setTimeout(() => {}, 220);
  }

  useEffect(() => {
    if (!show) return;
    mediaFetchCursorRef.current = '';
    mediaFetchDoneRef.current = false;
    setRoomMediaGridVisibleCount(ROOM_MEDIA_GRID_INITIAL_ITEMS);
    ensureRoomMediaGridHasContent({ append: false });
  }, [show, activeRoom?.roomId]);


  useEffect(() => {
    if (!mediaViewer) return undefined;

    const handleViewerKeyDown = (event) => {
      if (event.key === 'ArrowLeft') {
        event.preventDefault();
        moveMediaViewer(-1);
      }

      if (event.key === 'ArrowRight') {
        event.preventDefault();
        moveMediaViewer(1);
      }

      if (event.key === 'Escape') {
        event.preventDefault();
        closeMediaViewer();
      }
    };

    window.addEventListener('keydown', handleViewerKeyDown);

    return () => window.removeEventListener('keydown', handleViewerKeyDown);
  }, [mediaViewer, viewableMediaMessages]);

  if (!activeRoom) return null;

  return (
    <>
      {show && (
        <div
          className="standalone-media-modal"
          onClick={onClose}
          style={{ zIndex: mediaViewer ? 1000 : 4000 }}
        >
          <section className="standalone-media-panel" onClick={(event) => event.stopPropagation()}>
            <header className="standalone-media-header">
              <div>
                <p>Shared media</p>
                <h2>Media</h2>
                <span>{activeRoom.name}</span>
              </div>

              <button type="button" className="standalone-media-close" onClick={onClose}>
                ✕
              </button>
            </header>

            <div
              ref={roomMediaGridListRef}
              className="standalone-media-grid"
              onScroll={handleRoomMediaGridScroll}
            >
              {messagesLoading && visibleRoomMediaMessages.length === 0 ? (
                <p className="standalone-media-empty">Loading media...</p>
              ) : visibleRoomMediaMessages.length === 0 ? (
                <div className="standalone-media-empty">
                  <p>No media loaded yet.</p>
                  <button
                    type="button"
                    className="approve-request-btn"
                    onClick={(event) => {
                      event.preventDefault();
                      event.stopPropagation();
                      ensureRoomMediaGridHasContent({ append: false });
                    }}
                  >
                    Load media
                  </button>
                </div>
              ) : (
                visibleRoomMediaMessages.map((item) => (
                  <RoomMediaPreview
                    key={item.messageId || item.clientId || item.mediaUrl || item.fileUrl}
                    item={item}
                    variant="grid"
                    onOpen={openMediaFromGrid}
                  />
                ))
              )}
            </div>
          </section>
        </div>
      )}

      {mediaViewer && activeMediaViewerItem && (
        <div
          className="room-media-viewer"
          style={{ zIndex: 5000 }}
          role="dialog"
          aria-modal="true"
          aria-label="Media viewer"
          onClick={closeMediaViewer}
          onTouchStart={handleMediaViewerTouchStart}
          onTouchEnd={handleMediaViewerTouchEnd}
        >
          <div className="room-media-viewer-card" onClick={(event) => event.stopPropagation()}>
            {mediaViewerCount > 1 && (
              <>
                <button
                  type="button"
                  className="room-media-viewer-nav room-media-viewer-prev"
                  onClick={(event) => {
                    event.preventDefault();
                    event.stopPropagation();
                    moveMediaViewer(-1);
                  }}
                >
                  ‹
                </button>

                <button
                  type="button"
                  className="room-media-viewer-nav room-media-viewer-next"
                  onClick={(event) => {
                    event.preventDefault();
                    event.stopPropagation();
                    moveMediaViewer(1);
                  }}
                >
                  ›
                </button>
              </>
            )}

            <div className="room-media-viewer-topbar">
              <span>{activeMediaViewerItem.senderName || activeMediaViewerItem.name || 'User'}</span>

              <div className="room-media-viewer-topbar-actions">
                <span className="room-media-viewer-count">
                  {activeMediaViewerIndex + 1}/{mediaViewerCount}
                </span>

                <button
                  type="button"
                  className="room-media-viewer-grid-btn"
                  onClick={(event) => {
                    event.preventDefault();
                    event.stopPropagation();

                    closeMediaViewer();

                    window.setTimeout(() => {
                      setRoomMediaGridVisibleCount((current) =>
                        Math.max(current, ROOM_MEDIA_GRID_INITIAL_ITEMS)
                      );

                      onOpenGrid?.();
                    }, 0);

                    window.setTimeout(() => {
                      ensureRoomMediaGridHasContent({ append: false });
                    }, 0);
                  }}
                >
                  Grid
                </button>
              </div>

              <button
                type="button"
                className="room-media-viewer-close"
                onClick={(event) => {
                  event.preventDefault();
                  event.stopPropagation();
                  closeMediaViewer();
                }}
              >
                ✕
              </button>
            </div>

            {activeMediaViewerItem.mediaType === 'video' ? (
              <video
                key={activeMediaViewerItem.mediaUrl || activeMediaViewerItem.fileUrl}
                ref={mediaViewerVideoRef}
                src={activeMediaViewerItem.mediaUrl || activeMediaViewerItem.fileUrl}
                controls
                playsInline
                preload="metadata"
                autoPlay
                className="room-media-viewer-video"
              />
            ) : (
              <img
                src={activeMediaViewerItem.mediaUrl || activeMediaViewerItem.fileUrl}
                alt={activeMediaViewerItem.fileName || activeMediaViewerItem.mediaName || 'Shared media'}
                className="room-media-viewer-image"
              />
            )}

            <button
              type="button"
              className="room-message-download-btn"
              onClick={(event) => {
                event.preventDefault();
                event.stopPropagation();
                downloadRoomMedia(activeMediaViewerItem);
              }}
              aria-label="Download"
              title="Download"
            >
              <Download size={17} strokeWidth={2.4} />
            </button>
          </div>
        </div>
      )}
      <style>{`
        .room-media-viewer-topbar-actions {
          display: flex;
          align-items: center;
          gap: 10px;
        }

        .room-media-viewer-grid-btn {
          border: 0;
          background: rgba(255,255,255,0.12);
          color: white;
          border-radius: 999px;
          padding: 7px 14px;
          font-size: 12px;
          font-weight: 700;
          cursor: pointer;
          backdrop-filter: blur(12px);
        }

        /* --- PATCHED CSS BELOW --- */
        .room-lazy-media.grid {
          position: relative;
          width: 100%;
          min-height: 220px;
          height: 220px;
          border-radius: 24px;
          overflow: hidden;
          background:
            linear-gradient(180deg, rgba(18,24,42,0.96), rgba(6,10,20,0.98));
          box-shadow:
            0 10px 40px rgba(0,0,0,0.28),
            inset 0 0 0 1px rgba(255,255,255,0.04);
          transform: translateZ(0);
          display: flex;
        }

        .standalone-media-tile {
          position: relative;
          width: 100%;
          height: 100%;
          min-width: 0;
          min-height: 0;
          flex: 1;
          border: 0;
          padding: 0;
          cursor: pointer;
          overflow: hidden;
          background: rgba(255,255,255,0.03);
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .standalone-media-tile img,
        .standalone-media-tile video {
          width: 100%;
          height: 100%;
          min-width: 100%;
          min-height: 100%;
          object-fit: cover;
          display: block;
          transition: transform 0.28s ease, filter 0.28s ease;
          background: #050816;
        }

        @media (max-width: 768px) {
          .room-lazy-media.grid {
            border-radius: 16px;
            min-height: 120px;
            height: 120px;
          }
        }
      `}</style>
    </>
  );
}