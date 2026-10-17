import React from 'react';

interface BrandLogoProps {
  size?: 'sm' | 'md' | 'lg' | 'xl';
  variant?: 'full' | 'icon';
  theme?: 'light' | 'dark';
  className?: string;
  showTagline?: boolean;
}

export const BrandLogo: React.FC<BrandLogoProps> = ({
  size = 'md',
  variant = 'full',
  theme = 'light',
  className = '',
  showTagline = true,
}) => {
  // Dimension mappings
  const iconDimensions = {
    sm: { width: 34, height: 34 },
    md: { width: 44, height: 44 },
    lg: { width: 60, height: 60 },
    xl: { width: 88, height: 88 },
  }[size];

  const titleSizes = {
    sm: 'text-lg',
    md: 'text-2xl',
    lg: 'text-3xl',
    xl: 'text-4xl',
  }[size];

  const subtitleSizes = {
    sm: 'text-[9px]',
    md: 'text-[10px]',
    lg: 'text-xs',
    xl: 'text-xs',
  }[size];

  const isDark = theme === 'dark';

  return (
    <div className={`inline-flex items-center gap-3 ${className}`}>
      {/* Royal Crest SVG Emblem */}
      <svg
        width={iconDimensions.width}
        height={iconDimensions.height}
        viewBox="0 0 120 120"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="shrink-0 transition-transform duration-200 hover:scale-105 select-none"
        aria-hidden="true"
      >
        <defs>
          {/* Royal Gradient - Deep Crimson Background */}
          <radialGradient
            id="mbRoyalCrimson"
            cx="50%"
            cy="40%"
            r="60%"
            fx="50%"
            fy="30%"
          >
            <stop offset="0%" stopColor="#9C172A" />
            <stop offset="60%" stopColor="#801323" />
            <stop offset="100%" stopColor="#4A0710" />
          </radialGradient>

          {/* Polished Burnished Gold Gradient */}
          <linearGradient id="mbGoldShine" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#FFE8A3" />
            <stop offset="30%" stopColor="#E2B755" />
            <stop offset="70%" stopColor="#C29B38" />
            <stop offset="100%" stopColor="#876518" />
          </linearGradient>

          {/* Warm Saffron Aroma Gradient */}
          <linearGradient id="mbSaffronAroma" x1="50%" y1="100%" x2="50%" y2="0%">
            <stop offset="0%" stopColor="#E08323" stopOpacity="0.8" />
            <stop offset="60%" stopColor="#F9C35C" stopOpacity="0.6" />
            <stop offset="100%" stopColor="#FFE8A3" stopOpacity="0" />
          </linearGradient>

          {/* Deg Copper Pot Gradient */}
          <linearGradient id="mbDegCopper" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#C27A38" />
            <stop offset="35%" stopColor="#F5B26E" />
            <stop offset="65%" stopColor="#E08A3C" />
            <stop offset="100%" stopColor="#9E561C" />
          </linearGradient>

          {/* Subtle Outer Drop Shadow */}
          <filter id="mbDropShadow" x="-10%" y="-10%" width="120%" height="120%">
            <feDropShadow dx="0" dy="2" stdDeviation="3" floodColor="#230408" floodOpacity="0.35" />
          </filter>
        </defs>

        {/* Outer Shadow Filter Wrapper */}
        <g filter="url(#mbDropShadow)">
          {/* Base Crest Circle with Royal Crimson */}
          <circle cx="60" cy="60" r="54" fill="url(#mbRoyalCrimson)" />

          {/* Outer Gold Rope/Beaded Ring Border */}
          <circle
            cx="60"
            cy="60"
            r="54"
            stroke="url(#mbGoldShine)"
            strokeWidth="3"
            fill="none"
          />
          <circle
            cx="60"
            cy="60"
            r="50"
            stroke="url(#mbGoldShine)"
            strokeWidth="1"
            strokeDasharray="2 3"
            fill="none"
            opacity="0.8"
          />
          <circle
            cx="60"
            cy="60"
            r="47"
            stroke="url(#mbGoldShine)"
            strokeWidth="1"
            fill="none"
            opacity="0.5"
          />

          {/* Top Royal Crown / Star Motif */}
          <path
            d="M60 16 L62.5 22 L68.5 22.5 L64 26.5 L65.5 32 L60 28.5 L54.5 32 L56 26.5 L51.5 22.5 L57.5 22 Z"
            fill="url(#mbGoldShine)"
          />
          <circle cx="48" cy="22" r="1.5" fill="url(#mbGoldShine)" opacity="0.8" />
          <circle cx="72" cy="22" r="1.5" fill="url(#mbGoldShine)" opacity="0.8" />

          {/* Aromatic Steam Curls (Slow Dum Pukht Vapor) */}
          <path
            d="M53 46 C50 41 55 37 52 32"
            stroke="url(#mbSaffronAroma)"
            strokeWidth="2.2"
            strokeLinecap="round"
            fill="none"
          />
          <path
            d="M60 44 C62 38 58 35 60 29"
            stroke="url(#mbGoldShine)"
            strokeWidth="2.4"
            strokeLinecap="round"
            fill="none"
          />
          <path
            d="M67 46 C70 41 65 37 68 32"
            stroke="url(#mbSaffronAroma)"
            strokeWidth="2.2"
            strokeLinecap="round"
            fill="none"
          />

          {/* Royal Dum Handi (Handcrafted Traditional Copper Deg) */}
          {/* Lid Handle */}
          <ellipse cx="60" cy="49" rx="3.5" ry="2" fill="url(#mbGoldShine)" />
          {/* Dome Lid */}
          <path
            d="M44 56 C44 50 51 47 60 47 C69 47 76 50 76 56 Z"
            fill="url(#mbDegCopper)"
          />
          {/* Sealed Dough Rim (Dum Pukht Sealing) */}
          <path
            d="M41 56 C41 55 43 54.5 45 54.5 L75 54.5 C77 54.5 79 55 79 56 C79 57 77 58 75 58 L45 58 C43 58 41 57 41 56 Z"
            fill="url(#mbGoldShine)"
          />

          {/* Main Handi Belly (Round Bottom Pot) */}
          <path
            d="M43 58 C41 68 47 79 60 79 C73 79 79 68 77 58 Z"
            fill="url(#mbDegCopper)"
          />

          {/* Pot Filigree Line & Highlighting */}
          <path
            d="M46 64 C50 70 55 72 60 72 C65 72 70 70 74 64"
            stroke="url(#mbGoldShine)"
            strokeWidth="1.2"
            strokeLinecap="round"
            fill="none"
            opacity="0.85"
          />

          {/* Side Pot Ring Handles */}
          <path
            d="M40 60 C37 60 36 63 38 65 C39 66 41 65 42 63"
            stroke="url(#mbGoldShine)"
            strokeWidth="2"
            strokeLinecap="round"
            fill="none"
          />
          <path
            d="M80 60 C83 60 84 63 82 65 C81 66 79 65 78 63"
            stroke="url(#mbGoldShine)"
            strokeWidth="2"
            strokeLinecap="round"
            fill="none"
          />

          {/* Saffron & Basmati Rice Grains Glow Base */}
          <ellipse cx="60" cy="80" rx="14" ry="2" fill="url(#mbGoldShine)" opacity="0.6" />

          {/* Bottom Royal Ribbon / Banner with 'M' Monogram */}
          <path
            d="M32 86 L44 83 L60 85 L76 83 L88 86 L84 94 L60 97 L36 94 Z"
            fill="url(#mbGoldShine)"
          />
          <path
            d="M36 94 L32 86 L28 91 Z"
            fill="#876518"
          />
          <path
            d="M84 94 L88 86 L92 91 Z"
            fill="#876518"
          />

          {/* Royal Calligraphic Monogram 'M' on the Gold Ribbon */}
          <text
            x="60"
            y="93"
            textAnchor="middle"
            fill="#4A0710"
            fontFamily="'Fraunces', serif"
            fontSize="10"
            fontWeight="900"
            letterSpacing="1.5"
          >
            M
          </text>

          {/* Symmetrical Spice Motifs: Bay Leaves & Cloves flanking the Pot */}
          {/* Left Bay Leaf */}
          <path
            d="M26 62 C29 55 35 55 34 65 C32 68 28 67 26 62 Z"
            fill="url(#mbGoldShine)"
            opacity="0.85"
          />
          {/* Right Bay Leaf */}
          <path
            d="M94 62 C91 55 85 55 86 65 C88 68 92 67 94 62 Z"
            fill="url(#mbGoldShine)"
            opacity="0.85"
          />

          {/* Miniature Stars */}
          <circle cx="28" cy="74" r="1.5" fill="url(#mbGoldShine)" opacity="0.9" />
          <circle cx="92" cy="74" r="1.5" fill="url(#mbGoldShine)" opacity="0.9" />

          {/* Bottom Year of Legacy dots */}
          <circle cx="52" cy="103" r="1.2" fill="url(#mbGoldShine)" opacity="0.8" />
          <circle cx="60" cy="104" r="1.6" fill="url(#mbGoldShine)" />
          <circle cx="68" cy="103" r="1.2" fill="url(#mbGoldShine)" opacity="0.8" />
        </g>
      </svg>

      {/* Brand Typography (Only in full variant) */}
      {variant === 'full' && (
        <div className="flex flex-col text-left select-none">
          <div className="flex items-center gap-1.5">
            <span
              className={`font-serif ${titleSizes} font-black tracking-tight leading-none ${
                isDark ? 'text-white' : 'text-[#801323]'
              }`}
            >
              Mantasha
            </span>
            <span
              className={`font-serif ${titleSizes} font-bold tracking-tight leading-none ${
                isDark ? 'text-[#DFB24E]' : 'text-[#C29B38]'
              }`}
            >
              Biryani
            </span>
          </div>
          {showTagline && (
            <div className="flex items-center gap-1.5 mt-0.5">
              <span
                className={`uppercase font-sans ${subtitleSizes} font-bold tracking-widest leading-tight ${
                  isDark ? 'text-[#DFB24E]' : 'text-stone-500'
                }`}
              >
                Royal Dum House
              </span>
              <span
                className={`text-[8px] ${
                  isDark ? 'text-stone-400' : 'text-stone-400'
                }`}
                aria-hidden="true"
              >
                ·
              </span>
              <span
                className={`uppercase font-sans ${subtitleSizes} font-semibold tracking-wider ${
                  isDark ? 'text-stone-300' : 'text-stone-600'
                }`}
              >
                Bhagalpur
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
