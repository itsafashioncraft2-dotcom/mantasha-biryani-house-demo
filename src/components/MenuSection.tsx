import React, { useState, useMemo } from 'react';
import { MenuItem, FoodCategory, CartItem, MenuState } from '../types';
import { MenuItemCard } from './MenuItemCard';
import {
  Search,
  Database,
  RefreshCw,
  Sparkles,
  Trash2,
  CheckCircle2,
  AlertTriangle,
  X,
} from 'lucide-react';
import { store } from '../services/store';
import { isSupabaseConfigured } from '../services/supabaseClient';

interface MenuSectionProps {
  menuState: MenuState;
  cartItems: CartItem[];
  onAddToCart: (item: MenuItem) => void;
  onUpdateQuantity: (itemId: string, newQuantity: number) => void;
  onRetry: () => void;
  onLoadDemo: () => void;
  isAdmin?: boolean;
  onNavigateToAdmin?: () => void;
}

export const MenuSection: React.FC<MenuSectionProps> = ({
  menuState,
  cartItems,
  onAddToCart,
  onUpdateQuantity,
  onRetry,
  onLoadDemo,
  isAdmin = false,
  onNavigateToAdmin,
}) => {
  const [selectedCategory, setSelectedCategory] = useState<FoodCategory>('all');
  const [dietaryFilter, setDietaryFilter] = useState<'all' | 'veg' | 'non-veg'>('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Admin dish deletion state
  const [itemToDelete, setItemToDelete] = useState<MenuItem | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [deleteSuccess, setDeleteSuccess] = useState<string | null>(null);

  const handleConfirmDelete = async () => {
    if (!itemToDelete) return;
    setIsDeleting(true);
    setDeleteError(null);
    try {
      const res = await store.deleteMenuItem(itemToDelete.id);
      if (!res.success) {
        setDeleteError(res.error || `Failed to delete "${itemToDelete.name}".`);
      } else {
        setDeleteSuccess(`"${itemToDelete.name}" was successfully removed from the menu.`);
        setItemToDelete(null);
        setTimeout(() => setDeleteSuccess(null), 3500);
      }
    } catch (e: any) {
      setDeleteError(e?.message || 'Error occurred while deleting dish.');
    } finally {
      setIsDeleting(false);
    }
  };

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

      {/* Delete Feedback Notifications */}
      {deleteSuccess && (
        <div className="mb-4 p-3.5 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl text-xs flex items-center justify-between shadow-2xs animate-fade-in">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span className="font-semibold">{deleteSuccess}</span>
          </div>
          <button
            type="button"
            onClick={() => setDeleteSuccess(null)}
            className="text-emerald-700 hover:text-emerald-900 p-0.5 cursor-pointer font-bold text-base leading-none"
          >
            ×
          </button>
        </div>
      )}
      {deleteError && (
        <div className="mb-4 p-3.5 bg-rose-50 border border-rose-200 text-rose-800 rounded-xl text-xs flex items-center justify-between shadow-2xs">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
            <span className="font-medium">{deleteError}</span>
          </div>
          <button
            type="button"
            onClick={() => setDeleteError(null)}
            className="text-rose-700 hover:text-rose-900 p-0.5 cursor-pointer"
          >
            <X className="w-3.5 h-3.5" />
          </button>
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
              isAdmin={isAdmin}
              onDeleteItem={(it) => setItemToDelete(it)}
              onEditItem={
                onNavigateToAdmin
                  ? () => onNavigateToAdmin()
                  : undefined
              }
            />
          ))}
        </div>
      )}

      {/* Delete Menu Item Confirmation Modal (Direct from Menu) */}
      {itemToDelete && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-stone-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="relative w-full max-w-sm bg-white rounded-2xl shadow-2xl border border-[#EAE2D6] overflow-hidden p-6 space-y-4 animate-scale-in">
            <div className="w-12 h-12 rounded-full bg-rose-100 text-rose-700 flex items-center justify-center mx-auto">
              <Trash2 className="w-6 h-6" />
            </div>
            <div className="text-center space-y-1">
              <h3 className="font-serif text-lg font-bold text-stone-900">
                Delete Dish from Menu?
              </h3>
              <p className="text-xs text-stone-600">
                Are you sure you want to permanently remove{' '}
                <strong className="text-stone-900 font-bold">"{itemToDelete.name}"</strong>{' '}
                (₹{itemToDelete.price}) from the live menu?
              </p>
              <p className="text-[11px] text-amber-700 bg-amber-50 rounded-lg p-2 mt-2">
                Note: Past customer orders for this dish will still retain their item names on receipts.
              </p>
            </div>
            <div className="pt-2 flex items-center justify-end gap-3 border-t border-[#EAE2D6]">
              <button
                type="button"
                onClick={() => setItemToDelete(null)}
                disabled={isDeleting}
                className="px-4 py-2 text-xs font-semibold text-stone-600 hover:text-stone-900 cursor-pointer disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmDelete}
                disabled={isDeleting}
                className="px-4 py-2 text-xs font-semibold text-white bg-rose-700 hover:bg-rose-800 rounded-lg cursor-pointer flex items-center gap-1.5 disabled:opacity-50 transition-colors shadow-xs"
              >
                {isDeleting ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>Deleting...</span>
                  </>
                ) : (
                  <>
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Yes, Delete Dish</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
};
