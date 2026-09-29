// The web cache stays synchronous for Amplify. On supported iOS builds, only
// session keys are mirrored to the device Keychain and restored before React.
const SESSION_KEYS = new Set([
  'eduscroll_user', 'eduscroll_token', 'eduscroll_access_token',
  'smarty-native-refresh-token', 'smarty-native-refresh-subject',
]);
const COGNITO_KEY = /^CognitoIdentityServiceProvider\.[a-zA-Z0-9]+\.(LastAuthUser|.+\.(accessToken|idToken|refreshToken|clockDrift|deviceKey|deviceGroupKey|randomPasswordKey|signInDetails|oauthMetadata))$/;
export const isSessionKey = key => SESSION_KEYS.has(key) || COGNITO_KEY.test(key);

export function createNativeSessionStorage(win) {
  const bridge = win?.webkit?.messageHandlers?.smartySession;
  let initialization;
  let pending = Promise.resolve();
  let writeFailed = false;
  let readFailed = false;
  const snapshot = () => {
    const values = {};
    for (let i = 0; i < win.localStorage.length; i++) {
      const key = win.localStorage.key(i);
      if (isSessionKey(key)) values[key] = win.localStorage.getItem(key);
    }
    return values;
  };
  const send = message => {
    let timer;
    return Promise.race([
      Promise.resolve().then(() => bridge.postMessage(message)),
      new Promise((_, reject) => {
        timer = win.setTimeout(() => reject(new Error('Saved sign-in storage is temporarily unavailable. Please reopen Smarty.')), 8000);
      }),
    ]).finally(() => win.clearTimeout(timer));
  };
  const enqueue = () => {
    const values = snapshot();
    pending = pending.catch(() => {}).then(async () => {
      const result = await send({ action: 'write', values });
      if (result?.saved !== true) throw new Error('Your sign-in could not be saved on this device. Please try again.');
    });
    // Observe failures immediately, without exposing any session data in logs.
    pending.then(() => { writeFailed = false; }, () => { writeFailed = true; });
  };
  const initialize = () => {
    if (!bridge?.postMessage) return Promise.resolve(); // Existing app builds/web.
    if (initialization) return initialization;
    initialization = (async () => {
      const result = await send({ action: 'read' });
      if (!result || !Object.hasOwn(result, 'values') ||
          (result.values !== null && (typeof result.values !== 'object' || Array.isArray(result.values)))) {
        throw new Error('Saved sign-in storage could not be opened. Please reopen Smarty.');
      }
      const proto = win.Storage.prototype;
      const { setItem, removeItem, clear } = proto;
      if (result.values !== null) {
        // An empty saved record is a durable logout, not a missing record.
        Object.keys(snapshot()).forEach(key => removeItem.call(win.localStorage, key));
        for (const [key, value] of Object.entries(result.values)) {
          if (isSessionKey(key) && typeof value === 'string') setItem.call(win.localStorage, key, value);
        }
      }
      proto.setItem = function (key, value) {
        const track = this === win.localStorage && isSessionKey(String(key));
        const previous = track ? this.getItem(key) : null;
        setItem.call(this, key, value);
        if (track && previous !== String(value)) enqueue();
      };
      proto.removeItem = function (key) {
        const changed = this === win.localStorage && isSessionKey(String(key)) && this.getItem(key) !== null;
        removeItem.call(this, key);
        if (changed) enqueue();
      };
      proto.clear = function () {
        clear.call(this);
        if (this === win.localStorage) enqueue();
      };
      // Adopt an existing installation without asking the user to log in again.
      if (result.values === null) { enqueue(); await pending; }
    })().catch(error => { readFailed = true; throw error; });
    return initialization;
  };
  const flush = async () => {
    if (!bridge?.postMessage) return;
    if (readFailed) throw new Error('Saved sign-in storage is unavailable. Please reopen Smarty.');
    await initialize();
    if (writeFailed) enqueue();
    // Include any mutations enqueued while an earlier write was in flight.
    let observed;
    do { observed = pending; await observed; } while (observed !== pending);
  };
  return { initialize, flush };
}

const storage = createNativeSessionStorage(typeof window === 'undefined' ? undefined : window);
export const initializeNativeSessionStorage = storage.initialize;
export const flushNativeSessionStorage = storage.flush;
