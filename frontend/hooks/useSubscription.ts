/**
 * useSubscription Hook
 * Provides subscription status and premium feature checks
 */

import { useEffect, useCallback } from 'react';
import { useSubscriptionStore, PlanFeatures, FREE_FEATURES, PREMIUM_FEATURES, SubscriptionStatus } from '../lib/subscriptionStore';
import revenueCatService from '../services/revenueCatService';

export function useSubscription() {
  const {
    currentPlan,
    status,
    isInTrial,
    trialEndDate,
    trialUsed,
    expirationDate,
    isActive,
    isLoading,
    billingProvider,
    willRenew,
    syncWithRevenueCat,
    updateFromCustomerInfo,
    checkTrialEligibility,
    canAccessFeature,
    canAddChild,
    isPremium,
    getStatusLabel,
  } = useSubscriptionStore();

  // Sync on mount
  useEffect(() => {
    syncWithRevenueCat();

    // Listen for updates
    const unsubscribe = revenueCatService.addCustomerInfoListener((customerInfo) => {
      updateFromCustomerInfo(customerInfo);
    });

    return () => {
      unsubscribe();
    };
  }, []);

  // Refresh subscription status
  const refresh = useCallback(async () => {
    await syncWithRevenueCat();
  }, [syncWithRevenueCat]);

  return {
    // Status
    currentPlan,
    status,
    isPremium: isPremium(),
    isInTrial,
    trialEndDate,
    trialUsed,
    expirationDate,
    isActive,
    isLoading,
    billingProvider,
    willRenew,
    
    // Feature checks
    canAccessFeature,
    canAddChild,
    checkTrialEligibility,
    
    // Get all features
    features: isPremium() ? PREMIUM_FEATURES : FREE_FEATURES,
    
    // Localized status label
    getStatusLabel,
    
    // Actions
    refresh,
  };
}

/**
 * Hook to check if a specific premium feature is accessible
 */
export function usePremiumFeature(featureKey: keyof PlanFeatures) {
  const { canAccessFeature, isPremium, isLoading } = useSubscription();
  
  return {
    hasAccess: canAccessFeature(featureKey),
    isPremium,
    isLoading,
  };
}

export default useSubscription;
