import { useEffect, useState } from "react";

const STORAGE_KEY = "smarty_install_prompt_seen";

export default function InstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [show, setShow] = useState(false);
  const [isIOS, setIsIOS] = useState(false);

  useEffect(() => {
    if (localStorage.getItem(STORAGE_KEY) === "true") return;

    const ua = navigator.userAgent.toLowerCase();
    const iosDevice = /iphone|ipad|ipod/.test(ua);

    const isStandalone =
      window.navigator.standalone === true ||
      window.matchMedia("(display-mode: standalone)").matches;

    if (isStandalone) return;

    setIsIOS(iosDevice);

    const handleBeforeInstallPrompt = (e) => {
      e.preventDefault();
      setDeferredPrompt(e);
      setShow(true);
    };

    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);

    const timer = setTimeout(() => {
      if (iosDevice) setShow(true);
    }, 1200);

    return () => {
      window.removeEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
      clearTimeout(timer);
    };
  }, []);

  useEffect(() => {
    const handleInstalled = () => {
      localStorage.setItem(STORAGE_KEY, "true");
      setShow(false);
    };

    window.addEventListener("appinstalled", handleInstalled);

    return () => {
      window.removeEventListener("appinstalled", handleInstalled);
    };
  }, []);

  const installApp = async () => {
    if (!deferredPrompt) return;

    deferredPrompt.prompt();
    const choice = await deferredPrompt.userChoice;

    if (choice.outcome === "accepted") {
      localStorage.setItem(STORAGE_KEY, "true");
      setShow(false);
    }

    setDeferredPrompt(null);
  };

  const closePopup = () => {
    localStorage.setItem(STORAGE_KEY, "true");
    setShow(false);
  };

  if (!show) return null;

  return (
    <div className="install-popup">
      <div>
        <p>{isIOS ? "Install Smarty" : "Install Smarty App"}</p>
        <p>
          {isIOS
            ? "Tap the Share button at the bottom, then choose Add to Home Screen."
            : "Add Smarty to your home screen for a faster app experience."}
        </p>
      </div>

      {!isIOS && deferredPrompt && (
        <button type="button" onClick={installApp}>
          Install
        </button>
      )}

      {!isIOS && !deferredPrompt && (
        <p className="install-hint">Use browser menu → Install app</p>
      )}

      <button type="button" onClick={closePopup}>
        Close
      </button>
    </div>
  );
}