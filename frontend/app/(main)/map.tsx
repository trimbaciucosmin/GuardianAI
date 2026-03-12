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
import { LinearGradient } from 'expo-linear-gradient';
import { useAuthStore } from '../../lib/store';

const { width, height } = Dimensions.get('window');

// Mock child data
const mockChildren = [
  { id: '1', name: 'Emma', status: 'safe', location: 'School', lastSeen: '2 min ago', battery: 85, lat: 0, lng: 0 },
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
        return { color: '#34D399', bg: 'rgba(52, 211, 153, 0.12)', label: 'Safe', icon: 'shield-checkmark' };
      case 'moving':
        return { color: '#FBBF24', bg: 'rgba(251, 191, 36, 0.12)', label: 'Moving', icon: 'navigate' };
      case 'alert':
        return { color: '#F87171', bg: 'rgba(248, 113, 113, 0.12)', label: 'Alert', icon: 'alert-circle' };
      default:
        return { color: '#94A3B8', bg: 'rgba(148, 163, 184, 0.12)', label: 'Unknown', icon: 'help-circle' };
    }
  };

  const statusConfig = getStatusConfig(selectedChild.status);

  return (
    <View style={styles.container}>
      {/* Map Background */}
      <View style={[styles.mapContainer, { paddingBottom: tabBarHeight }]}>
        {/* Simulated Map with Grid Pattern */}
        <View style={styles.mapBackground}>
          {/* Grid overlay for map feel */}
          <View style={styles.mapGrid}>
            {[...Array(20)].map((_, i) => (
              <View key={`h-${i}`} style={[styles.gridLineH, { top: i * 40 }]} />
            ))}
            {[...Array(12)].map((_, i) => (
              <View key={`v-${i}`} style={[styles.gridLineV, { left: i * 40 }]} />
            ))}
          </View>
          
          {/* Map Center Marker */}
          <View style={styles.mapMarkerContainer}>
            <View style={[styles.markerPulseOuter, { backgroundColor: statusConfig.bg }]} />
            <View style={[styles.markerPulse, { backgroundColor: statusConfig.bg }]} />
            <View style={[styles.markerCore, { borderColor: statusConfig.color }]}>
              <Text style={styles.markerInitial}>{selectedChild.name[0]}</Text>
            </View>
          </View>
          
          {/* Location Label */}
          <View style={styles.locationLabel}>
            <Ionicons name="location" size={12} color={statusConfig.color} />
            <Text style={styles.locationText}>{selectedChild.location}</Text>
          </View>
        </View>

        {/* Top Header - Floating */}
        <View style={[styles.headerContainer, { paddingTop: insets.top + 12 }]}>
          <View style={styles.headerCard}>
            <View style={styles.headerLeft}>
              <Text style={styles.greeting}>Hi, {userName}</Text>
              <View style={styles.statusPill}>
                <View style={[styles.statusDot, { backgroundColor: statusConfig.color }]} />
                <Text style={[styles.statusLabel, { color: statusConfig.color }]}>
                  {selectedChild.name} is {statusConfig.label.toLowerCase()}
                </Text>
              </View>
            </View>
            <TouchableOpacity 
              style={styles.settingsBtn}
              onPress={() => router.push('/settings')}
              activeOpacity={0.7}
            >
              <Ionicons name="settings-outline" size={20} color="#94A3B8" />
            </TouchableOpacity>
          </View>
        </View>

        {/* Child Info Card - Floating */}
        <View style={styles.childCardContainer}>
          <View style={styles.childCard}>
            <View style={styles.childAvatarSection}>
              <View style={[styles.childAvatar, { borderColor: statusConfig.color }]}>
                <Text style={styles.childInitial}>{selectedChild.name[0]}</Text>
              </View>
              <View style={[styles.statusBadge, { backgroundColor: statusConfig.bg }]}>
                <Ionicons name={statusConfig.icon as any} size={10} color={statusConfig.color} />
              </View>
            </View>
            <View style={styles.childDetails}>
              <Text style={styles.childName}>{selectedChild.name}</Text>
              <View style={styles.childMeta}>
                <Ionicons name="location-outline" size={12} color="#64748B" />
                <Text style={styles.childLocation}>{selectedChild.location}</Text>
                <View style={styles.metaDot} />
                <Text style={styles.childTime}>{selectedChild.lastSeen}</Text>
              </View>
            </View>
            <View style={styles.batterySection}>
              <Ionicons 
                name={selectedChild.battery > 20 ? "battery-half" : "battery-dead"} 
                size={16} 
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

        {/* Action Buttons - Bottom */}
        <View style={[styles.actionsContainer, { bottom: tabBarHeight + 20 }]}>
          {/* Going Home Button */}
          <TouchableOpacity 
            style={styles.goingHomeBtn}
            onPress={() => router.push('/trip/active')}
            activeOpacity={0.85}
          >
            <LinearGradient
              colors={['#34D399', '#10B981']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.goingHomeGradient}
            >
              <Ionicons name="home" size={22} color="#FFFFFF" />
              <Text style={styles.goingHomeText}>I'm Going Home</Text>
            </LinearGradient>
          </TouchableOpacity>

          {/* SOS Button */}
          <TouchableOpacity 
            style={styles.sosBtn}
            onPress={() => router.push('/sos/active')}
            activeOpacity={0.85}
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
    backgroundColor: '#0F172A',
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },
  mapGrid: {
    ...StyleSheet.absoluteFillObject,
  },
  gridLineH: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: 1,
    backgroundColor: 'rgba(51, 65, 85, 0.3)',
  },
  gridLineV: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    width: 1,
    backgroundColor: 'rgba(51, 65, 85, 0.3)',
  },
  mapMarkerContainer: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  markerPulseOuter: {
    position: 'absolute',
    width: 120,
    height: 120,
    borderRadius: 60,
    opacity: 0.3,
  },
  markerPulse: {
    position: 'absolute',
    width: 80,
    height: 80,
    borderRadius: 40,
    opacity: 0.5,
  },
  markerCore: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: '#1E293B',
    borderWidth: 3,
    justifyContent: 'center',
    alignItems: 'center',
  },
  markerInitial: {
    fontSize: 20,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  locationLabel: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(15, 23, 42, 0.9)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    marginTop: 16,
    gap: 4,
  },
  locationText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#E2E8F0',
  },
  headerContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 16,
  },
  headerCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: 'rgba(15, 23, 42, 0.85)',
    borderRadius: 16,
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderWidth: 1,
    borderColor: 'rgba(51, 65, 85, 0.5)',
  },
  headerLeft: {
    gap: 4,
  },
  greeting: {
    fontSize: 18,
    fontWeight: '600',
    color: '#F1F5F9',
    letterSpacing: -0.3,
  },
  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  statusLabel: {
    fontSize: 13,
    fontWeight: '500',
  },
  settingsBtn: {
    width: 40,
    height: 40,
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
    backgroundColor: 'rgba(15, 23, 42, 0.9)',
    borderRadius: 14,
    padding: 12,
    borderWidth: 1,
    borderColor: 'rgba(51, 65, 85, 0.4)',
  },
  childAvatarSection: {
    position: 'relative',
  },
  childAvatar: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: '#334155',
    borderWidth: 2,
    justifyContent: 'center',
    alignItems: 'center',
  },
  childInitial: {
    fontSize: 17,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  statusBadge: {
    position: 'absolute',
    bottom: -2,
    right: -2,
    width: 18,
    height: 18,
    borderRadius: 9,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#0F172A',
  },
  childDetails: {
    flex: 1,
    marginLeft: 12,
  },
  childName: {
    fontSize: 15,
    fontWeight: '600',
    color: '#F1F5F9',
    marginBottom: 3,
  },
  childMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  childLocation: {
    fontSize: 12,
    color: '#94A3B8',
  },
  metaDot: {
    width: 3,
    height: 3,
    borderRadius: 1.5,
    backgroundColor: '#475569',
    marginHorizontal: 4,
  },
  childTime: {
    fontSize: 12,
    color: '#64748B',
  },
  batterySection: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(30, 41, 59, 0.6)',
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 8,
  },
  batteryText: {
    fontSize: 12,
    fontWeight: '600',
  },
  actionsContainer: {
    position: 'absolute',
    left: 16,
    right: 16,
    flexDirection: 'row',
    gap: 12,
  },
  goingHomeBtn: {
    flex: 1,
    borderRadius: 16,
    overflow: 'hidden',
  },
  goingHomeGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 18,
    gap: 10,
  },
  goingHomeText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
    letterSpacing: -0.2,
  },
  sosBtn: {
    width: 60,
    height: 60,
    borderRadius: 16,
    overflow: 'hidden',
  },
  sosGradient: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
