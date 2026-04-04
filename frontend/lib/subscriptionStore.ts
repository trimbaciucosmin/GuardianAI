/**
 * Subscription Store & Types
 * Manages subscription state for Guardian AI
 * Integrated with RevenueCat and Supabase
 */

import { Platform } from 'react-native';
import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { revenueCatService, ENTITLEMENT_ID } from '../services/revenueCatService';

// CustomerInfo type - only import on native to avoid import.meta errors on web
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

// Plan Types
export type PlanType = 'free' | 'premium';
export type SubscriptionPeriod = 'monthly' | 'yearly';
export type BillingProvider = 'apple' | 'google' | 'revenuecat' | 'test' | null;

// Detailed subscription status for UI
export type SubscriptionStatus = 
  | 'free'
  | 'trial_active'
  | 'premium_active'
  | 'premium_expired'
  | 'billing_issue'
  | 'cancelled';

// Pricing (displayed in UI)
export const PRICING = {
  monthly: {
    price: 4.99,
    currency: '€',
    period: 'month',
    priceId: 'guardian_premium_monthly',
  },
  yearly: {
    price: 39.99,
    currency: '€',
    period: 'year',
    priceId: 'guardian_premium_yearly',
    monthlyEquivalent: 3.33,
    savings: '33%',
  },
  dailyEquivalent: 0.11, // For yearly (39.99 / 365)
};

// Feature flags for each plan
export interface PlanFeatures {
  maxChildren: number;
  liveLocationTracking: boolean;
  sosButton: boolean;
  batteryAlerts: boolean;
  offlineAlerts: boolean;
  safeRoutes: boolean;
  routeDeviationAlerts: boolean;
  unusualStopDetection: boolean;
  weeklyReport: boolean;
  advancedAlerts: boolean;
  locationHistory: boolean;
}

export const FREE_FEATURES: PlanFeatures = {
  maxChildren: 1,
  liveLocationTracking: true,
  sosButton: true,
  batteryAlerts: true,
  offlineAlerts: true,
  safeRoutes: false,
  routeDeviationAlerts: false,
  unusualStopDetection: false,
  weeklyReport: false,
  advancedAlerts: false,
  locationHistory: false,
};

export const PREMIUM_FEATURES: PlanFeatures = {
  maxChildren: 10,
  liveLocationTracking: true,
  sosButton: true,
  batteryAlerts: true,
  offlineAlerts: true,
  safeRoutes: true,
  routeDeviationAlerts: true,
  unusualStopDetection: true,
  weeklyReport: true,
  advancedAlerts: true,
  locationHistory: true,
};

// Premium features for paywall UI
export const PREMIUM_FEATURE_LIST = [
  {
    id: 'safeRoutes',
    icon: 'navigate',
    title: 'Smart Safe Routes',
    titleRo: 'Rute Sigure Inteligente',
    description: 'AI learns your child\'s regular routes',
    descriptionRo: 'AI învață rutele obișnuite ale copilului',
  },
  {
    id: 'routeDeviationAlerts',
    icon: 'warning',
    title: 'Route Deviation Alerts',
    titleRo: 'Alerte Deviere Rută',
    description: 'Get notified when your child goes off route',
    descriptionRo: 'Primești notificare când copilul deviază de la rută',
  },
  {
    id: 'unusualStopDetection',
    icon: 'location',
    title: 'Unusual Stop Detection',
    titleRo: 'Detectare Opriri Neobișnuite',
    description: 'Alerts for unexpected stops',
    descriptionRo: 'Alerte pentru opriri neașteptate',
  },
  {
    id: 'weeklyReport',
    icon: 'stats-chart',
    title: 'Weekly Safety Reports',
    titleRo: 'Rapoarte Săptămânale',
    description: 'Detailed safety insights every week',
    descriptionRo: 'Informații detaliate despre siguranță săptămânal',
  },
  {
    id: 'multipleChildren',
    icon: 'people',
    title: 'Multiple Children',
    titleRo: 'Mai Mulți Copii',
    description: 'Track up to 10 children',
    descriptionRo: 'Urmărește până la 10 copii',
  },
  {
    id: 'advancedAlerts',
    icon: 'notifications',
    title: 'Advanced Alerts',
    titleRo: 'Alerte Avansate',
    description: 'Customizable alert rules',
    descriptionRo: 'Reguli de alertă personalizabile',
  },
];

