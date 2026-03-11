import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useAlertsStore, useNotificationsStore, useAuthStore, useCircleStore, useRealtimeStore } from '../../lib/store';
import { supabase } from '../../lib/supabase';
import { AnomalyAlert, Notification } from '../../types';
import { formatRelativeTime, getAlertIcon, getAlertColor } from '../../utils/helpers';
import { useRealtimeSubscription } from '../../hooks/useRealtimeSubscription';

type TabType = 'all' | 'alerts' | 'arrivals' | 'battery';

export default function AlertsScreen() {
  const { user } = useAuthStore();
  const { currentCircle } = useCircleStore();
  const { alerts, setAlerts, addAlert, markAsRead, markAllAsRead, unreadCount } = useAlertsStore();
  const { notifications, setNotifications } = useNotificationsStore();
  const { isConnected: globalConnected } = useRealtimeStore();
  const [activeTab, setActiveTab] = useState<TabType>('all');
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [newAlertAnimation, setNewAlertAnimation] = useState<string | null>(null);

  // Subscribe to realtime alerts
  const {
    isConnected,
    connectionError,
    lastAlert,
    lastSOSEvent,
    lastGeofenceEvent,
  } = useRealtimeSubscription(currentCircle?.id || null);

  // Handle new realtime alerts
  useEffect(() => {
    if (lastAlert?.data && lastAlert.action === 'INSERT') {
      const newAlert = lastAlert.data as AnomalyAlert;
      // Check if alert is not already in list
      if (!alerts.find(a => a.id === newAlert.id)) {
        addAlert(newAlert);
        setNewAlertAnimation(newAlert.id);
        // Clear animation after 2 seconds
        setTimeout(() => setNewAlertAnimation(null), 2000);
      }
    }
  }, [lastAlert]);

  // Handle SOS events as critical alerts
  useEffect(() => {
    if (lastSOSEvent?.data && lastSOSEvent.action === 'INSERT') {
      const sosEvent = lastSOSEvent.data;
      const syntheticAlert: AnomalyAlert = {
        id: `sos-${sosEvent.id}`,
        user_id: sosEvent.user_id,
        circle_id: sosEvent.circle_id,
        alert_type: 'sos_triggered',
        title: 'SOS Alert Triggered',
        message: `A family member has triggered an SOS alert and needs help!`,
        severity: 'critical',
        is_read: false,
        created_at: sosEvent.started_at,
      };
      if (!alerts.find(a => a.id === syntheticAlert.id)) {
        addAlert(syntheticAlert);
        setNewAlertAnimation(syntheticAlert.id);
        setTimeout(() => setNewAlertAnimation(null), 2000);
      }
    }
  }, [lastSOSEvent]);

  // Handle geofence events
  useEffect(() => {
    if (lastGeofenceEvent?.data && lastGeofenceEvent.action === 'INSERT') {
      const event = lastGeofenceEvent.data;
      const syntheticAlert: AnomalyAlert = {
        id: `geofence-${event.id}`,
        user_id: event.user_id,
        circle_id: currentCircle?.id || '',
        alert_type: 'left_safe_zone',
        title: event.event_type === 'arrive' ? 'Arrived at Location' : 'Left Location',
        message: `Family member has ${event.event_type === 'arrive' ? 'arrived at' : 'left'} a safe zone`,
        severity: 'low',
        is_read: false,
        created_at: event.timestamp,
      };
      if (!alerts.find(a => a.id === syntheticAlert.id)) {
        addAlert(syntheticAlert);
      }
    }
  }, [lastGeofenceEvent]);

  useEffect(() => {
    loadAlerts();
  }, [currentCircle]);

  const loadAlerts = async () => {
    if (!user || !currentCircle) return;

    try {
      const { data, error } = await supabase
        .from('anomaly_alerts')
        .select('*')
        .eq('circle_id', currentCircle.id)
        .order('created_at', { ascending: false })
        .limit(50);

      if (!error && data) {
        setAlerts(data);
      }

      // Load notifications
      const { data: notifData } = await supabase
        .from('notifications')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(50);

      if (notifData) {
        setNotifications(notifData);
      }
    } catch (error) {
      console.error('Load alerts error:', error);
    }
  };

  const onRefresh = async () => {
    setIsRefreshing(true);
    await loadAlerts();
    setIsRefreshing(false);
  };

  const handleMarkAsRead = async (alertId: string) => {
    markAsRead(alertId);
    // Only update real alerts in DB (not synthetic ones)
    if (!alertId.startsWith('sos-') && !alertId.startsWith('geofence-')) {
      await supabase
        .from('anomaly_alerts')
        .update({ is_read: true })
        .eq('id', alertId);
    }
  };

  const handleMarkAllAsRead = async () => {
    markAllAsRead();
    const realAlertIds = alerts.filter(a => !a.id.startsWith('sos-') && !a.id.startsWith('geofence-')).map(a => a.id);
    if (realAlertIds.length > 0) {
      await supabase
        .from('anomaly_alerts')
        .update({ is_read: true })
        .in('id', realAlertIds);
    }
  };

  const filteredAlerts = alerts.filter((alert) => {
    switch (activeTab) {
      case 'alerts':
        return ['sos_triggered', 'route_deviation', 'unexpected_stop', 'eta_exceeded'].includes(alert.alert_type);
      case 'arrivals':
        return ['left_safe_zone'].includes(alert.alert_type);
      case 'battery':
        return ['low_battery', 'phone_offline'].includes(alert.alert_type);
      default:
        return true;
    }
  });

  const tabs: { key: TabType; label: string; icon: string }[] = [
    { key: 'all', label: 'All', icon: 'list' },
    { key: 'alerts', label: 'Safety', icon: 'alert-circle' },
    { key: 'arrivals', label: 'Places', icon: 'location' },
    { key: 'battery', label: 'Device', icon: 'battery-half' },
  ];

  const getAlertIconName = (type: string): string => {
    const icons: Record<string, string> = {
      route_deviation: 'alert-circle',
      unexpected_stop: 'pause-circle',
      eta_exceeded: 'time',
      phone_offline: 'cloud-offline',
      low_battery: 'battery-dead',
      left_safe_zone: 'exit',
      sos_triggered: 'warning',
      unusual_location: 'help-circle',
    };
    return icons[type] || 'notifications';
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']} data-testid="alerts-screen">
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Text style={styles.title}>Alerts</Text>
          {unreadCount > 0 && (
            <View style={styles.unreadBadge}>
              <Text style={styles.unreadBadgeText}>{unreadCount}</Text>
            </View>
          )}
        </View>
        <View style={styles.headerRight}>
          {/* Realtime status indicator */}
          <View style={[
            styles.realtimeIndicator,
            { backgroundColor: isConnected ? 'rgba(16, 185, 129, 0.2)' : 'rgba(100, 116, 139, 0.2)' }
          ]}>
            <View style={[
              styles.realtimeDot,
              { backgroundColor: isConnected ? '#10B981' : '#64748B' }
            ]} />
            <Text style={[
              styles.realtimeText,
              { color: isConnected ? '#10B981' : '#64748B' }
            ]}>
              {isConnected ? 'Live' : 'Offline'}
            </Text>
          </View>
          {alerts.some(a => !a.is_read) && (
            <TouchableOpacity onPress={handleMarkAllAsRead} data-testid="mark-all-read-btn">
              <Text style={styles.markAllRead}>Mark all read</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Connection Error Banner */}
      {connectionError && (
        <View style={styles.errorBanner}>
          <Ionicons name="wifi-outline" size={16} color="#FCD34D" />
          <Text style={styles.errorText}>{connectionError}</Text>
        </View>
      )}

      {/* Tabs */}
      <View style={styles.tabsContainer}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tabs}>
          {tabs.map((tab) => (
            <TouchableOpacity
              key={tab.key}
              style={[styles.tab, activeTab === tab.key && styles.tabActive]}
              onPress={() => setActiveTab(tab.key)}
              data-testid={`tab-${tab.key}`}
            >
              <Ionicons
                name={tab.icon as any}
                size={16}
                color={activeTab === tab.key ? '#6366F1' : '#64748B'}
              />
              <Text style={[styles.tabText, activeTab === tab.key && styles.tabTextActive]}>
                {tab.label}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {/* Alerts List */}
      <ScrollView
        style={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={onRefresh}
            tintColor="#6366F1"
          />
        }
      >
        {filteredAlerts.length > 0 ? (
          <View style={styles.alertsList}>
            {filteredAlerts.map((alert) => (
              <TouchableOpacity
                key={alert.id}
                style={[
                  styles.alertCard,
                  !alert.is_read && styles.alertCardUnread,
                  newAlertAnimation === alert.id && styles.alertCardNew,
                ]}
                onPress={() => handleMarkAsRead(alert.id)}
                data-testid={`alert-card-${alert.id}`}
              >
                <View style={[
                  styles.alertIcon,
                  { backgroundColor: `${getAlertColor(alert.severity)}20` },
                ]}>
                  <Ionicons
                    name={getAlertIconName(alert.alert_type) as any}
                    size={24}
                    color={getAlertColor(alert.severity)}
                  />
                </View>
                <View style={styles.alertContent}>
                  <View style={styles.alertHeader}>
                    <Text style={styles.alertTitle}>{alert.title}</Text>
                    <View style={styles.alertBadges}>
                      {!alert.is_read && <View style={styles.unreadDot} />}
                      {newAlertAnimation === alert.id && (
                        <View style={styles.newBadge}>
                          <Text style={styles.newBadgeText}>NEW</Text>
                        </View>
                      )}
                    </View>
                  </View>
                  <Text style={styles.alertMessage}>{alert.message}</Text>
                  <View style={styles.alertFooter}>
                    <Text style={styles.alertTime}>{formatRelativeTime(alert.created_at)}</Text>
                    <View style={[styles.severityBadge, { backgroundColor: `${getAlertColor(alert.severity)}20` }]}>
                      <Text style={[styles.severityText, { color: getAlertColor(alert.severity) }]}>
                        {alert.severity.toUpperCase()}
                      </Text>
                    </View>
                  </View>
                </View>
              </TouchableOpacity>
            ))}
          </View>
        ) : (
          <View style={styles.emptyState}>
            <View style={styles.emptyIcon}>
              <Ionicons name="checkmark-circle" size={48} color="#10B981" />
            </View>
            <Text style={styles.emptyTitle}>All Clear</Text>
            <Text style={styles.emptySubtitle}>
              No alerts to show. Your family is safe!
            </Text>
            <View style={styles.realtimeStatusEmpty}>
              <View style={[
                styles.realtimeDot,
                { backgroundColor: isConnected ? '#10B981' : '#64748B' }
              ]} />
              <Text style={styles.realtimeStatusText}>
                {isConnected ? 'Monitoring for new alerts...' : 'Waiting for connection...'}
              </Text>
            </View>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0F172A',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  unreadBadge: {
    backgroundColor: '#DC2626',
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 2,
    minWidth: 20,
    alignItems: 'center',
  },
  unreadBadgeText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
  },
  realtimeIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    gap: 6,
  },
  realtimeDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  realtimeText: {
    fontSize: 11,
    fontWeight: '600',
  },
  markAllRead: {
    fontSize: 14,
    color: '#6366F1',
    fontWeight: '600',
  },
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(251, 191, 36, 0.1)',
    marginHorizontal: 20,
    marginBottom: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 10,
    gap: 8,
  },
  errorText: {
    color: '#FCD34D',
    fontSize: 13,
    flex: 1,
  },
  tabsContainer: {
    paddingBottom: 12,
  },
  tabs: {
    paddingHorizontal: 20,
    gap: 8,
  },
  tab: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1E293B',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    gap: 6,
  },
  tabActive: {
    backgroundColor: 'rgba(99, 102, 241, 0.1)',
    borderWidth: 1,
    borderColor: '#6366F1',
  },
  tabText: {
    fontSize: 14,
    color: '#64748B',
    fontWeight: '500',
  },
  tabTextActive: {
    color: '#6366F1',
  },
  content: {
    flex: 1,
    paddingHorizontal: 20,
  },
  alertsList: {
    gap: 12,
    paddingBottom: 20,
  },
  alertCard: {
    flexDirection: 'row',
    backgroundColor: '#1E293B',
    borderRadius: 12,
    padding: 16,
  },
  alertCardUnread: {
    backgroundColor: 'rgba(99, 102, 241, 0.05)',
    borderWidth: 1,
    borderColor: 'rgba(99, 102, 241, 0.2)',
  },
  alertCardNew: {
    backgroundColor: 'rgba(16, 185, 129, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.3)',
  },
  alertIcon: {
    width: 48,
    height: 48,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  alertContent: {
    flex: 1,
    marginLeft: 12,
  },
  alertHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  alertTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
    flex: 1,
  },
  alertBadges: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#6366F1',
  },
  newBadge: {
    backgroundColor: '#10B981',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  newBadgeText: {
    color: '#FFFFFF',
    fontSize: 9,
    fontWeight: '700',
  },
  alertMessage: {
    fontSize: 14,
    color: '#94A3B8',
    marginTop: 4,
  },
  alertFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 8,
  },
  alertTime: {
    fontSize: 12,
    color: '#64748B',
  },
  severityBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
  },
  severityText: {
    fontSize: 10,
    fontWeight: '700',
  },
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 100,
  },
  emptyIcon: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: 'rgba(16, 185, 129, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#FFFFFF',
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 14,
    color: '#64748B',
    textAlign: 'center',
    marginBottom: 20,
  },
  realtimeStatusEmpty: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(30, 41, 59, 0.8)',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    gap: 8,
  },
  realtimeStatusText: {
    color: '#94A3B8',
    fontSize: 13,
  },
});
