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
import * as Location from 'expo-location';
import * as Battery from 'expo-battery';
import { useAuthStore, useLocationStore, useCircleStore, usePlacesStore, useSOSStore, useTripStore } from '../../lib/store';
import { supabase } from '../../lib/supabase';
import { getInitials, getAvatarColor, getBatteryColor, formatRelativeTime } from '../../utils/helpers';
import { MapMember, Place, LiveLocation } from '../../types';

const { width, height } = Dimensions.get('window');

export default function MapScreen() {
  const router = useRouter();
  const { user, profile } = useAuthStore();
  const { currentCircle, members, setCurrentCircle, setMembers, circles, setCircles } = useCircleStore();
  const { mapMembers, setMapMembers, setMyLocation } = useLocationStore();
  const { places, setPlaces } = usePlacesStore();
  const { myActivesSOS, setMyActiveSOS } = useSOSStore();
  const { myActiveTrip, setMyActiveTrip } = useTripStore();
  
  const [isLoading, setIsLoading] = useState(true);
  const [myCoords, setMyCoords] = useState<{ latitude: number; longitude: number } | null>(null);
  const [batteryLevel, setBatteryLevel] = useState<number>(100);

  // Initial setup
  useEffect(() => {
    setupApp();
  }, []);

  const setupApp = async () => {
    try {
      // Request location permissions
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission Required', 'Location access is needed for Guardian AI to work.');
        setIsLoading(false);
        return;
      }

      // Get current location
      const location = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.High,
      });
      setMyCoords({
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
      });

      // Get battery level
      try {
        const battery = await Battery.getBatteryLevelAsync();
        setBatteryLevel(Math.round(battery * 100));
      } catch (e) {
        // Battery API may not work on web
        setBatteryLevel(100);
      }

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
        <Text style={styles.loadingText}>Loading map...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Map Placeholder for Web */}
      <View style={styles.mapContainer}>
        <View style={styles.mapPlaceholder}>
          <Ionicons name="map" size={64} color="#6366F1" />
          <Text style={styles.mapTitle}>Guardian AI</Text>
          <Text style={styles.mapSubtitle}>
            {Platform.OS === 'web' 
              ? 'Full map available on mobile app' 
              : 'Loading map...'}
          </Text>
          {myCoords && (
            <Text style={styles.coordsText}>
              Your location: {myCoords.latitude.toFixed(4)}, {myCoords.longitude.toFixed(4)}
            </Text>
          )}
        </View>

        {/* Family Members List */}
        {mapMembers.length > 0 && (
          <View style={styles.membersOverlay}>
            <Text style={styles.overlayTitle}>Family Members</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              {mapMembers.map((member) => (
                <View key={member.id} style={styles.memberCard}>
                  <View style={[styles.memberAvatar, { backgroundColor: getAvatarColor(member.user_id) }]}>
                    <Text style={styles.memberInitials}>{getInitials(member.name)}</Text>
                  </View>
                  <Text style={styles.memberName}>{member.name.split(' ')[0]}</Text>
                  <View style={styles.memberStatus}>
                    <View style={[styles.statusDot, { backgroundColor: member.is_online ? '#10B981' : '#64748B' }]} />
                    <Text style={styles.statusText}>{member.is_online ? 'Online' : 'Offline'}</Text>
                  </View>
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
          
          <TouchableOpacity style={styles.settingsButton} onPress={() => router.push('/settings')}>
            <Ionicons name="settings-outline" size={24} color="#FFFFFF" />
          </TouchableOpacity>
        </View>
      </SafeAreaView>

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
        <View style={styles.statusItem}>
          <Ionicons name="battery-half" size={16} color={getBatteryColor(batteryLevel)} />
          <Text style={styles.statusBarText}>{batteryLevel}%</Text>
        </View>
        <View style={styles.statusItem}>
          <Ionicons name="people" size={16} color="#10B981" />
          <Text style={styles.statusBarText}>{mapMembers.length} online</Text>
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
  coordsText: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 16,
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
    minWidth: 80,
  },
  memberAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
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
  settingsButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(30, 41, 59, 0.95)',
    justifyContent: 'center',
    alignItems: 'center',
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
    gap: 24,
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
