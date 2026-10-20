/**
 * Razorpay Payment Gateway Integration
 * Supports Razorpay Standard Checkout in Test Mode and Live Mode
 */

export const RAZORPAY_KEY_ID =
  (import.meta as any).env?.VITE_RAZORPAY_KEY_ID || 'rzp_test_Tp5RqfkmQufc7f';

export const isRazorpayTestMode = RAZORPAY_KEY_ID.startsWith('rzp_test_');

/**
 * Dynamically loads Razorpay checkout.js script if not already loaded on window.
 * Includes a 3000ms failsafe timeout so the UI never hangs if network/adblocker blocks the script.
 */
export const loadRazorpayScript = (): Promise<boolean> => {
  return new Promise((resolve) => {
    if (typeof window !== 'undefined' && (window as any).Razorpay) {
      resolve(true);
      return;
    }

    let settled = false;
    const timer = setTimeout(() => {
      if (!settled) {
        settled = true;
        const exists = Boolean(typeof window !== 'undefined' && (window as any).Razorpay);
        resolve(exists);
      }
    }, 2800);

    try {
      const script = document.createElement('script');
      script.src = 'https://checkout.razorpay.com/v1/checkout.js';
      script.async = true;
      script.onload = () => {
        if (!settled) {
          settled = true;
          clearTimeout(timer);
          resolve(true);
        }
      };
      script.onerror = () => {
        if (!settled) {
          settled = true;
          clearTimeout(timer);
          console.warn('[Razorpay] Failed to load Razorpay checkout.js SDK.');
          resolve(false);
        }
      };
      document.body.appendChild(script);
    } catch {
      if (!settled) {
        settled = true;
        clearTimeout(timer);
        resolve(false);
      }
    }
  });
};

export interface RazorpayPaymentSuccessResponse {
  razorpay_payment_id: string;
  razorpay_order_id?: string;
  razorpay_signature?: string;
}

export interface OpenRazorpayOptions {
  amountInRupees: number;
  orderReference?: string;
  customerName: string;
  customerPhone: string;
  onSuccess: (response: RazorpayPaymentSuccessResponse) => void;
  onDismiss?: () => void;
  onError?: (err: any) => void;
  onFallbackToDemo?: () => void;
}

/**
 * Opens Razorpay standard checkout popup.
 * If Razorpay fails to load or open in the current browser/iframe,
 * automatically falls back to onFallbackToDemo so the user is never blocked.
 */
export const openRazorpayCheckout = async ({
  amountInRupees,
  orderReference,
  customerName,
  customerPhone,
  onSuccess,
  onDismiss,
  onError,
  onFallbackToDemo,
}: OpenRazorpayOptions): Promise<void> => {
  const isLoaded = await loadRazorpayScript();
  if (!isLoaded || !(window as any).Razorpay) {
    console.warn('[Razorpay] Razorpay SDK unavailable. Triggering demo gateway fallback.');
    if (onFallbackToDemo) {
      onFallbackToDemo();
      return;
    }
    if (onError) {
      onError(new Error('Razorpay payment gateway could not be loaded. Please check your internet connection.'));
    }
    return;
  }

  const cleanPhone = customerPhone.replace(/[^0-9]/g, '');
  const formattedPhone = cleanPhone.length === 10 ? `+91${cleanPhone}` : cleanPhone;

  const options = {
    key: RAZORPAY_KEY_ID,
    amount: Math.round(amountInRupees * 100), // In paise (₹100 = 10000 paise)
    currency: 'INR',
    name: 'Mantasha Biryani House',
    description: orderReference
      ? `Royal Dum Biryani Order #${orderReference}`
      : 'Authentic Dum Handi Biryani Order',
    image: '/favicon.svg',
    prefill: {
      name: customerName,
      contact: formattedPhone,
    },
    notes: {
      merchant: 'Mantasha Biryani House Bhagalpur',
      cuisine: 'Dum Handi Biryani',
    },
    theme: {
      color: '#801323', // Royal Crimson Maroon matching the brand
    },
    modal: {
      ondismiss: () => {
        if (onDismiss) onDismiss();
      },
    },
    handler: (response: RazorpayPaymentSuccessResponse) => {
      onSuccess(response);
    },
  };

  try {
    const rzp = new (window as any).Razorpay(options);
    rzp.on('payment.failed', function (response: any) {
      console.warn('[Razorpay] Payment failed or cancelled:', response.error);
      if (onFallbackToDemo) {
        onFallbackToDemo();
        return;
      }
      if (onError) {
        onError(new Error(response.error?.description || 'Payment was unsuccessful.'));
      }
    });
    rzp.open();
  } catch (err) {
    console.error('[Razorpay] Error initializing checkout:', err);
    if (onFallbackToDemo) {
      onFallbackToDemo();
      return;
    }
    if (onError) {
      onError(err);
    }
  }
};
