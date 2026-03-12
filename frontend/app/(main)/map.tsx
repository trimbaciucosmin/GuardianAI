import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Dimensions,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import MapView, { Marker, PROVIDER_GOOGLE } from 'react-native-maps';
import { useAuthStore, useCircleStore, useLocationStore } from '../../lib/store';
import { supabase } from '../../lib/supabase';

const { width, height } = Dimensions.get('window');

interface FamilyMember {
  id: string;
  user_id: string;
  name: string;
  status: 'safe' | 'moving' | 'alert';
  place: string;
  placeName: string;
  lastSeen: string;
  battery: number;
  isOnline: boolean;
  latitude: number;
  longitude: number;
}

export default function MapScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { profile, user } = useAuthStore();
  const { currentCircle, members } = useCircleStore();
  const { mapMembers, setMapMembers } = useLocationStore();
  
  const [loading, setLoading] = useState(true);
  const [familyMembers, setFamilyMembers] = useState<FamilyMember[]>([]);
  const [selectedMember, setSelectedMember] = useState<FamilyMember | null>(null);
  const [mapRegion, setMapRegion] = useState({
    latitude: 40.7128,
    longitude: -74.0060,
    latitudeDelta: 0.02,
    longitudeDelta: 0.02,
  });

  const userName = profile?.name?.split(' ')[0] || 'there';
  const tabBarHeight = 56 + insets.bottom;

  const fetchFamilyLocations = useCallback(async () => {
    if (!currentCircle || !user) {
      setLoading(false);
      return;
    }

    try {
      // Fetch circle members (without nested join)
      const { data: membersData, error: membersError } = await supabase
        .from('circle_members')
        .select('id, user_id, role')
        .eq('circle_id', currentCircle.id);

      if (membersError) throw membersError;

      const memberIds = membersData?.map(m => m.user_id) || [];

      // Fetch profiles separately
      const { data: profilesData } = await supabase
        .from('profiles')
        .select('user_id, name, avatar_url')
        .in('user_id', memberIds);

      // Fetch live locations
      const { data: locationsData } = await supabase
        .from('live_locations')
        .select('*')
        .eq('circle_id', currentCircle.id);

      // Fetch device status
      const { data: deviceData } = await supabase
        .from('device_status')
        .select('*')
        .in('user_id', memberIds);

      // Combine data
      const formattedMembers: FamilyMember[] = (membersData || []).map((member: any, index: number) => {
        const profile = profilesData?.find((p: any) => p.user_id === member.user_id);
        const location = locationsData?.find((l: any) => l.user_id === member.user_id);
        const device = deviceData?.find((d: any) => d.user_id === member.user_id);
        
        // Default location with slight offset for demo
        const defaultLat = 40.7128 + (index * 0.003);
        const defaultLng = -74.0060 + (index * 0.003);
        
        return {
          id: member.id,
          user_id: member.user_id,
          name: profile?.name || 'Unknown',
          status: 'safe' as const,
          place: 'Current Location',
          placeName: location ? 'Live location' : 'Location pending',
          lastSeen: location?.timestamp ? formatLastSeen(location.timestamp) : 'Recently',
          battery: device?.battery_level || location?.battery_level || 85,
          isOnline: device?.last_seen ? isRecent(device.last_seen) : true,
          latitude: location?.latitude || defaultLat,
          longitude: location?.longitude || defaultLng,
        };
      });

      setFamilyMembers(formattedMembers);
      
      // Set selected member (prefer current user or first member)
      const currentUser = formattedMembers.find(m => m.user_id === user.id);
      const firstOther = formattedMembers.find(m => m.user_id !== user.id);
      setSelectedMember(firstOther || currentUser || formattedMembers[0] || null);

      // Center map on first member
      if (formattedMembers.length > 0) {
        setMapRegion({
          latitude: formattedMembers[0].latitude,
          longitude: formattedMembers[0].longitude,
          latitudeDelta: 0.02,
          longitudeDelta: 0.02,
        });
      }
    } catch (error) {
      console.error('Error fetching locations:', error);
    } finally {
      setLoading(false);
    }
  }, [currentCircle, user]);

  useFocusEffect(
    useCallback(() => {
      fetchFamilyLocations();
    }, [fetchFamilyLocations])
  );

  const formatLastSeen = (timestamp: string): string => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    
    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    return `${Math.floor(diffMins / 60)}h ago`;
  };

  const isRecent = (timestamp: string): boolean => {
    const date = new Date(timestamp);
    const now = new Date();
    return (now.getTime() - date.getTime()) < 5 * 60 * 1000;
  };

  const getStatusConfig = (status: string) => {
    switch (status) {
      case 'safe':
        return { 
          color: '#34D399', 
          bg: 'rgba(52, 211, 153, 0.15)', 
          label: 'Safe',
          message: 'Everything looks good'
        };
      case 'moving':
        return { 
          color: '#FBBF24', 
          bg: 'rgba(251, 191, 36, 0.15)', 
          label: 'On the move',
          message: 'Traveling to destination'
        };
      case 'alert':
        return { 
          color: '#F87171', 
          bg: 'rgba(248, 113, 113, 0.15)', 
          label: 'Needs attention',
          message: 'Check on your family member'
        };
      default:
        return { 
          color: '#94A3B8', 
          bg: 'rgba(148, 163, 184, 0.15)', 
          label: 'Unknown',
          message: 'Location unavailable'
        };
    }
  };

  const statusConfig = selectedMember ? getStatusConfig(selectedMember.status) : getStatusConfig('unknown');

  // No circle state
  if (!loading && !currentCircle) {
    return (
      <View style={styles.container}>
        <View style={styles.noCircleContainer}>
          <View style={styles.noCircleIcon}>
            <Ionicons name="people" size={64} color="#6366F1" />
          </View>
          <Text style={styles.noCircleTitle}>No Family Circle</Text>
          <Text style={styles.noCircleSubtitle}>
            Create or join a family circle to see your family's locations on the map.
          </Text>
          <TouchableOpacity 
            style={styles.createCircleButton}
            onPress={() => router.push('/circle/create')}
          >
            <Text style={styles.createCircleText}>Create Circle</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#6366F1" />
        <Text style={styles.loadingText}>Loading map...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Real Map */}
      <View style={[styles.mapContainer, { paddingBottom: tabBarHeight }]}>
        {Platform.OS === 'web' ? (
          // Web fallback - styled map placeholder
          <View style={styles.webMapFallback}>
            <LinearGradient
              colors={['#0c1929', '#162438', '#1a3045']}
              style={StyleSheet.absoluteFillObject}
            />
            
            {/* Map grid for visual depth */}
            <View style={styles.mapOverlay}>
              <View style={[styles.road, styles.roadH1]} />
              <View style={[styles.road, styles.roadH2]} />
              <View style={[styles.road, styles.roadV1]} />
              <View style={[styles.road, styles.roadV2]} />
            </View>
            
            {/* Member markers on web */}
            {familyMembers.map((member, index) => (
              <TouchableOpacity 
                key={member.id}
                style={[
                  styles.webMarker,
                  { 
                    top: 200 + (index * 60),
                    left: width / 2 - 25 + (index * 30),
                  }
                ]}
                onPress={() => setSelectedMember(member)}
              >
                <View style={[
                  styles.markerBubble,
                  selectedMember?.id === member.id && styles.markerBubbleSelected
                ]}>
                  <Text style={styles.markerInitial}>{member.name[0]}</Text>
                </View>
                <Text style={styles.markerName}>{member.name}</Text>
              </TouchableOpacity>
            ))}
            
            <Text style={styles.webMapNote}>Map available on mobile app</Text>
          </View>
        ) : (
          // Native map
          <MapView
            style={styles.map}
            provider={PROVIDER_GOOGLE}
            region={mapRegion}
            onRegionChangeComplete={setMapRegion}
            customMapStyle={darkMapStyle}
          >
            {familyMembers.map((member) => (
              <Marker
                key={member.id}
                coordinate={{
                  latitude: member.latitude,
                  longitude: member.longitude,
                }}
                onPress={() => setSelectedMember(member)}
              >
                <View style={[
                  styles.customMarker,
                  { borderColor: getStatusConfig(member.status).color }
                ]}>
                  <Text style={styles.markerInitial}>{member.name[0]}</Text>
                </View>
              </Marker>
            ))}
          </MapView>
        )}

        {/* Top Header */}
        <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
          <View style={styles.headerCard}>
            <View style={styles.headerContent}>
              <Text style={styles.greeting}>Hi, {userName}</Text>
              {selectedMember && (
                <View style={[styles.statusPill, { backgroundColor: statusConfig.bg }]}>
                  <View style={[styles.statusDot, { backgroundColor: statusConfig.color }]} />
                  <Text style={[styles.statusText, { color: statusConfig.color }]}>
                    {selectedMember.name} is {statusConfig.label.toLowerCase()}
                  </Text>
                </View>
              )}
            </View>
            <TouchableOpacity 
              style={styles.settingsBtn}
              onPress={() => router.push('/settings')}
            >
              <Ionicons name="settings-outline" size={22} color="#94A3B8" />
            </TouchableOpacity>
          </View>
        </View>

        {/* Selected Member Card */}
        {selectedMember && (
          <View style={styles.childCardContainer}>
            <View style={styles.childCard}>
              <View style={styles.avatarSection}>
                <View style={[styles.avatar, { borderColor: statusConfig.color }]}>
                  <Text style={styles.avatarText}>{selectedMember.name[0]}</Text>
                </View>
                {selectedMember.isOnline && (
                  <View style={styles.onlineBadge} />
                )}
              </View>
              
              <View style={styles.childInfo}>
                <Text style={styles.childName}>{selectedMember.name}</Text>
                <View style={styles.locationRow}>
                  <Ionicons name="location" size={13} color="#94A3B8" />
                  <Text style={styles.locationText}>{selectedMember.placeName}</Text>
                </View>
                <Text style={styles.lastSeen}>Last updated {selectedMember.lastSeen}</Text>
              </View>
              
              <View style={styles.batterySection}>
                <Ionicons 
                  name={selectedMember.battery > 20 ? "battery-half" : "battery-dead"} 
                  size={18} 
                  color={selectedMember.battery > 20 ? "#64748B" : "#F87171"} 
                />
                <Text style={[
                  styles.batteryText,
                  { color: selectedMember.battery > 20 ? "#64748B" : "#F87171" }
                ]}>
                  {selectedMember.battery}%
                </Text>
              </View>
            </View>

            {/* Member selector pills */}
            {familyMembers.length > 1 && (
              <View style={styles.memberPills}>
                {familyMembers.map((member) => (
                  <TouchableOpacity
                    key={member.id}
                    style={[
                      styles.memberPill,
                      selectedMember?.id === member.id && styles.memberPillActive
                    ]}
                    onPress={() => setSelectedMember(member)}
                  >
                    <Text style={[
                      styles.memberPillText,
                      selectedMember?.id === member.id && styles.memberPillTextActive
                    ]}>
                      {member.name}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            )}
          </View>
        )}

        {/* Action Buttons */}
        <View style={[styles.actionsContainer, { bottom: tabBarHeight + 16 }]}>
          {/* Start Safe Trip Button - renamed from "I'm Going Home" */}
          <TouchableOpacity 
            style={styles.tripButton}
            onPress={() => router.push('/trip/active')}
            activeOpacity={0.9}
          >
            <LinearGradient
              colors={['#34D399', '#10B981']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.tripGradient}
            >
              <Ionicons name="navigate" size={22} color="#FFFFFF" />
              <Text style={styles.tripText}>Start Trip Home</Text>
            </LinearGradient>
          </TouchableOpacity>

          {/* SOS Button */}
          <TouchableOpacity 
            style={styles.sosButton}
            onPress={() => router.push('/sos/active')}
            activeOpacity={0.9}
          >
            <LinearGradient
              colors={['#F87171', '#EF4444']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.sosGradient}
            >
              <Ionicons name="alert" size={26} color="#FFFFFF" />
            </LinearGradient>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

// Dark map style for Google Maps
const darkMapStyle = [
  { elementType: 'geometry', stylers: [{ color: '#0F172A' }] },
  { elementType: 'labels.text.stroke', stylers: [{ color: '#0F172A' }] },
  { elementType: 'labels.text.fill', stylers: [{ color: '#64748B' }] },
  { featureType: 'road', elementType: 'geometry', stylers: [{ color: '#1E293B' }] },
  { featureType: 'road', elementType: 'geometry.stroke', stylers: [{ color: '#334155' }] },
  { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#0c1929' }] },
  { featureType: 'poi', elementType: 'geometry', stylers: [{ color: '#1E293B' }] },
  { featureType: 'transit', elementType: 'geometry', stylers: [{ color: '#1E293B' }] },
];

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0B1120',
  },
  loadingContainer: {
    flex: 1,
    backgroundColor: '#0B1120',
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    color: '#94A3B8',
    marginTop: 12,
    fontSize: 14,
  },
  mapContainer: {
    flex: 1,
  },
  map: {
    flex: 1,
  },
  // Web fallback styles
  webMapFallback: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  mapOverlay: {
    ...StyleSheet.absoluteFillObject,
  },
  road: {
    position: 'absolute',
    backgroundColor: 'rgba(71, 85, 105, 0.3)',
  },
  roadH1: { left: 0, right: 0, top: '30%', height: 3 },
  roadH2: { left: 0, right: 0, top: '60%', height: 2 },
  roadV1: { top: 0, bottom: 0, left: '25%', width: 2 },
  roadV2: { top: 0, bottom: 0, right: '30%', width: 3 },
  webMarker: {
    position: 'absolute',
    alignItems: 'center',
  },
  markerBubble: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: '#6366F1',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 3,
    borderColor: '#FFFFFF',
  },
  markerBubbleSelected: {
    backgroundColor: '#34D399',
    transform: [{ scale: 1.1 }],
  },
  markerName: {
    color: '#FFFFFF',
    fontSize: 12,
    marginTop: 4,
    fontWeight: '600',
  },
  webMapNote: {
    position: 'absolute',
    bottom: 100,
    color: '#64748B',
    fontSize: 12,
  },
  // Custom marker for native
  customMarker: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#6366F1',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 3,
  },
  markerInitial: {
    fontSize: 18,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  // No circle state
  noCircleContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  noCircleIcon: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: 'rgba(99, 102, 241, 0.15)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
  },
  noCircleTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: 8,
  },
  noCircleSubtitle: {
    fontSize: 14,
    color: '#94A3B8',
    textAlign: 'center',
    marginBottom: 24,
  },
  createCircleButton: {
    backgroundColor: '#6366F1',
    paddingVertical: 14,
    paddingHorizontal: 32,
    borderRadius: 12,
  },
  createCircleText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  // Header styles
  header: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 16,
  },
  headerCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(15, 23, 42, 0.9)',
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: 'rgba(51, 65, 85, 0.4)',
  },
  headerContent: {
    flex: 1,
    gap: 6,
  },
  greeting: {
    fontSize: 20,
    fontWeight: '600',
    color: '#F1F5F9',
  },
  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 12,
    gap: 6,
  },
  statusDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
  },
  statusText: {
    fontSize: 13,
    fontWeight: '600',
  },
  settingsBtn: {
    width: 42,
    height: 42,
    borderRadius: 12,
    backgroundColor: 'rgba(30, 41, 59, 0.8)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  // Child card styles
  childCardContainer: {
    position: 'absolute',
    top: 130,
    left: 16,
    right: 16,
  },
  childCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(15, 23, 42, 0.95)',
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: 'rgba(51, 65, 85, 0.4)',
  },
  avatarSection: {
    position: 'relative',
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 14,
    backgroundColor: '#334155',
    borderWidth: 2,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: {
    fontSize: 18,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  onlineBadge: {
    position: 'absolute',
    bottom: -2,
    right: -2,
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: '#34D399',
    borderWidth: 2,
    borderColor: '#0F172A',
  },
  childInfo: {
    flex: 1,
    marginLeft: 12,
    gap: 2,
  },
  childName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#F1F5F9',
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  locationText: {
    fontSize: 13,
    color: '#94A3B8',
  },
  lastSeen: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 2,
  },
  batterySection: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(30, 41, 59, 0.8)',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 10,
    gap: 4,
  },
  batteryText: {
    fontSize: 13,
    fontWeight: '600',
  },
  memberPills: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 10,
  },
  memberPill: {
    backgroundColor: 'rgba(30, 41, 59, 0.8)',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
  },
  memberPillActive: {
    backgroundColor: '#6366F1',
  },
  memberPillText: {
    color: '#94A3B8',
    fontSize: 13,
    fontWeight: '500',
  },
  memberPillTextActive: {
    color: '#FFFFFF',
  },
  // Action buttons
  actionsContainer: {
    position: 'absolute',
    left: 16,
    right: 16,
    flexDirection: 'row',
    gap: 12,
  },
  tripButton: {
    flex: 1,
    borderRadius: 16,
    overflow: 'hidden',
    shadowColor: '#10B981',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  tripGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 18,
    gap: 10,
  },
  tripText: {
    fontSize: 17,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  sosButton: {
    width: 62,
    height: 62,
    borderRadius: 16,
    overflow: 'hidden',
    shadowColor: '#EF4444',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
    elevation: 6,
  },
  sosGradient: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
