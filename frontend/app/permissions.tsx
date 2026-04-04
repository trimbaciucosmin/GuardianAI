import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Linking,
  Platform,
  Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Location from 'expo-location';
import * as Battery from 'expo-battery';
import * as Network from 'expo-network';
import { checkTamperStatus, addTamperListener } from '../lib/adaptiveTrackingService';

interface PermissionItem {
  id: string;
  name: string;
  description: string;
  icon: string;
  status: 'granted' | 'denied' | 'not_determined' | 'checking';
  required: boolean;
  onRequest: () => Promise<void>;
}

export default function PermissionsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [isLoading, setIsLoading] = useState(true);
  const [permissions, setPermissions] = useState<PermissionItem[]>([]);

  const checkAllPermissions = useCallback(async () => {
    setIsLoading(true);

    const permissionsList: PermissionItem[] = [];

    // 1. Location (Foreground)
    try {
      const { status } = await Location.getForegroundPermissionsAsync();
      permissionsList.push({
        id: 'location_foreground',
        name: 'Location Access',
        description: '📍 OBLIGATORIU - Afișează locația ta și a familiei pe hartă',
        icon: 'location',
        status: status === 'granted' ? 'granted' : status === 'denied' ? 'denied' : 'not_determined',
        required: true,
        onRequest: async () => {
          const result = await Location.requestForegroundPermissionsAsync();
          if (result.status !== 'granted') {
            Alert.alert(
              'Locație necesară',
              'Aplicația nu poate funcționa fără acces la locație. Te rugăm să activezi în setări.',
              [
                { text: 'Anulează', style: 'cancel' },
                { text: 'Deschide Setări', onPress: () => Linking.openSettings() }
              ]
            );
          }
          checkAllPermissions();
        },
      });
    } catch (e) {
      console.error('Location permission check error:', e);
    }

    // 2. Background Location
    if (Platform.OS !== 'web') {
      try {
        const { status } = await Location.getBackgroundPermissionsAsync();
        permissionsList.push({
          id: 'location_background',
          name: 'Locație "Always" (Mereu)',
          description: '⚠️ CRITIC - Alege "Allow all the time" / "Mereu" pentru tracking când aplicația e închisă. Fără asta, alertele NU funcționează!',
          icon: 'navigate-circle',
          status: status === 'granted' ? 'granted' : status === 'denied' ? 'denied' : 'not_determined',
          required: true,
          onRequest: async () => {
            const result = await Location.requestBackgroundPermissionsAsync();
            if (result.status !== 'granted') {
              Alert.alert(
                'Locație în fundal - OBLIGATORIU',
                'Pentru siguranța familiei, selectează "Allow all the time" (Mereu) în setări.\n\nFără această permisiune:\n• Nu primești alerte când copilul ajunge/pleacă\n• Nu funcționează SOS în urgențe\n• Nu se detectează devierile de traseu',
                [
                  { text: 'Anulează', style: 'cancel' },
                  { text: 'Deschide Setări', onPress: () => Linking.openSettings() }
                ]
              );
            }
            checkAllPermissions();
          },
        });
      } catch (e) {
        console.error('Background location check error:', e);
      }
    }

    // 3. Location Services (GPS)
    try {
      const servicesEnabled = await Location.hasServicesEnabledAsync();
      permissionsList.push({
        id: 'gps',
        name: 'GPS / Location Services',
        description: 'Device location services must be enabled for accurate tracking',
        icon: 'compass',
        status: servicesEnabled ? 'granted' : 'denied',
        required: true,
        onRequest: async () => {
          if (Platform.OS === 'ios') {
            Linking.openURL('App-Prefs:Privacy&path=LOCATION');
          } else {
            Linking.openSettings();
          }
          // Re-check after a delay
          setTimeout(checkAllPermissions, 2000);
        },
      });
    } catch (e) {
      console.error('GPS check error:', e);
    }

    // 4. Network Status (was Notifications - removed due to SDK 53 incompatibility)
    try {
      const networkState = await Network.getNetworkStateAsync();
      permissionsList.push({
        id: 'network',
        name: 'Internet Connection',
        description: 'Required to sync location data with your family circle',
        icon: 'wifi',
        status: networkState.isConnected ? 'granted' : 'denied',
        required: true,
        onRequest: async () => {
          if (Platform.OS === 'ios') {
            Linking.openURL('App-Prefs:root=WIFI');
          } else {
            Linking.openSettings();
          }
          setTimeout(checkAllPermissions, 2000);
        },
      });
    } catch (e) {
      console.error('Network check error:', e);
    }

    // 6. Battery Optimization (Android)
    if (Platform.OS === 'android') {
      permissionsList.push({
        id: 'battery_optimization',
        name: 'Dezactivează economisirea bateriei',
        description: '🔋 IMPORTANT - Fără asta, Android oprește tracking-ul după câteva minute! Selectează "Unrestricted" / "Nerestricționat"',
        icon: 'battery-charging',
        status: 'not_determined', // Can't check programmatically
        required: true,
        onRequest: async () => {
          Alert.alert(
            'Dezactivează economisirea bateriei',
            'Android oprește aplicațiile în fundal pentru a economisi bateria.\n\nPentru Guardian AI să funcționeze:\n\n1. Deschide Setări\n2. Mergi la Apps > Guardian AI\n3. Battery > Unrestricted (Nerestricționat)\n\n⚠️ ATENȚIE: Fără această setare, NU vei primi alerte!',
            [
              { text: 'Anulează', style: 'cancel' },
              { text: 'Deschide Setări', onPress: () => Linking.openSettings() }
            ]
          );
        },
      });
    }

    setPermissions(permissionsList);
    setIsLoading(false);
  }, []);

  useEffect(() => {
    checkAllPermissions();

    // Listen for tamper status changes
    const unsubscribe = addTamperListener((status) => {
      checkAllPermissions();
    });

    return () => unsubscribe();
  }, [checkAllPermissions]);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'granted':
        return '#10B981';
      case 'denied':
        return '#EF4444';
      case 'not_determined':
        return '#F59E0B';
      default:
        return '#64748B';
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'granted':
        return 'Enabled';
      case 'denied':
        return 'Denied';
      case 'not_determined':
        return 'Not Set';
      case 'checking':
        return 'Checking...';
      default:
        return 'Unknown';
    }
  };

  const allGranted = permissions.every(p => p.status === 'granted');
  const grantedCount = permissions.filter(p => p.status === 'granted').length;

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#6366F1" />
        <Text style={styles.loadingText}>Checking permissions...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color="#FFFFFF" />
        </TouchableOpacity>
        <Text style={styles.title}>Permissions</Text>
        <TouchableOpacity style={styles.refreshButton} onPress={checkAllPermissions}>
          <Ionicons name="refresh" size={24} color="#94A3B8" />
        </TouchableOpacity>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: insets.bottom + 32 }}
      >
        {/* Status Card */}
        <View style={styles.statusCard}>
          <View style={[
            styles.statusIcon,
            { backgroundColor: allGranted ? 'rgba(16, 185, 129, 0.15)' : 'rgba(239, 68, 68, 0.15)' }
          ]}>
            <Ionicons 
              name={allGranted ? 'shield-checkmark' : 'shield-outline'} 
              size={40} 
              color={allGranted ? '#10B981' : '#EF4444'} 
            />
          </View>
          <Text style={styles.statusTitle}>
            {allGranted ? 'All Permissions Granted' : 'Permissions Required'}
          </Text>
          <Text style={styles.statusSubtitle}>
            {grantedCount} of {permissions.length} permissions enabled
          </Text>
          {!allGranted && (
            <Text style={styles.statusWarning}>
              Some features may not work without all permissions
            </Text>
          )}
        </View>

        {/* Permissions List */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Required Permissions</Text>
          
          {permissions.map((permission) => (
            <TouchableOpacity
              key={permission.id}
              style={styles.permissionCard}
              onPress={permission.status !== 'granted' ? permission.onRequest : undefined}
              activeOpacity={permission.status === 'granted' ? 1 : 0.7}
            >
              <View style={[
                styles.permissionIcon,
                { backgroundColor: `${getStatusColor(permission.status)}15` }
              ]}>
                <Ionicons 
                  name={permission.icon as any} 
                  size={24} 
                  color={getStatusColor(permission.status)} 
                />
              </View>
              
              <View style={styles.permissionInfo}>
                <View style={styles.permissionHeader}>
                  <Text style={styles.permissionName}>{permission.name}</Text>
                  {permission.required && (
                    <View style={styles.requiredBadge}>
                      <Text style={styles.requiredText}>Required</Text>
                    </View>
                  )}
                </View>
                <Text style={styles.permissionDescription}>{permission.description}</Text>
              </View>
              
              <View style={styles.permissionStatus}>
                <View style={[
                  styles.statusBadge,
                  { backgroundColor: `${getStatusColor(permission.status)}20` }
                ]}>
                  <View style={[
                    styles.statusDot,
                    { backgroundColor: getStatusColor(permission.status) }
                  ]} />
                  <Text style={[
                    styles.statusText,
                    { color: getStatusColor(permission.status) }
                  ]}>
                    {getStatusText(permission.status)}
                  </Text>
                </View>
                {permission.status !== 'granted' && (
                  <Ionicons name="chevron-forward" size={20} color="#64748B" />
                )}
              </View>
            </TouchableOpacity>
          ))}
        </View>

        {/* Help Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Why These Permissions?</Text>
          
          <View style={styles.helpCard}>
            <Ionicons name="information-circle" size={24} color="#6366F1" />
            <Text style={styles.helpText}>
              Guardian AI needs these permissions to keep your family safe. Location tracking 
              ensures you always know where your loved ones are, and notifications alert you 
              to important events like arrivals and emergencies.
            </Text>
          </View>

          <TouchableOpacity style={styles.settingsButton} onPress={() => Linking.openSettings()}>
            <Ionicons name="settings" size={20} color="#6366F1" />
            <Text style={styles.settingsButtonText}>Open Device Settings</Text>
          </TouchableOpacity>
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
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#0F172A',
  },
  loadingText: {
    color: '#94A3B8',
    marginTop: 16,
    fontSize: 16,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 16,
  },
  backButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#1E293B',
    justifyContent: 'center',
    alignItems: 'center',
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  refreshButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#1E293B',
    justifyContent: 'center',
    alignItems: 'center',
  },
  statusCard: {
    backgroundColor: '#1E293B',
    marginHorizontal: 20,
    borderRadius: 20,
    padding: 24,
    alignItems: 'center',
    marginBottom: 24,
  },
  statusIcon: {
    width: 80,
    height: 80,
    borderRadius: 40,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  statusTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: 4,
  },
  statusSubtitle: {
    fontSize: 14,
    color: '#94A3B8',
  },
  statusWarning: {
    fontSize: 12,
    color: '#F59E0B',
    marginTop: 8,
    textAlign: 'center',
  },
  section: {
    paddingHorizontal: 20,
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: 12,
  },
  permissionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1E293B',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
  },
  permissionIcon: {
    width: 48,
    height: 48,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
  },
  permissionInfo: {
    flex: 1,
    marginLeft: 14,
  },
  permissionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
  },
  permissionName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  requiredBadge: {
    backgroundColor: 'rgba(239, 68, 68, 0.15)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  requiredText: {
    fontSize: 10,
    fontWeight: '600',
    color: '#EF4444',
  },
  permissionDescription: {
    fontSize: 12,
    color: '#64748B',
    lineHeight: 16,
  },
  permissionStatus: {
    alignItems: 'flex-end',
    gap: 4,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 12,
    gap: 6,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '600',
  },
  helpCard: {
    flexDirection: 'row',
    backgroundColor: 'rgba(99, 102, 241, 0.1)',
    borderRadius: 12,
    padding: 16,
    gap: 12,
    marginBottom: 16,
  },
  helpText: {
    flex: 1,
    fontSize: 13,
    color: '#94A3B8',
    lineHeight: 20,
  },
  settingsButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(99, 102, 241, 0.15)',
    borderRadius: 12,
    paddingVertical: 14,
    gap: 8,
  },
  settingsButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#6366F1',
  },
});
