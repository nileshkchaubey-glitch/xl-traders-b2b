import { Link } from "wouter";
import type { HeroContent } from "@/lib/settingsService";

interface HeroSlideshowProps {
  hero: HeroContent;
  /** Local hero images. CSS-crossfaded; never video, GIF or base64. */
  slides: string[];
}

/**
 * The hero, matching the frozen prototype.
 *
 * ── What it is ───────────────────────────────────────────────────────────
 * A full-bleed image slideshow with the content OVERLAID on it: one line, one
 * button. That is the whole hero.
 *
 *   design-reference/xl-traders-storefront.dc.html:
 *     <div style="position:absolute; …">
 *       <div style="font-size:44px; …">You order, we deliver.</div>
 *       <button …>Shop catalogue</button>
 *     </div>
 *
 * ── What it deliberately no longer has ───────────────────────────────────
 * An eyebrow, a two-part headline, a sub-headline, a paragraph, a second
 * button, and a checkmark tier row — all pre-V3 copy that had been left wired
 * up. The owner's instruction is that nothing sits on this page that is not a
 * product or a route to products, and the dispatch and hours information lives
 * in the top bar, where it already was.
 *
 * The line is the company TAGLINE, not a timing promise — it makes no claim
 * about when anything arrives.
 *
 * ── Motion ───────────────────────────────────────────────────────────────
 * CSS only. One opacity keyframe per layer, staggered by animation-delay; no
 * video, no GIF, no JS loop, no timer state. Fixed height, so the page cannot
 * shift between slides. The dots are animated on the SAME cycle rather than
 * driven by state, which keeps the whole thing stateless.
 * `prefers-reduced-motion` shows the first slide and stops (index.css).
 */
export default function HeroSlideshow({ hero, slides }: HeroSlideshowProps) {
  const count = Math.max(slides.length, 1);
  const cycle = 18; // seconds, must match the xl-hero-fade keyframe duration

  return (
    <section className="relative overflow-hidden">
      <div className="relative h-[320px] w-full sm:h-[380px] lg:h-[460px]">
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
            style={{ animationDelay: `${(i * cycle) / count}s`, zIndex: i }}
          />
        ))}

        {/* Legibility scrim. The prototype leans on a text-shadow; a gradient
            holds up better across four very different photographs. */}
        <div
          className="pointer-events-none absolute inset-0 z-10"
          style={{
            background:
              "linear-gradient(90deg, rgba(15,23,42,0.78) 0%, rgba(15,23,42,0.45) 55%, rgba(15,23,42,0.05) 100%)",
          }}
        />

        <div className="absolute inset-0 z-20 flex flex-col items-start justify-end gap-3 p-5 sm:justify-center sm:p-10 lg:p-14">
          <h1
            className="max-w-[15ch] text-[26px] font-extrabold leading-[1.05] tracking-tight text-white sm:text-4xl lg:text-[44px]"
            style={{ textShadow: "0 2px 18px rgba(15,23,42,0.5)" }}
          >
            {hero.line}
          </h1>
          <Link
            href="/catalog"
            className="rounded-xl px-5 py-3 text-body-sm font-extrabold text-white transition hover:opacity-90 lg:px-7 lg:py-3.5 lg:text-body-md"
            style={{ background: "var(--xl-accent)" }}
          >
            {hero.cta}
          </Link>
        </div>

        {slides.length > 1 && (
          <div className="absolute bottom-4 right-4 z-20 flex gap-1.5" aria-hidden>
            {slides.map((src, i) => (
              <span
                key={`dot-${src}`}
                className="xl-hero-dot block h-[7px] w-[7px] rounded-full bg-white/40"
                style={{ animationDelay: `${(i * cycle) / count}s` }}
              />
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
