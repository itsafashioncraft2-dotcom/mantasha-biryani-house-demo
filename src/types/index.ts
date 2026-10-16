export type FoodCategory =
  | 'all'
  | 'biryani'
  | 'starters'
  | 'curries'
  | 'breads'
  | 'desserts';

export interface MenuItem {
  id: string;
  name: string;
  description: string;
  category: FoodCategory;
  price: number;
  is_veg: boolean;
  is_available: boolean;
  image_url?: string;
  portion_info?: string;
  is_bestseller?: boolean;
  spice_level?: 'Mild' | 'Medium' | 'Spicy';
}

export interface CartItem {
  menuItem: MenuItem;
  quantity: number;
  specialInstructions?: string;
}

export type OrderStatus =
  | 'pending'
  | 'accepted'
  | 'preparing'
  | 'ready_for_pickup'
  | 'out_for_delivery'
  | 'delivered'
  | 'cancelled';

export interface OrderItemRecord {
  menuItemId: string;
  name: string;
  price: number;
  quantity: number;
  is_veg: boolean;
  subtotal: number;
}

export interface DeliveryPartner {
  id: string;
  name: string;
  phone: string;
  vehicle: string;
  activeOrdersCount: number;
  email?: string;
  isActive?: boolean;
  createdAt?: string;
}

export interface Order {
  id: string;
  orderNumber: string;
  isDemo?: boolean;
  customerName: string;
  customerPhone: string;
  deliveryAddress: string;
  landmark: string;
  deliveryNotes?: string;
  items: OrderItemRecord[];
  subtotal: number;
  deliveryFee: number;
  packagingFee: number;
  totalAmount: number;
  paymentMethod: 'COD';
  status: OrderStatus;
  deliveryPartnerId?: string;
  deliveryPartnerName?: string;
  trackingToken?: string;
  createdAt: string;
  updatedAt: string;
  statusHistory: {
    status: OrderStatus;
    timestamp: string;
    note?: string;
  }[];
}

export interface CustomerDetails {
  name: string;
  phone: string;
  address: string;
  landmark: string;
  instructions?: string;
}

export type MenuSource = 'supabase' | 'demo';

export interface MenuState {
  items: MenuItem[];
  isLoading: boolean;
  error: string | null;
  source: MenuSource;
}

