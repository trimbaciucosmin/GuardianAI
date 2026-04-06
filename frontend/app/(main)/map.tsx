import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Dimensions,
  Platform,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import * as Location from 'expo-location';
import { useAuthStore, useCircleStore, useLocationStore } from '../../lib/store';
import { supabase } from '../../lib/supabase';
import { useLanguage } from '../../lib/i18n';

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
  const { t } = useLanguage();
  
  const [loading, setLoading] = useState(true);
  const [loadingTimeout, setLoadingTimeout] = useState(false);
  const [familyMembers, setFamilyMembers] = useState<FamilyMember[]>([]);
  const [showInviteCode, setShowInviteCode] = useState(false);
  const [selectedMember, setSelectedMember] = useState<FamilyMember | null>(null);
  const [myLocation, setMyLocation] = useState<{ latitude: number; longitude: number } | null>(null);
  const [mapRegion, setMapRegion] = useState({
    latitude: 40.7128,
    longitude: -74.0060,
    latitudeDelta: 0.02,
    longitudeDelta: 0.02,
  });

  const userName = profile?.name?.split(' ')[0] || 'there';
  const tabBarHeight = 56 + insets.bottom;
  const [locationError, setLocationError] = useState<string | null>(null);

  // Loading timeout - don't block forever
  useEffect(() => {
    const timeout = setTimeout(() => {
      if (loading) {
        console.log('[MAP] Loading timeout - forcing load complete');
        setLoadingTimeout(true);
        setLoading(false);
      }
    }, 5000); // 5 second timeout

    return () => clearTimeout(timeout);
  }, [loading]);

  // Get current user's real location
  const getCurrentLocation = useCallback(async () => {
    try {
      setLocationError(null);
      
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        setLocationError('Location permission denied. Please enable in settings.');
        console.log('Location permission denied');
        return null;
      }

      const location = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.High,
      });
      
      const coords = {
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
      };
      
      console.log('Got real location:', coords);
      setMyLocation(coords);
      
      // Update map region to center on user's location
      setMapRegion({
        ...coords,
        latitudeDelta: 0.01,
        longitudeDelta: 0.01,
      });

      // Save location to database if we have a circle
      if (currentCircle && user) {
        const { error } = await supabase
          .from('live_locations')
          .upsert({
            user_id: user.id,
            circle_id: currentCircle.id,
            latitude: coords.latitude,
            longitude: coords.longitude,
            accuracy: location.coords.accuracy || 10,
            battery_level: 85,
            is_moving: false,
            timestamp: new Date().toISOString(),
          }, { onConflict: 'user_id,circle_id' });
        
        if (error) {
          console.log('Error saving location:', error);
        } else {
          console.log('Location saved to database');
        }
      }

      return coords;
    } catch (error) {
      console.log('Error getting location:', error);
      setLocationError('Could not get location. Please try again.');
      return null;
    }
  }, [currentCircle, user]);

  // Center map on user's current location
  const centerOnMe = async () => {
    const coords = await getCurrentLocation();
    if (coords) {
      setMapRegion({
        ...coords,
        latitudeDelta: 0.01,
        longitudeDelta: 0.01,
      });
    }
  };

  // Get location on mount
  useEffect(() => {
    getCurrentLocation();
  }, []);

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

      // Combine data - use real location for current user if available
      const formattedMembers: FamilyMember[] = (membersData || []).map((member: any, index: number) => {
        const profile = profilesData?.find((p: any) => p.user_id === member.user_id);
        const location = locationsData?.find((l: any) => l.user_id === member.user_id);
        const device = deviceData?.find((d: any) => d.user_id === member.user_id);
        
        // Use real location for current user, or database location, or default
        const isCurrentUser = member.user_id === user.id;
        const defaultLat = myLocation?.latitude || 40.7128 + (index * 0.003);
        const defaultLng = myLocation?.longitude || -74.0060 + (index * 0.003);
        
        const memberLat = isCurrentUser && myLocation 
          ? myLocation.latitude 
          : (location?.latitude || defaultLat);
        const memberLng = isCurrentUser && myLocation 
          ? myLocation.longitude 
          : (location?.longitude || defaultLng);
        
        return {
          id: member.id,
          user_id: member.user_id,
          name: profile?.name || 'Unknown',
          status: 'safe' as const,
          place: 'Current Location',
          placeName: location || (isCurrentUser && myLocation) ? 'Live location' : 'Location pending',
          lastSeen: location?.timestamp ? formatLastSeen(location.timestamp) : (isCurrentUser ? 'Now' : 'Recently'),
          battery: device?.battery_level || location?.battery_level || 85,
          isOnline: isCurrentUser ? true : (device?.last_seen ? isRecent(device.last_seen) : true),
          latitude: memberLat,
          longitude: memberLng,
        };
      });

      setFamilyMembers(formattedMembers);
      
      // Set selected member (prefer other members over current user)
      const currentUserMember = formattedMembers.find(m => m.user_id === user.id);
      const firstOther = formattedMembers.find(m => m.user_id !== user.id);
      setSelectedMember(firstOther || currentUserMember || formattedMembers[0] || null);

      // Center map on selected member or first member with location
      const memberToCenter = firstOther || currentUserMember || formattedMembers[0];
      if (memberToCenter) {
        setMapRegion({
          latitude: memberToCenter.latitude,
          longitude: memberToCenter.longitude,
          latitudeDelta: 0.02,
          longitudeDelta: 0.02,
        });
      } else if (myLocation) {
        // If no members, center on user's location
        setMapRegion({
          latitude: myLocation.latitude,
          longitude: myLocation.longitude,
          latitudeDelta: 0.02,
          longitudeDelta: 0.02,
        });
      }
    } catch (error) {
      console.error('Error fetching locations:', error);
    } finally {
      setLoading(false);
    }
  }, [currentCircle, user, myLocation]);

  useFocusEffect(
    useCallback(() => {
      getCurrentLocation(); // Refresh location when screen is focused
      fetchFamilyLocations();
    }, [fetchFamilyLocations, getCurrentLocation])
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
    // Consider online if last seen within 15 minutes (phones in background still send data)
    return (now.getTime() - date.getTime()) < 15 * 60 * 1000;
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
        {loadingTimeout && (
          <View style={styles.loadingFallback}>
            <Text style={styles.loadingFallbackText}>Taking longer than expected...</Text>
            <TouchableOpacity 
              style={styles.fallbackButton}
              onPress={() => setLoading(false)}
            >
              <Text style={styles.fallbackButtonText}>Continue Anyway</Text>
            </TouchableOpacity>
            <TouchableOpacity 
              style={styles.fallbackButtonSecondary}
              onPress={() => router.replace('/(main)/family')}
            >
              <Text style={styles.fallbackButtonSecondaryText}>Go to Family</Text>
            </TouchableOpacity>
          </View>
        )}
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
            
            {myLocation && (
              <View style={styles.locationBadge}>
                <Ionicons name="location" size={14} color="#10B981" />
                <Text style={styles.locationBadgeText}>
                  {myLocation.latitude.toFixed(4)}, {myLocation.longitude.toFixed(4)}
                </Text>
              </View>
            )}
            
            <Text style={styles.webMapNote}>Tap the locate button to get your position</Text>
          </View>
        ) : (
          // Native fallback - same styled view for now
          <View style={styles.webMapFallback}>
            <LinearGradient
              colors={['#0c1929', '#162438', '#1a3045']}
              style={StyleSheet.absoluteFillObject}
            />
            <View style={styles.mapOverlay}>
              <View style={[styles.road, styles.roadH1]} />
              <View style={[styles.road, styles.roadH2]} />
              <View style={[styles.road, styles.roadV1]} />
              <View style={[styles.road, styles.roadV2]} />
            </View>
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
            {myLocation && (
              <View style={styles.locationBadge}>
                <Ionicons name="location" size={14} color="#10B981" />
                <Text style={styles.locationBadgeText}>
                  {myLocation.latitude.toFixed(4)}, {myLocation.longitude.toFixed(4)}
                </Text>
              </View>
            )}
          </View>
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

        {/* Selected Member Card - Show when there are other members */}
        {selectedMember && selectedMember.user_id !== user?.id ? (
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
                <Text style={styles.lastSeen}>{t('lastUpdated')} {selectedMember.lastSeen}</Text>
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
            {familyMembers.filter(m => m.user_id !== user?.id).length > 1 && (
              <View style={styles.memberPills}>
                {familyMembers.filter(m => m.user_id !== user?.id).map((member) => (
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
        ) : (
          /* No children card - shown when only the current user is in the circle */
          <View style={styles.childCardContainer}>
            <TouchableOpacity 
              style={styles.noChildCard}
              onPress={() => setShowInviteCode(!showInviteCode)}
              activeOpacity={0.8}
            >
              <View style={styles.noChildIcon}>
                <Ionicons name="person-add-outline" size={32} color="#64748B" />
              </View>
              <View style={styles.noChildInfo}>
                <Text style={styles.noChildTitle}>{t('noChildConnected')}</Text>
                <Text style={styles.noChildSubtitle}>{t('inviteChildHint')}</Text>
              </View>
              <Ionicons name={showInviteCode ? "chevron-up" : "chevron-down"} size={20} color="#64748B" />
            </TouchableOpacity>
            
            {/* Invite Code Section */}
            {showInviteCode && currentCircle?.invite_code && (
              <View style={styles.inviteCodeCard}>
                <Text style={styles.inviteCodeLabel}>{t('inviteCode')}</Text>
                <View style={styles.inviteCodeBox}>
                  <Text style={styles.inviteCodeText}>{currentCircle.invite_code}</Text>
                </View>
                <Text style={styles.inviteCodeHint}>
                  {t('shareInviteCode')}
                </Text>
              </View>
            )}
          </View>
        )}

        {/* Center on Me Button */}
        <TouchableOpacity 
          style={styles.centerButton}
          onPress={centerOnMe}
          activeOpacity={0.8}
        >
          <Ionicons name="locate" size={24} color="#FFFFFF" />
        </TouchableOpacity>

        {/* Location Error Banner */}
        {locationError && (
          <View style={styles.errorBanner}>
            <Ionicons name="warning" size={18} color="#F59E0B" />
            <Text style={styles.errorText}>{locationError}</Text>
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
  // Center on me button
  centerButton: {
    position: 'absolute',
    right: 16,
    top: 240,
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: '#6366F1',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#6366F1',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
    elevation: 6,
  },
  // Error banner
  errorBanner: {
    position: 'absolute',
    top: 300,
    left: 16,
    right: 16,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(245, 158, 11, 0.15)',
    borderRadius: 12,
    padding: 12,
    gap: 10,
  },
  errorText: {
    flex: 1,
    color: '#F59E0B',
    fontSize: 13,
  },
  locationBadge: {
    position: 'absolute',
    top: 140,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(16, 185, 129, 0.2)',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    gap: 6,
  },
  locationBadgeText: {
    color: '#10B981',
    fontSize: 12,
    fontWeight: '500',
  },
  // No child connected card
  noChildCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(15, 23, 42, 0.95)',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(51, 65, 85, 0.4)',
  },
  noChildIcon: {
    width: 48,
    height: 48,
    borderRadius: 14,
    backgroundColor: 'rgba(100, 116, 139, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  noChildInfo: {
    flex: 1,
    marginLeft: 12,
  },
  noChildTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#E2E8F0',
  },
  noChildSubtitle: {
    fontSize: 13,
    color: '#94A3B8',
    marginTop: 2,
  },
  // Invite code card
  inviteCodeCard: {
    marginTop: 12,
    backgroundColor: 'rgba(99, 102, 241, 0.1)',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
  },
  inviteCodeLabel: {
    fontSize: 12,
    color: '#94A3B8',
    fontWeight: '600',
    marginBottom: 8,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  inviteCodeBox: {
    backgroundColor: '#1E293B',
    borderRadius: 8,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderWidth: 2,
    borderColor: '#6366F1',
    borderStyle: 'dashed',
  },
  inviteCodeText: {
    fontSize: 28,
    fontWeight: '700',
    color: '#FFFFFF',
    letterSpacing: 6,
  },
  inviteCodeHint: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 12,
    textAlign: 'center',
  },
  // Loading fallback styles
  loadingFallback: {
    marginTop: 24,
    alignItems: 'center',
  },
  loadingFallbackText: {
    color: '#94A3B8',
    fontSize: 14,
    marginBottom: 16,
  },
  fallbackButton: {
    backgroundColor: '#6366F1',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
    marginBottom: 8,
  },
  fallbackButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  fallbackButtonSecondary: {
    paddingHorizontal: 24,
    paddingVertical: 12,
  },
  fallbackButtonSecondaryText: {
    color: '#6366F1',
    fontSize: 14,
    fontWeight: '500',
  },
});
