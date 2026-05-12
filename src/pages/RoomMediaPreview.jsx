import { memo, useEffect, useMemo, useRef, useState } from 'react';
import { Download } from 'lucide-react';

const THUMB_CACHE_KEY = 'smarty_room_video_thumbs_v2';
const MAX_THUMBS = 1200;
const NEAR_VIEW_ROOT_MARGIN = '320px';
const sharedThumbCache = new Map();
const sharedObserverMap = new WeakMap();

function getMediaKey(item = {}) {
  return String(
    item.messageId ||
      item.id ||
      item.clientId ||
      item.mediaKey ||
      item.mediaUrl ||
      item.fileUrl ||
      ''
  );
}

function getProvidedThumbnailUrl(item = {}) {
  return String(
    item.thumbnailUrl ||
      item.thumbUrl ||
      item.previewUrl ||
      item.posterUrl ||
      item.videoThumbnailUrl ||
      item.mediaThumbnailUrl ||
      item.coverUrl ||
      item.coverImageUrl ||
      item.imagePreviewUrl ||
      ''
  ).trim();
}

function normalizePreviewMediaType(item = {}) {
  const rawType = String(item.mediaType || item.type || item.mimeType || item.contentType || '').toLowerCase();
  const fileName = String(item.fileName || item.mediaName || item.name || '').toLowerCase();
  const url = String(item.mediaUrl || item.fileUrl || '').toLowerCase();

  if (rawType.includes('image') || /\.(jpg|jpeg|png|gif|webp|avif)(\?|#|$)/i.test(fileName || url)) {
    return 'image';
  }

  if (rawType.includes('video') || /\.(mp4|mov|webm|m4v|avi)(\?|#|$)/i.test(fileName || url)) {
    return 'video';
  }

  if (rawType.includes('file') || item.fileUrl) return 'file';

  return rawType || '';
}

function readThumbs() {
  try {
    if (sharedThumbCache.size > 0) {
      return Object.fromEntries(sharedThumbCache.entries());
    }

    const parsed = JSON.parse(localStorage.getItem(THUMB_CACHE_KEY) || '{}');

    Object.entries(parsed).forEach(([key, value]) => {
      sharedThumbCache.set(key, value);
    });

    return parsed;
  } catch {
    return {};
  }
}

function getCachedThumb(key) {
  if (!key) return '';

  const memoryValue = sharedThumbCache.get(key);

  if (memoryValue) {
    return typeof memoryValue === 'string'
      ? memoryValue
      : memoryValue?.thumb || '';
  }

  const value = readThumbs()[key];

  return typeof value === 'string'
    ? value
    : value?.thumb || '';
}

function saveThumb(key, thumb) {
  if (!key || !thumb) return;

  try {
    const current = readThumbs();

    const next = {
      ...current,
      [key]: {
        thumb,
        cachedAt: Date.now(),
      },
    };

    sharedThumbCache.set(key, next[key]);

    const trimmed = Object.entries(next)
      .sort((a, b) => Number(b[1]?.cachedAt || 0) - Number(a[1]?.cachedAt || 0))
      .slice(0, MAX_THUMBS);

    localStorage.setItem(
      THUMB_CACHE_KEY,
      JSON.stringify(Object.fromEntries(trimmed))
    );

    window.dispatchEvent(
      new CustomEvent('smarty-room-thumb', {
        detail: { key, thumb },
      })
    );
  } catch {
    // ignore
  }
}

function shortName(name = '') {
  const clean = String(name || 'Attachment').trim() || 'Attachment';

  if (clean.length <= 34) return clean;

  const ext = clean.includes('.') ? `.${clean.split('.').pop()}` : '';
  const base = ext ? clean.slice(0, -ext.length) : clean;

  return `${base.slice(0, 24)}…${ext}`;
}

function RoomMediaPreview({
  item,
  variant = 'message',
  onOpen,
  onDownload,
}) {
  const mediaUrl = item?.mediaUrl || item?.fileUrl || '';
  const mediaType = normalizePreviewMediaType(item);

  const mediaKey = useMemo(() => getMediaKey(item), [item]);
  const providedThumbnailUrl = useMemo(() => getProvidedThumbnailUrl(item), [item]);

  const rootRef = useRef(null);

  const [isNearViewport, setIsNearViewport] = useState(false);

  const [thumb, setThumb] = useState(() =>
    providedThumbnailUrl || getCachedThumb(mediaKey)
  );

  useEffect(() => {
    setThumb(providedThumbnailUrl || getCachedThumb(mediaKey));
  }, [mediaKey, providedThumbnailUrl]);

  useEffect(() => {
    const node = rootRef.current;
    if (!node) return undefined;

    if (typeof IntersectionObserver !== 'function') {
      setIsNearViewport(true);
      return undefined;
    }

    let observer = sharedObserverMap.get(node);

    if (!observer) {
      observer = new IntersectionObserver(
        ([entry]) => {
          if (!entry?.isIntersecting) return;

          setIsNearViewport(true);
          observer.unobserve(node);
        },
        {
          root: null,
          rootMargin: NEAR_VIEW_ROOT_MARGIN,
          threshold: 0.01,
        }
      );

      sharedObserverMap.set(node, observer);
    }

    observer.observe(node);

    return () => {
      observer.unobserve(node);
    };
  }, []);

  useEffect(() => {
    const handler = (event) => {
      if (
        event.detail?.key === mediaKey &&
        event.detail?.thumb
      ) {
        setThumb(event.detail.thumb);
      }
    };

    window.addEventListener('smarty-room-thumb', handler);

    return () => {
      window.removeEventListener('smarty-room-thumb', handler);
    };
  }, [mediaKey]);

  if (!mediaUrl || !mediaType) return null;

  const isGrid = variant === 'grid';
  const shouldLoadImagePreview = mediaType === 'image' && (isGrid || isNearViewport);

  const shouldShowInlineVideoPreview = mediaType === 'video' && isNearViewport && !thumb;

  const videoPreviewLabel = thumb ? 'Video preview' : 'Video';

  const wrapperClassName = isGrid
    ? `room-lazy-media grid ${mediaType}`
    : `room-message-media-wrap ${mediaType === 'video' ? 'video-preview-wrap' : ''} ${
        mediaType === 'file' ? 'room-message-file-wrap' : ''
      }`;

  const buttonClassName = isGrid
    ? `standalone-media-tile ${mediaType}`
    : mediaType === 'file'
      ? 'room-message-file'
      : 'room-message-media-tap';

  const wrapperStyle = isGrid
    ? undefined
    : {
        position: 'relative',
        display: 'inline-flex',
        maxWidth: 'min(320px, 74vw)',
        width: mediaType === 'file' ? 'auto' : 'min(320px, 74vw)',
        minHeight: mediaType === 'file' ? undefined : '168px',
        borderRadius: '18px',
        overflow: 'hidden',
      };

  const buttonStyle = isGrid
    ? undefined
    : mediaType === 'file'
      ? undefined
      : {
          display: 'block',
          width: '100%',
          minHeight: '168px',
          borderRadius: '18px',
          overflow: 'hidden',
        };

  const mediaStyle = isGrid
    ? undefined
    : {
        display: 'block',
        width: '100%',
        height: '100%',
        minHeight: '168px',
        objectFit: 'cover',
      };

  const placeholderStyle = isGrid
    ? {
        position: 'absolute',
        inset: 0,
        display: 'grid',
        placeItems: 'center',
        width: '100%',
        height: '100%',
        background:
          mediaType === 'video'
            ? 'linear-gradient(135deg, #111827, #020617 62%, #0f172a)'
            : 'linear-gradient(135deg, #111827, #020617)',
      }
    : {
        position: 'relative',
        display: 'grid',
        placeItems: 'center',
        width: '100%',
        height: '100%',
        minHeight: '168px',
        background:
          mediaType === 'video'
            ? 'linear-gradient(135deg, #111827, #020617 62%, #0f172a)'
            : 'linear-gradient(135deg, #111827, #020617)',
      };

  return (
    <div ref={rootRef} className={wrapperClassName} style={wrapperStyle}>
      <button
        type="button"
        className={buttonClassName}
        style={buttonStyle}
        onClick={(event) => {
          event.preventDefault();
          event.stopPropagation();
          onOpen?.(item);
        }}
      >
        {mediaType === 'image' && (
          shouldLoadImagePreview ? (
            <img
              src={mediaUrl}
              alt={item.fileName || 'Shared image'}
              className="room-message-image"
              style={mediaStyle}
              loading="lazy"
              decoding="async"
              fetchPriority={isGrid ? 'low' : 'auto'}
            />
          ) : (
            <div className="room-message-video-placeholder standalone-media-video-placeholder" style={placeholderStyle}>
              <span
                className="room-media-preview-label"
                style={{ contain: 'layout paint' }}
              >
                Image
              </span>
            </div>
          )
        )}

        {mediaType === 'video' && (
          <>
            {thumb ? (
              <img
                src={thumb}
                alt={item.fileName || 'Video preview'}
                className="room-message-video-thumb"
                style={mediaStyle}
                loading="lazy"
                decoding="async"
              />
            ) : shouldShowInlineVideoPreview ? (
              <video
                className="room-message-video-thumb"
                style={mediaStyle}
                src={mediaUrl}
                muted
                playsInline
                preload="metadata"
                controls={false}
                disablePictureInPicture
                tabIndex={-1}
                aria-hidden="true"
                onLoadedMetadata={(event) => {
                  try {
                    if (event.currentTarget.currentTime < 0.05) {
                      event.currentTarget.currentTime = Math.min(0.1, event.currentTarget.duration || 0);
                    }
                  } catch {
                    // Ignore preview seek failures.
                  }
                }}
              />
            ) : (
              <div className="room-message-video-placeholder standalone-media-video-placeholder" style={placeholderStyle}>
                <span
                  aria-hidden="true"
                  style={{
                    width: isGrid ? 54 : 64,
                    height: isGrid ? 54 : 64,
                    borderRadius: '50%',
                    display: 'grid',
                    placeItems: 'center',
                    background: 'rgba(0,0,0,0.42)',
                    color: '#fff',
                    fontSize: isGrid ? 22 : 26,
                    fontWeight: 900,
                    boxShadow: '0 10px 30px rgba(0,0,0,0.28)',
                  }}
                >
                  ▶
                </span>

                <span
                  className="room-media-preview-label"
                  style={{ contain: 'layout paint' }}
                >
                  {videoPreviewLabel}
                </span>
              </div>
            )}
            {(thumb || isGrid || shouldShowInlineVideoPreview) && (
              <span className="room-video-play-badge">▶</span>
            )}
            {!isGrid && (thumb || shouldShowInlineVideoPreview) && (
              <span className="room-media-preview-label">Play video</span>
            )}
          </>
        )}

        {mediaType === 'file' && (
          <span>
            📎 {shortName(item.fileName || item.mediaName || 'Attachment')}
          </span>
        )}
      </button>

      {!isGrid && (
        <button
          type="button"
          className={`room-message-download-btn ${mediaType === 'file' ? 'file-download-btn' : ''}`}
          onClick={(event) => {
            event.preventDefault();
            event.stopPropagation();
            onDownload?.(item);
          }}
          aria-label="Download"
          title="Download"
        >
          <Download size={17} strokeWidth={2.4} />
        </button>
      )}
    </div>
  );
}
export default memo(RoomMediaPreview);