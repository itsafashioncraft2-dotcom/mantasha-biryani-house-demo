import React, { useState } from 'react';
import { CartItem, CustomerDetails, Order, PaymentMethod } from '../types';
import { store } from '../services/store';
import {
  X,
  CheckCircle,
  ShieldCheck,
  MapPin,
  Phone,
  User,
  MessageSquare,
  AlertCircle,
  CreditCard,
  Smartphone,
  Sparkles,
  QrCode,
} from 'lucide-react';
import { FREE_DELIVERY_THRESHOLD, STANDARD_DELIVERY_FEE } from '../services/orderValidator';
import { openRazorpayCheckout, RAZORPAY_KEY_ID, isRazorpayTestMode } from '../services/razorpay';
import { DemoPaymentGatewayModal } from './DemoPaymentGatewayModal';

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

  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('ONLINE_RAZORPAY');
  const [onlineModePreference, setOnlineModePreference] = useState<'instant_demo' | 'razorpay'>('instant_demo');
  const [isDemoGatewayOpen, setIsDemoGatewayOpen] = useState(false);
  const [formErrors, setFormErrors] = useState<string[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isOpen) return null;

  const subtotal = cartItems.reduce(
    (acc, item) => acc + item.menuItem.price * item.quantity,
    0
  );
  const deliveryFee = subtotal >= FREE_DELIVERY_THRESHOLD ? 0 : STANDARD_DELIVERY_FEE;
  const totalAmount = subtotal + deliveryFee;

  // Validate form details before proceeding to payment
  const validateForm = (): boolean => {
    const errors: string[] = [];
    if (!formData.name.trim() || formData.name.trim().length < 2) {
      errors.push('Please enter your full name (at least 2 characters).');
    }

    const cleanPhone = formData.phone.replace(/[^0-9]/g, '');
    if (cleanPhone.length !== 10) {
      errors.push('Please enter a valid 10-digit mobile number.');
    }

    if (!formData.address.trim() || formData.address.trim().length < 5) {
      errors.push('Please enter your complete delivery address with house/flat number.');
    }

    if (!formData.landmark.trim()) {
      errors.push('Please specify a nearby landmark in Bhagalpur (e.g. Zero Mile, Station Road).');
    }

    setFormErrors(errors);
    return errors.length === 0;
  };

  const handleFinalOrderPlacement = async (
    method: PaymentMethod,
    paymentId?: string
  ) => {
    setIsSubmitting(true);
    setFormErrors([]);

    const payloadItems = cartItems.map((ci) => ({
      menuItemId: ci.menuItem.id,
      quantity: ci.quantity,
    }));

    try {
      const result = await store.placeOrder(payloadItems, formData, {
        method,
        paymentId,
        status: method === 'ONLINE_RAZORPAY' ? 'paid' : 'cod',
      });

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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateForm()) return;

    if (paymentMethod === 'ONLINE_RAZORPAY') {
      if (onlineModePreference === 'instant_demo') {
        // Open Instant Free Demo Gateway (UPI / QR / Test Cards) directly
        setIsDemoGatewayOpen(true);
        return;
      }

      setIsSubmitting(true);
      setFormErrors([]);

      openRazorpayCheckout({
        amountInRupees: totalAmount,
        customerName: formData.name.trim(),
        customerPhone: formData.phone.trim(),
        onSuccess: async (response) => {
          // Razorpay payment successful (returns razorpay_payment_id e.g. pay_xxxx)
          await handleFinalOrderPlacement(
            'ONLINE_RAZORPAY',
            response.razorpay_payment_id
          );
        },
        onDismiss: () => {
          setIsSubmitting(false);
        },
        onError: () => {
          setIsSubmitting(false);
          // Auto-fallback: if Razorpay popup fails to open or is blocked in iframe/adblocker, open Demo Gateway
          setIsDemoGatewayOpen(true);
        },
        onFallbackToDemo: () => {
          setIsSubmitting(false);
          setIsDemoGatewayOpen(true);
        },
      });
    } else {
      // Cash on Delivery direct placement
      await handleFinalOrderPlacement('COD');
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

        {/* Clean Assurance Strip */}
        <div className="px-5 py-2.5 bg-[#F9F7F4] border-b border-[#EAE2D6] text-xs text-stone-600 flex items-center justify-between">
          <div className="flex items-center gap-1.5 font-medium">
            <span className="w-2 h-2 rounded-full bg-emerald-600" />
            <span>Bhagalpur Kitchen Hub · Handcrafted Hot Dum Biryani</span>
          </div>
          <span className="text-[11px] font-semibold text-[#801323]">Free Delivery Above ₹499</span>
        </div>

        <form onSubmit={handleSubmit} className="p-5 sm:p-6 space-y-4">
          {formErrors.length > 0 && (
            <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-xl space-y-1 text-xs text-rose-800">
              <div className="flex items-center gap-1.5 font-bold">
                <AlertCircle className="w-4 h-4 text-rose-700 shrink-0" />
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
              <span>Full Delivery Address (House / Flat / Street) *</span>
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
                <span>Special Instructions (Optional)</span>
              </label>
              <input
                type="text"
                value={formData.instructions || ''}
                onChange={(e) => setFormData({ ...formData, instructions: e.target.value })}
                placeholder="e.g. Extra salan, spicy gravy, ring bell"
                className="w-full px-3.5 py-2 text-sm bg-[#FAF7F2] border border-[#D5C2AF] rounded-lg text-stone-900 focus:outline-none focus:border-[#801323] focus:bg-white"
              />
            </div>
          </div>

          {/* Payment Method Selection */}
          <div className="pt-2">
            <label className="block text-xs font-bold text-stone-800 mb-2.5 uppercase tracking-wider">
              Choose Payment Method
            </label>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {/* Option 1: Razorpay Online (UPI, Cards, Netbanking) */}
              <div
                onClick={() => setPaymentMethod('ONLINE_RAZORPAY')}
                className={`p-3.5 rounded-xl border-2 transition-all cursor-pointer relative ${
                  paymentMethod === 'ONLINE_RAZORPAY'
                    ? 'border-[#801323] bg-[#FDF8F8] shadow-sm'
                    : 'border-[#EAE2D6] bg-white hover:border-[#D5C2AF]'
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2.5">
                    <div
                      className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                        paymentMethod === 'ONLINE_RAZORPAY'
                          ? 'bg-[#801323] text-white'
                          : 'bg-stone-100 text-stone-600'
                      }`}
                    >
                      <Smartphone className="w-4 h-4" />
                    </div>
                    <div>
                      <h4 className="text-xs font-bold text-stone-900 flex items-center gap-1.5">
                        <span>Pay Online</span>
                        <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
                          UPI · QR · Cards
                        </span>
                      </h4>
                      <p className="text-[11px] text-stone-500 mt-0.5 leading-snug">
                        GPay, PhonePe, Paytm, QR Code, Cards
                      </p>
                    </div>
                  </div>
                  {paymentMethod === 'ONLINE_RAZORPAY' && (
                    <CheckCircle className="w-4 h-4 text-[#801323] shrink-0" />
                  )}
                </div>

                {/* Gateway Mode Switcher */}
                {paymentMethod === 'ONLINE_RAZORPAY' && (
                  <div
                    className="mt-2.5 pt-2 border-t border-[#F2ECE1] space-y-1.5"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <div className="flex items-center gap-1 bg-white p-0.5 rounded-lg border border-[#EAE2D6] text-[10px]">
                      <button
                        type="button"
                        onClick={() => setOnlineModePreference('instant_demo')}
                        className={`flex-1 py-1 px-2 rounded-md font-semibold transition-all cursor-pointer text-center ${
                          onlineModePreference === 'instant_demo'
                            ? 'bg-[#801323] text-white shadow-2xs'
                            : 'text-stone-600 hover:text-stone-900'
                        }`}
                      >
                        ⚡ Free UPI Gateway (Demo)
                      </button>
                      <button
                        type="button"
                        onClick={() => setOnlineModePreference('razorpay')}
                        className={`flex-1 py-1 px-2 rounded-md font-semibold transition-all cursor-pointer text-center ${
                          onlineModePreference === 'razorpay'
                            ? 'bg-[#801323] text-white shadow-2xs'
                            : 'text-stone-600 hover:text-stone-900'
                        }`}
                      >
                        Razorpay Test Key
                      </button>
                    </div>
                    <p className="text-[10px] text-stone-500 italic">
                      {onlineModePreference === 'instant_demo'
                        ? 'Opens instant UPI QR code & GPay/PhonePe simulator (100% free test).'
                        : 'Opens Razorpay popup using your test key rzp_test_...'}
                    </p>
                  </div>
                )}

                {paymentMethod !== 'ONLINE_RAZORPAY' && (
                  <div className="mt-2.5 pt-2 border-t border-[#F2ECE1] flex items-center justify-between text-[10px] text-stone-400">
                    <span>Zero Real Money · Test Sandbox</span>
                    <span className="font-mono font-semibold text-emerald-700">100% Free Demo</span>
                  </div>
                )}
              </div>

              {/* Option 2: Cash on Delivery (COD) */}
              <div
                onClick={() => setPaymentMethod('COD')}
                className={`p-3.5 rounded-xl border-2 transition-all cursor-pointer relative ${
                  paymentMethod === 'COD'
                    ? 'border-[#801323] bg-[#FDF8F8] shadow-sm'
                    : 'border-[#EAE2D6] bg-white hover:border-[#D5C2AF]'
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2.5">
                    <div
                      className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 font-bold text-xs ${
                        paymentMethod === 'COD'
                          ? 'bg-[#801323] text-white'
                          : 'bg-stone-100 text-stone-600'
                      }`}
                    >
                      COD
                    </div>
                    <div>
                      <h4 className="text-xs font-bold text-stone-900">
                        Cash on Delivery
                      </h4>
                      <p className="text-[11px] text-stone-500 mt-0.5 leading-snug">
                        Pay cash or scan rider UPI at door
                      </p>
                    </div>
                  </div>
                  {paymentMethod === 'COD' && (
                    <CheckCircle className="w-4 h-4 text-[#801323] shrink-0" />
                  )}
                </div>

                <div className="mt-2.5 pt-2 border-t border-[#F2ECE1] flex items-center justify-between text-[10px] text-stone-400">
                  <span>Pay upon arrival</span>
                  <span className="font-semibold text-stone-600">Standard COD</span>
                </div>
              </div>
            </div>
          </div>

          {/* Bill Summary */}
          <div className="p-3.5 bg-[#FAF7F2] rounded-xl border border-[#EAE2D6] space-y-1.5 text-xs text-stone-700">
            <div className="flex justify-between">
              <span>Items Subtotal ({cartItems.reduce((acc, i) => acc + i.quantity, 0)} items)</span>
              <span className="font-mono tabular-nums font-semibold">₹{subtotal}</span>
            </div>
            <div className="flex justify-between">
              <span>Doorstep Delivery Fee</span>
              <span className="font-mono tabular-nums font-semibold">
                {deliveryFee === 0 ? (
                  <span className="text-emerald-700 font-bold">FREE</span>
                ) : (
                  `₹${deliveryFee}`
                )}
              </span>
            </div>
            <div className="pt-2 border-t border-[#EAE2D6] flex justify-between text-base font-bold text-[#231815]">
              <span>
                {paymentMethod === 'ONLINE_RAZORPAY' ? 'Total Payable Online' : 'Total Amount (COD)'}
              </span>
              <span className="font-mono tabular-nums text-lg text-[#801323]">
                ₹{totalAmount}
              </span>
            </div>
          </div>

          {/* Submit Action Button */}
          <div className="pt-2">
            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full py-3.5 px-4 text-sm font-semibold uppercase tracking-wider text-white bg-[#801323] hover:bg-[#680E19] active:scale-98 disabled:opacity-50 rounded-xl transition-all shadow-md flex items-center justify-center gap-2 cursor-pointer"
            >
              {paymentMethod === 'ONLINE_RAZORPAY' ? (
                <>
                  <CreditCard className="w-4 h-4" />
                  <span>
                    {isSubmitting
                      ? 'Opening Online Gateway...'
                      : onlineModePreference === 'instant_demo'
                        ? `Pay Online ₹${totalAmount} (Free Demo Gateway)`
                        : `Pay Online ₹${totalAmount} (Razorpay Test)`}
                  </span>
                </>
              ) : (
                <>
                  <ShieldCheck className="w-4 h-4" />
                  <span>
                    {isSubmitting
                      ? 'Confirming Order...'
                      : `Confirm Order (₹${totalAmount} COD)`}
                  </span>
                </>
              )}
            </button>

            <p className="text-[11px] text-center text-stone-500 mt-2 flex items-center justify-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-[#C29B38]" />
              <span>
                {paymentMethod === 'ONLINE_RAZORPAY'
                  ? 'Demo Sandbox: Supports UPI QR, Google Pay, PhonePe, and Test Cards without fees'
                  : 'Pay in cash or scan rider QR on delivery'}
              </span>
            </p>
          </div>
        </form>
      </div>

      {/* Interactive Free Demo Online Payment Gateway (UPI / QR / Cards) */}
      <DemoPaymentGatewayModal
        isOpen={isDemoGatewayOpen}
        onClose={() => setIsDemoGatewayOpen(false)}
        amountInRupees={totalAmount}
        customerName={formData.name.trim()}
        customerPhone={formData.phone.trim()}
        onPaymentSuccess={async (paymentId) => {
          setIsDemoGatewayOpen(false);
          await handleFinalOrderPlacement('ONLINE_RAZORPAY', paymentId);
        }}
      />
    </div>
  );
};
