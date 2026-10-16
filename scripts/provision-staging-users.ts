// ====================================================================
// Mantsa Biryani - Safe Staging Auth Provisioning Script
// File: scripts/provision-staging-users.ts
//
// Complies with Supabase Auth Security Guidelines:
//   - Uses supabase.auth.admin.createUser() API exclusively.
//   - Zero direct SQL INSERT statements into auth.users.
//   - Zero hardcoded passwords stored in SQL migrations.
//   - Generates/retrieves real GoTrue user UUIDs and links public.profiles.
//   - Fully idempotent: updates existing users/profiles if already provisioned.
// ====================================================================

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('❌ Missing environment variables. Please provide SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.');
  process.exit(1);
}

// ====================================================================
// FAIL-CLOSED STAGING TARGET GUARD
// Strictly allows only verified staging project: onzriatzbtpzjkrxhuon
// Prevents accidental targeting of production (rhkrwzymybscujpukycc),
// custom domains, non-HTTPS protocols, or other project references.
// ====================================================================
const EXPECTED_STAGING_HOSTNAME = 'onzriatzbtpzjkrxhuon.supabase.co';

export function assertStagingTargetUrl(rawUrl: string): URL {
  let parsed: URL;
  try {
    parsed = new URL(rawUrl);
  } catch {
    console.error(`❌ FATAL: Invalid Supabase URL format. Expected 'https://${EXPECTED_STAGING_HOSTNAME}'.`);
    process.exit(1);
  }

  if (parsed.protocol !== 'https:') {
    console.error(`❌ FATAL: Insecure protocol '${parsed.protocol}'. Staging requires 'https:'.`);
    process.exit(1);
  }

  if (parsed.hostname.toLowerCase() !== EXPECTED_STAGING_HOSTNAME) {
    console.error(
      `❌ FATAL: Target URL hostname '${parsed.hostname}' is rejected.\n` +
      `   This provisioning script strictly allows verified staging reference: '${EXPECTED_STAGING_HOSTNAME}'.\n` +
      `   Execution aborted to protect production and untrusted environments.`
    );
    process.exit(1);
  }

  return parsed;
}

assertStagingTargetUrl(SUPABASE_URL);

const adminClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

interface StagingUserConfig {
  email: string;
  password?: string;
  fullName: string;
  phone: string;
  role: 'admin' | 'delivery' | 'customer';
  vehicleDetails?: string;
  isActive: boolean;
}

const STAGING_USERS: StagingUserConfig[] = [
  {
    email: 'staging_admin@mantsa.local',
    password: process.env.STAGING_ADMIN_PASSWORD || 'MantsaStaging2026!Admin',
    fullName: 'Staging Admin',
    phone: '+919000000001',
    role: 'admin',
    isActive: true,
  },
  {
    email: 'rider_tariq@mantsa.local',
    password: process.env.STAGING_RIDER_PASSWORD || 'MantsaStaging2026!Rider',
    fullName: 'Mohammad Tariq',
    phone: '+917903155678',
    role: 'delivery',
    vehicleDetails: 'Bajaj Pulsar (BR-10-E-3341)',
    isActive: true,
  },
  {
    email: 'rider_raju@mantsa.local',
    password: process.env.STAGING_RIDER_PASSWORD || 'MantsaStaging2026!Rider',
    fullName: 'Raju Kumar',
    phone: '+919835012345',
    role: 'delivery',
    vehicleDetails: 'Hero Splendor (BR-10-A-4120)',
    isActive: true,
  },
  {
    email: 'rider_vikram@mantsa.local',
    password: process.env.STAGING_RIDER_PASSWORD || 'MantsaStaging2026!Rider',
    fullName: 'Vikram Singh',
    phone: '+919470288412',
    role: 'delivery',
    vehicleDetails: 'Honda Activa (BR-10-C-9011)',
    isActive: false, // Inactive rider for concurrency & guard testing
  },
  {
    email: 'customer_sneha@mantsa.local',
    password: process.env.STAGING_CUSTOMER_PASSWORD || 'MantsaStaging2026!Cust',
    fullName: 'Sneha Roy',
    phone: '+919123456780',
    role: 'customer',
    isActive: true,
  },
];

async function provisionUser(cfg: StagingUserConfig) {
  console.log(`\n⏳ Provisioning user: ${cfg.email} (${cfg.role})...`);

  let userId: string | null = null;

  // 1. Check if user already exists
  const { data: listData, error: listErr } = await adminClient.auth.admin.listUsers();
  if (listErr) {
    throw new Error(`Failed to list users: ${listErr.message}`);
  }

  const existing = listData.users.find((u) => u.email === cfg.email);

  if (existing) {
    console.log(`   User already exists in GoTrue (ID: ${existing.id}). Updating metadata...`);
    userId = existing.id;
    const { error: updateErr } = await adminClient.auth.admin.updateUserById(userId, {
      user_metadata: {
        full_name: cfg.fullName,
        phone: cfg.phone,
        role: cfg.role,
      },
      email_confirm: true,
    });
    if (updateErr) {
      console.warn(`   Warning updating user metadata: ${updateErr.message}`);
    }
  } else {
    // 2. Safely create user via Supabase Auth Admin API
    const { data: createData, error: createErr } = await adminClient.auth.admin.createUser({
      email: cfg.email,
      password: cfg.password,
      email_confirm: true,
      user_metadata: {
        full_name: cfg.fullName,
        phone: cfg.phone,
        role: cfg.role,
      },
    });

    if (createErr || !createData.user) {
      throw new Error(`Failed to create user ${cfg.email}: ${createErr?.message}`);
    }

    userId = createData.user.id;
    console.log(`   Created GoTrue user: ${userId}`);
  }

  // 3. Upsert linked public.profiles record
  const { error: profileErr } = await adminClient.from('profiles').upsert(
    {
      id: userId,
      role: cfg.role,
      full_name: cfg.fullName,
      phone: cfg.phone,
      vehicle_details: cfg.vehicleDetails || null,
      is_active: cfg.isActive,
    },
    { onConflict: 'id' }
  );

  if (profileErr) {
    throw new Error(`Failed to upsert profile for ${cfg.email}: ${profileErr.message}`);
  }

  console.log(`   ✅ Profile linked successfully in public.profiles (role: ${cfg.role}, active: ${cfg.isActive})`);
}

async function main() {
  console.log('=== MANTSA BIRYANI: STAGING AUTH PROVISIONING ===');
  console.log(`Target Supabase URL: ${SUPABASE_URL}`);

  for (const userConfig of STAGING_USERS) {
    try {
      await provisionUser(userConfig);
    } catch (err: any) {
      console.error(`❌ Error provisioning ${userConfig.email}:`, err.message);
      process.exit(1);
    }
  }

  console.log('\n🎉 All staging auth users and profiles provisioned successfully via GoTrue Admin API!');
}

main().catch((err) => {
  console.error('Fatal error during provisioning:', err);
  process.exit(1);
});
