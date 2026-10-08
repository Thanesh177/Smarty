// Explicit capability marker: older native builds must not pretend they can
// schedule a reminder. No prompt is issued during startup/status checks.
export function supportsNativeReminders() {
  return typeof window !== 'undefined' && window.__SMARTY_LOCAL_REMINDERS__ === true &&
    Boolean(window.webkit?.messageHandlers?.smartyNative?.postMessage);
}

const pending = new Map();
export function nativeNotificationRequest(command, payload = {}) {
  if (!supportsNativeReminders()) return Promise.resolve({ permission: 'unavailable', scheduled: false });
  const key = JSON.stringify([command, payload]);
  if (pending.has(key)) return pending.get(key);
  const task = new Promise((resolve, reject) => {
    const requestId = globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random()}`;
    const cleanup = () => { window.clearTimeout(timer); window.removeEventListener('smarty-native-notification-result', receive); };
    const receive = event => {
      if (event.detail?.requestId !== requestId) return;
      cleanup();
      if (event.detail.error) reject(new Error(event.detail.error)); else resolve(event.detail);
    };
    const timer = window.setTimeout(() => { cleanup(); reject(new Error('Device settings did not respond. Please try again.')); }, 30000);
    window.addEventListener('smarty-native-notification-result', receive);
    try { window.webkit.messageHandlers.smartyNative.postMessage({ ...payload, action: 'notifications', command, requestId }); }
    catch (error) { cleanup(); reject(error); }
  });
  pending.set(key, task);
  task.then(() => pending.delete(key), () => pending.delete(key));
  return task;
}
