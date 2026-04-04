/**
 * Digital Safety - Main Index Screen
 * Entry point for parent digital safety controls
 */

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { useRouter, Stack } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { useLanguage } from '../../lib/i18n';
import { useCircleStore } from '../../lib/store';
import { getPlatformCapabilities, getDailyUsageSummary, formatDuration } from '../../services/appUsageService';
import { getFocusLockStatus } from '../../services/appControlService';
import { DailyUsageSummary, PlatformCapabilities } from '../../types/digitalSafety';

export default function DigitalSafetyScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { language } = useLanguage();
  const { members, currentCircle } = useCircleStore();
  const lang = language as 'en' | 'ro';

  const [isLoading, setIsLoading] = useState(true);
  const [capabilities, setCapabilities] = useState<PlatformCapabilities | null>(null);
  const [summary, setSummary] = useState<DailyUsageSummary | null>(null);

  const children = members.filter(m => m.role === 'child');

  const txt = {
    title: lang === 'ro' ? 'Siguranță Digitală' : 'Digital Safety',
    subtitle: lang === 'ro' 
      ? 'Monitorizează și controlează utilizarea aplicațiilor'
      : 'Monitor and control app usage',
    appActivity: lang === 'ro' ? 'Activitate Aplicații' : 'App Activity',
    appActivityDesc: lang === 'ro' 
      ? 'Vezi ce aplicații folosește copilul' 
      : 'See what apps your child uses',
    appLimits: lang === 'ro' ? 'Limite Aplicații' : 'App Limits',
    appLimitsDesc: lang === 'ro' 
      ? 'Setează limite de timp pentru aplicații' 
      : 'Set time limits for apps',
    focusLock: lang === 'ro' ? 'Mod Focus' : 'Focus Lock',
    focusLockDesc: lang === 'ro' 
      ? 'Activează modul studiu sau somn' 
      : 'Activate study or sleep mode',
    blockedApps: lang === 'ro' ? 'Aplicații Blocate' : 'Blocked Apps',
    blockedAppsDesc: lang === 'ro' 
      ? 'Gestionează aplicațiile restricționate' 
      : 'Manage restricted apps',
    selectChild: lang === 'ro' ? 'Selectează copilul' : 'Select child',
    noChildren: lang === 'ro' 
      ? 'Adaugă un copil pentru a folosi Digital Safety' 
      : 'Add a child to use Digital Safety',
    screenTimeToday: lang === 'ro' ? 'Timp Ecran Azi' : 'Screen Time Today',
    platformNotice: lang === 'ro' ? 'Notă Platformă' : 'Platform Notice',
  };

  const [selectedChildId, setSelectedChildId] = useState<string | null>(
    children.length > 0 ? children[0].user_id : null
  );

  const selectedChild = children.find(c => c.user_id === selectedChildId);

  useEffect(() => {
    const loadData = async () => {
      try {
        const caps = getPlatformCapabilities();
        setCapabilities(caps);
        const sum = await getDailyUsageSummary();
        setSummary(sum);
      } catch (error) {
        console.error('Error loading data:', error);
      } finally {
        setIsLoading(false);
      }
    };
    loadData();
  }, []);

  useEffect(() => {
    if (children.length > 0 && !selectedChildId) {
      setSelectedChildId(children[0].user_id);
    }
  }, [children]);

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
      >
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.headerIcon}>
            <Ionicons name="shield-checkmark" size={32} color="#6366F1" />
          </View>
          <Text style={styles.headerTitle}>{txt.title}</Text>
          <Text style={styles.headerSubtitle}>{txt.subtitle}</Text>
        </View>

        {/* Platform Notice */}
        {capabilities && capabilities.limitations.length > 0 && (
          <View style={styles.noticeCard}>
            <Ionicons name="information-circle" size={20} color="#3B82F6" />
            <View style={styles.noticeContent}>
              <Text style={styles.noticeTitle}>{txt.platformNotice}</Text>
              {capabilities.limitations.slice(0, 2).map((limit, index) => (
                <Text key={index} style={styles.noticeText}>• {limit}</Text>
              ))}
            </View>
          </View>
        )}

        {/* Child Selector */}
        {children.length > 0 ? (
          <View style={styles.childSelector}>
            <Text style={styles.selectorLabel}>{txt.selectChild}</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              <View style={styles.childTabs}>
                {children.map((child) => (
                  <TouchableOpacity
                    key={child.user_id}
                    style={[
                      styles.childTab,
                      selectedChildId === child.user_id && styles.childTabActive
                    ]}
                    onPress={() => setSelectedChildId(child.user_id)}
                  >
                    <View style={[
                      styles.childAvatar,
                      selectedChildId === child.user_id && styles.childAvatarActive
                    ]}>
                      <Ionicons 
                        name="person" 
                        size={18} 
                        color={selectedChildId === child.user_id ? '#FFFFFF' : '#64748B'} 
                      />
                    </View>
                    <Text style={[
                      styles.childName,
                      selectedChildId === child.user_id && styles.childNameActive
                    ]}>
                      {child.profile?.name || 'Child'}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </ScrollView>
          </View>
        ) : (
          <View style={styles.noChildrenCard}>
            <Ionicons name="people-outline" size={40} color="#64748B" />
            <Text style={styles.noChildrenText}>{txt.noChildren}</Text>
            <TouchableOpacity
              style={styles.addChildBtn}
              onPress={() => router.push('/circle/manage-member')}
            >
              <Text style={styles.addChildText}>
                {lang === 'ro' ? 'Adaugă Copil' : 'Add Child'}
              </Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Screen Time Summary */}
        {summary && selectedChildId && (
          <View style={styles.summaryCard}>
            <LinearGradient
              colors={['rgba(99, 102, 241, 0.2)', 'rgba(99, 102, 241, 0.05)']}
              style={styles.summaryGradient}
            >
              <View style={styles.summaryHeader}>
                <Ionicons name="phone-portrait" size={24} color="#6366F1" />
                <Text style={styles.summaryLabel}>{txt.screenTimeToday}</Text>
              </View>
              <Text style={styles.summaryValue}>
                {formatDuration(summary.totalScreenTime, lang)}
              </Text>
              <View style={styles.summaryMeta}>
                <View style={styles.summaryMetaItem}>
                  <Ionicons name="apps" size={16} color="#64748B" />
                  <Text style={styles.summaryMetaText}>
                    {summary.topApps.length} {lang === 'ro' ? 'aplicații' : 'apps'}
                  </Text>
                </View>
                <View style={styles.summaryMetaItem}>
                  <Ionicons name="moon" size={16} color="#8B5CF6" />
                  <Text style={styles.summaryMetaText}>
                    {formatDuration(summary.lateNightUsage, lang)} {lang === 'ro' ? 'noapte' : 'late'}
                  </Text>
                </View>
              </View>
            </LinearGradient>
          </View>
        )}

        {/* Menu Items */}
        {selectedChildId && (
          <View style={styles.menuSection}>
            {/* App Activity */}
            <TouchableOpacity
              style={styles.menuItem}
              onPress={() => router.push('/digital-safety/app-activity')}
            >
              <View style={[styles.menuIcon, { backgroundColor: 'rgba(16, 185, 129, 0.15)' }]}>
                <Ionicons name="stats-chart" size={24} color="#10B981" />
              </View>
              <View style={styles.menuInfo}>
                <Text style={styles.menuTitle}>{txt.appActivity}</Text>
                <Text style={styles.menuDesc}>{txt.appActivityDesc}</Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color="#64748B" />
            </TouchableOpacity>

            {/* App Limits */}
            <TouchableOpacity
              style={styles.menuItem}
              onPress={() => router.push({
                pathname: '/digital-safety/app-limits',
                params: { childId: selectedChildId }
              })}
            >
              <View style={[styles.menuIcon, { backgroundColor: 'rgba(245, 158, 11, 0.15)' }]}>
                <Ionicons name="time" size={24} color="#F59E0B" />
              </View>
              <View style={styles.menuInfo}>
                <Text style={styles.menuTitle}>{txt.appLimits}</Text>
                <Text style={styles.menuDesc}>{txt.appLimitsDesc}</Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color="#64748B" />
            </TouchableOpacity>

            {/* Focus Lock */}
            <TouchableOpacity
              style={styles.menuItem}
              onPress={() => router.push({
                pathname: '/digital-safety/focus-lock',
                params: { childId: selectedChildId }
              })}
            >
              <View style={[styles.menuIcon, { backgroundColor: 'rgba(139, 92, 246, 0.15)' }]}>
                <Ionicons name="eye" size={24} color="#8B5CF6" />
              </View>
              <View style={styles.menuInfo}>
                <Text style={styles.menuTitle}>{txt.focusLock}</Text>
                <Text style={styles.menuDesc}>{txt.focusLockDesc}</Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color="#64748B" />
            </TouchableOpacity>

            {/* Blocked Apps */}
            <TouchableOpacity
              style={styles.menuItem}
              onPress={() => router.push({
                pathname: '/digital-safety/app-limits',
                params: { childId: selectedChildId }
              })}
            >
              <View style={[styles.menuIcon, { backgroundColor: 'rgba(239, 68, 68, 0.15)' }]}>
                <Ionicons name="ban" size={24} color="#EF4444" />
              </View>
              <View style={styles.menuInfo}>
                <Text style={styles.menuTitle}>{txt.blockedApps}</Text>
                <Text style={styles.menuDesc}>{txt.blockedAppsDesc}</Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color="#64748B" />
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0F172A' },
  centered: { justifyContent: 'center', alignItems: 'center' },
  content: { flex: 1 },
  header: { alignItems: 'center', paddingVertical: 24, paddingHorizontal: 20 },
  headerIcon: {
    width: 64,
    height: 64,
    borderRadius: 18,
    backgroundColor: 'rgba(99, 102, 241, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  headerTitle: { fontSize: 24, fontWeight: '800', color: '#FFFFFF' },
  headerSubtitle: { fontSize: 15, color: '#94A3B8', marginTop: 8, textAlign: 'center' },
  noticeCard: {
    flexDirection: 'row',
    backgroundColor: 'rgba(59, 130, 246, 0.15)',
    marginHorizontal: 16,
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(59, 130, 246, 0.3)',
    gap: 12,
  },
  noticeContent: { flex: 1 },
  noticeTitle: { fontSize: 14, fontWeight: '600', color: '#3B82F6', marginBottom: 4 },
  noticeText: { fontSize: 12, color: '#94A3B8', marginTop: 2 },
  childSelector: { marginTop: 20, paddingHorizontal: 16 },
  selectorLabel: { fontSize: 14, fontWeight: '600', color: '#94A3B8', marginBottom: 12 },
  childTabs: { flexDirection: 'row', gap: 10 },
  childTab: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1E293B',
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 12,
    gap: 8,
  },
  childTabActive: { backgroundColor: '#6366F1' },
  childAvatar: {
    width: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor: '#334155',
    justifyContent: 'center',
    alignItems: 'center',
  },
  childAvatarActive: { backgroundColor: 'rgba(255,255,255,0.2)' },
  childName: { fontSize: 14, fontWeight: '600', color: '#94A3B8' },
  childNameActive: { color: '#FFFFFF' },
  noChildrenCard: {
    alignItems: 'center',
    backgroundColor: '#1E293B',
    margin: 16,
    padding: 32,
    borderRadius: 16,
  },
  noChildrenText: { fontSize: 14, color: '#64748B', marginTop: 12, textAlign: 'center' },
  addChildBtn: {
    backgroundColor: '#6366F1',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 10,
    marginTop: 16,
  },
  addChildText: { fontSize: 14, fontWeight: '600', color: '#FFFFFF' },
  summaryCard: { margin: 16 },
  summaryGradient: {
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: 'rgba(99, 102, 241, 0.2)',
  },
  summaryHeader: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  summaryLabel: { fontSize: 14, color: '#94A3B8' },
  summaryValue: { fontSize: 36, fontWeight: '800', color: '#FFFFFF', marginVertical: 8 },
  summaryMeta: { flexDirection: 'row', gap: 20 },
  summaryMetaItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  summaryMetaText: { fontSize: 13, color: '#64748B' },
  menuSection: { padding: 16 },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1E293B',
    borderRadius: 14,
    padding: 16,
    marginBottom: 10,
  },
  menuIcon: {
    width: 48,
    height: 48,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 14,
  },
  menuInfo: { flex: 1 },
  menuTitle: { fontSize: 16, fontWeight: '600', color: '#FFFFFF' },
  menuDesc: { fontSize: 13, color: '#64748B', marginTop: 4 },
});
