/**
 * RevenueCat Service
 * Handles all RevenueCat integration for Guardian AI
 */

import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import { supabase } from '../lib/supabase';

// Import the web mock directly
import MockPurchases, { PURCHASES_ERROR_CODE as MOCK_ERROR_CODE, LOG_LEVEL as MOCK_LOG_LEVEL } from './revenueCatWebMock';

// Check if we're on web platform
const isWeb = Platform.OS === 'web';

// Use the mock module - real Purchases would be loaded dynamically on native
let Purchases: any = MockPurchases;
let PURCHASES_ERROR_CODE: any = MOCK_ERROR_CODE;
let LOG_LEVEL: any = MOCK_LOG_LEVEL;

// On native platforms, the mock will be used since react-native-purchases
// is not installed. When you want real RevenueCat integration, install
// react-native-purchases and uncomment the loadNativeModule function.
let nativeModuleLoaded = true; // Use mock by default

const loadNativeModule = () => {
  // Mock is always used - react-native-purchases not installed
  // To enable real RevenueCat:
  // 1. yarn add react-native-purchases
  // 2. Uncomment the try-catch block below
  // 3. Set nativeModuleLoaded = false at line 24
  /*
  if (!isWeb && !nativeModuleLoaded) {
    try {
      const PurchasesModule = require('react-native-purchases');
      Purchases = PurchasesModule.default;
      PURCHASES_ERROR_CODE = PurchasesModule.PURCHASES_ERROR_CODE || MOCK_ERROR_CODE;
      LOG_LEVEL = PurchasesModule.LOG_LEVEL || MOCK_LOG_LEVEL;
      nativeModuleLoaded = true;
      console.log('[RevenueCat] Native module loaded successfully');
    } catch (e) {
      console.log('[RevenueCat] Failed to load native module, using mock');
      nativeModuleLoaded = true;
    }
  }
  */
  console.log('[RevenueCat] Using mock implementation (react-native-purchases not installed)');
};

// Types for compatibility
interface CustomerInfo {
  entitlements: {
    active: Record<string, {
      isActive: boolean;
      productIdentifier: string;
      expirationDate: string | null;
      willRenew: boolean;
      periodType: string;
      store: string;
    }>;
  };
  originalAppUserId: string;
}

interface PurchasesPackage {
  product: {
    identifier: string;
    priceString: string;
  };
}

interface PurchasesOfferings {
  current: {
    availablePackages: PurchasesPackage[];
  } | null;
}

// RevenueCat Configuration
const REVENUECAT_CONFIG = {
  ios: process.env.EXPO_PUBLIC_REVENUECAT_IOS_KEY || '',
  android: process.env.EXPO_PUBLIC_REVENUECAT_ANDROID_KEY || '',
};

// Check if we have real API keys configured
const hasRealApiKeys = () => {
  const iosKey = REVENUECAT_CONFIG.ios;
  const androidKey = REVENUECAT_CONFIG.android;
  
  // Check if keys are empty or placeholder
  if (!iosKey && !androidKey) return false;
  if (iosKey.includes('PLACEHOLDER') || androidKey.includes('PLACEHOLDER')) return false;
  if (iosKey.length < 10 && androidKey.length < 10) return false;
  
  return true;
};

// Product IDs (must match what's configured in RevenueCat/App Stores)
export const PRODUCT_IDS = {
  MONTHLY: 'guardian_premium_monthly',
  YEARLY: 'guardian_premium_yearly',
};

// Entitlement ID (configured in RevenueCat)
export const ENTITLEMENT_ID = 'premium';

// SecureStore keys
const SECURE_KEYS = {
  DEVICE_ID: 'guardian_device_id',
  TRIAL_USED: 'guardian_trial_used',
  REVENUECAT_USER_ID: 'guardian_rc_user_id',
};

interface SubscriptionStatus {
  isPremium: boolean;
  isInTrial: boolean;
  trialEndsAt: string | null;
  expiresAt: string | null;
  productId: string | null;
  willRenew: boolean;
  billingProvider: 'apple' | 'google' | 'test' | null;
}

class RevenueCatService {
  private isConfigured = false;
  private isDemoMode = false;
  private customerInfoListeners: ((info: CustomerInfo) => void)[] = [];

  /**
   * Check if running in demo mode (no real API keys or web platform)
   */
  isInDemoMode(): boolean {
    return this.isDemoMode || !hasRealApiKeys() || isWeb || !Purchases;
  }

