/**
 * Digital Safety - Focus Lock Screen
 * Study Mode / Sleep Mode / Focus Mode for children
 */

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { useRouter, Stack, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { useLanguage } from '../../lib/i18n';
import {
  getChildAppControls,
  startFocusLock,
  stopFocusLock,
  getFocusLockStatus,
  getFocusLockPresets,
} from '../../services/appControlService';
import { FocusLockSession, ALWAYS_ALLOWED_APPS } from '../../types/digitalSafety';

export default function FocusLockScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { childId } = useLocalSearchParams<{ childId: string }>();
  const { language } = useLanguage();
  const lang = language as 'en' | 'ro';

  const [isLoading, setIsLoading] = useState(true);
  const [activeLock, setActiveLock] = useState<FocusLockSession | null>(null);
  const [selectedPreset, setSelectedPreset] = useState<string | null>(null);

  const presets = getFocusLockPresets();

  const txt = {
    title: lang === 'ro' ? 'Mod Focus' : 'Focus Lock',
    active: lang === 'ro' ? 'Activ' : 'Active',
    inactive: lang === 'ro' ? 'Inactiv' : 'Inactive',
    study: lang === 'ro' ? 'Mod Studiu' : 'Study Mode',
    studyDesc: lang === 'ro' 
      ? 'Blochează rețelele sociale și jocurile în timpul studiului' 
      : 'Block social media and games during study time',
    sleep: lang === 'ro' ? 'Mod Somn' : 'Sleep Mode',
    sleepDesc: lang === 'ro' 
      ? 'Restricționează majoritatea aplicațiilor la ora de culcare' 
      : 'Restrict most apps at bedtime',
    focus: lang === 'ro' ? 'Mod Concentrare' : 'Focus Mode',
    focusDesc: lang === 'ro' 
      ? 'Permite doar aplicațiile esențiale' 
      : 'Allow only essential apps',
    start: lang === 'ro' ? 'Activează' : 'Activate',
    stop: lang === 'ro' ? 'Dezactivează' : 'Deactivate',
    alwaysAllowed: lang === 'ro' ? 'Întotdeauna Permise' : 'Always Allowed',
    alwaysAllowedDesc: lang === 'ro' 
      ? 'Aceste aplicații rămân accesibile în orice mod:' 
      : 'These apps remain accessible in any mode:',
    phone: lang === 'ro' ? 'Telefon' : 'Phone',
    guardianAi: 'Guardian AI',
    messages: lang === 'ro' ? 'Mesaje' : 'Messages',
    contacts: lang === 'ro' ? 'Contacte' : 'Contacts',
    sos: lang === 'ro' ? 'Buton SOS' : 'SOS Button',
    softRestriction: lang === 'ro' ? 'Restricție Soft' : 'Soft Restriction',
    softRestrictionDesc: lang === 'ro' 
      ? 'În Expo Go, blocarea reală nu este posibilă. Se va trimite o alertă părintelui când copilul încearcă să deschidă o aplicație restricționată.'
      : 'In Expo Go, real blocking is not possible. A parent alert will be sent when the child tries to open a restricted app.',
    runningFor: lang === 'ro' ? 'Activ de' : 'Running for',
    startedAt: lang === 'ro' ? 'Început la' : 'Started at',
  };

  const loadStatus = async () => {
    if (!childId) return;
    
    try {
      const status = await getFocusLockStatus(childId);
      setActiveLock(status);
    } catch (error) {
      console.error('Error loading focus lock status:', error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadStatus();
  }, [childId]);

  const handleStartFocusLock = async (presetType: string) => {
    if (!childId) return;

    const preset = presets.find(p => p.type === presetType);
    if (!preset) return;

    Alert.alert(
      txt.start,
      lang === 'ro' 
        ? `Activezi ${preset.name}? Aplicațiile restricționate vor fi blocate.`
        : `Activate ${preset.name}? Restricted apps will be blocked.`,
      [
        { text: lang === 'ro' ? 'Anulează' : 'Cancel', style: 'cancel' },
        {
          text: txt.start,
          onPress: async () => {
            setIsLoading(true);
            await startFocusLock(childId, preset);
            await loadStatus();
          },
        },
      ]
    );
  };

  const handleStopFocusLock = async () => {
    if (!childId) return;

    Alert.alert(
      txt.stop,
      lang === 'ro' 
        ? 'Sigur vrei să dezactivezi Focus Lock?'
        : 'Are you sure you want to deactivate Focus Lock?',
      [
        { text: lang === 'ro' ? 'Anulează' : 'Cancel', style: 'cancel' },
        {
          text: txt.stop,
          style: 'destructive',
          onPress: async () => {
            setIsLoading(true);
            await stopFocusLock(childId);
            await loadStatus();
          },
        },
      ]
    );
  };

  const getPresetIcon = (type: string) => {
    switch (type) {
      case 'study': return 'book';
      case 'sleep': return 'moon';
      case 'focus': return 'eye';
      default: return 'lock-closed';
    }
  };

  const getPresetColor = (type: string) => {
    switch (type) {
      case 'study': return '#6366F1';
      case 'sleep': return '#8B5CF6';
      case 'focus': return '#10B981';
      default: return '#F59E0B';
    }
  };

  const getPresetDescription = (type: string) => {
    switch (type) {
      case 'study': return txt.studyDesc;
      case 'sleep': return txt.sleepDesc;
      case 'focus': return txt.focusDesc;
      default: return '';
    }
  };

  const formatDuration = (startedAt: string) => {
    const start = new Date(startedAt);
    const now = new Date();
    const diffMs = now.getTime() - start.getTime();
    const hours = Math.floor(diffMs / (60 * 60 * 1000));
    const minutes = Math.floor((diffMs % (60 * 60 * 1000)) / (60 * 1000));
    
    if (hours === 0) return `${minutes}m`;
    return `${hours}h ${minutes}m`;
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
      >
        {/* Active Lock Banner */}
        {activeLock && (
          <View style={styles.activeBanner}>
            <LinearGradient
              colors={[`${getPresetColor(activeLock.type)}30`, `${getPresetColor(activeLock.type)}10`]}
              style={styles.activeBannerGradient}
            >
              <View style={styles.activeBannerHeader}>
                <View style={[styles.activeIcon, { backgroundColor: `${getPresetColor(activeLock.type)}40` }]}>
                  <Ionicons 
                    name={getPresetIcon(activeLock.type) as any} 
                    size={28} 
                    color={getPresetColor(activeLock.type)} 
                  />
                </View>
                <View style={styles.activeInfo}>
                  <Text style={styles.activeTitle}>{activeLock.name}</Text>
                  <Text style={styles.activeStatus}>
                    {txt.runningFor}: {formatDuration(activeLock.startedAt)}
                  </Text>
                </View>
                <View style={styles.activeBadge}>
                  <View style={styles.activeDot} />
                  <Text style={styles.activeText}>{txt.active}</Text>
                </View>
              </View>

              <TouchableOpacity
                style={styles.stopButton}
                onPress={handleStopFocusLock}
              >
                <Ionicons name="stop-circle" size={20} color="#EF4444" />
                <Text style={styles.stopButtonText}>{txt.stop}</Text>
              </TouchableOpacity>
            </LinearGradient>
          </View>
        )}

        {/* Soft Restriction Notice */}
        <View style={styles.noticeCard}>
          <Ionicons name="information-circle" size={20} color="#F59E0B" />
          <View style={styles.noticeContent}>
            <Text style={styles.noticeTitle}>{txt.softRestriction}</Text>
            <Text style={styles.noticeText}>{txt.softRestrictionDesc}</Text>
          </View>
        </View>

        {/* Presets */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>
            {lang === 'ro' ? 'Moduri Disponibile' : 'Available Modes'}
          </Text>

          {presets.map((preset) => (
            <TouchableOpacity
              key={preset.type}
              style={[
                styles.presetCard,
                activeLock?.type === preset.type && styles.presetCardActive
              ]}
              onPress={() => !activeLock && handleStartFocusLock(preset.type)}
              disabled={!!activeLock}
            >
              <View style={[
                styles.presetIcon,
                { backgroundColor: `${getPresetColor(preset.type)}20` }
              ]}>
                <Ionicons 
                  name={getPresetIcon(preset.type) as any} 
                  size={26} 
                  color={getPresetColor(preset.type)} 
                />
              </View>
              <View style={styles.presetInfo}>
                <Text style={styles.presetName}>{preset.name}</Text>
                <Text style={styles.presetDesc}>{getPresetDescription(preset.type)}</Text>
              </View>
              {!activeLock && (
                <View style={[styles.startBtn, { backgroundColor: `${getPresetColor(preset.type)}20` }]}>
                  <Ionicons name="play" size={18} color={getPresetColor(preset.type)} />
                </View>
              )}
              {activeLock?.type === preset.type && (
                <View style={styles.runningBadge}>
                  <View style={[styles.runningDot, { backgroundColor: getPresetColor(preset.type) }]} />
                </View>
              )}
            </TouchableOpacity>
          ))}
        </View>

        {/* Always Allowed */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{txt.alwaysAllowed}</Text>
          <Text style={styles.sectionSubtitle}>{txt.alwaysAllowedDesc}</Text>

          <View style={styles.allowedGrid}>
            <View style={styles.allowedItem}>
              <View style={[styles.allowedIcon, { backgroundColor: 'rgba(16, 185, 129, 0.2)' }]}>
                <Ionicons name="call" size={22} color="#10B981" />
              </View>
              <Text style={styles.allowedText}>{txt.phone}</Text>
            </View>

            <View style={styles.allowedItem}>
              <View style={[styles.allowedIcon, { backgroundColor: 'rgba(99, 102, 241, 0.2)' }]}>
                <Ionicons name="shield-checkmark" size={22} color="#6366F1" />
              </View>
              <Text style={styles.allowedText}>{txt.guardianAi}</Text>
            </View>

            <View style={styles.allowedItem}>
              <View style={[styles.allowedIcon, { backgroundColor: 'rgba(59, 130, 246, 0.2)' }]}>
                <Ionicons name="chatbubble" size={22} color="#3B82F6" />
              </View>
              <Text style={styles.allowedText}>{txt.messages}</Text>
            </View>

            <View style={styles.allowedItem}>
              <View style={[styles.allowedIcon, { backgroundColor: 'rgba(239, 68, 68, 0.2)' }]}>
                <Ionicons name="warning" size={22} color="#EF4444" />
              </View>
              <Text style={styles.allowedText}>{txt.sos}</Text>
            </View>
          </View>
        </View>

        {/* Child View Notice */}
        <View style={styles.childNotice}>
          <Ionicons name="eye" size={20} color="#64748B" />
          <Text style={styles.childNoticeText}>
            {lang === 'ro' 
              ? 'Când Focus Lock este activ, copilul vede un mesaj clar pe aplicațiile restricționate.'
              : 'When Focus Lock is active, the child sees a clear message on restricted apps.'
            }
          </Text>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0F172A' },
  centered: { justifyContent: 'center', alignItems: 'center' },
  content: { flex: 1 },
  activeBanner: { margin: 16 },
  activeBannerGradient: {
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(99, 102, 241, 0.3)',
  },
  activeBannerHeader: { flexDirection: 'row', alignItems: 'center' },
  activeIcon: {
    width: 56,
    height: 56,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 14,
  },
  activeInfo: { flex: 1 },
  activeTitle: { fontSize: 18, fontWeight: '700', color: '#FFFFFF' },
  activeStatus: { fontSize: 14, color: '#94A3B8', marginTop: 4 },
  activeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(16, 185, 129, 0.2)',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    gap: 6,
  },
  activeDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#10B981' },
  activeText: { fontSize: 12, fontWeight: '600', color: '#10B981' },
  stopButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(239, 68, 68, 0.15)',
    borderRadius: 12,
    paddingVertical: 12,
    marginTop: 14,
    gap: 8,
  },
  stopButtonText: { fontSize: 15, fontWeight: '600', color: '#EF4444' },
  noticeCard: {
    flexDirection: 'row',
    backgroundColor: 'rgba(245, 158, 11, 0.15)',
    margin: 16,
    marginTop: 0,
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(245, 158, 11, 0.3)',
    gap: 12,
  },
  noticeContent: { flex: 1 },
  noticeTitle: { fontSize: 14, fontWeight: '600', color: '#F59E0B', marginBottom: 4 },
  noticeText: { fontSize: 13, color: '#94A3B8' },
  section: { paddingHorizontal: 16, marginTop: 8 },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: '#FFFFFF', marginBottom: 4 },
  sectionSubtitle: { fontSize: 13, color: '#64748B', marginBottom: 16 },
  presetCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1E293B',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
  },
  presetCardActive: {
    borderWidth: 2,
    borderColor: '#6366F1',
    backgroundColor: 'rgba(99, 102, 241, 0.1)',
  },
  presetIcon: {
    width: 52,
    height: 52,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 14,
  },
  presetInfo: { flex: 1 },
  presetName: { fontSize: 16, fontWeight: '600', color: '#FFFFFF' },
  presetDesc: { fontSize: 13, color: '#94A3B8', marginTop: 4 },
  startBtn: {
    width: 40,
    height: 40,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  runningBadge: { padding: 10 },
  runningDot: { width: 12, height: 12, borderRadius: 6 },
  allowedGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginTop: 8,
  },
  allowedItem: {
    width: '47%',
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1E293B',
    borderRadius: 12,
    padding: 12,
    gap: 12,
  },
  allowedIcon: {
    width: 40,
    height: 40,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  allowedText: { fontSize: 14, fontWeight: '500', color: '#FFFFFF' },
  childNotice: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    margin: 16,
    marginTop: 24,
    padding: 14,
    backgroundColor: '#1E293B',
    borderRadius: 12,
    gap: 12,
  },
  childNoticeText: { flex: 1, fontSize: 13, color: '#94A3B8', lineHeight: 20 },
});
