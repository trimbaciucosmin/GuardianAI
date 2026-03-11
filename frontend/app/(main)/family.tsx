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
import { useAuthStore, useCircleStore, usePlacesStore } from '../../lib/store';
import { supabase } from '../../lib/supabase';
import { CircleMember, FamilyCircle, Place } from '../../types';
import { getInitials, getAvatarColor, formatRelativeTime, getPlaceIcon, getPlaceColor } from '../../utils/helpers';

export default function FamilyScreen() {
  const router = useRouter();
  const { user, profile } = useAuthStore();
  const { circles, currentCircle, members, setCircles, setCurrentCircle, setMembers } = useCircleStore();
  const { places, setPlaces } = usePlacesStore();
  const [isRefreshing, setIsRefreshing] = useState(false);

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

      // Load members of current circle
      if (currentCircle) {
        const { data: membersData } = await supabase
          .from('circle_members')
          .select(`*, profiles (*)`)
          .eq('circle_id', currentCircle.id);

        if (membersData) {
          setMembers(membersData);
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

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>Family</Text>
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
              <TouchableOpacity style={styles.inviteCard} onPress={copyInviteCode}>
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
                <Text style={styles.sectionTitle}>Members ({members.length})</Text>
              </View>
              <View style={styles.membersList}>
                {members.map((member) => (
                  <View key={member.id} style={styles.memberCard}>
                    <View style={[
                      styles.memberAvatar,
                      { backgroundColor: getAvatarColor(member.user_id) },
                    ]}>
                      <Text style={styles.memberInitials}>
                        {getInitials((member as any).profiles?.name || 'U')}
                      </Text>
                    </View>
                    <View style={styles.memberInfo}>
                      <Text style={styles.memberName}>
                        {(member as any).profiles?.name || 'Unknown'}
                        {member.user_id === user?.id && ' (You)'}
                      </Text>
                      <Text style={styles.memberRole}>{member.role}</Text>
                    </View>
                    <View style={styles.memberStatus}>
                      <View style={styles.statusDot} />
                      <Text style={styles.statusText}>Online</Text>
                    </View>
                  </View>
                ))}
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
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: '#FFFFFF',
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
  memberAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
  },
  memberInitials: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  memberInfo: {
    flex: 1,
    marginLeft: 12,
  },
  memberName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  memberRole: {
    fontSize: 12,
    color: '#64748B',
    textTransform: 'capitalize',
  },
  memberStatus: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#10B981',
  },
  statusText: {
    fontSize: 12,
    color: '#10B981',
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
