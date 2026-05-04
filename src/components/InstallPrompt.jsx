import { useEffect, useState } from "react";

const STORAGE_KEY = "smarty_install_prompt_seen";

export default function InstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [show, setShow] = useState(false);
  const [isIOS, setIsIOS] = useState(false);

  useEffect(() => {
    // TEMP TESTING: comment this line while testing
    if (localStorage.getItem(STORAGE_KEY) === "true") return;

    const ua = navigator.userAgent.toLowerCase();
    const iosDevice = /iphone|ipad|ipod/.test(ua);

    const isStandalone =
      window.navigator.standalone === true ||
      window.matchMedia("(display-mode: standalone)").matches;

    if (iosDevice && !isStandalone) {
      setIsIOS(true);
    }

    const handleBeforeInstallPrompt = (e) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };

    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);

    const timer = setTimeout(() => {
      if (!isStandalone) setShow(true);
    }, 1000);

    return () => {
      window.removeEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
      clearTimeout(timer);
    };
  }, []);

  const installApp = async () => {
   if (!deferredPrompt) return;

    deferredPrompt.prompt();
    await deferredPrompt.userChoice;

    localStorage.setItem(STORAGE_KEY, "true");
    setDeferredPrompt(null);
    setShow(false);
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
            ? "Tap Share → Add to Home Screen"
            : "Add Smarty to your home screen for a faster app experience."}
        </p>
      </div>

{!isIOS && deferredPrompt && (
  <button type="button" onClick={installApp}>
    Install
  </button>
)}

{!isIOS && !deferredPrompt && (
  <p style={{ fontSize: "0.8rem", opacity: 0.7 }}>
    Use browser menu → Install app
  </p>
)}

      <button type="button" onClick={closePopup}>
        Close
      </button>
    </div>
  );
}