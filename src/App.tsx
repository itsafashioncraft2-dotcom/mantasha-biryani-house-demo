import { useState, useEffect } from 'react';
import { MenuItem, CartItem, Order, DeliveryPartner, MenuState } from './types';
import { store } from './services/store';
import { supabase, isSupabaseConfigured } from './services/supabaseClient';
import { Header } from './components/Header';
import { HeroSection } from './components/HeroSection';
import { MenuSection } from './components/MenuSection';
import { CartDrawer } from './components/CartDrawer';
import { CheckoutModal } from './components/CheckoutModal';
import { OrderConfirmationModal } from './components/OrderConfirmationModal';
import { OrderTrackingView } from './components/OrderTrackingView';
import { AdminLoginModal } from './components/admin/AdminLoginModal';
import { AdminDashboard } from './components/admin/AdminDashboard';
import { DeliveryLoginModal } from './components/delivery/DeliveryLoginModal';
import { DeliveryDashboard } from './components/delivery/DeliveryDashboard';
import { SupabaseConfigGuideModal } from './components/SupabaseConfigGuideModal';
import { Footer } from './components/Footer';
import { ShoppingBag, ArrowRight } from 'lucide-react';

// Helper to verify if an authenticated user has the 'admin' role in public.profiles
const verifyAdminRole = async (userId: string): Promise<boolean> => {
  if (!isSupabaseConfigured || !supabase || !userId) return false;
  try {
    const { data: profile, error } = await supabase
      .from('profiles')
      .select('id, role')
      .eq('id', userId)
      .maybeSingle();

    if (import.meta.env.DEV) {
      console.log('[App Auth Diagnostic] Authenticated user ID:', userId);
      console.log('[App Auth Diagnostic] Profile query error:', error?.message ?? error);
      console.log('[App Auth Diagnostic] Returned role:', profile?.role);
    }

    if (error || !profile || profile.role?.trim().toLowerCase() !== 'admin') {
      return false;
    }
    return true;
  } catch {
    return false;
  }
};

