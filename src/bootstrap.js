import { initializeNativeSessionStorage } from './lib/nativeSessionStorage';

// This entry must not statically import App, Amplify, Firebase, or API modules.
// Static imports execute before an awaited function: the old entry rendered
// late, but initialized the authentication SDK while device storage was empty.
async function start() {
  try {
    await initializeNativeSessionStorage();
  } catch {
    window.__SMARTY_BOOT_ERROR__ = 'Your saved sign-in could not be restored yet. Unlock your device and reload Smarty. Your session has not been removed.';
    window.__SMARTY_SHOW_BOOT_ERROR__?.();
    return;
  }
  try {
    await import('./main.jsx');
  } catch {
    window.__SMARTY_BOOT_ERROR__ = 'Smarty could not finish opening. Please reload. Your saved sign-in has not been removed.';
    window.__SMARTY_SHOW_BOOT_ERROR__?.();
  }
}

void start();
