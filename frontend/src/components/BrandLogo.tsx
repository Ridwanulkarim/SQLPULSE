import React from 'react';

export type LogoStyle = 'pulse-hex' | 'spulse-monogram' | 'relational-core';

interface BrandLogoProps {
  size?: 'sm' | 'md' | 'lg' | 'xl';
  style?: LogoStyle;
  className?: string;
  withGlow?: boolean;
  withText?: boolean;
}

export const BrandLogo: React.FC<BrandLogoProps> = ({
  size = 'md',
  style = 'pulse-hex',
  className = '',
  withGlow = true,
  withText = false,
}) => {
  const sizeMap = {
    sm: {
      box: 'w-7 h-7 rounded-lg',
      svg: 20,
      fontSize: 'text-sm',
      gap: 'gap-1.5',
    },
    md: {
      box: 'w-8 h-8 sm:w-9 sm:h-9 rounded-xl',
      svg: 24,
      fontSize: 'text-base sm:text-lg',
      gap: 'gap-2',
    },
    lg: {
      box: 'w-11 h-11 sm:w-12 sm:h-12 rounded-2xl',
      svg: 32,
      fontSize: 'text-2xl',
      gap: 'gap-3',
    },
    xl: {
      box: 'w-14 h-14 rounded-2xl',
      svg: 40,
      fontSize: 'text-3xl',
      gap: 'gap-3.5',
    },
  };

  const config = sizeMap[size];

  const renderSvgContent = () => {
    switch (style) {
      case 'spulse-monogram':
        return (
          <svg
            width={config.svg}
            height={config.svg}
            viewBox="0 0 32 32"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            className="drop-shadow-[0_2px_8px_rgba(0,240,255,0.4)]"
          >
            {/* S-Shape Relational Wave */}
            <path
              d="M24 8.5C24 6.01472 20.4183 4 16 4C11.5817 4 8 6.01472 8 8.5C8 10.9853 11.5817 13 16 13C20.4183 13 24 15.0147 24 17.5C24 19.9853 20.4183 22 16 22C11.5817 22 8 19.9853 8 17.5"
              stroke="url(#spulse-grad-1)"
              strokeWidth="2.8"
              strokeLinecap="round"
            />
            {/* High-frequency Electric Pulse Line */}
            <path
              d="M3 16H9L12.5 8L16.5 24L20 13L22.5 16H29"
              stroke="url(#spulse-neon-cyan)"
              strokeWidth="2.4"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <defs>
              <linearGradient id="spulse-grad-1" x1="8" y1="4" x2="24" y2="22" gradientUnits="userSpaceOnUse">
                <stop stopColor="#6366f1" />
                <stop offset="1" stopColor="#06b6d4" />
              </linearGradient>
              <linearGradient id="spulse-neon-cyan" x1="3" y1="16" x2="29" y2="16" gradientUnits="userSpaceOnUse">
                <stop stopColor="#38bdf8" />
                <stop offset="0.5" stopColor="#00f0ff" />
                <stop offset="1" stopColor="#818cf8" />
              </linearGradient>
            </defs>
          </svg>
        );

      case 'relational-core':
        return (
          <svg
            width={config.svg}
            height={config.svg}
            viewBox="0 0 32 32"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            className="drop-shadow-[0_2px_8px_rgba(99,102,241,0.4)]"
          >
            {/* Top Cylinder Disc */}
            <ellipse cx="16" cy="7" rx="10" ry="3.5" stroke="url(#rc-grad-top)" strokeWidth="2.2" />
            
            {/* Middle Disc */}
            <path d="M6 7v6c0 1.933 4.477 3.5 10 3.5s10-1.567 10-3.5V7" stroke="url(#rc-grad-mid)" strokeWidth="2.2" strokeLinecap="round" />
            
            {/* Bottom Disc */}
            <path d="M6 13v6c0 1.933 4.477 3.5 10 3.5s10-1.567 10-3.5v-6" stroke="url(#rc-grad-bot)" strokeWidth="2.2" strokeLinecap="round" />

            {/* Glowing Pulse Center Node */}
            <circle cx="16" cy="16.5" r="2.5" fill="#00f0ff" />
            <path d="M10 16.5h12" stroke="#00f0ff" strokeWidth="2" strokeLinecap="round" />

            <defs>
              <linearGradient id="rc-grad-top" x1="6" y1="7" x2="26" y2="7" gradientUnits="userSpaceOnUse">
                <stop stopColor="#38bdf8" />
                <stop offset="1" stopColor="#818cf8" />
              </linearGradient>
              <linearGradient id="rc-grad-mid" x1="6" y1="10" x2="26" y2="16.5" gradientUnits="userSpaceOnUse">
                <stop stopColor="#818cf8" />
                <stop offset="1" stopColor="#c084fc" />
              </linearGradient>
              <linearGradient id="rc-grad-bot" x1="6" y1="16" x2="26" y2="22.5" gradientUnits="userSpaceOnUse">
                <stop stopColor="#6366f1" />
                <stop offset="1" stopColor="#38bdf8" />
              </linearGradient>
            </defs>
          </svg>
        );

      case 'pulse-hex':
      default:
        // World-Class Isometric Hexagonal Database Prism with Embedded Pulse Wave
        return (
          <svg
            width={config.svg}
            height={config.svg}
            viewBox="0 0 32 32"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            className="drop-shadow-[0_2px_10px_rgba(6,182,212,0.45)]"
          >
            {/* Top Isometric Facet (Database Disc) */}
            <path
              d="M16 3.5L27 9.8L16 16.2L5 9.8L16 3.5Z"
              fill="url(#hex-top-fill)"
              stroke="url(#hex-cyan-edge)"
              strokeWidth="1.8"
              strokeLinejoin="round"
            />
            {/* Internal disc contour */}
            <ellipse cx="16" cy="9.8" rx="6" ry="2.6" stroke="#00f0ff" strokeWidth="1.2" strokeOpacity="0.8" />

            {/* Left Facet */}
            <path
              d="M5 9.8V22.2L16 28.5V16.2L5 9.8Z"
              fill="url(#hex-left-fill)"
              stroke="url(#hex-indigo-edge)"
              strokeWidth="1.8"
              strokeLinejoin="round"
            />

            {/* Right Facet */}
            <path
              d="M16 16.2V28.5L27 22.2V9.8L16 16.2Z"
              fill="url(#hex-right-fill)"
              stroke="url(#hex-cyan-edge)"
              strokeWidth="1.8"
              strokeLinejoin="round"
            />

            {/* Dynamic Oscilloscope Pulse Wave crossing the facets */}
            <path
              d="M7 19.5L12 17L14.5 24.5L17.5 11L20.5 19L25 16.5"
              stroke="#00f0ff"
              strokeWidth="2.2"
              strokeLinecap="round"
              strokeLinejoin="round"
              filter="url(#pulse-glow)"
            />

            <defs>
              <linearGradient id="hex-top-fill" x1="16" y1="3.5" x2="16" y2="16.2" gradientUnits="userSpaceOnUse">
                <stop stopColor="#1e293b" />
                <stop offset="1" stopColor="#0f172a" />
              </linearGradient>
              <linearGradient id="hex-left-fill" x1="5" y1="9.8" x2="16" y2="28.5" gradientUnits="userSpaceOnUse">
                <stop stopColor="#0f172a" />
                <stop offset="1" stopColor="#020617" />
              </linearGradient>
              <linearGradient id="hex-right-fill" x1="27" y1="9.8" x2="16" y2="28.5" gradientUnits="userSpaceOnUse">
                <stop stopColor="#1e1b4b" />
                <stop offset="1" stopColor="#090d16" />
              </linearGradient>
              <linearGradient id="hex-cyan-edge" x1="5" y1="3.5" x2="27" y2="28.5" gradientUnits="userSpaceOnUse">
                <stop stopColor="#00f0ff" />
                <stop offset="0.6" stopColor="#38bdf8" />
                <stop offset="1" stopColor="#6366f1" />
              </linearGradient>
              <linearGradient id="hex-indigo-edge" x1="5" y1="9.8" x2="16" y2="28.5" gradientUnits="userSpaceOnUse">
                <stop stopColor="#6366f1" />
                <stop offset="1" stopColor="#3b82f6" />
              </linearGradient>
              <filter id="pulse-glow" x="3" y="7" width="26" height="22" filterUnits="userSpaceOnUse">
                <feGaussianBlur stdDeviation="1.2" result="blur" />
                <feMerge>
                  <feMergeNode in="blur" />
                  <feMergeNode in="SourceGraphic" />
                </feMerge>
              </filter>
            </defs>
          </svg>
        );
    }
  };

  return (
    <div className={`flex items-center ${config.gap} ${className}`}>
      {/* Precision Engineered Squircle Badge */}
      <div
        className={`relative inline-flex items-center justify-center shrink-0 ${config.box} bg-[#070b14] border border-cyan-500/30 shadow-md ${
          withGlow
            ? 'shadow-cyan-500/20 hover:shadow-cyan-500/40 hover:border-cyan-400'
            : ''
        } transition-all duration-300 group`}
      >
        {/* Subtle Ambient Radial Backlight */}
        <div className="absolute inset-0 bg-gradient-to-tr from-cyan-500/15 via-indigo-600/10 to-transparent rounded-[inherit] opacity-80" />

        {/* The Vector Geometry */}
        <div className="relative z-10 flex items-center justify-center">
          {renderSvgContent()}
        </div>
      </div>

      {/* Optional Integrated Wordmark */}
      {withText && (
        <div className="flex items-center font-brand">
          <span className={`font-brand font-extrabold ${config.fontSize} text-slate-950 dark:text-white tracking-[-0.035em]`}>
            SQL<span className="text-[#0096b3] dark:text-[#00f0ff]">Pulse</span>
          </span>
        </div>
      )}
    </div>
  );
};
