import React from 'react';
import { ShieldCheck, MapPin, Clock, Award } from 'lucide-react';

interface FooterProps {
  onNavigate: (view: 'home' | 'menu' | 'track' | 'admin' | 'delivery' | 'supabase_status') => void;
}

export const Footer: React.FC<FooterProps> = ({ onNavigate }) => {
  return (
    <footer className="bg-[#2D070B] text-stone-300 border-t border-[#4A0A12] mt-16">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
          {/* Brand & Mission */}
          <div className="space-y-3">
            <h3 className="font-serif text-2xl font-bold tracking-tight text-[#DFB24E]">
              Mantasha Biryani House
            </h3>
            <p className="text-xs text-stone-300 leading-relaxed">
              Authentic Dum Handi Biryani, Mughlai Chaap, and charcoal kebabs in Bhagalpur, Bihar. Prepared with age-old dum pukht techniques and pure desi ghee.
            </p>
            <div className="flex items-center gap-1.5 text-xs text-[#DFB24E]">
              <MapPin className="w-3.5 h-3.5" />
              <span>Bhagalpur, Bihar, India</span>
            </div>
          </div>

          {/* Quick Links */}
          <div className="space-y-3">
            <h4 className="text-xs font-bold uppercase tracking-wider text-[#DFB24E]">
              Explore
            </h4>
            <ul className="space-y-2 text-xs">
              <li>
                <button
                  type="button"
                  onClick={() => onNavigate('home')}
                  className="hover:text-white transition-colors cursor-pointer"
                >
                  Home & Specials
                </button>
              </li>
              <li>
                <button
                  type="button"
                  onClick={() => onNavigate('menu')}
                  className="hover:text-white transition-colors cursor-pointer"
                >
                  Full Dum Menu
                </button>
              </li>
              <li>
                <button
                  type="button"
                  onClick={() => onNavigate('track')}
                  className="hover:text-white transition-colors cursor-pointer"
                >
                  Track Live Order
                </button>
              </li>
              <li>
                <button
                  type="button"
                  onClick={() => onNavigate('supabase_status')}
                  className="hover:text-white transition-colors cursor-pointer"
                >
                  Backend & Supabase Architecture
                </button>
              </li>
            </ul>
          </div>

          {/* Staff & Fleet Portals */}
          <div className="space-y-3">
            <h4 className="text-xs font-bold uppercase tracking-wider text-[#DFB24E]">
              Portals & Fleet
            </h4>
            <ul className="space-y-2 text-xs">
              <li>
                <button
                  type="button"
                  onClick={() => onNavigate('admin')}
                  className="hover:text-white transition-colors cursor-pointer"
                >
                  Kitchen Admin Panel
                </button>
              </li>
              <li>
                <button
                  type="button"
                  onClick={() => onNavigate('delivery')}
                  className="hover:text-white transition-colors cursor-pointer"
                >
                  Delivery Fleet Terminal
                </button>
              </li>
              <li className="pt-2 text-[11px] text-stone-400">
                Payment: Cash on Delivery (COD) & UPI on delivery
              </li>
            </ul>
          </div>

          {/* Quality & Trust Commitment */}
          <div className="space-y-3">
            <h4 className="text-xs font-bold uppercase tracking-wider text-[#DFB24E]">
              Our Food Promise
            </h4>
            <div className="space-y-2 text-xs text-stone-300">
              <div className="flex items-start gap-2">
                <ShieldCheck className="w-4 h-4 text-[#DFB24E] shrink-0 mt-0.5" />
                <span>100% Sealed earthen handis to preserve authentic aroma</span>
              </div>
              <div className="flex items-start gap-2">
                <Clock className="w-4 h-4 text-[#DFB24E] shrink-0 mt-0.5" />
                <span>Freshly layered upon order confirmation</span>
              </div>
              <div className="flex items-start gap-2">
                <Award className="w-4 h-4 text-[#DFB24E] shrink-0 mt-0.5" />
                <span>Zero artificial colorings or essence</span>
              </div>
            </div>
          </div>
        </div>

        {/* Bottom Disclaimer & Copyright */}
        <div className="mt-12 pt-6 border-t border-[#4A0A12] flex flex-col sm:flex-row items-center justify-between gap-4 text-[11px] text-stone-400">
          <div>
            © {new Date().getFullYear()} Mantasha Biryani House. Bhagalpur, Bihar. Sample preview demonstration.
          </div>
          <div className="text-center sm:text-right">
            Official opening hours and outlet address will be confirmed upon formal restaurant launch.
          </div>
        </div>
      </div>
    </footer>
  );
};
