import React, { useState } from 'react';
import { Bike, ShieldCheck, AlertCircle } from 'lucide-react';
import { DeliveryPartner } from '../../types';
import { supabase, isSupabaseConfigured } from '../../services/supabaseClient';
import { store } from '../../services/store';

interface DeliveryLoginModalProps {
  isOpen: boolean;
  onClose: () => void;
  onLoginSuccess: (partner: DeliveryPartner) => void;
}

export const DeliveryLoginModal: React.FC<DeliveryLoginModalProps> = ({
  isOpen,
  onClose,
  onLoginSuccess,
}) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isOpen) return null;

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    // Fail-closed: Supabase must be configured
    if (!isSupabaseConfigured || !supabase) {
      setError(
        'Supabase is not configured. Delivery partner portal requires an active database connection.'
      );
      return;
    }

    setIsSubmitting(true);

    try {
      // 1. Authenticate with Supabase Auth using email and password
      const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });

      if (authError || !authData?.user) {
        setIsSubmitting(false);
        setError(authError?.message || 'Invalid delivery partner credentials. Please verify your email and password.');
        return;
      }

      // 2. Verify active session and user ID
      const session = authData.session;
      const sessionUserId = session?.user?.id;

      if (!session || !sessionUserId) {
        setIsSubmitting(false);
        setError('No active session was established. Please verify your credentials or check your email confirmation.');
        return;
      }

      // 3. Fetch authenticated user profile from public.profiles
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('id, role, full_name, phone, is_active')
        .eq('id', sessionUserId)
        .maybeSingle();

      if (profileError) {
        await supabase.auth.signOut().catch(() => {});
        setIsSubmitting(false);
        setError('Error verifying delivery partner profile. Access denied.');
        return;
      }

      if (!profile) {
        await supabase.auth.signOut().catch(() => {});
        setIsSubmitting(false);
        setError('Profile not found. Access denied.');
        return;
      }

      // 4. Role verification & Deactivation Check: allow access only if active delivery role
      const role = profile.role?.trim().toLowerCase();
      const isDeliveryRole = role === 'delivery' || role === 'delivery_partner';

      if (!isDeliveryRole) {
        await supabase.auth.signOut().catch(() => {});
        setIsSubmitting(false);
        setError('Unauthorized: This account does not have delivery partner privileges.');
        return;
      }

      // Reject if rider profile is not explicitly active in the database (fail-closed)
      if (profile.is_active !== true) {
        await supabase.auth.signOut().catch(() => {});
        setIsSubmitting(false);
        setError(
          'Access Blocked: Your delivery partner account is currently deactivated. Restaurant administration has revoked Rider Console access while retaining your prior delivery history. Please contact management.'
        );
        return;
      }

      // 5. Build DeliveryPartner object
      const partner: DeliveryPartner = {
        id: profile.id,
        name: profile.full_name || 'Delivery Partner',
        phone: profile.phone || '',
        vehicle: 'Fleet / Bike',
        activeOrdersCount: 0,
      };

      // Refresh orders from Supabase for this authenticated partner
      await store.fetchOrdersForDeliveryPartner(profile.id);

      setIsSubmitting(false);
      setError(null);
      setEmail('');
      setPassword('');
      onLoginSuccess(partner);
    } catch (err) {
      await supabase.auth.signOut().catch(() => {});
      setIsSubmitting(false);
      setError(
        err instanceof Error
          ? err.message
          : 'An unexpected authentication error occurred while connecting to Supabase.'
      );
    }
  };

  const handleModalClose = () => {
    if (!isSubmitting) {
      setError(null);
      setEmail('');
      setPassword('');
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-stone-900/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="relative w-full max-w-md bg-white rounded-2xl shadow-2xl border border-[#EAE2D6] overflow-hidden">
        {/* Header */}
        <div className="p-6 bg-[#801323] text-white text-center">
          <div className="w-12 h-12 rounded-full bg-white/10 flex items-center justify-center mx-auto mb-3 border border-white/20">
            <Bike className="w-6 h-6 text-[#DFB24E]" />
          </div>
          <h3 className="font-serif text-xl font-bold">Delivery Partner Portal</h3>
          <p className="text-xs text-stone-200 mt-1">
            Doorstep fleet delivery terminal for Bhagalpur riders.
          </p>
        </div>

        <form onSubmit={handleLogin} className="p-6 space-y-4">
          {error && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg text-xs text-rose-700 flex items-start gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-rose-600" />
              <span>{error}</span>
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-stone-700 mb-1">
              Rider Email
            </label>
            <input
              type="email"
              required
              autoComplete="username"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="rider@mantsabiryani.com"
              disabled={isSubmitting}
              className="w-full px-3.5 py-2 text-sm bg-[#FAF7F2] border border-[#D5C2AF] rounded-lg text-stone-900 focus:outline-none focus:border-[#801323] disabled:opacity-50"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-stone-700 mb-1">
              Rider Password
            </label>
            <input
              type="password"
              required
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••••••"
              disabled={isSubmitting}
              className="w-full px-3.5 py-2 text-sm bg-[#FAF7F2] border border-[#D5C2AF] rounded-lg text-stone-900 focus:outline-none focus:border-[#801323] disabled:opacity-50"
            />
          </div>

          <div className="pt-2 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={handleModalClose}
              disabled={isSubmitting}
              className="px-4 py-2 text-xs font-semibold text-stone-600 hover:text-stone-900 disabled:opacity-50 cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-5 py-2 text-xs font-semibold uppercase tracking-wider text-white bg-[#801323] hover:bg-[#680E19] disabled:opacity-50 rounded-lg transition-colors cursor-pointer flex items-center gap-1.5"
            >
              <ShieldCheck className="w-4 h-4" />
              <span>{isSubmitting ? 'Verifying...' : 'Login as Rider'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
