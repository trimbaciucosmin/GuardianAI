import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  RefreshControl,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuthStore, useCircleStore, usePlacesStore, useLocationStore, useSOSStore, useTripStore, useRealtimeStore } from '../../lib/store';
import { supabase } from '../../lib/supabase';
import { CircleMember, FamilyCircle, Place, LiveLocation, SOSEvent, MonitoredTrip } from '../../types';
import { getInitials, getAvatarColor, formatRelativeTime, getPlaceIcon, getPlaceColor, getBatteryColor } from '../../utils/helpers';
import { useRealtimeSubscription } from '../../hooks/useRealtimeSubscription';

interface MemberWithStatus extends CircleMember {
  profiles?: {
    name: string;
    avatar_url?: string;
    role: string;
  };
  liveLocation?: LiveLocation;
  activeSOSEvent?: SOSEvent;
  activeTrip?: MonitoredTrip;
}

export default function FamilyScreen() {
  const router = useRouter();
  const { user, profile } = useAuthStore();
  const { circles, currentCircle, members, setCircles, setCurrentCircle, setMembers } = useCircleStore();
  const { places, setPlaces } = usePlacesStore();
  const { mapMembers, updateMapMember } = useLocationStore();
  const { activeSOSEvents, setActiveSOSEvents } = useSOSStore();
  const { activeTrips, setActiveTrips } = useTripStore();
  const { setGlobalSOSEvent } = useRealtimeStore();
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [membersWithStatus, setMembersWithStatus] = useState<MemberWithStatus[]>([]);

  // Realtime subscription
  const {
    isConnected,
    connectionError,
    lastLocationUpdate,
    lastSOSEvent,
    lastTripUpdate,
    lastGeofenceEvent,
  } = useRealtimeSubscription(currentCircle?.id || null);

  // Handle realtime location updates - update member status
  useEffect(() => {
    if (lastLocationUpdate?.data) {
      const loc = lastLocationUpdate.data as LiveLocation;
      const isOnline = new Date().getTime() - new Date(loc.timestamp).getTime() < 5 * 60 * 1000;
      
      // Update member with status
      setMembersWithStatus(prev => prev.map(member => {
        if (member.user_id === loc.user_id) {
          return {
            ...member,
            liveLocation: loc,
          };
        }
        return member;
      }));

      // Also update map members
      updateMapMember(loc.user_id, {
        latitude: loc.latitude,
        longitude: loc.longitude,
        battery_level: loc.battery_level,
        is_moving: loc.is_moving,
        is_online: isOnline,
        last_seen: loc.timestamp,
      });
    }
  }, [lastLocationUpdate]);

  // Handle realtime SOS events
  useEffect(() => {
    if (lastSOSEvent?.data) {
      const sosEvent = lastSOSEvent.data as SOSEvent;
      
      if (sosEvent.status === 'active') {
        // Update member with active SOS
        setMembersWithStatus(prev => prev.map(member => {
          if (member.user_id === sosEvent.user_id) {
            return { ...member, activeSOSEvent: sosEvent };
          }
          return member;
        }));
        
        // Show global SOS if not current user
        if (sosEvent.user_id !== user?.id) {
          const member = members.find(m => m.user_id === sosEvent.user_id);
          const memberName = (member as any)?.profiles?.name || 'Family Member';
          setGlobalSOSEvent(sosEvent, memberName);
        }

        setActiveSOSEvents([sosEvent, ...activeSOSEvents.filter(e => e.id !== sosEvent.id)]);
      } else {
        // Clear SOS from member
        setMembersWithStatus(prev => prev.map(member => {
          if (member.user_id === sosEvent.user_id) {
            return { ...member, activeSOSEvent: undefined };
          }
          return member;
        }));
        setActiveSOSEvents(activeSOSEvents.filter(e => e.id !== sosEvent.id));
      }
    }
  }, [lastSOSEvent]);

  // Handle realtime trip updates
  useEffect(() => {
    if (lastTripUpdate?.data) {
      const trip = lastTripUpdate.data as MonitoredTrip;
      
      if (trip.status === 'active') {
        setMembersWithStatus(prev => prev.map(member => {
          if (member.user_id === trip.user_id) {
            return { ...member, activeTrip: trip };
          }
          return member;
        }));
        setActiveTrips([trip, ...activeTrips.filter(t => t.id !== trip.id)]);
      } else {
        setMembersWithStatus(prev => prev.map(member => {
          if (member.user_id === trip.user_id) {
            return { ...member, activeTrip: undefined };
          }
          return member;
        }));
        setActiveTrips(activeTrips.filter(t => t.id !== trip.id));
      }
    }
  }, [lastTripUpdate]);

  useEffect(() => {
    loadData();
  }, [currentCircle]);

  const loadData = async () => {
    if (!user) return;

    try {
      // Load circles
      const { data: memberData } = await supabase
        .from('circle_members')
        .select(`*, family_circles (*)`)
        .eq('user_id', user.id);

      if (memberData) {
        const userCircles = memberData.map((m: any) => m.family_circles).filter(Boolean);
        setCircles(userCircles);
        
        if (!currentCircle && userCircles.length > 0) {
          setCurrentCircle(userCircles[0]);
        }
      }

      // Load members of current circle with live locations
      if (currentCircle) {
        const { data: membersData } = await supabase
          .from('circle_members')
          .select(`*, profiles (*)`)
          .eq('circle_id', currentCircle.id);

        if (membersData) {
          setMembers(membersData);
          
          // Load live locations for members
          const { data: locationsData } = await supabase
            .from('live_locations')
            .select('*')
            .eq('circle_id', currentCircle.id);

          // Load active SOS events
          const { data: sosData } = await supabase
            .from('sos_events')
            .select('*')
            .eq('circle_id', currentCircle.id)
            .eq('status', 'active');

          // Load active trips
          const { data: tripsData } = await supabase
            .from('monitored_trips')
            .select('*')
            .eq('circle_id', currentCircle.id)
            .eq('status', 'active');

          if (sosData) setActiveSOSEvents(sosData);
          if (tripsData) setActiveTrips(tripsData);

          // Combine member data with live locations and status
          const enrichedMembers = membersData.map((member: any) => {
            const location = locationsData?.find((l: LiveLocation) => l.user_id === member.user_id);
            const sosEvent = sosData?.find((s: SOSEvent) => s.user_id === member.user_id && s.status === 'active');
            const trip = tripsData?.find((t: MonitoredTrip) => t.user_id === member.user_id && t.status === 'active');
            
            return {
              ...member,
              liveLocation: location,
              activeSOSEvent: sosEvent,
              activeTrip: trip,
            } as MemberWithStatus;
          });
          
          setMembersWithStatus(enrichedMembers);
        }

        // Load places
        const { data: placesData } = await supabase
          .from('places')
          .select('*')
          .eq('circle_id', currentCircle.id);

        if (placesData) {
          setPlaces(placesData);
        }
      }
    } catch (error) {
      console.error('Load data error:', error);
    }
  };

  const onRefresh = async () => {
    setIsRefreshing(true);
    await loadData();
    setIsRefreshing(false);
  };

  const copyInviteCode = () => {
    if (currentCircle?.invite_code) {
      Alert.alert('Invite Code', `Share this code with family members:\n\n${currentCircle.invite_code}`, [
        { text: 'OK' }
      ]);
    }
  };

  const getMemberOnlineStatus = (member: MemberWithStatus): { isOnline: boolean; lastSeen: string } => {
    if (member.liveLocation) {
      const lastSeenTime = new Date(member.liveLocation.timestamp).getTime();
      const now = new Date().getTime();
      const isOnline = now - lastSeenTime < 5 * 60 * 1000; // 5 minutes
      return { isOnline, lastSeen: member.liveLocation.timestamp };
    }
    return { isOnline: false, lastSeen: member.joined_at };
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']} data-testid="family-screen">
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Text style={styles.title}>Family</Text>
          {/* Realtime status */}
          <View style={[
            styles.realtimeIndicator,
            { backgroundColor: isConnected ? 'rgba(16, 185, 129, 0.2)' : 'rgba(100, 116, 139, 0.2)' }
          ]}>
            <View style={[
              styles.realtimeDot,
              { backgroundColor: isConnected ? '#10B981' : '#64748B' }
            ]} />
          </View>
        </View>
        <TouchableOpacity style={styles.addButton} onPress={() => router.push('/circle/create')}>
          <Ionicons name="add" size={24} color="#FFFFFF" />
        </TouchableOpacity>
      </View>

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
        {/* Circle Selector */}
        {circles.length > 0 ? (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Your Circles</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.circlesRow}>
              {circles.map((circle) => (
                <TouchableOpacity
                  key={circle.id}
                  style={[
                    styles.circleCard,
                    currentCircle?.id === circle.id && styles.circleCardActive,
                  ]}
                  onPress={() => setCurrentCircle(circle)}
                  data-testid={`circle-${circle.id}`}
                >
                  <View style={styles.circleIcon}>
                    <Ionicons name="shield" size={24} color="#6366F1" />
                  </View>
                  <Text style={styles.circleCardName}>{circle.name}</Text>
                </TouchableOpacity>
              ))}
              <TouchableOpacity
                style={styles.addCircleCard}
                onPress={() => router.push('/circle/join')}
                data-testid="join-circle-btn"
              >
                <Ionicons name="add-circle-outline" size={32} color="#64748B" />
                <Text style={styles.addCircleText}>Join Circle</Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        ) : (
          <View style={styles.emptyState}>
            <View style={styles.emptyIcon}>
              <Ionicons name="people-outline" size={48} color="#64748B" />
            </View>
            <Text style={styles.emptyTitle}>No Family Circle</Text>
            <Text style={styles.emptySubtitle}>Create or join a circle to get started</Text>
            <View style={styles.emptyActions}>
              <TouchableOpacity
                style={styles.createButton}
                onPress={() => router.push('/circle/create')}
                data-testid="create-circle-btn"
              >
                <Ionicons name="add" size={20} color="#FFFFFF" />
                <Text style={styles.createButtonText}>Create Circle</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.joinButton}
                onPress={() => router.push('/circle/join')}
              >
                <Ionicons name="enter-outline" size={20} color="#6366F1" />
                <Text style={styles.joinButtonText}>Join Circle</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* Current Circle Details */}
        {currentCircle && (
          <>
            {/* Invite Code */}
            <View style={styles.section}>
              <TouchableOpacity style={styles.inviteCard} onPress={copyInviteCode} data-testid="invite-code-card">
                <View style={styles.inviteContent}>
                  <Ionicons name="qr-code" size={24} color="#6366F1" />
                  <View style={styles.inviteText}>
                    <Text style={styles.inviteLabel}>Invite Code</Text>
                    <Text style={styles.inviteCode}>{currentCircle.invite_code}</Text>
                  </View>
                </View>
                <Ionicons name="copy-outline" size={20} color="#64748B" />
              </TouchableOpacity>
            </View>

            {/* Members */}
            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionTitle}>Members ({membersWithStatus.length})</Text>
                <Text style={styles.onlineCount}>
                  {membersWithStatus.filter(m => getMemberOnlineStatus(m).isOnline).length} online
                </Text>
              </View>
              <View style={styles.membersList}>
                {membersWithStatus.map((member) => {
                  const { isOnline, lastSeen } = getMemberOnlineStatus(member);
                  const isCurrentUser = member.user_id === user?.id;
                  
                  return (
                    <View key={member.id} style={styles.memberCard} data-testid={`member-${member.user_id}`}>
                      {/* Avatar with status indicators */}
                      <View style={styles.memberAvatarContainer}>
                        <View style={[
                          styles.memberAvatar,
                          { backgroundColor: getAvatarColor(member.user_id) },
                        ]}>
                          <Text style={styles.memberInitials}>
                            {getInitials((member as any).profiles?.name || 'U')}
                          </Text>
                        </View>
                        {/* Online indicator */}
                        <View style={[
                          styles.onlineIndicator,
                          { backgroundColor: isOnline ? '#10B981' : '#64748B' }
                        ]} />
                        {/* SOS indicator */}
                        {member.activeSOSEvent && (
                          <View style={styles.sosIndicator}>
                            <Ionicons name="alert" size={10} color="#FFFFFF" />
                          </View>
                        )}
                      </View>

                      <View style={styles.memberInfo}>
                        <View style={styles.memberNameRow}>
                          <Text style={styles.memberName}>
                            {(member as any).profiles?.name || 'Unknown'}
                            {isCurrentUser && ' (You)'}
                          </Text>
                          {/* Active trip indicator */}
                          {member.activeTrip && (
                            <View style={styles.tripIndicator}>
                              <Ionicons name="navigate" size={10} color="#10B981" />
                              <Text style={styles.tripIndicatorText}>Trip</Text>
                            </View>
                          )}
                        </View>
                        <Text style={styles.memberRole}>{member.role}</Text>
                        
                        {/* Location and status info */}
                        <View style={styles.memberStatusRow}>
                          <View style={[styles.statusBadge, { backgroundColor: isOnline ? 'rgba(16, 185, 129, 0.1)' : 'rgba(100, 116, 139, 0.1)' }]}>
                            <View style={[styles.statusDotSmall, { backgroundColor: isOnline ? '#10B981' : '#64748B' }]} />
                            <Text style={[styles.statusBadgeText, { color: isOnline ? '#10B981' : '#64748B' }]}>
                              {isOnline ? 'Online' : 'Offline'}
                            </Text>
                          </View>
                          <Text style={styles.lastSeenText}>
                            {isOnline ? 'Now' : formatRelativeTime(lastSeen)}
                          </Text>
                        </View>
                      </View>

                      {/* Right side - battery and movement */}
                      <View style={styles.memberRightInfo}>
                        {member.liveLocation?.battery_level !== undefined && (
                          <View style={styles.batteryInfo}>
                            <Ionicons 
                              name="battery-half" 
                              size={14} 
                              color={getBatteryColor(member.liveLocation.battery_level)} 
                            />
                            <Text style={[
                              styles.batteryText, 
                              { color: getBatteryColor(member.liveLocation.battery_level) }
                            ]}>
                              {member.liveLocation.battery_level}%
                            </Text>
                          </View>
                        )}
                        {member.liveLocation?.is_moving && (
                          <View style={styles.movingBadge}>
                            <Ionicons name="walk" size={12} color="#6366F1" />
                          </View>
                        )}
                        {/* SOS Alert Badge */}
                        {member.activeSOSEvent && (
                          <View style={styles.sosAlertBadge}>
                            <Ionicons name="alert" size={12} color="#FFFFFF" />
                            <Text style={styles.sosAlertText}>SOS</Text>
                          </View>
                        )}
                      </View>
                    </View>
                  );
                })}
              </View>
            </View>

            {/* Places */}
            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionTitle}>Places ({places.length})</Text>
                <TouchableOpacity onPress={() => router.push('/place/create')}>
                  <Ionicons name="add-circle" size={24} color="#6366F1" />
                </TouchableOpacity>
              </View>
              {places.length > 0 ? (
                <View style={styles.placesList}>
                  {places.map((place) => (
                    <TouchableOpacity
                      key={place.id}
                      style={styles.placeCard}
                      onPress={() => router.push(`/place/${place.id}`)}
                      data-testid={`place-${place.id}`}
                    >
                      <View style={[
                        styles.placeIcon,
                        { backgroundColor: `${getPlaceColor(place.type)}20` },
                      ]}>
                        <Ionicons
                          name={getPlaceIcon(place.type) as any}
                          size={20}
                          color={getPlaceColor(place.type)}
                        />
                      </View>
                      <View style={styles.placeInfo}>
                        <Text style={styles.placeName}>{place.name}</Text>
                        <Text style={styles.placeAddress}>{place.address || 'No address'}</Text>
                      </View>
                      <Ionicons name="chevron-forward" size={20} color="#64748B" />
                    </TouchableOpacity>
                  ))}
                </View>
              ) : (
                <TouchableOpacity
                  style={styles.addPlaceCard}
                  onPress={() => router.push('/place/create')}
                  data-testid="add-place-btn"
                >
                  <Ionicons name="location-outline" size={24} color="#64748B" />
                  <Text style={styles.addPlaceText}>Add your first place</Text>
                </TouchableOpacity>
              )}
            </View>
          </>
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
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  realtimeIndicator: {
    width: 24,
    height: 24,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  realtimeDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  addButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#1E293B',
    justifyContent: 'center',
    alignItems: 'center',
  },
  content: {
    flex: 1,
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
    fontSize: 16,
    fontWeight: '600',
    color: '#94A3B8',
    marginBottom: 12,
  },
  onlineCount: {
    fontSize: 12,
    color: '#10B981',
    fontWeight: '600',
  },
  circlesRow: {
    flexDirection: 'row',
    marginHorizontal: -20,
    paddingHorizontal: 20,
  },
  circleCard: {
    backgroundColor: '#1E293B',
    borderRadius: 16,
    padding: 16,
    marginRight: 12,
    alignItems: 'center',
    minWidth: 100,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  circleCardActive: {
    borderColor: '#6366F1',
    backgroundColor: 'rgba(99, 102, 241, 0.1)',
  },
  circleIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(99, 102, 241, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  circleCardName: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
  addCircleCard: {
    backgroundColor: 'transparent',
    borderRadius: 16,
    padding: 16,
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 100,
    borderWidth: 2,
    borderColor: '#334155',
    borderStyle: 'dashed',
  },
  addCircleText: {
    color: '#64748B',
    fontSize: 12,
    marginTop: 4,
  },
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 40,
    paddingTop: 60,
  },
  emptyIcon: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: '#1E293B',
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
    marginBottom: 32,
  },
  emptyActions: {
    flexDirection: 'row',
    gap: 12,
  },
  createButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#6366F1',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 12,
    gap: 8,
  },
  createButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
  joinButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1E293B',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 12,
    gap: 8,
  },
  joinButtonText: {
    color: '#6366F1',
    fontSize: 14,
    fontWeight: '600',
  },
  inviteCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#1E293B',
    borderRadius: 12,
    padding: 16,
  },
  inviteContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  inviteText: {
    gap: 2,
  },
  inviteLabel: {
    fontSize: 12,
    color: '#64748B',
  },
  inviteCode: {
    fontSize: 18,
    fontWeight: '700',
    color: '#FFFFFF',
    letterSpacing: 2,
  },
  membersList: {
    gap: 8,
  },
  memberCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1E293B',
    borderRadius: 12,
    padding: 12,
  },
  memberAvatarContainer: {
    position: 'relative',
  },
  memberAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  memberInitials: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '600',
  },
  onlineIndicator: {
    position: 'absolute',
    top: 0,
    right: 0,
    width: 14,
    height: 14,
    borderRadius: 7,
    borderWidth: 2,
    borderColor: '#1E293B',
  },
  sosIndicator: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: '#DC2626',
    justifyContent: 'center',
    alignItems: 'center',
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
  tripIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    gap: 4,
  },
  tripIndicatorText: {
    fontSize: 10,
    color: '#10B981',
    fontWeight: '600',
  },
  memberRole: {
    fontSize: 12,
    color: '#64748B',
    textTransform: 'capitalize',
    marginTop: 2,
  },
  memberStatusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 6,
    gap: 8,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
    gap: 4,
  },
  statusDotSmall: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  statusBadgeText: {
    fontSize: 11,
    fontWeight: '600',
  },
  lastSeenText: {
    fontSize: 11,
    color: '#64748B',
  },
  memberRightInfo: {
    alignItems: 'flex-end',
    gap: 6,
  },
  batteryInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  batteryText: {
    fontSize: 12,
    fontWeight: '600',
  },
  movingBadge: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: 'rgba(99, 102, 241, 0.15)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  sosAlertBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#DC2626',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    gap: 4,
  },
  sosAlertText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '700',
  },
  placesList: {
    gap: 8,
  },
  placeCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1E293B',
    borderRadius: 12,
    padding: 12,
  },
  placeIcon: {
    width: 44,
    height: 44,
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
    fontSize: 12,
    color: '#64748B',
  },
  addPlaceCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'transparent',
    borderRadius: 12,
    padding: 20,
    borderWidth: 2,
    borderColor: '#334155',
    borderStyle: 'dashed',
    gap: 8,
  },
  addPlaceText: {
    fontSize: 14,
    color: '#64748B',
  },
});
