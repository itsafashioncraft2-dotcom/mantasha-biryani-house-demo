import React from 'react';
import { CartItem } from '../types';
import { X, Plus, Minus, Trash2, ShoppingBag, ArrowRight, Sparkles } from 'lucide-react';
import { VegBadge } from './VegBadge';
import { FREE_DELIVERY_THRESHOLD, STANDARD_DELIVERY_FEE, MINIMUM_SUBTOTAL } from '../services/orderValidator';

interface CartDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  cartItems: CartItem[];
  onUpdateQuantity: (itemId: string, newQuantity: number) => void;
  onRemoveItem: (itemId: string) => void;
  onProceedToCheckout: () => void;
}

export const CartDrawer: React.FC<CartDrawerProps> = ({
  isOpen,
  onClose,
  cartItems,
  onUpdateQuantity,
  onRemoveItem,
  onProceedToCheckout,
}) => {
  if (!isOpen) return null;

  const subtotal = cartItems.reduce(
    (acc, item) => acc + item.menuItem.price * item.quantity,
    0
  );
  const isBelowMinimum = subtotal > 0 && subtotal < MINIMUM_SUBTOTAL;
  const isFreeDelivery = subtotal >= FREE_DELIVERY_THRESHOLD;
  const deliveryFee = subtotal === 0 ? 0 : isFreeDelivery ? 0 : STANDARD_DELIVERY_FEE;
  const amountToFreeDelivery = Math.max(0, FREE_DELIVERY_THRESHOLD - subtotal);
  const amountToMinimum = Math.max(0, MINIMUM_SUBTOTAL - subtotal);
  const totalAmount = subtotal + deliveryFee;

  return (
    <div className="fixed inset-0 z-50 overflow-hidden">
      {/* Backdrop */}
      <div
        onClick={onClose}
        className="absolute inset-0 bg-stone-900/50 backdrop-blur-xs transition-opacity"
      />

      <div className="fixed inset-y-0 right-0 max-w-full flex pl-10">
        <div className="w-screen max-w-md bg-white shadow-2xl flex flex-col justify-between">
          {/* Header */}
          <div className="p-4 sm:p-5 border-b border-[#EAE2D6] bg-[#FAF7F2] flex items-center justify-between">
            <div className="flex items-center gap-2">
              <ShoppingBag className="w-5 h-5 text-[#801323]" />
              <h2 className="font-serif text-lg font-bold text-[#231815]">
                Your Handi Order
              </h2>
              <span className="font-mono text-xs font-semibold px-2 py-0.5 rounded-full bg-[#EAE2D6] text-stone-700">
                {cartItems.reduce((acc, i) => acc + i.quantity, 0)} items
              </span>
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close cart"
              className="p-2 text-stone-400 hover:text-stone-700 rounded-lg hover:bg-[#EAE2D6]/50 transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Delivery Incentive & Minimum Order Banner */}
          {subtotal > 0 && (
            <div className="p-3 bg-[#FDF9F0] border-b border-[#EAE2D6] text-xs">
              {isBelowMinimum ? (
                <div className="text-amber-900">
                  <div className="flex items-center justify-between font-medium mb-1">
                    <span>Minimum order value is <strong>₹{MINIMUM_SUBTOTAL}</strong> (add ₹{amountToMinimum} more)</span>
                    <span className="text-[#801323] font-mono">₹{subtotal}/₹{MINIMUM_SUBTOTAL}</span>
                  </div>
                  <div className="w-full bg-stone-200 h-1.5 rounded-full overflow-hidden">
                    <div
                      className="bg-amber-600 h-full transition-all duration-300"
                      style={{ width: `${Math.min(100, (subtotal / MINIMUM_SUBTOTAL) * 100)}%` }}
                    />
                  </div>
                </div>
              ) : isFreeDelivery ? (
                <div className="flex items-center gap-1.5 text-emerald-800 font-medium">
                  <Sparkles className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>Congratulations! Your order qualifies for <strong>FREE Doorstep Delivery</strong> in Bhagalpur.</span>
                </div>
              ) : (
                <div>
                  <div className="flex items-center justify-between font-medium text-stone-700 mb-1">
                    <span>Add <strong>₹{amountToFreeDelivery}</strong> more for Free Delivery</span>
                    <span className="text-[#801323] font-mono">₹{subtotal}/₹{FREE_DELIVERY_THRESHOLD}</span>
                  </div>
                  <div className="w-full bg-stone-200 h-1.5 rounded-full overflow-hidden">
                    <div
                      className="bg-[#C29B38] h-full transition-all duration-300"
                      style={{ width: `${Math.min(100, (subtotal / FREE_DELIVERY_THRESHOLD) * 100)}%` }}
                    />
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Cart Items List */}
          <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4 divide-y divide-[#F2ECE1]">
            {cartItems.length === 0 ? (
              <div className="py-20 text-center space-y-3">
                <div className="w-16 h-16 rounded-full bg-[#FAF7F2] border border-[#EAE2D6] flex items-center justify-center mx-auto text-[#801323]">
                  <ShoppingBag className="w-8 h-8" />
                </div>
                <h3 className="font-serif text-lg font-semibold text-stone-800">
                  Your cart is empty
                </h3>
                <p className="text-xs text-stone-500 max-w-xs mx-auto">
                  Add slow-cooked royal dum biryanis, succulent kebabs, or curries to start your order.
                </p>
                <button
                  type="button"
                  onClick={onClose}
                  className="mt-2 px-4 py-2 text-xs font-semibold text-white bg-[#801323] rounded-lg hover:bg-[#680E19] transition-colors cursor-pointer"
                >
                  Explore Menu
                </button>
              </div>
            ) : (
              cartItems.map(({ menuItem, quantity }) => (
                <div key={menuItem.id} className="pt-4 first:pt-0 flex items-start justify-between gap-3">
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <VegBadge isVeg={menuItem.is_veg} size="sm" />
                      <h4 className="font-medium text-sm text-[#231815] leading-tight">
                        {menuItem.name}
                      </h4>
                    </div>
                    <div className="mt-1 text-xs text-stone-500 font-mono tabular-nums">
                      ₹{menuItem.price} each
                    </div>
                  </div>

                  {/* Quantity Stepper & Removal */}
                  <div className="flex items-center gap-3">
                    <div className="flex items-center bg-[#FAF7F2] border border-[#D5C2AF] rounded-lg p-0.5">
                      <button
                        type="button"
                        onClick={() => onUpdateQuantity(menuItem.id, quantity - 1)}
                        className="w-7 h-7 flex items-center justify-center rounded bg-white text-stone-700 hover:bg-stone-100 transition-colors cursor-pointer"
                        aria-label="Decrease quantity"
                      >
                        <Minus className="w-3 h-3" />
                      </button>
                      <span className="font-mono tabular-nums text-xs font-bold w-6 text-center text-[#801323]">
                        {quantity}
                      </span>
                      <button
                        type="button"
                        onClick={() => onUpdateQuantity(menuItem.id, quantity + 1)}
                        className="w-7 h-7 flex items-center justify-center rounded bg-[#801323] text-white hover:bg-[#680E19] transition-colors cursor-pointer"
                        aria-label="Increase quantity"
                      >
                        <Plus className="w-3 h-3" />
                      </button>
                    </div>

                    <span className="font-mono tabular-nums text-sm font-bold text-stone-900 w-14 text-right">
                      ₹{menuItem.price * quantity}
                    </span>

                    <button
                      type="button"
                      onClick={() => onRemoveItem(menuItem.id)}
                      className="text-stone-400 hover:text-rose-600 transition-colors p-1 cursor-pointer"
                      title="Remove item"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Footer & Checkout Calculations */}
          {cartItems.length > 0 && (
            <div className="p-4 sm:p-5 border-t border-[#EAE2D6] bg-[#FAF7F2] space-y-3">
              <div className="space-y-1.5 text-xs text-stone-600">
                <div className="flex justify-between">
                  <span>Item Subtotal</span>
                  <span className="font-mono tabular-nums font-semibold text-stone-900">₹{subtotal}</span>
                </div>
                <div className="flex justify-between">
                  <span>Delivery Fee</span>
                  <span className="font-mono tabular-nums font-semibold">
                    {deliveryFee === 0 ? (
                      <span className="text-emerald-700 font-bold">FREE</span>
                    ) : (
                      `₹${deliveryFee}`
                    )}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>Eco-friendly Handi Packaging</span>
                  <span className="text-emerald-700 font-semibold font-mono">₹0 (Free)</span>
                </div>
                <div className="pt-2 border-t border-[#EAE2D6] flex justify-between text-base font-bold text-[#231815]">
                  <span>Total Amount</span>
                  <span className="font-mono tabular-nums text-lg text-[#801323]">
                    ₹{totalAmount}
                  </span>
                </div>
              </div>

              <button
                type="button"
                onClick={onProceedToCheckout}
                disabled={isBelowMinimum}
                className="w-full py-3.5 px-4 text-sm font-semibold uppercase tracking-wider text-white bg-[#801323] hover:bg-[#680E19] active:scale-98 disabled:opacity-50 disabled:cursor-not-allowed rounded-xl transition-all shadow-md flex items-center justify-center gap-2 cursor-pointer"
              >
                <span>{isBelowMinimum ? `Min Order ₹${MINIMUM_SUBTOTAL} (Add ₹${amountToMinimum})` : 'Proceed to Checkout'}</span>
                {!isBelowMinimum && <ArrowRight className="w-4 h-4" />}
              </button>

              <p className="text-[11px] text-center text-stone-500">
                Cash on Delivery (COD) · Authoritative price checked on submit
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
