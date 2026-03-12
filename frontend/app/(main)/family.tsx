import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Alert,
  ActivityIndicator,
  RefreshControl,
  Share,
} from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { useRouter, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { supabase } from '../../lib/supabase';
import { useAuthStore, useCircleStore, usePlacesStore } from '../../lib/store';

interface MemberWithDetails {
  id: string;
  user_id: string;
  role: string;
  joined_at: string;
  profile?: {
    name: string;
    avatar_url: string | null;
    phone: string | null;
  };
  device_status?: {
    battery_level: number | null;
    last_seen: string | null;
    is_charging: boolean;
    gps_enabled: boolean;
  };
  live_location?: {
    latitude: number;
    longitude: number;
    timestamp: string;
  };
  current_place?: string;
  is_online: boolean;
}

interface Place {
  id: string;
  name: string;
  type: string;
  address: string | null;
}

export default function FamilyScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user, profile, setUser, setProfile } = useAuthStore();
  const { circles, currentCircle, setCircles, setCurrentCircle, setMembers } = useCircleStore();
  const { places, setPlaces } = usePlacesStore();
  
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [members, setLocalMembers] = useState<MemberWithDetails[]>([]);
  const [localPlaces, setLocalPlaces] = useState<Place[]>([]);
  
  const tabBarHeight = 60 + insets.bottom;

  const formatLastSeen = (timestamp: string | null | undefined): string => {
    if (!timestamp) return 'Unknown';
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    
    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours}h ago`;
    return date.toLocaleDateString();
  };

  const isOnline = (lastSeen: string | null | undefined): boolean => {
    if (!lastSeen) return false;
    const date = new Date(lastSeen);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    return diffMs < 5 * 60 * 1000; // Online if seen in last 5 minutes
  };

  const getPlaceFromCoords = (lat: number | undefined, lng: number | undefined): string => {
    // In a real app, this would reverse geocode or check against saved places
    if (!lat || !lng) return 'Unknown location';
    // For now, return a placeholder - would match against localPlaces
    return 'Current location';
  };

  const fetchCircleData = useCallback(async () => {
    if (!user) return;
    
    try {
      // Fetch user's circle memberships
      const { data: membershipData, error: circlesError } = await supabase
        .from('circle_members')
        .select('circle_id, role')
        .eq('user_id', user.id);

      if (circlesError) {
        console.error('Error fetching circles:', circlesError);
        return;
      }

      if (membershipData && membershipData.length > 0) {
        // Fetch the actual circle details
        const circleIds = membershipData.map((m: any) => m.circle_id);
        const { data: circlesData } = await supabase
          .from('family_circles')
          .select('id, name, invite_code, created_by, created_at')
          .in('id', circleIds);

        const circlesList = circlesData || [];
        setCircles(circlesList);
        
        // Use first circle as current if none selected
        const activeCircle = currentCircle || circlesList[0];
        if (activeCircle) {
          setCurrentCircle(activeCircle);
          
          // Fetch members (without nested profiles join)
          const { data: membersData, error: membersError } = await supabase
            .from('circle_members')
            .select('id, user_id, role, joined_at')
            .eq('circle_id', activeCircle.id);

          if (!membersError && membersData) {
            const memberIds = membersData.map((m: any) => m.user_id);
            
            // Fetch profiles separately
            const { data: profilesData } = await supabase
              .from('profiles')
              .select('user_id, name, avatar_url, phone')
              .in('user_id', memberIds);

            // Fetch device status and locations for each member
            const { data: deviceData } = await supabase
              .from('device_status')
              .select('*')
              .in('user_id', memberIds);

            const { data: locationData } = await supabase
              .from('live_locations')
              .select('*')
              .eq('circle_id', activeCircle.id);

            const formattedMembers: MemberWithDetails[] = membersData.map((m: any) => {
              const profile = profilesData?.find((p: any) => p.user_id === m.user_id);
              const device = deviceData?.find((d: any) => d.user_id === m.user_id);
              const location = locationData?.find((l: any) => l.user_id === m.user_id);
              const lastSeenTime = device?.last_seen || location?.timestamp;
              
              return {
                ...m,
                profile: profile ? {
                  name: profile.name,
                  avatar_url: profile.avatar_url,
                  phone: profile.phone,
                } : undefined,
                device_status: device ? {
                  battery_level: device.battery_level,
                  last_seen: device.last_seen,
                  is_charging: device.is_charging,
                  gps_enabled: device.gps_enabled,
                } : undefined,
                live_location: location ? {
                  latitude: location.latitude,
                  longitude: location.longitude,
                  timestamp: location.timestamp,
                } : undefined,
                current_place: getPlaceFromCoords(location?.latitude, location?.longitude),
                is_online: isOnline(lastSeenTime),
              };
            });
            
            setLocalMembers(formattedMembers);
            setMembers(formattedMembers);
          }

          // Fetch places
          const { data: placesData, error: placesError } = await supabase
            .from('places')
            .select('*')
            .eq('circle_id', activeCircle.id);

          if (!placesError && placesData) {
            setLocalPlaces(placesData);
            setPlaces(placesData);
          }
        }
      } else {
        setCircles([]);
        setCurrentCircle(null);
        setLocalMembers([]);
        setLocalPlaces([]);
      }
    } catch (error) {
      console.error('Error fetching circle data:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [user, currentCircle]);

  useFocusEffect(
    useCallback(() => {
      fetchCircleData();
    }, [fetchCircleData])
  );

  const onRefresh = () => {
    setRefreshing(true);
    fetchCircleData();
  };

  const handleLogout = async () => {
    Alert.alert(
      'Sign Out',
      'Are you sure you want to sign out?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Sign Out',
          style: 'destructive',
          onPress: async () => {
            await supabase.auth.signOut();
            setUser(null);
            setProfile(null);
            router.replace('/(auth)/login');
          }
        }
      ]
    );
  };

  const copyInviteCode = async () => {
    if (currentCircle?.invite_code) {
      const appUrl = 'https://guardian-mobile-app.preview.emergentagent.com';
      const inviteMessage = `Join my Family Circle on Guardian AI!

