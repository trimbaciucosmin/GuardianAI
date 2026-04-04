/**
 * PremiumGate Component
 * Wraps premium features and shows paywall when accessed by free users
 */

import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useLanguage } from '../lib/i18n';
import { useSubscription } from '../hooks/useSubscription';
import { PlanFeatures } from '../lib/subscriptionStore';
import { Paywall } from './Paywall';

interface PremiumGateProps {
  feature: keyof PlanFeatures;
  featureTitle?: string;
  featureTitleRo?: string;
  featureDescription?: string;
  featureDescriptionRo?: string;
  children: React.ReactNode;
  // Show inline blocked message instead of rendering nothing
  showBlockedUI?: boolean;
}

export function PremiumGate({
  feature,
  featureTitle,
  featureTitleRo,
  featureDescription,
  featureDescriptionRo,
  children,
  showBlockedUI = true,
}: PremiumGateProps) {
  const { canAccessFeature, isPremium, isLoading } = useSubscription();
  const { language } = useLanguage();
  const lang = language as 'en' | 'ro';
  
  const [showPaywall, setShowPaywall] = useState(false);

  const hasAccess = canAccessFeature(feature);

  // If user has access, render children
  if (hasAccess) {
    return <>{children}</>;
  }

  // If loading, show nothing or loading state
  if (isLoading) {
    return null;
  }

  // Show blocked UI or paywall trigger
  if (showBlockedUI) {
    return (
      <>
        <View style={styles.blockedContainer}>
          <LinearGradient
            colors={['rgba(99, 102, 241, 0.15)', 'rgba(99, 102, 241, 0.05)']}
            style={styles.blockedGradient}
          >
            <View style={styles.lockIcon}>
              <Ionicons name="lock-closed" size={32} color="#6366F1" />
            </View>
            
            <Text style={styles.blockedTitle}>
              {lang === 'ro' ? 'Funcție Premium' : 'Premium Feature'}
            </Text>
            
            <Text style={styles.blockedFeature}>
              {lang === 'ro' ? (featureTitleRo || featureTitle) : featureTitle}
            </Text>
            
            {(featureDescription || featureDescriptionRo) && (
              <Text style={styles.blockedDescription}>
                {lang === 'ro' ? (featureDescriptionRo || featureDescription) : featureDescription}
              </Text>
            )}
            
            <TouchableOpacity
              style={styles.upgradeButton}
              onPress={() => setShowPaywall(true)}
            >
              <Ionicons name="sparkles" size={18} color="#FFFFFF" />
              <Text style={styles.upgradeButtonText}>
                {lang === 'ro' ? 'Upgrade la Premium' : 'Upgrade to Premium'}
              </Text>
            </TouchableOpacity>
            
            <Text style={styles.trialHint}>
              {lang === 'ro' 
                ? 'Începe cu 7 zile gratuit' 
                : 'Start with 7-day free trial'
              }
            </Text>
          </LinearGradient>
        </View>

        <Paywall
          visible={showPaywall}
          onClose={() => setShowPaywall(false)}
          featureTitle={lang === 'ro' ? (featureTitleRo || featureTitle) : featureTitle}
          featureDescription={lang === 'ro' ? (featureDescriptionRo || featureDescription) : featureDescription}
        />
      </>
    );
  }

  return null;
}

/**
 * Hook version for more control
 */
export function usePremiumGate(feature: keyof PlanFeatures) {
  const { canAccessFeature, isPremium, isLoading } = useSubscription();
  const [showPaywall, setShowPaywall] = useState(false);

  const hasAccess = canAccessFeature(feature);

  const checkAccess = (): boolean => {
    if (hasAccess) return true;
    setShowPaywall(true);
    return false;
  };

  return {
    hasAccess,
    isPremium,
    isLoading,
    showPaywall,
    setShowPaywall,
    checkAccess,
  };
}

const styles = StyleSheet.create({
  blockedContainer: {
    margin: 20,
    borderRadius: 20,
    overflow: 'hidden',
  },
  blockedGradient: {
    padding: 32,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(99, 102, 241, 0.2)',
    borderRadius: 20,
  },
  lockIcon: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: 'rgba(99, 102, 241, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
  },
  blockedTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#6366F1',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 8,
  },
  blockedFeature: {
    fontSize: 22,
    fontWeight: '700',
    color: '#FFFFFF',
    textAlign: 'center',
    marginBottom: 8,
  },
  blockedDescription: {
    fontSize: 15,
    color: '#94A3B8',
    textAlign: 'center',
    marginBottom: 24,
    lineHeight: 22,
  },
  upgradeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#6366F1',
    paddingVertical: 16,
    paddingHorizontal: 32,
    borderRadius: 14,
    gap: 10,
  },
  upgradeButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  trialHint: {
    fontSize: 13,
    color: '#64748B',
    marginTop: 12,
  },
});

export default PremiumGate;
