import { useEffect, useState } from "react";
import { Download, X } from "lucide-react";

const DISMISSED_KEY = "xl-pwa-install-dismissed";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

function isStandalone() {
  return (
    window.matchMedia?.("(display-mode: standalone)").matches ||
    // iOS Safari
    (navigator as unknown as { standalone?: boolean }).standalone === true
  );
}

/**
 * Slim, dismissible "Add to Home Screen" banner — rendered in normal page
 * flow (not fixed) so it never competes with the bottom-fixed CartBar or
 * mobile nav. Shows at most once: a dismissal (or an install) is permanent
 * via localStorage, so it never nags on return visits.
 */
export default function InstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] =
    useState<BeforeInstallPromptEvent | null>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (localStorage.getItem(DISMISSED_KEY) || isStandalone()) return;

    const onBeforeInstall = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      setVisible(true);
    };
    const onInstalled = () => {
      localStorage.setItem(DISMISSED_KEY, "1");
      setVisible(false);
    };

    window.addEventListener("beforeinstallprompt", onBeforeInstall);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onBeforeInstall);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  const dismiss = () => {
    localStorage.setItem(DISMISSED_KEY, "1");
    setVisible(false);
  };

  const install = async () => {
    if (!deferredPrompt) return;
    await deferredPrompt.prompt();
    await deferredPrompt.userChoice;
    localStorage.setItem(DISMISSED_KEY, "1");
    setDeferredPrompt(null);
    setVisible(false);
  };

  if (!visible) return null;

  return (
    <div className="bg-red-50 border-b border-red-100">
      <div className="max-w-7xl mx-auto px-4 lg:px-8 py-2 flex items-center gap-3 text-[12.5px]">
        <Download size={15} className="text-red-600 flex-shrink-0" />
        <span className="flex-1 font-medium text-slate-700">
          Add XL Traders to your home screen for quick access
        </span>
        <button
          onClick={install}
          className="flex-shrink-0 bg-red-600 text-white px-3 py-1.5 rounded-lg text-[12px] font-bold hover:bg-red-700 transition"
        >
          Install
        </button>
        <button
          onClick={dismiss}
          aria-label="Dismiss"
          className="flex-shrink-0 p-1 text-slate-400 hover:text-slate-600 transition"
        >
          <X size={15} />
        </button>
      </div>
    </div>
  );
}
