/**
 * Tamper Alerts Screen
 * Shows tamper events for parents to monitor
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  RefreshControl,
  ActivityIndicator,
} from 'react-native';
import { useRouter, Stack } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuthStore, useCircleStore } from '../../lib/store';
import { useLanguage } from '../../lib/i18n';
import { getTamperEvents, resolveTamperEvent, TamperEvent, TamperEventType } from '../../services/tamperAlertService';

export default function TamperAlertsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { language } = useLanguage();
  const { user } = useAuthStore();
  const { currentCircle } = useCircleStore();
  
  const [events, setEvents] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Translations
  const texts = {
    en: {
      title: 'Tamper Alerts',
      subtitle: 'Security events from family devices',
      noAlerts: 'No tamper alerts',
      noAlertsDesc: 'All devices are operating normally',
      resolve: 'Resolve',
      resolved: 'Resolved',
      critical: 'Critical',
      high: 'High',
      medium: 'Medium',
      low: 'Low',
      location_disabled: 'Location Disabled',
      gps_disabled: 'GPS Turned Off',
      internet_disabled: 'Internet Disconnected',
      app_force_closed: 'App Closed',
      permission_revoked: 'Permission Revoked',
      background_restricted: 'Background Restricted',
      battery_saver_on: 'Battery Saver On',
      airplane_mode: 'Airplane Mode',
      mock_location: 'Fake Location Detected',
      just_now: 'Just now',
      minutes_ago: 'min ago',
      hours_ago: 'hours ago',
      days_ago: 'days ago',
    },
    ro: {
      title: 'Alerte Tamper',
      subtitle: 'Evenimente de securitate de pe dispozitivele familiei',
      noAlerts: 'Nicio alertă',
      noAlertsDesc: 'Toate dispozitivele funcționează normal',
      resolve: 'Rezolvă',
      resolved: 'Rezolvat',
      critical: 'Critic',
      high: 'Ridicat',
      medium: 'Mediu',
      low: 'Scăzut',
      location_disabled: 'Locație dezactivată',
      gps_disabled: 'GPS oprit',
      internet_disabled: 'Internet deconectat',
      app_force_closed: 'Aplicație închisă',
      permission_revoked: 'Permisiune revocată',
      background_restricted: 'Background restricționat',
      battery_saver_on: 'Economisire baterie',
      airplane_mode: 'Mod avion',
      mock_location: 'Locație falsă detectată',
      just_now: 'Acum',
      minutes_ago: 'min în urmă',
      hours_ago: 'ore în urmă',
      days_ago: 'zile în urmă',
    },
  };
  
  const txt = texts[language];

  const loadEvents = useCallback(async () => {
    if (!currentCircle?.id) return;
    
    try {
      const data = await getTamperEvents(currentCircle.id, 50);
      setEvents(data);
    } catch (error) {
      console.error('Error loading tamper events:', error);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [currentCircle?.id]);

  useEffect(() => {
    loadEvents();
  }, [loadEvents]);

  const handleRefresh = () => {
    setIsRefreshing(true);
    loadEvents();
  };

  const handleResolve = async (eventId: string) => {
    const success = await resolveTamperEvent(eventId);
    if (success) {
      setEvents(prev => 
        prev.map(e => e.id === eventId ? { ...e, resolved_at: new Date().toISOString() } : e)
      );
    }
  };

  const getEventIcon = (eventType: TamperEventType): string => {
    const icons: Record<TamperEventType, string> = {
      location_disabled: 'location-outline',
      gps_disabled: 'navigate-outline',
      internet_disabled: 'wifi-outline',
      app_force_closed: 'close-circle-outline',
      permission_revoked: 'lock-closed-outline',
      background_restricted: 'pause-circle-outline',
      battery_saver_on: 'battery-half-outline',
      airplane_mode: 'airplane-outline',
      mock_location: 'warning-outline',
    };
    return icons[eventType] || 'alert-circle-outline';
  };

  const getSeverityColor = (severity: string): string => {
    switch (severity) {
      case 'critical': return '#EF4444';
      case 'high': return '#F97316';
      case 'medium': return '#FBBF24';
      case 'low': return '#6366F1';
      default: return '#64748B';
    }
  };

  const formatTime = (dateString: string): string => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return txt.just_now;
    if (diffMins < 60) return `${diffMins} ${txt.minutes_ago}`;
    if (diffHours < 24) return `${diffHours} ${txt.hours_ago}`;
    return `${diffDays} ${txt.days_ago}`;
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
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: insets.bottom + 20 }}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={handleRefresh}
            tintColor="#6366F1"
          />
        }
      >
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.headerIcon}>
            <Ionicons name="shield-checkmark" size={32} color="#6366F1" />
          </View>
          <Text style={styles.headerTitle}>{txt.title}</Text>
          <Text style={styles.headerSubtitle}>{txt.subtitle}</Text>
        </View>

        {events.length === 0 ? (
          <View style={styles.emptyState}>
            <View style={styles.emptyIcon}>
              <Ionicons name="checkmark-circle" size={64} color="#10B981" />
            </View>
            <Text style={styles.emptyTitle}>{txt.noAlerts}</Text>
            <Text style={styles.emptyText}>{txt.noAlertsDesc}</Text>
          </View>
        ) : (
          <View style={styles.eventsList}>
            {events.map((event) => (
              <View 
                key={event.id} 
                style={[
                  styles.eventCard,
                  event.resolved_at && styles.eventCardResolved
                ]}
              >
                <View style={[
                  styles.eventIconContainer,
                  { backgroundColor: `${getSeverityColor(event.severity)}20` }
                ]}>
                  <Ionicons 
                    name={getEventIcon(event.event_type) as any} 
                    size={24} 
                    color={getSeverityColor(event.severity)} 
                  />
                </View>
                
                <View style={styles.eventContent}>
                  <View style={styles.eventHeader}>
                    <Text style={styles.eventType}>
                      {txt[event.event_type as keyof typeof txt] || event.event_type}
                    </Text>
                    <View style={[
                      styles.severityBadge,
                      { backgroundColor: `${getSeverityColor(event.severity)}20` }
                    ]}>
                      <Text style={[
                        styles.severityText,
                        { color: getSeverityColor(event.severity) }
                      ]}>
                        {txt[event.severity as keyof typeof txt] || event.severity}
                      </Text>
                    </View>
                  </View>
                  
                  <Text style={styles.eventChild}>
                    {event.profiles?.name || 'Unknown'}
                  </Text>
                  
                  <Text style={styles.eventTime}>
                    {formatTime(event.detected_at)}
                  </Text>
                </View>

                {!event.resolved_at ? (
                  <TouchableOpacity
                    style={styles.resolveBtn}
                    onPress={() => handleResolve(event.id)}
                  >
                    <Ionicons name="checkmark" size={20} color="#10B981" />
                  </TouchableOpacity>
                ) : (
                  <View style={styles.resolvedBadge}>
                    <Ionicons name="checkmark-circle" size={20} color="#64748B" />
                  </View>
                )}
              </View>
            ))}
          </View>
        )}
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
  emptyState: {
    alignItems: 'center',
    paddingVertical: 60,
    paddingHorizontal: 40,
  },
  emptyIcon: {
    marginBottom: 24,
  },
  emptyTitle: {
    fontSize: 22,
    fontWeight: '600',
    color: '#FFFFFF',
    marginBottom: 8,
  },
  emptyText: {
    fontSize: 16,
    color: '#64748B',
    textAlign: 'center',
  },
  eventsList: {
    paddingHorizontal: 20,
    gap: 12,
  },
  eventCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1E293B',
    borderRadius: 16,
    padding: 16,
    borderLeftWidth: 4,
    borderLeftColor: '#EF4444',
  },
  eventCardResolved: {
    opacity: 0.6,
    borderLeftColor: '#64748B',
  },
  eventIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
  },
  eventContent: {
    flex: 1,
    marginLeft: 14,
  },
  eventHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  eventType: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  severityBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
  },
  severityText: {
    fontSize: 11,
    fontWeight: '600',
    textTransform: 'uppercase',
  },
  eventChild: {
    fontSize: 14,
    color: '#94A3B8',
    marginTop: 4,
  },
  eventTime: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 4,
  },
  resolveBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  resolvedBadge: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
