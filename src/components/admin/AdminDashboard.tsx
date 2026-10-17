import React, { useState, useEffect, useMemo } from 'react';
import { Order, OrderStatus, MenuItem, FoodCategory, DeliveryPartner } from '../../types';
import { store } from '../../services/store';
import {
  ShoppingBag,
  Flame,
  Bike,
  CheckCircle2,
  DollarSign,
  Phone,
  MapPin,
  Check,
  X,
  Plus,
  Edit2,
  LogOut,
  RefreshCw,
  Layers,
  Database,
  AlertTriangle,
  Search,
  Trash2,
  Power,
  Shield,
  UserPlus,
  KeyRound,
  Copy,
} from 'lucide-react';
import { VegBadge } from '../VegBadge';
import { isSupabaseConfigured } from '../../services/supabaseClient';
import { BrandLogo } from '../BrandLogo';

interface AdminDashboardProps {
  onLogout: () => void;
  onOpenSupabaseStatus: () => void;
}

const ADMIN_TAB_STORAGE_KEY = 'kadhai_admin_tab';

const parseInitialAdminTab = (): 'orders' | 'menu' | 'riders' | 'db_schema' => {
  try {
    const hash = window.location.hash.toLowerCase();
    if (hash.includes('menu')) return 'menu';
    if (hash.includes('riders')) return 'riders';
    if (hash.includes('db_schema')) return 'db_schema';
    if (hash.includes('orders')) return 'orders';

    const stored = localStorage.getItem(ADMIN_TAB_STORAGE_KEY);
    if (stored && ['orders', 'menu', 'riders', 'db_schema'].includes(stored)) {
      return stored as 'orders' | 'menu' | 'riders' | 'db_schema';
    }
  } catch {
    // ignore
  }
  return 'orders';
};