export default function App() {
  const [activeView, setActiveView] = useState<
    'home' | 'menu' | 'track' | 'admin' | 'delivery' | 'supabase_status'
  >('home');

  // Menu items & fetch state from reactive store
  const [menuState, setMenuState] = useState<MenuState>(store.getMenuState());

  // Cart State
  const [cartItems, setCartItems] = useState<CartItem[]>([]);
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [isCheckoutOpen, setIsCheckoutOpen] = useState(false);

  // Order Placement & Tracking State
  const [lastPlacedOrder, setLastPlacedOrder] = useState<Order | null>(null);
  const [isConfirmationOpen, setIsConfirmationOpen] = useState(false);
  const [trackingOrderNumber, setTrackingOrderNumber] = useState<string | undefined>(undefined);
  const [trackingOrderToken, setTrackingOrderToken] = useState<string | undefined>(undefined);

  // Authentication State
  const [isAdminAuthenticated, setIsAdminAuthenticated] = useState(false);
  const [isAdminLoginModalOpen, setIsAdminLoginModalOpen] = useState(false);

  const [activeDeliveryPartner, setActiveDeliveryPartner] = useState<DeliveryPartner | null>(null);
  const [isDeliveryLoginModalOpen, setIsDeliveryLoginModalOpen] = useState(false);

  // Supabase Guide Modal
  const [isSupabaseModalOpen, setIsSupabaseModalOpen] = useState(false);

  // Subscribe to store updates (e.g. when menu fetches from Supabase or Admin updates)
  useEffect(() => {
    const handleStoreChange = () => {
      setMenuState(store.getMenuState());
    };
    const unsubscribe = store.subscribe(handleStoreChange);
    return () => unsubscribe();
  }, []);

  // Secure Admin Authentication Lifecycle:
  // 1. Single unified onAuthStateChange pipeline (handles INITIAL_SESSION, SIGNED_IN, TOKEN_REFRESHED, USER_UPDATED, SIGNED_OUT)
  // 2. Executes verifyAdminRole inside a deferred task (setTimeout 0) to prevent Gotrue Auth lock/deadlock
  // 3. Employs an authRequestId sequence counter to prevent stale async verification results from overwriting newer states
  // 4. Guaranteed fail-closed behavior: invalid session, non-admin role, or missing profile revokes access
  useEffect(() => {
    const client = supabase;
    if (!isSupabaseConfigured || !client) {
      setIsAdminAuthenticated(false);
      return;
    }

    let isMounted = true;
    let authRequestId = 0;

    const {
      data: { subscription },
    } = client.auth.onAuthStateChange((event, session) => {
      // Increment request counter for every incoming auth event
      const currentRequestId = ++authRequestId;

      // Defer async processing to allow Gotrue Auth lock to release cleanly
      setTimeout(async () => {
        if (!isMounted || currentRequestId !== authRequestId) return;

        // Sign out or absent session => immediate fail-closed revocation
        if (event === 'SIGNED_OUT' || !session?.user) {
          setIsAdminAuthenticated(false);
          setActiveDeliveryPartner(null);
          setActiveView((current) =>
            current === 'admin' || current === 'delivery' ? 'home' : current
          );
          return;
        }

        // Handle initial session check, login, token refresh, and user update
        if (
          event === 'INITIAL_SESSION' ||
          event === 'SIGNED_IN' ||
          event === 'TOKEN_REFRESHED' ||
          event === 'USER_UPDATED'
        ) {
          const isAdmin = await verifyAdminRole(session.user.id);

          // Discard result if unmounted or if a newer auth event was dispatched during the check
          if (!isMounted || currentRequestId !== authRequestId) return;

          if (isAdmin) {
            setIsAdminAuthenticated(true);
          } else {
            setIsAdminAuthenticated(false);
            setActiveView((current) => (current === 'admin' ? 'home' : current));
          }
        }
      }, 0);
    });

    return () => {
      isMounted = false;
      authRequestId++;
      subscription.unsubscribe();
    };
  }, []);

  // Admin Logout Handler: explicitly terminates Supabase session, resets admin state, redirects to Home
  const handleAdminLogout = async () => {
    // 1. Instantly revoke local admin state and route to home (immediate UI responsiveness)
    setIsAdminAuthenticated(false);
    setActiveView('home');

    // 2. Terminate Supabase session on server; any failure won't compromise local state
    try {
      if (isSupabaseConfigured && supabase) {
        await supabase.auth.signOut();
      }
    } catch (err) {
      console.error('Error during admin sign out:', err);
    }
  };


  // Cart Operations
  const handleAddToCart = (item: MenuItem) => {
    setCartItems((prev) => {
      const existing = prev.find((ci) => ci.menuItem.id === item.id);
      if (existing) {
        return prev.map((ci) =>
          ci.menuItem.id === item.id
            ? { ...ci, quantity: ci.quantity + 1 }
            : ci
        );
      }
      return [...prev, { menuItem: item, quantity: 1 }];
    });
  };

  const handleUpdateQuantity = (itemId: string, newQuantity: number) => {
    if (newQuantity <= 0) {
      handleRemoveItem(itemId);
      return;
    }
    setCartItems((prev) =>
      prev.map((ci) =>
        ci.menuItem.id === itemId ? { ...ci, quantity: newQuantity } : ci
      )
    );
  };

  const handleRemoveItem = (itemId: string) => {
    setCartItems((prev) => prev.filter((ci) => ci.menuItem.id !== itemId));
  };

  const handleProceedToCheckout = () => {
    setIsCartOpen(false);
    setIsCheckoutOpen(true);
  };

  const handleOrderSuccess = (order: Order) => {
    setIsCheckoutOpen(false);
    setCartItems([]); // Clear cart
    setLastPlacedOrder(order);
    setTrackingOrderNumber(order.orderNumber);
    setTrackingOrderToken(order.trackingToken);
    setIsConfirmationOpen(true);
  };

  const handleTrackOrderFromConfirmation = (orderNumber: string, trackingToken?: string) => {
    setIsConfirmationOpen(false);
    setTrackingOrderNumber(orderNumber);
    setTrackingOrderToken(trackingToken);
    setActiveView('track');
  };

  // View Navigation Router
  const handleNavigate = (
    view: 'home' | 'menu' | 'track' | 'admin' | 'delivery' | 'supabase_status'
  ) => {
    if (view === 'supabase_status') {
      setIsSupabaseModalOpen(true);
      return;
    }

    if (view === 'admin') {
      if (!isAdminAuthenticated) {
        setIsAdminLoginModalOpen(true);
        return;
      }
      setActiveView('admin');
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }

    if (view === 'delivery') {
      if (!activeDeliveryPartner) {
        setIsDeliveryLoginModalOpen(true);
        return;
      }
      setActiveView('delivery');
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }

    setActiveView(view);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const totalCartCount = cartItems.reduce((acc, ci) => acc + ci.quantity, 0);
  const cartSubtotal = cartItems.reduce(
    (acc, ci) => acc + ci.menuItem.price * ci.quantity,
    0
  );

  return (
    <div className="min-h-screen flex flex-col bg-[#FAF7F2] text-[#231815] font-sans antialiased selection:bg-[#801323] selection:text-[#FAF7F2]">
      {/* Top Header */}
      <Header
        cartCount={totalCartCount}
        onOpenCart={() => setIsCartOpen(true)}
        activeView={activeView}
        onNavigate={handleNavigate}
      />

      {/* Main View Router */}
      <main className="flex-1">
        {activeView === 'home' && (
          <>
            <HeroSection
              onOrderNow={() => {
                const menuEl = document.getElementById('menu-section');
                if (menuEl) {
                  menuEl.scrollIntoView({ behavior: 'smooth' });
                } else {
                  setActiveView('menu');
                }
              }}
              onExploreMenu={() => {
                setActiveView('menu');
                window.scrollTo({ top: 0, behavior: 'smooth' });
              }}
            />
            <MenuSection
              menuState={menuState}
              cartItems={cartItems}
              onAddToCart={handleAddToCart}
              onUpdateQuantity={handleUpdateQuantity}
              onRetry={() => store.retrySupabaseMenu()}
              onLoadDemo={() => store.loadDemoMenu()}
            />
          </>
        )}

        {activeView === 'menu' && (
          <div className="pt-4">
            <MenuSection
              menuState={menuState}
              cartItems={cartItems}
              onAddToCart={handleAddToCart}
              onUpdateQuantity={handleUpdateQuantity}
              onRetry={() => store.retrySupabaseMenu()}
              onLoadDemo={() => store.loadDemoMenu()}
            />
          </div>
        )}

        {activeView === 'track' && (
          <OrderTrackingView
            initialOrderNumber={trackingOrderNumber}
            initialTrackingToken={trackingOrderToken}
            onBackToMenu={() => handleNavigate('menu')}
          />
        )}

        {activeView === 'admin' && isAdminAuthenticated && (
          <AdminDashboard
            onLogout={handleAdminLogout}
            onOpenSupabaseStatus={() => setIsSupabaseModalOpen(true)}
          />
        )}

        {activeView === 'delivery' && activeDeliveryPartner && (
          <DeliveryDashboard
            partner={activeDeliveryPartner}
            onLogout={async () => {
              if (supabase) {
                await supabase.auth.signOut().catch(() => {});
              }
              setActiveDeliveryPartner(null);
              setActiveView('home');
            }}
          />
        )}
      </main>

      {/* Sticky Mobile Cart Bar (Under 15% mobile viewport cap) */}
      {totalCartCount > 0 &&
        !isCartOpen &&
        !isCheckoutOpen &&
        ['home', 'menu'].includes(activeView) && (
          <div className="fixed bottom-0 inset-x-0 z-40 bg-white/95 backdrop-blur-md border-t border-[#EAE2D6] p-3 shadow-lg md:hidden">
            <button
              type="button"
              onClick={() => setIsCartOpen(true)}
              className="w-full h-12 px-4 bg-[#801323] hover:bg-[#680E19] text-white rounded-xl flex items-center justify-between font-semibold text-xs uppercase tracking-wider shadow-md cursor-pointer"
            >
              <div className="flex items-center gap-2">
                <ShoppingBag className="w-4 h-4 text-[#DFB24E]" />
                <span>
                  {totalCartCount} {totalCartCount === 1 ? 'Item' : 'Items'} ·{' '}
                  <span className="font-mono text-sm">₹{cartSubtotal}</span>
                </span>
              </div>
              <div className="flex items-center gap-1 text-[#DFB24E]">
                <span>View Bag</span>
                <ArrowRight className="w-4 h-4" />
              </div>
            </button>
          </div>
        )}

      {/* Cart Drawer */}
      <CartDrawer
        isOpen={isCartOpen}
        onClose={() => setIsCartOpen(false)}
        cartItems={cartItems}
        onUpdateQuantity={handleUpdateQuantity}
        onRemoveItem={handleRemoveItem}
        onProceedToCheckout={handleProceedToCheckout}
      />

      {/* Checkout Modal */}
      <CheckoutModal
        isOpen={isCheckoutOpen}
        onClose={() => setIsCheckoutOpen(false)}
        cartItems={cartItems}
        onOrderSuccess={handleOrderSuccess}
      />

      {/* Order Confirmation Modal */}
      <OrderConfirmationModal
        order={lastPlacedOrder}
        isOpen={isConfirmationOpen}
        onClose={() => setIsConfirmationOpen(false)}
        onTrackOrder={handleTrackOrderFromConfirmation}
      />

      {/* Admin Login Modal Gate */}
      <AdminLoginModal
        isOpen={isAdminLoginModalOpen}
        onClose={() => setIsAdminLoginModalOpen(false)}
        onLoginSuccess={() => {
          setIsAdminLoginModalOpen(false);
          setIsAdminAuthenticated(true);
          setActiveView('admin');
        }}
      />

      {/* Delivery Partner Login Modal Gate */}
      <DeliveryLoginModal
        isOpen={isDeliveryLoginModalOpen}
        onClose={() => setIsDeliveryLoginModalOpen(false)}
        onLoginSuccess={(partner) => {
          setIsDeliveryLoginModalOpen(false);
          setActiveDeliveryPartner(partner);
          setActiveView('delivery');
        }}
      />

      {/* Supabase Architecture & Guide Modal */}
      <SupabaseConfigGuideModal
        isOpen={isSupabaseModalOpen}
        onClose={() => setIsSupabaseModalOpen(false)}
      />

      {/* Global Footer */}
      <Footer onNavigate={handleNavigate} />
    </div>
  );
}
