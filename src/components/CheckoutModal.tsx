import React, { useState } from 'react';
import { CartItem, CustomerDetails, Order } from '../types';
import { store } from '../services/store';
import { getSupabaseConfigStatus } from '../services/supabaseClient';
import { X, CheckCircle, ShieldCheck, MapPin, Phone, User, MessageSquare, AlertCircle } from 'lucide-react';
import { FREE_DELIVERY_THRESHOLD, STANDARD_DELIVERY_FEE } from '../services/orderValidator';

interface CheckoutModalProps {
  isOpen: boolean;
  onClose: () => void;
  cartItems: CartItem[];
  onOrderSuccess: (order: Order) => void;
}

export const CheckoutModal: React.FC<CheckoutModalProps> = ({
  isOpen,
  onClose,
  cartItems,
  onOrderSuccess,
}) => {
  const [formData, setFormData] = useState<CustomerDetails>({
    name: '',
    phone: '',
    address: '',
    landmark: '',
    instructions: '',
  });

  const [formErrors, setFormErrors] = useState<string[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isOpen) return null;

  const supabaseStatus = getSupabaseConfigStatus();

  const subtotal = cartItems.reduce(
    (acc, item) => acc + item.menuItem.price * item.quantity,
    0
  );
  const deliveryFee = subtotal >= FREE_DELIVERY_THRESHOLD ? 0 : STANDARD_DELIVERY_FEE;
  const totalAmount = subtotal + deliveryFee;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormErrors([]);
    setIsSubmitting(true);

    const payloadItems = cartItems.map((ci) => ({
      menuItemId: ci.menuItem.id,
      quantity: ci.quantity,
    }));

    try {
      // Authoritative server-style validation with Supabase anonymous auth support
      const result = await store.placeOrder(payloadItems, formData);

      setIsSubmitting(false);

      if (result.success && result.order) {
        onOrderSuccess(result.order);
      } else {
        setFormErrors(result.errors || ['Failed to place order. Please check inputs.']);
      }
    } catch (err: any) {
      setIsSubmitting(false);
      setFormErrors([err?.message || 'An error occurred while confirming your order.']);
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-stone-900/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="relative w-full max-w-xl bg-white rounded-2xl shadow-2xl border border-[#EAE2D6] overflow-hidden my-8">
        {/* Header */}
        <div className="p-5 border-b border-[#EAE2D6] bg-[#FAF7F2] flex items-center justify-between">
          <div>
            <span className="text-xs font-semibold tracking-wider uppercase text-[#801323]">
              Doorstep Delivery in Bhagalpur
            </span>
            <h2 className="font-serif text-xl font-bold text-[#231815]">
              Delivery Details & Checkout
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 text-stone-400 hover:text-stone-700 rounded-lg hover:bg-[#EAE2D6]/50 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Backend Transparency Banner */}
        <div className="px-5 py-2.5 bg-[#F9F7F4] border-b border-[#EAE2D6] text-xs text-stone-600 flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-emerald-600" />
            <span>
              {supabaseStatus.isConfigured
                ? 'Connected to Supabase PostgreSQL'
                : 'Local Store Active · Server-Side Price Recalculation Enforced'}
            </span>
          </div>
          <span className="font-mono text-stone-500">COD Guaranteed</span>
        </div>

        <form onSubmit={handleSubmit} className="p-5 sm:p-6 space-y-4">
          {formErrors.length > 0 && (
            <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-xl space-y-1 text-xs text-rose-800">
              <div className="flex items-center gap-1.5 font-bold">
                <AlertCircle className="w-4 h-4 text-rose-700" />
                <span>Please correct the following:</span>
              </div>
              <ul className="list-disc list-inside space-y-0.5 pl-1">
                {formErrors.map((err, idx) => (
                  <li key={idx}>{err}</li>
                ))}
              </ul>
            </div>
          )}

          {/* Name & Phone */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-stone-700 mb-1 flex items-center gap-1">
                <User className="w-3.5 h-3.5 text-[#801323]" />
                <span>Full Name *</span>
              </label>
              <input
                type="text"
                required
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="e.g. Ramesh Sinha"
                className="w-full px-3.5 py-2 text-sm bg-[#FAF7F2] border border-[#D5C2AF] rounded-lg text-stone-900 focus:outline-none focus:border-[#801323] focus:bg-white"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-stone-700 mb-1 flex items-center gap-1">
                <Phone className="w-3.5 h-3.5 text-[#801323]" />
                <span>10-Digit Mobile Number *</span>
              </label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-mono font-medium text-stone-500">
                  +91
                </span>
                <input
                  type="tel"
                  required
                  maxLength={10}
                  value={formData.phone}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      phone: e.target.value.replace(/[^0-9]/g, ''),
                    })
                  }
                  placeholder="9835012345"
                  className="w-full pl-12 pr-3.5 py-2 text-sm bg-[#FAF7F2] border border-[#D5C2AF] rounded-lg text-stone-900 font-mono focus:outline-none focus:border-[#801323] focus:bg-white"
                />
              </div>
              <span className="text-[10px] text-stone-400 mt-0.5 block">
                For order delivery coordination & rider calls
              </span>
            </div>
          </div>

          {/* Address & Landmark */}
          <div>
            <label className="block text-xs font-semibold text-stone-700 mb-1 flex items-center gap-1">
              <MapPin className="w-3.5 h-3.5 text-[#801323]" />
              <span>Full Delivery Address (House / Street / Colony) *</span>
            </label>
            <textarea
              required
              rows={2}
              value={formData.address}
              onChange={(e) => setFormData({ ...formData, address: e.target.value })}
              placeholder="e.g. Flat 204, Ganga Apartment, Tilkamanjhi Chowk"
              className="w-full px-3.5 py-2 text-sm bg-[#FAF7F2] border border-[#D5C2AF] rounded-lg text-stone-900 focus:outline-none focus:border-[#801323] focus:bg-white resize-none"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-stone-700 mb-1">
                Landmark in Bhagalpur *
              </label>
              <input
                type="text"
                required
                value={formData.landmark}
                onChange={(e) => setFormData({ ...formData, landmark: e.target.value })}
                placeholder="Near Zero Mile, Station Road, Ghantaghar..."
                className="w-full px-3.5 py-2 text-sm bg-[#FAF7F2] border border-[#D5C2AF] rounded-lg text-stone-900 focus:outline-none focus:border-[#801323] focus:bg-white"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-stone-700 mb-1 flex items-center gap-1">
                <MessageSquare className="w-3.5 h-3.5 text-stone-400" />
                <span>Cooking / Delivery Note (Optional)</span>
              </label>
              <input
                type="text"
                value={formData.instructions || ''}
                onChange={(e) => setFormData({ ...formData, instructions: e.target.value })}
                placeholder="e.g. Extra raita, ring bell twice..."
                className="w-full px-3.5 py-2 text-sm bg-[#FAF7F2] border border-[#D5C2AF] rounded-lg text-stone-900 focus:outline-none focus:border-[#801323] focus:bg-white"
              />
            </div>
          </div>

          {/* Payment Method - Cash on Delivery (COD) */}
          <div className="pt-2">
            <label className="block text-xs font-semibold text-stone-700 mb-2">
              Payment Method
            </label>
            <div className="p-3.5 rounded-xl border-2 border-[#801323] bg-[#FDF8F8] flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-[#801323] text-white flex items-center justify-center font-bold text-xs">
                  COD
                </div>
                <div>
                  <h4 className="text-sm font-bold text-[#231815]">
                    Cash on Delivery (COD)
                  </h4>
                  <p className="text-xs text-stone-600">
                    Pay in cash or scan delivery rider's UPI QR upon arrival at your door.
                  </p>
                </div>
              </div>
              <CheckCircle className="w-5 h-5 text-[#801323] shrink-0" />
            </div>
          </div>

          {/* Bill Summary */}
          <div className="p-3.5 bg-[#FAF7F2] rounded-xl border border-[#EAE2D6] space-y-1.5 text-xs text-stone-700">
            <div className="flex justify-between">
              <span>Items Total ({cartItems.reduce((acc, i) => acc + i.quantity, 0)} items)</span>
              <span className="font-mono tabular-nums font-semibold">₹{subtotal}</span>
            </div>
            <div className="flex justify-between">
              <span>Doorstep Delivery Fee</span>
              <span className="font-mono tabular-nums font-semibold">
                {deliveryFee === 0 ? <span className="text-emerald-700 font-bold">FREE</span> : `₹${deliveryFee}`}
              </span>
            </div>
            <div className="pt-2 border-t border-[#EAE2D6] flex justify-between text-base font-bold text-[#231815]">
              <span>Amount to Pay on Delivery</span>
              <span className="font-mono tabular-nums text-lg text-[#801323]">
                ₹{totalAmount}
              </span>
            </div>
          </div>

          {/* Submit Button */}
          <div className="pt-2">
            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full py-3.5 px-4 text-sm font-semibold uppercase tracking-wider text-white bg-[#801323] hover:bg-[#680E19] active:scale-98 disabled:opacity-50 rounded-xl transition-all shadow-md flex items-center justify-center gap-2 cursor-pointer"
            >
              <ShieldCheck className="w-4 h-4" />
              <span>{isSubmitting ? 'Verifying & Confirming...' : `Confirm Order (₹${totalAmount} COD)`}</span>
            </button>
            <p className="text-[11px] text-center text-stone-500 mt-2">
              Prices recalculated server-side · Free cancellation before kitchen accepts
            </p>
          </div>
        </form>
      </div>
    </div>
  );
};
