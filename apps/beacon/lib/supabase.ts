import 'react-native-url-polyfill/auto';
import { Platform } from 'react-native';
import { createClient } from '@supabase/supabase-js';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { Database } from '@beacon/types';

// EXPO_PUBLIC_* vars are inlined into the client bundle at build time —
// only ever put values here that are safe to ship to a device (the anon/
// publishable key is designed for exactly that; RLS is the real gate).
// APEX_API_KEY is a genuine secret and lives only as a Supabase Edge
// Function secret — it must never appear here.
const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
const publishableKey = process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

if (!url || !publishableKey) {
  throw new Error(
    'Missing Supabase config — set EXPO_PUBLIC_SUPABASE_URL / EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY in .env.',
  );
}

// @react-native-async-storage/async-storage's web shim reads `window` at
// call time, which doesn't exist during Node-side static rendering (the
// web export's route prerender pass). Supabase's GoTrueClient touches
// storage the moment it's constructed (session recovery), so any route
// that imports this module — directly or transitively — crashes the
// export. There's no real session to recover during SSR anyway, so a
// no-op storage there is correct, not just a workaround.
//
// Gate on Platform.OS, not `typeof window` — the web SSR/prerender pass
// genuinely has no window, but so can native's JS runtime depending on
// the engine, which would otherwise silently fall back to this no-op
// storage on-device too and mean no session ever persists across app
// restarts. `Platform.OS === 'web'` is only ever true for the web build,
// so this narrows correctly to just the Node-side prerender case.
const isSsr = Platform.OS === 'web' && typeof window === 'undefined';
const noopStorage = {
  getItem: async () => null,
  setItem: async () => {},
  removeItem: async () => {},
};
const storage = isSsr ? noopStorage : AsyncStorage;

// Web needs this on to pick up the session Supabase attaches to the URL
// when a user returns from an email-confirmation redirect — without it,
// getSession() never sees a session and screen 01's "I've confirmed —
// continue" step waits forever. Native has no browser URL for a session
// to arrive in, so this is a no-op there either way.
const detectSessionInUrl = Platform.OS === 'web';

export const supabase = createClient<Database>(url, publishableKey, {
  auth: {
    storage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl,
  },
});
