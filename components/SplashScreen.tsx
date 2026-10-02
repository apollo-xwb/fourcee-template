import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { PhoneCall } from 'lucide-react';
import { EtherealShadow } from './ui/etheral-shadow';
import { DottedSurface } from './ui/dotted-surface';
import DisplayCards from './ui/display-cards';
import fcShad from '../public/assets/fcshad.png';
import { preloadRingAssets } from '../lib/preload-ring';

const STATS = [
  "Jewelers lose 40% of leads to missed calls.",
  "Custom ring inquiries peak between 8 PM and 11 PM.",
  "92% of high-end clients expect instant booking confirmation.",
  "AI response times are 120x faster than traditional front desks.",
  "One missed $5k sale covers 18 months of Fourcee service."
];

/** Same trio as homepage "Silence is Expensive" — beige/black for splash. */
const SPLASH_OPPORTUNITY_CARDS = [
  {
    icon: <PhoneCall className="size-4 text-[#faf5ea]" />,
    title: "Missed Opportunity",
    description: "$12,000 Anniversary Inquiry",
    date: "Sunday, 8:14 PM",
    iconClassName: "text-[#0c0b09]",
    titleClassName: "text-[#0c0b09]",
    iconWrapperClassName: "bg-[#0c0b09]",
    className:
      "[grid-area:stack] -translate-y-6 before:absolute before:w-[100%] before:outline-1 before:rounded-xl before:outline-[#0c0b09]/15 before:h-[100%] before:content-[''] before:bg-blend-overlay before:bg-[#faf5ea]/40 grayscale-[40%] before:left-0 before:top-0 border-[#0c0b09]/20 bg-[#faf5ea]/85 text-[#0c0b09] after:from-[#faf5ea]",
  },
  {
    icon: <PhoneCall className="size-4 text-[#faf5ea]" />,
    title: "Missed Opportunity",
    description: "$8,500 Engagement Lead",
    date: "Saturday, 9:30 PM",
    iconClassName: "text-[#0c0b09]",
    titleClassName: "text-[#0c0b09]",
    iconWrapperClassName: "bg-[#0c0b09]",
    className:
      "[grid-area:stack] translate-x-12 translate-y-2 before:absolute before:w-[100%] before:outline-1 before:rounded-xl before:outline-[#0c0b09]/15 before:h-[100%] before:content-[''] before:bg-blend-overlay before:bg-[#faf5ea]/25 grayscale-[20%] before:left-0 before:top-0 border-[#0c0b09]/25 bg-[#faf5ea]/90 text-[#0c0b09] after:from-[#faf5ea]",
  },
  {
    icon: <PhoneCall className="size-4 text-[#faf5ea]" />,
    title: "Missed Opportunity",
    description: "$15,000 Watch Inquiry",
    date: "Yesterday, 11:45 PM",
    iconClassName: "text-[#0c0b09]",
    titleClassName: "text-[#0c0b09]",
    iconWrapperClassName: "bg-[#0c0b09]",
    className:
      "[grid-area:stack] translate-x-24 translate-y-10 border-[#0c0b09]/30 bg-[#faf5ea] text-[#0c0b09] shadow-lg after:from-[#faf5ea]",
  },
];

export const SplashScreen: React.FC<{ onComplete: () => void }> = ({ onComplete }) => {
  const [stat] = useState(() => STATS[Math.floor(Math.random() * STATS.length)]);
  const [fade, setFade] = useState(false);

  useEffect(() => {
    // Warm GLB + Draco + WebGL while splash is up so the ring is ready
    void preloadRingAssets();
    const timer = setTimeout(() => {
      setFade(true);
      setTimeout(onComplete, 700);
    }, 2800);
    return () => clearTimeout(timer);
  }, [onComplete]);

  return (
    <div
      className={`fixed inset-0 z-[9999] bg-[#faf5ea] flex flex-col items-center justify-center overflow-hidden transition-opacity duration-700 ${
        fade ? 'opacity-0' : 'opacity-100'
      }`}
    >
      {/* Soft beige grid */}
      <div
        className="absolute inset-0 z-0 pointer-events-none"
        style={{
          backgroundImage:
            'linear-gradient(to right, rgba(12,11,9,0.06) 1px, transparent 1px), linear-gradient(to bottom, rgba(12,11,9,0.06) 1px, transparent 1px)',
          backgroundSize: '36px 36px',
        }}
      />
      {/* Warm ethereal glow */}
      <div className="absolute inset-0 z-0 pointer-events-none opacity-50">
        <EtherealShadow
          color="rgba(200, 181, 143, 0.22)"
          animation={{ scale: 100, speed: 20 }}
          noise={{ opacity: 0.28, scale: 1.2 }}
        />
      </div>
      {/* Smooth black dots rising from bottom */}
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-56">
        <DottedSurface
          isDarkMode={false}
          className="h-full w-full opacity-80 [mask-image:linear-gradient(to_top,black,transparent)]"
        />
      </div>

      <div className="relative z-10 flex flex-col items-center justify-center w-full max-w-lg px-4">
        {/* Single prominent wordmark — top stacked logo.png removed */}
        <motion.div
          className="mb-6 md:mb-8"
          initial={{ opacity: 0, scale: 0.88, y: 12 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
        >
          <img
            src={fcShad}
            alt="fourcee concierge"
            className="w-64 sm:w-72 md:w-[22rem] mx-auto object-contain drop-shadow-sm"
          />
        </motion.div>

        <div className="h-[2px] w-12 bg-[#0c0b09]/35 mx-auto mb-6" />

        {/* Floating missed-opportunity trio — staggered entrance + soft float while waiting */}
        <div className="relative w-full flex items-center justify-center h-[200px] sm:h-[240px] md:h-[280px] overflow-visible">
          <motion.div
            className="relative z-10 scale-[0.52] sm:scale-[0.65] md:scale-[0.78] origin-center"
            animate={{ y: [0, -6, 0] }}
            transition={{ duration: 3.2, repeat: Infinity, ease: 'easeInOut' }}
          >
            <DisplayCards cards={SPLASH_OPPORTUNITY_CARDS} staggerEntrance />
          </motion.div>
        </div>

        <motion.p
          className="mt-4 max-w-xs text-center text-sm font-medium text-[#3a342b] uppercase tracking-widest leading-relaxed px-6"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.9, duration: 0.5 }}
        >
          {stat}
        </motion.p>
      </div>
    </div>
  );
};
