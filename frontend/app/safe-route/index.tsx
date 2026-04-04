/**
 * Safe Route Screen
 * Setup and monitor safe routes (Home ↔ School)
 * PREMIUM FEATURE - Requires subscription
 */

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { useRouter, Stack } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { supabase } from '../../lib/supabase';
import { useAuthStore, useCircleStore, usePlacesStore } from '../../lib/store';
import { useLanguage } from '../../lib/i18n';
import { getLearnedRoutes } from '../../services/safeRouteService';
import { LearnedRoute } from '../../types/safeRoute';
import { Place } from '../../types';
import { useSubscription } from '../../hooks/useSubscription';
import { PremiumGate } from '../../components/PremiumGate';

export default function SafeRouteScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { t, language } = useLanguage();
  const { user, profile } = useAuthStore();
  const { currentCircle } = useCircleStore();
  const { places } = usePlacesStore();
  
  // Subscription check
  const { canAccessFeature, isPremium, isLoading: subscriptionLoading } = useSubscription();
  const hasSafeRoutesAccess = canAccessFeature('safeRoutes');
  
  const [isLoading, setIsLoading] = useState(true);
  const [learnedRoutes, setLearnedRoutes] = useState<LearnedRoute[]>([]);
  const [homePlace, setHomePlace] = useState<Place | null>(null);
  const [schoolPlace, setSchoolPlace] = useState<Place | null>(null);

  // Translations
  const texts = {
    en: {
      title: 'Safe Routes',
      subtitle: 'Learn and monitor daily routes',
      setupRequired: 'Setup Required',
      setupDesc: 'Add Home and School locations to enable route learning',
      addPlaces: 'Add Safe Places',
      homeToSchool: 'Home → School',
      schoolToHome: 'School → Home',
      learned: 'Learned',
      learning: 'Learning...',
      trips: 'trips',
      confidence: 'confidence',
      avgTime: 'avg time',
      minutes: 'min',
      startRoute: 'Start Route',
      learnRoute: 'Learn Route',
      noRoutesYet: 'No routes learned yet',
      noRoutesDesc: 'Start a trip to begin learning your usual routes',
      routeDeviation: 'Route Deviation',
      routeDeviationDesc: 'Get alerts when your child deviates from their usual path',
      unusualStop: 'Unusual Stops',
      unusualStopDesc: 'Get notified about unexpected stops along the route',
      lateArrival: 'Late Arrival',
      lateArrivalDesc: 'Know when your child is running late',
      howItWorks: 'How It Works',
      step1: '1. Add Home and School as Safe Places',
      step2: '2. Start a trip when leaving for school',
      step3: '3. The app learns the usual route after 3 trips',
      step4: '4. Get alerts for any unusual activity',
    },
    ro: {
      title: 'Trasee Sigure',
      subtitle: 'Învață și monitorizează traseele zilnice',
      setupRequired: 'Configurare necesară',
      setupDesc: 'Adaugă locațiile Acasă și Școală pentru a activa învățarea traseelor',
      addPlaces: 'Adaugă locuri sigure',
      homeToSchool: 'Acasă → Școală',
      schoolToHome: 'Școală → Acasă',
      learned: 'Învățat',
      learning: 'Se învață...',
      trips: 'călătorii',
      confidence: 'încredere',
      avgTime: 'timp mediu',
      minutes: 'min',
      startRoute: 'Începe traseu',
      learnRoute: 'Învață traseu',
      noRoutesYet: 'Niciun traseu învățat',
      noRoutesDesc: 'Începe o călătorie pentru a învăța traseele tale obișnuite',
      routeDeviation: 'Deviere de traseu',
      routeDeviationDesc: 'Primește alerte când copilul tău deviază de la traseul obișnuit',
      unusualStop: 'Opriri neobișnuite',
      unusualStopDesc: 'Fii notificat despre opriri neașteptate pe traseu',
      lateArrival: 'Întârziere',
      lateArrivalDesc: 'Află când copilul tău întârzie',
      howItWorks: 'Cum funcționează',
      step1: '1. Adaugă Acasă și Școala ca locuri sigure',
      step2: '2. Începe o călătorie când pleci spre școală',
      step3: '3. Aplicația învață traseul obișnuit după 3 călătorii',
      step4: '4. Primește alerte pentru orice activitate neobișnuită',
    },
  };
  
  const txt = texts[language];

  useEffect(() => {
    loadData();
  }, [user?.id, currentCircle?.id]);

  const loadData = async () => {
    if (!user?.id || !currentCircle?.id) return;
    
    setIsLoading(true);
    try {
      // Find home and school places
      const home = places.find(p => p.type === 'home');
      const school = places.find(p => p.type === 'school');
      setHomePlace(home || null);
      setSchoolPlace(school || null);
      
      // Get learned routes
      const routes = await getLearnedRoutes(user.id, currentCircle.id);
      setLearnedRoutes(routes);
    } catch (error) {
      console.error('Error loading safe route data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleStartRoute = (routeType: 'home_to_school' | 'school_to_home') => {
    const existingRoute = learnedRoutes.find(r => r.route_type === routeType);
    
    router.push({
      pathname: '/safe-route/active',
      params: {
        routeType,
        routeId: existingRoute?.id || '',
        startPlaceId: routeType === 'home_to_school' ? homePlace?.id : schoolPlace?.id,
        endPlaceId: routeType === 'home_to_school' ? schoolPlace?.id : homePlace?.id,
      },
    });
  };

  const getRouteStats = (routeType: 'home_to_school' | 'school_to_home') => {
    const route = learnedRoutes.find(r => r.route_type === routeType);
    if (!route) return null;
    return {
      tripCount: route.trip_count,
      confidence: route.confidence_score,
      avgMinutes: Math.round(route.average_duration_minutes),
      isLearned: route.confidence_score >= 70,
    };
  };

  const homeToSchoolStats = getRouteStats('home_to_school');
  const schoolToHomeStats = getRouteStats('school_to_home');

  if (isLoading || subscriptionLoading) {
    return (
      <View style={[styles.container, styles.centered]}>
        <ActivityIndicator size="large" color="#6366F1" />
      </View>
    );
  }

  // Premium gate check - show paywall if not subscribed
  if (!hasSafeRoutesAccess) {
    return (
      <View style={styles.container}>
        <Stack.Screen
          options={{
            headerShown: true,
            title: txt.title,
            headerStyle: { backgroundColor: '#0F172A' },
            headerTintColor: '#FFFFFF',
            headerShadowVisible: false,
          }}
        />
        <PremiumGate
          feature="safeRoutes"
          featureTitle="Smart Safe Routes"
          featureTitleRo="Rute Sigure Inteligente"
          featureDescription="AI learns your child's daily routes and alerts you to deviations"
          featureDescriptionRo="AI învață rutele zilnice ale copilului și te alertează la devieri"
        >
          <View />
        </PremiumGate>
      </View>
    );
  }

  const needsSetup = !homePlace || !schoolPlace;

  return (
    <View style={styles.container}>
      <Stack.Screen
        options={{
          headerShown: true,
          title: txt.title,
          headerStyle: { backgroundColor: '#0F172A' },
          headerTintColor: '#FFFFFF',
          headerShadowVisible: false,
        }}
      />
      
      <ScrollView 
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: insets.bottom + 20 }}
      >
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.headerIcon}>
            <Ionicons name="navigate" size={32} color="#6366F1" />
          </View>
          <Text style={styles.headerTitle}>{txt.title}</Text>
          <Text style={styles.headerSubtitle}>{txt.subtitle}</Text>
        </View>

        {/* Setup Required Banner */}
        {needsSetup && (
          <View style={styles.setupBanner}>
            <Ionicons name="warning" size={24} color="#FBBF24" />
            <View style={styles.setupBannerContent}>
              <Text style={styles.setupBannerTitle}>{txt.setupRequired}</Text>
              <Text style={styles.setupBannerText}>{txt.setupDesc}</Text>
            </View>
            <TouchableOpacity
              style={styles.setupBtn}
              onPress={() => router.push('/place/create')}
            >
              <Text style={styles.setupBtnText}>{txt.addPlaces}</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Route Cards */}
        {!needsSetup && (
          <View style={styles.routesSection}>
            {/* Home to School */}
            <View style={styles.routeCard}>
              <View style={styles.routeHeader}>
                <View style={styles.routeIconContainer}>
                  <Ionicons name="home" size={20} color="#10B981" />
                  <Ionicons name="arrow-forward" size={16} color="#64748B" />
                  <Ionicons name="school" size={20} color="#6366F1" />
                </View>
                <Text style={styles.routeTitle}>{txt.homeToSchool}</Text>
                {homeToSchoolStats?.isLearned && (
                  <View style={styles.learnedBadge}>
                    <Ionicons name="checkmark-circle" size={14} color="#10B981" />
                    <Text style={styles.learnedText}>{txt.learned}</Text>
                  </View>
                )}
              </View>
              
              {homeToSchoolStats ? (
                <View style={styles.routeStats}>
                  <View style={styles.statItem}>
                    <Text style={styles.statValue}>{homeToSchoolStats.tripCount}</Text>
                    <Text style={styles.statLabel}>{txt.trips}</Text>
                  </View>
                  <View style={styles.confidenceContainer}>
                    <View style={styles.confidenceHeader}>
                      <Text style={styles.confidenceValue}>{homeToSchoolStats.confidence}%</Text>
                      <Text style={styles.confidenceLabel}>{txt.confidence}</Text>
                    </View>
                    <View style={styles.confidenceBar}>
                      <View style={[
                        styles.confidenceFill, 
                        { 
                          width: `${homeToSchoolStats.confidence}%`,
                          backgroundColor: homeToSchoolStats.confidence >= 70 ? '#10B981' : 
                                          homeToSchoolStats.confidence >= 40 ? '#F59E0B' : '#EF4444'
                        }
                      ]} />
                    </View>
                    <Text style={styles.confidenceHint}>
                      {homeToSchoolStats.confidence >= 70 ? '✓ Reliable' : 
                       homeToSchoolStats.confidence >= 40 ? '⚡ Learning' : '⏳ More trips needed'}
                    </Text>
                  </View>
                  <View style={styles.statItem}>
                    <Text style={styles.statValue}>{homeToSchoolStats.avgMinutes}</Text>
                    <Text style={styles.statLabel}>{txt.minutes}</Text>
                  </View>
                </View>
              ) : (
                <View style={styles.noRouteContainer}>
                  <ActivityIndicator size="small" color="#6366F1" />
                  <Text style={styles.noRouteText}>
                    {language === 'ro' ? 'Așteptăm primul traseu...' : 'Waiting for first trip...'}
                  </Text>
                </View>
              )}
              
              <TouchableOpacity
                style={styles.startRouteBtn}
                onPress={() => handleStartRoute('home_to_school')}
              >
                <LinearGradient
                  colors={['#6366F1', '#4F46E5']}
                  style={styles.startRouteBtnGradient}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                >
                  <Ionicons name="play" size={18} color="#FFFFFF" />
                  <Text style={styles.startRouteBtnText}>
                    {homeToSchoolStats ? txt.startRoute : txt.learnRoute}
                  </Text>
                </LinearGradient>
              </TouchableOpacity>
            </View>

            {/* School to Home */}
            <View style={styles.routeCard}>
              <View style={styles.routeHeader}>
                <View style={styles.routeIconContainer}>
                  <Ionicons name="school" size={20} color="#6366F1" />
                  <Ionicons name="arrow-forward" size={16} color="#64748B" />
                  <Ionicons name="home" size={20} color="#10B981" />
                </View>
                <Text style={styles.routeTitle}>{txt.schoolToHome}</Text>
                {schoolToHomeStats?.isLearned && (
                  <View style={styles.learnedBadge}>
                    <Ionicons name="checkmark-circle" size={14} color="#10B981" />
                    <Text style={styles.learnedText}>{txt.learned}</Text>
                  </View>
                )}
              </View>
              
              {schoolToHomeStats ? (
                <View style={styles.routeStats}>
                  <View style={styles.statItem}>
                    <Text style={styles.statValue}>{schoolToHomeStats.tripCount}</Text>
                    <Text style={styles.statLabel}>{txt.trips}</Text>
                  </View>
                  <View style={styles.statItem}>
                    <Text style={styles.statValue}>{schoolToHomeStats.confidence}%</Text>
                    <Text style={styles.statLabel}>{txt.confidence}</Text>
                  </View>
                  <View style={styles.statItem}>
                    <Text style={styles.statValue}>{schoolToHomeStats.avgMinutes}</Text>
                    <Text style={styles.statLabel}>{txt.minutes}</Text>
                  </View>
                </View>
              ) : (
                <Text style={styles.noRouteText}>{txt.learning}</Text>
              )}
              
              <TouchableOpacity
                style={styles.startRouteBtn}
                onPress={() => handleStartRoute('school_to_home')}
              >
                <LinearGradient
                  colors={['#10B981', '#059669']}
                  style={styles.startRouteBtnGradient}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                >
                  <Ionicons name="play" size={18} color="#FFFFFF" />
                  <Text style={styles.startRouteBtnText}>
                    {schoolToHomeStats ? txt.startRoute : txt.learnRoute}
                  </Text>
                </LinearGradient>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* Features */}
        <View style={styles.featuresSection}>
          <View style={styles.featureCard}>
            <View style={[styles.featureIcon, { backgroundColor: 'rgba(239, 68, 68, 0.15)' }]}>
              <Ionicons name="warning" size={24} color="#EF4444" />
            </View>
            <View style={styles.featureContent}>
              <Text style={styles.featureTitle}>{txt.routeDeviation}</Text>
              <Text style={styles.featureDesc}>{txt.routeDeviationDesc}</Text>
            </View>
          </View>

          <View style={styles.featureCard}>
            <View style={[styles.featureIcon, { backgroundColor: 'rgba(251, 191, 36, 0.15)' }]}>
              <Ionicons name="time" size={24} color="#FBBF24" />
            </View>
            <View style={styles.featureContent}>
              <Text style={styles.featureTitle}>{txt.unusualStop}</Text>
              <Text style={styles.featureDesc}>{txt.unusualStopDesc}</Text>
            </View>
          </View>

          <View style={styles.featureCard}>
            <View style={[styles.featureIcon, { backgroundColor: 'rgba(99, 102, 241, 0.15)' }]}>
              <Ionicons name="notifications" size={24} color="#6366F1" />
            </View>
            <View style={styles.featureContent}>
              <Text style={styles.featureTitle}>{txt.lateArrival}</Text>
              <Text style={styles.featureDesc}>{txt.lateArrivalDesc}</Text>
            </View>
          </View>
        </View>

        {/* How It Works */}
        <View style={styles.howItWorksSection}>
          <Text style={styles.sectionTitle}>{txt.howItWorks}</Text>
          <View style={styles.steps}>
            <Text style={styles.stepText}>{txt.step1}</Text>
            <Text style={styles.stepText}>{txt.step2}</Text>
            <Text style={styles.stepText}>{txt.step3}</Text>
            <Text style={styles.stepText}>{txt.step4}</Text>
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0F172A',
  },
  centered: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: {
    alignItems: 'center',
    paddingVertical: 24,
    paddingHorizontal: 20,
  },
  headerIcon: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: 'rgba(99, 102, 241, 0.15)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: 8,
  },
  headerSubtitle: {
    fontSize: 16,
    color: '#94A3B8',
    textAlign: 'center',
  },
  setupBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(251, 191, 36, 0.1)',
    marginHorizontal: 20,
    padding: 16,
    borderRadius: 16,
    borderLeftWidth: 4,
    borderLeftColor: '#FBBF24',
    marginBottom: 24,
  },
  setupBannerContent: {
    flex: 1,
    marginLeft: 12,
  },
  setupBannerTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  setupBannerText: {
    fontSize: 13,
    color: '#94A3B8',
    marginTop: 4,
  },
  setupBtn: {
    backgroundColor: '#FBBF24',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
  },
  setupBtnText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#0F172A',
  },
  routesSection: {
    paddingHorizontal: 20,
    gap: 16,
    marginBottom: 24,
  },
  routeCard: {
    backgroundColor: '#1E293B',
    borderRadius: 20,
    padding: 20,
  },
  routeHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  routeIconContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
  },
  routeTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#FFFFFF',
    marginLeft: 12,
    flex: 1,
  },
  learnedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    gap: 4,
  },
  learnedText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#10B981',
  },
  routeStats: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: 16,
  },
  statItem: {
    alignItems: 'center',
  },
  statValue: {
    fontSize: 24,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  statLabel: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 4,
  },
  confidenceContainer: {
    flex: 1,
    alignItems: 'center',
    marginHorizontal: 16,
  },
  confidenceHeader: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 4,
  },
  confidenceValue: {
    fontSize: 24,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  confidenceLabel: {
    fontSize: 12,
    color: '#64748B',
  },
  confidenceBar: {
    width: '100%',
    height: 6,
    backgroundColor: 'rgba(100, 116, 139, 0.3)',
    borderRadius: 3,
    marginTop: 8,
    overflow: 'hidden',
  },
  confidenceFill: {
    height: '100%',
    borderRadius: 3,
  },
  confidenceHint: {
    fontSize: 10,
    color: '#94A3B8',
    marginTop: 4,
  },
  noRouteContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    paddingVertical: 12,
    marginBottom: 16,
  },
  noRouteText: {
    fontSize: 14,
    color: '#64748B',
    textAlign: 'center',
  },
  startRouteBtn: {
    borderRadius: 12,
    overflow: 'hidden',
  },
  startRouteBtnGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    gap: 8,
  },
  startRouteBtnText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  featuresSection: {
    paddingHorizontal: 20,
    gap: 12,
    marginBottom: 24,
  },
  featureCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1E293B',
    borderRadius: 16,
    padding: 16,
  },
  featureIcon: {
    width: 48,
    height: 48,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
  },
  featureContent: {
    flex: 1,
    marginLeft: 14,
  },
  featureTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  featureDesc: {
    fontSize: 13,
    color: '#94A3B8',
    marginTop: 4,
  },
  howItWorksSection: {
    paddingHorizontal: 20,
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: 16,
  },
  steps: {
    backgroundColor: '#1E293B',
    borderRadius: 16,
    padding: 16,
    gap: 12,
  },
  stepText: {
    fontSize: 14,
    color: '#E2E8F0',
    lineHeight: 22,
  },
});
