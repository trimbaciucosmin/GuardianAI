import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Platform,
  Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuthStore, useCircleStore, useLocationStore } from '../../lib/store';

const { width } = Dimensions.get('window');

// Mock data for family members
const mockFamilyMembers = [
  { id: '1', name: 'Emma', role: 'child', status: 'safe', location: 'School', lastSeen: 'Now', battery: 85 },
  { id: '2', name: 'Jake', role: 'child', status: 'moving', location: 'On the way', lastSeen: 'Now', battery: 62 },
];

export default function MapScreen() {
  const router = useRouter();
  const { profile } = useAuthStore();
  const { currentCircle } = useCircleStore();
  const [selectedMember, setSelectedMember] = useState<string | null>(null);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'safe': return '#10B981';
      case 'moving': return '#F59E0B';
      case 'alert': return '#EF4444';
      default: return '#64748B';
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'safe': return 'Safe';
      case 'moving': return 'Moving';
      case 'alert': return 'Alert';
      default: return 'Unknown';
    }
  };

  return (
    <View style={styles.container}>
      {/* Map Placeholder */}
      <View style={styles.mapContainer}>
        <View style={styles.mapPlaceholder}>
          <Ionicons name="map" size={80} color="#6366F1" />
          <Text style={styles.mapText}>Family Map</Text>
          <Text style={styles.mapSubtext}>See where everyone is</Text>
        </View>

        {/* Safety Status Banner */}
        <View style={styles.safetyBanner}>
          <View style={styles.safetyIndicator}>
            <View style={[styles.safetyDot, { backgroundColor: '#10B981' }]} />
            <Text style={styles.safetyText}>Everyone is safe</Text>
          </View>
        </View>
      </View>

      {/* Family Members Cards */}
      <View style={styles.membersSection}>
        <Text style={styles.sectionTitle}>Family</Text>
        <ScrollView 
          horizontal 
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.membersScroll}
        >
          {mockFamilyMembers.map((member) => (
            <TouchableOpacity
              key={member.id}
              style={[
                styles.memberCard,
                selectedMember === member.id && styles.memberCardSelected
              ]}
              onPress={() => setSelectedMember(member.id)}
              data-testid={`member-${member.id}`}
            >
              <View style={styles.memberHeader}>
                <View style={[styles.statusBadge, { backgroundColor: getStatusColor(member.status) }]}>
                  <Text style={styles.statusBadgeText}>{getStatusText(member.status)}</Text>
                </View>
              </View>
              <View style={styles.memberAvatar}>
                <Text style={styles.memberInitial}>{member.name[0]}</Text>
              </View>
              <Text style={styles.memberName}>{member.name}</Text>
              <Text style={styles.memberLocation}>{member.location}</Text>
              <View style={styles.memberFooter}>
                <Ionicons name="battery-half" size={14} color="#64748B" />
                <Text style={styles.memberBattery}>{member.battery}%</Text>
              </View>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {/* Quick Actions */}
      <View style={styles.actionsSection}>
        {/* SOS Button */}
        <TouchableOpacity 
          style={styles.sosButton}
          onPress={() => router.push('/sos/active')}
          data-testid="sos-button"
        >
          <Ionicons name="alert-circle" size={32} color="#FFFFFF" />
          <Text style={styles.sosText}>SOS</Text>
        </TouchableOpacity>

        {/* Going Home Button */}
        <TouchableOpacity 
          style={styles.goingHomeButton}
          onPress={() => router.push('/trip/active')}
          data-testid="going-home-button"
        >
          <Ionicons name="home" size={28} color="#FFFFFF" />
          <Text style={styles.goingHomeText}>I'm Going Home</Text>
        </TouchableOpacity>
      </View>

      {/* Safe Places Quick View */}
      <View style={styles.placesSection}>
        <View style={styles.placeItem}>
          <View style={[styles.placeIcon, { backgroundColor: 'rgba(16, 185, 129, 0.15)' }]}>
            <Ionicons name="home" size={20} color="#10B981" />
          </View>
          <Text style={styles.placeText}>Home</Text>
        </View>
        <View style={styles.placeItem}>
          <View style={[styles.placeIcon, { backgroundColor: 'rgba(99, 102, 241, 0.15)' }]}>
            <Ionicons name="school" size={20} color="#6366F1" />
          </View>
          <Text style={styles.placeText}>School</Text>
        </View>
        <TouchableOpacity style={styles.placeItem}>
          <View style={[styles.placeIcon, { backgroundColor: 'rgba(100, 116, 139, 0.15)' }]}>
            <Ionicons name="add" size={20} color="#64748B" />
          </View>
          <Text style={styles.placeText}>Add</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0F172A',
  },
  mapContainer: {
    flex: 1,
    minHeight: 280,
  },
  mapPlaceholder: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#1E293B',
  },
  mapText: {
    fontSize: 24,
    fontWeight: '700',
    color: '#FFFFFF',
    marginTop: 16,
  },
  mapSubtext: {
    fontSize: 14,
    color: '#94A3B8',
    marginTop: 4,
  },
  safetyBanner: {
    position: 'absolute',
    top: 60,
    left: 16,
    right: 16,
  },
  safetyIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 12,
    gap: 10,
  },
  safetyDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  safetyText: {
    color: '#10B981',
    fontSize: 16,
    fontWeight: '600',
  },
  membersSection: {
    paddingTop: 20,
    paddingBottom: 12,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#FFFFFF',
    paddingHorizontal: 20,
    marginBottom: 12,
  },
  membersScroll: {
    paddingHorizontal: 16,
    gap: 12,
  },
  memberCard: {
    backgroundColor: '#1E293B',
    borderRadius: 16,
    padding: 16,
    width: 140,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: 'transparent',
  },
  memberCardSelected: {
    borderColor: '#6366F1',
  },
  memberHeader: {
    width: '100%',
    alignItems: 'flex-end',
    marginBottom: 8,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  statusBadgeText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '700',
  },
  memberAvatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#6366F1',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 10,
  },
  memberInitial: {
    color: '#FFFFFF',
    fontSize: 24,
    fontWeight: '700',
  },
  memberName: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  memberLocation: {
    color: '#94A3B8',
    fontSize: 12,
    marginBottom: 8,
  },
  memberFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  memberBattery: {
    color: '#64748B',
    fontSize: 12,
  },
  actionsSection: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    gap: 12,
    marginBottom: 16,
  },
  sosButton: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#EF4444',
    justifyContent: 'center',
    alignItems: 'center',
  },
  sosText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
    marginTop: 2,
  },
  goingHomeButton: {
    flex: 1,
    height: 80,
    borderRadius: 16,
    backgroundColor: '#10B981',
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 12,
  },
  goingHomeText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '700',
  },
  placesSection: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 24,
    paddingBottom: 16,
  },
  placeItem: {
    alignItems: 'center',
    gap: 6,
  },
  placeIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  placeText: {
    color: '#94A3B8',
    fontSize: 12,
    fontWeight: '500',
  },
});
