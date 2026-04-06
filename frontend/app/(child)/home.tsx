/**
 * Child Home Screen - ENHANCED
 * 
 * Features:
 * - Large SOS button
 * - Join Family Circle (when no circle)
 * - Safe Trip status
 * - Quick check-in actions
 * - Real battery + location tracking (every 60s to backend)
 * - Device status
 * - Simplified map
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Alert,
  Dimensions,
  AppState,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import * as Location from 'expo-location';
import * as Battery from 'expo-battery';
import { supabase } from '../../lib/supabase';
import { useAuthStore, useCircleStore } from '../../lib/store';
import { useActiveSafeTrip } from '../../hooks/useActiveSafeTrip';
import MapComponent from '../../components/MapComponent';
import { useLanguage } from '../../lib/i18n';

const { width } = Dimensions.get('window');

export default function ChildHomeScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { profile, user } = useAuthStore();
  const { currentCircle } = useCircleStore();
  const { activeTrip, isLoading: tripLoading } = useActiveSafeTrip();
  const { t } = useLanguage();

  const [myLocation, setMyLocation] = useState<Location.LocationObject | null>(null);
  const [myAddress, setMyAddress] = useState<string>('');
  const [batteryLevel, setBatteryLevel] = useState<number>(100);
  const [isCharging, setIsCharging] = useState<boolean>(false);
  const [gpsEnabled, setGpsEnabled] = useState<boolean>(true);
  const [isLoadingLocation, setIsLoadingLocation] = useState(true);
  const [isSendingCheckIn, setIsSendingCheckIn] = useState(false);
  const [lastSendTime, setLastSendTime] = useState<string>('');

  const userName = profile?.name?.split(' ')[0] || 'there';
  const BACKEND_URL = process.env.EXPO_PUBLIC_BACKEND_URL || '';
  const hasCircle = !!currentCircle?.id;

  // Send location + battery to backend AND Supabase
  const sendToBackend = useCallback(async (
    loc: Location.LocationObject | null, 
    bat: number, 
    charging: boolean,
    address: string = ''
  ) => {
    if (!user?.id || !currentCircle?.id || !loc) return;
    
    const timestamp = new Date().toISOString();
    
    // Save to Supabase for realtime updates (so parents see online status)
    try {
      await supabase
        .from('live_locations')
        .upsert({
          user_id: user.id,
          circle_id: currentCircle.id,
          latitude: loc.coords.latitude,
          longitude: loc.coords.longitude,
          accuracy: loc.coords.accuracy || 0,
          speed: loc.coords.speed || 0,
          heading: loc.coords.heading || 0,
          timestamp: timestamp,
          updated_at: timestamp,
        }, {
          onConflict: 'user_id,circle_id'
        });
      
      // Also update device_status
      await supabase
        .from('device_status')
        .upsert({
          user_id: user.id,
          battery_level: bat,
          is_charging: charging,
          gps_enabled: true,
          network_type: 'mobile',
          last_seen: timestamp,
          updated_at: timestamp,
        }, {
          onConflict: 'user_id'
        });
        
      console.log(`[CHILD:SUPABASE] Updated location and device status`);
    } catch (err) {
      console.log('[CHILD:SUPABASE] Error:', err);
    }
    
    // Also send to backend API if needed
    try {
      const response = await fetch(`${BACKEND_URL}/api/child/location`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_id: user.id,
          user_name: profile?.name || 'Child',
          circle_id: currentCircle.id,
          latitude: loc.coords.latitude,
          longitude: loc.coords.longitude,
          battery_level: bat,
          is_charging: charging,
          address: address,
          speed: loc.coords.speed || 0,
          timestamp: timestamp,
        }),
      });
      if (response.ok) {
        setLastSendTime(new Date().toLocaleTimeString());
        console.log(`[CHILD:SEND] loc=${loc.coords.latitude.toFixed(4)},${loc.coords.longitude.toFixed(4)} bat=${bat}% charging=${charging}`);
      }
    } catch (err) {
      console.log('[CHILD:SEND] Error:', err);
    }
  }, [user?.id, currentCircle?.id, profile?.name, BACKEND_URL]);

  // Get battery level + charging status
  useEffect(() => {
    if (!hasCircle) return;
    
    const getBatteryInfo = async () => {
      try {
        const level = await Battery.getBatteryLevelAsync();
        const bat = Math.round(level * 100);
        setBatteryLevel(bat);
        
        const state = await Battery.getBatteryStateAsync();
        const charging = state === Battery.BatteryState.CHARGING || state === Battery.BatteryState.FULL;
        setIsCharging(charging);
      } catch (error) {
        console.log('[CHILD:BAT] Error:', error);
      }
    };

    getBatteryInfo();
    const interval = setInterval(getBatteryInfo, 30000); // Every 30 seconds
    return () => clearInterval(interval);
  }, [hasCircle]);

  // Send data to backend whenever location OR battery changes
  useEffect(() => {
    if (!hasCircle || !myLocation) return;
    
    // Send immediately when we have location data
    sendToBackend(myLocation, batteryLevel, isCharging, myAddress);
    
    // Then send periodically every 30 seconds
    const sendInterval = setInterval(() => {
      sendToBackend(myLocation, batteryLevel, isCharging, myAddress);
    }, 30000);
    
    return () => clearInterval(sendInterval);
  }, [hasCircle, myLocation?.coords.latitude, batteryLevel, isCharging, sendToBackend]);

  // Get location
  useEffect(() => {
    let locationSubscription: Location.LocationSubscription | null = null;

    const setupLocation = async () => {
      try {
        setIsLoadingLocation(true);
        
        // Request foreground permissions first
        const { status: foregroundStatus } = await Location.requestForegroundPermissionsAsync();
        if (foregroundStatus !== 'granted') {
          setGpsEnabled(false);
          setIsLoadingLocation(false);
          return;
        }
        
        // Try to get background permissions (for when screen is locked)
        try {
          const { status: backgroundStatus } = await Location.requestBackgroundPermissionsAsync();
          if (backgroundStatus === 'granted') {
            console.log('[CHILD:LOCATION] Background permissions granted');
          }
        } catch (bgError) {
          // Background permissions not available on all platforms
          console.log('[CHILD:LOCATION] Background permissions not available:', bgError);
        }

        const enabled = await Location.hasServicesEnabledAsync();
        setGpsEnabled(enabled);

        if (!enabled) {
          setIsLoadingLocation(false);
          return;
        }

        const location = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Balanced,
        });
        setMyLocation(location);

        // Get address
        try {
          const result = await Location.reverseGeocodeAsync({
            latitude: location.coords.latitude,
            longitude: location.coords.longitude,
          });
          if (result && result.length > 0) {
            const addr = result[0];
            const parts = [];
            if (addr.street) parts.push(addr.street);
            if (addr.city) parts.push(addr.city);
            setMyAddress(parts.length > 0 ? parts.join(', ') : '');
          }
        } catch {
          // If Expo geocoding fails, try backend
          try {
            const res = await fetch(`${BACKEND_URL}/api/geocode/reverse?lat=${location.coords.latitude}&lng=${location.coords.longitude}`);
            const data = await res.json();
            if (data.success && data.address) {
              setMyAddress(data.address);
            }
          } catch {}
        }

        setIsLoadingLocation(false);

        // Watch for updates - more frequent for better tracking
        locationSubscription = await Location.watchPositionAsync(
          {
            accuracy: Location.Accuracy.Balanced,
            timeInterval: 10000,  // Every 10 seconds
            distanceInterval: 10, // Or every 10 meters
          },
          (newLocation) => {
            setMyLocation(newLocation);
          }
        );
      } catch (error) {
        console.error('Location error:', error);
        setIsLoadingLocation(false);
      }
    };

    setupLocation();

    return () => {
      if (locationSubscription) {
        locationSubscription.remove();
      }
    };
  }, []);

  // Re-send data when app comes back to foreground
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextAppState) => {
      if (nextAppState === 'active' && myLocation && hasCircle) {
        sendToBackend(myLocation, batteryLevel, isCharging, myAddress);
      }
    });
    return () => subscription.remove();
  }, [myLocation, batteryLevel, isCharging, myAddress, hasCircle, sendToBackend]);

  // Quick check-in actions
  const sendCheckIn = async (message: string) => {
    if (!user?.id || !currentCircle?.id) {
      Alert.alert(t('error'), t('notConnectedToCircle'));
      return;
    }

    setIsSendingCheckIn(true);
    try {
      const { error } = await supabase.from('behavior_events').insert({
        user_id: user.id,
        circle_id: currentCircle.id,
        event_type: 'check_in',
        event_data: {
          message,
          latitude: myLocation?.coords.latitude,
          longitude: myLocation?.coords.longitude,
          timestamp: new Date().toISOString(),
        },
      });

      if (error) {
        console.log('Check-in table not available:', error);
      }

      Alert.alert(t('success'), t('familyNotified'));
    } catch (error) {
      Alert.alert(t('success'), t('familyNotified'));
    } finally {
      setIsSendingCheckIn(false);
    }
  };

  const handleArrived = () => sendCheckIn(t('iArrived'));
  const handleNeedPickup = () => sendCheckIn(t('needPickup'));
  const handleAllGood = () => sendCheckIn(t('imOkay'));

  // Safety status
  const getSafetyStatus = () => {
    if (!gpsEnabled) return { status: 'warning', label: t('gpsDisabled'), color: '#FBBF24' };
    if (batteryLevel < 20) return { status: 'warning', label: t('lowBattery'), color: '#FBBF24' };
    if (activeTrip) return { status: 'trip', label: t('inTrip'), color: '#6366F1' };
    return { status: 'safe', label: t('safe'), color: '#10B981' };
  };

  const safetyStatus = getSafetyStatus();

  // If no circle, show Join Circle prompt
  if (!hasCircle) {
    return (
      <View style={styles.container}>
        <View style={[styles.header, { paddingTop: insets.top + 16 }]}>
          <View>
            <Text style={styles.greeting}>{t('hello')}, {userName}!</Text>
          </View>
          <TouchableOpacity 
            style={styles.settingsBtn}
            onPress={() => router.push('/settings')}
          >
            <Ionicons name="settings-outline" size={24} color="#94A3B8" />
          </TouchableOpacity>
        </View>

        <View style={styles.joinCircleContainer}>
          <View style={styles.joinCircleIcon}>
            <Ionicons name="people-circle-outline" size={80} color="#6366F1" />
          </View>
          <Text style={styles.joinCircleTitle}>
            {t('joinYourFamily')}
          </Text>
          <Text style={styles.joinCircleSubtitle}>
            Introdu codul de invitație primit de la un părinte pentru a te alătura cercului familiei.
          </Text>

          {/* Main Join Button - Very Prominent */}
          <TouchableOpacity
            style={styles.joinCircleBtn}
            onPress={() => router.push('/circle/join')}
            activeOpacity={0.8}
          >
            <LinearGradient
              colors={['#10B981', '#059669']}
              style={styles.joinCircleBtnGradient}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
            >
              <Ionicons name="enter-outline" size={28} color="#FFFFFF" />
              <Text style={styles.joinCircleBtnText}>{t('joinFamilyCircle')}</Text>
            </LinearGradient>
          </TouchableOpacity>

          {/* Add Phone Number Button */}
          <TouchableOpacity
            style={styles.addPhoneBtn}
            onPress={() => router.push('/settings/profile')}
            activeOpacity={0.8}
          >
            <Ionicons name="call-outline" size={20} color="#6366F1" />
            <Text style={styles.addPhoneBtnText}>Adaugă număr de telefon</Text>
          </TouchableOpacity>

          <Text style={styles.joinCircleHint}>
            Nu ai un cod? Cere unui părinte să-ți trimită codul de invitație din aplicația lor.
          </Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ScrollView 
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 40 }}
      >
        {/* Header */}
        <View style={[styles.header, { paddingTop: insets.top + 16 }]}>
          <View>
            <Text style={styles.greeting}>{t('hello')}, {userName}!</Text>
            <View style={[styles.statusBadge, { backgroundColor: `${safetyStatus.color}20` }]}>
              <View style={[styles.statusDot, { backgroundColor: safetyStatus.color }]} />
              <Text style={[styles.statusText, { color: safetyStatus.color }]}>
                {safetyStatus.label}
              </Text>
            </View>
          </View>
          <TouchableOpacity 
            style={styles.settingsBtn}
            onPress={() => router.push('/settings')}
          >
            <Ionicons name="settings-outline" size={24} color="#94A3B8" />
          </TouchableOpacity>
        </View>

        {/* SOS Button - Prominent */}
        <View style={styles.sosSection}>
          <TouchableOpacity
            style={styles.sosButton}
            onPress={() => router.push('/sos/active')}
            activeOpacity={0.8}
          >
            <LinearGradient
              colors={['#EF4444', '#DC2626']}
              style={styles.sosGradient}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
            >
              <Ionicons name="alert-circle" size={48} color="#FFFFFF" />
              <Text style={styles.sosText}>SOS</Text>
              <Text style={styles.sosSubtext}>{t('holdForEmergency')}</Text>
            </LinearGradient>
          </TouchableOpacity>
        </View>

        {/* Active Trip Card */}
        {activeTrip && (
          <View style={styles.tripCard}>
            <View style={styles.tripHeader}>
              <View style={styles.tripIconContainer}>
                <Ionicons name="navigate" size={24} color="#6366F1" />
              </View>
              <View style={styles.tripInfo}>
                <Text style={styles.tripTitle}>{t('activeTrip')}</Text>
                <Text style={styles.tripDestination}>
                  {t('destination')}: {activeTrip.destination_place?.name || t('destination')}
                </Text>
              </View>
            </View>
            {activeTrip.expected_arrival_at && (
              <View style={styles.tripEta}>
                <Ionicons name="time-outline" size={16} color="#94A3B8" />
                <Text style={styles.tripEtaText}>
                  {t('eta')}: {new Date(activeTrip.expected_arrival_at).toLocaleTimeString('en-US', {
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </Text>
              </View>
            )}
          </View>
        )}

        {/* Quick Actions */}
        <View style={styles.actionsSection}>
          <Text style={styles.sectionTitle}>{t('quickActions')}</Text>
          <View style={styles.actionsGrid}>
            <TouchableOpacity 
              style={styles.actionButton}
              onPress={handleArrived}
              disabled={isSendingCheckIn}
            >
              <View style={[styles.actionIcon, { backgroundColor: 'rgba(16, 185, 129, 0.15)' }]}>
                <Ionicons name="checkmark-circle" size={28} color="#10B981" />
              </View>
              <Text style={styles.actionText}>{t('iArrived')}</Text>
            </TouchableOpacity>

            <TouchableOpacity 
              style={styles.actionButton}
              onPress={handleNeedPickup}
              disabled={isSendingCheckIn}
            >
              <View style={[styles.actionIcon, { backgroundColor: 'rgba(251, 191, 36, 0.15)' }]}>
                <Ionicons name="car" size={28} color="#FBBF24" />
              </View>
              <Text style={styles.actionText}>{t('needPickup')}</Text>
            </TouchableOpacity>

            <TouchableOpacity 
              style={styles.actionButton}
              onPress={handleAllGood}
              disabled={isSendingCheckIn}
            >
              <View style={[styles.actionIcon, { backgroundColor: 'rgba(99, 102, 241, 0.15)' }]}>
                <Ionicons name="thumbs-up" size={28} color="#6366F1" />
              </View>
              <Text style={styles.actionText}>{t('imOkay')}</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* My Location Map */}
        <View style={styles.mapSection}>
          <Text style={styles.sectionTitle}>{t('myLocation')}</Text>
          <View style={styles.mapContainer}>
            {isLoadingLocation ? (
              <View style={styles.mapLoading}>
                <ActivityIndicator size="large" color="#6366F1" />
                <Text style={styles.mapLoadingText}>{t('gettingLocation')}</Text>
              </View>
            ) : myLocation ? (
              <MapComponent
                latitude={myLocation.coords.latitude}
                longitude={myLocation.coords.longitude}
                markers={[{
                  id: user?.id || '1',
                  name: profile?.name || 'Me',
                  latitude: myLocation.coords.latitude,
                  longitude: myLocation.coords.longitude,
                  status: 'safe',
                }]}
                statusColor="#10B981"
                currentMemberInitial={profile?.name?.[0] || 'M'}
                onMarkerPress={() => {}}
              />
            ) : (
              <View style={styles.mapError}>
                <Ionicons name="location-outline" size={32} color="#64748B" />
                <Text style={styles.mapErrorText}>{t('locationUnavailable')}</Text>
              </View>
            )}
          </View>
          {myAddress ? (
            <View style={styles.addressBar}>
              <Ionicons name="location" size={16} color="#6366F1" />
              <Text style={styles.addressText}>{myAddress}</Text>
            </View>
          ) : null}
        </View>

        {/* Device Status */}
        <View style={styles.deviceSection}>
          <Text style={styles.sectionTitle}>{t('deviceStatus')}</Text>
          <View style={styles.deviceGrid}>
            <View style={styles.deviceItem}>
              <Ionicons 
                name={isCharging ? "battery-charging" : batteryLevel > 20 ? "battery-half" : "battery-dead"} 
                size={24} 
                color={batteryLevel > 20 ? "#10B981" : "#EF4444"} 
              />
              <Text style={styles.deviceValue}>{batteryLevel}%</Text>
              <Text style={styles.deviceLabel}>
                {isCharging ? '⚡ Charging' : t('battery')}
              </Text>
            </View>
            <View style={styles.deviceItem}>
              <Ionicons 
                name={gpsEnabled ? "navigate" : "navigate-outline"} 
                size={24} 
                color={gpsEnabled ? "#10B981" : "#EF4444"} 
              />
              <Text style={styles.deviceValue}>{gpsEnabled ? t('active') : t('disabled')}</Text>
              <Text style={styles.deviceLabel}>{t('gps')}</Text>
            </View>
            <View style={styles.deviceItem}>
              <Ionicons name="wifi" size={24} color="#10B981" />
              <Text style={styles.deviceValue}>{t('online')}</Text>
              <Text style={styles.deviceLabel}>{t('network')}</Text>
            </View>
          </View>
          {lastSendTime ? (
            <Text style={styles.lastSyncText}>
              Ultima sincronizare: {lastSendTime}
            </Text>
          ) : null}
        </View>

        {/* Start Safe Trip Button */}
        {!activeTrip && (
          <TouchableOpacity
            style={styles.startTripButton}
            onPress={() => router.push('/trip/safe')}
          >
            <LinearGradient
              colors={['#6366F1', '#4F46E5']}
              style={styles.startTripGradient}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
            >
              <Ionicons name="navigate" size={24} color="#FFFFFF" />
              <Text style={styles.startTripText}>{t('startSafeTrip')}</Text>
            </LinearGradient>
          </TouchableOpacity>
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
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
  greeting: {
    fontSize: 28,
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: 8,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    gap: 6,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  statusText: {
    fontSize: 14,
    fontWeight: '600',
  },
  settingsBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#1E293B',
    justifyContent: 'center',
    alignItems: 'center',
  },
  // Join Circle Prompt
  joinCircleContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
    paddingBottom: 80,
  },
  joinCircleIcon: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: 'rgba(99, 102, 241, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
  },
  joinCircleTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#FFFFFF',
    textAlign: 'center',
    marginBottom: 12,
  },
  joinCircleSubtitle: {
    fontSize: 15,
    color: '#94A3B8',
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 32,
  },
  joinCircleBtn: {
    width: '100%',
    borderRadius: 16,
    overflow: 'hidden',
    marginBottom: 20,
  },
  joinCircleBtnGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 18,
    gap: 12,
  },
  joinCircleBtnText: {
    fontSize: 17,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  joinCircleHint: {
    fontSize: 13,
    color: '#64748B',
    textAlign: 'center',
    lineHeight: 18,
    paddingHorizontal: 16,
  },
  addPhoneBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(99, 102, 241, 0.1)',
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 20,
    marginBottom: 20,
    gap: 10,
    borderWidth: 1,
    borderColor: 'rgba(99, 102, 241, 0.3)',
  },
  addPhoneBtnText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#6366F1',
  },
  // SOS
  sosSection: {
    paddingHorizontal: 20,
    marginBottom: 24,
  },
  sosButton: {
    borderRadius: 24,
    overflow: 'hidden',
    elevation: 8,
    shadowColor: '#EF4444',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
  },
  sosGradient: {
    paddingVertical: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sosText: {
    fontSize: 36,
    fontWeight: '900',
    color: '#FFFFFF',
    marginTop: 8,
    letterSpacing: 4,
  },
  sosSubtext: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.8)',
    marginTop: 4,
  },
  // Trip
  tripCard: {
    marginHorizontal: 20,
    backgroundColor: '#1E293B',
    borderRadius: 16,
    padding: 16,
    marginBottom: 24,
    borderLeftWidth: 4,
    borderLeftColor: '#6366F1',
  },
  tripHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  tripIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 12,
    backgroundColor: 'rgba(99, 102, 241, 0.15)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  tripInfo: {
    marginLeft: 12,
    flex: 1,
  },
  tripTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  tripDestination: {
    fontSize: 14,
    color: '#94A3B8',
    marginTop: 2,
  },
  tripEta: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 12,
    gap: 6,
  },
  tripEtaText: {
    fontSize: 13,
    color: '#94A3B8',
  },
  // Actions
  actionsSection: {
    paddingHorizontal: 20,
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: 12,
  },
  actionsGrid: {
    flexDirection: 'row',
    gap: 12,
  },
  actionButton: {
    flex: 1,
    backgroundColor: '#1E293B',
    borderRadius: 16,
    padding: 16,
    alignItems: 'center',
  },
  actionIcon: {
    width: 56,
    height: 56,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  actionText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#FFFFFF',
    textAlign: 'center',
  },
  // Map
  mapSection: {
    paddingHorizontal: 20,
    marginBottom: 24,
  },
  mapContainer: {
    height: 200,
    borderRadius: 16,
    overflow: 'hidden',
    backgroundColor: '#1E293B',
  },
  mapLoading: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  mapLoadingText: {
    color: '#94A3B8',
    marginTop: 12,
    fontSize: 14,
  },
  mapError: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  mapErrorText: {
    color: '#64748B',
    marginTop: 8,
    fontSize: 14,
  },
  addressBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1E293B',
    marginTop: 8,
    padding: 12,
    borderRadius: 12,
    gap: 8,
  },
  addressText: {
    flex: 1,
    color: '#E2E8F0',
    fontSize: 14,
  },
  // Device
  deviceSection: {
    paddingHorizontal: 20,
    marginBottom: 24,
  },
  deviceGrid: {
    flexDirection: 'row',
    backgroundColor: '#1E293B',
    borderRadius: 16,
    padding: 16,
    justifyContent: 'space-around',
  },
  deviceItem: {
    alignItems: 'center',
  },
  deviceValue: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
    marginTop: 8,
  },
  deviceLabel: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 2,
  },
  lastSyncText: {
    fontSize: 11,
    color: '#475569',
    textAlign: 'center',
    marginTop: 8,
  },
  // Trip button
  startTripButton: {
    marginHorizontal: 20,
    borderRadius: 16,
    overflow: 'hidden',
  },
  startTripGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 18,
    gap: 10,
  },
  startTripText: {
    fontSize: 17,
    fontWeight: '700',
    color: '#FFFFFF',
  },
});
