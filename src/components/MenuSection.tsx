import React, { useState, useMemo } from 'react';
import { MenuItem, FoodCategory, CartItem, MenuState } from '../types';
import { isSupabaseConfigured } from '../services/supabaseClient';
import { MenuItemCard } from './MenuItemCard';
import {
  Search,
  Database,
  Sparkles,
  ShoppingBag,
  ArrowRight,
} from 'lucide-react';

interface MenuSectionProps {
  menuState: MenuState;
  cartItems: CartItem[];
  onAddToCart: (item: MenuItem) => void;
  onUpdateQuantity: (itemId: string, newQuantity: number) => void;
  onRetry: () => void;
  onLoadDemo: () => void;
  onProceedToCheckout?: () => void;
}

export const MenuSection: React.FC<MenuSectionProps> = ({
  menuState,
  cartItems,
  onAddToCart,
  onUpdateQuantity,
  onRetry,
  onLoadDemo,
  onProceedToCheckout,
}) => {
  const [selectedCategory, setSelectedCategory] = useState<FoodCategory>('all');
  const [dietaryFilter, setDietaryFilter] = useState<'all' | 'veg' | 'non-veg'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [orderNotice, setOrderNotice] = useState<string | null>(null);

  // Cart quantity map for instant lookup
  const cartQuantities = useMemo(() => {
    const map = new Map<string, number>();
    cartItems.forEach((ci) => {
      map.set(ci.menuItem.id, ci.quantity);
    });
    return map;
  }, [cartItems]);

  const totalCartCount = useMemo(
    () => cartItems.reduce((acc, ci) => acc + ci.quantity, 0),
    [cartItems]
  );

  const cartSubtotal = useMemo(
    () => cartItems.reduce((acc, ci) => acc + ci.menuItem.price * ci.quantity, 0),
    [cartItems]
  );

  const handleOrderClick = () => {
    if (totalCartCount === 0) {
      setOrderNotice('Aapka bag abhi khali hai! Kripya upar menu se apni pasandida dish par "+ ADD" dabayein.');
      const menuSection = document.getElementById('menu-items-grid') || document.getElementById('menu-section');
      if (menuSection) {
        menuSection.scrollIntoView({ behavior: 'smooth' });
      }
      return;
    }
    setOrderNotice(null);
    if (onProceedToCheckout) {
      onProceedToCheckout();
    }
  };

  const categories: { id: FoodCategory; label: string }[] = [
    { id: 'all', label: 'All Items' },
    { id: 'biryani', label: 'Dum Biryanis' },
    { id: 'curries', label: 'Curries & Chaap' },
    { id: 'starters', label: 'Kebabs & Tikkas' },
    { id: 'breads', label: 'Mughlai Breads' },
    { id: 'desserts', label: 'Desserts & Sweets' },
  ];

  const filteredItems = useMemo(() => {
    return menuState.items.filter((item) => {
      // Category filter
      if (selectedCategory !== 'all' && item.category !== selectedCategory) {
        return false;
      }
      // Dietary filter
      if (dietaryFilter === 'veg' && !item.is_veg) return false;
      if (dietaryFilter === 'non-veg' && item.is_veg) return false;

      // Search query
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase().trim();
        const matchesName = item.name.toLowerCase().includes(query);
        const matchesDesc = item.description.toLowerCase().includes(query);
        return matchesName || matchesDesc;
      }

      return true;
    });
  }, [menuState.items, selectedCategory, dietaryFilter, searchQuery]);

  return (
    <section id="menu-section" className="py-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
      {/* Section Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-6">
        <div>
          <div className="text-xs font-semibold tracking-wider uppercase text-[#801323]">
            Culinary Craftsmanship
          </div>
          <h2 className="font-serif text-2xl sm:text-3xl font-extrabold text-[#231815]">
            Our Royal Dum Menu
          </h2>
          <p className="mt-1 text-sm text-stone-600">
            Freshly prepared with authentic slow dum cooking. Free delivery on orders above ₹499 in Bhagalpur.
          </p>
        </div>

        {/* Search Input */}
        <div className="relative w-full md:w-72">
          <Search className="w-4 h-4 text-stone-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search biryani, chaap, kebab..."
            className="w-full pl-10 pr-4 py-2 text-sm bg-white border border-[#EAE2D6] rounded-xl text-stone-800 placeholder-stone-400 focus:outline-none focus:border-[#801323] transition-colors"
          />
        </div>
      </div>



      {/* Interactive Category Segmented Controls & Dietary Filter */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
        {/* Category Tabs */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-2 sm:pb-0 scrollbar-none">
          {categories.map((cat) => (
            <button
              key={cat.id}
              type="button"
              onClick={() => setSelectedCategory(cat.id)}
              className={`px-3.5 py-1.5 text-xs font-semibold rounded-lg transition-all whitespace-nowrap shrink-0 cursor-pointer ${
                selectedCategory === cat.id
                  ? 'bg-[#801323] text-white shadow-xs'
                  : 'bg-white text-stone-700 hover:bg-[#F5EFE6] border border-[#EAE2D6]'
              }`}
            >
              {cat.label}
            </button>
          ))}
        </div>

        {/* Dietary Segmented Controls */}
        <div className="flex items-center gap-1 bg-white p-1 rounded-lg border border-[#EAE2D6] shrink-0 self-start sm:self-auto">
          <button
            type="button"
            onClick={() => setDietaryFilter('all')}
            className={`px-3 py-1 text-xs font-medium rounded-md transition-colors cursor-pointer ${
              dietaryFilter === 'all'
                ? 'bg-[#FAF7F2] text-[#801323] font-bold shadow-xs'
                : 'text-stone-600 hover:text-stone-900'
            }`}
          >
            All
          </button>
          <button
            type="button"
            onClick={() => setDietaryFilter('veg')}
            className={`px-3 py-1 text-xs font-medium rounded-md transition-colors flex items-center gap-1.5 cursor-pointer ${
              dietaryFilter === 'veg'
                ? 'bg-emerald-50 text-emerald-800 font-bold shadow-xs'
                : 'text-stone-600 hover:text-stone-900'
            }`}
          >
            <span className="w-2 h-2 rounded-full bg-emerald-600" />
            <span>Veg</span>
          </button>
          <button
            type="button"
            onClick={() => setDietaryFilter('non-veg')}
            className={`px-3 py-1 text-xs font-medium rounded-md transition-colors flex items-center gap-1.5 cursor-pointer ${
              dietaryFilter === 'non-veg'
                ? 'bg-rose-50 text-rose-800 font-bold shadow-xs'
                : 'text-stone-600 hover:text-stone-900'
            }`}
          >
            <span className="w-2 h-2 rounded-full bg-rose-700" />
            <span>Non-Veg</span>
          </button>
        </div>
      </div>

      {/* LOADING STATE */}
      {menuState.isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {[1, 2, 3, 4, 5, 6, 7, 8].map((n) => (
            <div
              key={n}
              className="rounded-xl bg-white border border-[#EAE2D6] overflow-hidden p-4 space-y-3 animate-pulse"
            >
              <div className="w-full aspect-[4/3] bg-stone-200 rounded-lg" />
              <div className="h-4 bg-stone-200 rounded w-3/4" />
              <div className="h-3 bg-stone-100 rounded w-1/2" />
              <div className="h-3 bg-stone-100 rounded w-full" />
              <div className="pt-3 flex justify-between items-center">
                <div className="h-5 bg-stone-200 rounded w-16" />
                <div className="h-8 bg-stone-200 rounded w-20" />
              </div>
            </div>
          ))}
        </div>
      ) : menuState.items.length === 0 && !menuState.error ? (
        /* EMPTY MENU STATE (Database returned 0 rows) */
        <div className="py-16 text-center bg-white rounded-2xl border border-[#EAE2D6] p-8 space-y-3">
          <Database className="w-10 h-10 text-stone-300 mx-auto" />
          <h3 className="font-serif text-lg font-semibold text-stone-800">
            No dishes found in public.menu_items
          </h3>
          <p className="text-xs text-stone-500 max-w-md mx-auto leading-relaxed">
            {isSupabaseConfigured
              ? 'The database table exists but currently contains zero items. Please add items in the database or admin dashboard.'
              : 'The menu is currently empty. You can view demo dishes or connect to a database.'}
          </p>
          <div className="pt-2 flex items-center justify-center gap-3">
            {!isSupabaseConfigured && (
              <button
                type="button"
                onClick={onLoadDemo}
                className="px-4 py-2 text-xs font-semibold text-white bg-[#801323] hover:bg-[#680E19] rounded-lg transition-colors cursor-pointer flex items-center gap-1.5"
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>Load Demo Dishes</span>
              </button>
            )}
            <button
              type="button"
              onClick={onRetry}
              className="px-4 py-2 text-xs font-semibold text-stone-700 bg-stone-100 hover:bg-stone-200 rounded-lg transition-colors cursor-pointer"
            >
              Retry Fetch
            </button>
          </div>
        </div>
      ) : filteredItems.length === 0 ? (
        /* NO FILTER MATCHES */
        <div className="py-16 text-center bg-white rounded-2xl border border-[#EAE2D6] p-8">
          <p className="font-serif text-lg font-semibold text-stone-800">
            No items found matching your filters
          </p>
          <p className="text-xs text-stone-500 mt-1">
            Try switching category or clearing the search query.
          </p>
          <button
            type="button"
            onClick={() => {
              setSelectedCategory('all');
              setDietaryFilter('all');
              setSearchQuery('');
            }}
            className="mt-4 px-4 py-2 text-xs font-semibold text-[#801323] bg-[#F5EFE6] hover:bg-[#EAE2D6] rounded-lg transition-colors cursor-pointer"
          >
            Reset Filters
          </button>
        </div>
      ) : (
        <div id="menu-items-grid" className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {filteredItems.map((item) => (
            <MenuItemCard
              key={item.id}
              item={item}
              currentQuantity={cartQuantities.get(item.id) || 0}
              onAddToCart={onAddToCart}
              onUpdateQuantity={onUpdateQuantity}
            />
          ))}
        </div>
      )}

      {/* Bottom Order & Checkout Action Section */}
      <div className="mt-12 bg-linear-to-r from-[#2B0B0E] via-[#4A0E17] to-[#801323] text-white rounded-2xl p-6 sm:p-8 shadow-xl border border-[#DFB24E]/30 relative overflow-hidden">
        {/* Subtle Decorative Glow */}
        <div className="absolute top-0 right-0 w-72 h-72 bg-[#DFB24E]/10 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="text-center md:text-left space-y-2">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/10 text-[#DFB24E] text-xs font-semibold uppercase tracking-wider backdrop-blur-xs">
              <ShoppingBag className="w-3.5 h-3.5" />
              <span>Fast Doorstep Delivery · Bhagalpur Hub</span>
            </div>
            <h3 className="font-serif text-2xl sm:text-3xl font-bold text-white tracking-tight">
              Order Fresh Dum Biryani
            </h3>
            <p className="text-xs sm:text-sm text-stone-300 max-w-lg leading-relaxed">
              {totalCartCount > 0 ? (
                <>
                  <strong className="text-white font-bold">{totalCartCount} item(s)</strong> selected in your bag (Total: <span className="text-[#DFB24E] font-bold font-mono">₹{cartSubtotal}</span>). Click below to open checkout & enter your delivery details!
                </>
              ) : (
                'Pick your favourite Biryani, Kebab, or Chaap from the menu above and click Order to complete your delivery checkout.'
              )}
            </p>
          </div>

          <div className="flex flex-col sm:flex-row items-center gap-4 w-full md:w-auto shrink-0">
            {totalCartCount > 0 && (
              <div className="hidden sm:flex flex-col items-end pr-1 text-right">
                <span className="text-[11px] text-stone-300 uppercase tracking-wider font-medium">Bag Total</span>
                <span className="font-mono text-2xl font-bold text-[#DFB24E]">₹{cartSubtotal}</span>
              </div>
            )}

            <button
              type="button"
              onClick={handleOrderClick}
              className="w-full sm:w-auto px-8 py-4 bg-[#DFB24E] hover:bg-[#E5C158] active:scale-95 text-[#231815] font-bold text-sm uppercase tracking-wider rounded-xl shadow-lg hover:shadow-[#DFB24E]/25 transition-all flex items-center justify-center gap-3 cursor-pointer group"
            >
              <ShoppingBag className="w-5 h-5 text-[#801323] group-hover:scale-110 transition-transform" />
              <span>
                {totalCartCount > 0 ? `Order Now · Checkout (₹${cartSubtotal})` : 'Order Now / Checkout'}
              </span>
              <ArrowRight className="w-5 h-5 transition-transform group-hover:translate-x-1" />
            </button>
          </div>
        </div>

        {/* Notice for empty bag */}
        {orderNotice && (
          <div className="mt-4 p-3.5 bg-amber-500/20 backdrop-blur-md rounded-xl border border-amber-400/30 text-xs text-amber-100 flex items-center justify-between animate-fade-in">
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-[#DFB24E] shrink-0" />
              <span>{orderNotice}</span>
            </div>
            <button
              type="button"
              onClick={() => setOrderNotice(null)}
              className="text-stone-300 hover:text-white p-1 text-sm font-bold"
            >
              ✕
            </button>
          </div>
        )}
      </div>
    </section>
  );
};