Open this link in your browser:
${appUrl}

Then:
1. Tap "Create Account" 
2. Sign up with your email
3. After signing in, go to Family tab
4. Tap "Join Circle"
5. Enter code: ${currentCircle.invite_code}

This app lets us share locations and stay safe!`;

      try {
        // Copy to clipboard
        await Clipboard.setStringAsync(inviteMessage);
        
        // Show options to share or just confirm copy
        Alert.alert(
          'Copied!',
          `Invitation with code ${currentCircle.invite_code} copied!\n\nTap "Share Now" to send via WhatsApp, SMS, etc.`,
          [
            { text: 'OK', style: 'cancel' },
            { 
              text: 'Share Now', 
              onPress: async () => {
                try {
                  await Share.share({
                    message: inviteMessage,
                  });
                } catch (e) {
                  console.error('Share error:', e);
                }
              }
            },
          ]
        );
      } catch (error) {
        // Fallback if clipboard fails
        Alert.alert(
          'Invite Code',
          `Code: ${currentCircle.invite_code}\n\nApp: ${appUrl}\n\nShare this with family members.`,
          [{ text: 'OK' }]
        );
      }
    }
  };

  // No circle - show create/join options
  if (!loading && !currentCircle) {
    return (
      <View style={styles.container}>
        <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
          <Text style={styles.title}>Family</Text>
          <TouchableOpacity style={styles.settingsButton} onPress={() => router.push('/settings')}>
            <Ionicons name="settings-outline" size={24} color="#94A3B8" />
          </TouchableOpacity>
        </View>

        <View style={styles.emptyState}>
          <View style={styles.emptyIcon}>
            <Ionicons name="people" size={64} color="#6366F1" />
          </View>
          <Text style={styles.emptyTitle}>No Family Circle Yet</Text>
          <Text style={styles.emptySubtitle}>
            Create a new circle or join an existing one to start sharing locations with your family.
          </Text>

          <TouchableOpacity
            style={styles.primaryButton}
            onPress={() => router.push('/circle/create')}
          >
            <Ionicons name="add-circle" size={22} color="#FFFFFF" />
            <Text style={styles.primaryButtonText}>Create Circle</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.secondaryButton}
            onPress={() => router.push('/circle/join')}
          >
            <Ionicons name="enter" size={22} color="#6366F1" />
            <Text style={styles.secondaryButtonText}>Join Circle</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.logoutButtonSmall} onPress={handleLogout}>
            <Ionicons name="log-out" size={18} color="#EF4444" />
            <Text style={styles.logoutTextSmall}>Sign Out</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#6366F1" />
        <Text style={styles.loadingText}>Loading family data...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <Text style={styles.title}>Family</Text>
        <TouchableOpacity style={styles.settingsButton} onPress={() => router.push('/settings')}>
          <Ionicons name="settings-outline" size={24} color="#94A3B8" />
        </TouchableOpacity>
      </View>

      <ScrollView 
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: tabBarHeight + 16 }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor="#6366F1"
            colors={['#6366F1']}
          />
        }
      >
        {/* Family Card */}
        <View style={styles.familyCard}>
          <View style={styles.familyHeader}>
            <View style={styles.familyIcon}>
              <Ionicons name="shield-checkmark" size={32} color="#6366F1" />
            </View>
            <View style={styles.familyInfo}>
              <Text style={styles.familyName}>{currentCircle?.name || 'Family Circle'}</Text>
              <Text style={styles.familyCount}>{members.length} member{members.length !== 1 ? 's' : ''}</Text>
            </View>
          </View>
          
          {/* Incomplete circle warning */}
          {members.length < 2 && (
            <View style={styles.warningBanner}>
              <Ionicons name="warning" size={18} color="#F59E0B" />
              <Text style={styles.warningText}>Add family members to unlock all features</Text>
            </View>
          )}
          
          {/* Invite Button */}
          <TouchableOpacity style={styles.inviteButton} onPress={copyInviteCode}>
            <Ionicons name="person-add" size={20} color="#6366F1" />
            <Text style={styles.inviteText}>Invite Family Member</Text>
          </TouchableOpacity>
        </View>

        {/* Members Section - Enhanced with details */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Members</Text>
          {members.length === 0 ? (
            <View style={styles.emptyCard}>
              <Text style={styles.emptyCardText}>No members yet. Invite your family!</Text>
            </View>
          ) : (
            members.map((member) => (
              <TouchableOpacity key={member.id} style={styles.memberCard}>
                <View style={styles.memberAvatar}>
                  <Text style={styles.memberInitial}>
                    {member.profile?.name?.[0]?.toUpperCase() || '?'}
                  </Text>
                  <View style={[
                    styles.statusDot, 
                    { backgroundColor: member.is_online ? '#10B981' : '#64748B' }
                  ]} />
                </View>
                
                <View style={styles.memberInfo}>
                  <View style={styles.memberNameRow}>
                    <Text style={styles.memberName}>
                      {member.profile?.name || 'Unknown'}
                      {member.user_id === user?.id ? ' (You)' : ''}
                    </Text>
                    {member.user_id === currentCircle?.created_by && (
                      <View style={styles.adminBadge}>
                        <Text style={styles.adminText}>Admin</Text>
                      </View>
                    )}
                  </View>
                  
                  {/* Location and Last Seen */}
                  <View style={styles.memberDetails}>
                    <View style={styles.detailRow}>
                      <Ionicons name="location" size={12} color="#64748B" />
                      <Text style={styles.detailText}>
                        {member.current_place || 'Location unknown'}
                      </Text>
                    </View>
                    <View style={styles.detailRow}>
                      <Ionicons name="time" size={12} color="#64748B" />
                      <Text style={styles.detailText}>
                        {member.is_online ? 'Online now' : formatLastSeen(member.device_status?.last_seen || member.live_location?.timestamp)}
                      </Text>
                    </View>
                  </View>
                </View>
                
                {/* Battery and Status */}
                <View style={styles.memberStatus}>
                  {member.device_status?.battery_level !== undefined && member.device_status?.battery_level !== null ? (
                    <View style={styles.batteryIndicator}>
                      <Ionicons 
                        name={member.device_status.battery_level > 20 ? "battery-half" : "battery-dead"} 
                        size={16} 
                        color={member.device_status.battery_level > 20 ? "#64748B" : "#EF4444"} 
                      />
                      <Text style={[
                        styles.batteryText,
                        { color: member.device_status.battery_level > 20 ? '#64748B' : '#EF4444' }
                      ]}>
                        {member.device_status.battery_level}%
                      </Text>
                    </View>
                  ) : (
                    <View style={styles.noBattery}>
                      <Ionicons name="battery-dead" size={16} color="#475569" />
                    </View>
                  )}
                </View>
              </TouchableOpacity>
            ))
          )}
        </View>

        {/* Safe Places Section */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Safe Places</Text>
            <TouchableOpacity style={styles.addButton} onPress={() => router.push('/place/create')}>
              <Ionicons name="add-circle" size={24} color="#6366F1" />
            </TouchableOpacity>
          </View>
          {localPlaces.length === 0 ? (
            <View style={styles.emptyCard}>
              <Text style={styles.emptyCardText}>No places added yet. Add your home, school, etc.</Text>
            </View>
          ) : (
            localPlaces.map((place) => (
              <TouchableOpacity key={place.id} style={styles.placeCard}>
                <View style={[
                  styles.placeIcon,
                  { backgroundColor: place.type === 'home' ? 'rgba(16, 185, 129, 0.15)' : 'rgba(99, 102, 241, 0.15)' }
                ]}>
                  <Ionicons 
                    name={place.type === 'home' ? 'home' : place.type === 'school' ? 'school' : 'location'} 
                    size={22} 
                    color={place.type === 'home' ? '#10B981' : '#6366F1'} 
                  />
                </View>
                <View style={styles.placeInfo}>
                  <Text style={styles.placeName}>{place.name}</Text>
                  <Text style={styles.placeAddress}>{place.address || 'No address'}</Text>
                </View>
                <Ionicons name="chevron-forward" size={20} color="#64748B" />
              </TouchableOpacity>
            ))
          )}
        </View>

        {/* Quick Settings */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Settings</Text>
          
          <TouchableOpacity style={styles.settingCard}>
            <View style={[styles.settingIcon, { backgroundColor: 'rgba(99, 102, 241, 0.15)' }]}>
              <Ionicons name="notifications" size={22} color="#6366F1" />
            </View>
            <View style={styles.settingInfo}>
              <Text style={styles.settingName}>Notifications</Text>
              <Text style={styles.settingDescription}>Manage alert preferences</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color="#64748B" />
          </TouchableOpacity>

          <TouchableOpacity style={styles.settingCard}>
            <View style={[styles.settingIcon, { backgroundColor: 'rgba(16, 185, 129, 0.15)' }]}>
              <Ionicons name="shield" size={22} color="#10B981" />
            </View>
            <View style={styles.settingInfo}>
              <Text style={styles.settingName}>Privacy</Text>
              <Text style={styles.settingDescription}>Location sharing settings</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color="#64748B" />
          </TouchableOpacity>
        </View>

        {/* Logout Button */}
        <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
          <Ionicons name="log-out" size={22} color="#EF4444" />
          <Text style={styles.logoutText}>Sign Out</Text>
        </TouchableOpacity>

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
  loadingContainer: {
    flex: 1,
    backgroundColor: '#0F172A',
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    color: '#94A3B8',
    fontSize: 14,
    marginTop: 12,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 16,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  settingsButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#1E293B',
    justifyContent: 'center',
    alignItems: 'center',
  },
  // Empty state styles
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  emptyIcon: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: 'rgba(99, 102, 241, 0.15)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
  },
  emptyTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 14,
    color: '#94A3B8',
    textAlign: 'center',
    marginBottom: 32,
    paddingHorizontal: 24,
  },
  primaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#6366F1',
    borderRadius: 12,
    paddingVertical: 16,
    paddingHorizontal: 32,
    gap: 10,
    width: '100%',
    marginBottom: 12,
  },
  primaryButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  secondaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(99, 102, 241, 0.15)',
    borderRadius: 12,
    paddingVertical: 16,
    paddingHorizontal: 32,
    gap: 10,
    width: '100%',
    marginBottom: 24,
  },
  secondaryButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#6366F1',
  },
  logoutButtonSmall: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 16,
  },
  logoutTextSmall: {
    fontSize: 14,
    color: '#EF4444',
  },
  // Family card styles
  familyCard: {
    backgroundColor: '#1E293B',
    marginHorizontal: 20,
    borderRadius: 20,
    padding: 20,
    marginBottom: 24,
  },
  familyHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  familyIcon: {
    width: 56,
    height: 56,
    borderRadius: 16,
    backgroundColor: 'rgba(99, 102, 241, 0.15)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  familyInfo: {
    marginLeft: 16,
  },
  familyName: {
    fontSize: 20,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  familyCount: {
    fontSize: 14,
    color: '#94A3B8',
    marginTop: 2,
  },
  warningBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(245, 158, 11, 0.1)',
    borderRadius: 10,
    padding: 12,
    gap: 10,
    marginBottom: 12,
  },
  warningText: {
    flex: 1,
    fontSize: 13,
    color: '#F59E0B',
  },
  inviteButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(99, 102, 241, 0.15)',
    borderRadius: 12,
    paddingVertical: 14,
    gap: 10,
  },
  inviteText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#6366F1',
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
    marginBottom: 12,
  },
  emptyCard: {
    backgroundColor: '#1E293B',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
  },
  emptyCardText: {
    color: '#64748B',
    fontSize: 14,
  },
  memberCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1E293B',
    borderRadius: 12,
    padding: 12,
    marginBottom: 8,
  },
  memberAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#6366F1',
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
  },
  memberInitial: {
    color: '#FFFFFF',
    fontSize: 20,
    fontWeight: '700',
  },
  statusDot: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 14,
    height: 14,
    borderRadius: 7,
    borderWidth: 2,
    borderColor: '#1E293B',
  },
  memberInfo: {
    flex: 1,
    marginLeft: 12,
  },
  memberNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  memberName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  adminBadge: {
    backgroundColor: 'rgba(99, 102, 241, 0.15)',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
  },
  adminText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#6366F1',
  },
  memberDetails: {
    marginTop: 4,
    gap: 2,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  detailText: {
    fontSize: 12,
    color: '#64748B',
  },
  memberStatus: {
    alignItems: 'flex-end',
  },
  batteryIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(30, 41, 59, 0.8)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    gap: 4,
  },
  batteryText: {
    fontSize: 12,
    fontWeight: '600',
  },
  noBattery: {
    opacity: 0.5,
  },
  placeCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1E293B',
    borderRadius: 12,
    padding: 12,
    marginBottom: 8,
  },
  placeIcon: {
    width: 48,
    height: 48,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  placeInfo: {
    flex: 1,
    marginLeft: 12,
  },
  placeName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  placeAddress: {
    fontSize: 13,
    color: '#94A3B8',
    marginTop: 2,
  },
  settingCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1E293B',
    borderRadius: 12,
    padding: 12,
    marginBottom: 8,
  },
  settingIcon: {
    width: 44,
    height: 44,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  settingInfo: {
    flex: 1,
    marginLeft: 12,
  },
  settingName: {
    fontSize: 15,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  settingDescription: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 2,
  },
  logoutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
    marginHorizontal: 20,
    borderRadius: 12,
    paddingVertical: 16,
    gap: 10,
  },
  logoutText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#EF4444',
  },
});
