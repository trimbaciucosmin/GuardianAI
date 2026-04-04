import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { useRouter, Stack } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { useCircleStore } from '../../lib/store';
import { useLanguage } from '../../lib/i18n';
import {
  generateWeeklyReport,
  SafetyReportData,
  getSafetyScoreColor,
  getSafetyScoreLabel,
  formatDuration,
} from '../../services/safetyReportService';
import { useSubscription } from '../../hooks/useSubscription';
import { PremiumGate } from '../../components/PremiumGate';

export default function SafetyReportScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { currentCircle } = useCircleStore();
  const { t, language } = useLanguage();
  
  // Subscription check
  const { canAccessFeature, isLoading: subscriptionLoading } = useSubscription();
  const hasWeeklyReportAccess = canAccessFeature('weeklyReport');
  
  const [report, setReport] = useState<SafetyReportData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [weekOffset, setWeekOffset] = useState(0);
  const [refreshing, setRefreshing] = useState(false);

  const loadReport = async () => {
    if (!currentCircle?.id || !hasWeeklyReportAccess) return;
    
    setIsLoading(true);
    const data = await generateWeeklyReport(currentCircle.id, weekOffset);
    setReport(data);
    setIsLoading(false);
  };

  useEffect(() => {
    if (hasWeeklyReportAccess) {
      loadReport();
    }
  }, [currentCircle?.id, weekOffset, hasWeeklyReportAccess]);

  const onRefresh = async () => {
    setRefreshing(true);
    await loadReport();
    setRefreshing(false);
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString(language === 'ro' ? 'ro-RO' : 'en-US', {
      day: 'numeric',
      month: 'short',
    });
  };

  const getPlaceIcon = (type: string) => {
    switch (type) {
      case 'home': return 'home';
      case 'school': return 'school';
      case 'work': return 'briefcase';
      default: return 'location';
    }
  };

  const getPlaceColor = (type: string) => {
    switch (type) {
      case 'home': return '#10B981';
      case 'school': return '#6366F1';
      case 'work': return '#F59E0B';
      default: return '#8B5CF6';
    }
  };

  // Show loading
  if (isLoading || subscriptionLoading) {
    return (
      <View style={[styles.container, styles.centered]}>
        <ActivityIndicator size="large" color="#6366F1" />
        <Text style={styles.loadingText}>
          {language === 'ro' ? 'Se generează raportul...' : 'Generating report...'}
        </Text>
      </View>
    );
  }

  // Premium gate check
  if (!hasWeeklyReportAccess) {
    return (
      <View style={styles.container}>
        <Stack.Screen
          options={{
            headerShown: true,
            title: language === 'ro' ? 'Raport Săptămânal' : 'Weekly Safety Report',
            headerStyle: { backgroundColor: '#0F172A' },
            headerTintColor: '#FFFFFF',
            headerShadowVisible: false,
          }}
        />
        <PremiumGate
          feature="weeklyReport"
          featureTitle="Weekly Safety Reports"
          featureTitleRo="Rapoarte Săptămânale"
          featureDescription="Get detailed safety insights and location analytics every week"
          featureDescriptionRo="Primește informații detaliate despre siguranță și analize de locație săptămânal"
        >
          <View />
        </PremiumGate>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
        <TouchableOpacity 
          style={styles.backButton}
          onPress={() => router.back()}
        >
          <Ionicons name="arrow-back" size={24} color="#FFFFFF" />
        </TouchableOpacity>
        <View style={styles.headerTitleContainer}>
          <Ionicons name="shield-checkmark" size={24} color="#10B981" />
          <Text style={styles.headerTitle}>
            {language === 'ro' ? 'Raport Săptămânal' : 'Weekly Report'}
          </Text>
        </View>
        <View style={{ width: 40 }} />
      </View>

      {/* Week Navigation */}
      <View style={styles.weekNavigation}>
        <TouchableOpacity 
          style={styles.weekNavButton}
          onPress={() => setWeekOffset(prev => prev - 1)}
        >
          <Ionicons name="chevron-back" size={20} color="#94A3B8" />
        </TouchableOpacity>
        
        <View style={styles.weekInfo}>
          <Text style={styles.weekLabel}>
            {language === 'ro' ? 'Săptămâna' : 'Week'} {report?.period.weekNumber}
          </Text>
          <Text style={styles.weekDates}>
            {report && `${formatDate(report.period.startDate)} - ${formatDate(report.period.endDate)}`}
          </Text>
        </View>
        
        <TouchableOpacity 
          style={[styles.weekNavButton, weekOffset >= 0 && styles.weekNavButtonDisabled]}
          onPress={() => weekOffset < 0 && setWeekOffset(prev => prev + 1)}
          disabled={weekOffset >= 0}
        >
          <Ionicons name="chevron-forward" size={20} color={weekOffset >= 0 ? '#475569' : '#94A3B8'} />
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#6366F1" />
        }
      >
        {/* Safety Score Card */}
        {report && (
          <View style={styles.scoreCard}>
            <LinearGradient
              colors={['rgba(99, 102, 241, 0.15)', 'rgba(99, 102, 241, 0.05)']}
              style={styles.scoreGradient}
            >
              <View style={styles.scoreCircle}>
                <Text style={[styles.scoreNumber, { color: getSafetyScoreColor(report.safetyScore) }]}>
                  {report.safetyScore}
                </Text>
                <Text style={styles.scoreMax}>/100</Text>
              </View>
              <Text style={[styles.scoreLabel, { color: getSafetyScoreColor(report.safetyScore) }]}>
                {getSafetyScoreLabel(report.safetyScore, language as 'en' | 'ro')}
              </Text>
              <Text style={styles.scoreSublabel}>
                {language === 'ro' ? 'Scor Siguranță' : 'Safety Score'}
              </Text>
            </LinearGradient>
          </View>
        )}

        {/* Summary Stats */}
        {report && (
          <View style={styles.summaryGrid}>
            <View style={styles.statCard}>
              <View style={[styles.statIcon, { backgroundColor: 'rgba(16, 185, 129, 0.15)' }]}>
                <Ionicons name="enter" size={20} color="#10B981" />
              </View>
              <Text style={styles.statNumber}>{report.summary.totalArrivals}</Text>
              <Text style={styles.statLabel}>{language === 'ro' ? 'Sosiri' : 'Arrivals'}</Text>
            </View>
            
            <View style={styles.statCard}>
              <View style={[styles.statIcon, { backgroundColor: 'rgba(99, 102, 241, 0.15)' }]}>
                <Ionicons name="exit" size={20} color="#6366F1" />
              </View>
              <Text style={styles.statNumber}>{report.summary.totalDepartures}</Text>
              <Text style={styles.statLabel}>{language === 'ro' ? 'Plecări' : 'Departures'}</Text>
            </View>
            
            <View style={styles.statCard}>
              <View style={[styles.statIcon, { backgroundColor: 'rgba(245, 158, 11, 0.15)' }]}>
                <Ionicons name="alert-circle" size={20} color="#F59E0B" />
              </View>
              <Text style={styles.statNumber}>{report.summary.totalDeviations}</Text>
              <Text style={styles.statLabel}>{language === 'ro' ? 'Devieri' : 'Deviations'}</Text>
            </View>
            
            <View style={styles.statCard}>
              <View style={[styles.statIcon, { backgroundColor: 'rgba(239, 68, 68, 0.15)' }]}>
                <Ionicons name="shield-outline" size={20} color="#EF4444" />
              </View>
              <Text style={styles.statNumber}>{report.summary.totalTamperAlerts}</Text>
              <Text style={styles.statLabel}>{language === 'ro' ? 'Alerte' : 'Alerts'}</Text>
            </View>
          </View>
        )}

        {/* Insights */}
        {report && report.insights.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>
              {language === 'ro' ? 'Observații' : 'Insights'}
            </Text>
            {report.insights.map((insight, index) => (
              <View key={index} style={styles.insightCard}>
                <Text style={styles.insightText}>{insight}</Text>
              </View>
            ))}
          </View>
        )}

        {/* Place Statistics */}
        {report && report.placeStats.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>
              {language === 'ro' ? 'Locuri Vizitate' : 'Visited Places'}
            </Text>
            {report.placeStats.filter(p => p.totalVisits > 0).map((place) => (
              <View key={place.placeId} style={styles.placeCard}>
                <View style={[styles.placeIcon, { backgroundColor: `${getPlaceColor(place.placeType)}20` }]}>
                  <Ionicons 
                    name={getPlaceIcon(place.placeType) as any} 
                    size={20} 
                    color={getPlaceColor(place.placeType)} 
                  />
                </View>
                <View style={styles.placeInfo}>
                  <Text style={styles.placeName}>{place.placeName}</Text>
                  <Text style={styles.placeStats}>
                    {place.totalVisits} {language === 'ro' ? 'vizite' : 'visits'} • {formatDuration(place.totalTimeSpentMinutes, language as 'en' | 'ro')} {language === 'ro' ? 'total' : 'total'}
                  </Text>
                </View>
                <View style={styles.placeVisits}>
                  <Text style={styles.placeVisitCount}>{place.totalVisits}</Text>
                </View>
              </View>
            ))}
            {report.placeStats.filter(p => p.totalVisits > 0).length === 0 && (
              <Text style={styles.emptyText}>
                {language === 'ro' ? 'Nicio vizită înregistrată' : 'No visits recorded'}
              </Text>
            )}
          </View>
        )}

        {/* Daily Activity Chart */}
        {report && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>
              {language === 'ro' ? 'Activitate Zilnică' : 'Daily Activity'}
            </Text>
            <View style={styles.activityChart}>
              {report.dailyActivity.map((day, index) => (
                <View key={index} style={styles.activityDay}>
                  <View style={styles.activityBars}>
                    <View 
                      style={[
                        styles.activityBar, 
                        styles.arrivalBar,
                        { height: Math.max(4, day.arrivals * 8) }
                      ]} 
                    />
                    <View 
                      style={[
                        styles.activityBar, 
                        styles.departureBar,
                        { height: Math.max(4, day.departures * 8) }
                      ]} 
                    />
                  </View>
                  <Text style={styles.activityDayLabel}>
                    {day.dayOfWeek.substring(0, 2)}
                  </Text>
                </View>
              ))}
            </View>
            <View style={styles.activityLegend}>
              <View style={styles.legendItem}>
                <View style={[styles.legendDot, { backgroundColor: '#10B981' }]} />
                <Text style={styles.legendText}>{language === 'ro' ? 'Sosiri' : 'Arrivals'}</Text>
              </View>
              <View style={styles.legendItem}>
                <View style={[styles.legendDot, { backgroundColor: '#6366F1' }]} />
                <Text style={styles.legendText}>{language === 'ro' ? 'Plecări' : 'Departures'}</Text>
              </View>
            </View>
          </View>
        )}

        {/* Deviations List */}
        {report && report.deviationDetails.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>
              {language === 'ro' ? 'Devieri Detectate' : 'Detected Deviations'}
            </Text>
            {report.deviationDetails.slice(0, 5).map((deviation) => (
              <View key={deviation.id} style={styles.deviationCard}>
                <View style={styles.deviationIcon}>
                  <Ionicons name="warning" size={18} color="#F59E0B" />
                </View>
                <View style={styles.deviationInfo}>
                  <Text style={styles.deviationMember}>{deviation.memberName}</Text>
                  <Text style={styles.deviationLocation}>{deviation.location}</Text>
                  <Text style={styles.deviationTime}>
                    {new Date(deviation.timestamp).toLocaleString(language === 'ro' ? 'ro-RO' : 'en-US')}
                  </Text>
                </View>
                {deviation.resolved && (
                  <Ionicons name="checkmark-circle" size={20} color="#10B981" />
                )}
              </View>
            ))}
          </View>
        )}

        {/* Empty State */}
        {report && 
          report.summary.totalArrivals === 0 && 
          report.summary.totalDepartures === 0 && 
          report.summary.totalDeviations === 0 && (
          <View style={styles.emptyState}>
            <Ionicons name="analytics-outline" size={48} color="#475569" />
            <Text style={styles.emptyStateText}>
              {language === 'ro' 
                ? 'Nu sunt date suficiente pentru această săptămână' 
                : 'Not enough data for this week'}
            </Text>
            <Text style={styles.emptyStateSubtext}>
              {language === 'ro' 
                ? 'Datele vor apărea pe măsură ce copiii folosesc aplicația'
                : 'Data will appear as children use the app'}
            </Text>
          </View>
        )}

        <View style={{ height: 100 }} />
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
  loadingText: {
    color: '#94A3B8',
    fontSize: 16,
    marginTop: 16,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 16,
    backgroundColor: '#0F172A',
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: 'rgba(30, 41, 59, 0.8)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  weekNavigation: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: 'rgba(30, 41, 59, 0.5)',
  },
  weekNavButton: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: 'rgba(30, 41, 59, 0.8)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  weekNavButtonDisabled: {
    opacity: 0.5,
  },
  weekInfo: {
    alignItems: 'center',
  },
  weekLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  weekDates: {
    fontSize: 13,
    color: '#94A3B8',
    marginTop: 2,
  },
  content: {
    flex: 1,
    paddingHorizontal: 16,
  },
  scoreCard: {
    marginTop: 16,
    borderRadius: 20,
    overflow: 'hidden',
  },
  scoreGradient: {
    alignItems: 'center',
    paddingVertical: 28,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(99, 102, 241, 0.3)',
  },
  scoreCircle: {
    flexDirection: 'row',
    alignItems: 'baseline',
  },
  scoreNumber: {
    fontSize: 56,
    fontWeight: '800',
  },
  scoreMax: {
    fontSize: 20,
    color: '#64748B',
    fontWeight: '600',
  },
  scoreLabel: {
    fontSize: 18,
    fontWeight: '700',
    marginTop: 8,
  },
  scoreSublabel: {
    fontSize: 13,
    color: '#64748B',
    marginTop: 4,
  },
  summaryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginTop: 20,
  },
  statCard: {
    flex: 1,
    minWidth: '45%',
    backgroundColor: 'rgba(30, 41, 59, 0.6)',
    borderRadius: 16,
    padding: 16,
    alignItems: 'center',
  },
  statIcon: {
    width: 44,
    height: 44,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 10,
  },
  statNumber: {
    fontSize: 28,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  statLabel: {
    fontSize: 12,
    color: '#94A3B8',
    marginTop: 4,
  },
  section: {
    marginTop: 28,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: 12,
  },
  insightCard: {
    backgroundColor: 'rgba(30, 41, 59, 0.6)',
    borderRadius: 12,
    padding: 14,
    marginBottom: 8,
  },
  insightText: {
    fontSize: 14,
    color: '#E2E8F0',
    lineHeight: 20,
  },
  placeCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(30, 41, 59, 0.6)',
    borderRadius: 14,
    padding: 14,
    marginBottom: 10,
  },
  placeIcon: {
    width: 44,
    height: 44,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  placeInfo: {
    flex: 1,
    marginLeft: 12,
  },
  placeName: {
    fontSize: 15,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  placeStats: {
    fontSize: 12,
    color: '#94A3B8',
    marginTop: 3,
  },
  placeVisits: {
    backgroundColor: 'rgba(99, 102, 241, 0.2)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 10,
  },
  placeVisitCount: {
    fontSize: 14,
    fontWeight: '700',
    color: '#6366F1',
  },
  activityChart: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    backgroundColor: 'rgba(30, 41, 59, 0.6)',
    borderRadius: 16,
    padding: 20,
    height: 140,
  },
  activityDay: {
    flex: 1,
    alignItems: 'center',
  },
  activityBars: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 3,
    marginBottom: 8,
  },
  activityBar: {
    width: 10,
    borderRadius: 4,
  },
  arrivalBar: {
    backgroundColor: '#10B981',
  },
  departureBar: {
    backgroundColor: '#6366F1',
  },
  activityDayLabel: {
    fontSize: 11,
    color: '#64748B',
    fontWeight: '600',
  },
  activityLegend: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 24,
    marginTop: 12,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  legendDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  legendText: {
    fontSize: 12,
    color: '#94A3B8',
  },
  deviationCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(30, 41, 59, 0.6)',
    borderRadius: 12,
    padding: 14,
    marginBottom: 8,
  },
  deviationIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: 'rgba(245, 158, 11, 0.15)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  deviationInfo: {
    flex: 1,
    marginLeft: 12,
  },
  deviationMember: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  deviationLocation: {
    fontSize: 12,
    color: '#94A3B8',
    marginTop: 2,
  },
  deviationTime: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 2,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 48,
  },
  emptyStateText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#94A3B8',
    marginTop: 16,
    textAlign: 'center',
  },
  emptyStateSubtext: {
    fontSize: 13,
    color: '#64748B',
    marginTop: 8,
    textAlign: 'center',
  },
  emptyText: {
    fontSize: 14,
    color: '#64748B',
    textAlign: 'center',
    paddingVertical: 20,
  },
});
