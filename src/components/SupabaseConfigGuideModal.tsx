import React from 'react';
import { getSupabaseConfigStatus, SUPABASE_FEATURES_AUDIT } from '../services/supabaseClient';
import { Database, X, ShieldAlert, CheckCircle2, AlertTriangle, Copy, Check } from 'lucide-react';

interface SupabaseConfigGuideModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const SupabaseConfigGuideModal: React.FC<SupabaseConfigGuideModalProps> = ({
  isOpen,
  onClose,
}) => {
  const [copied, setCopied] = React.useState(false);

  if (!isOpen) return null;

  const status = getSupabaseConfigStatus();

  const handleCopyEnv = () => {
    const text = `VITE_SUPABASE_URL="https://your-project.supabase.co"\nVITE_SUPABASE_ANON_KEY="your-anon-public-key"`;
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-stone-900/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="relative w-full max-w-3xl bg-white rounded-2xl shadow-2xl border border-[#EAE2D6] overflow-hidden my-8">
        {/* Header */}
        <div className="p-6 bg-[#801323] text-white flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center">
              <Database className="w-6 h-6 text-[#DFB24E]" />
            </div>
            <div>
              <h2 className="font-serif text-xl font-bold">
                Supabase Backend & Security Architecture
              </h2>
              <p className="text-xs text-stone-200">
                Production PostgreSQL setup, RLS policies, and environment config for Mantasha Biryani House.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-white/70 hover:text-white p-1 cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-6 max-h-[75vh] overflow-y-auto text-xs text-stone-700">
          {/* Current Connection Status Box */}
          <div
            className={`p-4 rounded-xl border flex items-start gap-3 ${
              status.isConfigured
                ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
                : 'bg-amber-50 border-amber-200 text-amber-900'
            }`}
          >
            {status.isConfigured ? (
              <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
            ) : (
              <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
            )}
            <div>
              <h4 className="font-bold text-sm">
                {status.isConfigured
                  ? 'Supabase Cloud Database Connected'
                  : 'Running in Local Storage & Server Price Validation Mode'}
              </h4>
              <p className="mt-1 leading-relaxed">
                {status.isConfigured
                  ? `Active connection to project: ${status.supabaseUrl}`
                  : 'Orders and menu edits are currently persisted in local browser storage with server-grade price recalculation and order validation. To connect your live Supabase cloud database, provide the environment variables below.'}
              </p>
            </div>
          </div>

          {/* Security Protocol Banner */}
          <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-xl text-rose-800 flex items-start gap-2.5">
            <ShieldAlert className="w-4 h-4 text-rose-700 shrink-0 mt-0.5" />
            <div>
              <strong className="block">Zero Service-Role Key Exposure Policy:</strong>
              Never paste your <code>service_role</code> secret key or direct database password in frontend client code. Only provide the public <code>anon</code> key. Admin and delivery access is guarded via PostgreSQL Row Level Security (RLS) policies.
            </div>
          </div>

          {/* Feature-by-Feature Audit Table */}
          <div>
            <h3 className="font-serif text-sm font-bold text-stone-900 mb-2">
              Feature Implementation Status Matrix
            </h3>
            <div className="border border-[#EAE2D6] rounded-xl overflow-hidden bg-white">
              <table className="w-full text-left">
                <thead className="bg-[#FAF7F2] border-b border-[#EAE2D6] font-semibold text-stone-900">
                  <tr>
                    <th className="py-2.5 px-3">Feature</th>
                    <th className="py-2.5 px-3">Role</th>
                    <th className="py-2.5 px-3">Current Execution State</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#F2ECE1]">
                  {SUPABASE_FEATURES_AUDIT.map((feat, idx) => (
                    <tr key={idx} className="hover:bg-stone-50/50">
                      <td className="py-2 px-3 font-semibold text-stone-800">
                        {feat.name}
                        <div className="text-[10px] text-stone-500 font-normal">
                          {feat.details}
                        </div>
                      </td>
                      <td className="py-2 px-3">
                        <span className="font-mono text-[10px] bg-stone-100 px-1.5 py-0.5 rounded">
                          {feat.category}
                        </span>
                      </td>
                      <td className="py-2 px-3">
                        <span
                          className={`inline-flex items-center gap-1 font-semibold ${
                            feat.currentStatus.includes('Ready')
                              ? 'text-emerald-700'
                              : 'text-amber-700'
                          }`}
                        >
                          {feat.currentStatus.includes('Ready') ? (
                            <CheckCircle2 className="w-3.5 h-3.5" />
                          ) : (
                            <AlertTriangle className="w-3.5 h-3.5" />
                          )}
                          <span>{feat.currentStatus}</span>
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Steps to Connect Live Supabase */}
          <div className="space-y-3">
            <h3 className="font-serif text-sm font-bold text-stone-900">
              How to Connect Live Supabase in 3 Minutes
            </h3>

            <div className="space-y-2">
              <div className="p-3 bg-[#FAF7F2] rounded-lg border border-[#EAE2D6]">
                <strong>Step 1: Run SQL Schema in Supabase</strong>
                <p className="mt-1 text-stone-600">
                  Open the Supabase SQL editor and execute the provided file{' '}
                  <code className="bg-stone-200 px-1 py-0.5 rounded text-stone-900 font-mono">
                    supabase/schema.sql
                  </code>
                  . This sets up tables, foreign keys, and RLS policies.
                </p>
              </div>

              <div className="p-3 bg-[#FAF7F2] rounded-lg border border-[#EAE2D6]">
                <div className="flex items-center justify-between">
                  <strong>Step 2: Add Environment Variables</strong>
                  <button
                    type="button"
                    onClick={handleCopyEnv}
                    className="flex items-center gap-1 text-[#801323] hover:underline font-semibold cursor-pointer"
                  >
                    {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{copied ? 'Copied' : 'Copy Example'}</span>
                  </button>
                </div>
                <pre className="mt-2 p-2.5 bg-stone-900 text-stone-200 rounded font-mono text-[11px] overflow-x-auto">
{`VITE_SUPABASE_URL="https://xyzcompany.supabase.co"
VITE_SUPABASE_ANON_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."`}
                </pre>
              </div>

              <div className="p-3 bg-[#FAF7F2] rounded-lg border border-[#EAE2D6]">
                <strong>Step 3: Realtime Database Sync</strong>
                <p className="mt-1 text-stone-600">
                  Enable Realtime replication on the <code>orders</code> table in Supabase Database settings to stream kitchen and rider updates live to customers without polling.
                </p>
              </div>
            </div>
          </div>
        </div>

        <div className="p-4 bg-[#FAF7F2] border-t border-[#EAE2D6] flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2 text-xs font-semibold uppercase tracking-wider text-white bg-[#801323] hover:bg-[#680E19] rounded-lg cursor-pointer"
          >
            Close Guide
          </button>
        </div>
      </div>
    </div>
  );
};
