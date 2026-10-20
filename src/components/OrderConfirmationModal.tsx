import React from 'react';
import { Order } from '../types';
import { CheckCircle2, MapPin, Phone, Clock, ArrowRight, ShieldCheck, X } from 'lucide-react';
import { VegBadge } from './VegBadge';

interface OrderConfirmationModalProps {
  order: Order | null;
  isOpen: boolean;
  onClose: () => void;
  onTrackOrder: (orderNumber: string, trackingToken?: string) => void;
}

export const OrderConfirmationModal: React.FC<OrderConfirmationModalProps> = ({
  order,
  isOpen,
  onClose,
  onTrackOrder,
}) => {
  if (!isOpen || !order) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-stone-900/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="relative w-full max-w-lg bg-white rounded-2xl shadow-2xl border border-[#EAE2D6] overflow-hidden my-8">
        {/* Top Banner */}
        <div className="bg-[#801323] text-white p-6 text-center relative">
          <button
            type="button"
            onClick={onClose}
            className="absolute top-4 right-4 text-white/70 hover:text-white p-1 rounded cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>

          <div className="w-14 h-14 bg-white/10 rounded-full flex items-center justify-center mx-auto mb-3 border border-white/20">
            <CheckCircle2 className="w-8 h-8 text-[#DFB24E]" />
          </div>

          <span className="text-xs font-semibold tracking-wider uppercase text-[#DFB24E]">
            Mantasha Biryani House Kitchen Confirmed
          </span>
          <h2 className="font-serif text-2xl font-bold mt-1">
            Order Placed Successfully!
          </h2>

          <div className="mt-3 inline-block bg-black/20 px-4 py-1.5 rounded-lg border border-white/15">
            <span className="text-xs text-stone-200">Order Reference: </span>
            <span className="font-mono text-sm font-bold text-[#F5EFE6]">
              #{order.orderNumber}
            </span>
          </div>
        </div>

        {/* Content Body */}
        <div className="p-6 space-y-5">
          {/* Estimated Time Strip */}
          <div className="flex items-center justify-between p-3.5 bg-[#FAF7F2] rounded-xl border border-[#EAE2D6] text-xs text-stone-700">
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4 text-[#801323]" />
              <span className="font-medium">Estimated Arrival:</span>
            </div>
            <span className="font-bold text-stone-900">35–45 Minutes</span>
          </div>

          {/* Delivery Details */}
          <div className="space-y-1.5 text-xs text-stone-600">
            <div className="font-semibold text-stone-900 uppercase tracking-wide text-[11px]">
              Delivering To:
            </div>
            <div className="p-3 rounded-lg bg-[#FAF7F2] border border-[#EAE2D6] space-y-1">
              <div className="font-semibold text-stone-900">{order.customerName}</div>
              <div className="flex items-start gap-1.5">
                <MapPin className="w-3.5 h-3.5 text-[#801323] shrink-0 mt-0.5" />
                <span>{order.deliveryAddress} ({order.landmark})</span>
              </div>
              <div className="flex items-center gap-1.5">
                <Phone className="w-3.5 h-3.5 text-stone-400 shrink-0" />
                <span className="font-mono">+91 {order.customerPhone}</span>
              </div>
            </div>
          </div>

          {/* Item Summary */}
          <div className="space-y-2">
            <div className="font-semibold text-stone-900 uppercase tracking-wide text-[11px]">
              Order Summary:
            </div>
            <div className="divide-y divide-[#F2ECE1] border-y border-[#F2ECE1] py-1 text-xs">
              {order.items.map((item, idx) => (
                <div key={idx} className="py-2 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <VegBadge isVeg={item.is_veg} size="sm" />
                    <span className="font-medium text-stone-800">
                      {item.name} × {item.quantity}
                    </span>
                  </div>
                  <span className="font-mono tabular-nums font-semibold text-stone-900">
                    ₹{item.subtotal}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Payment Method Receipt Strip */}
          {order.paymentMethod === 'ONLINE_RAZORPAY' ? (
            <div className="p-3 bg-emerald-50 rounded-xl border border-emerald-200 flex items-center justify-between text-xs">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                <div>
                  <span className="font-bold text-emerald-900 block">Paid Online (Razorpay)</span>
                  {order.paymentId && (
                    <span className="font-mono text-[10px] text-emerald-700">
                      Txn: {order.paymentId}
                    </span>
                  )}
                </div>
              </div>
              <div className="text-right">
                <span className="text-emerald-700 block text-[10px] uppercase font-semibold">Amount Paid</span>
                <span className="font-mono font-bold text-base text-emerald-900">
                  ₹{order.totalAmount}
                </span>
              </div>
            </div>
          ) : (
            <div className="p-3 bg-[#FDF9F0] rounded-xl border border-[#EAE2D6] flex items-center justify-between text-xs">
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-[#C29B38]" />
                <span className="font-medium text-stone-800">Cash on Delivery (COD)</span>
              </div>
              <div className="text-right">
                <span className="text-stone-500 block text-[10px]">Total to pay</span>
                <span className="font-mono font-bold text-base text-[#801323]">
                  ₹{order.totalAmount}
                </span>
              </div>
            </div>
          )}

          {/* Action Buttons */}
          <div className="pt-2 space-y-2">
            <button
              type="button"
              onClick={() => onTrackOrder(order.orderNumber, order.trackingToken)}
              className="w-full py-3.5 px-4 text-sm font-semibold uppercase tracking-wider text-white bg-[#801323] hover:bg-[#680E19] active:scale-98 rounded-xl transition-all shadow-md flex items-center justify-center gap-2 cursor-pointer"
            >
              <span>Track Order Live</span>
              <ArrowRight className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={onClose}
              className="w-full py-2.5 px-4 text-xs font-semibold text-stone-600 hover:text-stone-900 transition-colors text-center cursor-pointer"
            >
              Back to Home
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
