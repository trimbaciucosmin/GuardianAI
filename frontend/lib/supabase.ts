import 'react-native-url-polyfill/auto';
import { createClient } from '@supabase/supabase-js';
import { Platform, AppState } from 'react-native';
import * as SecureStore from 'expo-secure-store';

// Supabase configuration - Hardcoded for production builds
const supabaseUrl = 'https://nozwlzlaojjmciwjtuek.supabase.co';
const supabaseAnonKey = 'sb_publishable_aCw_U7ByBNO6SH5voYN3Dg_ZAdnAKWc';

// Web-safe storage check
const isWeb = Platform.OS === 'web';
const hasLocalStorage = isWeb && typeof window !== 'undefined' && window.localStorage;

// Custom storage adapter for Expo
const ExpoSecureStoreAdapter = {
  getItem: async (key: string): Promise<string | null> => {
    try {
      if (isWeb) {
        if (hasLocalStorage) {
          return window.localStorage.getItem(key);
        }
        return null;
      }
      return await SecureStore.getItemAsync(key);
    } catch (error) {
      console.warn('Storage getItem error:', error);
      return null;
    }
  },
  setItem: async (key: string, value: string): Promise<void> => {
    try {
      if (isWeb) {
        if (hasLocalStorage) {
          window.localStorage.setItem(key, value);
        }
        return;
      }
      await SecureStore.setItemAsync(key, value);
    } catch (error) {
      console.warn('Storage setItem error:', error);
    }
  },
  removeItem: async (key: string): Promise<void> => {
    try {
      if (isWeb) {
        if (hasLocalStorage) {
          window.localStorage.removeItem(key);
        }
        return;
      }
      await SecureStore.deleteItemAsync(key);
    } catch (error) {
      console.warn('Storage removeItem error:', error);
    }
  },
};

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: ExpoSecureStoreAdapter,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
  realtime: {
    params: {
      eventsPerSecond: 10, // Faster realtime updates
    },
  },
});

// Auto-refresh session when app comes to foreground
if (!isWeb) {
  AppState.addEventListener('change', async (state) => {
    if (state === 'active') {
      // Refresh session when app becomes active
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        await supabase.auth.refreshSession();
      }
    }
  });
}

// Check if Supabase is properly configured
export const isSupabaseConfigured = () => {
  return supabaseUrl.includes('supabase.co') && supabaseAnonKey.length > 10;
};
