import React from 'react';
import { ShoppingBag, ShieldCheck, Bike, Database } from 'lucide-react';
import { isSupabaseConfigured } from '../services/supabaseClient';

interface HeaderProps {

  cartCount: number;
  onOpenCart: () => void;
  activeView: 'home' | 'menu' | 'track' | 'admin' | 'delivery' | 'supabase_status';
  onNavigate: (view: 'home' | 'menu' | 'track' | 'admin' | 'delivery' | 'supabase_status') => void;
}

export const Header: React.FC<HeaderProps> = ({
  cartCount,
  onOpenCart,
  activeView,
  onNavigate,
}) => {
  return (
    <>
      {/* Top Bar Contract: 3 zones separated by gap-8 */}
      <header className="sticky top-0 z-40 bg-[#FAF7F2]/95 backdrop-blur-md border-b border-[#EAE2D6] transition-all">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-18 flex items-center justify-between gap-8">
          {/* Zone 1: Brand Wordmark (Single text element in display face) */}
          <button
            type="button"
            onClick={() => onNavigate('home')}
            className="font-serif text-2xl sm:text-3xl font-extrabold tracking-tight text-[#801323] hover:text-[#680E19] transition-colors whitespace-nowrap shrink-0 text-left cursor-pointer"
          >
            Mantasha Biryani House
          </button>

          {/* Zone 2: 4-5 single-line clean text links with subtle hover underlines */}
          <nav className="hidden md:flex items-center gap-7 text-sm font-medium text-stone-700">
            <button
              type="button"
              onClick={() => onNavigate('home')}
              className={`hover:text-[#801323] transition-colors whitespace-nowrap shrink-0 py-1 ${
                activeView === 'home'
                  ? 'text-[#801323] font-semibold border-b-2 border-[#801323]'
                  : ''
              }`}
            >
              Home
            </button>
            <button
              type="button"
              onClick={() => onNavigate('menu')}
              className={`hover:text-[#801323] transition-colors whitespace-nowrap shrink-0 py-1 ${
                activeView === 'menu'
                  ? 'text-[#801323] font-semibold border-b-2 border-[#801323]'
                  : ''
              }`}
            >
              Menu
            </button>
            <button
              type="button"
              onClick={() => onNavigate('track')}
              className={`hover:text-[#801323] transition-colors whitespace-nowrap shrink-0 py-1 ${
                activeView === 'track'
                  ? 'text-[#801323] font-semibold border-b-2 border-[#801323]'
                  : ''
              }`}
            >
              Track Order
            </button>
            <button
              type="button"
              onClick={() => onNavigate('admin')}
              className={`hover:text-[#801323] transition-colors whitespace-nowrap shrink-0 py-1 flex items-center gap-1.5 ${
                activeView === 'admin'
                  ? 'text-[#801323] font-semibold border-b-2 border-[#801323]'
                  : ''
              }`}
            >
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>Admin</span>
            </button>
            <button
              type="button"
              onClick={() => onNavigate('delivery')}
              className={`hover:text-[#801323] transition-colors whitespace-nowrap shrink-0 py-1 flex items-center gap-1.5 ${
                activeView === 'delivery'
                  ? 'text-[#801323] font-semibold border-b-2 border-[#801323]'
                  : ''
              }`}
            >
              <Bike className="w-3.5 h-3.5" />
              <span>Rider</span>
            </button>
          </nav>

          {/* Zone 3: 1 Primary Action */}
          <div className="flex items-center gap-3 shrink-0">
            <button
              type="button"
              onClick={onOpenCart}
              aria-label={`View cart with ${cartCount} items`}
              className="relative flex items-center gap-2 px-4 py-2 text-sm font-semibold text-white bg-[#801323] hover:bg-[#680E19] active:scale-95 rounded-lg transition-all shadow-xs whitespace-nowrap shrink-0"
            >
              <ShoppingBag className="w-4 h-4" />
              <span className="hidden sm:inline">Bag</span>
              <span className="font-mono tabular-nums bg-[#C29B38] text-white text-xs px-2 py-0.5 rounded-full font-bold">
                {cartCount}
              </span>
            </button>
          </div>
        </div>

        {/* Mobile secondary navigation strip */}
        <div className="md:hidden flex items-center justify-around border-t border-[#EAE2D6] bg-white py-2 px-3 text-xs font-medium text-stone-700">
          <button
            type="button"
            onClick={() => onNavigate('home')}
            className={`px-2 py-1 ${activeView === 'home' ? 'text-[#801323] font-bold' : ''}`}
          >
            Home
          </button>
          <button
            type="button"
            onClick={() => onNavigate('menu')}
            className={`px-2 py-1 ${activeView === 'menu' ? 'text-[#801323] font-bold' : ''}`}
          >
            Menu
          </button>
          <button
            type="button"
            onClick={() => onNavigate('track')}
            className={`px-2 py-1 ${activeView === 'track' ? 'text-[#801323] font-bold' : ''}`}
          >
            Track
          </button>
          <button
            type="button"
            onClick={() => onNavigate('admin')}
            className={`px-2 py-1 flex items-center gap-1 ${activeView === 'admin' ? 'text-[#801323] font-bold' : ''}`}
          >
            <ShieldCheck className="w-3 h-3" />
            <span>Admin</span>
          </button>
          <button
            type="button"
            onClick={() => onNavigate('delivery')}
            className={`px-2 py-1 flex items-center gap-1 ${activeView === 'delivery' ? 'text-[#801323] font-bold' : ''}`}
          >
            <Bike className="w-3 h-3" />
            <span>Rider</span>
          </button>
        </div>
      </header>

      {/* Backend & Preview Mode Notification Bar (Honest & Transparent) */}
      <div className="bg-[#FAF7F2] border-b border-[#EAE2D6] py-1.5 px-4 text-xs text-stone-600">
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-4">
          <div className="flex items-center gap-2 truncate">
            <span
              className={`w-2 h-2 rounded-full shrink-0 ${
                isSupabaseConfigured ? 'bg-emerald-600' : 'bg-amber-500'
              }`}
            />
            <span className="truncate">
              <strong>Bhagalpur Outlet</strong> ·{' '}
              {isSupabaseConfigured
                ? 'Supabase Backend Connected · public.menu_items sync active'
                : 'Demo Mode · Local Sample Menu'}
            </span>
          </div>
          <button
            type="button"
            onClick={() => onNavigate('supabase_status')}
            className="flex items-center gap-1 text-[#801323] hover:underline font-medium shrink-0 whitespace-nowrap cursor-pointer"
          >
            <Database className="w-3.5 h-3.5" />
            <span>Supabase Config Status</span>
          </button>
        </div>
      </div>
    </>
  );
};
