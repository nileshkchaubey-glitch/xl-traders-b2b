import { useEffect, useState } from "react";
import { ArrowUp } from "lucide-react";

/**
 * "Back to top", appearing after roughly two screens of scrolling.
 *
 * Two screens rather than a fixed pixel figure: the threshold has to mean the
 * same thing on a 390px phone and a 1440px desktop, and "I have scrolled well
 * past what I can see" is the actual trigger.
 *
 * Sits above the mobile cart bar and bottom nav so it never covers either.
 * Scrolling itself respects `prefers-reduced-motion` — an instant jump rather
 * than a smooth scroll for visitors who asked for less movement.
 */
export default function BackToTop() {
  const [show, setShow] = useState(false);

  useEffect(() => {
    const onScroll = () => setShow(window.scrollY > window.innerHeight * 2);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  if (!show) return null;

  const toTop = () => {
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    window.scrollTo({ top: 0, behavior: reduced ? "auto" : "smooth" });
  };

  return (
    <button
      onClick={toTop}
      aria-label="Back to top"
      className="fixed bottom-[calc(132px+env(safe-area-inset-bottom))] right-4 z-30 grid h-10 w-10 place-items-center rounded-full border border-slate-200 bg-white/95 text-slate-600 shadow-lg backdrop-blur transition hover:text-red-600 md:bottom-6 md:right-[22rem]"
    >
      <ArrowUp size={17} strokeWidth={2.5} />
    </button>
  );
}
