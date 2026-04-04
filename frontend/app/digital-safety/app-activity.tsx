/**
 * Digital Safety - App Activity Screen
 * Shows real app usage data (or simulated when not available)
 */

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  Platform,
} from 'react-native';
import { useRouter, Stack } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { useLanguage } from '../../lib/i18n';
import {
  getAppUsageData,
  getDailyUsageSummary,
  formatDuration,
  getRiskColor,
  getPlatformCapabilities,
} from '../../services/appUsageService';
import {
  AppUsageData,
  DailyUsageSummary,
  PlatformCapabilities,
  APP_CATEGORIES,
} from '../../types/digitalSafety';

export default function AppActivityScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { language } = useLanguage();
  const lang = language as 'en' | 'ro';

  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [usageData, setUsageData] = useState<AppUsageData[]>([]);
  const [summary, setSummary] = useState<DailyUsageSummary | null>(null);
  const [isSimulated, setIsSimulated] = useState(true);
  const [capabilities, setCapabilities] = useState<PlatformCapabilities | null>(null);
  const [activeTab, setActiveTab] = useState<'today' | 'week'>('today');

  const txt = {
    title: lang === 'ro' ? 'Activitate Aplicații' : 'App Activity',
    screenTime: lang === 'ro' ? 'Timp Ecran Azi' : 'Screen Time Today',
    topApps: lang === 'ro' ? 'Top Aplicații' : 'Top Apps',
    byCategory: lang === 'ro' ? 'Pe Categorii' : 'By Category',
    today: lang === 'ro' ? 'Azi' : 'Today',
    yesterday: lang === 'ro' ? 'Ieri' : 'Yesterday',
    week: lang === 'ro' ? '7 Zile' : '7 Days',
    lateNight: lang === 'ro' ? 'Utilizare Nocturnă' : 'Late Night Usage',
    pickups: lang === 'ro' ? 'Deblocări' : 'Pickups',
    simulated: lang === 'ro' ? 'Date Simulate' : 'Simulated Data',
    simulatedDesc: lang === 'ro' 
      ? 'Pentru date reale, este necesar un development build cu permisiuni native.'
      : 'For real data, a development build with native permissions is required.',
    allowed: lang === 'ro' ? 'Permis' : 'Allowed',
    limited: lang === 'ro' ? 'Limitat' : 'Limited',
    blocked: lang === 'ro' ? 'Blocat' : 'Blocked',
  };

  const loadData = async () => {
    try {
      const [usage, dailySummary] = await Promise.all([
        getAppUsageData(),
        getDailyUsageSummary(),
      ]);

      setUsageData(usage.data);
      setIsSimulated(usage.isSimulated);
      setCapabilities(usage.capabilities);
      setSummary(dailySummary);
    } catch (error) {
      console.error('Error loading app activity:', error);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const onRefresh = () => {
    setIsRefreshing(true);
    loadData();
  };

  if (isLoading) {
    return (
      <View style={[styles.container, styles.centered]}>
        <ActivityIndicator size="large" color="#6366F1" />
      </View>
    );
  }

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
        style={styles.content}
        contentContainerStyle={{ paddingBottom: insets.bottom + 20 }}
        refreshControl={
          <RefreshControl refreshing={isRefreshing} onRefresh={onRefresh} tintColor="#6366F1" />
        }
      >
        {/* Platform Notice */}
        {isSimulated && (
          <View style={styles.noticeCard}>
            <Ionicons name="information-circle" size={20} color="#F59E0B" />
            <View style={styles.noticeContent}>
              <Text style={styles.noticeTitle}>{txt.simulated}</Text>
              <Text style={styles.noticeText}>{txt.simulatedDesc}</Text>
              {capabilities?.limitations.map((limit, index) => (
                <Text key={index} style={styles.limitationText}>• {limit}</Text>
              ))}
            </View>
          </View>
        )}

        {/* Total Screen Time Card */}
        {summary && (
          <View style={styles.screenTimeCard}>
            <LinearGradient
              colors={['rgba(99, 102, 241, 0.2)', 'rgba(99, 102, 241, 0.05)']}
              style={styles.screenTimeGradient}
            >
              <View style={styles.screenTimeHeader}>
                <View style={styles.screenTimeIcon}>
                  <Ionicons name="phone-portrait" size={24} color="#6366F1" />
                </View>
                <View style={styles.screenTimeInfo}>
                  <Text style={styles.screenTimeLabel}>{txt.screenTime}</Text>
                  <Text style={styles.screenTimeValue}>
                    {formatDuration(summary.totalScreenTime, lang)}
                  </Text>
                </View>
              </View>

              <View style={styles.screenTimeStats}>
                <View style={styles.statItem}>
                  <Ionicons name="moon" size={18} color="#8B5CF6" />
                  <View>
                    <Text style={styles.statValue}>
                      {formatDuration(summary.lateNightUsage, lang)}
                    </Text>
                    <Text style={styles.statLabel}>{txt.lateNight}</Text>
                  </View>
                </View>
                <View style={styles.statDivider} />
                <View style={styles.statItem}>
                  <Ionicons name="hand-left" size={18} color="#10B981" />
                  <View>
                    <Text style={styles.statValue}>{summary.pickupCount}</Text>
                    <Text style={styles.statLabel}>{txt.pickups}</Text>
                  </View>
                </View>
              </View>
            </LinearGradient>
          </View>
        )}

        {/* Tab Selector */}
        <View style={styles.tabContainer}>
          <TouchableOpacity
            style={[styles.tab, activeTab === 'today' && styles.tabActive]}
            onPress={() => setActiveTab('today')}
          >
            <Text style={[styles.tabText, activeTab === 'today' && styles.tabTextActive]}>
              {txt.today}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.tab, activeTab === 'week' && styles.tabActive]}
            onPress={() => setActiveTab('week')}
          >
            <Text style={[styles.tabText, activeTab === 'week' && styles.tabTextActive]}>
              {txt.week}
            </Text>
          </TouchableOpacity>
        </View>

        {/* Top Apps */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{txt.topApps}</Text>
          {usageData.slice(0, 5).map((app, index) => (
            <View key={app.app.packageName} style={styles.appCard}>
              <View style={styles.appRank}>
                <Text style={styles.appRankText}>{index + 1}</Text>
              </View>
              <View style={styles.appIconPlaceholder}>
                <Ionicons 
                  name={APP_CATEGORIES[app.app.category]?.icon as any || 'apps'} 
                  size={24} 
                  color="#FFFFFF" 
                />
              </View>
              <View style={styles.appInfo}>
                <Text style={styles.appName}>{app.app.appName}</Text>
                <View style={styles.appMeta}>
                  <Text style={styles.appCategory}>
                    {lang === 'ro' 
                      ? APP_CATEGORIES[app.app.category]?.labelRo 
                      : APP_CATEGORIES[app.app.category]?.label
                    }
                  </Text>
                  <View style={[styles.riskDot, { backgroundColor: getRiskColor(app.riskLevel) }]} />
                </View>
              </View>
              <View style={styles.appUsage}>
                <Text style={styles.appUsageTime}>
                  {formatDuration(activeTab === 'today' ? app.usageToday : app.usageLast7Days, lang)}
                </Text>
                <Text style={styles.appUsageLabel}>
                  {activeTab === 'today' ? txt.today : txt.week}
                </Text>
              </View>
            </View>
          ))}
        </View>

        {/* Usage by Category */}
        {summary && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>{txt.byCategory}</Text>
            <View style={styles.categoryGrid}>
              {Object.entries(summary.usageByCategory)
                .filter(([_, time]) => time > 0)
                .sort(([, a], [, b]) => b - a)
                .slice(0, 6)
                .map(([category, time]) => (
                  <View key={category} style={styles.categoryCard}>
                    <View style={[
                      styles.categoryIcon,
                      { backgroundColor: `${getRiskColor(APP_CATEGORIES[category as keyof typeof APP_CATEGORIES]?.riskLevel || 'safe')}20` }
                    ]}>
                      <Ionicons
                        name={APP_CATEGORIES[category as keyof typeof APP_CATEGORIES]?.icon as any || 'apps'}
                        size={20}
                        color={getRiskColor(APP_CATEGORIES[category as keyof typeof APP_CATEGORIES]?.riskLevel || 'safe')}
                      />
                    </View>
                    <Text style={styles.categoryName}>
                      {lang === 'ro'
                        ? APP_CATEGORIES[category as keyof typeof APP_CATEGORIES]?.labelRo
                        : APP_CATEGORIES[category as keyof typeof APP_CATEGORIES]?.label
                      }
                    </Text>
                    <Text style={styles.categoryTime}>{formatDuration(time, lang)}</Text>
                  </View>
                ))}
            </View>
          </View>
        )}

        {/* All Apps */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>
            {lang === 'ro' ? 'Toate Aplicațiile' : 'All Apps'}
          </Text>
          {usageData.map((app) => (
            <View key={app.app.packageName} style={styles.appRow}>
              <View style={styles.appIconSmall}>
                <Ionicons
                  name={APP_CATEGORIES[app.app.category]?.icon as any || 'apps'}
                  size={18}
                  color="#94A3B8"
                />
              </View>
              <Text style={styles.appRowName} numberOfLines={1}>{app.app.appName}</Text>
              <Text style={styles.appRowTime}>
                {formatDuration(activeTab === 'today' ? app.usageToday : app.usageLast7Days, lang)}
              </Text>
            </View>
          ))}
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
  content: {
    flex: 1,
  },
  noticeCard: {
    flexDirection: 'row',
    backgroundColor: 'rgba(245, 158, 11, 0.15)',
    margin: 16,
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(245, 158, 11, 0.3)',
    gap: 12,
  },
  noticeContent: {
    flex: 1,
  },
  noticeTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#F59E0B',
    marginBottom: 4,
  },
  noticeText: {
    fontSize: 13,
    color: '#94A3B8',
    marginBottom: 8,
  },
  limitationText: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 2,
  },
  screenTimeCard: {
    margin: 16,
    marginTop: 8,
    borderRadius: 16,
    overflow: 'hidden',
  },
  screenTimeGradient: {
    padding: 20,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(99, 102, 241, 0.2)',
  },
  screenTimeHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  screenTimeIcon: {
    width: 50,
    height: 50,
    borderRadius: 14,
    backgroundColor: 'rgba(99, 102, 241, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 14,
  },
  screenTimeInfo: {
    flex: 1,
  },
  screenTimeLabel: {
    fontSize: 14,
    color: '#94A3B8',
  },
  screenTimeValue: {
    fontSize: 32,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  screenTimeStats: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statItem: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  statDivider: {
    width: 1,
    height: 30,
    backgroundColor: 'rgba(148, 163, 184, 0.2)',
  },
  statValue: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  statLabel: {
    fontSize: 11,
    color: '#64748B',
  },
  tabContainer: {
    flexDirection: 'row',
    marginHorizontal: 16,
    backgroundColor: '#1E293B',
    borderRadius: 12,
    padding: 4,
  },
  tab: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    borderRadius: 10,
  },
  tabActive: {
    backgroundColor: '#6366F1',
  },
  tabText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#64748B',
  },
  tabTextActive: {
    color: '#FFFFFF',
  },
  section: {
    marginTop: 24,
    paddingHorizontal: 16,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: 12,
  },
  appCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1E293B',
    borderRadius: 14,
    padding: 14,
    marginBottom: 8,
  },
  appRank: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: 'rgba(99, 102, 241, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  appRankText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#6366F1',
  },
  appIconPlaceholder: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: '#334155',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  appInfo: {
    flex: 1,
  },
  appName: {
    fontSize: 15,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  appMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
    gap: 6,
  },
  appCategory: {
    fontSize: 12,
    color: '#64748B',
  },
  riskDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  appUsage: {
    alignItems: 'flex-end',
  },
  appUsageTime: {
    fontSize: 15,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  appUsageLabel: {
    fontSize: 11,
    color: '#64748B',
  },
  categoryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  categoryCard: {
    width: '31%',
    backgroundColor: '#1E293B',
    borderRadius: 12,
    padding: 12,
    alignItems: 'center',
  },
  categoryIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  categoryName: {
    fontSize: 11,
    color: '#94A3B8',
    textAlign: 'center',
  },
  categoryTime: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFFFFF',
    marginTop: 4,
  },
  appRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(30, 41, 59, 0.5)',
  },
  appIconSmall: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: '#1E293B',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  appRowName: {
    flex: 1,
    fontSize: 14,
    color: '#FFFFFF',
  },
  appRowTime: {
    fontSize: 14,
    fontWeight: '600',
    color: '#94A3B8',
  },
});
