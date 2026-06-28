import { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import { TRUST_STATS } from "./heroConfig";
import { useAnimatedCounter } from "./useAnimatedCounter";

function StatItem({
  stat,
  inView,
}: {
  stat: import("./heroConfig").TrustStat;
  inView: boolean;
}) {
  const count = useAnimatedCounter(
    "value" in stat ? stat.value : 0,
    1600,
    inView
  );

  if ("text" in stat) {
    return (
      <div className="text-center px-4">
        <p className="text-2xl md:text-3xl font-bold text-red-600">
          {stat.text}
        </p>
        <p className="text-xs md:text-sm text-slate-600 mt-1 font-medium">
          {stat.label}
        </p>
      </div>
    );
  }

  return (
    <div className="text-center px-4 border-r border-slate-200 last:border-r-0">
      <p className="text-2xl md:text-3xl font-bold text-slate-900 tabular-nums">
        {count}
        <span className="text-red-600">{stat.suffix}</span>
      </p>
      <p className="text-xs md:text-sm text-slate-600 mt-1 font-medium">
        {stat.label}
      </p>
    </div>
  );
}

export default function HeroTrustStrip() {
  const ref = useRef<HTMLDivElement>(null);
  const [inView, setInView] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) setInView(true);
      },
      { threshold: 0.3 }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <motion.section
      ref={ref}
      initial={{ opacity: 0, y: 16 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.5 }}
      className="border-y border-slate-200 bg-gradient-to-r from-slate-50 via-white to-slate-50"
    >
      <div className="max-w-7xl mx-auto px-4 py-8 md:py-10">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-6 md:gap-0 md:flex md:justify-between md:items-center">
          {TRUST_STATS.map(stat => (
            <StatItem key={stat.label} stat={stat} inView={inView} />
          ))}
        </div>
      </div>
    </motion.section>
  );
}
