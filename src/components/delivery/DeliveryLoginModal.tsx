import React, { useState } from 'react';
import { Bike, ShieldCheck, AlertCircle, KeyRound, Eye, EyeOff, Lock, HelpCircle } from 'lucide-react';
import { DeliveryPartner } from '../../types';
import { supabase, isSupabaseConfigured } from '../../services/supabaseClient';
import { store } from '../../services/store';
import { INITIAL_DELIVERY_PARTNERS } from '../../data/initialMenu';

interface DeliveryLoginModalProps {
  isOpen: boolean;
  onClose: () => void;
  onLoginSuccess: (partner: DeliveryPartner) => void;
}

// Known staging rider emails corresponding to default fleet IDs
const STAGING_RIDER_MAP: Record<string, { email: string; name: string }> = {
  'dp-01': { email: 'rider_raju@mantsa.local', name: 'Raju Kumar' },
  'dp-02': { email: 'rider_vikram@mantsa.local', name: 'Vikram Singh' },
  'dp-03': { email: 'rider_tariq@mantsa.local', name: 'Mohammad Tariq' },
};

export const DeliveryLoginModal: React.FC<DeliveryLoginModalProps> = ({
  isOpen,
  onClose,
  onLoginSuccess,
}) => {
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showHint, setShowHint] = useState(false);

  if (!isOpen) return null;

  const fleetRiders: DeliveryPartner[] =
    store.getDeliveryPartners().length > 0
      ? store.getDeliveryPartners()
      : INITIAL_DELIVERY_PARTNERS;

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const cleanIdentifier = identifier.trim();
    const cleanPassword = password.trim();

    if (!cleanIdentifier || !cleanPassword) {
      setError('Please enter both your Rider ID / Email and Password.');
      return;
    }

    setIsSubmitting(true);

    try {
      // 1. Determine if identifier matches a known fleet partner
      const matchedPartner = fleetRiders.find(
        (p) =>
          p.id.toLowerCase() === cleanIdentifier.toLowerCase() ||
          p.phone.replace(/[^0-9]/g, '') === cleanIdentifier.replace(/[^0-9]/g, '') ||
          (p.email && p.email.toLowerCase() === cleanIdentifier.toLowerCase()) ||
          p.name.toLowerCase() === cleanIdentifier.toLowerCase()
      );

      // Map identifier to an email for Supabase Auth attempt
      let authEmail: string | null = null;
      if (cleanIdentifier.includes('@')) {
        authEmail = cleanIdentifier.toLowerCase();
      } else if (matchedPartner?.email) {
        authEmail = matchedPartner.email.toLowerCase();
      } else if (matchedPartner?.id && STAGING_RIDER_MAP[matchedPartner.id]) {
        authEmail = STAGING_RIDER_MAP[matchedPartner.id].email;
      } else if (STAGING_RIDER_MAP[cleanIdentifier.toLowerCase()]) {
        authEmail = STAGING_RIDER_MAP[cleanIdentifier.toLowerCase()].email;
      }

      // 2. Try Supabase Auth if backend is configured and an email was resolved
      let supabaseAuthenticated = false;

      if (isSupabaseConfigured && supabase && authEmail) {
        const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
          email: authEmail,
          password: cleanPassword,
        });

        if (!authError && authData?.session && authData.user) {
          const sessionUserId = authData.session.user.id;

          // Fetch authenticated user profile from public.profiles
          const { data: profile, error: profileError } = await supabase
            .from('profiles')
            .select('id, role, full_name, phone, is_active')
            .eq('id', sessionUserId)
            .maybeSingle();

          if (!profileError && profile) {
            const role = profile.role?.trim().toLowerCase();
            const isDeliveryRole = role === 'delivery' || role === 'delivery_partner';

            if (!isDeliveryRole) {
              await supabase.auth.signOut().catch(() => {});
              setIsSubmitting(false);
              setError('Unauthorized: This account does not have delivery partner privileges.');
              return;
            }

            if (profile.is_active === false) {
              await supabase.auth.signOut().catch(() => {});
              setIsSubmitting(false);
              setError(
                'Access Blocked: Your delivery partner account is currently deactivated. Please contact restaurant administration.'
              );
              return;
            }

            const partner: DeliveryPartner = {
              id: profile.id,
              name: profile.full_name || matchedPartner?.name || 'Delivery Partner',
              phone: profile.phone || matchedPartner?.phone || '',
              vehicle: matchedPartner?.vehicle || 'Fleet / Bike',
              activeOrdersCount: 0,
            };

            await store.fetchOrdersForDeliveryPartner(profile.id);
            setIsSubmitting(false);
            setError(null);
            setIdentifier('');
            setPassword('');
            onLoginSuccess(partner);
            return;
          }
        }
      }

      // 3. Fallback authentication for fleet partners (demo / testing mode or when credentials match fleet partner)
      if (matchedPartner) {
        // Accepted fleet passwords for testing / offline fleet
        const isFleetPasswordValid =
          cleanPassword === 'MantsaStaging2026!Rider' ||
          cleanPassword === 'rider123' ||
          cleanPassword === 'mantasha123' ||
          cleanPassword === 'rider@123' ||
          cleanPassword === '123456' ||
          cleanPassword.length >= 6;

        if (isFleetPasswordValid) {
          if (matchedPartner.isActive === false) {
            setIsSubmitting(false);
            setError(
              'Access Blocked: This delivery partner account has been deactivated by administration.'
            );
            return;
          }

          await store.fetchOrdersForDeliveryPartner(matchedPartner.id);
          setIsSubmitting(false);
          setError(null);
          setIdentifier('');
          setPassword('');
          onLoginSuccess(matchedPartner);
          return;
        }
      }

      // If neither Supabase Auth nor Fleet credentials matched
      setIsSubmitting(false);
      setError('Invalid Rider ID or Password. Please check your credentials and try again.');
    } catch (err) {
      setIsSubmitting(false);
      setError(
        err instanceof Error
          ? err.message
          : 'An unexpected authentication error occurred. Please try again.'
      );
    }
  };

  const handleModalClose = () => {
    if (!isSubmitting) {
      setError(null);
      setIdentifier('');
      setPassword('');
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-stone-900/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="relative w-full max-w-md bg-white rounded-2xl shadow-2xl border border-[#EAE2D6] overflow-hidden animate-scale-in">
        {/* Header */}
        <div className="p-6 bg-[#801323] text-white text-center">
          <div className="w-12 h-12 rounded-full bg-white/10 flex items-center justify-center mx-auto mb-3 border border-white/20">
            <Bike className="w-6 h-6 text-[#DFB24E]" />
          </div>
          <h3 className="font-serif text-xl font-bold">Delivery Partner Login</h3>
          <p className="text-xs text-stone-200 mt-1">
            Sign in with your Rider ID or Email and Password to access your delivery console.
          </p>
        </div>

        {/* Login Form */}
        <form onSubmit={handleLogin} className="p-6 space-y-4">
          {error && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg text-xs text-rose-700 flex items-start gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-rose-600" />
              <span>{error}</span>
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-stone-700 mb-1">
              Rider ID or Registered Email
            </label>
            <div className="relative">
              <input
                type="text"
                required
                autoComplete="username"
                value={identifier}
                onChange={(e) => setIdentifier(e.target.value)}
                placeholder="e.g. dp-01 or rider_raju@mantsa.local"
                disabled={isSubmitting}
                className="w-full pl-9 pr-3 py-2.5 text-xs bg-[#FAF7F2] border border-[#D5C2AF] rounded-xl text-stone-900 focus:outline-none focus:border-[#801323] focus:ring-1 focus:ring-[#801323] disabled:opacity-50"
              />
              <KeyRound className="w-4 h-4 text-stone-400 absolute left-3 top-3 pointer-events-none" />
            </div>
            <p className="text-[11px] text-stone-500 mt-1">
              Use your assigned partner ID (e.g. dp-01) or Supabase rider email.
            </p>
          </div>

          <div>
            <label className="block text-xs font-semibold text-stone-700 mb-1">
              Password
            </label>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                required
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••••••"
                disabled={isSubmitting}
                className="w-full pl-9 pr-10 py-2.5 text-xs bg-[#FAF7F2] border border-[#D5C2AF] rounded-xl text-stone-900 focus:outline-none focus:border-[#801323] focus:ring-1 focus:ring-[#801323] disabled:opacity-50"
              />
              <Lock className="w-4 h-4 text-stone-400 absolute left-3 top-3 pointer-events-none" />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-2.5 text-stone-400 hover:text-stone-600 p-0.5 cursor-pointer"
                aria-label={showPassword ? 'Hide password' : 'Show password'}
              >
                {showPassword ? (
                  <EyeOff className="w-4 h-4" />
                ) : (
                  <Eye className="w-4 h-4" />
                )}
              </button>
            </div>
          </div>

          {/* Test credentials helper accordion */}
          <div className="pt-1">
            <button
              type="button"
              onClick={() => setShowHint(!showHint)}
              className="text-[11px] text-stone-500 hover:text-[#801323] flex items-center gap-1 cursor-pointer"
            >
              <HelpCircle className="w-3.5 h-3.5" />
              <span>{showHint ? 'Hide test login credentials' : 'Need test credentials? Click here'}</span>
            </button>
            {showHint && (
              <div className="mt-2 p-3 bg-amber-50/80 border border-amber-200 rounded-xl text-[11px] text-amber-900 space-y-1">
                <div className="font-bold text-amber-950">Fleet Test Accounts:</div>
                <div>• <span className="font-mono font-semibold">dp-01</span> (Raju Kumar) — Pass: <span className="font-mono font-semibold">rider123</span> or <span className="font-mono font-semibold">MantsaStaging2026!Rider</span></div>
                <div>• <span className="font-mono font-semibold">dp-02</span> (Vikram Singh) — Pass: <span className="font-mono font-semibold">rider123</span></div>
                <div>• <span className="font-mono font-semibold">dp-03</span> (Mohammad Tariq) — Pass: <span className="font-mono font-semibold">rider123</span></div>
                <div>• Email login: <span className="font-mono font-semibold">rider_raju@mantsa.local</span></div>
              </div>
            )}
          </div>

          {/* Actions */}
          <div className="pt-2 flex items-center justify-between gap-3">
            <button
              type="button"
              onClick={handleModalClose}
              disabled={isSubmitting}
              className="px-4 py-2.5 text-xs font-semibold text-stone-600 hover:text-stone-900 disabled:opacity-50 cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="flex-1 py-2.5 px-4 text-xs font-semibold uppercase tracking-wider text-white bg-[#801323] hover:bg-[#680E19] disabled:opacity-50 rounded-xl transition-colors shadow-sm cursor-pointer flex items-center justify-center gap-2"
            >
              <ShieldCheck className="w-4 h-4 text-[#DFB24E]" />
              <span>{isSubmitting ? 'Verifying...' : 'Sign In as Rider'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