  /**
   * Initialize RevenueCat SDK
   * Call this early in app lifecycle (in _layout.tsx)
   */
  async configure(userId?: string): Promise<void> {
    if (this.isConfigured) {
      console.log('[RevenueCat] Already configured');
      return;
    }

    // On web, always use demo mode
    if (isWeb) {
      console.log('[RevenueCat] Web platform detected. Using RevenueCat in Browser Mode.');
      this.isDemoMode = true;
      this.isConfigured = true;
      return;
    }

    // Load native module on non-web platforms
    loadNativeModule();

    // Check if we have real API keys
    if (!hasRealApiKeys()) {
      console.log('[RevenueCat] Running in DEMO MODE - no real API keys configured');
      console.log('[RevenueCat] Add EXPO_PUBLIC_REVENUECAT_IOS_KEY and EXPO_PUBLIC_REVENUECAT_ANDROID_KEY to .env');
      this.isDemoMode = true;
      this.isConfigured = true;
      return;
    }

    try {
      // Set log level for development
      if (__DEV__) {
        Purchases.setLogLevel(LOG_LEVEL.VERBOSE);
      }

      // Get the appropriate API key for the platform
      const apiKey = Platform.OS === 'ios' 
        ? REVENUECAT_CONFIG.ios 
        : REVENUECAT_CONFIG.android;

      // Configure RevenueCat
      if (userId) {
        await Purchases.configure({ apiKey, appUserID: userId });
      } else {
        await Purchases.configure({ apiKey });
      }

      this.isConfigured = true;
      console.log('[RevenueCat] Configured successfully');

      // Set up customer info listener
      Purchases.addCustomerInfoUpdateListener((customerInfo) => {
        console.log('[RevenueCat] Customer info updated');
        this.customerInfoListeners.forEach(listener => listener(customerInfo));
        this.syncToSupabase(customerInfo);
      });

    } catch (error) {
      console.error('[RevenueCat] Configuration error:', error);
      // Don't throw - fall back to demo mode
      this.isDemoMode = true;
      this.isConfigured = true;
      console.log('[RevenueCat] Falling back to DEMO MODE due to configuration error');
    }
  }

  /**
   * Log in user to RevenueCat (call after auth)
   */
  async login(userId: string): Promise<CustomerInfo | null> {
    if (this.isDemoMode) {
      console.log('[RevenueCat] Demo mode - skipping login');
      await SecureStore.setItemAsync(SECURE_KEYS.REVENUECAT_USER_ID, userId);
      return null;
    }
    
    try {
      const { customerInfo } = await Purchases.logIn(userId);
      await SecureStore.setItemAsync(SECURE_KEYS.REVENUECAT_USER_ID, userId);
      await this.syncToSupabase(customerInfo);
      return customerInfo;
    } catch (error) {
      console.error('[RevenueCat] Login error:', error);
      return null;
    }
  }

  /**
   * Log out user from RevenueCat
   */
  async logout(): Promise<void> {
    if (this.isDemoMode) {
      await SecureStore.deleteItemAsync(SECURE_KEYS.REVENUECAT_USER_ID);
      return;
    }
    
    try {
      await Purchases.logOut();
      await SecureStore.deleteItemAsync(SECURE_KEYS.REVENUECAT_USER_ID);
    } catch (error) {
      console.error('[RevenueCat] Logout error:', error);
    }
  }

  /**
   * Get current offerings (products available for purchase)
   */
  async getOfferings(): Promise<PurchasesOfferings | null> {
    if (this.isDemoMode) {
      console.log('[RevenueCat] Demo mode - no offerings available');
      return null;
    }
    
    try {
      const offerings = await Purchases.getOfferings();
      return offerings;
    } catch (error) {
      console.error('[RevenueCat] Error fetching offerings:', error);
      return null;
    }
  }

  /**
   * Get customer info (subscription status)
   * Returns null in demo mode
   */
  async getCustomerInfo(): Promise<CustomerInfo | null> {
    if (this.isDemoMode) {
      console.log('[RevenueCat] Demo mode - no customer info');
      return null;
    }
    
    try {
      const customerInfo = await Purchases.getCustomerInfo();
      return customerInfo;
    } catch (error) {
      console.error('[RevenueCat] Error fetching customer info:', error);
      return null;
    }
  }

