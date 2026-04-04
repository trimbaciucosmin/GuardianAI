/**
 * Soft Paywall Component
 * Shown after onboarding to encourage trial signup
 */

import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { useLanguage } from '../lib/i18n';
import { useSubscriptionStore, PREMIUM_FEATURE_LIST } from '../lib/subscriptionStore';
import revenueCatService from '../services/revenueCatService';

interface SoftPaywallProps {
  visible: boolean;
  onClose: () => void;
  onTrialStarted?: () => void;
}

export function SoftPaywall({ visible, onClose, onTrialStarted }: SoftPaywallProps) {
  const insets = useSafeAreaInsets();
  const { language } = useLanguage();
  const lang = language as 'en' | 'ro';
  const { syncWithRevenueCat, trialUsed } = useSubscriptionStore();
  
  const [isLoading, setIsLoading] = useState(false);

  const handleStartTrial = async () => {
    setIsLoading(true);
    
    try {
      // Check if RevenueCat is in demo mode
      if (revenueCatService.isInDemoMode()) {
        console.log('[SoftPaywall] RevenueCat in demo mode - granting local trial');
        
        const now = new Date();
        const trialEnd = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
        
        // Update subscription store directly (using already-imported hook)
        useSubscriptionStore.setState({
          currentPlan: 'premium',
          status: 'trial_active',
          isInTrial: true,
          isActive: true,
          trialUsed: true,
          trialStartDate: now.toISOString(),
          trialEndDate: trialEnd.toISOString(),
          expirationDate: trialEnd.toISOString(),
          billingProvider: 'test',
          lastSyncedAt: now.toISOString(),
        });
        
        setIsLoading(false);
        
        Alert.alert(
          lang === 'ro' ? 'Bun venit la Premium!' : 'Welcome to Premium!',
          lang === 'ro' 
            ? 'Ai acces la toate funcțiile Premium pentru 7 zile gratuit!'
            : 'You have access to all Premium features for 7 days free!',
          [{ 
            text: 'OK', 
            onPress: () => {
              // Call ONLY onClose — which handles navigation
              onClose();
            }
          }]
        );
        return;
      }

      // Real RevenueCat flow
      const offerings = await revenueCatService.getOfferings();
      const yearlyPkg = offerings?.current?.availablePackages.find(
        pkg => pkg.product.identifier === 'guardian_premium_yearly'
      );

      if (!yearlyPkg) {
        Alert.alert(
          lang === 'ro' ? 'Eroare' : 'Error',
          lang === 'ro' 
            ? 'Trial-ul nu este disponibil momentan.'
            : 'Trial is not available right now.'
        );
        setIsLoading(false);
        return;
      }

      const result = await revenueCatService.purchasePackage(yearlyPkg);
      
      if (result.success) {
        await revenueCatService.markTrialUsed();
        await syncWithRevenueCat();
        
        Alert.alert(
          lang === 'ro' ? 'Bun venit la Premium!' : 'Welcome to Premium!',
          lang === 'ro' 
            ? 'Ai acces la toate funcțiile Premium pentru 7 zile. Poți anula oricând.'
            : 'You have access to all Premium features for 7 days. Cancel anytime.',
          [{ 
            text: 'OK', 
            onPress: () => {
              onTrialStarted?.();
              onClose();
            }
          }]
        );
      } else if (result.userCancelled) {
        // User cancelled - close soft paywall
        onClose();
      } else {
        Alert.alert(
          lang === 'ro' ? 'Eroare' : 'Error',
          result.error || (lang === 'ro' ? 'A apărut o eroare.' : 'An error occurred.')
        );
      }
    } catch (error: any) {
      Alert.alert(
        lang === 'ro' ? 'Eroare' : 'Error',
        error.message
      );
    } finally {
      setIsLoading(false);
    }
  };

  // Don't show if trial already used
  if (trialUsed) {
    return null;
  }

  return (
    <Modal
      visible={visible}
      animationType="fade"
      transparent
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <View style={[styles.container, { paddingBottom: insets.bottom + 20 }]}>
          {/* Gradient Background */}
          <LinearGradient
            colors={['rgba(99, 102, 241, 0.2)', 'rgba(99, 102, 241, 0.05)', '#0F172A']}
            style={styles.gradient}
          >
            {/* Close button */}
            <TouchableOpacity 
              style={styles.closeButton} 
              onPress={onClose}
            >
              <Ionicons name="close" size={24} color="#64748B" />
            </TouchableOpacity>

            {/* Content */}
            <View style={styles.content}>
              {/* Icon */}
              <View style={styles.iconContainer}>
                <LinearGradient
                  colors={['#6366F1', '#4F46E5']}
                  style={styles.iconGradient}
                >
                  <Ionicons name="shield-checkmark" size={40} color="#FFFFFF" />
                </LinearGradient>
              </View>

              {/* Title */}
              <Text style={styles.title}>
                {lang === 'ro' 
                  ? 'Încearcă Guardian AI Premium'
                  : 'Try Guardian AI Premium'
                }
              </Text>
              
              <Text style={styles.subtitle}>
                {lang === 'ro' 
                  ? 'Gratuit pentru 7 zile'
                  : 'Free for 7 days'
                }
              </Text>

              {/* Features Preview */}
              <View style={styles.featuresPreview}>
                {PREMIUM_FEATURE_LIST.slice(0, 3).map((feature) => (
                  <View key={feature.id} style={styles.featureRow}>
                    <Ionicons name="checkmark-circle" size={20} color="#10B981" />
                    <Text style={styles.featureText}>
                      {lang === 'ro' ? feature.titleRo : feature.title}
                    </Text>
                  </View>
                ))}
                <View style={styles.featureRow}>
                  <Ionicons name="ellipsis-horizontal" size={20} color="#64748B" />
                  <Text style={styles.featureTextMore}>
                    {lang === 'ro' ? 'și multe altele' : 'and much more'}
                  </Text>
                </View>
              </View>

              {/* CTA Button */}
              <TouchableOpacity
                style={[styles.ctaButton, isLoading && styles.buttonDisabled]}
                onPress={handleStartTrial}
                disabled={isLoading}
              >
                {isLoading ? (
                  <ActivityIndicator color="#FFFFFF" />
                ) : (
                  <>
                    <Ionicons name="gift" size={20} color="#FFFFFF" />
                    <Text style={styles.ctaButtonText}>
                      {lang === 'ro' 
                        ? 'Începe Trial Gratuit'
                        : 'Start Free Trial'
                      }
                    </Text>
                  </>
                )}
              </TouchableOpacity>

              {/* Cancel anytime */}
              <Text style={styles.cancelNotice}>
                {lang === 'ro' ? 'Poți anula oricând' : 'Cancel anytime'}
              </Text>

              {/* Skip Button */}
              <TouchableOpacity style={styles.skipButton} onPress={onClose}>
                <Text style={styles.skipButtonText}>
                  {lang === 'ro' 
                    ? 'Continuă cu planul gratuit'
                    : 'Continue with Free plan'
                  }
                </Text>
              </TouchableOpacity>
            </View>
          </LinearGradient>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'flex-end',
  },
  container: {
    backgroundColor: '#0F172A',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    overflow: 'hidden',
  },
  gradient: {
    paddingTop: 20,
    paddingHorizontal: 24,
  },
  closeButton: {
    position: 'absolute',
    top: 16,
    right: 16,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(30, 41, 59, 0.8)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 10,
  },
  content: {
    alignItems: 'center',
    paddingTop: 20,
  },
  iconContainer: {
    marginBottom: 20,
  },
  iconGradient: {
    width: 80,
    height: 80,
    borderRadius: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  title: {
    fontSize: 24,
    fontWeight: '800',
    color: '#FFFFFF',
    textAlign: 'center',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#10B981',
    marginBottom: 24,
  },
  featuresPreview: {
    width: '100%',
    backgroundColor: 'rgba(30, 41, 59, 0.6)',
    borderRadius: 16,
    padding: 16,
    marginBottom: 24,
    gap: 12,
  },
  featureRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  featureText: {
    fontSize: 15,
    fontWeight: '500',
    color: '#FFFFFF',
  },
  featureTextMore: {
    fontSize: 14,
    color: '#64748B',
    fontStyle: 'italic',
  },
  ctaButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#10B981',
    borderRadius: 14,
    paddingVertical: 18,
    paddingHorizontal: 32,
    width: '100%',
    gap: 10,
  },
  ctaButtonText: {
    fontSize: 17,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  cancelNotice: {
    fontSize: 14,
    color: '#94A3B8',
    marginTop: 12,
  },
  skipButton: {
    paddingVertical: 16,
    paddingHorizontal: 24,
    marginTop: 8,
  },
  skipButtonText: {
    fontSize: 15,
    color: '#64748B',
    fontWeight: '500',
  },
});

export default SoftPaywall;
