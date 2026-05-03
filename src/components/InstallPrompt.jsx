import { useEffect, useState } from "react";

const STORAGE_KEY = "smarty_install_prompt_seen";

export default function InstallPrompt() {

  const [deferredPrompt, setDeferredPrompt] = useState(null);

  const [show, setShow] = useState(false);

  const [scrollCount, setScrollCount] = useState(0);

  const [isIOS, setIsIOS] = useState(false);

  useEffect(() => {

    // 🚫 Already seen → never show again

    if (localStorage.getItem(STORAGE_KEY) === "true") return;

    const ua = navigator.userAgent.toLowerCase();

    const isIosDevice = /iphone|ipad|ipod/.test(ua);

    const isStandalone =

      window.navigator.standalone ||

      window.matchMedia("(display-mode: standalone)").matches;

    if (isIosDevice && !isStandalone) {

      setIsIOS(true);

    }

    window.addEventListener("beforeinstallprompt", (e) => {

      e.preventDefault();

      setDeferredPrompt(e);

    });

  }, []);

  // track engagement

  useEffect(() => {

    const handleScroll = () => {

      setScrollCount((prev) => prev + 1);

    };

    window.addEventListener("scroll", handleScroll);

    return () => window.removeEventListener("scroll", handleScroll);

  }, []);

  // show after engagement (only if not seen)

  useEffect(() => {

    if (

      scrollCount > 5 &&

      localStorage.getItem(STORAGE_KEY) !== "true"

    ) {

      setShow(true);

    }

  }, [scrollCount]);

  const installApp = async () => {

    if (!deferredPrompt) return;

    deferredPrompt.prompt();

    await deferredPrompt.userChoice;

    localStorage.setItem(STORAGE_KEY, "true"); // ✅ remember

    setDeferredPrompt(null);

    setShow(false);

  };

  const closePopup = () => {

    localStorage.setItem(STORAGE_KEY, "true"); // ✅ remember even if closed

    setShow(false);

  };

  if (!show) return null;

  return (

    <div className="install-popup">

      {isIOS ? (

        <>

          <p>Install Smarty</p>

          <p>Tap Share → Add to Home Screen</p>

        </>

      ) : (

        <>

          <p>Install Smarty App</p>

          <button onClick={installApp}>Install</button>

        </>

      )}

      <button onClick={closePopup}>Close</button>

    </div>

  );

}