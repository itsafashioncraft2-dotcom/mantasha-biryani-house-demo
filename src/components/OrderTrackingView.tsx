import React, { useState, useEffect } from 'react';
import { Order, OrderStatus } from '../types';
import { store } from '../services/store';
import {
  Search,
  CheckCircle2,
  Clock,
  Flame,
  Package,
  Bike,
  CheckCheck,
  XCircle,
  Phone,
  MapPin,
  AlertCircle,
} from 'lucide-react';
import { VegBadge } from './VegBadge';

interface OrderTrackingViewProps {
  initialOrderId?: string;
  initialOrderNumber?: string;
  initialTrackingToken?: string;
  onBackToMenu: () => void;
}

export const OrderTrackingView: React.FC<OrderTrackingViewProps> = ({
  initialOrderId,
  initialOrderNumber,
  initialTrackingToken,
  onBackToMenu,
}) => {
  const [searchQuery, setSearchQuery] = useState(
    initialOrderNumber || initialOrderId || ''
  );
  const [trackingTokenInput, setTrackingTokenInput] = useState(
    initialTrackingToken || ''
  );
  const [activeOrder, setActiveOrder] = useState<Order | null>(null);
  const [searchError, setSearchError] = useState<string | null>(null);

  // Subscribe to live store updates so status changes from admin or delivery partner reflect immediately!
  useEffect(() => {
    let isMounted = true;
    const findOrder = async () => {
      const targetQuery = initialOrderNumber || initialOrderId;
      if (targetQuery) {
        const live = await store.fetchLiveOrder(targetQuery, initialTrackingToken);
        if (live && isMounted) {
          setActiveOrder(live);
          return;
        }
      }

      // Default to most recent order if available
      const allOrders = store.getOrders();
      if (allOrders.length > 0 && !activeOrder && isMounted) {
        setActiveOrder(allOrders[0]);
      }
    };

    findOrder();
    const unsubscribe = store.subscribe(() => {
      if (activeOrder) {
        const refreshed = store.getOrderById(activeOrder.id) || store.getOrderById(activeOrder.orderNumber);
        if (refreshed && isMounted) setActiveOrder(refreshed);
      }
    });

    return () => {
      isMounted = false;
      unsubscribe();
    };
  }, [initialOrderId, initialOrderNumber, initialTrackingToken]);

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    setSearchError(null);

    const query = searchQuery.trim();
    if (!query) {
      setSearchError('Please enter an order reference number.');
      return;
    }

    const token = trackingTokenInput.trim() || undefined;

    // Try finding live in Supabase or local store via secure tracking RPC
    const live = await store.fetchLiveOrder(query, token);
    if (live) {
      setActiveOrder(live);
      return;
    }

    // Try finding by customer phone (for local orders)
    const byPhone = await store.fetchOrdersByPhone(query);
    if (byPhone.length > 0) {
      setActiveOrder(byPhone[0]);
      return;
    }

    setSearchError(`No order found for "${query}". If this is a guest order, please ensure you enter the valid tracking token.`);
  };

  const statusSteps: {
    status: OrderStatus;
    label: string;
    description: string;
    icon: React.ReactNode;
  }[] = [
    {
      status: 'pending',
      label: 'Order Placed',
      description: 'Received by kitchen system',
      icon: <Clock className="w-4 h-4" />,
    },
    {
      status: 'accepted',
      label: 'Kitchen Accepted',
      description: 'Chef acknowledged order',
      icon: <CheckCircle2 className="w-4 h-4" />,
    },
    {
      status: 'preparing',
      label: 'Dum Cooking',
      description: 'Slow-cooking handi on coals',
      icon: <Flame className="w-4 h-4" />,
    },
    {
      status: 'ready_for_pickup',
      label: 'Ready for Pickup',
      description: 'Sealed & packed with care',
      icon: <Package className="w-4 h-4" />,
    },
    {
      status: 'out_for_delivery',
      label: 'Out for Delivery',
      description: 'Rider on the way',
      icon: <Bike className="w-4 h-4" />,
    },
    {
      status: 'delivered',
      label: 'Delivered',
      description: 'Handed over at doorstep',
      icon: <CheckCheck className="w-4 h-4" />,
    },
  ];

  const getStepIndex = (status: OrderStatus): number => {
    switch (status) {
      case 'pending':
        return 0;
      case 'accepted':
        return 1;
      case 'preparing':
        return 2;
      case 'ready_for_pickup':
        return 3;
      case 'out_for_delivery':
        return 4;
      case 'delivered':
        return 5;
      case 'cancelled':
        return -1;
      default:
        return 0;
    }
  };

  const currentStepIdx = activeOrder ? getStepIndex(activeOrder.status) : 0;
  const isCancelled = activeOrder?.status === 'cancelled';

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-8">
      {/* Search Bar */}
      <div className="bg-white p-5 rounded-2xl border border-[#EAE2D6] shadow-xs">
        <form onSubmit={handleSearch} className="space-y-3">
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-stone-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Enter Order Number (e.g. 1001)..."
                className="w-full pl-10 pr-4 py-2.5 text-sm bg-[#FAF7F2] border border-[#D5C2AF] rounded-xl text-stone-900 placeholder-stone-400 focus:outline-none focus:border-[#801323] focus:bg-white"
              />
            </div>
            <div className="relative flex-1">
              <input
                type="text"
                value={trackingTokenInput}
                onChange={(e) => setTrackingTokenInput(e.target.value)}
                placeholder="Tracking Token (for guest orders)"
                className="w-full px-4 py-2.5 text-sm bg-[#FAF7F2] border border-[#D5C2AF] rounded-xl text-stone-900 placeholder-stone-400 focus:outline-none focus:border-[#801323] focus:bg-white font-mono text-xs"
              />
            </div>
            <button
              type="submit"
              className="px-6 py-2.5 text-xs font-semibold uppercase tracking-wider text-white bg-[#801323] hover:bg-[#680E19] rounded-xl transition-colors cursor-pointer shrink-0"
            >
              Find Order
            </button>
          </div>
        </form>

        {searchError && (
          <div className="mt-3 p-2.5 bg-rose-50 border border-rose-200 rounded-lg text-xs text-rose-700 flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
            <span>{searchError}</span>
          </div>
        )}
      </div>

      {!activeOrder ? (
        <div className="py-16 text-center bg-white rounded-2xl border border-[#EAE2D6] p-8 space-y-3">
          <Clock className="w-10 h-10 text-stone-300 mx-auto" />
          <h3 className="font-serif text-lg font-bold text-stone-800">
            No active order selected
          </h3>
          <p className="text-xs text-stone-500 max-w-sm mx-auto">
            Place a new order or enter your order reference number above to view real-time cooking and delivery updates.
          </p>
          <button
            type="button"
            onClick={onBackToMenu}
            className="mt-2 px-5 py-2 text-xs font-semibold text-white bg-[#801323] rounded-lg hover:bg-[#680E19] transition-colors cursor-pointer"
          >
            Browse Menu & Order
          </button>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-[#EAE2D6] shadow-sm overflow-hidden">
          {/* Header of Active Order */}
          <div className="p-6 bg-[#FAF7F2] border-b border-[#EAE2D6] flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 text-xs text-stone-500">
                <span>Order Reference</span>
                <span aria-hidden="true">·</span>
                <span>Bhagalpur Kitchen</span>
                {activeOrder.isDemo && (
                  <>
                    <span aria-hidden="true">·</span>
                    <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-amber-100 text-amber-800">
                      Sample Demo Order
                    </span>
                  </>
                )}
              </div>
              <h2 className="font-mono text-xl font-bold text-[#801323]">
                {activeOrder.orderNumber}
              </h2>
            </div>

            <div className="flex items-center gap-3">
              <span
                className={`px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wide ${
                  isCancelled
                    ? 'bg-rose-100 text-rose-800'
                    : activeOrder.status === 'delivered'
                    ? 'bg-emerald-100 text-emerald-800'
                    : 'bg-[#F9ECC9] text-[#801323]'
                }`}
              >
                {isCancelled
                  ? 'Cancelled'
                  : activeOrder.status.replace(/_/g, ' ')}
              </span>
            </div>
          </div>

          <div className="p-6 space-y-8">
            {/* Realtime Stepper */}
            {isCancelled ? (
              <div className="p-4 bg-rose-50 border border-rose-200 rounded-xl flex items-center gap-3 text-rose-800">
                <XCircle className="w-6 h-6 text-rose-600 shrink-0" />
                <div>
                  <h4 className="font-bold text-sm">Order Cancelled</h4>
                  <p className="text-xs text-rose-700">
                    This order was cancelled. If you believe this is an error, please reach out to the restaurant.
                  </p>
                </div>
              </div>
            ) : (
              <div>
                <h3 className="text-xs font-semibold uppercase tracking-wider text-stone-500 mb-6">
                  Live Cooking & Delivery Stepper
                </h3>
                <div className="relative">
                  {/* Progress Line */}
                  <div className="hidden sm:block absolute top-5 left-6 right-6 h-1 bg-stone-200 -z-0">
                    <div
                      className="bg-[#801323] h-full transition-all duration-500"
                      style={{
                        width: `${(currentStepIdx / (statusSteps.length - 1)) * 100}%`,
                      }}
                    />
                  </div>

                  {/* Steps */}
                  <div className="grid grid-cols-2 sm:grid-cols-6 gap-4 relative z-10">
                    {statusSteps.map((step, idx) => {
                      const isCompleted = currentStepIdx >= idx;
                      const isCurrent = currentStepIdx === idx;

                      return (
                        <div
                          key={step.status}
                          className={`flex flex-col items-center text-center p-2 rounded-xl transition-colors ${
                            isCurrent
                              ? 'bg-[#FBF2F3] border border-[#801323]/20'
                              : ''
                          }`}
                        >
                          <div
                            className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-xs transition-colors mb-2 ${
                              isCompleted
                                ? 'bg-[#801323] text-white shadow-xs'
                                : 'bg-stone-200 text-stone-500'
                            }`}
                          >
                            {step.icon}
                          </div>
                          <span
                            className={`text-xs font-bold leading-tight ${
                              isCompleted ? 'text-stone-900' : 'text-stone-400'
                            }`}
                          >
                            {step.label}
                          </span>
                          <span className="text-[10px] text-stone-500 mt-1 hidden sm:block">
                            {step.description}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}

            {/* Delivery Partner Details if assigned */}
            {activeOrder.deliveryPartnerName && !isCancelled && (
              <div className="p-4 bg-[#FDF9F0] border border-[#EAE2D6] rounded-xl flex items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-[#801323] text-white flex items-center justify-center">
                    <Bike className="w-5 h-5" />
                  </div>
                  <div>
                    <span className="text-[10px] font-semibold uppercase text-stone-500 block">
                      Assigned Delivery Rider
                    </span>
                    <h4 className="font-serif text-sm font-bold text-stone-900">
                      {activeOrder.deliveryPartnerName}
                    </h4>
                    <p className="text-xs text-stone-600">
                      Doorstep delivery partner in Bhagalpur
                    </p>
                  </div>
                </div>

                <a
                  href={`tel:${activeOrder.customerPhone}`}
                  className="px-3.5 py-2 text-xs font-semibold text-[#801323] bg-white border border-[#D5C2AF] rounded-lg hover:bg-stone-50 transition-colors flex items-center gap-1.5"
                >
                  <Phone className="w-3.5 h-3.5" />
                  <span>Call Rider</span>
                </a>
              </div>
            )}

            {/* Order Items & Address Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-4 border-t border-[#EAE2D6]">
              {/* Items */}
              <div className="space-y-3">
                <h4 className="text-xs font-semibold uppercase tracking-wider text-stone-500">
                  Order Items
                </h4>
                <div className="divide-y divide-[#F2ECE1] border border-[#EAE2D6] rounded-xl p-3 bg-[#FAF7F2]">
                  {activeOrder.items.map((item, idx) => (
                    <div key={idx} className="py-2 first:pt-0 last:pb-0 flex items-center justify-between text-xs">
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

                  <div className="pt-2 mt-2 border-t border-[#EAE2D6] flex justify-between font-bold text-sm text-[#801323]">
                    <span>Total Amount (COD)</span>
                    <span className="font-mono tabular-nums">
                      ₹{activeOrder.totalAmount}
                    </span>
                  </div>
                </div>
              </div>

              {/* Delivery Destination */}
              <div className="space-y-3">
                <h4 className="text-xs font-semibold uppercase tracking-wider text-stone-500">
                  Delivery Destination
                </h4>
                <div className="border border-[#EAE2D6] rounded-xl p-4 bg-[#FAF7F2] space-y-2 text-xs text-stone-700">
                  <div className="font-bold text-stone-900">{activeOrder.customerName}</div>
                  <div className="flex items-start gap-1.5">
                    <MapPin className="w-3.5 h-3.5 text-[#801323] shrink-0 mt-0.5" />
                    <span>
                      {activeOrder.deliveryAddress}
                      <br />
                      <strong className="text-stone-800">Landmark:</strong> {activeOrder.landmark}
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5 text-stone-600">
                    <Phone className="w-3.5 h-3.5 text-stone-400 shrink-0" />
                    <span className="font-mono">+91 {activeOrder.customerPhone}</span>
                  </div>
                  {activeOrder.deliveryNotes && (
                    <div className="p-2 bg-white rounded border border-[#EAE2D6] text-[11px] text-stone-600 italic">
                      Note: "{activeOrder.deliveryNotes}"
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Status History Timeline */}
            <div className="pt-4 border-t border-[#EAE2D6]">
              <h4 className="text-xs font-semibold uppercase tracking-wider text-stone-500 mb-3">
                Status Event Log
              </h4>
              <div className="space-y-2">
                {activeOrder.statusHistory.map((hist, idx) => (
                  <div key={idx} className="flex items-center justify-between text-xs py-1 px-2.5 rounded bg-stone-50">
                    <div className="flex items-center gap-2">
                      <span className="w-1.5 h-1.5 rounded-full bg-[#801323]" />
                      <span className="font-semibold capitalize text-stone-800">
                        {hist.status.replace(/_/g, ' ')}
                      </span>
                      {hist.note && <span className="text-stone-500">· {hist.note}</span>}
                    </div>
                    <span className="font-mono text-[11px] text-stone-400">
                      {new Date(hist.timestamp).toLocaleTimeString([], {
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
