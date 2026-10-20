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
import { ShoppingBag, ArrowRight, ShieldCheck, Bike, Sparkles, KeyRound, Lock } from 'lucide-react';

const ACTIVE_VIEW_STORAGE_KEY = 'kadhai_active_view';
const TRACKING_ORDER_KEY = 'kadhai_tracking_order_number';
const TRACKING_TOKEN_KEY = 'kadhai_tracking_order_token';

type AppView = 'home' | 'menu' | 'track' | 'admin' | 'delivery' | 'supabase_status';

const parseInitialView = (): AppView => {
  try {
    const rawHash = window.location.hash.toLowerCase().replace(/^#\/?/, '');
    const cleanHash = rawHash.split('?')[0].split('/')[0];
    const validViews: AppView[] = ['home', 'menu', 'track', 'admin', 'delivery'];
    if (validViews.includes(cleanHash as AppView)) {
      return cleanHash as AppView;
    }
    const stored = localStorage.getItem(ACTIVE_VIEW_STORAGE_KEY);
    if (stored && validViews.includes(stored as AppView)) {
      return stored as AppView;
    }
  } catch {
    // ignore
  }
  return 'home';
};

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
  const [activeView, setActiveView] = useState<AppView>(parseInitialView);
  const [isAuthChecking, setIsAuthChecking] = useState<boolean>(isSupabaseConfigured);

  // Menu items & fetch state from reactive store
  const [menuState, setMenuState] = useState<MenuState>(store.getMenuState());

  // Cart State
  const [cartItems, setCartItems] = useState<CartItem[]>([]);
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [isCheckoutOpen, setIsCheckoutOpen] = useState(false);

  // Order Placement & Tracking State (persisted to localStorage)
  const [lastPlacedOrder, setLastPlacedOrder] = useState<Order | null>(null);
  const [isConfirmationOpen, setIsConfirmationOpen] = useState(false);
  const [trackingOrderNumber, setTrackingOrderNumber] = useState<string | undefined>(() => {
    try {
      return localStorage.getItem(TRACKING_ORDER_KEY) || undefined;
    } catch {
      return undefined;
    }
  });
  const [trackingOrderToken, setTrackingOrderToken] = useState<string | undefined>(() => {
    try {
      return localStorage.getItem(TRACKING_TOKEN_KEY) || undefined;
    } catch {
      return undefined;
    }
  });

  // Authentication State
  const [isAdminAuthenticated, setIsAdminAuthenticated] = useState<boolean>(() => {
    try {
      return localStorage.getItem('mantsa_admin_demo_session') === 'true';
    } catch {
      return false;
    }
  });
  const [isAdminLoginModalOpen, setIsAdminLoginModalOpen] = useState(false);

  const [activeDeliveryPartner, setActiveDeliveryPartner] = useState<DeliveryPartner | null>(() => {
    try {
      const stored = localStorage.getItem('mantsa_active_rider');
      if (stored) return JSON.parse(stored);
    } catch {
      // ignore
    }
    return null;
  });
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

  // Failsafe timer: ensures auth checking doesn't indefinitely hang UI
  useEffect(() => {
    if (!isSupabaseConfigured) {
      setIsAuthChecking(false);
      return;
    }
    const timer = setTimeout(() => {
      setIsAuthChecking(false);
    }, 2500);
    return () => clearTimeout(timer);
  }, []);

  // Sync route on browser URL hash changes (back/forward navigation)
  useEffect(() => {
    const handleHashChange = () => {
      const route = parseInitialView();
      setActiveView((prev) => (prev !== route ? route : prev));
    };
    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, []);

  // Secure Admin & Rider Authentication Lifecycle:
  // 1. Single unified onAuthStateChange pipeline (handles INITIAL_SESSION, SIGNED_IN, TOKEN_REFRESHED, USER_UPDATED, SIGNED_OUT)
  // 2. Executes verifyAdminRole inside a deferred task (setTimeout 0) to prevent Gotrue Auth lock/deadlock
  // 3. Employs an authRequestId sequence counter to prevent stale async verification results from overwriting newer states
  // 4. Guaranteed fail-closed behavior: invalid session, non-admin role, or missing profile revokes access
  useEffect(() => {
    const client = supabase;
    if (!isSupabaseConfigured || !client) {
      const isDemoAdmin = localStorage.getItem('mantsa_admin_demo_session') === 'true';
      setIsAdminAuthenticated(isDemoAdmin);
      setIsAuthChecking(false);
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

        // Sign out or absent session => immediate fail-closed revocation for admin
        if (event === 'SIGNED_OUT' || !session?.user) {
          setIsAuthChecking(false);
          setIsAdminAuthenticated(false);
          setActiveDeliveryPartner((prev) => {
            // Keep local fleet rider if logged in as local fleet rider (dp-*)
            if (prev && !prev.id.startsWith('dp-')) {
              try {
                localStorage.removeItem('mantsa_active_rider');
              } catch {
                // ignore
              }
              return null;
            }
            return prev;
          });
          setActiveView((current) => {
            if (current === 'admin') {
              try {
                localStorage.setItem(ACTIVE_VIEW_STORAGE_KEY, 'home');
                window.location.hash = '';
              } catch {
                // ignore
              }
              return 'home';
            }
            return current;
          });
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

          setIsAuthChecking(false);

          if (isAdmin) {
            setIsAdminAuthenticated(true);
            const initialRoute = parseInitialView();
            if (initialRoute === 'admin') {
              setActiveView('admin');
              try {
                localStorage.setItem(ACTIVE_VIEW_STORAGE_KEY, 'admin');
              } catch {
                // ignore
              }
            }
          } else {
            setIsAdminAuthenticated(false);

            // Check if user is a delivery partner
            try {
              const { data: profile } = await client
                .from('profiles')
                .select('id, role, full_name, phone, is_active')
                .eq('id', session.user.id)
                .maybeSingle();

              if (
                profile &&
                (profile.role === 'delivery' || profile.role === 'delivery_partner') &&
                profile.is_active === true
              ) {
                const partner: DeliveryPartner = {
                  id: profile.id,
                  name: profile.full_name || 'Delivery Partner',
                  phone: profile.phone || '',
                  vehicle: 'Fleet / Bike',
                  activeOrdersCount: 0,
                };
                setActiveDeliveryPartner(partner);
                store.fetchOrdersForDeliveryPartner(profile.id);
                if (parseInitialView() === 'delivery') {
                  setActiveView('delivery');
                }
                return;
              }
            } catch (err) {
              console.warn('Rider profile check error:', err);
            }

            setActiveView((current) => {
              if (current === 'admin') {
                try {
                  localStorage.setItem(ACTIVE_VIEW_STORAGE_KEY, 'home');
                  window.location.hash = '';
                } catch {
                  // ignore
                }
                return 'home';
              }
              return current;
            });
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
    try {
      localStorage.setItem(ACTIVE_VIEW_STORAGE_KEY, 'home');
      localStorage.removeItem('kadhai_admin_tab');
      localStorage.removeItem('mantsa_admin_demo_session');
      window.location.hash = '';
    } catch {
      // ignore
    }
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
    try {
      localStorage.setItem(TRACKING_ORDER_KEY, order.orderNumber);
      if (order.trackingToken) {
        localStorage.setItem(TRACKING_TOKEN_KEY, order.trackingToken);
      }
    } catch {
      // ignore
    }
    setIsConfirmationOpen(true);
  };

  const handleTrackOrderFromConfirmation = (orderNumber: string, trackingToken?: string) => {
    setIsConfirmationOpen(false);
    setTrackingOrderNumber(orderNumber);
    setTrackingOrderToken(trackingToken);
    try {
      localStorage.setItem(TRACKING_ORDER_KEY, orderNumber);
      if (trackingToken) {
        localStorage.setItem(TRACKING_TOKEN_KEY, trackingToken);
      }
    } catch {
      // ignore
    }
    handleNavigate('track');
  };

  // View Navigation Router with persistent URL hash and localStorage synchronization
  const handleNavigate = (view: AppView) => {
    if (view === 'supabase_status') {
      setIsSupabaseModalOpen(true);
      return;
    }

    if (view === 'admin') {
      if (!isAdminAuthenticated && !isAuthChecking) {
        setIsAdminLoginModalOpen(true);
        return;
      }
      setActiveView('admin');
      try {
        localStorage.setItem(ACTIVE_VIEW_STORAGE_KEY, 'admin');
        const storedAdminTab = localStorage.getItem('kadhai_admin_tab') || 'orders';
        window.location.hash = `#admin/${storedAdminTab}`;
      } catch {
        // ignore
      }
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }

    if (view === 'delivery') {
      setActiveView('delivery');
      try {
        localStorage.setItem(ACTIVE_VIEW_STORAGE_KEY, 'delivery');
        window.location.hash = '#delivery';
      } catch {
        // ignore
      }
      if (!activeDeliveryPartner) {
        setIsDeliveryLoginModalOpen(true);
      }
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }

    setActiveView(view);
    try {
      localStorage.setItem(ACTIVE_VIEW_STORAGE_KEY, view);
      window.location.hash = view === 'home' ? '' : `#${view}`;
    } catch {
      // ignore
    }
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
        isAdmin={isAdminAuthenticated}
        isRider={Boolean(activeDeliveryPartner)}
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
                  handleNavigate('menu');
                }
              }}
              onExploreMenu={() => {
                handleNavigate('menu');
              }}
            />
            <MenuSection
              menuState={menuState}
              cartItems={cartItems}
              onAddToCart={handleAddToCart}
              onUpdateQuantity={handleUpdateQuantity}
              onRetry={() => store.retrySupabaseMenu()}
              onLoadDemo={() => store.loadDemoMenu()}
              onProceedToCheckout={handleProceedToCheckout}
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
              onProceedToCheckout={handleProceedToCheckout}
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

        {activeView === 'admin' && (
          isAuthChecking ? (
            <div className="min-h-[60vh] flex flex-col items-center justify-center p-8 text-center">
              <div className="w-10 h-10 rounded-full border-3 border-[#801323]/20 border-t-[#801323] animate-spin mb-4" />
              <p className="text-sm font-semibold text-stone-800">Restoring Admin Console...</p>
              <p className="text-xs text-stone-500 mt-1">Verifying your active administrator session</p>
            </div>
          ) : isAdminAuthenticated ? (
            <AdminDashboard
              onLogout={handleAdminLogout}
              onOpenSupabaseStatus={() => setIsSupabaseModalOpen(true)}
            />
          ) : (
            <div className="min-h-[55vh] flex flex-col items-center justify-center p-8 text-center max-w-md mx-auto">
              <div className="w-14 h-14 bg-amber-50 border border-amber-200 rounded-2xl flex items-center justify-center text-[#801323] mx-auto mb-4 shadow-xs">
                <ShieldCheck className="w-7 h-7" />
              </div>
              <h3 className="text-xl font-serif font-bold text-stone-800 mb-2">Administrator Access</h3>
              <p className="text-sm text-stone-600 mb-6 leading-relaxed">
                You are accessing the restaurant management console. Please sign in with your admin credentials to continue.
              </p>
              <div className="flex items-center gap-3 w-full sm:w-auto">
                <button
                  type="button"
                  onClick={() => handleNavigate('home')}
                  className="flex-1 sm:flex-none px-4 py-2.5 border border-stone-300 rounded-xl text-xs font-semibold uppercase tracking-wider text-stone-700 hover:bg-stone-50 transition-colors cursor-pointer"
                >
                  Return to Home
                </button>
                <button
                  type="button"
                  onClick={() => setIsAdminLoginModalOpen(true)}
                  className="flex-1 sm:flex-none px-5 py-2.5 bg-[#801323] hover:bg-[#680e19] text-white rounded-xl text-xs font-semibold uppercase tracking-wider shadow-sm transition-colors cursor-pointer"
                >
                  Sign In as Admin
                </button>
              </div>
            </div>
          )
        )}

        {activeView === 'delivery' && (
          isAuthChecking && activeDeliveryPartner ? (
            <div className="min-h-[60vh] flex flex-col items-center justify-center p-8 text-center">
              <div className="w-10 h-10 rounded-full border-3 border-[#801323]/20 border-t-[#801323] animate-spin mb-4" />
              <p className="text-sm font-semibold text-stone-800">Restoring Rider Console...</p>
              <p className="text-xs text-stone-500 mt-1">Verifying your active rider session</p>
            </div>
          ) : activeDeliveryPartner ? (
            <DeliveryDashboard
              partner={activeDeliveryPartner}
              onLogout={async () => {
                if (supabase) {
                  await supabase.auth.signOut().catch(() => {});
                }
                try {
                  localStorage.removeItem('mantsa_active_rider');
                  localStorage.setItem(ACTIVE_VIEW_STORAGE_KEY, 'home');
                  window.location.hash = '';
                } catch {
                  // ignore
                }
                setActiveDeliveryPartner(null);
                setActiveView('home');
              }}
            />
          ) : (
            <div className="min-h-[55vh] flex flex-col items-center justify-center p-8 text-center max-w-md mx-auto">
              <div className="w-14 h-14 bg-amber-50 border border-amber-200 rounded-2xl flex items-center justify-center text-[#801323] mx-auto mb-4 shadow-xs">
                <Bike className="w-7 h-7 text-[#DFB24E]" />
              </div>
              <h3 className="text-xl font-serif font-bold text-stone-800 mb-2">
                Delivery Partner Portal
              </h3>
              <p className="text-sm text-stone-600 mb-6 leading-relaxed">
                Doorstep delivery terminal for Mantasha Biryani riders. Please sign in with your Rider ID or Email and Password to access assigned delivery orders.
              </p>
              <div className="flex items-center gap-3 w-full sm:w-auto">
                <button
                  type="button"
                  onClick={() => handleNavigate('home')}
                  className="flex-1 sm:flex-none px-4 py-2.5 border border-stone-300 rounded-xl text-xs font-semibold uppercase tracking-wider text-stone-700 hover:bg-stone-50 transition-colors cursor-pointer"
                >
                  Return to Home
                </button>
                <button
                  type="button"
                  onClick={() => setIsDeliveryLoginModalOpen(true)}
                  className="flex-1 sm:flex-none px-5 py-2.5 bg-[#801323] hover:bg-[#680E19] text-white rounded-xl text-xs font-semibold uppercase tracking-wider shadow-sm transition-colors cursor-pointer flex items-center justify-center gap-2"
                >
                  <KeyRound className="w-4 h-4 text-[#DFB24E]" />
                  <span>Sign In as Rider</span>
                </button>
              </div>
            </div>
          )
        )}
      </main>

      {/* Sticky Mobile Cart Bar (Under 15% mobile viewport cap - Hidden for Admin & Rider) */}
      {totalCartCount > 0 &&
        !isCartOpen &&
        !isCheckoutOpen &&
        !isAdminAuthenticated &&
        !activeDeliveryPartner &&
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
          try {
            localStorage.setItem(ACTIVE_VIEW_STORAGE_KEY, 'admin');
            const storedAdminTab = localStorage.getItem('kadhai_admin_tab') || 'orders';
            window.location.hash = `#admin/${storedAdminTab}`;
          } catch {
            // ignore
          }
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
          try {
            localStorage.setItem('mantsa_active_rider', JSON.stringify(partner));
            localStorage.setItem(ACTIVE_VIEW_STORAGE_KEY, 'delivery');
            window.location.hash = '#delivery';
          } catch {
            // ignore
          }
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
