import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Switch,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

// Mock data for screen time
const mockApps = [
  { id: '1', name: 'TikTok', icon: 'logo-tiktok', time: 45, limit: 30, color: '#000000' },
  { id: '2', name: 'YouTube', icon: 'logo-youtube', time: 38, limit: 60, color: '#FF0000' },
  { id: '3', name: 'Instagram', icon: 'logo-instagram', time: 22, limit: 30, color: '#E1306C' },
  { id: '4', name: 'Games', icon: 'game-controller', time: 15, limit: 45, color: '#6366F1' },
  { id: '5', name: 'Safari', icon: 'globe', time: 12, limit: null, color: '#007AFF' },
];

const mockBlockedApps = [
  { id: '1', name: 'Snapchat', icon: 'logo-snapchat', reason: 'Age restriction' },
  { id: '2', name: 'Twitter', icon: 'logo-twitter', reason: 'Parent blocked' },
];

export default function PhoneScreen() {
  const insets = useSafeAreaInsets();
  const [sleepModeEnabled, setSleepModeEnabled] = useState(true);
  const [selectedChild, setSelectedChild] = useState('Emma');
  
  const totalScreenTime = mockApps.reduce((sum, app) => sum + app.time, 0);
  const children = ['Emma', 'Jake'];
  
  // Tab bar height
  const tabBarHeight = 60 + insets.bottom;

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <Text style={styles.title}>Phone</Text>
        <Text style={styles.subtitle}>Digital Safety Controls</Text>
      </View>

      <ScrollView 
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: tabBarHeight + 16 }}
      >
        {/* Child Selector */}
        <View style={styles.childSelector}>
          {children.map((child) => (
            <TouchableOpacity
              key={child}
              style={[styles.childButton, selectedChild === child && styles.childButtonActive]}
              onPress={() => setSelectedChild(child)}
            >
              <View style={[styles.childAvatar, selectedChild === child && styles.childAvatarActive]}>
                <Text style={styles.childInitial}>{child[0]}</Text>
              </View>
              <Text style={[styles.childName, selectedChild === child && styles.childNameActive]}>
                {child}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Total Screen Time */}
        <View style={styles.totalCard}>
          <View style={styles.totalHeader}>
            <View>
              <Text style={styles.totalLabel}>Today's Screen Time</Text>
              <Text style={styles.totalTime}>{Math.floor(totalScreenTime / 60)}h {totalScreenTime % 60}m</Text>
            </View>
            <View style={styles.limitBadge}>
              <Ionicons name="time" size={16} color="#F59E0B" />
              <Text style={styles.limitText}>Limit exceeded</Text>
            </View>
          </View>
          
          {/* Progress Bar */}
          <View style={styles.progressContainer}>
            <View style={styles.progressBar}>
              <View style={[styles.progressFill, { width: '75%' }]} />
            </View>
            <Text style={styles.progressText}>2h daily limit</Text>
          </View>
        </View>

        {/* Sleep Mode */}
        <View style={styles.sleepCard}>
          <View style={styles.sleepHeader}>
            <View style={styles.sleepInfo}>
              <View style={styles.sleepIcon}>
                <Ionicons name="moon" size={24} color="#8B5CF6" />
              </View>
              <View>
                <Text style={styles.sleepTitle}>Sleep Mode</Text>
                <Text style={styles.sleepSubtitle}>9:00 PM - 7:00 AM</Text>
              </View>
            </View>
            <Switch
              value={sleepModeEnabled}
              onValueChange={setSleepModeEnabled}
              trackColor={{ false: '#334155', true: '#8B5CF6' }}
              thumbColor="#FFFFFF"
            />
          </View>
          <Text style={styles.sleepDescription}>
            Phone will be restricted during bedtime hours
          </Text>
        </View>

        {/* App Usage */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>App Usage</Text>
          {mockApps.map((app) => (
            <View key={app.id} style={styles.appCard}>
              <View style={[styles.appIcon, { backgroundColor: `${app.color}20` }]}>
                <Ionicons name={app.icon as any} size={22} color={app.color} />
              </View>
              <View style={styles.appInfo}>
                <Text style={styles.appName}>{app.name}</Text>
                <View style={styles.appTimeRow}>
                  <Text style={styles.appTime}>{app.time} min</Text>
                  {app.limit && (
                    <Text style={[
                      styles.appLimit,
                      app.time > app.limit && styles.appLimitExceeded
                    ]}>
                      / {app.limit} min limit
                    </Text>
                  )}
                </View>
              </View>
              {app.limit && app.time > app.limit && (
                <View style={styles.exceededBadge}>
                  <Ionicons name="alert" size={16} color="#EF4444" />
                </View>
              )}
              <TouchableOpacity style={styles.appAction}>
                <Ionicons name="settings-outline" size={20} color="#64748B" />
              </TouchableOpacity>
            </View>
          ))}
        </View>

        {/* Blocked Apps */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Blocked Apps</Text>
            <TouchableOpacity style={styles.addButton}>
              <Ionicons name="add" size={20} color="#6366F1" />
              <Text style={styles.addText}>Add</Text>
            </TouchableOpacity>
          </View>
          {mockBlockedApps.map((app) => (
            <View key={app.id} style={styles.blockedCard}>
              <View style={styles.blockedIcon}>
                <Ionicons name={app.icon as any} size={22} color="#EF4444" />
              </View>
              <View style={styles.blockedInfo}>
                <Text style={styles.blockedName}>{app.name}</Text>
                <Text style={styles.blockedReason}>{app.reason}</Text>
              </View>
              <TouchableOpacity style={styles.unblockButton}>
                <Text style={styles.unblockText}>Unblock</Text>
              </TouchableOpacity>
            </View>
          ))}
        </View>

        {/* Quick Actions */}
        <View style={styles.quickActions}>
          <TouchableOpacity style={styles.quickAction}>
            <Ionicons name="pause-circle" size={28} color="#F59E0B" />
            <Text style={styles.quickActionText}>Pause Phone</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.quickAction}>
            <Ionicons name="lock-closed" size={28} color="#EF4444" />
            <Text style={styles.quickActionText}>Lock Now</Text>
          </TouchableOpacity>
        </View>

        <View style={{ height: 32 }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0F172A',
  },
  header: {
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 16,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  subtitle: {
    fontSize: 14,
    color: '#94A3B8',
    marginTop: 4,
  },
  childSelector: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    gap: 12,
    marginBottom: 20,
  },
  childButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1E293B',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 24,
    gap: 10,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  childButtonActive: {
    borderColor: '#6366F1',
    backgroundColor: 'rgba(99, 102, 241, 0.1)',
  },
  childAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#334155',
    justifyContent: 'center',
    alignItems: 'center',
  },
  childAvatarActive: {
    backgroundColor: '#6366F1',
  },
  childInitial: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
  childName: {
    color: '#94A3B8',
    fontSize: 14,
    fontWeight: '600',
  },
  childNameActive: {
    color: '#FFFFFF',
  },
  totalCard: {
    backgroundColor: '#1E293B',
    marginHorizontal: 20,
    borderRadius: 20,
    padding: 20,
    marginBottom: 16,
  },
  totalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 16,
  },
  totalLabel: {
    fontSize: 14,
    color: '#94A3B8',
    marginBottom: 4,
  },
  totalTime: {
    fontSize: 36,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  limitBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(245, 158, 11, 0.15)',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 12,
    gap: 6,
  },
  limitText: {
    color: '#F59E0B',
    fontSize: 12,
    fontWeight: '600',
  },
  progressContainer: {
    gap: 8,
  },
  progressBar: {
    height: 8,
    backgroundColor: '#334155',
    borderRadius: 4,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#F59E0B',
    borderRadius: 4,
  },
  progressText: {
    color: '#64748B',
    fontSize: 12,
  },
  sleepCard: {
    backgroundColor: '#1E293B',
    marginHorizontal: 20,
    borderRadius: 20,
    padding: 20,
    marginBottom: 20,
  },
  sleepHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  sleepInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  sleepIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(139, 92, 246, 0.15)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  sleepTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  sleepSubtitle: {
    fontSize: 13,
    color: '#8B5CF6',
    marginTop: 2,
  },
  sleepDescription: {
    fontSize: 13,
    color: '#64748B',
  },
  section: {
    paddingHorizontal: 20,
    marginBottom: 24,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: 12,
  },
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  addText: {
    color: '#6366F1',
    fontSize: 14,
    fontWeight: '600',
  },
  appCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1E293B',
    borderRadius: 12,
    padding: 12,
    marginBottom: 8,
  },
  appIcon: {
    width: 44,
    height: 44,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  appInfo: {
    flex: 1,
    marginLeft: 12,
  },
  appName: {
    fontSize: 15,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  appTimeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 2,
  },
  appTime: {
    fontSize: 13,
    color: '#94A3B8',
  },
  appLimit: {
    fontSize: 13,
    color: '#64748B',
  },
  appLimitExceeded: {
    color: '#EF4444',
  },
  exceededBadge: {
    marginRight: 8,
  },
  appAction: {
    padding: 8,
  },
  blockedCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
    borderRadius: 12,
    padding: 12,
    marginBottom: 8,
  },
  blockedIcon: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: 'rgba(239, 68, 68, 0.15)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  blockedInfo: {
    flex: 1,
    marginLeft: 12,
  },
  blockedName: {
    fontSize: 15,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  blockedReason: {
    fontSize: 12,
    color: '#EF4444',
    marginTop: 2,
  },
  unblockButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: '#1E293B',
    borderRadius: 8,
  },
  unblockText: {
    color: '#94A3B8',
    fontSize: 12,
    fontWeight: '600',
  },
  quickActions: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    gap: 12,
  },
  quickAction: {
    flex: 1,
    backgroundColor: '#1E293B',
    borderRadius: 16,
    padding: 20,
    alignItems: 'center',
    gap: 8,
  },
  quickActionText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
});
