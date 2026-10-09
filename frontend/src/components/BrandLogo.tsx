import React from 'react';

export type LogoStyle = 'sql-pulse' | 'db-pulse';

interface BrandLogoProps {
  size?: 'sm' | 'md' | 'lg' | 'xl';
  style?: LogoStyle;
  className?: string;
  withText?: boolean;
}

export const BrandLogo: React.FC<BrandLogoProps> = ({
  size = 'md',
  style = 'sql-pulse',
  className = '',
  withText = false,
}) => {
  const sizeMap = {
    sm: {
      box: 'w-7 h-7',
      svg: 18,
      fontSize: 'text-lg',
      gap: 'gap-2',
    },
    md: {
      box: 'w-[34px] h-[34px]',
      svg: 22,
      fontSize: 'text-xl',
      gap: 'gap-2.5',
    },
    lg: {
      box: 'w-11 h-11',
      svg: 28,
      fontSize: 'text-2xl',
      gap: 'gap-3',
    },
    xl: {
      box: 'w-14 h-14',
      svg: 36,
      fontSize: 'text-3xl',
      gap: 'gap-3.5',
    },
  };

  const config = sizeMap[size];

  const renderSvgContent = () => {
    if (style === 'db-pulse') {
      return (
        <svg
          width={config.svg}
          height={config.svg}
          viewBox="0 0 32 32"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          {/* Top Database Platter Rim */}
          <path
            d="M9.5 8.8C11.5 7.2 20.5 7.2 22.5 8.8"
            stroke="currentColor"
            strokeWidth="2.4"
            strokeLinecap="round"
          />
          {/* Center Electric Pulse Wave */}
          <path
            d="M5.5 16H11L13.5 9.5L17.5 22.5L20 16H26.5"
            stroke="currentColor"
            strokeWidth="2.6"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          {/* Bottom Database Platter Rim */}
          <path
            d="M9.5 23.2C11.5 24.8 20.5 24.8 22.5 23.2"
            stroke="currentColor"
            strokeWidth="2.4"
            strokeLinecap="round"
          />
        </svg>
      );
    }

    // Default 'sql-pulse': S-Pulse Monogram (Harmonious S with sharp pulse rhythm)
    return (
      <svg
        width={config.svg}
        height={config.svg}
        viewBox="0 0 32 32"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <path
          d="M21.5 9.8C21.5 7.6 19.2 6.5 16 6.5C12.5 6.5 10.5 8 10.5 10.8C10.5 13.2 12 14.5 14.2 15.2H11.5L13.8 9.5L17.2 22.5L19.2 15.2H20.5C22.8 16 23.5 17.5 23.5 19.8C23.5 22.8 20.8 24.8 16 24.8C12.5 24.8 10.5 23.2 10.2 21"
          stroke="currentColor"
          strokeWidth="2.6"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    );
  };

  return (
    <div className={`inline-flex items-center ${config.gap} ${className}`}>
      {/* Sleek, solid circular badge matching Next Elite style */}
      <div
        className={`relative inline-flex items-center justify-center shrink-0 ${config.box} rounded-full bg-black text-white dark:bg-white dark:text-black shadow-sm transition-transform active:scale-95`}
      >
        {renderSvgContent()}
      </div>

      {withText && (
        <span
          className={`font-bold ${config.fontSize} tracking-[-0.03em] text-zinc-950 dark:text-white select-none`}
        >
          SQLPulse
        </span>
      )}
    </div>
  );
};
