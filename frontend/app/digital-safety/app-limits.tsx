/**
 * Digital Safety - App Limits Screen
 * Parent controls for app time limits and schedules
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
  TextInput,
  Modal,
  Switch,
} from 'react-native';
import { useRouter, Stack, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLanguage } from '../../lib/i18n';
import {
  getChildAppControls,
  setAppLimit,
  removeAppLimit,
  blockApp,
  unblockApp,
  setSchedule,
  saveChildAppControls,
} from '../../services/appControlService';
import { getAppUsageData } from '../../services/appUsageService';
import {
  ChildAppControls,
  AppLimit,
  RestrictionSchedule,
  AppUsageData,
  APP_CATEGORIES,
  AppCategory,
} from '../../types/digitalSafety';

export default function AppLimitsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { childId } = useLocalSearchParams<{ childId: string }>();
  const { language } = useLanguage();
  const lang = language as 'en' | 'ro';

  const [isLoading, setIsLoading] = useState(true);
  const [controls, setControls] = useState<ChildAppControls | null>(null);
  const [apps, setApps] = useState<AppUsageData[]>([]);
  const [activeSection, setActiveSection] = useState<'limits' | 'schedules' | 'blocked'>('limits');
  const [showLimitModal, setShowLimitModal] = useState(false);
  const [editingLimit, setEditingLimit] = useState<AppLimit | null>(null);
  const [limitMinutes, setLimitMinutes] = useState('60');
  const [selectedApp, setSelectedApp] = useState<AppUsageData | null>(null);

  const txt = {
    title: lang === 'ro' ? 'Control Aplicații' : 'App Controls',
    limits: lang === 'ro' ? 'Limite' : 'Limits',
    schedules: lang === 'ro' ? 'Program' : 'Schedules',
    blocked: lang === 'ro' ? 'Blocate' : 'Blocked',
    dailyLimit: lang === 'ro' ? 'Limită zilnică' : 'Daily limit',
    minutes: lang === 'ro' ? 'minute' : 'minutes',
    hours: lang === 'ro' ? 'ore' : 'hours',
    addLimit: lang === 'ro' ? 'Adaugă Limită' : 'Add Limit',
    editLimit: lang === 'ro' ? 'Editează Limită' : 'Edit Limit',
    removeLimit: lang === 'ro' ? 'Șterge Limită' : 'Remove Limit',
    block: lang === 'ro' ? 'Blochează' : 'Block',
    unblock: lang === 'ro' ? 'Deblochează' : 'Unblock',
    active: lang === 'ro' ? 'Activ' : 'Active',
    inactive: lang === 'ro' ? 'Inactiv' : 'Inactive',
    noLimits: lang === 'ro' ? 'Nicio limită setată' : 'No limits set',
    noBlocked: lang === 'ro' ? 'Nicio aplicație blocată' : 'No blocked apps',
    save: lang === 'ro' ? 'Salvează' : 'Save',
    cancel: lang === 'ro' ? 'Anulează' : 'Cancel',
    selectApp: lang === 'ro' ? 'Selectează aplicația' : 'Select app',
    schoolHours: lang === 'ro' ? 'Ore de Școală' : 'School Hours',
    homework: lang === 'ro' ? 'Teme' : 'Homework',
    sleepTime: lang === 'ro' ? 'Somn' : 'Sleep Time',
    softBlock: lang === 'ro' ? 'Restricție Soft' : 'Soft Restriction',
    softBlockDesc: lang === 'ro' 
      ? 'Fără development build, blocarea reală nu este posibilă. Se va afișa o alertă.' 
      : 'Without development build, real blocking is not possible. An alert will be shown.',
  };

  const loadData = async () => {
    if (!childId) return;
    
    try {
      const [controlsData, usageData] = await Promise.all([
        getChildAppControls(childId),
        getAppUsageData(),
      ]);
      setControls(controlsData);
      setApps(usageData.data);
    } catch (error) {
      console.error('Error loading app controls:', error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [childId]);

  const handleAddLimit = async () => {
    if (!childId || !selectedApp) return;

    const minutes = parseInt(limitMinutes) || 60;
    await setAppLimit(childId, {
      targetType: 'app',
      targetId: selectedApp.app.packageName,
      targetName: selectedApp.app.appName,
      dailyLimitMinutes: minutes,
      isActive: true,
    });

    setShowLimitModal(false);
    setSelectedApp(null);
    setLimitMinutes('60');
    loadData();
  };

  const handleRemoveLimit = async (limitId: string) => {
    if (!childId) return;
    
    Alert.alert(
      txt.removeLimit,
      lang === 'ro' ? 'Sigur vrei să ștergi această limită?' : 'Are you sure you want to remove this limit?',
      [
        { text: txt.cancel, style: 'cancel' },
        { 
          text: txt.removeLimit, 
          style: 'destructive',
          onPress: async () => {
            await removeAppLimit(childId, limitId);
            loadData();
          }
        },
      ]
    );
  };

  const handleToggleBlock = async (packageName: string, isBlocked: boolean) => {
    if (!childId) return;

    if (isBlocked) {
      await unblockApp(childId, packageName);
    } else {
      await blockApp(childId, packageName);
    }
    loadData();
  };

  const handleToggleSchedule = async (schedule: RestrictionSchedule) => {
    if (!childId || !controls) return;

    const updatedSchedule = { ...schedule, isActive: !schedule.isActive };
    await setSchedule(childId, updatedSchedule);
    loadData();
  };

  const formatScheduleTime = (start: string, end: string) => {
    return `${start} - ${end}`;
  };

  const getDaysLabel = (days: number[]) => {
    if (days.length === 7) return lang === 'ro' ? 'Zilnic' : 'Daily';
    if (days.length === 5 && !days.includes(0) && !days.includes(6)) {
      return lang === 'ro' ? 'Luni-Vineri' : 'Mon-Fri';
    }
    if (days.length === 2 && days.includes(0) && days.includes(6)) {
      return lang === 'ro' ? 'Weekend' : 'Weekend';
    }
    return days.map(d => ['D', 'L', 'M', 'M', 'J', 'V', 'S'][d]).join(', ');
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

      {/* Soft Block Notice */}
      <View style={styles.noticeCard}>
        <Ionicons name="information-circle" size={20} color="#F59E0B" />
        <View style={styles.noticeContent}>
          <Text style={styles.noticeTitle}>{txt.softBlock}</Text>
          <Text style={styles.noticeText}>{txt.softBlockDesc}</Text>
        </View>
      </View>

      {/* Section Tabs */}
      <View style={styles.tabContainer}>
        <TouchableOpacity
          style={[styles.tab, activeSection === 'limits' && styles.tabActive]}
          onPress={() => setActiveSection('limits')}
        >
          <Ionicons name="time" size={18} color={activeSection === 'limits' ? '#FFFFFF' : '#64748B'} />
          <Text style={[styles.tabText, activeSection === 'limits' && styles.tabTextActive]}>
            {txt.limits}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeSection === 'schedules' && styles.tabActive]}
          onPress={() => setActiveSection('schedules')}
        >
          <Ionicons name="calendar" size={18} color={activeSection === 'schedules' ? '#FFFFFF' : '#64748B'} />
          <Text style={[styles.tabText, activeSection === 'schedules' && styles.tabTextActive]}>
            {txt.schedules}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeSection === 'blocked' && styles.tabActive]}
          onPress={() => setActiveSection('blocked')}
        >
          <Ionicons name="ban" size={18} color={activeSection === 'blocked' ? '#FFFFFF' : '#64748B'} />
          <Text style={[styles.tabText, activeSection === 'blocked' && styles.tabTextActive]}>
            {txt.blocked}
          </Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.content}
        contentContainerStyle={{ paddingBottom: insets.bottom + 100 }}
      >
        {/* Limits Section */}
        {activeSection === 'limits' && (
          <View style={styles.section}>
            {controls?.limits.length === 0 ? (
              <View style={styles.emptyState}>
                <Ionicons name="time-outline" size={48} color="#334155" />
                <Text style={styles.emptyText}>{txt.noLimits}</Text>
              </View>
            ) : (
              controls?.limits.map((limit) => (
                <View key={limit.id} style={styles.limitCard}>
                  <View style={styles.limitInfo}>
                    <View style={styles.limitIcon}>
                      <Ionicons name="apps" size={22} color="#6366F1" />
                    </View>
                    <View style={styles.limitDetails}>
                      <Text style={styles.limitName}>{limit.targetName}</Text>
                      <Text style={styles.limitTime}>
                        {limit.dailyLimitMinutes >= 60 
                          ? `${Math.floor(limit.dailyLimitMinutes / 60)}h ${limit.dailyLimitMinutes % 60}m` 
                          : `${limit.dailyLimitMinutes}m`
                        } / {lang === 'ro' ? 'zi' : 'day'}
                      </Text>
                    </View>
                  </View>
                  <View style={styles.limitActions}>
                    <Switch
                      value={limit.isActive}
                      onValueChange={() => {
                        if (childId) {
                          setAppLimit(childId, { ...limit, isActive: !limit.isActive });
                          loadData();
                        }
                      }}
                      trackColor={{ false: '#334155', true: 'rgba(99, 102, 241, 0.5)' }}
                      thumbColor={limit.isActive ? '#6366F1' : '#64748B'}
                    />
                    <TouchableOpacity
                      style={styles.deleteBtn}
                      onPress={() => handleRemoveLimit(limit.id)}
                    >
                      <Ionicons name="trash-outline" size={20} color="#EF4444" />
                    </TouchableOpacity>
                  </View>
                </View>
              ))
            )}

            <TouchableOpacity
              style={styles.addButton}
              onPress={() => setShowLimitModal(true)}
            >
              <Ionicons name="add" size={22} color="#FFFFFF" />
              <Text style={styles.addButtonText}>{txt.addLimit}</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Schedules Section */}
        {activeSection === 'schedules' && (
          <View style={styles.section}>
            {controls?.schedules.map((schedule) => (
              <View key={schedule.id} style={styles.scheduleCard}>
                <View style={styles.scheduleHeader}>
                  <View style={[
                    styles.scheduleIcon,
                    { backgroundColor: schedule.type === 'sleep' 
                      ? 'rgba(139, 92, 246, 0.2)' 
                      : schedule.type === 'school' 
                        ? 'rgba(99, 102, 241, 0.2)' 
                        : 'rgba(245, 158, 11, 0.2)' 
                    }
                  ]}>
                    <Ionicons 
                      name={schedule.type === 'sleep' ? 'moon' : schedule.type === 'school' ? 'school' : 'book'} 
                      size={22} 
                      color={schedule.type === 'sleep' 
                        ? '#8B5CF6' 
                        : schedule.type === 'school' 
                          ? '#6366F1' 
                          : '#F59E0B'
                      } 
                    />
                  </View>
                  <View style={styles.scheduleInfo}>
                    <Text style={styles.scheduleName}>{schedule.name}</Text>
                    <Text style={styles.scheduleTime}>
                      {formatScheduleTime(schedule.startTime, schedule.endTime)}
                    </Text>
                    <Text style={styles.scheduleDays}>{getDaysLabel(schedule.daysOfWeek)}</Text>
                  </View>
                  <Switch
                    value={schedule.isActive}
                    onValueChange={() => handleToggleSchedule(schedule)}
                    trackColor={{ false: '#334155', true: 'rgba(99, 102, 241, 0.5)' }}
                    thumbColor={schedule.isActive ? '#6366F1' : '#64748B'}
                  />
                </View>
                {schedule.restrictedCategories.length > 0 && (
                  <View style={styles.restrictedCategories}>
                    <Text style={styles.restrictedLabel}>
                      {lang === 'ro' ? 'Categorii restricționate:' : 'Restricted categories:'}
                    </Text>
                    <View style={styles.categoryTags}>
                      {schedule.restrictedCategories.map((cat) => (
                        <View key={cat} style={styles.categoryTag}>
                          <Text style={styles.categoryTagText}>
                            {lang === 'ro' 
                              ? APP_CATEGORIES[cat]?.labelRo 
                              : APP_CATEGORIES[cat]?.label
                            }
                          </Text>
                        </View>
                      ))}
                    </View>
                  </View>
                )}
              </View>
            ))}
          </View>
        )}

        {/* Blocked Apps Section */}
        {activeSection === 'blocked' && (
          <View style={styles.section}>
            {controls?.blockedApps.length === 0 ? (
              <View style={styles.emptyState}>
                <Ionicons name="ban-outline" size={48} color="#334155" />
                <Text style={styles.emptyText}>{txt.noBlocked}</Text>
              </View>
            ) : (
              controls?.blockedApps.map((packageName) => {
                const app = apps.find(a => a.app.packageName === packageName);
                return (
                  <View key={packageName} style={styles.blockedCard}>
                    <View style={styles.blockedIcon}>
                      <Ionicons name="ban" size={22} color="#EF4444" />
                    </View>
                    <Text style={styles.blockedName}>
                      {app?.app.appName || packageName}
                    </Text>
                    <TouchableOpacity
                      style={styles.unblockBtn}
                      onPress={() => handleToggleBlock(packageName, true)}
                    >
                      <Text style={styles.unblockText}>{txt.unblock}</Text>
                    </TouchableOpacity>
                  </View>
                );
              })
            )}

            <Text style={styles.sectionSubtitle}>
              {lang === 'ro' ? 'Aplicații disponibile pentru blocare:' : 'Apps available to block:'}
            </Text>
            {apps
              .filter(a => !controls?.blockedApps.includes(a.app.packageName))
              .slice(0, 10)
              .map((app) => (
                <View key={app.app.packageName} style={styles.appRow}>
                  <View style={styles.appIconSmall}>
                    <Ionicons
                      name={APP_CATEGORIES[app.app.category]?.icon as any || 'apps'}
                      size={18}
                      color="#94A3B8"
                    />
                  </View>
                  <Text style={styles.appRowName}>{app.app.appName}</Text>
                  <TouchableOpacity
                    style={styles.blockBtn}
                    onPress={() => handleToggleBlock(app.app.packageName, false)}
                  >
                    <Text style={styles.blockText}>{txt.block}</Text>
                  </TouchableOpacity>
                </View>
              ))}
          </View>
        )}
      </ScrollView>

      {/* Add Limit Modal */}
      <Modal
        visible={showLimitModal}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowLimitModal(false)}
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={() => setShowLimitModal(false)}>
              <Text style={styles.modalCancel}>{txt.cancel}</Text>
            </TouchableOpacity>
            <Text style={styles.modalTitle}>{txt.addLimit}</Text>
            <TouchableOpacity onPress={handleAddLimit}>
              <Text style={styles.modalSave}>{txt.save}</Text>
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.modalContent}>
            <Text style={styles.modalLabel}>{txt.selectApp}</Text>
            {apps.map((app) => (
              <TouchableOpacity
                key={app.app.packageName}
                style={[
                  styles.appSelectRow,
                  selectedApp?.app.packageName === app.app.packageName && styles.appSelectRowActive
                ]}
                onPress={() => setSelectedApp(app)}
              >
                <View style={styles.appIconSmall}>
                  <Ionicons
                    name={APP_CATEGORIES[app.app.category]?.icon as any || 'apps'}
                    size={18}
                    color={selectedApp?.app.packageName === app.app.packageName ? '#6366F1' : '#94A3B8'}
                  />
                </View>
                <Text style={[
                  styles.appSelectName,
                  selectedApp?.app.packageName === app.app.packageName && styles.appSelectNameActive
                ]}>
                  {app.app.appName}
                </Text>
                {selectedApp?.app.packageName === app.app.packageName && (
                  <Ionicons name="checkmark-circle" size={22} color="#6366F1" />
                )}
              </TouchableOpacity>
            ))}

            <Text style={[styles.modalLabel, { marginTop: 24 }]}>{txt.dailyLimit}</Text>
            <View style={styles.limitInputRow}>
              <TextInput
                style={styles.limitInput}
                value={limitMinutes}
                onChangeText={setLimitMinutes}
                keyboardType="numeric"
                placeholder="60"
                placeholderTextColor="#64748B"
              />
              <Text style={styles.limitInputLabel}>{txt.minutes}</Text>
            </View>

            <View style={styles.presetRow}>
              {[30, 60, 120, 180].map((mins) => (
                <TouchableOpacity
                  key={mins}
                  style={[
                    styles.presetBtn,
                    limitMinutes === String(mins) && styles.presetBtnActive
                  ]}
                  onPress={() => setLimitMinutes(String(mins))}
                >
                  <Text style={[
                    styles.presetText,
                    limitMinutes === String(mins) && styles.presetTextActive
                  ]}>
                    {mins >= 60 ? `${mins / 60}h` : `${mins}m`}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </ScrollView>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0F172A' },
  centered: { justifyContent: 'center', alignItems: 'center' },
  content: { flex: 1 },
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
  noticeContent: { flex: 1 },
  noticeTitle: { fontSize: 14, fontWeight: '600', color: '#F59E0B', marginBottom: 4 },
  noticeText: { fontSize: 13, color: '#94A3B8' },
  tabContainer: {
    flexDirection: 'row',
    marginHorizontal: 16,
    backgroundColor: '#1E293B',
    borderRadius: 12,
    padding: 4,
  },
  tab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    borderRadius: 10,
    gap: 6,
  },
  tabActive: { backgroundColor: '#6366F1' },
  tabText: { fontSize: 13, fontWeight: '600', color: '#64748B' },
  tabTextActive: { color: '#FFFFFF' },
  section: { padding: 16 },
  sectionSubtitle: { fontSize: 14, color: '#94A3B8', marginTop: 24, marginBottom: 12 },
  emptyState: { alignItems: 'center', paddingVertical: 40 },
  emptyText: { fontSize: 14, color: '#64748B', marginTop: 12 },
  limitCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#1E293B',
    borderRadius: 14,
    padding: 14,
    marginBottom: 10,
  },
  limitInfo: { flexDirection: 'row', alignItems: 'center', flex: 1 },
  limitIcon: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: 'rgba(99, 102, 241, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  limitDetails: { flex: 1 },
  limitName: { fontSize: 15, fontWeight: '600', color: '#FFFFFF' },
  limitTime: { fontSize: 13, color: '#94A3B8', marginTop: 2 },
  limitActions: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  deleteBtn: { padding: 8 },
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#6366F1',
    borderRadius: 14,
    paddingVertical: 14,
    marginTop: 16,
    gap: 8,
  },
  addButtonText: { fontSize: 15, fontWeight: '600', color: '#FFFFFF' },
  scheduleCard: {
    backgroundColor: '#1E293B',
    borderRadius: 14,
    padding: 14,
    marginBottom: 10,
  },
  scheduleHeader: { flexDirection: 'row', alignItems: 'center' },
  scheduleIcon: {
    width: 44,
    height: 44,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  scheduleInfo: { flex: 1 },
  scheduleName: { fontSize: 15, fontWeight: '600', color: '#FFFFFF' },
  scheduleTime: { fontSize: 13, color: '#6366F1', marginTop: 2 },
  scheduleDays: { fontSize: 12, color: '#64748B', marginTop: 2 },
  restrictedCategories: { marginTop: 12, paddingTop: 12, borderTopWidth: 1, borderTopColor: '#334155' },
  restrictedLabel: { fontSize: 12, color: '#64748B', marginBottom: 8 },
  categoryTags: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  categoryTag: {
    backgroundColor: 'rgba(239, 68, 68, 0.2)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  categoryTagText: { fontSize: 11, color: '#EF4444', fontWeight: '500' },
  blockedCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1E293B',
    borderRadius: 14,
    padding: 14,
    marginBottom: 10,
  },
  blockedIcon: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: 'rgba(239, 68, 68, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  blockedName: { flex: 1, fontSize: 15, fontWeight: '600', color: '#FFFFFF' },
  unblockBtn: {
    backgroundColor: 'rgba(16, 185, 129, 0.2)',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
  },
  unblockText: { fontSize: 13, fontWeight: '600', color: '#10B981' },
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
  appRowName: { flex: 1, fontSize: 14, color: '#FFFFFF' },
  blockBtn: {
    backgroundColor: 'rgba(239, 68, 68, 0.2)',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
  },
  blockText: { fontSize: 13, fontWeight: '600', color: '#EF4444' },
  // Modal
  modalContainer: { flex: 1, backgroundColor: '#0F172A' },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#1E293B',
  },
  modalCancel: { fontSize: 16, color: '#64748B' },
  modalTitle: { fontSize: 17, fontWeight: '600', color: '#FFFFFF' },
  modalSave: { fontSize: 16, fontWeight: '600', color: '#6366F1' },
  modalContent: { padding: 16 },
  modalLabel: { fontSize: 14, fontWeight: '600', color: '#94A3B8', marginBottom: 12 },
  appSelectRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#1E293B',
  },
  appSelectRowActive: { backgroundColor: 'rgba(99, 102, 241, 0.1)' },
  appSelectName: { flex: 1, fontSize: 15, color: '#FFFFFF' },
  appSelectNameActive: { color: '#6366F1' },
  limitInputRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  limitInput: {
    backgroundColor: '#1E293B',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 24,
    fontWeight: '700',
    color: '#FFFFFF',
    width: 100,
    textAlign: 'center',
  },
  limitInputLabel: { fontSize: 16, color: '#94A3B8' },
  presetRow: { flexDirection: 'row', marginTop: 16, gap: 10 },
  presetBtn: {
    flex: 1,
    backgroundColor: '#1E293B',
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
  },
  presetBtnActive: { backgroundColor: 'rgba(99, 102, 241, 0.2)', borderWidth: 1, borderColor: '#6366F1' },
  presetText: { fontSize: 14, fontWeight: '600', color: '#64748B' },
  presetTextActive: { color: '#6366F1' },
});
