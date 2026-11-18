import { initializeNativeSessionStorage } from './lib/nativeSessionStorage';

// This entry must not statically import App, Amplify, Firebase, or API modules.
// Static imports execute before an awaited function: the old entry rendered
// late, but initialized the authentication SDK while device storage was empty.
async function start() {
  try {
    await initializeNativeSessionStorage();
  } catch {
    window.__SMARTY_SHOW_BOOT_ERROR__?.('saved-session');
    return;
  }
  try {
    await import('./main.jsx');
  } catch {
    window.__SMARTY_SHOW_BOOT_ERROR__?.();
  }
}

void start();
