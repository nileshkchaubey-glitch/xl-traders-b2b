import { Link } from "wouter";
import { ArrowRight, MessageCircle, Truck, Check } from "lucide-react";
import type { HeroContent } from "@/lib/settingsService";

interface HeroSlideshowProps {
  hero: HeroContent;
  /** Local hero images, largest first. CSS-crossfaded; never video or GIF. */
  slides: string[];
  whatsappHref: string;
}

/**
 * The hero.
 *
 * ── Motion rules, all held in CSS ────────────────────────────────────────
 *  * CSS ONLY. No video, no GIF, no JS animation loop, no timer state — the
 *    crossfade is one `@keyframes` opacity cycle per layer, staggered by
 *    animation-delay. Nothing re-renders while it plays.
 *  * FIXED HEIGHT. Every slide is absolutely positioned inside a box with an
 *    explicit height, so the page cannot shift as slides change — the layout
 *    is identical at slide 1 and slide 3.
 *  * `prefers-reduced-motion` shows the FIRST slide only and stops. Not a
 *    slower fade: a still image, which is what the preference asks for
 *    (index.css hides the rest and cancels the animation).
 *
 * The background gradient is `--xl-hero-grad`, one of the two properties
 * festival theming is allowed to change.
 */
export default function HeroSlideshow({
  hero,
  slides,
  whatsappHref,
}: HeroSlideshowProps) {
  return (
    <section
      className="relative overflow-hidden border-b border-slate-100"
      style={{ background: "var(--xl-hero-grad)" }}
    >
      <div className="container grid items-center gap-8 py-8 md:py-14 lg:grid-cols-[1.15fr_1fr] lg:gap-12 lg:py-16">
        <div>
          <h1 className="mb-3">
            <span className="mb-2 flex items-center gap-2 text-caption font-bold uppercase tracking-[0.12em] text-emerald-700">
              <Truck size={14} strokeWidth={2.5} />
              Surat · wholesale packaging
            </span>
            <span className="block text-4xl font-extrabold leading-[1.05] tracking-tight md:text-5xl lg:text-display">
              {hero.promiseLead}{" "}
              <span style={{ color: "var(--xl-accent)" }}>
                {hero.promiseAccent}
              </span>
            </span>
            <span className="mt-2 block text-lg font-bold tracking-tight text-slate-500 md:text-xl">
              {hero.titleLead} {hero.titleAccent}
            </span>
          </h1>

          <p className="mb-5 max-w-md text-body-md text-slate-600 md:text-base">
            {hero.subline}
          </p>

          <div className="mb-5 flex flex-col gap-2.5 sm:flex-row">
            <Link
              href="/catalog"
              className="inline-flex items-center justify-center gap-2 rounded-xl px-6 py-3.5 text-body-md font-bold text-white shadow-[0_6px_20px_rgba(220,38,38,0.28)] transition hover:opacity-90"
              style={{ background: "var(--xl-accent)" }}
            >
              Browse Products
              <ArrowRight size={16} />
            </Link>
            <a
              href={whatsappHref}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center justify-center gap-2 rounded-xl border-[1.5px] border-emerald-200 bg-white px-6 py-3.5 text-body-md font-bold text-emerald-700 transition hover:bg-emerald-50"
            >
              <MessageCircle size={16} />
              Get Quote on WhatsApp
            </a>
          </div>

          <div className="flex flex-wrap gap-x-4 gap-y-1.5">
            {hero.promiseTiers.map(t => (
              <span
                key={t}
                className="flex items-center gap-1.5 text-body-sm font-semibold text-slate-700"
              >
                <Check size={14} strokeWidth={3} className="flex-shrink-0 text-emerald-600" />
                {t}
              </span>
            ))}
          </div>
        </div>

        {/* Fixed-height stage. Hidden below lg: on a 390px screen it pushed the
            first product a full extra screen down, and the promise above is the
            point of the hero. */}
        {slides.length > 0 && (
          <div className="relative hidden h-[340px] overflow-hidden rounded-2xl border border-white/60 bg-white/40 shadow-sm lg:block">
            {slides.map((src, i) => (
              <img
                key={src}
                src={src}
                alt=""
                aria-hidden
                loading={i === 0 ? "eager" : "lazy"}
                fetchPriority={i === 0 ? "high" : "auto"}
                decoding="async"
                className="xl-hero-slide absolute inset-0 h-full w-full object-cover"
                style={{
                  animationDelay: `${(i * 18) / slides.length}s`,
                  // Later layers sit above earlier ones; each fades out to
                  // reveal the next. Layer 1 needs no fade of its own.
                  zIndex: i,
                }}
              />
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
