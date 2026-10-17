import React from 'react';
import { MenuItem } from '../types';
import { DishIllustration } from './DishIllustration';
import { VegBadge } from './VegBadge';
import { Plus, Minus, Trash2, Edit2, ShieldCheck } from 'lucide-react';

interface MenuItemCardProps {
  item: MenuItem;
  currentQuantity: number;
  onAddToCart: (item: MenuItem) => void;
  onUpdateQuantity: (itemId: string, newQuantity: number) => void;
  isAdmin?: boolean;
  onDeleteItem?: (item: MenuItem) => void;
  onEditItem?: (item: MenuItem) => void;
}

export const MenuItemCard: React.FC<MenuItemCardProps> = ({
  item,
  currentQuantity,
  onAddToCart,
  onUpdateQuantity,
  isAdmin = false,
  onDeleteItem,
  onEditItem,
}) => {
  return (
    <article
      className={`group relative flex flex-col justify-between rounded-xl bg-white border border-[#EAE2D6] overflow-hidden transition-all duration-200 hover:shadow-md hover:border-[#D5C2AF] ${
        !item.is_available ? 'opacity-70 bg-stone-50' : ''
      }`}
    >
      {/* Top Media & Visual Asset */}
      <div className="relative w-full aspect-[4/3] overflow-hidden bg-[#2D070B]">
        <DishIllustration
          category={item.category}
          name={item.name}
          isVeg={item.is_veg}
          className="w-full h-full transition-transform duration-300 group-hover:scale-105"
        />

        {/* Top Badges (Restrained) */}
        <div className="absolute top-3 left-3 flex items-center gap-2">
          <VegBadge isVeg={item.is_veg} />
          {item.is_bestseller && (
            <span className="text-[11px] font-semibold tracking-wide uppercase px-2 py-0.5 rounded bg-[#C29B38] text-white shadow-xs">
              Bestseller
            </span>
          )}
        </div>

        {!item.is_available && (
          <div className="absolute inset-0 bg-stone-900/60 backdrop-blur-[1px] flex items-center justify-center">
            <span className="text-white text-xs font-semibold tracking-wider uppercase px-3 py-1 bg-stone-800/90 rounded border border-stone-600">
              Sold Out Today
            </span>
          </div>
        )}
      </div>

      {/* Content Area */}
      <div className="p-4 flex-1 flex flex-col justify-between">
        <div>
          <div className="flex items-start justify-between gap-2">
            <h3 className="font-serif text-lg font-semibold text-[#231815] leading-snug">
              {item.name}
            </h3>
          </div>

          {/* Portion and spice metadata */}
          {item.portion_info && (
            <p className="mt-1 text-xs text-stone-500 line-clamp-1">
              {item.portion_info}
            </p>
          )}

          <p className="mt-2 text-xs text-stone-600 line-clamp-2 leading-relaxed">
            {item.description}
          </p>
        </div>

        {/* Price & Add Actions */}
        <div className="mt-4 pt-3 border-t border-[#F2ECE1] flex items-center justify-between">
          <div>
            <span className="text-xs text-stone-400 block">Price</span>
            <span className="font-mono tabular-nums text-lg font-bold text-[#801323]">
              ₹{item.price}
            </span>
          </div>

          <div>
            {!item.is_available ? (
              <button
                disabled
                className="px-3 py-1.5 text-xs font-medium text-stone-400 bg-stone-100 rounded-lg cursor-not-allowed"
              >
                Unavailable
              </button>
            ) : currentQuantity === 0 ? (
              <button
                type="button"
                onClick={() => onAddToCart(item)}
                className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold uppercase tracking-wider text-white bg-[#801323] hover:bg-[#680E19] active:scale-95 rounded-lg transition-all shadow-xs min-h-[40px]"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add</span>
              </button>
            ) : (
              <div className="flex items-center gap-2 bg-[#FAF7F2] border border-[#DFB24E] rounded-lg p-0.5 shadow-xs">
                <button
                  type="button"
                  onClick={() => onUpdateQuantity(item.id, currentQuantity - 1)}
                  aria-label="Decrease quantity"
                  className="w-8 h-8 flex items-center justify-center rounded-md bg-white text-[#801323] hover:bg-[#F4EFEA] active:scale-90 transition-transform"
                >
                  <Minus className="w-3.5 h-3.5" />
                </button>
                <span className="font-mono tabular-nums text-sm font-bold text-[#801323] w-5 text-center">
                  {currentQuantity}
                </span>
                <button
                  type="button"
                  onClick={() => onUpdateQuantity(item.id, currentQuantity + 1)}
                  aria-label="Increase quantity"
                  className="w-8 h-8 flex items-center justify-center rounded-md bg-[#801323] text-white hover:bg-[#680E19] active:scale-90 transition-transform"
                >
                  <Plus className="w-3.5 h-3.5" />
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Admin Quick Action Controls */}
      {isAdmin && (
        <div className="bg-[#FAF7F2] border-t border-[#EAE2D6] px-3.5 py-2 flex items-center justify-between text-xs">
          <span className="text-[11px] font-semibold text-stone-600 uppercase tracking-wider flex items-center gap-1">
            <ShieldCheck className="w-3.5 h-3.5 text-[#801323]" />
            <span>Admin</span>
          </span>
          <div className="flex items-center gap-1.5">
            {onEditItem && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onEditItem(item);
                }}
                className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold text-stone-700 bg-white hover:bg-stone-50 rounded border border-stone-300 cursor-pointer transition-colors shadow-2xs"
                title={`Edit ${item.name}`}
              >
                <Edit2 className="w-3 h-3" />
                <span>Edit</span>
              </button>
            )}
            {onDeleteItem && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onDeleteItem(item);
                }}
                className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold text-rose-700 bg-rose-50 hover:bg-rose-600 hover:text-white rounded border border-rose-200 cursor-pointer transition-colors shadow-2xs"
                title={`Delete ${item.name}`}
              >
                <Trash2 className="w-3 h-3" />
                <span>Delete Dish</span>
              </button>
            )}
          </div>
        </div>
      )}
    </article>
  );
};