// Subscription state interface
export interface SubscriptionState {
  // Current plan
  currentPlan: PlanType;
  subscriptionPeriod: SubscriptionPeriod | null;
  billingProvider: BillingProvider;
  
  // Detailed status for UI
  status: SubscriptionStatus;
  
  // Trial state
  trialUsed: boolean;
  trialStartDate: string | null;
  trialEndDate: string | null;
  isInTrial: boolean;
  
  // Subscription details
  subscriptionId: string | null;
  expirationDate: string | null;
  productId: string | null;
  isActive: boolean;
  willRenew: boolean;
  hasBillingIssue: boolean;
  
  // Device/account binding for anti-abuse
  deviceId: string | null;
  
  // Loading states
  isLoading: boolean;
  lastSyncedAt: string | null;
  
  // Actions
  setLoading: (loading: boolean) => void;
  syncWithRevenueCat: () => Promise<void>;
  updateFromCustomerInfo: (customerInfo: CustomerInfo) => void;
  checkTrialEligibility: () => Promise<boolean>;
  getFeatures: () => PlanFeatures;
  canAccessFeature: (feature: keyof PlanFeatures) => boolean;
  canAddChild: (currentChildCount: number) => boolean;
  isPremium: () => boolean;
  getStatus: () => SubscriptionStatus;
  getStatusLabel: (lang: 'en' | 'ro') => string;
  reset: () => void;
}

// Trial duration in days
const TRIAL_DURATION_DAYS = 7;

