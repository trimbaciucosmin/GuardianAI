import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  Platform,
  ActivityIndicator,
  Dimensions,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuthStore, useLocationStore, useCircleStore, usePlacesStore, useSOSStore, useTripStore } from '../../lib/store';
import { supabase } from '../../lib/supabase';
import { getInitials, getAvatarColor, getBatteryColor } from '../../utils/helpers';
import { MapMember } from '../../types';
import { useLocationTracking } from '../../hooks/useLocationTracking';
import TrackingStatusCard from '../../components/TrackingStatusCard';

const { width, height } = Dimensions.get('window');

export default function MapScreen() {
  const router = useRouter();
  const { user, profile } = useAuthStore();
  const { currentCircle, members, setCurrentCircle, setMembers, circles, setCircles } = useCircleStore();
  const { mapMembers, setMapMembers } = useLocationStore();
  const { places, setPlaces } = usePlacesStore();
  
  const [isLoading, setIsLoading] = useState(true);
  const [showTrackingCard, setShowTrackingCard] = useState(false);

  // Use the location tracking hook
  const {
    isTracking,
    isForeground,
    isSOSMode,
    permissionStatus,
    backgroundPermissionStatus,
    lastLocation,
    lastBatteryLevel,
    error: trackingError,
    statusText,
    isBackgroundAvailable,
    backgroundAvailabilityReason,
    startTracking,
    stopTracking,
    requestPermissions,
  } = useLocationTracking(user?.id ?? null, currentCircle?.id ?? null, {
    autoStart: false, // We'll start manually after loading circles
    enableBackground: true,
  });

  // Initial setup
  useEffect(() => {
    setupApp();
  }, []);

  // Auto-start tracking when circle is loaded
  useEffect(() => {
    if (currentCircle && user && !isTracking && permissionStatus !== 'denied') {
      startTracking();
    }
  }, [currentCircle, user]);

  const setupApp = async () => {
    try {
      // Load circles and members
      await loadUserCircles();
      setIsLoading(false);
    } catch (error) {
      console.error('Setup error:', error);
      setIsLoading(false);
    }
  };

  const loadUserCircles = async () => {
    if (!user) return;

    try {
      // Get user's circles
      const { data: memberData, error: memberError } = await supabase
        .from('circle_members')
        .select(`
          *,
          family_circles (*)
        `)
        .eq('user_id', user.id);

      if (memberError) {
        console.error('Error loading circles:', memberError);
        return;
      }

      if (memberData && memberData.length > 0) {
        const userCircles = memberData.map((m: any) => m.family_circles).filter(Boolean);
        setCircles(userCircles);
        
        // Set first circle as current
        if (userCircles.length > 0) {
          setCurrentCircle(userCircles[0]);
          await loadCircleData(userCircles[0].id);
        }
      }
    } catch (error) {
      console.error('Load circles error:', error);
    }
  };

  const loadCircleData = async (circleId: string) => {
    try {
      // Load members with profiles
      const { data: membersData, error: membersError } = await supabase
        .from('circle_members')
        .select(`
          *,
          profiles (*)
        `)
        .eq('circle_id', circleId);

      if (!membersError && membersData) {
        setMembers(membersData);
      }

      // Load places
      const { data: placesData, error: placesError } = await supabase
        .from('places')
        .select('*')
        .eq('circle_id', circleId);

      if (!placesError && placesData) {
        setPlaces(placesData);
      }

      // Load live locations
      const { data: locationsData, error: locationsError } = await supabase
        .from('live_locations')
        .select(`
          *,
          profiles (*)
        `)
        .eq('circle_id', circleId);

      if (!locationsError && locationsData) {
        const mapMembersData: MapMember[] = locationsData.map((loc: any) => ({
          id: loc.id,
          user_id: loc.user_id,
          name: loc.profiles?.name || 'Unknown',
          avatar_url: loc.profiles?.avatar_url,
          role: loc.profiles?.role || 'child',
          latitude: loc.latitude,
          longitude: loc.longitude,
          battery_level: loc.battery_level,
          is_moving: loc.is_moving || false,
          is_online: new Date().getTime() - new Date(loc.timestamp).getTime() < 5 * 60 * 1000,
          last_seen: loc.timestamp,
        }));
        setMapMembers(mapMembersData);
      }
    } catch (error) {
      console.error('Load circle data error:', error);
    }
  };

  const triggerSOS = () => {
    router.push('/sos/active');
  };

  const startTrip = () => {
    router.push('/trip/active');
  };

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#6366F1" />
        <Text style={styles.loadingText}>Loading...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Map Placeholder */}
      <View style={styles.mapContainer}>
        <View style={styles.mapPlaceholder}>
          <Ionicons name="map" size={64} color="#6366F1" />
          <Text style={styles.mapTitle}>Guardian AI</Text>
          <Text style={styles.mapSubtitle}>
            {Platform.OS === 'web' 
              ? 'Full map available on mobile app' 
              : 'Map view'}
          </Text>
          {lastLocation && (
            <View style={styles.locationDisplay}>
              <Ionicons name="location" size={16} color="#10B981" />
              <Text style={styles.coordsText}>
                {lastLocation.latitude.toFixed(4)}, {lastLocation.longitude.toFixed(4)}
              </Text>
            </View>
          )}
        </View>

        {/* Family Members Overlay */}
        {mapMembers.length > 0 && (
          <View style={styles.membersOverlay}>
            <Text style={styles.overlayTitle}>Family Members</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              {mapMembers.map((member) => (
                <View key={member.id} style={styles.memberCard}>
                  <View style={[styles.memberAvatar, { backgroundColor: getAvatarColor(member.user_id) }]}>
                    <Text style={styles.memberInitials}>{getInitials(member.name)}</Text>
                    {member.user_id === user?.id && (
                      <View style={[
                        styles.trackingIndicator,
                        { backgroundColor: isTracking ? '#10B981' : '#64748B' }
                      ]} />
                    )}
                  </View>
                  <Text style={styles.memberName}>
                    {member.name.split(' ')[0]}
                    {member.user_id === user?.id && ' (You)'}
                  </Text>
                  <View style={styles.memberStatus}>
                    <View style={[styles.statusDot, { backgroundColor: member.is_online ? '#10B981' : '#64748B' }]} />
                    <Text style={styles.statusText}>{member.is_online ? 'Online' : 'Offline'}</Text>
                  </View>
                  {member.battery_level && (
                    <View style={styles.batteryRow}>
                      <Ionicons name="battery-half" size={12} color={getBatteryColor(member.battery_level)} />
                      <Text style={[styles.batteryText, { color: getBatteryColor(member.battery_level) }]}>
                        {member.battery_level}%
                      </Text>
                    </View>
                  )}
                </View>
              ))}
            </ScrollView>
          </View>
        )}
      </View>

      {/* Top Header */}
      <SafeAreaView style={styles.header} edges={['top']}>
        <View style={styles.headerContent}>
          <TouchableOpacity style={styles.circleSelector} onPress={() => router.push('/circle/create')}>
            <Ionicons name="shield-checkmark" size={24} color="#6366F1" />
            <Text style={styles.circleName}>{currentCircle?.name || 'No Circle'}</Text>
            <Ionicons name="chevron-down" size={16} color="#94A3B8" />
          </TouchableOpacity>
          
          <View style={styles.headerButtons}>
            {/* Tracking Status Button */}
            <TouchableOpacity 
              style={[
                styles.trackingButton,
                { backgroundColor: isTracking ? 'rgba(16, 185, 129, 0.2)' : 'rgba(100, 116, 139, 0.2)' }
              ]} 
              onPress={() => setShowTrackingCard(!showTrackingCard)}
            >
              <View style={[
                styles.trackingDot,
                { backgroundColor: isTracking ? '#10B981' : '#64748B' }
              ]} />
              <Ionicons 
                name={isTracking ? 'radio' : 'radio-outline'} 
                size={18} 
                color={isTracking ? '#10B981' : '#64748B'} 
              />
            </TouchableOpacity>
            
            <TouchableOpacity style={styles.settingsButton} onPress={() => router.push('/settings')}>
              <Ionicons name="settings-outline" size={24} color="#FFFFFF" />
            </TouchableOpacity>
          </View>
        </View>
      </SafeAreaView>

      {/* Tracking Status Card (Expandable) */}
      {showTrackingCard && (
        <View style={styles.trackingCardContainer}>
          <TrackingStatusCard
            isTracking={isTracking}
            isForeground={isForeground}
            isSOSMode={isSOSMode}
            permissionStatus={permissionStatus}
            backgroundPermissionStatus={backgroundPermissionStatus}
            lastLocation={lastLocation}
            lastBatteryLevel={lastBatteryLevel}
            error={trackingError}
            statusText={statusText}
            isBackgroundAvailable={isBackgroundAvailable}
            backgroundAvailabilityReason={backgroundAvailabilityReason}
            onStartTracking={startTracking}
            onStopTracking={stopTracking}
            onRequestPermissions={requestPermissions}
          />
        </View>
      )}

      {/* Quick Actions */}
      <View style={styles.quickActions}>
        {/* SOS Button */}
        <TouchableOpacity style={styles.sosButton} onPress={triggerSOS}>
          <View style={styles.sosButtonInner}>
            <Ionicons name="alert" size={28} color="#FFFFFF" />
            <Text style={styles.sosText}>SOS</Text>
          </View>
        </TouchableOpacity>

        {/* Trip Button */}
        <TouchableOpacity style={styles.tripButton} onPress={startTrip}>
          <Ionicons name="navigate" size={24} color="#FFFFFF" />
          <Text style={styles.tripText}>I'm Going Home</Text>
        </TouchableOpacity>
      </View>

      {/* Status Bar */}
      <View style={styles.statusBar}>
        <TouchableOpacity 
          style={styles.statusItem}
          onPress={() => setShowTrackingCard(!showTrackingCard)}
        >
          <Ionicons 
            name={isTracking ? 'radio' : 'radio-outline'} 
            size={16} 
            color={isTracking ? '#10B981' : '#64748B'} 
          />
          <Text style={styles.statusBarText}>
            {isTracking 
              ? (isForeground ? 'Sharing' : 'Background') 
              : 'Paused'}
          </Text>
        </TouchableOpacity>
        <View style={styles.statusItem}>
          <Ionicons name="battery-half" size={16} color={getBatteryColor(lastBatteryLevel)} />
          <Text style={styles.statusBarText}>{lastBatteryLevel}%</Text>
        </View>
        <View style={styles.statusItem}>
          <Ionicons name="people" size={16} color="#10B981" />
          <Text style={styles.statusBarText}>{mapMembers.length} members</Text>
        </View>
        {places.length > 0 && (
          <View style={styles.statusItem}>
            <Ionicons name="location" size={16} color="#6366F1" />
            <Text style={styles.statusBarText}>{places.length} places</Text>
          </View>
        )}
      </View>
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
    backgroundColor: '#0F172A',
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    color: '#94A3B8',
    marginTop: 16,
    fontSize: 16,
  },
  mapContainer: {
    flex: 1,
  },
  mapPlaceholder: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#1E293B',
  },
  mapTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#FFFFFF',
    marginTop: 16,
  },
  mapSubtitle: {
    fontSize: 14,
    color: '#94A3B8',
    marginTop: 8,
  },
  locationDisplay: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 16,
    backgroundColor: 'rgba(16, 185, 129, 0.1)',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    gap: 8,
  },
  coordsText: {
    fontSize: 14,
    color: '#10B981',
    fontWeight: '500',
  },
  membersOverlay: {
    position: 'absolute',
    bottom: 200,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(15, 23, 42, 0.95)',
    padding: 16,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
  },
  overlayTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#94A3B8',
    marginBottom: 12,
  },
  memberCard: {
    backgroundColor: '#1E293B',
    borderRadius: 12,
    padding: 12,
    marginRight: 12,
    alignItems: 'center',
    minWidth: 90,
  },
  memberAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
    position: 'relative',
  },
  trackingIndicator: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 12,
    height: 12,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: '#1E293B',
  },
  memberInitials: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  memberName: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '500',
    marginBottom: 4,
    textAlign: 'center',
  },
  memberStatus: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  statusText: {
    color: '#64748B',
    fontSize: 10,
  },
  batteryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 4,
  },
  batteryText: {
    fontSize: 10,
    fontWeight: '500',
  },
  header: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
  },
  headerContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  circleSelector: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(30, 41, 59, 0.95)',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 8,
  },
  circleName: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  headerButtons: {
    flexDirection: 'row',
    gap: 8,
  },
  trackingButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
  },
  trackingDot: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  settingsButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(30, 41, 59, 0.95)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  trackingCardContainer: {
    position: 'absolute',
    top: 110,
    left: 16,
    right: 16,
    zIndex: 10,
  },
  quickActions: {
    position: 'absolute',
    bottom: 100,
    left: 16,
    right: 16,
    flexDirection: 'row',
    gap: 12,
  },
  sosButton: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: '#DC2626',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#DC2626',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
    elevation: 8,
  },
  sosButtonInner: {
    alignItems: 'center',
  },
  sosText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '700',
    marginTop: 2,
  },
  tripButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#10B981',
    borderRadius: 36,
    paddingHorizontal: 24,
    gap: 10,
    shadowColor: '#10B981',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  tripText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  statusBar: {
    position: 'absolute',
    bottom: 180,
    left: 16,
    right: 16,
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 16,
    flexWrap: 'wrap',
  },
  statusItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(30, 41, 59, 0.9)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  statusBarText: {
    color: '#94A3B8',
    fontSize: 12,
    fontWeight: '500',
  },
});
