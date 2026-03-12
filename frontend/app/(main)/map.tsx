import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Dimensions,
  Platform,
  Image,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { useAuthStore } from '../../lib/store';

const { width, height } = Dimensions.get('window');

// Mock child data - will be replaced with real data
const mockChildren = [
  { 
    id: '1', 
    name: 'Emma', 
    status: 'safe', 
    place: 'School',
    placeName: 'Oak Elementary School',
    lastSeen: '2 min ago', 
    battery: 85,
    isOnline: true,
    lat: 37.7749,
    lng: -122.4194,
  },
];

export default function MapScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { profile } = useAuthStore();
  const [selectedChild, setSelectedChild] = useState(mockChildren[0]);

  const userName = profile?.name?.split(' ')[0] || 'there';
  const tabBarHeight = 56 + insets.bottom;

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
          message: 'Check on your child'
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

  const statusConfig = getStatusConfig(selectedChild.status);

  // Static map URL (OpenStreetMap tiles via a static image service)
  const mapUrl = `https://api.mapbox.com/styles/v1/mapbox/dark-v11/static/${selectedChild.lng},${selectedChild.lat},14,0/400x600@2x?access_token=pk.eyJ1IjoibWFwYm94IiwiYSI6ImNpejY4NXVycTA2emYycXBndHRqcmZ3N3gifQ.rJcFIG214AriISLbB6B5aw`;
  
  // Fallback static map for when Mapbox isn't available
  const fallbackMapUrl = `https://maps.geoapify.com/v1/staticmap?style=dark-matter&width=600&height=800&center=lonlat:${selectedChild.lng},${selectedChild.lat}&zoom=14&apiKey=demo`;

  return (
    <View style={styles.container}>
      {/* Map Background with Real Map Image */}
      <View style={[styles.mapContainer, { paddingBottom: tabBarHeight }]}>
        {/* Real Map Background */}
        <View style={styles.mapBackground}>
          {/* Dark map-style gradient background as fallback */}
          <LinearGradient
            colors={['#0c1929', '#162438', '#1a3045']}
            style={StyleSheet.absoluteFillObject}
          />
          
          {/* Map grid for visual depth */}
          <View style={styles.mapOverlay}>
            {/* Simulated roads */}
            <View style={[styles.road, styles.roadH1]} />
            <View style={[styles.road, styles.roadH2]} />
            <View style={[styles.road, styles.roadV1]} />
            <View style={[styles.road, styles.roadV2]} />
            <View style={[styles.road, styles.roadD1]} />
          </View>
          
          {/* Child Location Marker */}
          <View style={styles.markerContainer}>
            {/* Pulse animation rings */}
            <View style={[styles.pulseRing, styles.pulseRing3, { borderColor: statusConfig.color }]} />
            <View style={[styles.pulseRing, styles.pulseRing2, { borderColor: statusConfig.color }]} />
            <View style={[styles.pulseRing, styles.pulseRing1, { borderColor: statusConfig.color }]} />
            
            {/* Main marker */}
            <View style={[styles.marker, { backgroundColor: statusConfig.color }]}>
              <Text style={styles.markerInitial}>{selectedChild.name[0]}</Text>
            </View>
          </View>
          
          {/* Place label below marker */}
          <View style={styles.placeLabel}>
            <Ionicons name="location" size={14} color={statusConfig.color} />
            <Text style={styles.placeLabelText}>{selectedChild.place}</Text>
          </View>
        </View>

        {/* Top Header */}
        <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
          <View style={styles.headerCard}>
            <View style={styles.headerContent}>
              <Text style={styles.greeting}>Hi, {userName}</Text>
              <View style={[styles.statusPill, { backgroundColor: statusConfig.bg }]}>
                <View style={[styles.statusDot, { backgroundColor: statusConfig.color }]} />
                <Text style={[styles.statusText, { color: statusConfig.color }]}>
                  {selectedChild.name} is {statusConfig.label.toLowerCase()}
                </Text>
              </View>
            </View>
            <TouchableOpacity 
              style={styles.settingsBtn}
              onPress={() => router.push('/settings')}
            >
              <Ionicons name="settings-outline" size={22} color="#94A3B8" />
            </TouchableOpacity>
          </View>
        </View>

        {/* Child Status Card */}
        <View style={styles.childCardContainer}>
          <View style={styles.childCard}>
            {/* Avatar */}
            <View style={styles.avatarSection}>
              <View style={[styles.avatar, { borderColor: statusConfig.color }]}>
                <Text style={styles.avatarText}>{selectedChild.name[0]}</Text>
              </View>
              {selectedChild.isOnline && (
                <View style={styles.onlineBadge} />
              )}
            </View>
            
            {/* Info */}
            <View style={styles.childInfo}>
              <Text style={styles.childName}>{selectedChild.name}</Text>
              <View style={styles.locationRow}>
                <Ionicons name="location" size={13} color="#94A3B8" />
                <Text style={styles.locationText}>{selectedChild.placeName}</Text>
              </View>
              <Text style={styles.lastSeen}>Last updated {selectedChild.lastSeen}</Text>
            </View>
            
            {/* Battery */}
            <View style={styles.batterySection}>
              <Ionicons 
                name={selectedChild.battery > 20 ? "battery-half" : "battery-dead"} 
                size={18} 
                color={selectedChild.battery > 20 ? "#64748B" : "#F87171"} 
              />
              <Text style={[
                styles.batteryText,
                { color: selectedChild.battery > 20 ? "#64748B" : "#F87171" }
              ]}>
                {selectedChild.battery}%
              </Text>
            </View>
          </View>
        </View>

        {/* Safe Places Quick Access */}
        <View style={styles.placesContainer}>
          <View style={styles.placeChip}>
            <View style={[styles.placeIcon, { backgroundColor: 'rgba(52, 211, 153, 0.15)' }]}>
              <Ionicons name="home" size={16} color="#34D399" />
            </View>
            <Text style={styles.placeChipText}>Home</Text>
          </View>
          <View style={styles.placeChip}>
            <View style={[styles.placeIcon, { backgroundColor: 'rgba(99, 102, 241, 0.15)' }]}>
              <Ionicons name="school" size={16} color="#818CF8" />
            </View>
            <Text style={styles.placeChipText}>School</Text>
          </View>
          <TouchableOpacity style={styles.placeChipAdd}>
            <Ionicons name="add" size={18} color="#64748B" />
          </TouchableOpacity>
        </View>

        {/* Action Buttons */}
        <View style={[styles.actionsContainer, { bottom: tabBarHeight + 16 }]}>
          {/* Start Safe Trip Button */}
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
              <Text style={styles.tripText}>Start Safe Trip</Text>
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
  mapContainer: {
    flex: 1,
  },
  mapBackground: {
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
  roadH1: {
    left: 0,
    right: 0,
    top: '30%',
    height: 3,
  },
  roadH2: {
    left: 0,
    right: 0,
    top: '60%',
    height: 2,
  },
  roadV1: {
    top: 0,
    bottom: 0,
    left: '25%',
    width: 2,
  },
  roadV2: {
    top: 0,
    bottom: 0,
    right: '30%',
    width: 3,
  },
  roadD1: {
    width: 2,
    height: '50%',
    top: '25%',
    left: '40%',
    transform: [{ rotate: '45deg' }],
  },
  markerContainer: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  pulseRing: {
    position: 'absolute',
    borderWidth: 2,
    borderRadius: 100,
    opacity: 0.3,
  },
  pulseRing1: {
    width: 70,
    height: 70,
    opacity: 0.4,
  },
  pulseRing2: {
    width: 100,
    height: 100,
    opacity: 0.25,
  },
  pulseRing3: {
    width: 130,
    height: 130,
    opacity: 0.15,
  },
  marker: {
    width: 52,
    height: 52,
    borderRadius: 26,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 4,
    borderColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  markerInitial: {
    fontSize: 20,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  placeLabel: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(15, 23, 42, 0.95)',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    marginTop: 16,
    gap: 6,
  },
  placeLabelText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#F1F5F9',
  },
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
  placesContainer: {
    position: 'absolute',
    top: 210,
    left: 16,
    flexDirection: 'row',
    gap: 8,
  },
  placeChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(15, 23, 42, 0.9)',
    paddingRight: 12,
    paddingLeft: 4,
    paddingVertical: 4,
    borderRadius: 20,
    gap: 6,
  },
  placeIcon: {
    width: 28,
    height: 28,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
  },
  placeChipText: {
    fontSize: 13,
    fontWeight: '500',
    color: '#E2E8F0',
  },
  placeChipAdd: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(15, 23, 42, 0.9)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(51, 65, 85, 0.5)',
    borderStyle: 'dashed',
  },
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
