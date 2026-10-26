import React, { useState, useEffect } from 'react';
import { ArrowRight } from 'lucide-react';

interface QRCoverViewProps {
  tableNumber: string;
  restaurantName?: string;
  onEnter: () => void;
  onExplore?: () => void;
}

export const QRCoverView: React.FC<QRCoverViewProps> = ({
  tableNumber,
  onEnter
}) => {
  // Format dynamic table context (e.g., 'T-05')
  const formattedTable = React.useMemo(() => {
    if (!tableNumber) return 'TABLE T-05';
    const clean = tableNumber.trim().toUpperCase();
    if (clean.startsWith('TABLE')) return clean;
    if (clean.startsWith('T-')) return `TABLE ${clean}`;
    return `TABLE T-${clean.padStart(2, '0')}`;
  }, [tableNumber]);

  // Primary image source pointing to the exact existing image from /public
  const [imageSrc, setImageSrc] = useState<string>(() => {
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem('pali_custom_cover_poster');
      if (stored) return stored;
    }
    return '/pali-resort-welcome.png';
  });

  // Animation states for calm, luxury reveals
  const [mounted, setMounted] = useState(false);
  const [imageLoaded, setImageLoaded] = useState(false);

  useEffect(() => {
    // Gentle reveal sequence
    const timer = setTimeout(() => {
      setMounted(true);
    }, 50);
    return () => clearTimeout(timer);
  }, []);

  const handleImageError = () => {
    if (imageSrc !== '/pali_welcome_hero.png') {
      setImageSrc('/pali_welcome_hero.png');
    } else if (imageSrc !== '/customer_resort_sunset.svg') {
      setImageSrc('/customer_resort_sunset.svg');
    }
  };

  // Optional drag-and-drop handler to allow staff or manager to drop custom resort photos
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const file = e.dataTransfer.files[0];
      if (file.type.startsWith('image/')) {
        const reader = new FileReader();
        reader.onload = (event) => {
          const result = event.target?.result as string;
          if (result) {
            localStorage.setItem('pali_custom_cover_poster', result);
            setImageSrc(result);
          }
        };
        reader.readAsDataURL(file);
      }
    }
  };

  return (
    <section
      aria-label="Pali Resort & Club Dine-in Welcome"
      onDragOver={(e) => e.preventDefault()}
      onDrop={handleDrop}
      className="relative w-full h-[100dvh] min-h-[100dvh] flex flex-col justify-between overflow-hidden text-[#F7F4EC] font-sans select-none bg-[#163024]"
      style={{
        paddingTop: 'max(env(safe-area-inset-top), 0.75rem)',
        paddingBottom: 'max(env(safe-area-inset-bottom), 1.25rem)'
      }}
    >
      {/* 1. FULL-SCREEN LUXURY RESORT HERO BACKGROUND */}
      <div className="absolute inset-0 z-0 overflow-hidden bg-[#163024]">
        <img
          src={imageSrc}
          alt="Pali Resort & Club Sunset Dining Sanctuary"
          onLoad={() => setImageLoaded(true)}
          onError={handleImageError}
          className={`w-full h-full object-cover object-center transition-all duration-1000 ease-out ${
            imageLoaded || mounted ? 'opacity-100 scale-100' : 'opacity-0 scale-[1.02]'
          }`}
          referrerPolicy="no-referrer"
        />

        {/* Soft, ultra-subtle top vignette for safe-area status bar contrast without dimming the sky/logo */}
        <div className="absolute inset-x-0 top-0 h-24 bg-gradient-to-b from-black/40 via-black/10 to-transparent pointer-events-none" />

        {/* Delicate lower vignette in Deep Forest Green #163024 to ensure flawless typography contrast while showcasing the pool & candle ambiance */}
        <div className="absolute inset-x-0 bottom-0 h-80 sm:h-96 bg-gradient-to-t from-[#163024] via-[#163024]/80 via-45% to-transparent pointer-events-none" />
      </div>

      {/* 2. TOP SAFE-AREA PADDING (Keeps photograph's existing logo unobstructed) */}
      <header className="relative z-10 pt-2 sm:pt-4 px-5 sm:px-6 flex justify-between items-center pointer-events-none">
        {/* Subtle decorative spacing; the Pali Resort & Club crest & typography from the hero image shine through */}
        <div className="w-full flex justify-end">
          <div
            className={`transition-all duration-700 delay-300 ease-out ${
              mounted ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-2'
            }`}
          >
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-black/35 backdrop-blur-md border border-[#C5A86A]/40 text-[#C5A86A] text-[10px] font-mono tracking-widest uppercase">
              <span className="w-1.5 h-1.5 rounded-full bg-[#C5A86A] animate-pulse" />
              <span>DINE-IN</span>
            </span>
          </div>
        </div>
      </header>

      {/* 3. CENTER AMBIANCE WINDOW: Unobstructed view of swimming pool, villa lights, lanterns & table setting */}
      <div className="relative z-10 flex-1 min-h-[100px] pointer-events-none" />

      {/* 4. LOWER CONTENT ZONE: TABLE CONTEXT, WELCOME MESSAGE & PRIMARY CTA */}
      <footer className="relative z-20 pb-4 sm:pb-6 px-5 sm:px-8 space-y-3.5 sm:space-y-4 max-w-md mx-auto w-full">
        {/* TABLE CONTEXT OVERLAY */}
        <div
          className={`transition-all duration-700 delay-200 ease-out flex items-center justify-start ${
            mounted ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-3'
          }`}
        >
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-[#163024]/90 backdrop-blur-md border border-[#C5A86A]/45 text-[#C5A86A] text-xs font-mono tracking-widest uppercase shadow-md">
            <span className="w-1.5 h-1.5 rounded-full bg-[#C5A86A]" />
            <span className="font-semibold">{formattedTable}</span>
          </div>
        </div>

        {/* WELCOME MESSAGE */}
        <div
          className={`space-y-1 text-left transition-all duration-700 delay-350 ease-out ${
            mounted ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'
          }`}
        >
          <h1 className="font-serif text-2xl sm:text-[28px] font-medium tracking-wide text-[#F7F4EC] leading-tight drop-shadow-md">
            Welcome to Pali Resort &amp; Club
          </h1>
          <p className="text-xs sm:text-sm text-[#F7F4EC]/85 font-sans font-normal tracking-wide drop-shadow-sm">
            Your dining experience begins here.
          </p>
        </div>

        {/* PRIMARY ACTION: EXPLORE MENU (Takes guest immediately to Food Menu with zero friction) */}
        <div
          className={`pt-1.5 sm:pt-2 transition-all duration-700 delay-500 ease-out ${
            mounted ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'
          }`}
        >
          <button
            id="btn-explore-menu"
            type="button"
            onClick={onEnter}
            aria-label="Explore Menu"
            className="w-full py-3.5 sm:py-4 px-6 rounded-2xl bg-[#C5A86A] hover:bg-[#d4ba7c] active:scale-[0.98] text-[#163024] font-semibold text-sm tracking-widest uppercase shadow-xl shadow-black/35 border border-[#C5A86A]/60 transition-all flex items-center justify-center gap-2.5 cursor-pointer group hover:shadow-[#C5A86A]/30"
          >
            <span className="font-sans font-bold">Explore Menu</span>
            <ArrowRight className="w-4 h-4 text-[#163024] group-hover:translate-x-1 transition-transform" />
          </button>

          <p className="text-[11px] text-[#F7F4EC]/65 font-sans text-center mt-2.5 tracking-wide">
            Instant table service • Chef specials &amp; handcrafted beverages
          </p>
        </div>
      </footer>
    </section>
  );
};