  /**
   * Purchase a package
   */
  async purchasePackage(pkg: PurchasesPackage): Promise<{
    success: boolean;
    customerInfo?: CustomerInfo;
    error?: string;
    userCancelled?: boolean;
    isDemoMode?: boolean;
  }> {
    if (this.isDemoMode) {
      console.log('[RevenueCat] Demo mode - purchases not available');
      return { 
        success: false, 
        isDemoMode: true,
        error: 'Payments not configured. Add RevenueCat API keys to enable purchases.' 
      };
    }
    
    try {
      const { customerInfo } = await Purchases.purchasePackage(pkg);
      await this.syncToSupabase(customerInfo);
      return { success: true, customerInfo };
    } catch (error: any) {
      if (error.userCancelled) {
        return { success: false, userCancelled: true };
      }
      console.error('[RevenueCat] Purchase error:', error);
      return { success: false, error: this.getErrorMessage(error) };
    }
  }

  /**
   * Restore purchases
   */
  async restorePurchases(): Promise<{
    success: boolean;
    customerInfo?: CustomerInfo;
    error?: string;
    isDemoMode?: boolean;
  }> {
    if (this.isDemoMode) {
      console.log('[RevenueCat] Demo mode - restore not available');
      return { 
        success: false, 
        isDemoMode: true,
        error: 'Payments not configured. Add RevenueCat API keys to enable restore.' 
      };
    }
    
    try {
      const customerInfo = await Purchases.restorePurchases();
      await this.syncToSupabase(customerInfo);
      return { success: true, customerInfo };
    } catch (error: any) {
      console.error('[RevenueCat] Restore error:', error);
      return { success: false, error: this.getErrorMessage(error) };
    }
  }

  /**
   * Get subscription status from customer info
   * Returns default free status if customerInfo is null (demo mode)
   */
  getSubscriptionStatus(customerInfo: CustomerInfo | null): SubscriptionStatus {
    // Default free status for demo mode or null customer info
    if (!customerInfo) {
      return {
        isPremium: false,
        isInTrial: false,
        trialEndsAt: null,
        expiresAt: null,
        productId: null,
        willRenew: false,
        billingProvider: null,
      };
    }
    
    const entitlement = customerInfo.entitlements.active[ENTITLEMENT_ID];
    
    if (!entitlement) {
      return {
        isPremium: false,
        isInTrial: false,
        trialEndsAt: null,
        expiresAt: null,
        productId: null,
        willRenew: false,
        billingProvider: null,
      };
    }

    const isInTrial = entitlement.periodType === 'TRIAL';
    const store = entitlement.store;
    let billingProvider: 'apple' | 'google' | 'test' | null = null;
    
    if (store === 'APP_STORE' || store === 'MAC_APP_STORE') {
      billingProvider = 'apple';
    } else if (store === 'PLAY_STORE') {
      billingProvider = 'google';
    } else if (store === 'PROMOTIONAL' || store === 'RC_BILLING') {
      billingProvider = 'test';
    }

    return {
      isPremium: true,
      isInTrial,
      trialEndsAt: isInTrial ? entitlement.expirationDate : null,
      expiresAt: entitlement.expirationDate,
      productId: entitlement.productIdentifier,
      willRenew: entitlement.willRenew,
      billingProvider,
    };
  }

  /**
   * Check if user has premium access
   */
  async isPremium(): Promise<boolean> {
    try {
      const customerInfo = await this.getCustomerInfo();
      return ENTITLEMENT_ID in customerInfo.entitlements.active;
    } catch (error) {
      console.error('[RevenueCat] Error checking premium status:', error);
      return false;
    }
  }

  /**
   * Check and record trial usage (anti-abuse)
   */
  async checkTrialEligibility(): Promise<boolean> {
    try {
      // Check local secure storage first
      const trialUsed = await SecureStore.getItemAsync(SECURE_KEYS.TRIAL_USED);
      if (trialUsed === 'true') {
        return false;
      }

      // Check Supabase for server-side trial status
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data: subscription } = await supabase
          .from('subscriptions')
          .select('trial_used')
          .eq('user_id', user.id)
          .single();

        if (subscription?.trial_used) {
          // Sync local storage with server
          await SecureStore.setItemAsync(SECURE_KEYS.TRIAL_USED, 'true');
          return false;
        }
      }

