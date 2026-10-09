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
      box: 'w-8 h-8 rounded-xl',
      svg: 22,
      fontSize: 'text-lg',
      gap: 'gap-2',
    },
    md: {
      box: 'w-10 h-10 rounded-[14px]',
      svg: 28,
      fontSize: 'text-2xl',
      gap: 'gap-2.5',
    },
    lg: {
      box: 'w-12 h-12 rounded-2xl',
      svg: 34,
      fontSize: 'text-3xl',
      gap: 'gap-3',
    },
    xl: {
      box: 'w-16 h-16 rounded-[20px]',
      svg: 44,
      fontSize: 'text-4xl',
      gap: 'gap-4',
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
            <path
              d="M24 8.5C24 6.01472 20.4183 4 16 4C11.5817 4 8 6.01472 8 8.5C8 10.9853 11.5817 13 16 13C20.4183 13 24 15.0147 24 17.5C24 19.9853 20.4183 22 16 22C11.5817 22 8 19.9853 8 17.5"
              stroke="url(#spulse-grad-1)"
              strokeWidth="2.8"
              strokeLinecap="round"
            />
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
            <ellipse cx="16" cy="7" rx="10" ry="3.5" stroke="url(#rc-grad-top)" strokeWidth="2.2" />
            <path d="M6 7v6c0 1.933 4.477 3.5 10 3.5s10-1.567 10-3.5V7" stroke="url(#rc-grad-mid)" strokeWidth="2.2" strokeLinecap="round" />
            <path d="M6 13v6c0 1.933 4.477 3.5 10 3.5s10-1.567 10-3.5v-6" stroke="url(#rc-grad-bot)" strokeWidth="2.2" strokeLinecap="round" />
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
        return (
          <svg
            width={config.svg}
            height={config.svg}
            viewBox="0 0 32 32"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            className="overflow-visible drop-shadow-[0_0_8px_rgba(0,240,255,0.4)]"
          >
            {/* Top Isometric Diamond Face */}
            <path
              d="M16 4.2L26 9.8L16 15.5L6 9.8L16 4.2Z"
              fill="url(#cube-top-grad)"
              stroke="url(#cube-cyan-edge)"
              strokeWidth="1.8"
              strokeLinejoin="round"
            />
            {/* Database Cylinder Top Disc */}
            <ellipse
              cx="16"
              cy="9.8"
              rx="5.4"
              ry="2.3"
              stroke="#00F0FF"
              strokeWidth="1.5"
              fill="none"
              strokeOpacity="0.9"
            />

            {/* Left Face */}
            <path
              d="M6 9.8V21.8L16 27.5V15.5L6 9.8Z"
              fill="url(#cube-left-grad)"
              stroke="url(#cube-blue-edge)"
              strokeWidth="1.8"
              strokeLinejoin="round"
            />

            {/* Right Face */}
            <path
              d="M16 15.5V27.5L26 21.8V9.8L16 15.5Z"
              fill="url(#cube-right-grad)"
              stroke="url(#cube-cyan-edge)"
              strokeWidth="1.8"
              strokeLinejoin="round"
            />

            {/* Neon ECG Heartbeat Pulse Wave */}
            <path
              d="M4.5 19H10.5L13 24L16 8.5L19.5 26L22 15.5L24.5 19H27.5"
              stroke="#00F0FF"
              strokeWidth="2.4"
              strokeLinecap="round"
              strokeLinejoin="round"
              filter="url(#pulse-electric-glow)"
            />

            <defs>
              <linearGradient id="cube-top-grad" x1="16" y1="4.2" x2="16" y2="15.5" gradientUnits="userSpaceOnUse">
                <stop stopColor="#1E293B" />
                <stop offset="1" stopColor="#0F172A" />
              </linearGradient>
              <linearGradient id="cube-left-grad" x1="6" y1="9.8" x2="16" y2="27.5" gradientUnits="userSpaceOnUse">
                <stop stopColor="#0B132B" />
                <stop offset="1" stopColor="#020617" />
              </linearGradient>
              <linearGradient id="cube-right-grad" x1="26" y1="9.8" x2="16" y2="27.5" gradientUnits="userSpaceOnUse">
                <stop stopColor="#0F1D38" />
                <stop offset="1" stopColor="#060C1B" />
              </linearGradient>
              <linearGradient id="cube-cyan-edge" x1="6" y1="4.2" x2="26" y2="27.5" gradientUnits="userSpaceOnUse">
                <stop stopColor="#00F0FF" />
                <stop offset="0.6" stopColor="#38BDF8" />
                <stop offset="1" stopColor="#3B82F6" />
              </linearGradient>
              <linearGradient id="cube-blue-edge" x1="6" y1="9.8" x2="16" y2="27.5" gradientUnits="userSpaceOnUse">
                <stop stopColor="#38BDF8" />
                <stop offset="1" stopColor="#2563EB" />
              </linearGradient>
              <filter id="pulse-electric-glow" x="0" y="4" width="32" height="26" filterUnits="userSpaceOnUse">
                <feGaussianBlur stdDeviation="1" result="blur" />
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
      <div
        className={`relative inline-flex items-center justify-center shrink-0 ${config.box} bg-[#080d1a] border border-cyan-500/30 shadow-md ${
          withGlow
            ? 'shadow-[0_2px_12px_rgba(0,240,255,0.25)] hover:shadow-[0_2px_16px_rgba(0,240,255,0.4)] hover:border-cyan-400'
            : ''
        } transition-all duration-300 group`}
      >
        <div className="absolute inset-0 bg-gradient-to-tr from-cyan-500/15 via-indigo-600/10 to-transparent rounded-[inherit] opacity-80" />

        <div className="relative z-10 flex items-center justify-center">
          {renderSvgContent()}
        </div>
      </div>

      {withText && (
        <div className="flex items-center select-none font-sans">
          <span className={`font-black ${config.fontSize} text-slate-900 dark:text-white tracking-[-0.035em] leading-none`}>
            SQL<span className="text-[#00A8B5] dark:text-[#00F0FF]">Pulse</span>
          </span>
        </div>
      )}
    </div>
  );
};
