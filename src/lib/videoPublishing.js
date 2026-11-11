import { validatePostMedia } from './postDraft.js';
import { validateVideoUpload } from './videoFeed.js';
import { videoTopicLabel } from '../data/videoTopics.js';

const TYPES = { mp4: 'video/mp4', mov: 'video/quicktime', webm: 'video/webm', m4v: 'video/x-m4v' };
export const VIDEO_INPUT_TYPES = [...Object.values(TYPES), ...Object.keys(TYPES).map(ext => '.' + ext)].join(',');
export function videoUploadType(file) {
  const supplied = String(file?.type || '').toLowerCase();
  if (supplied && supplied !== 'application/octet-stream') return supplied;
  return TYPES[file?.name?.split('.').pop().toLowerCase()] || '';
}

export function validateStudioVideo(file) {
  const type = videoUploadType(file);
  return validateVideoUpload({ type }) || validatePostMedia({ type, size: file?.size });
}

export function normalizeVideoUpload(payload) {
  let value = payload;
  for (let step = 0; step < 4; step++) {
    if (typeof value === 'string') {
      try { value = JSON.parse(value); } catch { break; }
      continue;
    }
    if (!value || typeof value !== 'object') break;
    if (value.error || (value.statusCode !== undefined && !(Number(value.statusCode) >= 200 && Number(value.statusCode) < 300))) break;
    const url = value.uploadUrl || value.presignedUrl || value.url;
    const fileUrl = value.fileUrl || value.publicUrl || '';
    const key = value.key || value.fileKey || value.videoKey || value.imageKey || '';
    if (url) {
      try {
        const target = new URL(url);
        if (target.protocol === 'https:' && !target.username && !target.password &&
          (typeof fileUrl === 'string' && fileUrl || typeof key === 'string' && key)) {
          return { uploadUrl: target.href, fileUrl: typeof fileUrl === 'string' ? fileUrl : '', key: typeof key === 'string' ? key : '' };
        }
      } catch { /* Unusable upload destination. */ }
      break;
    }
    value = value.body;
  }
  throw new Error('Smarty couldn’t start the upload. Please try again.');
}

export function sendVideoAsset(file, uploadUrl, { signal, onProgress } = {}) {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) { reject(new DOMException('Upload cancelled', 'AbortError')); return; }
    const xhr = new XMLHttpRequest();
    const cancel = () => xhr.abort();
    const finish = (error) => {
      signal?.removeEventListener('abort', cancel);
      if (error) reject(error); else resolve();
    };
    xhr.upload.onprogress = event => {
      if (event.lengthComputable && event.total) onProgress?.(Math.round(event.loaded / event.total * 100));
    };
    xhr.onload = () => finish(xhr.status >= 200 && xhr.status < 300 ? null : new Error('The file couldn’t be uploaded. Try again.'));
    xhr.onerror = () => finish(new Error('The connection was interrupted. Your draft is still here.'));
    xhr.ontimeout = () => finish(new Error('The upload timed out. Try a smaller file or a stronger connection.'));
    xhr.onabort = () => finish(new DOMException('Upload cancelled', 'AbortError'));
    try {
      xhr.open('PUT', uploadUrl);
      xhr.timeout = 360000;
      xhr.setRequestHeader('Content-Type', file.type);
      signal?.addEventListener('abort', cancel, { once: true });
      xhr.send(file);
    } catch (error) { finish(error); }
  });
}

export function videoPostPayload({ id, draft, topic, video, cover }) {
  return {
    id, topic: videoTopicLabel(topic), title: draft.title.trim(), body: draft.body.trim() || draft.title.trim(),
    likes: 0, visibility: draft.visibility,
    videoUrl: video.fileUrl, videoKey: video.key,
    thumbUrl: cover?.fileUrl || '', thumbKey: cover?.key || '',
    imageUrl: cover?.fileUrl || '', imageKey: cover?.key || '',
  };
}

export async function captureVideoCover(video) {
  if (!video || video.readyState < 2 || !video.videoWidth || !video.videoHeight) {
    throw new Error('Play the preview or move to a frame, then try again.');
  }
  const canvas = document.createElement('canvas');
  const scale = Math.min(1, 640 / Math.max(video.videoWidth, video.videoHeight));
  canvas.width = Math.max(1, Math.round(video.videoWidth * scale));
  canvas.height = Math.max(1, Math.round(video.videoHeight * scale));
  const context = canvas.getContext('2d');
  if (!context) throw new Error('This device couldn’t create a cover frame.');
  context.drawImage(video, 0, 0, canvas.width, canvas.height);
  const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/jpeg', .88));
  if (!blob) throw new Error('This device couldn’t create a cover frame.');
  return new File([blob], 'video-cover.jpg', { type: 'image/jpeg' });
}