      return true;
    } catch (error) {
      console.error('[RevenueCat] Error checking trial eligibility:', error);
      return false;
    }
  }

  /**
   * Mark trial as used (call after successful trial start)
   */
  async markTrialUsed(): Promise<void> {
    try {
      // Mark locally
      await SecureStore.setItemAsync(SECURE_KEYS.TRIAL_USED, 'true');

      // Mark in Supabase
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        await supabase
          .from('subscriptions')
          .upsert({
            user_id: user.id,
            trial_used: true,
            trial_started_at: new Date().toISOString(),
          }, { onConflict: 'user_id' });
      }
    } catch (error) {
      console.error('[RevenueCat] Error marking trial used:', error);
    }
  }

  /**
   * Get or create device ID for anti-abuse
   */
  async getDeviceId(): Promise<string> {
    try {
      let deviceId = await SecureStore.getItemAsync(SECURE_KEYS.DEVICE_ID);
      if (!deviceId) {
        deviceId = `device_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        await SecureStore.setItemAsync(SECURE_KEYS.DEVICE_ID, deviceId);
      }
      return deviceId;
    } catch (error) {
      console.error('[RevenueCat] Error getting device ID:', error);
      return 'unknown';
    }
  }

  /**
   * Sync subscription status to Supabase
   */
  async syncToSupabase(customerInfo: CustomerInfo): Promise<void> {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const status = this.getSubscriptionStatus(customerInfo);
      const deviceId = await this.getDeviceId();

      const subscriptionData = {
        user_id: user.id,
        current_plan: status.isPremium ? 'premium' : 'free',
        billing_provider: status.billingProvider,
        revenuecat_app_user_id: customerInfo.originalAppUserId,
        entitlement_active: status.isPremium,
        entitlement_identifier: status.isPremium ? ENTITLEMENT_ID : null,
        trial_used: status.isInTrial ? true : undefined,
        trial_started_at: status.isInTrial ? new Date().toISOString() : undefined,
        trial_ends_at: status.trialEndsAt,
        subscription_expires_at: status.expiresAt,
        product_id: status.productId,
        last_synced_at: new Date().toISOString(),
      };

      // Remove undefined values
      Object.keys(subscriptionData).forEach(key => {
        if (subscriptionData[key as keyof typeof subscriptionData] === undefined) {
          delete subscriptionData[key as keyof typeof subscriptionData];
        }
      });

      // Upsert subscription record
      const { error } = await supabase
        .from('subscriptions')
        .upsert(subscriptionData, { onConflict: 'user_id' });

      if (error) {
        console.error('[RevenueCat] Error syncing to Supabase:', error);
      } else {
        console.log('[RevenueCat] Synced to Supabase successfully');
      }

      // Add device ID to the array if not present
      try {
        await supabase.rpc('add_device_to_subscription', {
          p_user_id: user.id,
          p_device_id: deviceId,
        });
      } catch {
        // Function might not exist yet, that's okay
      }

    } catch (error) {
      console.error('[RevenueCat] Error syncing to Supabase:', error);
    }
  }

  /**
   * Load subscription status from Supabase (for offline/fast access)
   */
  async loadFromSupabase(): Promise<SubscriptionStatus | null> {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return null;

      const { data: subscription, error } = await supabase
        .from('subscriptions')
        .select('*')
        .eq('user_id', user.id)
        .single();

      if (error || !subscription) return null;

      return {
        isPremium: subscription.current_plan === 'premium' && subscription.entitlement_active,
        isInTrial: subscription.trial_used && !subscription.subscription_started_at && 
                   subscription.trial_ends_at && new Date(subscription.trial_ends_at) > new Date(),
        trialEndsAt: subscription.trial_ends_at,
        expiresAt: subscription.subscription_expires_at,
        productId: subscription.product_id,
        willRenew: subscription.entitlement_active,
        billingProvider: subscription.billing_provider as any,
      };
    } catch (error) {
      console.error('[RevenueCat] Error loading from Supabase:', error);
      return null;
    }
  }

  /**
   * Add customer info update listener
   */
  addCustomerInfoListener(listener: (info: CustomerInfo) => void): () => void {
    this.customerInfoListeners.push(listener);
    return () => {
      this.customerInfoListeners = this.customerInfoListeners.filter(l => l !== listener);
    };
  }

  /**
   * Get human-readable error message
   */
  private getErrorMessage(error: PurchasesError): string {
    switch (error.code) {
      case PURCHASES_ERROR_CODE.NETWORK_ERROR:
        return 'Network error. Please check your connection and try again.';
      case PURCHASES_ERROR_CODE.PURCHASE_INVALID_ERROR:
        return 'Invalid purchase. Please check your payment method.';
      case PURCHASES_ERROR_CODE.STORE_PROBLEM_ERROR:
        return 'Store error. Please try again later.';
      case PURCHASES_ERROR_CODE.RECEIPT_ALREADY_IN_USE_ERROR:
        return 'This purchase is already associated with another account.';
      case PURCHASES_ERROR_CODE.INVALID_CREDENTIALS_ERROR:
        return 'Invalid credentials. Please sign in again.';
      default:
        return error.message || 'An error occurred. Please try again.';
    }
  }
}

export const revenueCatService = new RevenueCatService();
export default revenueCatService;
