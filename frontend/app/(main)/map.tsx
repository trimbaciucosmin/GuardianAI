import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Dimensions,
  Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuthStore } from '../../lib/store';

const { width, height } = Dimensions.get('window');

// Mock child data
const mockChild = {
  name: 'Emma',
  status: 'safe',
  location: 'School',
  lastSeen: 'Now',
  battery: 85,
};

export default function MapScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { profile } = useAuthStore();
  const [isGoingHome, setIsGoingHome] = useState(false);

  const userName = profile?.name || 'Parent';

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'safe': return '#10B981';
      case 'moving': return '#F59E0B';
      case 'alert': return '#EF4444';
      default: return '#64748B';
    }
  };

  const handleSOS = () => {
    router.push('/sos/active');
  };

  const handleGoingHome = () => {
    setIsGoingHome(true);
    router.push('/trip/active');
  };

  // Tab bar height (must match _layout.tsx)
  const tabBarHeight = 60 + insets.bottom;

  return (
    <View style={styles.container}>
      {/* Full Screen Map */}
      <View style={[styles.mapContainer, { paddingBottom: tabBarHeight }]}>
        {/* Map Placeholder - will be replaced with actual map */}
        <View style={styles.mapPlaceholder}>
          <Ionicons name="map" size={48} color="#334155" />
          <Text style={styles.mapPlaceholderText}>Map View</Text>
          
          {/* Child Location Marker (centered) */}
          <View style={styles.childMarker}>
            <View style={[styles.markerPulse, { backgroundColor: getStatusColor(mockChild.status) }]} />
            <View style={[styles.markerDot, { backgroundColor: getStatusColor(mockChild.status) }]}>
              <Text style={styles.markerInitial}>{mockChild.name[0]}</Text>
            </View>
            <View style={styles.markerLabel}>
              <Text style={styles.markerName}>{mockChild.name}</Text>
              <Text style={styles.markerLocation}>{mockChild.location}</Text>
            </View>
          </View>
        </View>

        {/* Top Header Overlay */}
        <View style={[styles.headerOverlay, { paddingTop: insets.top + 8 }]}>
          <View style={styles.headerLeft}>
            <Text style={styles.greeting}>Hi, {userName}</Text>
            <View style={styles.statusRow}>
              <View style={[styles.statusDot, { backgroundColor: '#10B981' }]} />
              <Text style={styles.statusText}>Everyone safe</Text>
            </View>
          </View>
          <TouchableOpacity 
            style={styles.settingsButton}
            onPress={() => router.push('/settings')}
          >
            <Ionicons name="settings-outline" size={24} color="#FFFFFF" />
          </TouchableOpacity>
        </View>

        {/* Child Info Card Overlay */}
        <View style={styles.childInfoOverlay}>
          <View style={styles.childCard}>
            <View style={[styles.childAvatar, { borderColor: getStatusColor(mockChild.status) }]}>
              <Text style={styles.childInitial}>{mockChild.name[0]}</Text>
            </View>
            <View style={styles.childInfo}>
              <Text style={styles.childName}>{mockChild.name}</Text>
              <Text style={styles.childLocation}>{mockChild.location} • {mockChild.lastSeen}</Text>
            </View>
            <View style={styles.childBattery}>
              <Ionicons name="battery-half" size={18} color="#64748B" />
              <Text style={styles.batteryText}>{mockChild.battery}%</Text>
            </View>
          </View>
        </View>

        {/* Bottom Action Buttons Overlay */}
        <View style={[styles.actionsOverlay, { bottom: tabBarHeight + 16 }]}>
          {/* Going Home Button */}
          <TouchableOpacity 
            style={styles.goingHomeButton}
            onPress={handleGoingHome}
            activeOpacity={0.8}
          >
            <Ionicons name="home" size={28} color="#FFFFFF" />
            <Text style={styles.goingHomeText}>I'm Going Home</Text>
          </TouchableOpacity>

          {/* SOS Button */}
          <TouchableOpacity 
            style={styles.sosButton}
            onPress={handleSOS}
            activeOpacity={0.8}
          >
            <Ionicons name="alert" size={32} color="#FFFFFF" />
          </TouchableOpacity>
        </View>
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
  },
  mapPlaceholder: {
    flex: 1,
    backgroundColor: '#1E293B',
    justifyContent: 'center',
    alignItems: 'center',
  },
  mapPlaceholderText: {
    color: '#475569',
    fontSize: 14,
    marginTop: 8,
  },
  childMarker: {
    position: 'absolute',
    alignItems: 'center',
  },
  markerPulse: {
    position: 'absolute',
    width: 80,
    height: 80,
    borderRadius: 40,
    opacity: 0.2,
  },
  markerDot: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 3,
    borderColor: '#FFFFFF',
  },
  markerInitial: {
    color: '#FFFFFF',
    fontSize: 20,
    fontWeight: '700',
  },
  markerLabel: {
    backgroundColor: '#0F172A',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    marginTop: 8,
    alignItems: 'center',
  },
  markerName: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
  markerLocation: {
    color: '#94A3B8',
    fontSize: 12,
  },
  headerOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingHorizontal: 20,
    paddingBottom: 16,
    backgroundColor: 'rgba(15, 23, 42, 0.9)',
  },
  headerLeft: {
    gap: 4,
  },
  greeting: {
    fontSize: 22,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  statusText: {
    fontSize: 14,
    color: '#10B981',
    fontWeight: '500',
  },
  settingsButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(30, 41, 59, 0.9)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  childInfoOverlay: {
    position: 'absolute',
    top: 120,
    left: 16,
    right: 16,
  },
  childCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(15, 23, 42, 0.95)',
    borderRadius: 16,
    padding: 12,
  },
  childAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#6366F1',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
  },
  childInitial: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '700',
  },
  childInfo: {
    flex: 1,
    marginLeft: 12,
  },
  childName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  childLocation: {
    fontSize: 13,
    color: '#94A3B8',
    marginTop: 2,
  },
  childBattery: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  batteryText: {
    fontSize: 13,
    color: '#64748B',
    fontWeight: '500',
  },
  actionsOverlay: {
    position: 'absolute',
    left: 16,
    right: 16,
    flexDirection: 'row',
    gap: 12,
  },
  goingHomeButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#10B981',
    borderRadius: 16,
    paddingVertical: 18,
    gap: 12,
  },
  goingHomeText: {
    fontSize: 18,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  sosButton: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#EF4444',
    justifyContent: 'center',
    alignItems: 'center',
  },
});
