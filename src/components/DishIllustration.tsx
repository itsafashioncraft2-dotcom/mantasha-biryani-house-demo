import React from 'react';

interface DishIllustrationProps {
  category: string;
  name: string;
  isVeg: boolean;
  className?: string;
}

export const DishIllustration: React.FC<DishIllustrationProps> = ({
  category,
  name,
  isVeg,
  className = 'w-full h-48',
}) => {
  // Customized visual styles based on dish type
  const isBiryani = category === 'biryani' || name.toLowerCase().includes('biryani');
  const isChaapOrCurry = category === 'curries' || name.toLowerCase().includes('chaap');
  const isStarter = category === 'starters' || name.toLowerCase().includes('kebab') || name.toLowerCase().includes('tikka');
  const isBread = category === 'breads' || name.toLowerCase().includes('paratha') || name.toLowerCase().includes('roti');
  const isDessert = category === 'desserts' || name.toLowerCase().includes('firni') || name.toLowerCase().includes('jamun');

  return (
    <div
      className={`relative overflow-hidden bg-gradient-to-br from-[#2D070B] via-[#4A0A12] to-[#1F0407] flex items-center justify-center select-none ${className}`}
    >
      {/* Decorative backdrop glow */}
      <div className="absolute inset-0 opacity-25 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-[#DFB24E] via-transparent to-transparent pointer-events-none" />

      {isBiryani && (
        <svg
          viewBox="0 0 320 220"
          className="w-full h-full max-h-52 drop-shadow-xl"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          {/* Earthen Handi Pot Base */}
          <ellipse cx="160" cy="180" rx="95" ry="24" fill="#140608" opacity="0.6" />
          <path
            d="M75 145 C75 185 245 185 245 145 C250 115 235 105 230 100 L90 100 C85 105 70 115 75 145 Z"
            fill="#8B3A2B"
          />
          <path
            d="M80 135 C82 170 238 170 240 135 C230 155 90 155 80 135 Z"
            fill="#69281C"
            opacity="0.8"
          />
          {/* Brass rim collar */}
          <ellipse cx="160" cy="100" rx="72" ry="14" fill="#C29B38" />
          <ellipse cx="160" cy="98" rx="68" ry="12" fill="#E8C868" />
          <ellipse cx="160" cy="96" rx="64" ry="10" fill="#8B3A2B" />

          {/* Steaming Dum Basmati Rice Mound */}
          <path
            d="M98 96 C105 50 215 50 222 96 Z"
            fill="#F6E7B0"
          />
          {/* Saffron and Turmeric rice grain streaks */}
          <path
            d="M120 85 C140 60 180 62 200 88"
            stroke="#DF8A14"
            strokeWidth="5"
            strokeLinecap="round"
          />
          <path
            d="M135 72 C150 55 170 58 185 70"
            stroke="#F9A825"
            strokeWidth="4"
            strokeLinecap="round"
          />
          <path
            d="M110 92 C130 80 160 82 180 94"
            stroke="#F59E0B"
            strokeWidth="3.5"
            strokeLinecap="round"
          />

          {/* Golden Aloo / Spiced potato & Succulent pieces */}
          <ellipse cx="160" cy="74" rx="14" ry="11" fill="#D97706" />
          <ellipse cx="158" cy="72" rx="11" ry="8" fill="#FBBF24" opacity="0.6" />
          {!isVeg ? (
            <>
              {/* Spiced chicken/mutton piece */}
              <path
                d="M185 80 C195 70 215 72 210 88 C202 96 182 92 185 80 Z"
                fill="#991B1B"
              />
              {/* Boiled egg slice */}
              <ellipse cx="125" cy="80" rx="11" ry="14" fill="#FFFBEB" />
              <ellipse cx="126" cy="80" rx="6" ry="7" fill="#F59E0B" />
            </>
          ) : (
            <>
              {/* Tandoori Paneer cubes */}
              <rect x="180" y="74" width="16" height="15" rx="3" fill="#FEF3C7" stroke="#D97706" strokeWidth="2" />
              <rect x="120" y="76" width="15" height="14" rx="3" fill="#FEF3C7" stroke="#D97706" strokeWidth="2" />
            </>
          )}

          {/* Caramelized Birista (Fried Onions) & Fresh Mint Leaves */}
          <path d="M140 65 Q145 60 152 64" stroke="#5B1607" strokeWidth="2.5" strokeLinecap="round" />
          <path d="M165 62 Q172 58 178 64" stroke="#5B1607" strokeWidth="2.5" strokeLinecap="round" />
          <path d="M150 82 Q158 80 166 84" stroke="#5B1607" strokeWidth="2.5" strokeLinecap="round" />
          
          {/* Mint garnish */}
          <path d="M155 58 C150 50 160 48 165 52 C168 55 160 62 155 58 Z" fill="#15803D" />
          <path d="M164 56 C170 50 178 54 174 60 C170 62 165 58 164 56 Z" fill="#22C55E" />

          {/* Fragrant steam rising */}
          <path
            d="M140 45 C136 32 144 24 140 12"
            stroke="#FFFFFF"
            strokeWidth="2"
            strokeLinecap="round"
            opacity="0.35"
          />
          <path
            d="M162 42 C166 28 158 20 162 8"
            stroke="#FFFFFF"
            strokeWidth="2.5"
            strokeLinecap="round"
            opacity="0.45"
          />
          <path
            d="M182 46 C186 35 178 26 182 15"
            stroke="#FFFFFF"
            strokeWidth="2"
            strokeLinecap="round"
            opacity="0.35"
          />
        </svg>
      )}

      {isChaapOrCurry && (
        <svg
          viewBox="0 0 320 220"
          className="w-full h-full max-h-52 drop-shadow-xl"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          {/* Deep dark bowl */}
          <ellipse cx="160" cy="180" rx="90" ry="20" fill="#140608" opacity="0.6" />
          <path
            d="M70 120 C70 175 250 175 250 120 Z"
            fill="#1E293B"
          />
          <ellipse cx="160" cy="120" rx="90" ry="28" fill="#334155" />
          {/* Rich velvety chaap / curry gravy */}
          <ellipse cx="160" cy="122" rx="84" ry="24" fill="#B45309" />
          <ellipse cx="160" cy="122" rx="74" ry="20" fill="#92400E" />

          {/* Chicken Chaap braised piece / curry chunks */}
          <path
            d="M125 115 C130 90 195 95 200 120 C185 135 135 135 125 115 Z"
            fill="#78350F"
          />
          <path
            d="M140 108 C155 100 175 102 185 114"
            stroke="#D97706"
            strokeWidth="4"
            strokeLinecap="round"
          />
          {/* Cream swirl & Rogan oil droplets */}
          <path
            d="M130 125 C145 132 175 132 190 122"
            stroke="#FEF3C7"
            strokeWidth="3"
            strokeLinecap="round"
            opacity="0.7"
          />
          <circle cx="115" cy="122" r="3" fill="#DC2626" opacity="0.8" />
          <circle cx="205" cy="126" r="3" fill="#DC2626" opacity="0.8" />
          {/* Slit green chilli garnish */}
          <path
            d="M152 105 Q165 102 172 110"
            stroke="#16A34A"
            strokeWidth="3.5"
            strokeLinecap="round"
          />
          {/* Ginger juliennes & coriander */}
          <path d="M145 112 L158 116" stroke="#FEF08A" strokeWidth="2" strokeLinecap="round" />
          <path d="M165 110 L175 115" stroke="#FEF08A" strokeWidth="2" strokeLinecap="round" />
          <circle cx="160" cy="106" r="3" fill="#15803D" />
        </svg>
      )}

      {isStarter && (
        <svg
          viewBox="0 0 320 220"
          className="w-full h-full max-h-52 drop-shadow-xl"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          {/* Charcoal sizzler / platter */}
          <rect x="60" y="100" width="200" height="70" rx="35" fill="#18181B" />
          <rect x="66" y="104" width="188" height="62" rx="31" fill="#27272A" />

          {/* Kebabs / Tikkas with charcoal grill marks */}
          <g transform="translate(85, 115)">
            <rect x="0" y="0" width="36" height="32" rx="8" fill={isVeg ? '#FEF3C7' : '#DC2626'} />
            <path d="M4 8 L32 8 M4 16 L32 16 M4 24 L32 24" stroke="#450A0A" strokeWidth="2" />
          </g>
          <g transform="translate(130, 115)">
            <rect x="0" y="0" width="36" height="32" rx="8" fill={isVeg ? '#FEF3C7' : '#DC2626'} />
            <path d="M4 8 L32 8 M4 16 L32 16 M4 24 L32 24" stroke="#450A0A" strokeWidth="2" />
          </g>
          <g transform="translate(175, 115)">
            <rect x="0" y="0" width="36" height="32" rx="8" fill={isVeg ? '#FEF3C7' : '#DC2626'} />
            <path d="M4 8 L32 8 M4 16 L32 16 M4 24 L32 24" stroke="#450A0A" strokeWidth="2" />
          </g>

          {/* Onion rings and lemon wedge */}
          <circle cx="225" cy="130" r="12" stroke="#E2E8F0" strokeWidth="2.5" fill="none" opacity="0.7" />
          <path d="M78 135 L90 125 L92 140 Z" fill="#FACC15" />
          {/* Green mint chutney dip cup */}
          <circle cx="160" cy="85" r="16" fill="#15803D" stroke="#DFB24E" strokeWidth="2" />
          <circle cx="160" cy="85" r="12" fill="#22C55E" />
        </svg>
      )}

      {isBread && (
        <svg
          viewBox="0 0 320 220"
          className="w-full h-full max-h-52 drop-shadow-xl"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          {/* Woven bread basket / brass thali */}
          <ellipse cx="160" cy="140" rx="95" ry="40" fill="#B45309" />
          <ellipse cx="160" cy="138" rx="90" ry="36" fill="#78350F" />
          {/* Golden flaky folded Paratha / soft Roomali */}
          <path
            d="M95 135 Q160 85 225 130 Q160 165 95 135 Z"
            fill="#FEF08A"
          />
          <path
            d="M105 132 Q160 95 215 128"
            stroke="#CA8A04"
            strokeWidth="3.5"
            strokeLinecap="round"
          />
          <path
            d="M115 140 Q160 115 205 138"
            stroke="#A16207"
            strokeWidth="2.5"
            strokeLinecap="round"
          />
          {/* Pure desi ghee shine & brown blisters */}
          <ellipse cx="150" cy="120" rx="8" ry="4" fill="#EAB308" opacity="0.6" />
          <circle cx="135" cy="125" r="3" fill="#854D0E" />
          <circle cx="175" cy="122" r="3.5" fill="#854D0E" />
          <circle cx="158" cy="134" r="2.5" fill="#854D0E" />
        </svg>
      )}

      {isDessert && (
        <svg
          viewBox="0 0 320 220"
          className="w-full h-full max-h-52 drop-shadow-xl"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          {/* Authentic terracotta earthen sakora (clay bowl) */}
          <path
            d="M105 120 C105 170 215 170 215 120 Z"
            fill="#9A3412"
          />
          <ellipse cx="160" cy="120" rx="55" ry="16" fill="#C2410C" />
          {/* Creamy rich saffron firni / gulab jamun syrup */}
          <ellipse cx="160" cy="120" rx="50" ry="13" fill="#FEF3C7" />
          {/* Saffron threads & crushed pistachios */}
          <path d="M150 118 Q155 115 162 119" stroke="#EA580C" strokeWidth="2" strokeLinecap="round" />
          <path d="M158 122 Q165 118 170 123" stroke="#EA580C" strokeWidth="2" strokeLinecap="round" />
          {/* Pistachio & almond flakes */}
          <circle cx="145" cy="119" r="2" fill="#15803D" />
          <circle cx="165" cy="116" r="2.5" fill="#15803D" />
          <circle cx="154" cy="124" r="2" fill="#15803D" />
          <circle cx="172" cy="121" r="2" fill="#D97706" />
          {/* Edible silver vark (leaf) highlight */}
          <polygon points="156,114 162,112 164,117 158,118" fill="#F8FAFC" opacity="0.9" />
        </svg>
      )}

      {/* Subtle bottom gradient for card typography baseline */}
      <div className="absolute inset-x-0 bottom-0 h-10 bg-gradient-to-t from-[#200508] to-transparent pointer-events-none" />
    </div>
  );
};
