import React, { useState, useEffect, useMemo } from 'react';
import { DeliveryPartner, Order } from '../../types';
import { store } from '../../services/store';
import {
  Bike,
  Phone,
  MapPin,
  CheckCircle2,
  Clock,
  ShieldAlert,
  LogOut,
  Navigation,
  DollarSign,
  PackageCheck,
  Check,
  AlertTriangle,
  RefreshCw,
  X,
} from 'lucide-react';
import { VegBadge } from '../VegBadge';

interface DeliveryDashboardProps {
  partner: DeliveryPartner;
  onLogout: () => void;
}

export const DeliveryDashboard: React.FC<DeliveryDashboardProps> = ({
  partner,
  onLogout,
}) => {
  const [orders, setOrders] = useState<Order[]>(
    store.getOrdersForPartner(partner.id)
  );
  const [availableOrders, setAvailableOrders] = useState<Order[]>(
    store.getAvailableOrdersForPickup()
  );

  useEffect(() => {
    store.fetchOrdersForDeliveryPartner(partner.id);

    const refresh = () => {
      setOrders(store.getOrdersForPartner(partner.id));
      setAvailableOrders(store.getAvailableOrdersForPickup());
    };
    const unsubscribe = store.subscribe(refresh);

    // Periodically sync orders in background (every 10s)
    const interval = setInterval(() => {
      store.fetchOrdersForDeliveryPartner(partner.id);
    }, 10000);

    return () => {
      unsubscribe();
      clearInterval(interval);
    };
  }, [partner.id]);

  const activeDeliveries = useMemo(
    () => orders.filter((o) => o.status !== 'delivered' && o.status !== 'cancelled'),
    [orders]
  );

  const completedDeliveries = useMemo(
    () => orders.filter((o) => o.status === 'delivered'),
    [orders]
  );

  const isOnlineOrder = (order: Order) =>
    order.paymentMethod === 'ONLINE_RAZORPAY' ||
    order.paymentStatus === 'paid' ||
    Boolean(order.paymentId);

  const totalCashCollected = useMemo(
    () =>
      completedDeliveries
        .filter((o) => !isOnlineOrder(o))
        .reduce((sum, o) => sum + o.totalAmount, 0),
    [completedDeliveries]
  );

  const totalOnlinePrepaid = useMemo(
    () =>
      completedDeliveries
        .filter((o) => isOnlineOrder(o))
        .reduce((sum, o) => sum + o.totalAmount, 0),
    [completedDeliveries]
  );

  const [actionInProgress, setActionInProgress] = useState<string | null>(null);
  const [actionError, setActionError] = useState<{ orderId: string; message: string } | null>(null);

  const handleStartPickup = async (orderId: string) => {
    setActionInProgress(orderId);
    setActionError(null);
    try {
      const res = await store.updateOrderStatus(
        orderId,
        'out_for_delivery',
        `Rider ${partner.name} picked up order from kitchen and started delivery.`
      );
      if (!res.success) {
        setActionError({ orderId, message: res.error || 'Could not start delivery run.' });
      }
    } catch (err: any) {
      setActionError({ orderId, message: err?.message || 'Error updating delivery run.' });
    } finally {
      setActionInProgress(null);
    }
  };

  const handleMarkDelivered = async (order: Order) => {
    setActionInProgress(order.id);
    setActionError(null);
    try {
      const isOnline = isOnlineOrder(order);
      const deliveryNote = isOnline
        ? `Order delivered safely to customer by ${partner.name}. Pre-paid online via Razorpay (No cash collected).`
        : `Order delivered safely to customer by ${partner.name}. Cash on delivery (₹${order.totalAmount}) collected.`;

      const res = await store.updateOrderStatus(
        order.id,
        'delivered',
        deliveryNote
      );
      if (!res.success) {
        setActionError({
          orderId: order.id,
          message: res.error || 'Unable to update delivery status. Please retry.',
        });
      }
    } catch (err: any) {
      setActionError({
        orderId: order.id,
        message: err?.message || 'Error updating delivery status.',
      });
    } finally {
      setActionInProgress(null);
    }
  };

  const handleClaimOrder = async (order: Order) => {
    setActionInProgress(order.id);
    setActionError(null);
    try {
      const assignRes = await store.assignDeliveryPartner(order.id, partner.id);
      if (!assignRes.success) {
        setActionError({ orderId: order.id, message: assignRes.error || 'Failed to claim order.' });
        return;
      }
      await store.updateOrderStatus(
        order.id,
        'out_for_delivery',
        `Rider ${partner.name} picked up order from kitchen and started delivery.`
      );
    } catch (err: any) {
      setActionError({ orderId: order.id, message: err?.message || 'Error claiming order.' });
    } finally {
      setActionInProgress(null);
    }
  };

  const handleClaimAndDeliver = async (order: Order) => {
    setActionInProgress(order.id);
    setActionError(null);
    try {
      const assignRes = await store.assignDeliveryPartner(order.id, partner.id);
      if (!assignRes.success) {
        setActionError({ orderId: order.id, message: assignRes.error || 'Failed to claim order.' });
        return;
      }
      await store.updateOrderStatus(
        order.id,
        'out_for_delivery',
        `Rider ${partner.name} picked up order from kitchen and started delivery.`
      );
      const isOnline = isOnlineOrder(order);
      const deliveryNote = isOnline
        ? `Order delivered safely to customer by ${partner.name}. Pre-paid online via Razorpay (No cash collected).`
        : `Order delivered safely to customer by ${partner.name}. Cash on delivery (₹${order.totalAmount}) collected.`;

      const res = await store.updateOrderStatus(
        order.id,
        'delivered',
        deliveryNote
      );
      if (!res.success) {
        setActionError({
          orderId: order.id,
          message: res.error || 'Unable to update delivery status. Please retry.',
        });
      }
    } catch (err: any) {
      setActionError({
        orderId: order.id,
        message: err?.message || 'Error updating delivery status.',
      });
    } finally {
      setActionInProgress(null);
    }
  };

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      {/* Rider Header Bar */}
      <div className="p-5 bg-white rounded-2xl border border-[#EAE2D6] shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3.5">
          <div className="w-12 h-12 rounded-xl bg-[#801323] text-white flex items-center justify-center shrink-0">
            <Bike className="w-6 h-6 text-[#DFB24E]" />
          </div>
          <div>
            <div className="text-[11px] font-semibold tracking-wider uppercase text-[#801323]">
              Rider Console · Bhagalpur
            </div>
            <h1 className="font-serif text-xl font-bold text-stone-900">
              {partner.name}
            </h1>
            <p className="text-xs text-stone-500 font-mono">
              {partner.vehicle} · {partner.phone}
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={onLogout}
          className="px-3.5 py-2 text-xs font-semibold text-rose-700 bg-rose-50 hover:bg-rose-100 rounded-lg transition-colors flex items-center gap-1.5 cursor-pointer self-start sm:self-auto"
        >
          <LogOut className="w-3.5 h-3.5" />
          <span>Exit Rider View</span>
        </button>
      </div>

      {/* Rider Metrics Strip */}
      <div className="grid grid-cols-3 gap-4">
        <div className="p-4 bg-white rounded-xl border border-amber-200 bg-amber-50/20">
          <div className="flex items-center justify-between text-xs text-amber-800 font-semibold">
            <span>Pending Runs</span>
            <Clock className="w-4 h-4 text-amber-600" />
          </div>
          <div className="mt-2 font-mono tabular-nums text-2xl font-bold text-amber-900">
            {activeDeliveries.length}
          </div>
        </div>

        <div className="p-4 bg-white rounded-xl border border-emerald-200 bg-emerald-50/20">
          <div className="flex items-center justify-between text-xs text-emerald-800 font-semibold">
            <span>Delivered Today</span>
            <PackageCheck className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="mt-2 font-mono tabular-nums text-2xl font-bold text-emerald-900">
            {completedDeliveries.length}
          </div>
        </div>

        <div className="p-4 bg-[#801323] text-white rounded-xl border border-[#680E19]">
          <div className="flex items-center justify-between text-xs text-[#DFB24E]">
            <span>COD Cash In Hand</span>
            <DollarSign className="w-4 h-4 text-[#DFB24E]" />
          </div>
          <div className="mt-2 font-mono tabular-nums text-2xl font-bold text-white">
            ₹{totalCashCollected}
          </div>
          {totalOnlinePrepaid > 0 && (
            <div className="text-[10px] text-emerald-200 mt-1 font-sans font-medium">
              + ₹{totalOnlinePrepaid} (Pre-paid Online)
            </div>
          )}
        </div>
      </div>

      {/* Security & Isolation Disclaimer */}
      <div className="p-3 bg-[#FAF7F2] border border-[#EAE2D6] rounded-xl text-xs text-stone-600 flex items-center gap-2">
        <ShieldAlert className="w-4 h-4 text-[#801323] shrink-0" />
        <span>
          <strong>Rider Isolation Active:</strong> You only have access to orders assigned directly to you. Other riders' runs and kitchen financial admin tools are protected.
        </span>
      </div>

      {/* Active Orders List */}
      <div className="space-y-4">
        <h2 className="font-serif text-lg font-bold text-stone-900">
          Active Assigned Orders ({activeDeliveries.length})
        </h2>

        {activeDeliveries.length === 0 ? (
          <div className="p-12 text-center bg-white rounded-xl border border-[#EAE2D6] space-y-2">
            <CheckCircle2 className="w-10 h-10 text-emerald-600 mx-auto" />
            <h3 className="font-serif text-base font-semibold text-stone-800">
              No Pending Deliveries
            </h3>
            <p className="text-xs text-stone-500 max-w-sm mx-auto">
              You are all caught up! When the kitchen assigns a new dum handi order to you, it will appear here immediately.
            </p>
          </div>
        ) : (
          activeDeliveries.map((order) => {
            const isPickedUp = order.status === 'out_for_delivery';

            return (
              <div
                key={order.id}
                className="bg-white rounded-xl border-2 border-[#EAE2D6] shadow-sm overflow-hidden"
              >
                {/* Header Strip */}
                <div className="p-4 bg-[#FAF7F2] border-b border-[#EAE2D6] flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <span className="text-[10px] text-stone-500 uppercase font-bold block">
                      Order ID
                    </span>
                    <span className="font-mono text-base font-bold text-[#801323]">
                      {order.orderNumber}
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    <span
                      className={`px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider ${
                        isPickedUp
                          ? 'bg-blue-100 text-blue-800'
                          : 'bg-amber-100 text-amber-800'
                      }`}
                    >
                      {order.status.replace(/_/g, ' ')}
                    </span>
                  </div>
                </div>

                {/* Customer Contact & Destination */}
                <div className="p-5 space-y-4">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 rounded-xl bg-stone-50 border border-stone-200">
                    <div className="space-y-1">
                      <span className="text-xs text-stone-400 uppercase font-semibold">
                        Customer
                      </span>
                      <h3 className="font-serif text-base font-bold text-stone-900">
                        {order.customerName}
                      </h3>
                      <div className="flex items-center gap-1.5 text-xs text-stone-600 font-mono">
                        <Phone className="w-3.5 h-3.5 text-stone-400" />
                        <span>+91 {order.customerPhone}</span>
                      </div>
                    </div>

                    <a
                      href={`tel:${order.customerPhone}`}
                      className="px-4 py-2.5 text-xs font-bold uppercase tracking-wider text-white bg-emerald-700 hover:bg-emerald-800 rounded-xl transition-all shadow-xs flex items-center justify-center gap-2 self-start sm:self-auto cursor-pointer"
                    >
                      <Phone className="w-4 h-4" />
                      <span>Call Customer</span>
                    </a>
                  </div>

                  {/* Delivery Address & Landmark */}
                  <div className="space-y-1">
                    <div className="text-xs font-semibold text-stone-500 uppercase flex items-center gap-1">
                      <MapPin className="w-3.5 h-3.5 text-[#801323]" />
                      <span>Delivery Address (Bhagalpur)</span>
                    </div>
                    <div className="p-3 bg-[#FAF7F2] rounded-lg border border-[#EAE2D6] text-xs text-stone-800 font-medium">
                      <p>{order.deliveryAddress}</p>
                      <p className="mt-1 text-stone-900 font-bold">
                        Landmark: {order.landmark}
                      </p>
                      {order.deliveryNotes && (
                        <p className="mt-1 text-amber-900 bg-amber-50 p-1.5 rounded border border-amber-200 text-[11px] italic">
                          Special Note: "{order.deliveryNotes}"
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Items Summary */}
                  <div>
                    <span className="text-xs font-semibold text-stone-500 uppercase block mb-1">
                      Items to Deliver
                    </span>
                    <div className="divide-y divide-stone-100 border border-stone-200 rounded-lg p-2.5 text-xs bg-white">
                      {order.items.map((item, idx) => (
                        <div key={idx} className="py-1 flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <VegBadge isVeg={item.is_veg} size="sm" />
                            <span>
                              {item.name} × {item.quantity}
                            </span>
                          </div>
                          <span className="font-mono text-stone-500">₹{item.subtotal}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Payment Method & Cash Alert */}
                  {isOnlineOrder(order) ? (
                    <div className="p-3.5 rounded-xl bg-emerald-50 border-2 border-emerald-500 flex items-center justify-between">
                      <div className="space-y-0.5">
                        <div className="flex items-center gap-1.5">
                          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                          <span className="text-xs uppercase font-extrabold text-emerald-900 tracking-wider">
                            Paid Online (Razorpay) · Do Not Collect Cash
                          </span>
                        </div>
                        <p className="text-xs text-emerald-800">
                          Payment already received online. Deliver food package directly to customer without taking cash.
                        </p>
                        {order.paymentId && (
                          <span className="text-[11px] font-mono text-emerald-700 block">
                            Txn / Payment ID: {order.paymentId}
                          </span>
                        )}
                      </div>
                      <div className="text-right shrink-0 ml-3">
                        <span className="font-mono text-xl font-extrabold text-emerald-800">
                          ₹{order.totalAmount}
                        </span>
                        <span className="block text-[10px] font-bold text-emerald-600 uppercase">
                          Prepaid
                        </span>
                      </div>
                    </div>
                  ) : (
                    <div className="p-3.5 rounded-xl bg-[#FDF9F0] border-2 border-[#C29B38] flex items-center justify-between">
                      <div>
                        <span className="text-[10px] uppercase font-bold text-amber-900 block">
                          Cash on Delivery (COD)
                        </span>
                        <span className="text-xs text-stone-700">
                          Collect exact amount in cash or ask customer to scan UPI:
                        </span>
                      </div>
                      <span className="font-mono text-xl font-extrabold text-[#801323]">
                        ₹{order.totalAmount}
                      </span>
                    </div>
                  )}

                  {/* Action Buttons for Rider */}
                  <div className="pt-2 space-y-2">
                    {actionError && actionError.orderId === order.id && (
                      <div className="p-3 bg-rose-50 border border-rose-200 text-rose-800 text-xs rounded-lg flex items-center justify-between gap-2 shadow-xs">
                        <div className="flex items-center gap-2">
                          <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
                          <span>{actionError.message}</span>
                        </div>
                        <button
                          type="button"
                          onClick={() => setActionError(null)}
                          className="text-rose-500 hover:text-rose-700 p-0.5 rounded cursor-pointer"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    )}

                    <div className="flex flex-col sm:flex-row gap-3">
                      {!isPickedUp ? (
                        <div className="flex flex-col sm:flex-row gap-2 flex-1">
                          <button
                            type="button"
                            disabled={actionInProgress === order.id}
                            onClick={() => handleStartPickup(order.id)}
                            className="flex-1 py-3 px-4 text-xs font-bold uppercase tracking-wider text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 rounded-xl transition-all shadow-md flex items-center justify-center gap-2 cursor-pointer"
                          >
                            {actionInProgress === order.id ? (
                              <RefreshCw className="w-4 h-4 animate-spin" />
                            ) : (
                              <Navigation className="w-4 h-4" />
                            )}
                            <span>Pick Up & Start Run</span>
                          </button>
                          <button
                            type="button"
                            disabled={actionInProgress === order.id}
                            onClick={() => handleMarkDelivered(order)}
                            className="py-3 px-4 text-xs font-bold uppercase tracking-wider text-white bg-emerald-700 hover:bg-emerald-800 disabled:opacity-50 rounded-xl transition-all shadow-md flex items-center justify-center gap-2 cursor-pointer"
                          >
                            <Check className="w-4 h-4" />
                            <span>
                              {isOnlineOrder(order)
                                ? `Deliver (Online ₹${order.totalAmount})`
                                : `Deliver & Collect ₹${order.totalAmount}`}
                            </span>
                          </button>
                        </div>
                      ) : (
                        <button
                          type="button"
                          disabled={actionInProgress === order.id}
                          onClick={() => handleMarkDelivered(order)}
                          className="flex-1 py-3 px-4 text-xs font-bold uppercase tracking-wider text-white bg-emerald-700 hover:bg-emerald-800 disabled:opacity-50 rounded-xl transition-all shadow-md flex items-center justify-center gap-2 cursor-pointer"
                        >
                          {actionInProgress === order.id ? (
                            <RefreshCw className="w-4 h-4 animate-spin" />
                          ) : (
                            <Check className="w-4 h-4" />
                          )}
                          <span>
                            {isOnlineOrder(order)
                              ? `Confirm Delivered (Payment Received Online · ₹${order.totalAmount})`
                              : `Confirm Delivered & Cash Collected (₹${order.totalAmount})`}
                          </span>
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Available Kitchen Orders Ready for Pickup & Delivery */}
      {availableOrders.length > 0 && (
        <div className="space-y-4 pt-4 border-t border-[#EAE2D6]">
          <div className="flex items-center justify-between">
            <h2 className="font-serif text-lg font-bold text-stone-900 flex items-center gap-2">
              <Bike className="w-5 h-5 text-[#801323]" />
              <span>Available for Pickup & Delivery</span>
              <span className="px-2 py-0.5 text-xs font-bold bg-[#801323] text-white rounded-full">
                {availableOrders.length}
              </span>
            </h2>
            <span className="text-[11px] font-semibold text-[#801323] bg-[#801323]/10 px-2.5 py-1 rounded-full">
              Ready to Claim
            </span>
          </div>

          <div className="space-y-4">
            {availableOrders.map((order) => (
              <div
                key={order.id}
                className="bg-white rounded-xl border-2 border-amber-300 shadow-sm overflow-hidden"
              >
                <div className="p-4 bg-amber-50/60 border-b border-amber-200 flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <span className="text-[10px] text-amber-800 uppercase font-bold block">
                      Kitchen Order · Awaiting Rider
                    </span>
                    <span className="font-mono text-base font-bold text-[#801323]">
                      {order.orderNumber}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="px-2.5 py-1 rounded-full text-xs font-bold uppercase tracking-wider bg-amber-100 text-amber-900 border border-amber-200">
                      {order.status.replace(/_/g, ' ')}
                    </span>
                  </div>
                </div>

                <div className="p-5 space-y-4">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 rounded-xl bg-stone-50 border border-stone-200">
                    <div className="space-y-1">
                      <span className="text-xs text-stone-400 uppercase font-semibold">
                        Customer
                      </span>
                      <h3 className="font-serif text-base font-bold text-stone-900">
                        {order.customerName}
                      </h3>
                      <div className="flex items-center gap-1.5 text-xs text-stone-600 font-mono">
                        <Phone className="w-3.5 h-3.5 text-stone-400" />
                        <span>+91 {order.customerPhone}</span>
                      </div>
                    </div>
                    <a
                      href={`tel:${order.customerPhone}`}
                      className="px-4 py-2 text-xs font-bold uppercase tracking-wider text-white bg-emerald-700 hover:bg-emerald-800 rounded-xl transition-all shadow-xs flex items-center justify-center gap-2 self-start sm:self-auto cursor-pointer"
                    >
                      <Phone className="w-4 h-4" />
                      <span>Call Customer</span>
                    </a>
                  </div>

                  <div className="p-3 bg-[#FAF7F2] rounded-lg border border-[#EAE2D6] text-xs text-stone-800">
                    <div className="flex items-center gap-1 text-stone-500 uppercase font-semibold mb-1">
                      <MapPin className="w-3.5 h-3.5 text-[#801323]" />
                      <span>Delivery Address (Bhagalpur)</span>
                    </div>
                    <p>{order.deliveryAddress}</p>
                    <p className="mt-1 font-bold text-stone-900">Landmark: {order.landmark}</p>
                  </div>

                  <div>
                    <span className="text-xs font-semibold text-stone-500 uppercase block mb-1">
                      Dishes ({order.items.length})
                    </span>
                    <div className="divide-y divide-stone-100 border border-stone-200 rounded-lg p-2.5 text-xs bg-white">
                      {order.items.map((item, idx) => (
                        <div key={idx} className="py-1 flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <VegBadge isVeg={item.is_veg} size="sm" />
                            <span>{item.name} × {item.quantity}</span>
                          </div>
                          <span className="font-mono text-stone-500">₹{item.subtotal}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Payment Alert Banner */}
                  {isOnlineOrder(order) ? (
                    <div className="p-3.5 rounded-xl bg-emerald-50 border-2 border-emerald-500 flex items-center justify-between">
                      <div className="space-y-0.5">
                        <div className="flex items-center gap-1.5">
                          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                          <span className="text-xs uppercase font-extrabold text-emerald-900 tracking-wider">
                            Paid Online (Razorpay) · Do Not Collect Cash
                          </span>
                        </div>
                        <p className="text-xs text-emerald-800">
                          Payment already received online. Deliver food package directly to customer without taking cash.
                        </p>
                      </div>
                      <div className="text-right shrink-0 ml-3">
                        <span className="font-mono text-xl font-extrabold text-emerald-800">
                          ₹{order.totalAmount}
                        </span>
                        <span className="block text-[10px] font-bold text-emerald-600 uppercase">
                          Prepaid
                        </span>
                      </div>
                    </div>
                  ) : (
                    <div className="p-3.5 rounded-xl bg-[#FDF9F0] border-2 border-[#C29B38] flex items-center justify-between">
                      <div>
                        <span className="text-[10px] uppercase font-bold text-amber-900 block">
                          Cash on Delivery (COD)
                        </span>
                        <span className="text-xs text-stone-700">
                          Collect exact amount in cash or ask customer to scan UPI:
                        </span>
                      </div>
                      <span className="font-mono text-xl font-extrabold text-[#801323]">
                        ₹{order.totalAmount}
                      </span>
                    </div>
                  )}

                  <div className="pt-2 flex flex-col sm:flex-row gap-2">
                    <button
                      type="button"
                      disabled={actionInProgress === order.id}
                      onClick={() => handleClaimOrder(order)}
                      className="flex-1 py-3 px-4 text-xs font-bold uppercase tracking-wider text-white bg-[#801323] hover:bg-[#680E19] disabled:opacity-50 rounded-xl transition-all shadow-md flex items-center justify-center gap-2 cursor-pointer"
                    >
                      {actionInProgress === order.id ? (
                        <RefreshCw className="w-4 h-4 animate-spin" />
                      ) : (
                        <Navigation className="w-4 h-4" />
                      )}
                      <span>Pick Up & Start Run</span>
                    </button>
                    <button
                      type="button"
                      disabled={actionInProgress === order.id}
                      onClick={() => handleClaimAndDeliver(order)}
                      className="py-3 px-4 text-xs font-bold uppercase tracking-wider text-white bg-emerald-700 hover:bg-emerald-800 disabled:opacity-50 rounded-xl transition-all shadow-md flex items-center justify-center gap-2 cursor-pointer"
                    >
                      <Check className="w-4 h-4" />
                      <span>
                        {isOnlineOrder(order)
                          ? `Deliver (Online ₹${order.totalAmount})`
                          : `Deliver & Collect ₹${order.totalAmount}`}
                      </span>
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Completed History */}
      {completedDeliveries.length > 0 && (
        <div className="space-y-3 pt-6 border-t border-[#EAE2D6]">
          <h3 className="font-serif text-base font-bold text-stone-900">
            Delivered Today ({completedDeliveries.length})
          </h3>
          <div className="space-y-2">
            {completedDeliveries.map((order) => (
              <div
                key={order.id}
                className="p-3 bg-white rounded-lg border border-stone-200 flex items-center justify-between text-xs"
              >
                <div>
                  <span className="font-mono font-bold text-[#801323]">
                    {order.orderNumber}
                  </span>
                  <span className="text-stone-600 ml-2">{order.customerName}</span>
                  <span className="text-stone-400 ml-2">({order.landmark})</span>
                </div>
                <div className="flex items-center gap-3">
                  {isOnlineOrder(order) ? (
                    <span className="font-mono font-bold text-emerald-700 flex items-center gap-1 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                      <span>₹{order.totalAmount} · Paid Online</span>
                    </span>
                  ) : (
                    <span className="font-mono font-bold text-amber-900 bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
                      ₹{order.totalAmount} · COD Cash
                    </span>
                  )}
                  <span className="text-[10px] text-stone-400">
                    {new Date(order.updatedAt).toLocaleTimeString([], {
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