export const AdminDashboard: React.FC<AdminDashboardProps> = ({
  onLogout,
  onOpenSupabaseStatus,
}) => {
  const [activeTab, setActiveTab] = useState<'orders' | 'menu' | 'riders' | 'db_schema'>(parseInitialAdminTab);

  const handleSelectTab = (tab: 'orders' | 'menu' | 'riders' | 'db_schema') => {
    setActiveTab(tab);
    try {
      localStorage.setItem(ADMIN_TAB_STORAGE_KEY, tab);
      window.location.hash = `#admin/${tab}`;
    } catch {
      // ignore
    }
  };

  // Sync hash and storage on mount or tab change
  useEffect(() => {
    try {
      localStorage.setItem(ADMIN_TAB_STORAGE_KEY, activeTab);
      if (!window.location.hash.toLowerCase().includes(activeTab)) {
        window.location.hash = `#admin/${activeTab}`;
      }
    } catch {
      // ignore
    }
  }, [activeTab]);
  const [orders, setOrders] = useState<Order[]>(store.getOrders());
  const [menu, setMenu] = useState<MenuItem[]>(store.getMenu());
  const [partners, setPartners] = useState(store.getDeliveryPartners());
  const [partnersLoading, setPartnersLoading] = useState(store.getPartnersLoading());
  const [partnersError, setPartnersError] = useState(store.getPartnersError());
  const [orderStatusFilter, setOrderStatusFilter] = useState<string>('all');
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);

  // Delivery assignment UI states
  const [assigningOrderId, setAssigningOrderId] = useState<string | null>(null);
  const [assignmentErrors, setAssignmentErrors] = useState<Record<string, string>>({});
  const [assignmentSuccess, setAssignmentSuccess] = useState<string | null>(null);

  // In Supabase mode: only allow partners with real UUIDs from public.profiles and active status
  const assignablePartners = useMemo(() => {
    const activePool = partners.filter((p: DeliveryPartner) => p.isActive !== false);
    if (!isSupabaseConfigured) return activePool;
    return activePool.filter((p: DeliveryPartner) =>
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(p.id)
    );
  }, [partners]);

  // Menu editor modal state
  const [isEditingItem, setIsEditingItem] = useState<MenuItem | null>(null);
  const [isAddingItem, setIsAddingItem] = useState(false);
  const [itemForm, setItemForm] = useState<{
    name: string;
    description: string;
    category: FoodCategory;
    price: number;
    is_veg: boolean;
    portion_info: string;
  }>({
    name: '',
    description: '',
    category: 'biryani',
    price: 250,
    is_veg: false,
    portion_info: 'Serves 1-2',
  });
  const [menuActionError, setMenuActionError] = useState<string | null>(null);
  const [menuActionSuccess, setMenuActionSuccess] = useState<string | null>(null);
  const [itemToDelete, setItemToDelete] = useState<MenuItem | null>(null);
  const [isDeletingItem, setIsDeletingItem] = useState(false);

  // Subscribe to store updates and periodic live sync
  useEffect(() => {
    store.fetchOrdersFromSupabase();
    store.fetchDeliveryPartnersFromSupabase();

    const refresh = () => {
      setOrders(store.getOrders());
      setMenu(store.getMenu());
      setPartners(store.getDeliveryPartners());
      setPartnersLoading(store.getPartnersLoading());
      setPartnersError(store.getPartnersError());
    };
    const unsubscribe = store.subscribe(refresh);

    // Periodically sync orders in background (every 10s) to reflect rider actions immediately
    const interval = setInterval(() => {
      store.fetchOrdersFromSupabase();
    }, 10000);

    return () => {
      unsubscribe();
      clearInterval(interval);
    };
  }, []);

  // KPI Metrics
  const stats = useMemo(() => {
    const total = orders.length;
    const pending = orders.filter((o) => o.status === 'pending').length;
    const inKitchen = orders.filter((o) =>
      ['accepted', 'preparing', 'ready_for_pickup'].includes(o.status)
    ).length;
    const outForDelivery = orders.filter((o) => o.status === 'out_for_delivery').length;
    const delivered = orders.filter((o) => o.status === 'delivered').length;
    const totalRevenue = orders
      .filter((o) => o.status !== 'cancelled')
      .reduce((sum, o) => sum + o.totalAmount, 0);

    return { total, pending, inKitchen, outForDelivery, delivered, totalRevenue };
  }, [orders]);

  const filteredOrders = useMemo(() => {
    if (orderStatusFilter === 'all') return orders;
    return orders.filter((o) => o.status === orderStatusFilter);
  }, [orders, orderStatusFilter]);

  const handleStatusChange = async (orderId: string, newStatus: OrderStatus) => {
    const res = await store.updateOrderStatus(orderId, newStatus);
    if (!res.success) {
      console.error(`[AdminDashboard] Failed to change order status to ${newStatus}:`, res.error);
      setAssignmentErrors((prev) => ({
        ...prev,
        [orderId]: res.error || `Could not update order status to ${newStatus}.`,
      }));
    }
  };

  const handleAssignPartner = async (orderId: string, partnerId: string) => {
    if (!partnerId) return;

    setAssigningOrderId(orderId);
    setAssignmentErrors((prev) => {
      const next = { ...prev };
      delete next[orderId];
      return next;
    });

    try {
      const result = await store.assignDeliveryPartner(orderId, partnerId);
      if (!result.success) {
        console.error(`[Admin Dashboard] Supabase delivery assignment error for order ${orderId}:`, result.error);
        setAssignmentErrors((prev) => ({
          ...prev,
          [orderId]: result.error || 'Failed to assign delivery partner in Supabase.',
        }));
      } else {
        setAssignmentSuccess('Delivery partner assigned successfully.');
        setTimeout(() => setAssignmentSuccess(null), 4000);
      }
    } catch (err: any) {
      setAssignmentErrors((prev) => ({
        ...prev,
        [orderId]: err?.message || 'Unexpected error occurred during delivery assignment.',
      }));
    } finally {
      setAssigningOrderId(null);
    }
  };

  const handleToggleAvailability = async (itemId: string) => {
    setMenuActionError(null);
    const result = await store.toggleItemAvailability(itemId);
    if (!result.success) {
      setMenuActionError(
        result.error || 'Failed to update item availability in database.'
      );
    } else {
      setMenuActionSuccess('Item availability updated.');
      setTimeout(() => setMenuActionSuccess(null), 3000);
    }
  };

  const handleSaveItemEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    setMenuActionError(null);
    if (isEditingItem) {
      const result = await store.updateMenuItem({
        ...isEditingItem,
        ...itemForm,
      });
      if (!result.success) {
        setMenuActionError(result.error || 'Failed to save menu item changes.');
        return;
      }
      setIsEditingItem(null);
      setMenuActionSuccess('Menu item updated successfully.');
      setTimeout(() => setMenuActionSuccess(null), 3000);
    } else if (isAddingItem) {
      const result = await store.addMenuItem({
        ...itemForm,
        is_available: true,
        is_bestseller: false,
        spice_level: 'Medium',
      });
      if (!result.success) {
        setMenuActionError(result.error || 'Failed to add menu item.');
        return;
      }
      setIsAddingItem(false);
      setMenuActionSuccess('Menu item added successfully.');
      setTimeout(() => setMenuActionSuccess(null), 3000);
    }
  };

  const openEditModal = (item: MenuItem) => {
    setMenuActionError(null);
    setIsEditingItem(item);
    setItemForm({
      name: item.name,
      description: item.description,
      category: item.category,
      price: item.price,
      is_veg: item.is_veg,
      portion_info: item.portion_info || '',
    });
  };

  const confirmDeleteMenuItem = async () => {
    if (!itemToDelete) return;
    setIsDeletingItem(true);
    setMenuActionError(null);

    const result = await store.deleteMenuItem(itemToDelete.id);
    setIsDeletingItem(false);

    if (!result.success) {
      setMenuActionError(result.error || `Failed to delete "${itemToDelete.name}".`);
    } else {
      setMenuActionSuccess(`"${itemToDelete.name}" deleted successfully.`);
      setTimeout(() => setMenuActionSuccess(null), 3000);
      setItemToDelete(null);
    }
  };

  // Rider Management UI states
  const [riderSearch, setRiderSearch] = useState('');
  const [riderStatusFilter, setRiderStatusFilter] = useState<'all' | 'active' | 'inactive'>('all');
  const [isAddRiderModalOpen, setIsAddRiderModalOpen] = useState(false);
  const [editingRider, setEditingRider] = useState<DeliveryPartner | null>(null);
  const [confirmingRiderAction, setConfirmingRiderAction] = useState<{
    rider: DeliveryPartner;
    action: 'deactivate' | 'reactivate';
  } | null>(null);
  const [showRiderSqlModal, setShowRiderSqlModal] = useState(false);
  const [copiedSql, setCopiedSql] = useState(false);
  const [riderForm, setRiderForm] = useState<{
    fullName: string;
    phone: string;
    email: string;
    password: string;
  }>({
    fullName: '',
    phone: '',
    email: '',
    password: '',
  });
  const [riderActionLoading, setRiderActionLoading] = useState(false);
  const [riderActionError, setRiderActionError] = useState<string | null>(null);
  const [riderActionSuccess, setRiderActionSuccess] = useState<string | null>(null);

  const filteredPartners = useMemo(() => {
    let list = partners;
    if (riderStatusFilter === 'active') {
      list = list.filter((p: DeliveryPartner) => p.isActive !== false);
    } else if (riderStatusFilter === 'inactive') {
      list = list.filter((p: DeliveryPartner) => p.isActive === false);
    }

    const q = riderSearch.trim().toLowerCase();
    if (!q) return list;
    return list.filter(
      (p: DeliveryPartner) =>
        p.name.toLowerCase().includes(q) ||
        p.phone.toLowerCase().includes(q) ||
        (p.email && p.email.toLowerCase().includes(q)) ||
        p.id.toLowerCase().includes(q)
    );
  }, [partners, riderSearch, riderStatusFilter]);

  const activeRidersCount = useMemo(
    () => partners.filter((p) => p.isActive !== false).length,
    [partners]
  );
  const inactiveRidersCount = useMemo(
    () => partners.filter((p) => p.isActive === false).length,
    [partners]
  );

  const handleOpenAddRider = () => {
    setRiderForm({
      fullName: '',
      phone: '',
      email: '',
      password: '',
    });
    setRiderActionError(null);
    setIsAddRiderModalOpen(true);
  };

  const handleOpenEditRider = (rider: DeliveryPartner) => {
    setEditingRider(rider);
    setRiderForm({
      fullName: rider.name,
      phone: rider.phone,
      email: rider.email || '',
      password: '',
    });
    setRiderActionError(null);
  };

  const handleSaveRider = async (e: React.FormEvent) => {
    e.preventDefault();
    setRiderActionLoading(true);
    setRiderActionError(null);

    if (editingRider) {
      const res = await store.updateDeliveryPartner(editingRider.id, {
        fullName: riderForm.fullName,
        phone: riderForm.phone,
      });
      setRiderActionLoading(false);
      if (!res.success) {
        setRiderActionError(res.error || 'Failed to update rider.');
        return;
      }
      setEditingRider(null);
      setRiderActionSuccess(`Rider "${riderForm.fullName}" updated successfully.`);
      setTimeout(() => setRiderActionSuccess(null), 4000);
    } else {
      const res = await store.addDeliveryPartner({
        fullName: riderForm.fullName,
        phone: riderForm.phone,
        email: riderForm.email,
        password: riderForm.password || undefined,
      });
      setRiderActionLoading(false);
      if (!res.success) {
        setRiderActionError(res.error || 'Failed to add rider.');
        return;
      }
      setIsAddRiderModalOpen(false);
      setRiderActionSuccess(`Rider "${riderForm.fullName}" added successfully.`);
      setTimeout(() => setRiderActionSuccess(null), 4000);
    }
  };

  const handleExecuteRiderAction = async () => {
    if (!confirmingRiderAction) return;
    const { rider, action } = confirmingRiderAction;
    setRiderActionLoading(true);
    setRiderActionError(null);

    const res = await store.removeDeliveryPartner(rider.id, action);
    setRiderActionLoading(false);

    if (!res.success) {
      setRiderActionError(res.error || `Failed to ${action} rider.`);
      return;
    }

    setConfirmingRiderAction(null);
    setRiderActionSuccess(
      action === 'reactivate'
        ? `Rider "${rider.name}" reactivated successfully. Console access restored.`
        : `Rider "${rider.name}" deactivated successfully. Delivery history preserved.`
    );
    setTimeout(() => setRiderActionSuccess(null), 4000);
  };

  const openAddModal = () => {
    setMenuActionError(null);
    setIsAddingItem(true);
    setItemForm({
      name: '',
      description: '',
      category: 'biryani',
      price: 250,
      is_veg: false,
      portion_info: 'Serves 1-2',
    });
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      {/* Top Banner & Title Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-5 bg-white rounded-2xl border border-[#EAE2D6] shadow-xs">
        <div className="flex items-center gap-3.5">
          <BrandLogo size="md" variant="icon" />
          <div>
            <div className="flex items-center gap-2 text-xs font-semibold tracking-wider uppercase text-[#801323]">
              <span>Mantasha Biryani House Kitchen HQ</span>
              <span aria-hidden="true">·</span>
              <span>Bhagalpur Operations</span>
            </div>
            <h1 className="font-serif text-2xl font-bold text-[#231815]">
              Admin Control Center
            </h1>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => {
              store.fetchOrdersFromSupabase();
              store.fetchMenuFromSupabase();
              store.fetchDeliveryPartnersFromSupabase();
            }}
            className="px-3.5 py-2 text-xs font-medium text-stone-700 bg-[#FAF7F2] border border-[#EAE2D6] hover:bg-[#F5EFE6] rounded-lg transition-colors flex items-center gap-1.5 cursor-pointer"
          >
            <RefreshCw className="w-3.5 h-3.5 text-stone-600" />
            <span>Refresh</span>
          </button>
          <button
            type="button"
            onClick={onOpenSupabaseStatus}
            className="px-3.5 py-2 text-xs font-medium text-stone-700 bg-[#FAF7F2] border border-[#EAE2D6] hover:bg-[#F5EFE6] rounded-lg transition-colors flex items-center gap-1.5 cursor-pointer"
          >
            <Database className="w-3.5 h-3.5 text-[#801323]" />
            <span>Supabase Sync</span>
          </button>
          <button
            type="button"
            onClick={onLogout}
            className="px-3.5 py-2 text-xs font-medium text-rose-700 bg-rose-50 hover:bg-rose-100 rounded-lg transition-colors flex items-center gap-1.5 cursor-pointer"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>Sign Out</span>
          </button>
        </div>
      </div>

      {/* KPI Metrics Strip */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3.5">
        <div className="p-4 bg-white rounded-xl border border-[#EAE2D6]">
          <div className="flex items-center justify-between text-xs text-stone-500">
            <span>Total Orders</span>
            <ShoppingBag className="w-4 h-4 text-stone-400" />
          </div>
          <div className="mt-2 font-mono tabular-nums text-2xl font-bold text-stone-900">
            {stats.total}
          </div>
        </div>

        <div className="p-4 bg-white rounded-xl border border-amber-200 bg-amber-50/30">
          <div className="flex items-center justify-between text-xs text-amber-700 font-semibold">
            <span>Pending Review</span>
            <RefreshCw className="w-4 h-4 text-amber-600" />
          </div>
          <div className="mt-2 font-mono tabular-nums text-2xl font-bold text-amber-900">
            {stats.pending}
          </div>
        </div>

        <div className="p-4 bg-white rounded-xl border border-orange-200 bg-orange-50/30">
          <div className="flex items-center justify-between text-xs text-orange-700 font-semibold">
            <span>In Kitchen</span>
            <Flame className="w-4 h-4 text-orange-600" />
          </div>
          <div className="mt-2 font-mono tabular-nums text-2xl font-bold text-orange-900">
            {stats.inKitchen}
          </div>
        </div>

        <div className="p-4 bg-white rounded-xl border border-blue-200 bg-blue-50/30">
          <div className="flex items-center justify-between text-xs text-blue-700 font-semibold">
            <span>Out for Delivery</span>
            <Bike className="w-4 h-4 text-blue-600" />
          </div>
          <div className="mt-2 font-mono tabular-nums text-2xl font-bold text-blue-900">
            {stats.outForDelivery}
          </div>
        </div>

        <div className="p-4 bg-white rounded-xl border border-emerald-200 bg-emerald-50/30">
          <div className="flex items-center justify-between text-xs text-emerald-700 font-semibold">
            <span>Delivered</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="mt-2 font-mono tabular-nums text-2xl font-bold text-emerald-900">
            {stats.delivered}
          </div>
        </div>

        <div className="p-4 bg-[#801323] text-white rounded-xl border border-[#680E19]">
          <div className="flex items-center justify-between text-xs text-[#DFB24E]">
            <span>Total Sales (COD)</span>
            <DollarSign className="w-4 h-4 text-[#DFB24E]" />
          </div>
          <div className="mt-2 font-mono tabular-nums text-2xl font-bold text-white">
            ₹{stats.totalRevenue}
          </div>
        </div>
      </div>

      {/* Main Tabs Navigation */}
      <div className="flex items-center gap-2 border-b border-[#EAE2D6]">
        <button
          type="button"
          onClick={() => handleSelectTab('orders')}
          className={`px-4 py-2.5 text-sm font-semibold transition-colors border-b-2 cursor-pointer ${
            activeTab === 'orders'
              ? 'border-[#801323] text-[#801323]'
              : 'border-transparent text-stone-600 hover:text-stone-900'
          }`}
        >
          Orders & Kitchen Pipeline ({orders.length})
        </button>
        <button
          type="button"
          onClick={() => handleSelectTab('menu')}
          className={`px-4 py-2.5 text-sm font-semibold transition-colors border-b-2 cursor-pointer ${
            activeTab === 'menu'
              ? 'border-[#801323] text-[#801323]'
              : 'border-transparent text-stone-600 hover:text-stone-900'
          }`}
        >
          Menu & Prices Management ({menu.length})
        </button>
        <button
          type="button"
          onClick={() => handleSelectTab('riders')}
          className={`px-4 py-2.5 text-sm font-semibold transition-colors border-b-2 cursor-pointer flex items-center gap-1.5 ${
            activeTab === 'riders'
              ? 'border-[#801323] text-[#801323]'
              : 'border-transparent text-stone-600 hover:text-stone-900'
          }`}
        >
          <Bike className="w-4 h-4" />
          <span>Rider Management ({partners.length})</span>
        </button>
        <button
          type="button"
          onClick={() => handleSelectTab('db_schema')}
          className={`px-4 py-2.5 text-sm font-semibold transition-colors border-b-2 cursor-pointer ${
            activeTab === 'db_schema'
              ? 'border-[#801323] text-[#801323]'
              : 'border-transparent text-stone-600 hover:text-stone-900'
          }`}
        >
          Database Architecture & RLS
        </button>
      </div>

      {/* TAB 1: ORDERS MANAGEMENT */}
      {activeTab === 'orders' && (
        <div className="space-y-4">
          {assignmentSuccess && (
            <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-lg text-xs font-medium flex items-center gap-2 shadow-xs">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>{assignmentSuccess}</span>
            </div>
          )}
          {partnersError && (
            <div className="p-3 bg-rose-50 border border-rose-200 text-rose-800 rounded-lg text-xs flex items-center justify-between gap-2 shadow-xs">
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
                <span>
                  <strong>Delivery Partners Error:</strong> {partnersError}
                </span>
              </div>
              <button
                type="button"
                onClick={() => store.fetchDeliveryPartnersFromSupabase()}
                className="px-2.5 py-1 text-xs bg-rose-100 hover:bg-rose-200 text-rose-800 rounded font-semibold cursor-pointer"
              >
                Retry
              </button>
            </div>
          )}
          {/* Status Filter Bar */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
            {[
              { id: 'all', label: 'All Orders' },
              { id: 'pending', label: 'Pending' },
              { id: 'accepted', label: 'Accepted' },
              { id: 'preparing', label: 'Preparing' },
              { id: 'ready_for_pickup', label: 'Ready for Pickup' },
              { id: 'out_for_delivery', label: 'Out for Delivery' },
              { id: 'delivered', label: 'Delivered' },
              { id: 'cancelled', label: 'Cancelled' },
            ].map((st) => (
              <button
                key={st.id}
                type="button"
                onClick={() => setOrderStatusFilter(st.id)}
                className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors whitespace-nowrap cursor-pointer ${
                  orderStatusFilter === st.id
                    ? 'bg-[#801323] text-white shadow-xs'
                    : 'bg-white text-stone-700 hover:bg-[#F5EFE6] border border-[#EAE2D6]'
                }`}
              >
                {st.label}
              </button>
            ))}
          </div>

          {/* Orders List */}
          {filteredOrders.length === 0 ? (
            <div className="py-12 bg-white rounded-xl border border-[#EAE2D6] text-center text-stone-500 text-sm">
              No orders found for this status filter.
            </div>
          ) : (
            <div className="space-y-4">
              {filteredOrders.map((order) => {
                const isSelected = selectedOrderId === order.id;

                return (
                  <div
                    key={order.id}
                    className="bg-white rounded-xl border border-[#EAE2D6] shadow-xs overflow-hidden transition-all"
                  >
                    {/* Order Row Summary */}
                    <div className="p-4 sm:p-5 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                      <div>
                        <div className="flex items-center gap-2.5">
                          <span className="font-mono text-base font-bold text-[#801323]">
                            {order.orderNumber}
                          </span>
                          <span
                            className={`px-2.5 py-0.5 rounded-full text-xs font-bold uppercase tracking-wider ${
                              order.status === 'delivered'
                                ? 'bg-emerald-100 text-emerald-800'
                                : order.status === 'cancelled'
                                ? 'bg-rose-100 text-rose-800'
                                : order.status === 'pending'
                                ? 'bg-amber-100 text-amber-800'
                                : 'bg-[#F9ECC9] text-[#801323]'
                            }`}
                          >
                            {order.status.replace(/_/g, ' ')}
                          </span>
                          {order.isDemo && (
                            <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-amber-100 text-amber-800 border border-amber-200">
                              Demo Sample
                            </span>
                          )}
                          <span className="text-xs text-stone-400 font-mono">
                            {new Date(order.createdAt).toLocaleTimeString([], {
                              hour: '2-digit',
                              minute: '2-digit',
                            })}
                          </span>
                        </div>

                        {/* Customer & Address Preview */}
                        <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-stone-600">
                          <span className="font-semibold text-stone-900">
                            {order.customerName}
                          </span>
                          <span>·</span>
                          <span className="font-mono">+91 {order.customerPhone}</span>
                          <span>·</span>
                          <span className="truncate max-w-xs">{order.landmark}</span>
                        </div>
                      </div>

                      {/* Right: Amount & Quick Actions */}
                      <div className="flex flex-wrap items-center gap-3">
                        <div className="text-right mr-2">
                          <span className="text-[10px] text-stone-400 uppercase block">COD Bill</span>
                          <span className="font-mono text-base font-bold text-stone-900">
                            ₹{order.totalAmount}
                          </span>
                        </div>

                        {/* Status Advancement Actions */}
                        {order.status === 'pending' && (
                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() => handleStatusChange(order.id, 'accepted')}
                              className="px-3 py-1.5 text-xs font-semibold text-white bg-emerald-700 hover:bg-emerald-800 rounded-lg cursor-pointer flex items-center gap-1"
                            >
                              <Check className="w-3.5 h-3.5" />
                              <span>Accept</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => handleStatusChange(order.id, 'cancelled')}
                              className="px-3 py-1.5 text-xs font-semibold text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200 rounded-lg cursor-pointer flex items-center gap-1"
                            >
                              <X className="w-3.5 h-3.5" />
                              <span>Reject</span>
                            </button>
                          </div>
                        )}

                        {order.status === 'accepted' && (
                          <button
                            type="button"
                            onClick={() => handleStatusChange(order.id, 'preparing')}
                            className="px-3 py-1.5 text-xs font-semibold text-white bg-orange-600 hover:bg-orange-700 rounded-lg cursor-pointer"
                          >
                            Start Dum Cooking
                          </button>
                        )}

                        {order.status === 'preparing' && (
                          <button
                            type="button"
                            onClick={() => handleStatusChange(order.id, 'ready_for_pickup')}
                            className="px-3 py-1.5 text-xs font-semibold text-white bg-amber-600 hover:bg-amber-700 rounded-lg cursor-pointer"
                          >
                            Mark Ready for Pickup
                          </button>
                        )}

                        {order.status === 'ready_for_pickup' && (
                          <button
                            type="button"
                            onClick={() => handleStatusChange(order.id, 'out_for_delivery')}
                            className="px-3 py-1.5 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg cursor-pointer"
                          >
                            Dispatch Rider
                          </button>
                        )}

                        {/* Assign Delivery Partner Dropdown */}
                        <div className="flex items-center gap-1.5" title="Assign Delivery Partner">
                          <label htmlFor={`assign-partner-${order.id}`} className="sr-only">
                            Assign Delivery Partner
                          </label>
                          <select
                            id={`assign-partner-${order.id}`}
                            aria-label="Assign Delivery Partner"
                            value={order.deliveryPartnerId || ''}
                            onChange={(e) => handleAssignPartner(order.id, e.target.value)}
                            disabled={assigningOrderId === order.id || partnersLoading}
                            className="text-xs bg-[#FAF7F2] border border-[#D5C2AF] rounded-lg px-2 py-1.5 text-stone-800 disabled:opacity-50"
                          >
                            <option value="">-- Assign Delivery Partner --</option>
                            {partnersLoading && (
                              <option value="" disabled>Loading delivery partners...</option>
                            )}
                            {!partnersLoading && assignablePartners.length === 0 && isSupabaseConfigured && (
                              <option value="" disabled>No delivery partners found in DB</option>
                            )}
                            {assignablePartners.map((p) => (
                              <option key={p.id} value={p.id}>
                                {p.name}{p.phone ? ` (${p.phone})` : ''}
                              </option>
                            ))}
                          </select>
                          {(assigningOrderId === order.id || partnersLoading) && (
                            <RefreshCw className="w-3.5 h-3.5 animate-spin text-stone-500" />
                          )}
                        </div>

                        <button
                          type="button"
                          onClick={() => setSelectedOrderId(isSelected ? null : order.id)}
                          className="px-3 py-1.5 text-xs font-semibold text-stone-700 bg-stone-100 hover:bg-stone-200 rounded-lg transition-colors cursor-pointer"
                        >
                          {isSelected ? 'Hide Details' : 'View Full Details'}
                        </button>
                      </div>
                    </div>

                    {/* Inline Assignment Error Banner */}
                    {assignmentErrors[order.id] && (
                      <div className="mx-5 mb-3 p-3 rounded-lg bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-start justify-between gap-3 shadow-xs">
                        <div className="flex items-start gap-2">
                          <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                          <div>
                            <span className="font-bold text-rose-900 block">Action Failed:</span>
                            <span className="text-rose-700 leading-relaxed">{assignmentErrors[order.id]}</span>
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            setAssignmentErrors((prev) => {
                              const next = { ...prev };
                              delete next[order.id];
                              return next;
                            });
                          }}
                          className="text-rose-400 hover:text-rose-700 p-0.5 rounded cursor-pointer shrink-0"
                          title="Dismiss error"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    )}

                    {/* Expanded Detail Panel */}
                    {isSelected && (
                      <div className="border-t border-[#EAE2D6] p-5 bg-[#FAF7F2] space-y-4">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                          {/* Order Items List */}
                          <div>
                            <h4 className="text-xs font-bold uppercase tracking-wider text-stone-600 mb-2">
                              Ordered Dishes
                            </h4>
                            <div className="bg-white rounded-lg border border-[#EAE2D6] divide-y divide-[#F2ECE1] p-3 text-xs">
                              {order.items.map((item, idx) => (
                                <div key={idx} className="py-2 flex items-center justify-between">
                                  <div className="flex items-center gap-2">
                                    <VegBadge isVeg={item.is_veg} size="sm" />
                                    <span>{item.name}</span>
                                    <span className="font-mono text-stone-500">× {item.quantity}</span>
                                  </div>
                                  <span className="font-mono font-semibold">₹{item.subtotal}</span>
                                </div>
                              ))}
                              <div className="pt-2 flex justify-between font-bold text-stone-900">
                                <span>Subtotal + Delivery</span>
                                <span className="font-mono text-[#801323]">₹{order.totalAmount}</span>
                              </div>
                            </div>
                          </div>

                          {/* Customer & Address Details */}
                          <div>
                            <h4 className="text-xs font-bold uppercase tracking-wider text-stone-600 mb-2">
                              Customer Delivery Details
                            </h4>
                            <div className="bg-white rounded-lg border border-[#EAE2D6] p-3 space-y-2 text-xs text-stone-700">
                              <div>
                                <strong>Customer Name:</strong> {order.customerName}
                              </div>
                              <div className="flex items-center gap-1.5">
                                <Phone className="w-3.5 h-3.5 text-stone-400" />
                                <strong className="font-mono">+91 {order.customerPhone}</strong>
                                <a
                                  href={`tel:${order.customerPhone}`}
                                  className="text-xs text-[#801323] underline ml-2"
                                >
                                  Call Customer
                                </a>
                              </div>
                              <div className="flex items-start gap-1.5">
                                <MapPin className="w-3.5 h-3.5 text-[#801323] shrink-0 mt-0.5" />
                                <div>
                                  <strong>Address:</strong> {order.deliveryAddress}
                                  <br />
                                  <strong>Landmark:</strong> {order.landmark}
                                </div>
                              </div>
                              {order.deliveryNotes && (
                                <div className="p-2 bg-amber-50 rounded border border-amber-200 text-amber-900">
                                  <strong>Cooking / Delivery Note:</strong> {order.deliveryNotes}
                                </div>
                              )}
                              <div>
                                <strong>Rider:</strong>{' '}
                                {order.deliveryPartnerName
                                  ? `${order.deliveryPartnerName}`
                                  : 'Not yet assigned'}
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* TAB 2: MENU & PRICES MANAGEMENT */}
      {activeTab === 'menu' && (
        <div className="space-y-4">
          {menuActionSuccess && (
            <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-lg text-xs flex items-center justify-between shadow-xs">
              <span>{menuActionSuccess}</span>
              <button
                type="button"
                onClick={() => setMenuActionSuccess(null)}
                className="cursor-pointer text-emerald-600 hover:text-emerald-800 font-bold ml-2"
              >
                ×
              </button>
            </div>
          )}
          {menuActionError && (
            <div className="p-3 bg-rose-50 border border-rose-200 text-rose-800 rounded-lg text-xs flex items-center justify-between shadow-xs">
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
                <span>{menuActionError}</span>
              </div>
              <button
                type="button"
                onClick={() => setMenuActionError(null)}
                className="cursor-pointer text-rose-600 hover:text-rose-800 font-bold ml-2"
              >
                ×
              </button>
            </div>
          )}


          <div className="flex items-center justify-between">
            <p className="text-xs text-stone-600">
              Manage live dish availability, update prices, or add new chef creations. Changes take effect instantly for all customers.
            </p>
            <button
              type="button"
              onClick={openAddModal}
              className="px-4 py-2 text-xs font-semibold text-white bg-[#801323] hover:bg-[#680E19] rounded-lg transition-colors flex items-center gap-1.5 cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Add New Dish</span>
            </button>
          </div>

          {/* Desktop Table View */}
          <div className="hidden md:block bg-white rounded-xl border border-[#EAE2D6] overflow-hidden shadow-2xs">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-stone-700">
                <thead className="bg-[#FAF7F2] border-b border-[#EAE2D6] font-semibold text-stone-900">
                  <tr>
                    <th className="py-3 px-4">Dish</th>
                    <th className="py-3 px-4">Category</th>
                    <th className="py-3 px-4">Price (INR)</th>
                    <th className="py-3 px-4">Diet</th>
                    <th className="py-3 px-4">Kitchen Availability</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#F2ECE1]">
                  {menu.map((item) => (
                    <tr key={item.id} className="hover:bg-stone-50/50">
                      <td className="py-3 px-4">
                        <div className="font-semibold text-stone-900">{item.name}</div>
                        <div className="text-[11px] text-stone-500 line-clamp-1">
                          {item.portion_info}
                        </div>
                      </td>
                      <td className="py-3 px-4 capitalize font-medium">{item.category}</td>
                      <td className="py-3 px-4 font-mono font-bold text-sm text-[#801323]">
                        ₹{item.price}
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-1.5">
                          <VegBadge isVeg={item.is_veg} size="sm" />
                          <span>{item.is_veg ? 'Veg' : 'Non-Veg'}</span>
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        <button
                          type="button"
                          onClick={() => handleToggleAvailability(item.id)}
                          className={`px-3 py-1 rounded-full font-bold text-[11px] cursor-pointer transition-colors ${
                            item.is_available
                              ? 'bg-emerald-100 text-emerald-800 hover:bg-emerald-200'
                              : 'bg-stone-200 text-stone-600 hover:bg-stone-300'
                          }`}
                        >
                          {item.is_available ? 'Available' : 'Sold Out'}
                        </button>
                      </td>
                      <td className="py-3 px-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            type="button"
                            onClick={() => openEditModal(item)}
                            className="px-3 py-1.5 text-xs font-semibold text-[#801323] bg-[#FAF7F2] hover:bg-[#F2ECE1] rounded-lg border border-[#D5C2AF] cursor-pointer inline-flex items-center gap-1.5 transition-colors shadow-2xs"
                            title={`Edit ${item.name}`}
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                            <span>Edit</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => setItemToDelete(item)}
                            className="px-3 py-1.5 text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 active:scale-95 rounded-lg cursor-pointer inline-flex items-center gap-1.5 transition-all shadow-xs"
                            title={`Delete ${item.name}`}
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                            <span>Delete Dish</span>
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Mobile & Tablet Card View (guarantees Delete button is immediately visible without horizontal scrolling) */}
          <div className="md:hidden space-y-3">
            {menu.map((item) => (
              <div
                key={item.id}
                className="bg-white rounded-xl border border-[#EAE2D6] p-4 shadow-2xs space-y-3"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <VegBadge isVeg={item.is_veg} size="sm" />
                      <h4 className="font-semibold text-sm text-stone-900">{item.name}</h4>
                    </div>
                    {item.portion_info && (
                      <p className="text-[11px] text-stone-500 mt-0.5">{item.portion_info}</p>
                    )}
                    <p className="text-xs text-stone-600 line-clamp-1 mt-1">{item.description}</p>
                  </div>
                  <div className="text-right shrink-0">
                    <span className="font-mono font-bold text-base text-[#801323]">
                      ₹{item.price}
                    </span>
                    <span className="block text-[10px] text-stone-400 capitalize">{item.category}</span>
                  </div>
                </div>

                <div className="pt-2 border-t border-[#F2ECE1] flex items-center justify-between gap-2">
                  <button
                    type="button"
                    onClick={() => handleToggleAvailability(item.id)}
                    className={`px-3 py-1 rounded-full font-bold text-[11px] cursor-pointer transition-colors ${
                      item.is_available
                        ? 'bg-emerald-100 text-emerald-800'
                        : 'bg-stone-200 text-stone-600'
                    }`}
                  >
                    {item.is_available ? '● Available' : '○ Sold Out'}
                  </button>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => openEditModal(item)}
                      className="px-3 py-1.5 text-xs font-semibold text-[#801323] hover:bg-[#FAF7F2] rounded-lg border border-[#EAE2D6] cursor-pointer inline-flex items-center gap-1.5 transition-colors"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                      <span>Edit</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setItemToDelete(item)}
                      className="px-3 py-1.5 text-xs font-semibold text-rose-700 bg-rose-50 hover:bg-rose-600 hover:text-white rounded-lg border border-rose-300 cursor-pointer inline-flex items-center gap-1.5 transition-colors shadow-2xs"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>Delete Dish</span>
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TAB 3: RIDER MANAGEMENT */}
      {activeTab === 'riders' && (
        <div className="space-y-4">
          {riderActionSuccess && (
            <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-lg text-xs font-medium flex items-center gap-2 shadow-xs">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>{riderActionSuccess}</span>
            </div>
          )}
          {riderActionError && (
            <div className="p-3 bg-rose-50 border border-rose-200 text-rose-800 rounded-lg text-xs flex items-center justify-between gap-2 shadow-xs">
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
                <span>{riderActionError}</span>
              </div>
              <button
                type="button"
                onClick={() => setRiderActionError(null)}
                className="text-rose-500 hover:text-rose-700 p-0.5 rounded cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          )}

          <div className="bg-white rounded-xl border border-[#EAE2D6] p-5 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h3 className="font-serif text-lg font-bold text-[#231815] flex items-center gap-2">
                <Bike className="w-5 h-5 text-[#801323]" />
                <span>Delivery Fleet & Rider Accounts</span>
              </h3>
              <p className="text-xs text-stone-600 mt-1">
                Manage registered delivery personnel, assign delivery runs, and provision secure login credentials.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              {/* Status filter buttons */}
              <div className="flex items-center bg-[#FAF7F2] p-1 rounded-lg border border-[#D5C2AF] text-xs">
                <button
                  type="button"
                  onClick={() => setRiderStatusFilter('all')}
                  className={`px-3 py-1 rounded-md font-medium transition-colors cursor-pointer ${
                    riderStatusFilter === 'all'
                      ? 'bg-[#801323] text-white shadow-xs'
                      : 'text-stone-600 hover:text-stone-900'
                  }`}
                >
                  All ({partners.length})
                </button>
                <button
                  type="button"
                  onClick={() => setRiderStatusFilter('active')}
                  className={`px-3 py-1 rounded-md font-medium transition-colors cursor-pointer ${
                    riderStatusFilter === 'active'
                      ? 'bg-emerald-700 text-white shadow-xs'
                      : 'text-stone-600 hover:text-stone-900'
                  }`}
                >
                  Active ({activeRidersCount})
                </button>
                <button
                  type="button"
                  onClick={() => setRiderStatusFilter('inactive')}
                  className={`px-3 py-1 rounded-md font-medium transition-colors cursor-pointer ${
                    riderStatusFilter === 'inactive'
                      ? 'bg-amber-700 text-white shadow-xs'
                      : 'text-stone-600 hover:text-stone-900'
                  }`}
                >
                  Deactivated ({inactiveRidersCount})
                </button>
              </div>

              <div className="relative">
                <Search className="w-3.5 h-3.5 text-stone-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Search by name, phone, UUID..."
                  value={riderSearch}
                  onChange={(e) => setRiderSearch(e.target.value)}
                  className="pl-8 pr-3 py-1.5 text-xs bg-[#FAF7F2] border border-[#D5C2AF] rounded-lg text-stone-900 focus:outline-[#801323] w-48 sm:w-56"
                />
              </div>

              <button
                type="button"
                onClick={() => setShowRiderSqlModal(true)}
                className="px-3 py-1.5 text-xs font-semibold text-stone-700 bg-stone-100 hover:bg-stone-200 border border-stone-300 rounded-lg transition-colors flex items-center gap-1.5 cursor-pointer"
                title="View Supabase Server-side RPC Migration"
              >
                <Database className="w-3.5 h-3.5 text-[#801323]" />
                <span className="hidden sm:inline">Server RPC Setup</span>
              </button>

              <button
                type="button"
                onClick={handleOpenAddRider}
                className="px-4 py-1.5 text-xs font-semibold uppercase tracking-wider text-white bg-[#801323] hover:bg-[#680E19] rounded-lg transition-colors flex items-center gap-1.5 cursor-pointer shadow-xs"
              >
                <UserPlus className="w-3.5 h-3.5" />
                <span>Add Rider</span>
              </button>
            </div>
          </div>

          {/* Riders List Table */}
          <div className="bg-white rounded-xl border border-[#EAE2D6] overflow-hidden shadow-xs">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-[#FAF7F2] border-b border-[#EAE2D6] text-stone-600 font-semibold uppercase tracking-wider">
                    <th className="py-3 px-4">Rider Details</th>
                    <th className="py-3 px-4">Contact Phone</th>
                    <th className="py-3 px-4">Vehicle</th>
                    <th className="py-3 px-4">Active Orders</th>
                    <th className="py-3 px-4">Account Status</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#F2ECE1]">
                  {partnersLoading ? (
                    <tr>
                      <td colSpan={6} className="py-8 text-center text-stone-500">
                        <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2 text-[#801323]" />
                        <span>Loading delivery partners from Supabase...</span>
                      </td>
                    </tr>
                  ) : filteredPartners.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-8 text-center text-stone-500">
                        {riderSearch ? 'No riders matching search.' : 'No delivery partners found in this view.'}
                      </td>
                    </tr>
                  ) : (
                    filteredPartners.map((rider) => {
                      const activeOrdersForRider = orders.filter(
                        (o) =>
                          o.deliveryPartnerId === rider.id &&
                          o.status !== 'delivered' &&
                          o.status !== 'cancelled'
                      );
                      const isRiderActive = rider.isActive !== false;

                      return (
                        <tr key={rider.id} className="hover:bg-[#FCFAF7] transition-colors">
                          <td className="py-3 px-4">
                            <div className="font-semibold text-stone-900 text-sm">
                              {rider.name}
                            </div>
                            <div className="font-mono text-[10px] text-stone-400 truncate max-w-xs" title={rider.id}>
                              ID: {rider.id}
                            </div>
                          </td>
                          <td className="py-3 px-4 font-mono font-medium text-stone-800">
                            {rider.phone ? `+91 ${rider.phone}` : '—'}
                          </td>
                          <td className="py-3 px-4 text-stone-600">
                            {rider.vehicle || 'Fleet / Bike'}
                          </td>
                          <td className="py-3 px-4">
                            <span
                              className={`px-2 py-0.5 rounded-full font-bold font-mono text-[11px] ${
                                activeOrdersForRider.length > 0
                                  ? 'bg-amber-100 text-amber-800'
                                  : 'bg-stone-100 text-stone-600'
                              }`}
                            >
                              {activeOrdersForRider.length} active
                            </span>
                          </td>
                          <td className="py-3 px-4">
                            {isRiderActive ? (
                              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-100 text-emerald-800">
                                <span className="w-1.5 h-1.5 rounded-full bg-emerald-600"></span>
                                Active Delivery
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-amber-100 text-amber-800">
                                <span className="w-1.5 h-1.5 rounded-full bg-amber-600"></span>
                                Deactivated
                              </span>
                            )}
                          </td>
                          <td className="py-3 px-4 text-right">
                            <div className="inline-flex items-center gap-1.5">
                              <button
                                type="button"
                                onClick={() => handleOpenEditRider(rider)}
                                className="px-2.5 py-1 text-xs font-semibold text-stone-700 hover:text-stone-900 bg-stone-100 hover:bg-stone-200 rounded border border-stone-200 cursor-pointer flex items-center gap-1"
                                title="Edit Rider Details"
                              >
                                <Edit2 className="w-3 h-3" />
                                <span>Edit</span>
                              </button>

                              {isRiderActive ? (
                                <button
                                  type="button"
                                  onClick={() =>
                                    setConfirmingRiderAction({ rider, action: 'deactivate' })
                                  }
                                  className="px-2.5 py-1 text-xs font-semibold text-amber-700 hover:text-amber-900 bg-amber-50 hover:bg-amber-100 rounded border border-amber-200 cursor-pointer flex items-center gap-1"
                                  title="Deactivate Rider"
                                >
                                  <Power className="w-3 h-3" />
                                  <span>Deactivate</span>
                                </button>
                              ) : (
                                <button
                                  type="button"
                                  onClick={() =>
                                    setConfirmingRiderAction({ rider, action: 'reactivate' })
                                  }
                                  className="px-2.5 py-1 text-xs font-semibold text-emerald-700 hover:text-emerald-900 bg-emerald-50 hover:bg-emerald-100 rounded border border-emerald-200 cursor-pointer flex items-center gap-1"
                                  title="Reactivate Rider"
                                >
                                  <CheckCircle2 className="w-3 h-3" />
                                  <span>Reactivate</span>
                                </button>
                              )}

                              <span
                                className="px-2 py-0.5 text-[10px] font-medium text-stone-400 bg-stone-50 rounded border border-stone-200 select-none"
                                title="Permanent deletion disabled to protect order and delivery history. Use Deactivate."
                              >
                                Protected
                              </span>
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 4: SUPABASE & POSTGRESQL ARCHITECTURE */}
      {activeTab === 'db_schema' && (
        <div className="bg-white rounded-xl border border-[#EAE2D6] p-6 space-y-6">
          <div className="flex items-start justify-between">
            <div>
              <h3 className="font-serif text-lg font-bold text-[#231815]">
                Supabase PostgreSQL Schema & RLS Policies
              </h3>
              <p className="text-xs text-stone-600 mt-1">
                Tables, relationships, and Row Level Security mapped for production deployment in Bhagalpur.
              </p>
            </div>
            <button
              type="button"
              onClick={onOpenSupabaseStatus}
              className="px-4 py-2 text-xs font-semibold text-white bg-[#801323] rounded-lg hover:bg-[#680E19] transition-colors cursor-pointer"
            >
              View Connection Status
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="p-4 bg-[#FAF7F2] rounded-xl border border-[#EAE2D6] space-y-2">
              <div className="flex items-center gap-2 font-bold text-sm text-[#801323]">
                <Layers className="w-4 h-4" />
                <span>1. profiles</span>
              </div>
              <p className="text-xs text-stone-600">
                Maps to Supabase Auth users. Roles: <code>customer</code>, <code>admin</code>, <code>delivery_partner</code>.
              </p>
            </div>

            <div className="p-4 bg-[#FAF7F2] rounded-xl border border-[#EAE2D6] space-y-2">
              <div className="flex items-center gap-2 font-bold text-sm text-[#801323]">
                <Layers className="w-4 h-4" />
                <span>2. menu_items</span>
              </div>
              <p className="text-xs text-stone-600">
                Public read-only for diners; admin write-only for price edits and out-of-stock toggles.
              </p>
            </div>

            <div className="p-4 bg-[#FAF7F2] rounded-xl border border-[#EAE2D6] space-y-2">
              <div className="flex items-center gap-2 font-bold text-sm text-[#801323]">
                <Layers className="w-4 h-4" />
                <span>3. orders</span>
              </div>
              <p className="text-xs text-stone-600">
                Holds order reference number, customer phone, address, landmark, status, COD total. RLS protects customer confidentiality.
              </p>
            </div>

            <div className="p-4 bg-[#FAF7F2] rounded-xl border border-[#EAE2D6] space-y-2">
              <div className="flex items-center gap-2 font-bold text-sm text-[#801323]">
                <Layers className="w-4 h-4" />
                <span>4. order_items</span>
              </div>
              <p className="text-xs text-stone-600">
                Itemized dish lines with snapshot price and quantity to guarantee zero historical price tampering.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Item Edit/Add Modal */}
      {(isEditingItem || isAddingItem) && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-stone-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="relative w-full max-w-md bg-white rounded-2xl shadow-2xl border border-[#EAE2D6] overflow-hidden">
            <div className="p-5 bg-[#801323] text-white flex items-center justify-between">
              <h3 className="font-serif text-lg font-bold">
                {isEditingItem ? `Edit Dish: ${isEditingItem.name}` : 'Add New Menu Item'}
              </h3>
              <button
                type="button"
                onClick={() => {
                  setIsEditingItem(null);
                  setIsAddingItem(false);
                }}
                className="text-white/70 hover:text-white cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveItemEdit} className="p-6 space-y-4">
              {menuActionError && (
                <div className="p-3 rounded-lg bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
                  <span>{menuActionError}</span>
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-stone-700 mb-1">
                  Dish Name *
                </label>
                <input
                  type="text"
                  required
                  value={itemForm.name}
                  onChange={(e) => setItemForm({ ...itemForm, name: e.target.value })}
                  className="w-full px-3 py-2 text-sm bg-[#FAF7F2] border border-[#D5C2AF] rounded-lg text-stone-900"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-stone-700 mb-1">
                    Price (₹ INR) *
                  </label>
                  <input
                    type="number"
                    required
                    min={1}
                    value={itemForm.price}
                    onChange={(e) =>
                      setItemForm({ ...itemForm, price: Number(e.target.value) })
                    }
                    className="w-full px-3 py-2 text-sm bg-[#FAF7F2] border border-[#D5C2AF] rounded-lg text-stone-900 font-mono"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-stone-700 mb-1">
                    Category *
                  </label>
                  <select
                    value={itemForm.category}
                    onChange={(e) =>
                      setItemForm({
                        ...itemForm,
                        category: e.target.value as FoodCategory,
                      })
                    }
                    className="w-full px-3 py-2 text-sm bg-[#FAF7F2] border border-[#D5C2AF] rounded-lg text-stone-900"
                  >
                    <option value="biryani">Dum Biryani</option>
                    <option value="curries">Curries & Chaap</option>
                    <option value="starters">Starters & Kebabs</option>
                    <option value="breads">Mughlai Breads</option>
                    <option value="desserts">Desserts</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-stone-700 mb-1">
                  Portion / Serving Info
                </label>
                <input
                  type="text"
                  value={itemForm.portion_info}
                  onChange={(e) =>
                    setItemForm({ ...itemForm, portion_info: e.target.value })
                  }
                  placeholder="e.g. Serves 1-2 · 1 large pc, 1 aloo, raita"
                  className="w-full px-3 py-2 text-sm bg-[#FAF7F2] border border-[#D5C2AF] rounded-lg text-stone-900"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-stone-700 mb-1">
                  Description
                </label>
                <textarea
                  rows={2}
                  value={itemForm.description}
                  onChange={(e) =>
                    setItemForm({ ...itemForm, description: e.target.value })
                  }
                  className="w-full px-3 py-2 text-sm bg-[#FAF7F2] border border-[#D5C2AF] rounded-lg text-stone-900 resize-none"
                />
              </div>

              <div className="flex items-center gap-3">
                <label className="flex items-center gap-2 text-xs font-semibold text-stone-700 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={itemForm.is_veg}
                    onChange={(e) =>
                      setItemForm({ ...itemForm, is_veg: e.target.checked })
                    }
                    className="rounded border-[#D5C2AF] text-[#801323] focus:ring-[#801323]"
                  />
                  <span>Mark as Pure Vegetarian (Green Dot)</span>
                </label>
              </div>

              <div className="pt-3 flex items-center justify-between gap-3 border-t border-[#EAE2D6]">
                {isEditingItem ? (
                  <button
                    type="button"
                    onClick={() => {
                      const itemToDel = isEditingItem;
                      setIsEditingItem(null);
                      setItemToDelete(itemToDel);
                    }}
                    className="px-3.5 py-2 text-xs font-semibold text-rose-700 bg-rose-50 hover:bg-rose-600 hover:text-white rounded-lg border border-rose-300 cursor-pointer flex items-center gap-1.5 transition-colors shadow-2xs"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Delete Dish</span>
                  </button>
                ) : (
                  <div />
                )}
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => {
                      setIsEditingItem(null);
                      setIsAddingItem(false);
                    }}
                    className="px-4 py-2 text-xs font-semibold text-stone-600 hover:text-stone-900 cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-5 py-2 text-xs font-semibold uppercase tracking-wider text-white bg-[#801323] hover:bg-[#680E19] rounded-lg cursor-pointer shadow-xs"
                  >
                    Save Dish
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Menu Item Confirmation Modal */}
      {itemToDelete && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-stone-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="relative w-full max-w-sm bg-white rounded-2xl shadow-2xl border border-[#EAE2D6] overflow-hidden p-6 space-y-4">
            <div className="w-12 h-12 rounded-full bg-rose-100 text-rose-700 flex items-center justify-center mx-auto">
              <Trash2 className="w-6 h-6" />
            </div>
            <div className="text-center space-y-1">
              <h3 className="font-serif text-lg font-bold text-stone-900">
                Delete Dish from Menu?
              </h3>
              <p className="text-xs text-stone-600">
                Are you sure you want to remove <span className="font-semibold text-stone-900">"{itemToDelete.name}"</span>?
                This dish will no longer be visible on the menu or customer cart.
              </p>
            </div>
            {menuActionError && (
              <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg text-xs text-rose-700 flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5 text-rose-600" />
                <span>{menuActionError}</span>
              </div>
            )}
            <div className="flex items-center gap-3 pt-2">
              <button
                type="button"
                onClick={() => setItemToDelete(null)}
                disabled={isDeletingItem}
                className="flex-1 py-2 text-xs font-semibold text-stone-700 bg-stone-100 hover:bg-stone-200 rounded-lg transition-colors cursor-pointer disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={confirmDeleteMenuItem}
                disabled={isDeletingItem}
                className="flex-1 py-2 text-xs font-semibold text-white bg-rose-700 hover:bg-rose-800 rounded-lg transition-colors flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50 shadow-xs"
              >
                {isDeletingItem ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>Deleting...</span>
                  </>
                ) : (
                  <>
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Delete Dish</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add / Edit Rider Modal */}
      {(isAddRiderModalOpen || editingRider) && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-stone-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="relative w-full max-w-md bg-white rounded-2xl shadow-2xl border border-[#EAE2D6] overflow-hidden">
            <div className="p-5 bg-[#801323] text-white flex items-center justify-between">
              <h3 className="font-serif text-lg font-bold flex items-center gap-2">
                <Bike className="w-5 h-5 text-[#DFB24E]" />
                <span>{editingRider ? `Edit Rider: ${editingRider.name}` : 'Register Delivery Rider'}</span>
              </h3>
              <button
                type="button"
                onClick={() => {
                  setIsAddRiderModalOpen(false);
                  setEditingRider(null);
                  setRiderActionError(null);
                }}
                className="text-white/70 hover:text-white cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveRider} className="p-6 space-y-4">
              {riderActionError && (
                <div className="p-3 rounded-lg bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-start gap-2">
                  <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                  <span>{riderActionError}</span>
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-stone-700 mb-1">
                  Full Name *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Ramesh Kumar"
                  value={riderForm.fullName}
                  onChange={(e) => setRiderForm({ ...riderForm, fullName: e.target.value })}
                  className="w-full px-3 py-2 text-sm bg-[#FAF7F2] border border-[#D5C2AF] rounded-lg text-stone-900 focus:outline-[#801323]"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-stone-700 mb-1">
                  Contact Phone (10 digits) *
                </label>
                <input
                  type="tel"
                  required
                  placeholder="e.g. 9876543210"
                  value={riderForm.phone}
                  onChange={(e) => setRiderForm({ ...riderForm, phone: e.target.value })}
                  className="w-full px-3 py-2 text-sm bg-[#FAF7F2] border border-[#D5C2AF] rounded-lg text-stone-900 font-mono focus:outline-[#801323]"
                />
              </div>

              {!editingRider && (
                <>
                  <div>
                    <label className="block text-xs font-semibold text-stone-700 mb-1">
                      Login Email *
                    </label>
                    <input
                      type="email"
                      required
                      placeholder="rider@mantsabiryani.com"
                      value={riderForm.email}
                      onChange={(e) => setRiderForm({ ...riderForm, email: e.target.value })}
                      className="w-full px-3 py-2 text-sm bg-[#FAF7F2] border border-[#D5C2AF] rounded-lg text-stone-900 focus:outline-[#801323]"
                    />
                    <p className="text-[11px] text-stone-500 mt-1">
                      Used by rider to log in at the Delivery Rider Console.
                    </p>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-stone-700 mb-1">
                      Password (min 6 chars) *
                    </label>
                    <div className="relative">
                      <KeyRound className="w-4 h-4 text-stone-400 absolute left-3 top-1/2 -translate-y-1/2" />
                      <input
                        type="password"
                        required
                        minLength={6}
                        placeholder="••••••••"
                        value={riderForm.password}
                        onChange={(e) => setRiderForm({ ...riderForm, password: e.target.value })}
                        className="w-full pl-9 pr-3 py-2 text-sm bg-[#FAF7F2] border border-[#D5C2AF] rounded-lg text-stone-900 font-mono focus:outline-[#801323]"
                      />
                    </div>
                  </div>
                </>
              )}

              <div className="pt-3 flex items-center justify-end gap-3 border-t border-[#EAE2D6]">
                <button
                  type="button"
                  disabled={riderActionLoading}
                  onClick={() => {
                    setIsAddRiderModalOpen(false);
                    setEditingRider(null);
                  }}
                  className="px-4 py-2 text-xs font-semibold text-stone-600 hover:text-stone-900 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={riderActionLoading}
                  className="px-5 py-2 text-xs font-semibold uppercase tracking-wider text-white bg-[#801323] hover:bg-[#680E19] disabled:opacity-50 rounded-lg cursor-pointer flex items-center gap-1.5 shadow-xs"
                >
                  {riderActionLoading ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      <span>Saving...</span>
                    </>
                  ) : (
                    <span>{editingRider ? 'Update Profile' : 'Create Rider Account'}</span>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Confirmation Dialog for Destructive & State Actions */}
      {confirmingRiderAction && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-stone-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="relative w-full max-w-sm bg-white rounded-2xl shadow-2xl border border-[#EAE2D6] p-6 space-y-4">
            <div
              className={`w-12 h-12 rounded-full flex items-center justify-center mx-auto ${
                confirmingRiderAction.action === 'reactivate'
                  ? 'bg-emerald-100 text-emerald-700'
                  : 'bg-amber-100 text-amber-700'
              }`}
            >
              {confirmingRiderAction.action === 'reactivate' ? (
                <CheckCircle2 className="w-6 h-6" />
              ) : (
                <Power className="w-6 h-6" />
              )}
            </div>

            <div className="text-center space-y-1">
              <h3 className="font-serif text-lg font-bold text-stone-900">
                {confirmingRiderAction.action === 'reactivate'
                  ? `Reactivate Rider "${confirmingRiderAction.rider.name}"?`
                  : `Deactivate Rider "${confirmingRiderAction.rider.name}"?`}
              </h3>
              <p className="text-xs text-stone-600">
                {confirmingRiderAction.action === 'reactivate'
                  ? 'This restores the delivery role in Supabase profiles, enabling the rider to log into the Rider Console and receive new order assignments.'
                  : 'Deactivating revokes Rider Console access and blocks order assignments while safely preserving all order history and delivery audit logs.'}
              </p>
            </div>

            {riderActionError && (
              <div className="p-3 rounded-lg bg-rose-50 border border-rose-200 text-rose-800 text-xs">
                {riderActionError}
              </div>
            )}

            <div className="pt-2 flex items-center gap-3">
              <button
                type="button"
                disabled={riderActionLoading}
                onClick={() => {
                  setConfirmingRiderAction(null);
                  setRiderActionError(null);
                }}
                className="flex-1 py-2 text-xs font-semibold text-stone-700 bg-stone-100 hover:bg-stone-200 rounded-lg cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={riderActionLoading}
                onClick={handleExecuteRiderAction}
                className={`flex-1 py-2 text-xs font-semibold uppercase tracking-wider text-white rounded-lg cursor-pointer flex items-center justify-center gap-1.5 shadow-xs ${
                  confirmingRiderAction.action === 'reactivate'
                    ? 'bg-emerald-700 hover:bg-emerald-800'
                    : 'bg-amber-700 hover:bg-amber-800'
                }`}
              >
                {riderActionLoading ? (
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <span>
                    Confirm{' '}
                    {confirmingRiderAction.action === 'reactivate'
                      ? 'Reactivate'
                      : 'Deactivate'}
                  </span>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Supabase Server-side RPC Migration Modal */}
      {showRiderSqlModal && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-stone-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="relative w-full max-w-2xl bg-white rounded-2xl shadow-2xl border border-[#EAE2D6] overflow-hidden">
            <div className="p-5 bg-[#801323] text-white flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Database className="w-5 h-5 text-[#DFB24E]" />
                <h3 className="font-serif text-lg font-bold">
                  Rider Provisioning Server RPC Migration
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShowRiderSqlModal(false)}
                className="text-white/70 hover:text-white cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-4 text-xs text-stone-700">
              <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-amber-900">
                <p className="font-semibold mb-1">Architecture & Security Note:</p>
                <p>
                  The app automatically creates accounts safely in the browser using an isolated Supabase Auth client without overriding the admin session. For strict server-side provisioning where Auth users are created via a single transactional RPC call, execute this SQL script in your Supabase SQL Editor.
                </p>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <span className="font-bold text-stone-800 uppercase tracking-wider text-[11px]">
                    SQL Migration Script (PostgreSQL / Supabase):
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      const sqlScript = `-- ====================================================================
-- Mantasha Biryani House - Hardened Supabase Security Migration
-- Complies with PostgreSQL Row-Level Security & Role Access Standards
-- ====================================================================

-- 1. Hardened SECURITY DEFINER helper functions (SET search_path = '')
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role = 'admin'
  );
END;
$$;

REVOKE ALL ON FUNCTION public.is_admin() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_admin() TO authenticated;

CREATE OR REPLACE FUNCTION public.is_delivery_partner()
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role IN ('delivery', 'delivery_partner')
  );
END;
$$;

REVOKE ALL ON FUNCTION public.is_delivery_partner() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_delivery_partner() TO authenticated;

-- 2. Hardened admin query for delivery partners
CREATE OR REPLACE FUNCTION public.get_delivery_partners()
RETURNS TABLE (
  id UUID,
  full_name TEXT,
  phone TEXT,
  role public.user_role,
  created_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role = 'admin'
  ) THEN
    RAISE EXCEPTION 'Access denied: Admin role required.';
  END IF;

  RETURN QUERY
  SELECT p.id, p.full_name, p.phone, p.role, p.created_at
  FROM public.profiles p
  WHERE p.role IN ('delivery_partner', 'delivery')
  ORDER BY p.created_at DESC;
END;
$$;

REVOKE ALL ON FUNCTION public.get_delivery_partners() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_delivery_partners() TO authenticated;

-- 3. Database-side protection against column tampering and invalid status jumps
CREATE OR REPLACE FUNCTION public.enforce_order_update_security()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_is_admin BOOLEAN;
BEGIN
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role = 'admin'
  ) INTO v_is_admin;

  -- Admins can update all fields
  IF v_is_admin THEN
    RETURN NEW;
  END IF;

  -- Non-admin delivery partner restrictions:
  -- Block modification of protected financial and customer fields
  IF (OLD.id != NEW.id OR
      OLD.order_number != NEW.order_number OR
      OLD.customer_id IS DISTINCT FROM NEW.customer_id OR
      OLD.customer_name != NEW.customer_name OR
      OLD.customer_phone != NEW.customer_phone OR
      OLD.delivery_address != NEW.delivery_address OR
      OLD.subtotal != NEW.subtotal OR
      OLD.delivery_fee != NEW.delivery_fee OR
      OLD.packaging_fee != NEW.packaging_fee OR
      OLD.total_amount != NEW.total_amount OR
      OLD.payment_method != NEW.payment_method) THEN
    RAISE EXCEPTION 'Security violation: Riders are forbidden from modifying order items, amounts, or customer details.';
  END IF;

  -- Enforce valid rider status transitions:
  -- 1) pickup: -> out_for_delivery
  -- 2) delivery: out_for_delivery -> delivered
  IF (OLD.status != NEW.status) THEN
    IF NOT (
      (OLD.status IN ('ready_for_pickup', 'accepted', 'preparing') AND NEW.status = 'out_for_delivery') OR
      (OLD.status = 'out_for_delivery' AND NEW.status = 'delivered')
    ) THEN
      RAISE EXCEPTION 'Invalid status transition: Rider cannot transition status from % to %.', OLD.status, NEW.status;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_enforce_order_update_security ON public.orders;
CREATE TRIGGER trigger_enforce_order_update_security
  BEFORE UPDATE ON public.orders
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_order_update_security();`;
                      navigator.clipboard.writeText(sqlScript);
                      setCopiedSql(true);
                      setTimeout(() => setCopiedSql(false), 3000);
                    }}
                    className="px-2.5 py-1 text-xs font-semibold text-[#801323] bg-rose-50 hover:bg-rose-100 rounded border border-rose-200 transition-colors flex items-center gap-1 cursor-pointer"
                  >
                    {copiedSql ? (
                      <>
                        <Check className="w-3.5 h-3.5 text-emerald-600" />
                        <span className="text-emerald-700">Copied!</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3.5 h-3.5" />
                        <span>Copy SQL</span>
                      </>
                    )}
                  </button>
                </div>

                <pre className="p-3.5 bg-stone-900 text-stone-100 rounded-lg overflow-x-auto text-[11px] font-mono leading-relaxed max-h-64">
{`-- Hardened PostgreSQL SECURITY DEFINER Functions & Triggers
-- 1. Helper function with search_path = ''
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  RETURN EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin');
END;
$$;

-- 2. Trigger preventing unauthorized column updates & illegal status jumps
CREATE OR REPLACE FUNCTION public.enforce_order_update_security()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin') THEN
    RETURN NEW;
  END IF;
  IF (OLD.total_amount != NEW.total_amount OR OLD.subtotal != NEW.subtotal OR OLD.customer_phone != NEW.customer_phone) THEN
    RAISE EXCEPTION 'Riders cannot modify financial or customer details.';
  END IF;
  RETURN NEW;
END;
$$;`}
                </pre>
              </div>

              <div className="pt-3 flex justify-end border-t border-[#EAE2D6]">
                <button
                  type="button"
                  onClick={() => setShowRiderSqlModal(false)}
                  className="px-4 py-2 text-xs font-semibold text-white bg-[#801323] hover:bg-[#680E19] rounded-lg cursor-pointer"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
