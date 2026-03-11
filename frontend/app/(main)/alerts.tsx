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
import { useAlertsStore, useNotificationsStore, useAuthStore } from '../../lib/store';
import { supabase } from '../../lib/supabase';
import { AnomalyAlert, Notification } from '../../types';
import { formatRelativeTime, getAlertIcon, getAlertColor } from '../../utils/helpers';

type TabType = 'all' | 'alerts' | 'arrivals' | 'battery';

export default function AlertsScreen() {
  const { user } = useAuthStore();
  const { alerts, setAlerts, markAsRead, markAllAsRead } = useAlertsStore();
  const { notifications, setNotifications } = useNotificationsStore();
  const [activeTab, setActiveTab] = useState<TabType>('all');
  const [isRefreshing, setIsRefreshing] = useState(false);

  useEffect(() => {
    loadAlerts();
  }, []);

  const loadAlerts = async () => {
    if (!user) return;

    try {
      const { data, error } = await supabase
        .from('anomaly_alerts')
        .select('*')
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
    await supabase
      .from('anomaly_alerts')
      .update({ is_read: true })
      .eq('id', alertId);
  };

  const handleMarkAllAsRead = async () => {
    markAllAsRead();
    await supabase
      .from('anomaly_alerts')
      .update({ is_read: true })
      .in('id', alerts.map(a => a.id));
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
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>Alerts</Text>
        {alerts.some(a => !a.is_read) && (
          <TouchableOpacity onPress={handleMarkAllAsRead}>
            <Text style={styles.markAllRead}>Mark all read</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Tabs */}
      <View style={styles.tabsContainer}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tabs}>
          {tabs.map((tab) => (
            <TouchableOpacity
              key={tab.key}
              style={[styles.tab, activeTab === tab.key && styles.tabActive]}
              onPress={() => setActiveTab(tab.key)}
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
                ]}
                onPress={() => handleMarkAsRead(alert.id)}
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
                    {!alert.is_read && <View style={styles.unreadDot} />}
                  </View>
                  <Text style={styles.alertMessage}>{alert.message}</Text>
                  <Text style={styles.alertTime}>{formatRelativeTime(alert.created_at)}</Text>
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
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  markAllRead: {
    fontSize: 14,
    color: '#6366F1',
    fontWeight: '600',
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
    gap: 8,
  },
  alertTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
    flex: 1,
  },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#6366F1',
  },
  alertMessage: {
    fontSize: 14,
    color: '#94A3B8',
    marginTop: 4,
  },
  alertTime: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 8,
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
  },
});
