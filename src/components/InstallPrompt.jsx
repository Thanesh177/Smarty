import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";

const STORAGE_KEY = "smarty_install_prompt_seen";

const SNOOZE_KEY = "smarty_install_prompt_snoozed_until";
const SNOOZE_DURATION = 1000 * 60 * 60 * 24 * 7;

function safeGetStorage(key) {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function safeSetStorage(key, value) {
  try {
    localStorage.setItem(key, value);
  } catch {
    // ignore storage errors
  }
}

function isStandaloneMode() {
  if (typeof window === "undefined") return false;

  return Boolean(
    window.navigator?.standalone === true ||
      window.matchMedia?.("(display-mode: standalone)")?.matches
  );
}

function InstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [show, setShow] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const mountedRef = useRef(true);
  const timerRef = useRef(null);
  const [installing, setInstalling] = useState(false);

  const installTitle = useMemo(
    () => (isIOS ? "Install Smarty" : "Install Smarty App"),
    [isIOS]
  );

  const installDescription = useMemo(
    () =>
      isIOS
        ? "Tap the Share button at the bottom, then choose Add to Home Screen."
        : "Add Smarty to your home screen for a faster app experience.",
    [isIOS]
  );

  useEffect(() => {
    mountedRef.current = true;

    if (typeof window === "undefined" || typeof navigator === "undefined") return undefined;

    const seen = safeGetStorage(STORAGE_KEY) === "true";
    const snoozedUntil = Number(safeGetStorage(SNOOZE_KEY) || 0);

    if (seen || Date.now() < snoozedUntil || isStandaloneMode()) return undefined;

    const ua = navigator.userAgent?.toLowerCase?.() || "";
    const iosDevice = /iphone|ipad|ipod/.test(ua) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);

    setIsIOS(iosDevice);

    const handleBeforeInstallPrompt = (e) => {
      e.preventDefault();
      if (!mountedRef.current) return;
      setDeferredPrompt(e);
      setShow(true);
    };

    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);

    timerRef.current = window.setTimeout(() => {
      if (mountedRef.current && iosDevice && !isStandaloneMode()) setShow(true);
    }, 1800);

    return () => {
      mountedRef.current = false;
      window.removeEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
      if (timerRef.current) window.clearTimeout(timerRef.current);
    };
  }, []);

  useEffect(() => {
    const handleInstalled = () => {
      safeSetStorage(STORAGE_KEY, "true");
      if (mountedRef.current) setShow(false);
    };

    window.addEventListener("appinstalled", handleInstalled);

    return () => {
      window.removeEventListener("appinstalled", handleInstalled);
    };
  }, []);

  const installApp = useCallback(async () => {
    if (!deferredPrompt || installing) return;

    try {
      setInstalling(true);
      deferredPrompt.prompt();
      const choice = await deferredPrompt.userChoice;

      if (choice?.outcome === "accepted") {
        safeSetStorage(STORAGE_KEY, "true");
        if (mountedRef.current) setShow(false);
      } else {
        safeSetStorage(SNOOZE_KEY, String(Date.now() + SNOOZE_DURATION));
        if (mountedRef.current) setShow(false);
      }
    } catch (err) {
      console.error("Install prompt failed:", err);
      safeSetStorage(SNOOZE_KEY, String(Date.now() + SNOOZE_DURATION));
      if (mountedRef.current) setShow(false);
    } finally {
      if (mountedRef.current) {
        setInstalling(false);
        setDeferredPrompt(null);
      }
    }
  }, [deferredPrompt, installing]);

  const closePopup = useCallback(() => {
    safeSetStorage(SNOOZE_KEY, String(Date.now() + SNOOZE_DURATION));
    setShow(false);
  }, []);

  if (!show) return null;

  return (
    <div className="install-popup">
      <div>
        <p>{installTitle}</p>
        <p>{installDescription}</p>
      </div>

      {!isIOS && deferredPrompt && (
        <button type="button" disabled={installing} onClick={installApp}>
          {installing ? "Opening..." : "Install"}
        </button>
      )}

      {!isIOS && !deferredPrompt && (
        <p className="install-hint">Use browser menu → Install app</p>
      )}

      <button type="button" disabled={installing} onClick={closePopup}>
        Close
      </button>
    </div>
  );
}

export default memo(InstallPrompt);