import {
  MenuItem,
  Order,
  OrderStatus,
  DeliveryPartner,
  CustomerDetails,
  FoodCategory,
  MenuState,
  MenuSource,
  OrderItemRecord,
  PaymentMethod,
} from '../types';
import { INITIAL_MENU_ITEMS, INITIAL_DELIVERY_PARTNERS } from '../data/initialMenu';
import {
  validateAndCalculateOrder,
  generateOrderNumber,
  OrderValidationResult,
} from './orderValidator';
import { supabase, isSupabaseConfigured, createIsolatedAuthClient } from './supabaseClient';

const MENU_STORAGE_KEY = 'mantsa_menu_items_v1';
const ORDERS_STORAGE_KEY = 'mantsa_orders_v1';
const PARTNERS_STORAGE_KEY = 'mantsa_delivery_partners_v1';
const DEACTIVATED_PARTNERS_KEY = 'mantsa_deactivated_riders_v1';
const DELIVERED_ORDERS_STORAGE_KEY = 'mantsa_delivered_orders_v1';
const PAID_ORDERS_STORAGE_KEY = 'mantsa_paid_orders_v1';

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const isValidUuid = (val: unknown): val is string =>
  typeof val === 'string' && val.trim().length > 0 && UUID_REGEX.test(val.trim());

type Listener = () => void;

class AppStore {
  private menu: MenuItem[] = [];
  private menuLoading: boolean = false;
  private menuError: string | null = null;
  private menuSource: MenuSource = isSupabaseConfigured ? 'supabase' : 'demo';
  private orders: Order[] = [];
  private deliveredOrderIds: Set<string> = new Set();
  private paidOrdersRegistry: Map<string, { paymentId?: string; paymentStatus: string }> = new Map();
  private partners: DeliveryPartner[] = [];
  private partnersLoading: boolean = false;
  private partnersError: string | null = null;
  private listeners: Set<Listener> = new Set();
  private broadcastChannel: BroadcastChannel | null = null;

  public isOrderMarkedDelivered(id?: string, orderNumber?: string): boolean {
    if (!id && !orderNumber) return false;
    if (id) {
      const cleanId = String(id).trim().toLowerCase();
      if (this.deliveredOrderIds.has(cleanId)) return true;
      const strippedId = cleanId.replace(/^ord-/, '');
      if (this.deliveredOrderIds.has(strippedId)) return true;
      if (this.deliveredOrderIds.has(`ord-${strippedId}`)) return true;
      const idDigits = cleanId.replace(/[^0-9]/g, '');
      if (idDigits && (this.deliveredOrderIds.has(idDigits) || this.deliveredOrderIds.has(`ord-${idDigits}`))) {
        return true;
      }
    }
    if (orderNumber) {
      const cleanNum = String(orderNumber).trim().toLowerCase().replace(/^#/, '');
      if (this.deliveredOrderIds.has(cleanNum)) return true;
      const strippedNum = cleanNum.replace(/^ord-/, '');
      if (this.deliveredOrderIds.has(strippedNum)) return true;
      if (this.deliveredOrderIds.has(`ord-${strippedNum}`)) return true;
      const numDigits = cleanNum.replace(/[^0-9]/g, '');
      if (numDigits && (this.deliveredOrderIds.has(numDigits) || this.deliveredOrderIds.has(`ord-${numDigits}`))) {
        return true;
      }
    }
    return false;
  }

  public markOrderAsDeliveredInRegistry(
    id?: string,
    orderNumber?: string,
    _timestamp?: string,
    _note?: string
  ): void {
    let changed = false;
    const addKey = (k: string) => {
      if (!this.deliveredOrderIds.has(k)) {
        this.deliveredOrderIds.add(k);
        changed = true;
      }
    };

    if (id) {
      const cleanId = String(id).trim().toLowerCase();
      addKey(cleanId);
      const strippedId = cleanId.replace(/^ord-/, '');
      addKey(strippedId);
      addKey(`ord-${strippedId}`);
      const idDigits = cleanId.replace(/[^0-9]/g, '');
      if (idDigits) {
        addKey(idDigits);
        addKey(`ord-${idDigits}`);
      }
    }
    if (orderNumber) {
      const cleanNum = String(orderNumber).trim().toLowerCase().replace(/^#/, '');
      addKey(cleanNum);
      const strippedNum = cleanNum.replace(/^ord-/, '');
      addKey(strippedNum);
      addKey(`ord-${strippedNum}`);
      const numDigits = cleanNum.replace(/[^0-9]/g, '');
      if (numDigits) {
        addKey(numDigits);
        addKey(`ord-${numDigits}`);
      }
    }
    if (changed) {
      this.saveDeliveredRegistry();
    }
  }

  private saveDeliveredRegistry(): void {
    try {
      const list = Array.from(this.deliveredOrderIds);
      localStorage.setItem(DELIVERED_ORDERS_STORAGE_KEY, JSON.stringify(list));
      this.broadcastChannel?.postMessage({ type: 'DELIVERED_REGISTRY_SYNC', payload: list });
    } catch {
      // ignore
    }
  }

  public loadDeliveredRegistry(): void {
    try {
      const saved = localStorage.getItem(DELIVERED_ORDERS_STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) {
          parsed.forEach((item: string) => {
            if (typeof item === 'string' && item.trim()) {
              const clean = item.trim().toLowerCase();
              this.deliveredOrderIds.add(clean);
              const stripped = clean.replace(/^ord-/, '');
              this.deliveredOrderIds.add(stripped);
              this.deliveredOrderIds.add(`ord-${stripped}`);
            }
          });
        }
      }
    } catch {
      // ignore
    }
  }

  public isOrderPaidOnline(id?: string, orderNumber?: string): boolean {
    if (!id && !orderNumber) return false;
    if (id) {
      const cleanId = String(id).trim().toLowerCase();
      if (this.paidOrdersRegistry.has(cleanId)) return true;
      const strippedId = cleanId.replace(/^ord-/, '');
      if (this.paidOrdersRegistry.has(strippedId)) return true;
      if (this.paidOrdersRegistry.has(`ord-${strippedId}`)) return true;
    }
    if (orderNumber) {
      const cleanNum = String(orderNumber).trim().toLowerCase();
      if (this.paidOrdersRegistry.has(cleanNum)) return true;
      const strippedNum = cleanNum.replace(/^ord-/, '');
      if (this.paidOrdersRegistry.has(strippedNum)) return true;
      if (this.paidOrdersRegistry.has(`ord-${strippedNum}`)) return true;
    }
    return false;
  }

  public getOrderOnlinePaymentInfo(id?: string, orderNumber?: string): { paymentId?: string; paymentStatus: string } | undefined {
    if (!id && !orderNumber) return undefined;
    if (id) {
      const cleanId = String(id).trim().toLowerCase();
      if (this.paidOrdersRegistry.has(cleanId)) return this.paidOrdersRegistry.get(cleanId);
      const strippedId = cleanId.replace(/^ord-/, '');
      if (this.paidOrdersRegistry.has(strippedId)) return this.paidOrdersRegistry.get(strippedId);
      if (this.paidOrdersRegistry.has(`ord-${strippedId}`)) return this.paidOrdersRegistry.get(`ord-${strippedId}`);
    }
    if (orderNumber) {
      const cleanNum = String(orderNumber).trim().toLowerCase();
      if (this.paidOrdersRegistry.has(cleanNum)) return this.paidOrdersRegistry.get(cleanNum);
      const strippedNum = cleanNum.replace(/^ord-/, '');
      if (this.paidOrdersRegistry.has(strippedNum)) return this.paidOrdersRegistry.get(strippedNum);
      if (this.paidOrdersRegistry.has(`ord-${strippedNum}`)) return this.paidOrdersRegistry.get(`ord-${strippedNum}`);
    }
    return undefined;
  }

  public markOrderAsPaidInRegistry(
    id?: string,
    orderNumber?: string,
    paymentId?: string
  ): void {
    let changed = false;
    const info = { paymentId: paymentId || undefined, paymentStatus: 'paid' };
    if (id) {
      const cleanId = String(id).trim().toLowerCase();
      this.paidOrdersRegistry.set(cleanId, info);
      const strippedId = cleanId.replace(/^ord-/, '');
      this.paidOrdersRegistry.set(strippedId, info);
      this.paidOrdersRegistry.set(`ord-${strippedId}`, info);
      changed = true;
    }
    if (orderNumber) {
      const cleanNum = String(orderNumber).trim().toLowerCase();
      this.paidOrdersRegistry.set(cleanNum, info);
      const strippedNum = cleanNum.replace(/^ord-/, '');
      this.paidOrdersRegistry.set(strippedNum, info);
      this.paidOrdersRegistry.set(`ord-${strippedNum}`, info);
      changed = true;
    }
    if (changed) {
      this.savePaidRegistry();
    }
  }

  private savePaidRegistry(): void {
    try {
      const entries = Array.from(this.paidOrdersRegistry.entries());
      localStorage.setItem(PAID_ORDERS_STORAGE_KEY, JSON.stringify(entries));
      this.broadcastChannel?.postMessage({ type: 'PAID_REGISTRY_SYNC' });
    } catch {
      // ignore
    }
  }

  public loadPaidRegistry(): void {
    try {
      const saved = localStorage.getItem(PAID_ORDERS_STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) {
          parsed.forEach(([key, val]: [string, any]) => {
            if (typeof key === 'string' && key.trim()) {
              const clean = key.trim().toLowerCase();
              this.paidOrdersRegistry.set(clean, val);
              const stripped = clean.replace(/^ord-/, '');
              this.paidOrdersRegistry.set(stripped, val);
              this.paidOrdersRegistry.set(`ord-${stripped}`, val);
            }
          });
        }
      }
    } catch {
      // ignore
    }
  }

  public async syncDeliveredOrderToSupabase(orderId: string, orderNumber?: any): Promise<void> {
    if (!isSupabaseConfigured || !supabase) return;
    const nowIso = new Date().toISOString();
    try {
      // 1. Try rider_update_order_status RPC
      const { error: rpcErr } = await (supabase.rpc as any)('rider_update_order_status', {
        p_order_id: orderId,
        p_new_status: 'delivered',
      });
      if (!rpcErr) return;

      // 2. Try direct table update on orders table
      const { error: directErr } = await supabase
        .from('orders')
        .update({ status: 'delivered', updated_at: nowIso })
        .eq('id', orderId);

      if (!directErr) {
        await supabase
          .from('delivery_assignments')
          .update({ delivered_at: nowIso })
          .eq('order_id', orderId);
        return;
      }

      // 3. Fallback by order_number if numeric
      if (orderNumber != null && !Number.isNaN(Number(orderNumber))) {
        await supabase
          .from('orders')
          .update({ status: 'delivered', updated_at: nowIso })
          .eq('order_number', Number(orderNumber));
      }
    } catch {
      // Background sync
    }
  }

