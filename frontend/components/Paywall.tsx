/**
 * Paywall Component
 * Shows premium upgrade screen when accessing premium features
 * Integrated with RevenueCat for real payments
 */

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  ScrollView,
  Alert,
  ActivityIndicator,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { useLanguage } from '../lib/i18n';
import {
  useSubscriptionStore,
  PRICING,
  PREMIUM_FEATURE_LIST,
  getTrialDaysRemaining,
  formatPrice,
} from '../lib/subscriptionStore';
import revenueCatService, { PRODUCT_IDS } from '../services/revenueCatService';

// Local types to avoid importing react-native-purchases on web (causes import.meta error)
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

interface PaywallProps {
  visible: boolean;
  onClose: () => void;
  feature?: string;
  featureTitle?: string;
  featureDescription?: string;
  onPurchaseSuccess?: () => void;
}

export function Paywall({
  visible,
  onClose,
  feature,
  featureTitle,
  featureDescription,
  onPurchaseSuccess,
}: PaywallProps) {
  const insets = useSafeAreaInsets();
  const { language } = useLanguage();
  const lang = language as 'en' | 'ro';
  
  const { 
    trialUsed, 
    isInTrial, 
    trialEndDate,
    currentPlan,
    syncWithRevenueCat,
    checkTrialEligibility,
  } = useSubscriptionStore();
  
  const [selectedPlan, setSelectedPlan] = useState<'monthly' | 'yearly'>('yearly');
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingOfferings, setIsLoadingOfferings] = useState(true);
  const [offerings, setOfferings] = useState<PurchasesOfferings | null>(null);
  const [canStartTrial, setCanStartTrial] = useState(false);

  const trialDaysLeft = getTrialDaysRemaining(trialEndDate);

  // Load offerings on mount
  useEffect(() => {
    if (visible) {
      loadOfferings();
      checkTrial();
    }
  }, [visible]);

  const loadOfferings = async () => {
    setIsLoadingOfferings(true);
    try {
      const offers = await revenueCatService.getOfferings();
      setOfferings(offers);
    } catch (error) {
      console.error('Error loading offerings:', error);
    } finally {
      setIsLoadingOfferings(false);
    }
  };

  const checkTrial = async () => {
    const eligible = await checkTrialEligibility();
    setCanStartTrial(eligible);
  };

  // Get package for selected plan
  const getPackage = (planType: 'monthly' | 'yearly'): PurchasesPackage | null => {
    if (!offerings?.current) return null;
    
    const productId = planType === 'monthly' 
      ? PRODUCT_IDS.MONTHLY 
      : PRODUCT_IDS.YEARLY;
    
    return offerings.current.availablePackages.find(
      pkg => pkg.product.identifier === productId
    ) || null;
  };

  const handlePurchase = async () => {
    const pkg = getPackage(selectedPlan);
    if (!pkg) {
      Alert.alert(
        lang === 'ro' ? 'Eroare' : 'Error',
        lang === 'ro' 
          ? 'Produsele nu sunt disponibile momentan. Te rugăm să încerci mai târziu.'
          : 'Products are not available right now. Please try again later.'
      );
      return;
    }

    setIsLoading(true);
    
    try {
      const result = await revenueCatService.purchasePackage(pkg);
      
      if (result.success) {
        await syncWithRevenueCat();
        Alert.alert(
          lang === 'ro' ? 'Succes!' : 'Success!',
          lang === 'ro' 
            ? 'Abonamentul Premium a fost activat.'
            : 'Premium subscription has been activated.',
          [{ 
            text: 'OK', 
            onPress: () => {
              onPurchaseSuccess?.();
              onClose();
            }
          }]
        );
      } else if (result.userCancelled) {
        // User cancelled, do nothing
      } else {
        Alert.alert(
          lang === 'ro' ? 'Eroare' : 'Error',
          result.error || (lang === 'ro' ? 'A apărut o eroare.' : 'An error occurred.')
        );
      }
    } catch (error: any) {
      Alert.alert(
        lang === 'ro' ? 'Eroare' : 'Error',
        error.message || (lang === 'ro' ? 'A apărut o eroare.' : 'An error occurred.')
      );
    } finally {
      setIsLoading(false);
    }
  };

  const handleStartTrial = async () => {
    // For trial, we need to find a package with a free trial offer
    const yearlyPkg = getPackage('yearly');
    if (!yearlyPkg) {
      Alert.alert(
        lang === 'ro' ? 'Eroare' : 'Error',
        lang === 'ro' 
          ? 'Trial-ul nu este disponibil momentan.'
          : 'Trial is not available right now.'
      );
      return;
    }

    setIsLoading(true);
    
    try {
      // Purchase will automatically apply trial if user is eligible
      const result = await revenueCatService.purchasePackage(yearlyPkg);
      
      if (result.success) {
        await revenueCatService.markTrialUsed();
        await syncWithRevenueCat();
        
        Alert.alert(
          lang === 'ro' ? 'Trial Activat!' : 'Trial Activated!',
          lang === 'ro' 
            ? 'Ai acces Premium pentru 7 zile. Poți anula oricând.'
            : 'You have Premium access for 7 days. Cancel anytime.',
          [{ 
            text: 'OK', 
            onPress: () => {
              onPurchaseSuccess?.();
              onClose();
            }
          }]
        );
      } else if (result.userCancelled) {
        // User cancelled
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

  const handleRestorePurchase = async () => {
    setIsLoading(true);
    
    try {
      const result = await revenueCatService.restorePurchases();
      
      if (result.success && result.customerInfo) {
        const status = revenueCatService.getSubscriptionStatus(result.customerInfo);
        
        if (status.isPremium) {
          await syncWithRevenueCat();
          Alert.alert(
            lang === 'ro' ? 'Restaurat!' : 'Restored!',
            lang === 'ro' 
              ? 'Abonamentul tău Premium a fost restaurat.'
              : 'Your Premium subscription has been restored.',
            [{ text: 'OK', onPress: onClose }]
          );
        } else {
          Alert.alert(
            lang === 'ro' ? 'Nicio achiziție găsită' : 'No purchases found',
            lang === 'ro' 
              ? 'Nu s-au găsit achiziții anterioare pentru acest cont.'
              : 'No previous purchases found for this account.'
          );
        }
      } else {
        Alert.alert(
          lang === 'ro' ? 'Eroare' : 'Error',
          result.error || (lang === 'ro' ? 'Nu s-au găsit achiziții.' : 'No purchases found.')
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

  // Get actual price from offerings or use fallback
  const getDisplayPrice = (planType: 'monthly' | 'yearly') => {
    const pkg = getPackage(planType);
    if (pkg) {
      return pkg.product.priceString;
    }
    // Fallback to static prices
    return planType === 'monthly' 
      ? formatPrice(PRICING.monthly.price, PRICING.monthly.currency)
      : formatPrice(PRICING.yearly.price, PRICING.yearly.currency);
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <View style={[styles.container, { paddingTop: insets.top }]}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity style={styles.closeButton} onPress={onClose}>
            <Ionicons name="close" size={24} color="#FFFFFF" />
          </TouchableOpacity>
        </View>

        {isLoadingOfferings ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#6366F1" />
            <Text style={styles.loadingText}>
              {lang === 'ro' ? 'Se încarcă...' : 'Loading...'}
            </Text>
          </View>
        ) : (
          <ScrollView 
            style={styles.content} 
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.contentContainer}
          >
            {/* Premium Badge */}
            <View style={styles.premiumBadge}>
              <LinearGradient
                colors={['rgba(245, 158, 11, 0.2)', 'rgba(245, 158, 11, 0.05)']}
                style={styles.premiumBadgeGradient}
              >
                <Ionicons name="shield-checkmark" size={48} color="#F59E0B" />
              </LinearGradient>
            </View>

            {/* Title */}
            <Text style={styles.title}>Guardian AI Premium</Text>
            <Text style={styles.subtitle}>
              {lang === 'ro' 
                ? 'Protecție avansată pentru familia ta'
                : 'Advanced protection for your family'
              }
            </Text>
            
            {/* Feature-specific message */}
            {featureTitle && (
              <View style={styles.featureHighlight}>
                <Ionicons name="lock-closed" size={20} color="#6366F1" />
                <View style={styles.featureHighlightContent}>
                  <Text style={styles.featureTitle}>{featureTitle}</Text>
                  {featureDescription && (
                    <Text style={styles.featureDescription}>{featureDescription}</Text>
                  )}
                </View>
              </View>
            )}

            {/* Trial status */}
            {isInTrial && trialDaysLeft > 0 && (
              <View style={styles.trialBanner}>
                <Ionicons name="time" size={20} color="#10B981" />
                <Text style={styles.trialBannerText}>
                  {lang === 'ro' 
                    ? `${trialDaysLeft} zile rămase din trial`
                    : `${trialDaysLeft} days left in trial`
                  }
                </Text>
              </View>
            )}

            {/* Features List */}
            <View style={styles.featuresSection}>
              <Text style={styles.featuresTitle}>
                {lang === 'ro' ? 'Ce include Premium:' : 'Premium includes:'}
              </Text>
              {PREMIUM_FEATURE_LIST.map((feat) => (
                <View key={feat.id} style={styles.featureItem}>
                  <View style={styles.featureIcon}>
                    <Ionicons name={feat.icon as any} size={20} color="#6366F1" />
                  </View>
                  <View style={styles.featureText}>
                    <Text style={styles.featureItemTitle}>
                      {lang === 'ro' ? feat.titleRo : feat.title}
                    </Text>
                    <Text style={styles.featureItemDesc}>
                      {lang === 'ro' ? feat.descriptionRo : feat.description}
                    </Text>
                  </View>
                  <Ionicons name="checkmark-circle" size={22} color="#10B981" />
                </View>
              ))}
            </View>

            {/* Pricing Cards */}
            <View style={styles.pricingSection}>
              {/* Yearly - Best Value */}
              <TouchableOpacity
                style={[
                  styles.pricingCard,
                  selectedPlan === 'yearly' && styles.pricingCardSelected,
                ]}
                onPress={() => setSelectedPlan('yearly')}
              >
                <View style={styles.bestValueBadge}>
                  <Text style={styles.bestValueText}>
                    {lang === 'ro' ? 'Cea mai bună ofertă' : 'Best Value'}
                  </Text>
                </View>
                <View style={styles.pricingHeader}>
                  <Text style={styles.pricingPeriod}>
                    {lang === 'ro' ? 'Anual' : 'Yearly'}
                  </Text>
                  <View style={styles.pricingRow}>
                    <Text style={styles.pricingAmount}>
                      {getDisplayPrice('yearly')}
                    </Text>
                    <Text style={styles.pricingPerPeriod}>/{lang === 'ro' ? 'an' : 'year'}</Text>
                  </View>
                  <Text style={styles.pricingSavings}>
                    {lang === 'ro' 
                      ? `Economisești ${PRICING.yearly.savings}` 
                      : `Save ${PRICING.yearly.savings}`
                    }
                  </Text>
                </View>
                <Text style={styles.dailyPrice}>
                  {lang === 'ro' 
                    ? `Mai puțin de ${formatPrice(PRICING.dailyEquivalent, '€')}/zi`
                    : `Less than ${formatPrice(PRICING.dailyEquivalent, '€')}/day`
                  }
                </Text>
                {selectedPlan === 'yearly' && (
                  <View style={styles.selectedIndicator}>
                    <Ionicons name="checkmark-circle" size={24} color="#6366F1" />
                  </View>
                )}
              </TouchableOpacity>

              {/* Monthly */}
              <TouchableOpacity
                style={[
                  styles.pricingCard,
                  styles.pricingCardMonthly,
                  selectedPlan === 'monthly' && styles.pricingCardSelected,
                ]}
                onPress={() => setSelectedPlan('monthly')}
              >
                <View style={styles.pricingHeader}>
                  <Text style={styles.pricingPeriod}>
                    {lang === 'ro' ? 'Lunar' : 'Monthly'}
                  </Text>
                  <View style={styles.pricingRow}>
                    <Text style={styles.pricingAmount}>
                      {getDisplayPrice('monthly')}
                    </Text>
                    <Text style={styles.pricingPerPeriod}>/{lang === 'ro' ? 'lună' : 'month'}</Text>
                  </View>
                </View>
                {selectedPlan === 'monthly' && (
                  <View style={styles.selectedIndicator}>
                    <Ionicons name="checkmark-circle" size={24} color="#6366F1" />
                  </View>
                )}
              </TouchableOpacity>
            </View>

            {/* CTA Buttons */}
            <View style={styles.ctaSection}>
              {/* Trial Button - only if not used and eligible */}
              {canStartTrial && !isInTrial && (
                <TouchableOpacity
                  style={[styles.trialButton, isLoading && styles.buttonDisabled]}
                  onPress={handleStartTrial}
                  disabled={isLoading}
                >
                  {isLoading ? (
                    <ActivityIndicator color="#FFFFFF" />
                  ) : (
                    <>
                      <Ionicons name="gift" size={22} color="#FFFFFF" />
                      <Text style={styles.trialButtonText}>
                        {lang === 'ro' 
                          ? 'Începe 7 zile gratuit'
                          : 'Start 7-Day Free Trial'
                        }
                      </Text>
                    </>
                  )}
                </TouchableOpacity>
              )}

              {/* Subscribe Button */}
              {(!canStartTrial || isInTrial) && (
                <TouchableOpacity
                  style={[styles.subscribeButton, isLoading && styles.buttonDisabled]}
                  onPress={handlePurchase}
                  disabled={isLoading}
                >
                  {isLoading ? (
                    <ActivityIndicator color="#FFFFFF" />
                  ) : (
                    <Text style={styles.subscribeButtonText}>
                      {lang === 'ro' 
                        ? `Abonează-te - ${getDisplayPrice(selectedPlan)}/${selectedPlan === 'yearly' ? 'an' : 'lună'}`
                        : `Subscribe - ${getDisplayPrice(selectedPlan)}/${selectedPlan === 'yearly' ? 'year' : 'month'}`
                      }
                    </Text>
                  )}
                </TouchableOpacity>
              )}

              {/* Trial Once Notice */}
              {!canStartTrial && !isInTrial && (
                <Text style={styles.trialNotice}>
                  {lang === 'ro' 
                    ? 'Trial gratuit disponibil o singură dată per cont/dispozitiv'
                    : 'Free trial available once per account/device'
                  }
                </Text>
              )}

              {/* Cancel anytime */}
              <Text style={styles.cancelNotice}>
                {lang === 'ro' ? 'Poți anula oricând' : 'Cancel anytime'}
              </Text>

              {/* Restore Purchase */}
              <TouchableOpacity onPress={handleRestorePurchase} disabled={isLoading}>
                <Text style={styles.restoreText}>
                  {lang === 'ro' ? 'Restaurează achiziția' : 'Restore purchase'}
                </Text>
              </TouchableOpacity>
            </View>

            {/* Continue with Free */}
            <TouchableOpacity style={styles.continueFreeButtom} onPress={onClose}>
              <Text style={styles.continueFreeText}>
                {lang === 'ro' ? 'Continuă cu planul gratuit' : 'Continue with Free plan'}
              </Text>
            </TouchableOpacity>

            {/* Platform notice */}
            <Text style={styles.platformNotice}>
              {Platform.OS === 'ios' 
                ? (lang === 'ro' 
                    ? 'Abonamentul va fi facturat prin Apple.' 
                    : 'Subscription will be billed through Apple.')
                : (lang === 'ro' 
                    ? 'Abonamentul va fi facturat prin Google Play.' 
                    : 'Subscription will be billed through Google Play.')
              }
            </Text>

            <View style={{ height: 40 }} />
          </ScrollView>
        )}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0F172A',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  closeButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#1E293B',
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    color: '#94A3B8',
    fontSize: 16,
    marginTop: 12,
  },
  content: {
    flex: 1,
  },
  contentContainer: {
    paddingHorizontal: 24,
  },
  premiumBadge: {
    alignItems: 'center',
    marginBottom: 16,
  },
  premiumBadgeGradient: {
    width: 88,
    height: 88,
    borderRadius: 44,
    justifyContent: 'center',
    alignItems: 'center',
  },
  title: {
    fontSize: 28,
    fontWeight: '800',
    color: '#FFFFFF',
    textAlign: 'center',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: '#94A3B8',
    textAlign: 'center',
    marginBottom: 20,
  },
  featureHighlight: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(99, 102, 241, 0.15)',
    borderRadius: 12,
    padding: 16,
    marginVertical: 16,
    borderWidth: 1,
    borderColor: 'rgba(99, 102, 241, 0.3)',
    gap: 12,
  },
  featureHighlightContent: {
    flex: 1,
  },
  featureTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  featureDescription: {
    fontSize: 14,
    color: '#94A3B8',
    marginTop: 4,
  },
  trialBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 16,
    gap: 8,
    marginBottom: 16,
  },
  trialBannerText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#10B981',
  },
  featuresSection: {
    marginTop: 8,
    marginBottom: 24,
  },
  featuresTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#94A3B8',
    marginBottom: 16,
  },
  featureItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1E293B',
    borderRadius: 12,
    padding: 14,
    marginBottom: 8,
  },
  featureIcon: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: 'rgba(99, 102, 241, 0.15)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  featureText: {
    flex: 1,
  },
  featureItemTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  featureItemDesc: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 2,
  },
  pricingSection: {
    marginBottom: 24,
  },
  pricingCard: {
    backgroundColor: '#1E293B',
    borderRadius: 16,
    padding: 20,
    marginBottom: 12,
    borderWidth: 2,
    borderColor: 'transparent',
    position: 'relative',
  },
  pricingCardMonthly: {
    paddingTop: 20,
  },
  pricingCardSelected: {
    borderColor: '#6366F1',
    backgroundColor: 'rgba(99, 102, 241, 0.1)',
  },
  bestValueBadge: {
    position: 'absolute',
    top: -10,
    right: 16,
    backgroundColor: '#F59E0B',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
  },
  bestValueText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#0F172A',
  },
  pricingHeader: {
    marginBottom: 8,
  },
  pricingPeriod: {
    fontSize: 14,
    color: '#94A3B8',
    marginBottom: 4,
  },
  pricingRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
  },
  pricingAmount: {
    fontSize: 32,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  pricingPerPeriod: {
    fontSize: 16,
    color: '#64748B',
    marginLeft: 4,
  },
  pricingSavings: {
    fontSize: 13,
    color: '#10B981',
    fontWeight: '600',
    marginTop: 4,
  },
  dailyPrice: {
    fontSize: 13,
    color: '#6366F1',
    fontWeight: '500',
  },
  selectedIndicator: {
    position: 'absolute',
    top: 20,
    right: 20,
  },
  ctaSection: {
    alignItems: 'center',
  },
  trialButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#10B981',
    borderRadius: 14,
    paddingVertical: 18,
    paddingHorizontal: 24,
    width: '100%',
    gap: 10,
  },
  trialButtonText: {
    fontSize: 17,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  subscribeButton: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#6366F1',
    borderRadius: 14,
    paddingVertical: 18,
    paddingHorizontal: 24,
    width: '100%',
  },
  subscribeButtonText: {
    fontSize: 17,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  trialNotice: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 12,
    textAlign: 'center',
  },
  cancelNotice: {
    fontSize: 14,
    color: '#94A3B8',
    marginTop: 8,
  },
  restoreText: {
    fontSize: 14,
    color: '#6366F1',
    marginTop: 16,
    fontWeight: '500',
  },
  continueFreeButtom: {
    alignItems: 'center',
    marginTop: 20,
    paddingVertical: 12,
  },
  continueFreeText: {
    fontSize: 14,
    color: '#64748B',
  },
  platformNotice: {
    fontSize: 11,
    color: '#475569',
    textAlign: 'center',
    marginTop: 16,
  },
});