// Create the store with persistence
export const useSubscriptionStore = create<SubscriptionState>()(
  persist(
    (set, get) => ({
      // Initial state
      currentPlan: 'free',
      subscriptionPeriod: null,
      billingProvider: null,
      status: 'free' as SubscriptionStatus,
      trialUsed: false,
      trialStartDate: null,
      trialEndDate: null,
      isInTrial: false,
      subscriptionId: null,
      expirationDate: null,
      productId: null,
      isActive: false,
      willRenew: false,
      hasBillingIssue: false,
      deviceId: null,
      isLoading: false,
      lastSyncedAt: null,

      // Set loading state
      setLoading: (isLoading) => set({ isLoading }),

      // Sync with RevenueCat
      syncWithRevenueCat: async () => {
        try {
          set({ isLoading: true });
          
          // Check if in demo mode
          if (revenueCatService.isInDemoMode()) {
            console.log('[SubscriptionStore] RevenueCat in demo mode - using local state only');
            const deviceId = await revenueCatService.getDeviceId();
            set({
              deviceId,
              lastSyncedAt: new Date().toISOString(),
              isLoading: false,
            });
            return;
          }
          
          const customerInfo = await revenueCatService.getCustomerInfo();
          
          // If customerInfo is null (demo mode or error), keep current state
          if (!customerInfo) {
            const deviceId = await revenueCatService.getDeviceId();
            set({
              deviceId,
              lastSyncedAt: new Date().toISOString(),
              isLoading: false,
            });
            return;
          }
          
          const rcStatus = revenueCatService.getSubscriptionStatus(customerInfo);
          const deviceId = await revenueCatService.getDeviceId();
          
          // Determine detailed status
          let status: SubscriptionStatus = 'free';
          if (rcStatus.isPremium) {
            if (rcStatus.isInTrial) {
              status = 'trial_active';
            } else if (rcStatus.willRenew) {
              status = 'premium_active';
            } else {
              // Subscription active but won't renew (cancelled)
              status = 'cancelled';
            }
          } else if (get().trialUsed && get().expirationDate) {
            // Had premium but expired
            status = 'premium_expired';
          }
          
          set({
            currentPlan: rcStatus.isPremium ? 'premium' : 'free',
            status,
            billingProvider: rcStatus.billingProvider,
            isInTrial: rcStatus.isInTrial,
            trialEndDate: rcStatus.trialEndsAt,
            trialUsed: rcStatus.isInTrial || get().trialUsed,
            expirationDate: rcStatus.expiresAt,
            productId: rcStatus.productId,
            isActive: rcStatus.isPremium,
            willRenew: rcStatus.willRenew,
            deviceId,
            lastSyncedAt: new Date().toISOString(),
            isLoading: false,
          });
        } catch (error) {
          console.error('[SubscriptionStore] Sync error:', error);
          set({ isLoading: false });
        }
      },

      // Update from customer info (called by RevenueCat listener)
      updateFromCustomerInfo: (customerInfo: CustomerInfo | null) => {
        // If null (demo mode), don't update
        if (!customerInfo) return;
        
        const rcStatus = revenueCatService.getSubscriptionStatus(customerInfo);
        
        // Determine detailed status
        let status: SubscriptionStatus = 'free';
        if (rcStatus.isPremium) {
          if (rcStatus.isInTrial) {
            status = 'trial_active';
          } else if (rcStatus.willRenew) {
            status = 'premium_active';
          } else {
            status = 'cancelled';
          }
        } else if (get().trialUsed && get().expirationDate) {
          status = 'premium_expired';
        }
        
        set({
          currentPlan: rcStatus.isPremium ? 'premium' : 'free',
          status,
          billingProvider: rcStatus.billingProvider,
          isInTrial: rcStatus.isInTrial,
          trialEndDate: rcStatus.trialEndsAt,
          trialUsed: rcStatus.isInTrial || get().trialUsed,
          expirationDate: rcStatus.expiresAt,
          productId: rcStatus.productId,
          isActive: rcStatus.isPremium,
          willRenew: rcStatus.willRenew,
          lastSyncedAt: new Date().toISOString(),
        });
      },

      // Check trial eligibility (anti-abuse)
      checkTrialEligibility: async () => {
        const state = get();
        
        // If trial already used locally, not eligible
        if (state.trialUsed) {
          return false;
        }
        
        // Check with RevenueCat service
        const eligible = await revenueCatService.checkTrialEligibility();
        
        if (!eligible) {
          set({ trialUsed: true });
        }
        
        return eligible;
      },

      // Get features for current plan
      getFeatures: () => {
        const state = get();
        return state.currentPlan === 'premium' ? PREMIUM_FEATURES : FREE_FEATURES;
      },

      // Check if user can access a specific feature
      canAccessFeature: (feature) => {
        const features = get().getFeatures();
        return features[feature] === true;
      },

      // Check if user can add another child
      canAddChild: (currentChildCount) => {
        const features = get().getFeatures();
        return currentChildCount < features.maxChildren;
      },

      // Check if user is premium
      isPremium: () => {
        return get().currentPlan === 'premium' && get().isActive;
      },

      // Get detailed status
      getStatus: () => {
        return get().status;
      },

      // Get localized status label
      getStatusLabel: (lang: 'en' | 'ro') => {
        const status = get().status;
        const labels: Record<SubscriptionStatus, { en: string; ro: string }> = {
          free: { en: 'Free Plan', ro: 'Plan Gratuit' },
          trial_active: { en: 'Trial Active', ro: 'Trial Activ' },
          premium_active: { en: 'Premium Active', ro: 'Premium Activ' },
          premium_expired: { en: 'Premium Expired', ro: 'Premium Expirat' },
          billing_issue: { en: 'Billing Issue', ro: 'Problemă de Plată' },
          cancelled: { en: 'Cancelled', ro: 'Anulat' },
        };
        return labels[status]?.[lang] || labels.free[lang];
      },

      // Reset (for testing only)
      reset: () => set({
        currentPlan: 'free',
        subscriptionPeriod: null,
        billingProvider: null,
        status: 'free',
        trialUsed: false,
        trialStartDate: null,
        trialEndDate: null,
        isInTrial: false,
        subscriptionId: null,
        expirationDate: null,
        productId: null,
        isActive: false,
        willRenew: false,
        hasBillingIssue: false,
        isLoading: false,
        lastSyncedAt: null,
      }),
    }),
    {
      name: 'guardian-subscription',
      storage: createJSONStorage(() => AsyncStorage),
      // Only persist certain fields (cache)
      partialize: (state) => ({
        currentPlan: state.currentPlan,
        status: state.status,
        billingProvider: state.billingProvider,
        trialUsed: state.trialUsed,
        trialStartDate: state.trialStartDate,
        trialEndDate: state.trialEndDate,
        isInTrial: state.isInTrial,
        expirationDate: state.expirationDate,
        productId: state.productId,
        isActive: state.isActive,
        willRenew: state.willRenew,
        deviceId: state.deviceId,
        lastSyncedAt: state.lastSyncedAt,
      }),
    }
  )
);

// Helper function to get remaining trial days
export function getTrialDaysRemaining(trialEndDate: string | null): number {
  if (!trialEndDate) return 0;
  
  const now = new Date();
  const end = new Date(trialEndDate);
  const diffTime = end.getTime() - now.getTime();
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  
  return Math.max(0, diffDays);
}

// Helper to format price
export function formatPrice(price: number, currency: string): string {
  return `${price.toFixed(2)}${currency}`;
}