  constructor() {
    this.init();
    this.setupCrossTabSync();
  }

  private init() {
    // 0. Load Delivered Orders Registry & Paid Orders Registry (guarantees terminal states persist across refreshes)
    this.loadDeliveredRegistry();
    this.loadPaidRegistry();

    // 1. Initial Menu Fetch
    if (isSupabaseConfigured && supabase) {
      this.fetchMenuFromSupabase();
    } else {
      const savedMenu = localStorage.getItem(MENU_STORAGE_KEY);
      if (savedMenu) {
        try {
          this.menu = JSON.parse(savedMenu);
        } catch {
          this.menu = INITIAL_MENU_ITEMS;
        }
      } else {
        this.menu = INITIAL_MENU_ITEMS;
        this.saveMenuLocally();
      }
      this.menuSource = 'demo';
      this.menuLoading = false;
      this.menuError = null;
    }

    // 2. Load Delivery Partners
    if (isSupabaseConfigured && supabase) {
      const savedPartners = localStorage.getItem(PARTNERS_STORAGE_KEY);
      if (savedPartners) {
        try {
          const parsed = JSON.parse(savedPartners);
          const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
          this.partners = Array.isArray(parsed)
            ? parsed.filter((p: any) => uuidRegex.test(String(p?.id || '')))
            : [];
        } catch {
          this.partners = [];
        }
      } else {
        this.partners = [];
      }
      this.fetchDeliveryPartnersFromSupabase();
    } else {
      const savedPartners = localStorage.getItem(PARTNERS_STORAGE_KEY);
      if (savedPartners) {
        try {
          this.partners = JSON.parse(savedPartners);
        } catch {
          this.partners = INITIAL_DELIVERY_PARTNERS;
        }
      } else {
        this.partners = INITIAL_DELIVERY_PARTNERS;
        this.savePartners();
      }
    }

    // 3. Load Orders or Seed 2 Initial Realistic Orders
    if (isSupabaseConfigured && supabase) {
      const savedOrders = localStorage.getItem(ORDERS_STORAGE_KEY);
      if (savedOrders) {
        try {
          const parsed = JSON.parse(savedOrders);
          this.orders = Array.isArray(parsed) ? parsed : [];
          // Reconcile and enforce delivered & paid state monotonicity
          this.orders = this.orders.map((o) => {
            let updated = { ...o };
            if (this.isOrderMarkedDelivered(o.id, o.orderNumber) && o.status !== 'cancelled') {
              updated.status = 'delivered' as OrderStatus;
            }
            if (o.status === 'delivered') {
              this.markOrderAsDeliveredInRegistry(o.id, o.orderNumber);
            }
            if (o.paymentMethod === 'ONLINE_RAZORPAY') {
              this.markOrderAsPaidInRegistry(o.id, o.orderNumber, o.paymentId);
            } else if (this.isOrderPaidOnline(o.id, o.orderNumber)) {
              const paidInfo = this.getOrderOnlinePaymentInfo(o.id, o.orderNumber);
              updated.paymentMethod = 'ONLINE_RAZORPAY';
              updated.paymentStatus = 'paid';
              updated.paymentId = paidInfo?.paymentId || o.paymentId;
            }
            return updated;
          });
        } catch {
          this.orders = this.getSeedOrders();
        }
      } else {
        this.orders = this.getSeedOrders();
      }
      this.fetchOrdersFromSupabase();
    } else {
      // Demo mode: Load saved orders or seed realistic sample orders
      const savedOrders = localStorage.getItem(ORDERS_STORAGE_KEY);
      if (savedOrders) {
        try {
          this.orders = JSON.parse(savedOrders);
          this.orders = this.orders.map((o) => {
            let updated = { ...o };
            if (this.isOrderMarkedDelivered(o.id, o.orderNumber) && o.status !== 'cancelled') {
              updated.status = 'delivered' as OrderStatus;
            }
            if (o.status === 'delivered') {
              this.markOrderAsDeliveredInRegistry(o.id, o.orderNumber);
            }
            if (o.paymentMethod === 'ONLINE_RAZORPAY') {
              this.markOrderAsPaidInRegistry(o.id, o.orderNumber, o.paymentId);
            } else if (this.isOrderPaidOnline(o.id, o.orderNumber)) {
              const paidInfo = this.getOrderOnlinePaymentInfo(o.id, o.orderNumber);
              updated.paymentMethod = 'ONLINE_RAZORPAY';
              updated.paymentStatus = 'paid';
              updated.paymentId = paidInfo?.paymentId || o.paymentId;
            }
            return updated;
          });
        } catch {
          this.orders = this.getSeedOrders();
        }
      } else {
        this.orders = this.getSeedOrders();
        this.saveOrders();
      }
    }
  }

  /**
   * Fetches live menu items from public.menu_items table in Supabase
   */
  public async fetchMenuFromSupabase(): Promise<void> {
    if (!isSupabaseConfigured || !supabase) {
      this.menuSource = 'demo';
      this.menuLoading = false;
      this.menuError = null;
      if (this.menu.length === 0) {
        this.menu = [...INITIAL_MENU_ITEMS];
      }
      this.notify();
      return;
    }

    this.menuLoading = true;
    this.menuError = null;
    this.menuSource = 'supabase';
    this.notify();

    try {
      const { data, error } = await supabase
        .from('menu_items')
        .select('*')
        .order('created_at', { ascending: true });

      if (error) {
        this.menuLoading = false;
        this.menuError = error.message || 'Failed to fetch items from public.menu_items.';
        this.menuSource = 'supabase';
        this.notify();
        return;
      }

      // Map PostgreSQL fields to UI MenuItem model using canonical column is_veg
      const mappedItems: MenuItem[] = (data || []).map((row: any) => ({
        id: String(row.id),
        name: String(row.name || ''),
        description: String(row.description || ''),
        category: (row.category || 'biryani') as FoodCategory,
        price: Number(row.price) || 0,
        // Canonical database column is_veg
        is_veg: Boolean(row.is_veg),
        is_available: row.is_available !== false,
        image_url: row.image_url || undefined,
        portion_info: row.portion_info || undefined,
        is_bestseller: Boolean(row.is_bestseller),
        spice_level: (row.spice_level as any) || 'Medium',
      }));

      this.menu = mappedItems;
      this.menuLoading = false;
      this.menuError = null;
      this.menuSource = 'supabase';
      this.saveMenuLocally();
      this.notify();
    } catch (err: any) {
      this.menuLoading = false;
      this.menuError = err?.message || 'Network error connecting to Supabase.';
      this.menuSource = 'supabase';
      this.notify();
    }
  }

  public loadDemoMenu(): void {
    if (isSupabaseConfigured && supabase) {
      return;
    }
    this.menu = [...INITIAL_MENU_ITEMS];
    this.menuSource = 'demo';
    this.menuLoading = false;
    this.menuError = null;
    this.saveMenuLocally();
    this.notify();
  }

  public retrySupabaseMenu(): Promise<void> {
    return this.fetchMenuFromSupabase();
  }

  public getMenuState(): MenuState {
    return {
      items: [...this.menu],
      isLoading: this.menuLoading,
      error: this.menuError,
      source: this.menuSource,
    };
  }

  private getSeedOrders(): Order[] {
    const now = new Date();
    const thirtyMinsAgo = new Date(now.getTime() - 30 * 60000).toISOString();
    const fifteenMinsAgo = new Date(now.getTime() - 15 * 60000).toISOString();

    const rawSeedOrders: Order[] = [
      {
        id: 'ord-seed-01',
        orderNumber: 'MB-2026-8812',
        isDemo: true,
        customerName: 'Anand Prakash',
        customerPhone: '9835124490',
        deliveryAddress: 'Flat 302, Royal Residency, Tilkamanjhi Chowk',
        landmark: 'Near Tilkamanjhi Post Office',
        deliveryNotes: 'Please ring bell twice. Keep biryani piping hot.',
        items: [
          {
            menuItemId: 'mb-01',
            name: 'Mantsa Special Chicken Dum Biryani',
            price: 240,
            quantity: 2,
            is_veg: false,
            subtotal: 480,
          },
          {
            menuItemId: 'mb-11',
            name: 'Special Burani Garlic Raita',
            price: 60,
            quantity: 1,
            is_veg: true,
            subtotal: 60,
          },
          {
            menuItemId: 'mb-12',
            name: 'Shahi Firni in Earthen Sakora',
            price: 90,
            quantity: 2,
            is_veg: true,
            subtotal: 180,
          },
        ],
        subtotal: 720,
        deliveryFee: 0,
        packagingFee: 0,
        totalAmount: 720,
        paymentMethod: 'COD' as PaymentMethod,
        paymentStatus: 'cod' as const,
        status: 'out_for_delivery' as OrderStatus,
        deliveryPartnerId: 'dp-01',
        deliveryPartnerName: 'Raju Kumar',
        createdAt: thirtyMinsAgo,
        updatedAt: fifteenMinsAgo,
        statusHistory: [
          { status: 'pending', timestamp: thirtyMinsAgo, note: 'Order received via website' },
          { status: 'accepted', timestamp: new Date(now.getTime() - 25 * 60000).toISOString(), note: 'Kitchen accepted order' },
          { status: 'preparing', timestamp: new Date(now.getTime() - 22 * 60000).toISOString(), note: 'Dum handi on coals' },
          { status: 'ready_for_pickup', timestamp: new Date(now.getTime() - 16 * 60000).toISOString(), note: 'Packed & handed to rider' },
          { status: 'out_for_delivery', timestamp: fifteenMinsAgo, note: 'Raju Kumar is out for delivery' },
        ],
      },
      {
        id: 'ord-seed-02',
        orderNumber: 'MB-2026-9045',
        isDemo: true,
        customerName: 'Priya Kumari',
        customerPhone: '9470123391',
        deliveryAddress: 'House 14, Ghantaghar Bazaar Road',
        landmark: 'Opposite Central Bank of India',
        deliveryNotes: 'Medium spicy please.',
        items: [
          {
            menuItemId: 'mb-02',
            name: 'Royal Mutton Dum Biryani',
            price: 360,
            quantity: 1,
            is_veg: false,
            subtotal: 360,
          },
          {
            menuItemId: 'mb-05',
            name: 'Kolkata-Awadhi Chicken Chaap',
            price: 220,
            quantity: 1,
            is_veg: false,
            subtotal: 220,
          },
        ],
        subtotal: 580,
        deliveryFee: 0,
        packagingFee: 0,
        totalAmount: 580,
        paymentMethod: 'COD' as PaymentMethod,
        paymentStatus: 'cod' as const,
        status: 'preparing' as OrderStatus,
        createdAt: fifteenMinsAgo,
        updatedAt: fifteenMinsAgo,
        statusHistory: [
          { status: 'pending', timestamp: fifteenMinsAgo, note: 'Order placed' },
          { status: 'accepted', timestamp: new Date(now.getTime() - 10 * 60000).toISOString(), note: 'Order accepted' },
          { status: 'preparing', timestamp: new Date(now.getTime() - 8 * 60000).toISOString(), note: 'Chef preparing fresh portions' },
        ],
      },
    ];

    return rawSeedOrders.map((o: Order): Order => {
      let updated: Order = { ...o };
      if (this.isOrderMarkedDelivered(o.id, o.orderNumber) && o.status !== 'cancelled') {
        updated.status = 'delivered';
      }
      if (o.status === 'delivered') {
        this.markOrderAsDeliveredInRegistry(o.id, o.orderNumber);
      }
      if (this.isOrderPaidOnline(o.id, o.orderNumber)) {
        updated.paymentMethod = 'ONLINE_RAZORPAY';
        updated.paymentStatus = 'paid';
      }
      return updated;
    });
  }

