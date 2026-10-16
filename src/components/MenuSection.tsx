import React, { useState, useMemo } from 'react';
import { MenuItem, FoodCategory, CartItem, MenuState } from '../types';
import { MenuItemCard } from './MenuItemCard';
import { Search, Database, AlertCircle, RefreshCw, Sparkles } from 'lucide-react';

import { isSupabaseConfigured } from '../services/supabaseClient';

interface MenuSectionProps {
  menuState: MenuState;
  cartItems: CartItem[];
  onAddToCart: (item: MenuItem) => void;
  onUpdateQuantity: (itemId: string, newQuantity: number) => void;
  onRetry: () => void;
  onLoadDemo: () => void;
}

export const MenuSection: React.FC<MenuSectionProps> = ({
  menuState,
  cartItems,
  onAddToCart,
  onUpdateQuantity,
  onRetry,
  onLoadDemo,
}) => {
  const [selectedCategory, setSelectedCategory] = useState<FoodCategory>('all');
  const [dietaryFilter, setDietaryFilter] = useState<'all' | 'veg' | 'non-veg'>('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Cart quantity map for instant lookup
  const cartQuantities = useMemo(() => {
    const map = new Map<string, number>();
    cartItems.forEach((ci) => {
      map.set(ci.menuItem.id, ci.quantity);
    });
    return map;
  }, [cartItems]);

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

      {/* Database Connection & Source Status Banner */}
      <div className="mb-6 p-3.5 rounded-xl border flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs bg-white shadow-2xs">
        <div className="flex items-center gap-2.5">
          {menuState.source === 'supabase' ? (
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-600 shrink-0 animate-pulse" />
              <div>
                <span className="font-bold text-emerald-950">
                  Live Supabase Database
                </span>
                <span className="text-stone-500 ml-1.5">
                  · Connected to <code className="bg-stone-100 px-1 py-0.5 rounded text-stone-700">public.menu_items</code> ({menuState.items.length} {menuState.items.length === 1 ? 'item' : 'items'})
                </span>
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-amber-500 shrink-0" />
              <div>
                <span className="font-bold text-amber-950">
                  {isSupabaseConfigured ? 'Previewing Local Sample Dishes' : 'Demo Mode (Local Sample Menu)'}
                </span>
                <span className="text-stone-500 ml-1.5">
                  · {isSupabaseConfigured ? 'Supabase table public.menu_items is currently empty. Showing local sample dishes for preview.' : 'Supabase connection pending. Showing local sample dishes for preview.'}
                </span>
              </div>
            </div>
          )}
        </div>

        <div className="flex items-center gap-2 shrink-0 self-start sm:self-auto">
          {menuState.source === 'supabase' ? (
            <button
              type="button"
              onClick={onRetry}
              disabled={menuState.isLoading}
              className="flex items-center gap-1.5 px-3 py-1.5 font-semibold text-stone-700 hover:text-stone-900 bg-[#FAF7F2] hover:bg-[#F5EFE6] border border-[#EAE2D6] rounded-lg transition-colors cursor-pointer disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${menuState.isLoading ? 'animate-spin' : ''}`} />
              <span>Refresh Menu</span>
            </button>
          ) : (
            <button
              type="button"
              onClick={onRetry}
              className="flex items-center gap-1.5 px-3 py-1.5 font-semibold text-[#801323] hover:text-[#680E19] bg-[#FAF7F2] hover:bg-[#F5EFE6] border border-[#EAE2D6] rounded-lg transition-colors cursor-pointer"
            >
              <Database className="w-3.5 h-3.5" />
              <span>{isSupabaseConfigured ? 'Query Database' : 'Connect to Database'}</span>
            </button>
          )}
        </div>
      </div>

      {/* Database Error State Banner */}
      {menuState.error && (
        <div className="mb-6 p-4 bg-rose-50 border border-rose-200 rounded-xl space-y-2 text-xs text-rose-900">
          <div className="flex items-center gap-2 font-bold text-sm text-rose-800">
            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
            <span>Database Error: Failed to fetch from public.menu_items</span>
          </div>
          <p className="text-stone-700 pl-6 leading-relaxed">
            {menuState.error}
          </p>
          <div className="pl-6 pt-1 flex items-center gap-3">
            <button
              type="button"
              onClick={onRetry}
              className="px-3.5 py-1.5 bg-rose-700 hover:bg-rose-800 text-white rounded-lg font-semibold transition-colors cursor-pointer"
            >
              Retry Database Connection
            </button>
            {!isSupabaseConfigured && (
              <button
                type="button"
                onClick={onLoadDemo}
                className="px-3.5 py-1.5 bg-white border border-rose-300 text-rose-900 hover:bg-rose-100 rounded-lg font-semibold transition-colors cursor-pointer"
              >
                Switch to Demo Menu
              </button>
            )}
          </div>
        </div>
      )}

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
        /* MENU GRID */
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
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
    </section>
  );
};
