import React from 'react';
import { DishIllustration } from './DishIllustration';
import { ArrowRight, Flame, Clock, ShieldAlert } from 'lucide-react';
import { BrandLogo } from './BrandLogo';

interface HeroSectionProps {
  onOrderNow: () => void;
  onExploreMenu: () => void;
}

export const HeroSection: React.FC<HeroSectionProps> = ({
  onOrderNow,
  onExploreMenu,
}) => {
  return (
    <section className="relative overflow-hidden bg-gradient-to-b from-[#FAF7F2] to-[#F5EFE6] border-b border-[#EAE2D6]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 md:py-18">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-12 items-center">
          {/* Left Text Column */}
          <div className="lg:col-span-7 space-y-6">
            {/* Authentic Tagline with Brand Crest */}
            <div className="flex items-center gap-3">
              <BrandLogo size="sm" variant="icon" />
              <div className="flex items-center gap-2 text-xs font-bold tracking-wider uppercase text-[#801323]">
                <span>Bhagalpur, Bihar</span>
                <span aria-hidden="true">·</span>
                <span>Authentic Dum Handi Heritage</span>
              </div>
            </div>

            {/* Headline with text-wrap: balance */}
            <h1 className="font-serif text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-extrabold text-[#231815] tracking-tight leading-[1.15] text-balance">
              Slow-cooked Dum Biryani, sealed in clay & delivered fresh.
            </h1>

            {/* Description */}
            <p className="text-base sm:text-lg text-stone-700 leading-relaxed max-w-2xl">
              Experience the royal marriage of fragrant long-grain Basmati, tender marinated meats, slow-roasted spices, and melt-in-mouth spiced potatoes. Hand-crafted in earthen handis and delivered hot across Bhagalpur.
            </p>

            {/* Primary Action Buttons */}
            <div className="pt-2 flex flex-wrap items-center gap-4">
              <button
                type="button"
                onClick={onOrderNow}
                className="px-6 py-3.5 text-sm sm:text-base font-semibold text-white bg-[#801323] hover:bg-[#680E19] active:scale-95 rounded-xl transition-all shadow-md flex items-center gap-2 cursor-pointer"
              >
                <span>Order Now</span>
                <ArrowRight className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={onExploreMenu}
                className="px-6 py-3.5 text-sm sm:text-base font-semibold text-stone-800 bg-white hover:bg-stone-50 border border-[#D5C2AF] rounded-xl transition-all shadow-xs cursor-pointer"
              >
                Explore Full Menu
              </button>
            </div>

            {/* Proof Points & Adjacency */}
            <div className="pt-6 grid grid-cols-3 gap-4 border-t border-[#EAE2D6] text-stone-700">
              <div>
                <div className="flex items-center gap-1.5 text-[#801323] font-semibold text-xs sm:text-sm">
                  <Flame className="w-4 h-4" />
                  <span>Dum Pukht</span>
                </div>
                <p className="mt-1 text-xs text-stone-500">
                  Slow coals dum in authentic sealed clay handis
                </p>
              </div>

              <div>
                <div className="flex items-center gap-1.5 text-[#801323] font-semibold text-xs sm:text-sm">
                  <Clock className="w-4 h-4" />
                  <span>35–45 Mins</span>
                </div>
                <p className="mt-1 text-xs text-stone-500">
                  Piping hot delivery in Bhagalpur
                </p>
              </div>

              <div>
                <div className="flex items-center gap-1.5 text-[#801323] font-semibold text-xs sm:text-sm">
                  <ShieldAlert className="w-4 h-4 text-[#C29B38]" />
                  <span>Cash on Delivery</span>
                </div>
                <p className="mt-1 text-xs text-stone-500">
                  Pay cash or UPI upon doorstep arrival
                </p>
              </div>
            </div>
          </div>

          {/* Right Visual Focal Anchor (Rich handcrafted Clay Handi Illustration) */}
          <div className="lg:col-span-5 flex justify-center">
            <div className="relative w-full max-w-md rounded-2xl overflow-hidden shadow-2xl border-2 border-[#C29B38]/30 bg-[#2D070B] aspect-square flex flex-col justify-between p-6">
              <div className="flex items-center justify-between text-white/80 text-xs">
                <span className="font-serif tracking-widest uppercase text-[#DFB24E] font-bold">
                  Mantasha Special Handi
                </span>
                <span className="font-mono text-[#F5EFE6]/70">Pure Desi Ghee</span>
              </div>

              <div className="my-auto py-4">
                <DishIllustration
                  category="biryani"
                  name="Mantasha Special Chicken Dum Biryani"
                  isVeg={false}
                  className="w-full h-56"
                />
              </div>

              <div className="pt-3 border-t border-white/10 flex items-center justify-between text-white">
                <div>
                  <span className="text-xs text-stone-300 block">Chef's Signature Dum Handi</span>
                  <span className="font-serif text-lg font-bold text-[#F5EFE6]">
                    Aged Basmati & Tender Cuts
                  </span>
                </div>
                <button
                  type="button"
                  onClick={onOrderNow}
                  className="px-4 py-2 text-xs font-bold uppercase tracking-wider bg-[#C29B38] text-stone-900 rounded-lg hover:bg-[#DFB24E] transition-colors cursor-pointer"
                >
                  Order
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};