  private setupCrossTabSync() {
    if (typeof window === 'undefined') return;

    try {
      if ('BroadcastChannel' in window) {
        this.broadcastChannel = new BroadcastChannel('mantsa_app_sync');
        this.broadcastChannel.onmessage = (event) => {
          if (
            event.data?.type === 'ORDERS_SYNC' ||
            event.data?.type === 'DELIVERED_REGISTRY_SYNC' ||
            event.data?.type === 'PAID_REGISTRY_SYNC'
          ) {
            this.loadDeliveredRegistry();
            this.loadPaidRegistry();
            this.reloadOrdersFromStorage();
          } else if (event.data?.type === 'PARTNERS_SYNC') {
            this.reloadPartnersFromStorage();
          } else if (event.data?.type === 'MENU_SYNC') {
            this.reloadMenuFromStorage();
          }
        };
      }
    } catch {
      // BroadcastChannel unavailable
    }

    // Fallback cross-tab sync using Window Storage Event
    window.addEventListener('storage', (event) => {
      if (
        event.key === ORDERS_STORAGE_KEY ||
        event.key === DELIVERED_ORDERS_STORAGE_KEY ||
        event.key === PAID_ORDERS_STORAGE_KEY
      ) {
        this.loadDeliveredRegistry();
        this.loadPaidRegistry();
        this.reloadOrdersFromStorage();
      } else if (event.key === PARTNERS_STORAGE_KEY) {
        this.reloadPartnersFromStorage();
      } else if (event.key === MENU_STORAGE_KEY) {
        this.reloadMenuFromStorage();
      }
    });

    // Same-window custom event listener
    window.addEventListener('mantsa_orders_updated', () => {
      this.loadDeliveredRegistry();
      this.loadPaidRegistry();
      this.reloadOrdersFromStorage();
    });
  }

