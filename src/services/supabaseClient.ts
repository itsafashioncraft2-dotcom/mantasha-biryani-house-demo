import { createClient, SupabaseClient } from '@supabase/supabase-js';

/**
 * Supabase Client Initialization & Configuration Status
 * 
 * Safely reads environment variables without exposing secrets or printing
 * confidential keys to the console/UI.
 */

const envUrl = (import.meta.env.VITE_SUPABASE_URL ?? '').trim();
const envAnonKey = (import.meta.env.VITE_SUPABASE_ANON_KEY ?? '').trim();


// Determine if valid Supabase credentials are provided
export const isSupabaseConfigured = Boolean(
  envUrl &&
  envAnonKey &&
  envUrl !== 'https://your-project.supabase.co' &&
  envAnonKey !== 'your-anon-key' &&
  envUrl.startsWith('https://')
);

// Create and export the real Supabase client instance
export const supabase: SupabaseClient | null = isSupabaseConfigured
  ? createClient(envUrl, envAnonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
      },
    })
  : null;

/**
 * Helper to obtain the Supabase client safely with user-friendly error validation.
 */
export function getSupabaseClient(): SupabaseClient {
  if (!supabase) {
    throw new Error(
      'Supabase client is not initialized. Please ensure VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY are set in your environment.'
    );
  }
  return supabase;
}

/**
 * Isolated Supabase client that does not persist session or touch localStorage.
 * Used for creating new rider auth accounts without overriding the admin's active session.
 */
export function createIsolatedAuthClient(): SupabaseClient | null {
  if (!isSupabaseConfigured || !envUrl || !envAnonKey) return null;
  return createClient(envUrl, envAnonKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
      storage: {
        getItem: () => null,
        setItem: () => {},
        removeItem: () => {},
      },
    },
  });
}

export interface SupabaseConfigStatus {
  isConfigured: boolean;
  hasUrl: boolean;
  hasAnonKey: boolean;
  supabaseUrl: string | null;
  missingEnvVars: string[];
}

export function getSupabaseConfigStatus(): SupabaseConfigStatus {
  const missing: string[] = [];
  if (!envUrl || envUrl === 'https://your-project.supabase.co') {
    missing.push('VITE_SUPABASE_URL');
  }
  if (!envAnonKey || envAnonKey === 'your-anon-key') {
    missing.push('VITE_SUPABASE_ANON_KEY');
  }

  return {
    isConfigured: isSupabaseConfigured,
    hasUrl: Boolean(envUrl && envUrl.startsWith('https://')),
    hasAnonKey: Boolean(envAnonKey && envAnonKey.length > 20),
    supabaseUrl: isSupabaseConfigured ? envUrl : null,
    missingEnvVars: missing,
  };
}

export interface FeatureStatus {
  name: string;
  category: 'Customer' | 'Admin' | 'Delivery' | 'Security';
  currentStatus: string;
  details: string;
}

export const SUPABASE_FEATURES_AUDIT: FeatureStatus[] = [
  {
    name: 'Menu Catalog from public.menu_items',
    category: 'Customer',
    currentStatus: isSupabaseConfigured ? 'Connected to Supabase' : 'Demo Fallback Mode',
    details: 'Fetches live dishes from PostgreSQL table `public.menu_items` with trusted database prices.',
  },
  {
    name: 'Cart & Authoritative Price Recalculation',
    category: 'Customer',
    currentStatus: 'Active (₹150 Min Subtotal · ₹40 Delivery · ₹499 Free)',
    details: 'Enforces database business rules: minimum order ₹150, delivery fee ₹40 under ₹499, zero fee at ₹499+.',
  },
  {
    name: 'Order Submission & Anonymous Auth',
    category: 'Customer',
    currentStatus: isSupabaseConfigured ? 'Connected (Anonymous Sign-In + RPC)' : 'Local Storage Mode',
    details: 'Generates Supabase anonymous session, validates customer details, and calls create_order RPC.',
  },
  {
    name: 'Role-Based Access Control & RLS',
    category: 'Security',
    currentStatus: isSupabaseConfigured ? 'Active via Supabase Auth & RLS' : 'Local Isolation Active',
    details: 'Customer data shielded by Row-Level Security; admin and delivery access segregated.',
  },
];
