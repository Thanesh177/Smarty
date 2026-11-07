import { canPrepareVideo, isWorthKeeping } from './videoUploadPolicy.js';
export { canPrepareVideo } from './videoUploadPolicy.js';

// Optional preparation: a codec or worker failure must never block publishing.
export function prepareVideoUpload(file, { signal, onProgress } = {}) {
  if (signal?.aborted || !canPrepareVideo(file)) return Promise.resolve(file);
  return new Promise(resolve => {
    let worker;
    try { worker = new Worker(new URL('./prepareVideoUpload.worker.js', import.meta.url), { type: 'module' }); }
    catch { resolve(file); return; }
    const finish = (prepared = file) => {
      clearTimeout(timeout);
      signal?.removeEventListener('abort', abort);
      worker.terminate();
      resolve(prepared);
    };
    const abort = () => finish();
    const timeout = setTimeout(abort, 60000);
    signal?.addEventListener('abort', abort, { once: true });
    worker.onerror = event => { event.preventDefault(); abort(); };
    worker.onmessageerror = abort;
    worker.onmessage = ({ data }) => {
      if (data?.type === 'progress') { onProgress?.(data.value); return; }
      if (data?.buffer && isWorthKeeping(file.size, data.buffer.byteLength)) {
        finish(new File([data.buffer], file.name.replace(/\.[^/.]+$/, '') + '.mp4', {
          type: 'video/mp4', lastModified: file.lastModified,
        }));
      } else finish();
    };
    try { worker.postMessage(file); } catch { abort(); }
  });
}