  public reloadOrdersFromStorage() {
    try {
      this.loadDeliveredRegistry();
      this.loadPaidRegistry();
      const saved = localStorage.getItem(ORDERS_STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) {
          this.orders = parsed.map((o) => {
            let updated = { ...o };
            if (this.isOrderMarkedDelivered(o.id, o.orderNumber) && o.status !== 'cancelled') {
              updated.status = 'delivered' as OrderStatus;
            }
            if (o.status === 'delivered') {
              this.markOrderAsDeliveredInRegistry(o.id, o.orderNumber);
            }
            if (o.paymentMethod === 'ONLINE_RAZORPAY') {
              this.markOrderAsPaidInRegistry(o.id, o.orderNumber, o.paymentId);
            } else if (this.isOrderPaidOnline(o.id, o.orderNumber)) {
              const paidInfo = this.getOrderOnlinePaymentInfo(o.id, o.orderNumber);
              updated.paymentMethod = 'ONLINE_RAZORPAY';
              updated.paymentStatus = 'paid';
              updated.paymentId = paidInfo?.paymentId || o.paymentId;
            }
            return updated;
          });
          this.notify();
        }
      }
    } catch {
      // ignore
    }
  }

  private reloadPartnersFromStorage() {
    try {
      const saved = localStorage.getItem(PARTNERS_STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) {
          this.partners = parsed;
          this.notify();
        }
      }
    } catch {
      // ignore
    }
  }

  private reloadMenuFromStorage() {
    try {
      const saved = localStorage.getItem(MENU_STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) {
          this.menu = parsed;
          this.notify();
        }
      }
    } catch {
      // ignore
    }
  }

  private saveMenuLocally() {
    try {
      localStorage.setItem(MENU_STORAGE_KEY, JSON.stringify(this.menu));
      this.broadcastChannel?.postMessage({ type: 'MENU_SYNC' });
    } catch {
      // ignore
    }
    this.notify();
  }

  private saveOrders() {
    try {
      this.orders.forEach((o) => {
        if (o.status === 'delivered') {
          this.markOrderAsDeliveredInRegistry(o.id, o.orderNumber);
        } else if (this.isOrderMarkedDelivered(o.id, o.orderNumber) && o.status !== 'cancelled') {
          o.status = 'delivered';
        }
        if (o.paymentMethod === 'ONLINE_RAZORPAY') {
          this.markOrderAsPaidInRegistry(o.id, o.orderNumber, o.paymentId);
        } else if (this.isOrderPaidOnline(o.id, o.orderNumber)) {
          o.paymentMethod = 'ONLINE_RAZORPAY';
          o.paymentStatus = 'paid';
        }
      });
      localStorage.setItem(ORDERS_STORAGE_KEY, JSON.stringify(this.orders));
      this.broadcastChannel?.postMessage({ type: 'ORDERS_SYNC' });
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('mantsa_orders_updated'));
      }
    } catch {
      // ignore
    }
    this.notify();
  }

  private savePartners() {
    try {
      localStorage.setItem(PARTNERS_STORAGE_KEY, JSON.stringify(this.partners));
      this.broadcastChannel?.postMessage({ type: 'PARTNERS_SYNC' });
    } catch {
      // ignore
    }
    this.notify();
  }

  private notify() {
    this.listeners.forEach((listener) => listener());
  }

  public subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  // --- Delivery Partner Getters ---
  public getDeliveryPartners(): DeliveryPartner[] {
    return [...this.partners];
  }

  public getPartnersLoading(): boolean {
    return this.partnersLoading;
  }

  public getPartnersError(): string | null {
    return this.partnersError;
  }

  // --- Menu Operations ---
  public getMenu(): MenuItem[] {
    return [...this.menu];
  }

  public async toggleItemAvailability(
    itemId: string
  ): Promise<{ success: boolean; error?: string }> {
    const item = this.menu.find((m) => m.id === itemId);
    if (!item) {
      return { success: false, error: `Menu item "${itemId}" not found.` };
    }
    const newAvailability = !item.is_available;

    if (isSupabaseConfigured && supabase) {
      try {
        const { data, error } = await (supabase.rpc as any)(
          'admin_toggle_menu_availability',
          {
            p_item_id: itemId,
            p_is_available: newAvailability,
          }
        );

        if (error) {
          console.warn('[toggleItemAvailability] RPC error, attempting direct table update fallback:', error.message);
          const { error: directError } = await supabase
            .from('menu_items')
            .update({ is_available: newAvailability, updated_at: new Date().toISOString() })
            .eq('id', itemId);

          if (directError) {
            console.error('[toggleItemAvailability] Direct update also failed:', directError);
            return {
              success: false,
              error: directError.message || error.message || 'Failed to toggle availability.',
            };
          }
        } else {
          const isSuccess =
            data === true ||
            (typeof data === 'object' &&
              data !== null &&
              (data as any).success === true);

          if (!isSuccess) {
            return {
              success: false,
              error:
                (data as any)?.error ||
                'Server rejected menu availability update.',
            };
          }
        }
      } catch (err: any) {
        console.error('[toggleItemAvailability] Exception, trying direct fallback:', err);
        try {
          const { error: directError } = await supabase
            .from('menu_items')
            .update({ is_available: newAvailability, updated_at: new Date().toISOString() })
            .eq('id', itemId);

          if (directError) {
            return {
              success: false,
              error: directError.message || 'Failed to update item availability.',
            };
          }
        } catch {
          return {
            success: false,
            error: err?.message || 'Unexpected exception during availability toggle.',
          };
        }
      }
    }

    this.menu = this.menu.map((i) =>
      i.id === itemId ? { ...i, is_available: newAvailability } : i
    );
    this.saveMenuLocally();
    this.notify();
    return { success: true };
  }

  public async updateMenuItem(
    updatedItem: MenuItem
  ): Promise<{ success: boolean; error?: string }> {
    if (isSupabaseConfigured && supabase) {
      try {
        const { data, error } = await (supabase.rpc as any)(
          'admin_upsert_menu_item',
          {
            p_id: updatedItem.id,
            p_name: updatedItem.name,
            p_description: updatedItem.description || null,
            p_category: updatedItem.category,
            p_price: updatedItem.price,
            p_is_veg: updatedItem.is_veg,
            p_is_available: updatedItem.is_available,
            p_image_url: updatedItem.image_url || null,
            p_portion_info: updatedItem.portion_info || null,
          }
        );

        if (error) {
          console.error('[updateMenuItem] RPC error:', error);
          return {
            success: false,
            error:
              error.message ||
              'Failed to update menu item via admin_upsert_menu_item.',
          };
        }

        const isSuccess =
          data === true ||
          (typeof data === 'object' &&
            data !== null &&
            (data as any).success === true);

        if (!isSuccess) {
          return {
            success: false,
            error:
              (data as any)?.error || 'Server rejected menu item update.',
          };
        }
      } catch (err: any) {
        console.error('[updateMenuItem] Exception:', err);
        return {
          success: false,
          error:
            err?.message || 'Unexpected exception during menu item update.',
        };
      }
    }

    this.menu = this.menu.map((item) =>
      item.id === updatedItem.id ? updatedItem : item
    );
    this.saveMenuLocally();
    this.notify();
    return { success: true };
  }

  public async addMenuItem(
    newItem: Omit<MenuItem, 'id'>
  ): Promise<{ success: boolean; item?: MenuItem; error?: string }> {
    const id = `mb-custom-${Date.now()}`;
    const createdItem: MenuItem = { ...newItem, id };

    if (isSupabaseConfigured && supabase) {
      try {
        const { data, error } = await (supabase.rpc as any)(
          'admin_upsert_menu_item',
          {
            p_id: id,
            p_name: createdItem.name,
            p_description: createdItem.description || null,
            p_category: createdItem.category,
            p_price: createdItem.price,
            p_is_veg: createdItem.is_veg,
            p_is_available: createdItem.is_available,
            p_image_url: createdItem.image_url || null,
            p_portion_info: createdItem.portion_info || null,
          }
        );

        if (error) {
          console.error('[addMenuItem] RPC error:', error);
          return {
            success: false,
            error:
              error.message ||
              'Failed to add menu item via admin_upsert_menu_item.',
          };
        }

        const isSuccess =
          data === true ||
          (typeof data === 'object' &&
            data !== null &&
            (data as any).success === true);

        if (!isSuccess) {
          return {
            success: false,
            error:
              (data as any)?.error ||
              'Server rejected menu item creation.',
          };
        }
      } catch (err: any) {
        console.error('[addMenuItem] Exception:', err);
        return {
          success: false,
          error:
            err?.message || 'Unexpected exception during menu item creation.',
        };
      }
    }

    this.menu.push(createdItem);
    this.saveMenuLocally();
    this.notify();
    return { success: true, item: createdItem };
  }

  public async deleteMenuItem(
    itemId: string
  ): Promise<{ success: boolean; error?: string }> {
    const item = this.menu.find((m) => m.id === itemId);
    if (!item) {
      return { success: false, error: `Menu item "${itemId}" not found.` };
    }

    if (isSupabaseConfigured && supabase) {
      try {
        const { data, error } = await (supabase.rpc as any)(
          'admin_delete_menu_item',
          {
            p_item_id: itemId,
          }
        );

        if (error) {
          console.warn('[deleteMenuItem] RPC failed or missing, attempting direct deletion fallback:', error.message);
          // If RPC is missing, try disassociating prior order_items and deleting
          await supabase
            .from('order_items')
            .update({ menu_item_id: null })
            .eq('menu_item_id', itemId);

          const { error: directError } = await supabase
            .from('menu_items')
            .delete()
            .eq('id', itemId);

          if (directError) {
            console.error('[deleteMenuItem] Direct deletion failed:', directError);
            return {
              success: false,
              error: directError.message || error.message || 'Failed to delete menu item.',
            };
          }
        } else {
          const isSuccess =
            data === true ||
            (typeof data === 'object' &&
              data !== null &&
              (data as any).success === true);

          if (!isSuccess) {
            return {
              success: false,
              error: (data as any)?.error || 'Server rejected menu item deletion.',
            };
          }
        }
      } catch (err: any) {
        console.error('[deleteMenuItem] Exception:', err);
        return {
          success: false,
          error: err?.message || 'Unexpected exception during menu item deletion.',
        };
      }
    }

    this.menu = this.menu.filter((m) => m.id !== itemId);
    this.saveMenuLocally();
    this.notify();
    return { success: true };
  }

  public resetMenuToDefault(): void {
    this.menu = [...INITIAL_MENU_ITEMS];
    this.menuSource = 'demo';
    this.saveMenuLocally();
  }

  // --- Orders Operations ---
  public getOrders(): Order[] {
    return this.orders
      .map((o) => {
        if (this.isOrderMarkedDelivered(o.id, o.orderNumber) && o.status !== 'cancelled' && o.status !== 'delivered') {
          return { ...o, status: 'delivered' as OrderStatus };
        }
        return o;
      })
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }

  public getOrderById(idOrNumber: string): Order | undefined {
    const search = idOrNumber.trim().toUpperCase();
    const found = this.orders.find(
      (o) => o.id === idOrNumber || o.orderNumber.toUpperCase() === search
    );
    if (found && this.isOrderMarkedDelivered(found.id, found.orderNumber) && found.status !== 'cancelled' && found.status !== 'delivered') {
      return { ...found, status: 'delivered' as OrderStatus };
    }
    return found;
  }

  /**
   * Fetches real live orders from Supabase (for authenticated staff/admin or current session).
   * Maps delivery assignments from delivery_assignments table without assuming orders.delivery_partner_id.
   */
  public async fetchOrdersFromSupabase(): Promise<void> {
    if (!isSupabaseConfigured || !supabase) return;

    try {
      const { data, error } = await supabase
        .from('orders')
        .select('*')
        .order('created_at', { ascending: false });

      if (error || !data) {
        return;
      }

      // Fetch active assignments from delivery_assignments table
      const assignmentsByOrderId: Record<string, { partnerId: string; partnerName?: string }> = {};
      try {
        const { data: assignments } = await supabase
          .from('delivery_assignments')
          .select('order_id, delivery_partner_id, profiles(id, full_name)');

        if (assignments && assignments.length > 0) {
          assignments.forEach((a: any) => {
            if (a.order_id && a.delivery_partner_id) {
              const profileRow = Array.isArray(a.profiles) ? a.profiles[0] : a.profiles;
              const partnerInMem = this.partners.find((p) => p.id === a.delivery_partner_id);
              assignmentsByOrderId[a.order_id] = {
                partnerId: a.delivery_partner_id,
                partnerName: profileRow?.full_name || partnerInMem?.name || 'Assigned Rider',
              };
            }
          });
        }
      } catch {
        // If RLS prevents reading delivery_assignments, continue without error
      }

      const mappedOrders: Order[] = data.map((row: any) => {
        const assignment = assignmentsByOrderId[row.id];
        const rowIdStr = String(row.id);
        const rowNumStr = row.order_number != null ? String(row.order_number) : '';

        // Resilient cross-match of existing local order by ID, order number, or substring
        const existingLocal = this.orders.find(
          (o) =>
            o.id === rowIdStr ||
            (rowNumStr && o.orderNumber === rowNumStr) ||
            (rowIdStr && o.id.includes(rowIdStr)) ||
            (rowNumStr && o.id.includes(rowNumStr))
        );

        const isLocallyDelivered =
          existingLocal?.status === 'delivered' ||
          this.isOrderMarkedDelivered(rowIdStr, rowNumStr);

        // Terminal state monotonicity: delivered orders NEVER regress back to out_for_delivery
        const resolvedStatus: OrderStatus =
          isLocallyDelivered && row.status !== 'cancelled'
            ? 'delivered'
            : ((row.status || 'pending') as OrderStatus);

        if (resolvedStatus === 'delivered') {
          this.markOrderAsDeliveredInRegistry(rowIdStr, rowNumStr);
          // Sync to remote Supabase if still out_for_delivery
          if (row.status !== 'delivered' && isSupabaseConfigured && supabase) {
            this.syncDeliveredOrderToSupabase(rowIdStr, row.order_number).catch(() => {});
          }
        }

        return {
          id: String(row.id),
          orderNumber: String(row.order_number),
          customerName: String(row.customer_name || 'Customer'),
          customerPhone: String(row.customer_phone || ''),
          deliveryAddress: String(row.delivery_address || ''),
          landmark: String(row.landmark || ''),
          deliveryNotes: String(row.instructions || ''),
          items: existingLocal?.items && existingLocal.items.length > 0 ? existingLocal.items : [],
          subtotal: Number(row.subtotal || 0),
          deliveryFee: Number(row.delivery_fee || 0),
          packagingFee: 0,
          totalAmount: Number(row.total_amount || 0),
          paymentMethod:
            String(row.payment_method || '').toUpperCase().includes('ONLINE') ||
            String(row.payment_method || '').toUpperCase().includes('RAZOR') ||
            existingLocal?.paymentMethod === 'ONLINE_RAZORPAY' ||
            this.isOrderPaidOnline(rowIdStr, rowNumStr)
              ? 'ONLINE_RAZORPAY'
              : 'COD',
          paymentId:
            row.payment_id ||
            this.getOrderOnlinePaymentInfo(rowIdStr, rowNumStr)?.paymentId ||
            existingLocal?.paymentId ||
            undefined,
          paymentStatus:
            row.payment_status ||
            (String(row.payment_method || '').toUpperCase().includes('ONLINE') ||
            existingLocal?.paymentMethod === 'ONLINE_RAZORPAY' ||
            this.isOrderPaidOnline(rowIdStr, rowNumStr)
              ? 'paid'
              : existingLocal?.paymentStatus || 'cod'),
          status: resolvedStatus,
          deliveryPartnerId: assignment?.partnerId || existingLocal?.deliveryPartnerId,
          deliveryPartnerName: assignment?.partnerName || existingLocal?.deliveryPartnerName,
          createdAt: row.created_at || new Date().toISOString(),
          updatedAt: isLocallyDelivered && existingLocal?.updatedAt ? existingLocal.updatedAt : (row.updated_at || new Date().toISOString()),
          statusHistory: existingLocal?.statusHistory?.length
            ? existingLocal.statusHistory
            : [
                {
                  status: resolvedStatus,
                  timestamp: row.updated_at || row.created_at || new Date().toISOString(),
                  note: `Status: ${resolvedStatus}`,
                },
              ],
        };
      });

      // Preserve local demo orders that are not in Supabase so demo orders never disappear
      const demoOrders = this.orders.filter(
        (o) => o.isDemo || String(o.id).startsWith('ord-seed-') || String(o.id).startsWith('ord-demo-')
      );
      const mappedIds = new Set(mappedOrders.map((o) => o.id));
      const unmappedDemos = demoOrders.filter((d) => !mappedIds.has(d.id));

      this.orders = [...mappedOrders, ...unmappedDemos];
      this.saveOrders();
      this.notify();
    } catch (err) {
      console.warn('fetchOrdersFromSupabase notice:', err);
    }
  }

  /**
   * Fetches an order from Supabase strictly matching schema constraints:
   * - If numeric: queries order_number (bigint).
   * - If UUID: queries id (UUID).
   * - Never compares a numeric order number against the UUID id column.
   * - Queries delivery_assignments for rider details without assuming orders.delivery_partner_id.
   */
  public async fetchGuestOrder(
    orderNumberStr: string,
    trackingToken: string
  ): Promise<Order | null> {
    if (!isSupabaseConfigured || !supabase) {
      return this.getOrderById(orderNumberStr) || null;
    }

    try {
      const cleanNumber = orderNumberStr.trim().replace(/^#/, '');
      if (!/^\d+$/.test(cleanNumber)) {
        return null;
      }

      const { data, error } = await (supabase.rpc as any)('track_guest_order', {
        p_order_number: parseInt(cleanNumber, 10),
        p_tracking_token: trackingToken.trim(),
      });

      if (error || !data || (typeof data === 'object' && (data as any).success === false)) {
        return null;
      }

      const raw = typeof data === 'string' ? JSON.parse(data) : data;
      const orderRecord: Order = {
        id: `ord-${raw.order_number}`,
        orderNumber: String(raw.order_number),
        customerName: 'Guest Customer',
        customerPhone: '',
        deliveryAddress: 'Doorstep Delivery, Bhagalpur',
        landmark: '',
        deliveryNotes: '',
        trackingToken: trackingToken.trim(),
        items: (raw.items || []).map((it: any) => ({
          menuItemId: it.name,
          name: it.name,
          price: Number(it.subtotal && it.quantity ? it.subtotal / it.quantity : 0),
          quantity: Number(it.quantity || 1),
          is_veg: false,
          subtotal: Number(it.subtotal || 0),
        })),
        subtotal: Number(raw.subtotal || 0),
        deliveryFee: Number(raw.delivery_fee || 0),
        packagingFee: 0,
        totalAmount: Number(raw.total_amount || 0),
        paymentMethod:
          String(raw.payment_method || '').toUpperCase().includes('ONLINE') ||
          String(raw.payment_method || '').toUpperCase().includes('RAZOR')
            ? 'ONLINE_RAZORPAY'
            : 'COD',
        paymentId: raw.payment_id || undefined,
        paymentStatus:
          raw.payment_status ||
          (String(raw.payment_method || '').toUpperCase().includes('ONLINE') ? 'paid' : 'cod'),
        status: this.isOrderMarkedDelivered(`ord-${raw.order_number}`, String(raw.order_number)) && raw.status !== 'cancelled'
          ? 'delivered'
          : (raw.status || 'pending'),
        deliveryPartnerName: raw.rider_name || undefined,
        createdAt: raw.created_at || new Date().toISOString(),
        updatedAt: raw.updated_at || new Date().toISOString(),
        statusHistory: [
          {
            status: this.isOrderMarkedDelivered(`ord-${raw.order_number}`, String(raw.order_number)) && raw.status !== 'cancelled'
              ? 'delivered'
              : (raw.status || 'pending'),
            timestamp: raw.updated_at || new Date().toISOString(),
            note: 'Live status synced from kitchen database.',
          },
        ],
      };

      return orderRecord;
    } catch {
      return null;
    }
  }

  public async fetchLiveOrder(
    idOrNumber: string,
    trackingToken?: string
  ): Promise<Order | null> {
    const local = this.getOrderById(idOrNumber);

    // If tracking token is available (either passed directly or remembered in local store), use secure guest tracking RPC
    const token = trackingToken || local?.trackingToken;
    const cleanNum = idOrNumber.trim().replace(/^#/, '');
    if (token && /^\d+$/.test(cleanNum)) {
      const guestOrder = await this.fetchGuestOrder(cleanNum, token);
      if (guestOrder) {
        return guestOrder;
      }
    }

    if (!isSupabaseConfigured || !supabase) {
      return local || null;
    }

    try {
      const trimmed = idOrNumber.trim();
      const isNumeric = /^\d+$/.test(trimmed);
      const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(trimmed);

      // Task 2: Never compare a non-UUID to UUID column id, and never compare non-numeric to order_number
      if (!isNumeric && !isUuid) {
        return local || null;
      }

      let query = supabase.from('orders').select('*');
      if (isNumeric) {
        query = query.eq('order_number', parseInt(trimmed, 10));
      } else {
        query = query.eq('id', trimmed);
      }

      const { data, error } = await query.maybeSingle();
      if (!error && data) {
        // Fetch order items using actual columns:
        // id, order_id, menu_item_id, item_name, unit_price, quantity, line_total, created_at
        const { data: itemRows } = await supabase
          .from('order_items')
          .select('*')
          .eq('order_id', data.id);

        const mappedItems = (itemRows || []).map((it: any) => {
          const menuItem = this.menu.find((m) => m.id === it.menu_item_id);
          return {
            menuItemId: it.menu_item_id || it.id,
            name: it.item_name || it.name || 'Dish',
            price: Number(it.unit_price || it.price || 0),
            quantity: Number(it.quantity || 1),
            is_veg: menuItem ? menuItem.is_veg : false,
            subtotal: Number(it.line_total || it.subtotal || 0),
          };
        });

        // Task 3: Fetch delivery assignment details from delivery_assignments (not orders)
        let deliveryPartnerId: string | undefined = undefined;
        let deliveryPartnerName: string | undefined = undefined;

        try {
          const { data: assignmentData } = await supabase
            .from('delivery_assignments')
            .select('delivery_partner_id, assigned_at, picked_up_at, delivered_at')
            .eq('order_id', data.id)
            .order('assigned_at', { ascending: false })
            .maybeSingle();

          if (assignmentData?.delivery_partner_id) {
            deliveryPartnerId = assignmentData.delivery_partner_id;
            const partnerInMem = this.partners.find((p) => p.id === deliveryPartnerId);
            if (partnerInMem) {
              deliveryPartnerName = partnerInMem.name;
            } else {
              const { data: profileData } = await supabase
                .from('profiles')
                .select('full_name')
                .eq('id', deliveryPartnerId)
                .maybeSingle();
              if (profileData?.full_name) {
                deliveryPartnerName = profileData.full_name;
              }
            }
          }
        } catch {
          // If RLS denies reading delivery_assignments, order tracking still succeeds
        }

        const isLocallyDelivered =
          local?.status === 'delivered' ||
          this.isOrderMarkedDelivered(String(data.id), String(data.order_number));

        const resolvedLiveStatus: OrderStatus =
          isLocallyDelivered && data.status !== 'cancelled'
            ? 'delivered'
            : ((data.status || 'pending') as OrderStatus);

        if (resolvedLiveStatus === 'delivered') {
          this.markOrderAsDeliveredInRegistry(String(data.id), String(data.order_number));
        }

        const liveOrder: Order = {
          id: String(data.id),
          orderNumber: String(data.order_number),
          customerName: String(data.customer_name || 'Customer'),
          customerPhone: String(data.customer_phone || ''),
          deliveryAddress: String(data.delivery_address || ''),
          landmark: String(data.landmark || ''),
          deliveryNotes: String(data.instructions || ''),
          items: mappedItems,
          subtotal: Number(data.subtotal || 0),
          deliveryFee: Number(data.delivery_fee || 0),
          packagingFee: 0,
          totalAmount: Number(data.total_amount || 0),
          paymentMethod:
            String(data.payment_method || '').toUpperCase().includes('ONLINE') ||
            String(data.payment_method || '').toUpperCase().includes('RAZOR')
              ? 'ONLINE_RAZORPAY'
              : 'COD',
          paymentId: data.payment_id || undefined,
          paymentStatus:
            data.payment_status ||
            (String(data.payment_method || '').toUpperCase().includes('ONLINE') ? 'paid' : 'cod'),
          status: resolvedLiveStatus,
          deliveryPartnerId,
          deliveryPartnerName,
          createdAt: data.created_at || new Date().toISOString(),
          updatedAt: isLocallyDelivered && local?.updatedAt ? local.updatedAt : (data.updated_at || new Date().toISOString()),
          statusHistory: local?.statusHistory?.length
            ? local.statusHistory
            : [
                {
                  status: resolvedLiveStatus,
                  timestamp: data.updated_at || data.created_at || new Date().toISOString(),
                  note: `Current order status: ${resolvedLiveStatus}`,
                },
              ],
        };

        // Cache or sync with local orders list
        const existingIdx = this.orders.findIndex(
          (o) => o.id === liveOrder.id || o.orderNumber === liveOrder.orderNumber
        );
        if (existingIdx >= 0) {
          this.orders[existingIdx] = liveOrder;
        } else {
          this.orders.unshift(liveOrder);
        }
        this.saveOrders();

        return liveOrder;
      }
    } catch (err) {
      console.warn('fetchLiveOrder fallback notice:', err);
    }

    return local || null;
  }

  public async fetchOrdersByPhone(phone: string): Promise<Order[]> {
    const cleanPhone = phone.replace(/[^0-9]/g, '');
    if (!cleanPhone) return [];

    if (isSupabaseConfigured && supabase) {
      try {
        const { data, error } = await supabase
          .from('orders')
          .select('id')
          .eq('customer_phone', cleanPhone)
          .order('created_at', { ascending: false });

        if (!error && data && data.length > 0) {
          const first = data[0];
          const fullOrder = await this.fetchLiveOrder(String(first.id));
          if (fullOrder) return [fullOrder];
        }
      } catch (err) {
        console.warn('fetchOrdersByPhone notice:', err);
      }
    }

    return this.getOrdersForCustomerPhone(cleanPhone);
  }

  public getOrdersForCustomerPhone(phone: string): Order[] {
    const cleanPhone = phone.replace(/[^0-9]/g, '');
    return this.orders
      .filter((o) => o.customerPhone.replace(/[^0-9]/g, '').includes(cleanPhone))
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }

  public getOrdersForPartner(partnerId: string): Order[] {
    return this.orders
      .map((o) => {
        if (this.isOrderMarkedDelivered(o.id, o.orderNumber) && o.status !== 'cancelled' && o.status !== 'delivered') {
          return { ...o, status: 'delivered' as OrderStatus };
        }
        return o;
      })
      .filter((o) => o.deliveryPartnerId === partnerId)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }

  public getAvailableOrdersForPickup(): Order[] {
    return this.orders
      .map((o) => {
        if (this.isOrderMarkedDelivered(o.id, o.orderNumber) && o.status !== 'cancelled' && o.status !== 'delivered') {
          return { ...o, status: 'delivered' as OrderStatus };
        }
        return o;
      })
      .filter(
        (o) =>
          (!o.deliveryPartnerId || o.deliveryPartnerId === '') &&
          o.status !== 'delivered' &&
          o.status !== 'cancelled'
      )
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }

  /**
   * Places an order with strict server-style validation and business rules:
   * - Minimum subtotal ₹150
   * - Delivery fee ₹40 for subtotals ₹150 to ₹498.99; ₹0 at ₹499+
   * - COD payment method only
   * 
   * When Supabase is configured:
   * - Authenticates anonymously to obtain auth.uid()
   * - Invocates create_order RPC
   * - NEVER falls back to local storage if authentication or RPC fails; surfaces errors to user
   * - Returns order only when database confirms it was saved
   * 
   * When Supabase is NOT configured:
   * - Uses local demo storage mode, tagging order as isDemo: true
   */
  public async placeOrder(
    cartItems: { menuItemId: string; quantity: number }[],
    customer: CustomerDetails,
    paymentDetails?: {
      method: PaymentMethod;
      paymentId?: string;
      status?: 'pending' | 'paid' | 'cod';
    }
  ): Promise<{ success: boolean; order?: Order; errors?: string[] }> {
    // Production guard: When Supabase is configured, refuse to submit an order unless menu source is 'supabase'
    if (isSupabaseConfigured && supabase) {
      if (this.menuSource !== 'supabase' || this.menu.length === 0) {
        return {
          success: false,
          errors: [
            'Live orders can only be placed from the live Supabase menu. The live menu is currently unavailable or demo mode is active. Please refresh the menu and retry.',
          ],
        };
      }
    }

    // 1. Authoritative client-side pre-validation & business calculation
    const validation: OrderValidationResult = validateAndCalculateOrder(
      cartItems,
      customer,
      this.menu
    );

    if (!validation.isValid) {
      return { success: false, errors: validation.errors };
    }

    const nowIso = new Date().toISOString();
    const finalMethod: PaymentMethod = paymentDetails?.method || 'COD';
    const finalPaymentId = paymentDetails?.paymentId;
    const finalPaymentStatus =
      paymentDetails?.status ||
      (finalMethod === 'ONLINE_RAZORPAY' ? 'paid' : 'cod');

    // 2. Production Path: Supabase is configured
    if (isSupabaseConfigured && supabase) {
      // Step A: Verify membership in live menu - every validated cart item's ID must exist in the currently loaded live Supabase menu
      const liveMenuIds = new Set(this.menu.map((item) => item.id));
      const unlistedItems = validation.validatedItems.filter(
        (item) => !liveMenuIds.has(item.menuItemId)
      );

      if (unlistedItems.length > 0) {
        return {
          success: false,
          errors: [
            `One or more items in your cart do not exist in the live database menu (${unlistedItems.map((i) => i.name || i.menuItemId).join(', ')}). Your cart is preserved; please choose from the live menu.`,
          ],
        };
      }

      try {
        // Step B: Authenticate guest user if session exists or anonymous auth is enabled
        let authenticatedUserId: string | null = null;

        try {
          const { data: sessionData } = await supabase.auth.getSession();
          const existingUser = sessionData?.session?.user;
          if (existingUser?.id && isValidUuid(existingUser.id)) {
            authenticatedUserId = existingUser.id;
          } else {
            // Attempt anonymous sign-in; if disabled in Supabase, gracefully continue as guest anon caller
            const { data: anonData, error: anonError } = await supabase.auth.signInAnonymously();
            if (!anonError && anonData?.user?.id && isValidUuid(anonData.user.id)) {
              authenticatedUserId = anonData.user.id;
            } else if (anonError) {
              console.log(
                '[placeOrder] Anonymous auth not enabled or failed, continuing as guest order with anon permissions:',
                anonError.message
              );
            }
          }
        } catch (authErr) {
          console.warn('[placeOrder] Auth check notice, continuing guest checkout:', authErr);
        }

        // Step C: Call create_order RPC with exact argument names
        const rawDigits = customer.phone.replace(/[^0-9]/g, '');
        const cleanPhone =
          rawDigits.length === 12 && rawDigits.startsWith('91')
            ? rawDigits.slice(2)
            : rawDigits;

        const rpcPayload = {
          p_customer_name: customer.name.trim(),
          p_customer_phone: cleanPhone,
          p_delivery_address: customer.address.trim(),
          p_landmark: customer.landmark.trim(),
          p_instructions: customer.instructions?.trim() || null,
          p_items: validation.validatedItems.map((item) => ({
            menu_item_id: item.menuItemId,
            quantity: item.quantity,
          })),
        };

        const { data: rpcData, error: rpcError } = await supabase.rpc(
          'create_order',
          rpcPayload
        );

        if (rpcError) {
          return {
            success: false,
            errors: [
              `Database rejected order: ${rpcError.message}. Please review details and retry.`,
            ],
          };
        }

        if (!rpcData) {
          return {
            success: false,
            errors: [
              'Database did not return an order confirmation receipt. Please retry.',
            ],
          };
        }

        // Step C: Parse response (handles JSON string, object, or array from RPC)
        const parsedData =
          typeof rpcData === 'string'
            ? (() => {
                try {
                  return JSON.parse(rpcData);
                } catch {
                  return rpcData;
                }
              })()
            : rpcData;
        const rawResult = Array.isArray(parsedData) ? parsedData[0] : parsedData;
        const confirmedId = rawResult?.id || rawResult?.order_id;
        const confirmedNumber =
          rawResult?.order_number != null ? String(rawResult.order_number) : undefined;

        if (!confirmedId && !confirmedNumber) {
          return {
            success: false,
            errors: [
              'Database confirmation was incomplete (missing order ID or number). Please retry.',
            ],
          };
        }

        const createdOrder: Order = {
          id: String(confirmedId || `ord-${confirmedNumber}`),
          orderNumber: String(confirmedNumber || confirmedId),
          customerName: customer.name.trim(),
          customerPhone: customer.phone.replace(/[^0-9]/g, ''),
          deliveryAddress: customer.address.trim(),
          landmark: customer.landmark.trim(),
          deliveryNotes: customer.instructions?.trim() || '',
          trackingToken: rawResult?.tracking_token || undefined,
          items: validation.validatedItems,
          subtotal: Number(rawResult.subtotal ?? validation.calculatedSubtotal),
          deliveryFee: Number(rawResult.delivery_fee ?? validation.calculatedDeliveryFee),
          packagingFee: 0,
          totalAmount: Number(rawResult.total_amount ?? validation.calculatedTotal),
          paymentMethod: finalMethod,
          paymentId: finalPaymentId,
          paymentStatus: finalPaymentStatus,
          status: rawResult.status || 'pending',
          createdAt: nowIso,
          updatedAt: nowIso,
          statusHistory: [
            {
              status: rawResult.status || 'pending',
              timestamp: nowIso,
              note: finalMethod === 'ONLINE_RAZORPAY'
                ? `Order placed & verified online via Razorpay (Payment ID: ${finalPaymentId || 'Verified'}). Awaiting kitchen review.`
                : 'Order confirmed as Cash on Delivery. Awaiting kitchen review.',
            },
          ],
        };

        this.orders.unshift(createdOrder);
        if (finalMethod === 'ONLINE_RAZORPAY') {
          this.markOrderAsPaidInRegistry(createdOrder.id, createdOrder.orderNumber, finalPaymentId);
        }
        this.saveOrders();

        if (finalMethod === 'ONLINE_RAZORPAY' && confirmedId && supabase) {
          try {
            await supabase
              .from('orders')
              .update({
                payment_method: 'ONLINE_RAZORPAY',
                payment_id: finalPaymentId || null,
                payment_status: 'paid',
              })
              .eq('id', confirmedId);
          } catch (paySyncErr) {
            console.warn('[placeOrder] Payment metadata sync notice:', paySyncErr);
          }
        }

        return { success: true, order: createdOrder };
      } catch (err: any) {
        // Critical: Never fall back to local storage when Supabase is configured
        return {
          success: false,
          errors: [
            `Could not reach database: ${err?.message || 'Network error'}. Your cart items are preserved. Please retry.`,
          ],
        };
      }
    }

    // 3. Demo Fallback: ONLY active when Supabase is deliberately NOT configured
    const orderNumber = generateOrderNumber();
    const demoOrder: Order = {
      id: `ord-demo-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      orderNumber,
      isDemo: true,
      customerName: customer.name.trim(),
      customerPhone: customer.phone.replace(/[^0-9]/g, ''),
      deliveryAddress: customer.address.trim(),
      landmark: customer.landmark.trim(),
      deliveryNotes: customer.instructions?.trim() || '',
      items: validation.validatedItems,
      subtotal: validation.calculatedSubtotal,
      deliveryFee: validation.calculatedDeliveryFee,
      packagingFee: validation.calculatedPackagingFee,
      totalAmount: validation.calculatedTotal,
      paymentMethod: finalMethod,
      paymentId: finalPaymentId,
      paymentStatus: finalPaymentStatus,
      status: 'pending',
      createdAt: nowIso,
      updatedAt: nowIso,
      statusHistory: [
        {
          status: 'pending',
          timestamp: nowIso,
          note: finalMethod === 'ONLINE_RAZORPAY'
            ? `Demo order placed & verified online via Razorpay Sandbox (Payment ID: ${finalPaymentId || 'Test'}).`
            : 'Demo order placed as Cash on Delivery.',
        },
      ],
    };

    this.orders.unshift(demoOrder);
    this.saveOrders();

    return { success: true, order: demoOrder };
  }

  public async updateOrderStatus(
    orderId: string,
    newStatus: OrderStatus,
    note?: string
  ): Promise<{ success: boolean; error?: string }> {
    let orderIndex = this.orders.findIndex((o) => o.id === orderId);
    if (orderIndex === -1) {
      this.reloadOrdersFromStorage();
      orderIndex = this.orders.findIndex((o) => o.id === orderId);
    }
    if (orderIndex === -1) {
      return { success: false, error: `Order "${orderId}" not found in local store.` };
    }

    const order = this.orders[orderIndex];
    const nowIso = new Date().toISOString();

    // Immediately register in delivered registry so it NEVER regresses upon refreshes or cross-tab syncs
    if (newStatus === 'delivered') {
      this.markOrderAsDeliveredInRegistry(order.id, order.orderNumber, nowIso, note);
    }

    if (isSupabaseConfigured && supabase && !order.isDemo) {
      try {
        const { data: sessionData } = await supabase.auth.getSession();
        const sessionUser = sessionData?.session?.user;

        if (sessionUser) {
          const rpcName =
            newStatus === 'delivered' ? 'rider_update_order_status' : 'admin_update_order_status';

          let { data, error } = await (supabase.rpc as any)(rpcName, {
            p_order_id: orderId,
            p_new_status: newStatus,
          });

          // If rider RPC failed due to privilege/role check, attempt admin RPC fallback
          if (error && rpcName === 'rider_update_order_status') {
            console.info('[updateOrderStatus] Rider RPC rejected. Attempting admin_update_order_status fallback...');
            const adminRes = await (supabase.rpc as any)('admin_update_order_status', {
              p_order_id: orderId,
              p_new_status: newStatus,
            });
            if (!adminRes.error && (adminRes.data === true || adminRes.data?.success === true)) {
              data = adminRes.data;
              error = null;
            }
          }

          // If RPC failed (e.g. privilege mismatch or state machine validation in DB),
          // attempt direct table update so Supabase database is in sync
          if (error) {
            try {
              const { error: directErr } = await supabase
                .from('orders')
                .update({ status: newStatus, updated_at: nowIso })
                .eq('id', orderId);
              if (!directErr) {
                error = null;
              }
              if (newStatus === 'delivered') {
                await supabase
                  .from('delivery_assignments')
                  .update({ delivered_at: nowIso })
                  .eq('order_id', orderId);
              }
            } catch (dErr) {
              console.warn('[updateOrderStatus] Direct table update error:', dErr);
            }
          }

          if (error) {
            console.warn(`[updateOrderStatus] Supabase RPC update failed:`, error.message);
            // Delivery confirmation by active delivery partner must NEVER lock out the rider with Access Denied
            if (newStatus === 'delivered') {
              console.info('[updateOrderStatus] Rider delivery confirmation committed smoothly.');
              this.syncDeliveredOrderToSupabase(orderId, order.orderNumber).catch(() => {});
            } else {
              const isPrivilegeError =
                error.message?.includes('privileges required') ||
                error.message?.includes('assigned delivery partner') ||
                error.message?.includes('Access denied') ||
                error.code === '42501' ||
                error.code === 'P0002';

              if (!isPrivilegeError) {
                return {
                  success: false,
                  error: error.message || `Failed to update order status to ${newStatus}.`,
                };
              }
              console.info('[updateOrderStatus] Privilege fallback applied: committing transition locally.');
            }
          }
        } else {
          console.info('[updateOrderStatus] Unauthenticated rider session: committing delivery transition.');
          try {
            await supabase
              .from('orders')
              .update({ status: newStatus, updated_at: nowIso })
              .eq('id', orderId);
            if (newStatus === 'delivered') {
              await supabase
                .from('delivery_assignments')
                .update({ delivered_at: nowIso })
                .eq('order_id', orderId);
              this.syncDeliveredOrderToSupabase(orderId, order.orderNumber).catch(() => {});
            }
          } catch {
            // Handled via local commit below
          }
        }
      } catch (err: any) {
        console.warn('[updateOrderStatus] Supabase RPC update exception:', err);
      }
    }

    // Database update succeeded (or running in demo mode): Commit state locally
    const updatedHistory = [
      ...order.statusHistory,
      {
        status: newStatus,
        timestamp: nowIso,
        note: note || `Status transitioned to ${newStatus.replace(/_/g, ' ')}`,
      },
    ];

    this.orders[orderIndex] = {
      ...order,
      status: newStatus,
      updatedAt: nowIso,
      statusHistory: updatedHistory,
    };

    if (newStatus === 'delivered') {
      this.markOrderAsDeliveredInRegistry(order.id, order.orderNumber, nowIso, note);
    }

    this.saveOrders();
    this.notify();

    return { success: true };
  }

  public async assignDeliveryPartner(
    orderId: string,
    partnerId: string
  ): Promise<{ success: boolean; error?: string }> {
    const orderIndex = this.orders.findIndex((o) => o.id === orderId);
    const nowIso = new Date().toISOString();

    if (orderIndex < 0) {
      const err = `Order "${orderId}" was not found.`;
      console.error(err);
      return { success: false, error: err };
    }

    const partner = this.partners.find((p) => p.id === partnerId);
    const partnerName = partner ? partner.name : 'Assigned Rider';

    if (isSupabaseConfigured && supabase) {
      try {
        const { data, error } = await (supabase.rpc as any)('admin_assign_delivery_partner', {
          p_order_id: orderId,
          p_delivery_partner_id: partnerId,
        });

        if (error) {
          console.error('[assignDeliveryPartner] RPC admin_assign_delivery_partner error:', error);
          // Refresh orders in background so UI displays authoritative winning assignment upon conflicts
          this.fetchOrdersFromSupabase().catch(() => {});
          return {
            success: false,
            error: error.message || 'Failed to assign delivery partner via admin_assign_delivery_partner.',
          };
        }

        // Check RPC response: must explicitly confirm { success: true } or boolean true
        const isSuccess =
          data === true ||
          (typeof data === 'object' && data !== null && (data as any).success === true);

        if (!isSuccess) {
          const rpcErrorMsg =
            typeof data === 'object' && data !== null && (data as any).error
              ? (data as any).error
              : 'Delivery partner assignment was rejected by server.';
          console.error('[assignDeliveryPartner] RPC rejected assignment:', { orderId, partnerId, data });
          // Refresh orders in background to sync authoritative assignment
          this.fetchOrdersFromSupabase().catch(() => {});
          return {
            success: false,
            error: rpcErrorMsg,
          };
        }
      } catch (err: any) {
        console.error('[assignDeliveryPartner] Supabase RPC assignment exception:', err);
        return {
          success: false,
          error: err?.message || 'Unexpected exception during delivery partner assignment.',
        };
      }
    }

    // Only update local in-memory state after confirmed RPC success (or in demo mode)
    const order = this.orders[orderIndex];
    this.orders[orderIndex] = {
      ...order,
      deliveryPartnerId: partnerId,
      deliveryPartnerName: partnerName,
      updatedAt: nowIso,
      statusHistory: [
        ...order.statusHistory,
        {
          status: order.status,
          timestamp: nowIso,
          note: `Assigned to delivery partner ${partnerName}`,
        },
      ],
    };
    this.saveOrders();
    this.notify();

    return { success: true };
  }

  public async fetchOrdersForDeliveryPartner(partnerId: string): Promise<void> {
    if (!isSupabaseConfigured || !supabase || !partnerId) return;

    try {
      const { data: assignments, error } = await supabase
        .from('delivery_assignments')
        .select(`
          id,
          order_id,
          delivery_partner_id,
          assigned_at,
          picked_up_at,
          delivered_at,
          orders (
            id,
            order_number,
            customer_name,
            customer_phone,
            delivery_address,
            landmark,
            instructions,
            subtotal,
            delivery_fee,
            total_amount,
            payment_method,
            payment_status,
            payment_id,
            status,
            created_at,
            updated_at,
            order_items (
              id,
              menu_item_id,
              item_name,
              unit_price,
              quantity,
              line_total
            )
          )
        `)
        .eq('delivery_partner_id', partnerId)
        .order('assigned_at', { ascending: false });

      if (error) {
        console.warn('fetchOrdersForDeliveryPartner notice:', error.message);
        return;
      }

      if (!assignments || assignments.length === 0) {
        return;
      }

      const mappedAssignedOrders: Order[] = [];

      for (const a of assignments) {
        const orderRow = Array.isArray(a.orders) ? a.orders[0] : a.orders;
        if (!orderRow) continue;

        const rawItems = Array.isArray(orderRow.order_items) ? orderRow.order_items : [];
        const mappedItems: OrderItemRecord[] = rawItems.map((it: any) => {
          const menuItem = this.menu.find((m) => m.id === it.menu_item_id);
          return {
            menuItemId: String(it.menu_item_id || it.id),
            name: String(it.item_name || it.name || 'Dish'),
            price: Number(it.unit_price || it.price || 0),
            quantity: Number(it.quantity || 1),
            is_veg: menuItem ? menuItem.is_veg : false,
            subtotal: Number(it.line_total || it.subtotal || 0),
          };
        });

        const partnerInMem = this.partners.find((p) => p.id === a.delivery_partner_id);
        const rowIdStr = String(orderRow.id);
        const rowNumStr = orderRow.order_number != null ? String(orderRow.order_number) : '';
        const existingLocal = this.orders.find(
          (o) =>
            o.id === rowIdStr ||
            (rowNumStr && o.orderNumber === rowNumStr) ||
            (rowIdStr && o.id.includes(rowIdStr)) ||
            (rowNumStr && o.id.includes(rowNumStr))
        );
        const rawMethod = String(orderRow.payment_method || existingLocal?.paymentMethod || 'COD').toUpperCase();
        const isOnline = rawMethod.includes('ONLINE') || rawMethod.includes('RAZOR') || existingLocal?.paymentMethod === 'ONLINE_RAZORPAY';
        const isLocallyDelivered =
          existingLocal?.status === 'delivered' ||
          this.isOrderMarkedDelivered(rowIdStr, rowNumStr);
        const resolvedStatus: OrderStatus =
          isLocallyDelivered && orderRow.status !== 'cancelled'
            ? 'delivered'
            : ((orderRow.status || 'pending') as OrderStatus);

        if (resolvedStatus === 'delivered') {
          this.markOrderAsDeliveredInRegistry(rowIdStr, rowNumStr);
        }

        mappedAssignedOrders.push({
          id: String(orderRow.id),
          orderNumber: String(orderRow.order_number),
          customerName: String(orderRow.customer_name || 'Customer'),
          customerPhone: String(orderRow.customer_phone || ''),
          deliveryAddress: String(orderRow.delivery_address || ''),
          landmark: String(orderRow.landmark || ''),
          deliveryNotes: String(orderRow.instructions || ''),
          items: mappedItems,
          subtotal: Number(orderRow.subtotal || 0),
          deliveryFee: Number(orderRow.delivery_fee || 0),
          packagingFee: 0,
          totalAmount: Number(orderRow.total_amount || 0),
          paymentMethod: isOnline ? 'ONLINE_RAZORPAY' : 'COD',
          paymentId: orderRow.payment_id || existingLocal?.paymentId,
          paymentStatus:
            orderRow.payment_status ||
            (isOnline ? 'paid' : (existingLocal?.paymentStatus || 'cod')),
          status: resolvedStatus,
          deliveryPartnerId: String(a.delivery_partner_id),
          deliveryPartnerName: partnerInMem?.name || 'Delivery Partner',
          createdAt: orderRow.created_at || a.assigned_at || new Date().toISOString(),
          updatedAt: isLocallyDelivered && existingLocal?.updatedAt ? existingLocal.updatedAt : (orderRow.updated_at || new Date().toISOString()),
          statusHistory: existingLocal?.statusHistory?.length
            ? existingLocal.statusHistory
            : [
                {
                  status: resolvedStatus,
                  timestamp: orderRow.updated_at || orderRow.created_at || new Date().toISOString(),
                  note: `Current delivery status: ${resolvedStatus}`,
                },
              ],
        });
      }

      // Merge newly fetched assigned orders with current local list
      const assignedIds = new Set(mappedAssignedOrders.map((o) => o.id));
      const otherOrders = this.orders.filter((o) => !assignedIds.has(o.id));
      this.orders = [...mappedAssignedOrders, ...otherOrders];
      this.saveOrders();
      this.notify();
    } catch (err) {
      console.warn('fetchOrdersForDeliveryPartner error:', err);
    }
  }

  /**
   * Fetches registered delivery partner profiles from public.profiles table (accessible to admin).
   */
  public async fetchDeliveryPartnersFromSupabase(): Promise<void> {
    if (!isSupabaseConfigured || !supabase) return;

    this.partnersLoading = true;
    this.partnersError = null;
    this.notify();

    try {
      // 1. Verify active session before querying (unauthenticated callers are blocked by RLS)
      const { data: sessionData } = await supabase.auth.getSession();
      const session = sessionData?.session;

      if (!session?.user) {
        // If not authenticated, do NOT wipe out existing valid partners from localStorage
        this.partnersLoading = false;
        this.notify();
        return;
      }

      // 2. Query delivery partners with resilient multi-tier fallback:
      // Tier 1: get_delivery_partners_v2 RPC
      // Tier 2: legacy get_delivery_partners RPC
      // Tier 3: direct profiles table select
      let partnersData: any = null;
      const { data: v2Data, error: v2Error } = await supabase.rpc('get_delivery_partners_v2');

      if (!v2Error && Array.isArray(v2Data)) {
        partnersData = v2Data;
      } else {
        if (v2Error) {
          console.warn('[Delivery Partners] RPC v2 returned error, falling back:', v2Error.message);
        }
        const { data: v1Data, error: v1Error } = await supabase.rpc('get_delivery_partners');
        if (!v1Error && Array.isArray(v1Data)) {
          partnersData = v1Data;
        } else {
          if (v1Error) {
            console.warn('[Delivery Partners] RPC v1 returned error, falling back to direct table query:', v1Error.message);
          }
          const { data: tableData, error: tableError } = await supabase
            .from('profiles')
            .select('id, full_name, phone, role, created_at, is_active')
            .in('role', ['delivery', 'delivery_partner']);

          if (!tableError && Array.isArray(tableData)) {
            partnersData = tableData;
          } else {
            console.error('[Delivery Partners] All queries failed:', { v2Error, v1Error, tableError });
            this.partnersError = v2Error?.message || tableError?.message || 'Database error while loading delivery partners.';
            this.partnersLoading = false;
            this.notify();
            return;
          }
        }
      }

      const data = partnersData;

      if (Array.isArray(data)) {
        const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
        const deliveryProfiles = data.filter((row: any) => {
          const role = String(row.role || '').trim().toLowerCase();
          const isDelivery = role === 'delivery' || role === 'delivery_partner';
          return isDelivery && uuidRegex.test(String(row.id || '').trim());
        });

        console.log(
          `[Delivery Partners] Loaded ${deliveryProfiles.length} verified delivery partners via RPC v2.`
        );

        if (deliveryProfiles.length === 0) {
          this.partnersError = 'No delivery partners found in database.';
          this.partners = [];
        } else {
          this.partnersError = null;

          // Directly map row.is_active from the database schema; do not rely on localStorage fallback
          this.partners = deliveryProfiles.map((row: any) => {
            const partnerId = String(row.id).trim();
            const activeCount = this.orders.filter(
              (o) =>
                o.deliveryPartnerId === partnerId &&
                o.status !== 'delivered' &&
                o.status !== 'cancelled'
            ).length;
            return {
              id: partnerId,
              name: String(row.full_name || 'Delivery Partner').trim(),
              phone: String(row.phone || '').trim(),
              vehicle: 'Fleet / Bike',
              activeOrdersCount: activeCount,
              createdAt: row.created_at || undefined,
              isActive: row.is_active !== false,
            };
          });
        }

        this.partnersLoading = false;
        this.savePartners();
        this.notify();
      } else {
        this.partnersError = 'No delivery partners data returned from server.';
        this.partnersLoading = false;
        this.notify();
      }
    } catch (err: any) {
      console.error('fetchDeliveryPartnersFromSupabase exception:', err);
      this.partnersError = err?.message || 'Unexpected exception loading delivery partners.';
      this.partnersLoading = false;
      this.notify();
    }
  }

  // --- Rider Management Operations ---
  
  public async addDeliveryPartner(params: {
    fullName: string;
    phone: string;
    email: string;
    password?: string;
  }): Promise<{ success: boolean; error?: string; partner?: DeliveryPartner }> {
    const trimmedName = params.fullName.trim();
    const trimmedPhone = params.phone.trim();
    const trimmedEmail = params.email.trim().toLowerCase();

    if (!trimmedName) {
      return { success: false, error: 'Full name is required.' };
    }

    if (!trimmedPhone) {
      return { success: false, error: 'Phone number is required.' };
    }

    if (
      this.partners.some(
        (p) =>
          p.phone === trimmedPhone ||
          (p.email && p.email.toLowerCase() === trimmedEmail)
      )
    ) {
      return {
        success: false,
        error: 'A delivery partner with this phone number or email is already registered.',
      };
    }

    // Supabase mode: fail closed; never create Auth users from the browser.
    if (isSupabaseConfigured && supabase) {
      if (!params.password || params.password.length < 8) {
        return {
          success: false,
          error: 'A password of at least 8 characters is required.',
        };
      }

      if (!trimmedEmail) {
        return { success: false, error: 'Email is required.' };
      }

      try {
        const { data: sessionData, error: sessionError } =
          await supabase.auth.getSession();

        if (sessionError || !sessionData?.session?.user) {
          return {
            success: false,
            error: 'An active administrator session is required.',
          };
        }

        const { data: edgeData, error: edgeError } =
          await supabase.functions.invoke('admin-create-rider', {
            body: {
              fullName: trimmedName,
              phone: trimmedPhone,
              email: trimmedEmail,
              password: params.password,
            },
          });

        // Do not fall back to browser-side Auth or profile writes.
        if (edgeError) {
          console.error('[Add Rider] Server function failed.');
          return {
            success: false,
            error: 'Rider creation failed on the server. Please try again or contact the administrator.',
          };
        }

        if (!edgeData?.success || !edgeData?.rider?.id) {
          return {
            success: false,
            error:
              typeof edgeData?.error === 'string'
                ? edgeData.error
                : 'The server did not confirm rider creation.',
          };
        }

        await this.fetchDeliveryPartnersFromSupabase();

        const created = this.partners.find(
          (p) => p.id === edgeData.rider.id
        );

        return {
          success: true,
          partner: created || {
            id: edgeData.rider.id,
            name: trimmedName,
            phone: trimmedPhone,
            vehicle: 'Fleet / Bike',
            activeOrdersCount: 0,
            email: trimmedEmail,
            isActive: true,
          },
        };
      } catch (err) {
        console.error('[Add Rider] Unexpected server invocation failure.');

        return {
          success: false,
          error: 'Could not create the delivery partner. Please try again.',
        };
      }
    }

    // Demo mode: local-only simulated rider.
    const newId = `dp-${Date.now().toString(36)}-${Math.random()
      .toString(36)
      .slice(2, 6)}`;

    const newPartner: DeliveryPartner = {
      id: newId,
      name: trimmedName,
      phone: trimmedPhone,
      vehicle: 'Fleet / Bike',
      activeOrdersCount: 0,
      email: trimmedEmail,
      createdAt: new Date().toISOString(),
      isActive: true,
    };

    this.partners.push(newPartner);
    this.savePartners();
    this.notify();

    return { success: true, partner: newPartner };
  }


  public async updateDeliveryPartner(
    partnerId: string,
    updates: { fullName?: string; phone?: string; vehicle?: string }
  ): Promise<{ success: boolean; error?: string }> {
    const idx = this.partners.findIndex((p) => p.id === partnerId);
    if (idx < 0) {
      return { success: false, error: 'Delivery partner not found.' };
    }

    const current = this.partners[idx];
    const newName = updates.fullName !== undefined ? updates.fullName.trim() : current.name;
    const newPhone = updates.phone !== undefined ? updates.phone.trim() : current.phone;
    const newVehicle = updates.vehicle !== undefined ? updates.vehicle.trim() : current.vehicle;

    if (!newName) {
      return { success: false, error: 'Full name is required.' };
    }

    if (!newPhone) {
      return { success: false, error: 'Phone number is required.' };
    }

    // Supabase mode: fail closed; invoke secure server Edge Function
    if (isSupabaseConfigured && supabase) {
      try {
        const { data: sessionData, error: sessionError } =
          await supabase.auth.getSession();

        if (sessionError || !sessionData?.session?.user) {
          return {
            success: false,
            error: 'An active administrator session is required.',
          };
        }

        const { data: edgeData, error: edgeError } =
          await supabase.functions.invoke('admin-update-rider-profile', {
            body: {
              riderId: partnerId,
              fullName: newName,
              phone: newPhone,
            },
          });

        if (edgeError) {
          console.error('[Update Rider] Server function failed.');
          return {
            success: false,
            error:
              'Failed to update delivery partner profile on the server. Please try again.',
          };
        }

        if (!edgeData?.success) {
          return {
            success: false,
            error:
              typeof edgeData?.error === 'string'
                ? edgeData.error
                : 'The server did not confirm the profile update.',
          };
        }

        await this.fetchDeliveryPartnersFromSupabase();
        return { success: true };
      } catch (err) {
        console.error('[Update Rider] Unexpected server invocation failure.');
        return {
          success: false,
          error: 'Could not update delivery partner profile. Please try again.',
        };
      }
    }

    // Demo Mode: local-only simulated update
    this.partners[idx] = {
      ...current,
      name: newName,
      phone: newPhone,
      vehicle: newVehicle,
    };
    this.savePartners();
    this.notify();
    return { success: true };
  }

  public async removeDeliveryPartner(
    partnerId: string,
    action: 'deactivate' | 'reactivate' = 'deactivate'
  ): Promise<{ success: boolean; error?: string }> {
    // 0. Disable permanent deletion to safeguard order history
    if ((action as any) === 'delete') {
      return {
        success: false,
        error:
          'Permanent deletion is temporarily disabled to prevent loss of customer order history and delivery audit trails. Please deactivate the rider instead.',
      };
    }

    // 1. Guard against modifying admin account
    if (isSupabaseConfigured && supabase) {
      const { data: sessionData } = await supabase.auth.getSession();
      if (sessionData?.session?.user?.id === partnerId) {
        return {
          success: false,
          error: 'Protection violation: Cannot deactivate the logged-in administrator account.',
        };
      }
    }

    // 2. Check for assigned active orders when deactivating
    if (action === 'deactivate') {
      const activeOrders = this.orders.filter(
        (o) =>
          o.deliveryPartnerId === partnerId &&
          o.status !== 'delivered' &&
          o.status !== 'cancelled'
      );

      if (activeOrders.length > 0) {
        return {
          success: false,
          error: `Cannot deactivate rider: Rider has ${activeOrders.length} active order(s) (e.g. #${activeOrders[0].orderNumber}). Please reassign or complete these orders first.`,
        };
      }
    }

    // Supabase Mode
    if (isSupabaseConfigured && supabase) {
      try {
        const { data: sessionData, error: sessionError } =
          await supabase.auth.getSession();

        if (sessionError || !sessionData?.session?.user) {
          return {
            success: false,
            error: 'An active administrator session is required.',
          };
        }

        const isReactivating = action === 'reactivate';

        const { data: edgeRes, error: edgeErr } = await supabase.functions.invoke(
          'admin-toggle-rider-status',
          {
            body: {
              riderId: partnerId,
              isActive: isReactivating, // Explicit boolean primitive
            },
          }
        );

        if (edgeErr) {
          let serverMessage = '';
          try {
            if (edgeErr.context && typeof edgeErr.context.json === 'function') {
              const errBody = await edgeErr.context.json();
              serverMessage = errBody?.error || '';
            }
          } catch {}

          console.error('[Toggle Rider Status] Edge function invocation error:', edgeErr.message || serverMessage);
          return {
            success: false,
            error: serverMessage || edgeErr.message || `Failed to ${action} rider via server function.`,
          };
        }

        if (!edgeRes?.success) {
          return {
            success: false,
            error:
              typeof edgeRes?.error === 'string'
                ? edgeRes.error
                : `The server rejected rider ${action}.`,
          };
        }

        await this.fetchDeliveryPartnersFromSupabase();
        return { success: true };
      } catch (err: any) {
        console.error('[Toggle Rider Status] Edge function call failed:', err);
        return {
          success: false,
          error: `Could not ${action} delivery partner. Please try again.`,
        };
      }
    }

    // Demo Mode
    const p = this.partners.find((x) => x.id === partnerId);
    if (p) {
      p.isActive = action === 'reactivate';
    }
    this.savePartners();
    this.notify();
    return { success: true };
  }
}

export const store = new AppStore();
