// Web version - no map, just placeholder
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';

interface MapMarkerData {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
  status: string;
  address?: string;
  battery?: number;
  isOnline?: boolean;
}

interface SafePlaceData {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
  radius: number;
  type: string;
}

interface MapComponentProps {
  // New interface (from map.tsx)
  myLocation?: { latitude: number; longitude: number };
  familyMembers?: MapMarkerData[];
  safePlaces?: SafePlaceData[];
  selectedMemberId?: string;
  centerOn?: { latitude: number; longitude: number } | null;
  showGeofences?: boolean;
  // Legacy interface
  latitude?: number;
  longitude?: number;
  markers?: MapMarkerData[];
  onMarkerPress?: (marker: MapMarkerData) => void;
  onPlacePress?: (place: SafePlaceData) => void;
  statusColor?: string;
  currentMemberInitial?: string;
}

const getPlaceColor = (type: string) => {
  switch (type) {
    case 'home': return '#10B981';
    case 'school': return '#6366F1';
    case 'work': return '#F59E0B';
    default: return '#8B5CF6';
  }
};

const getPlaceIcon = (type: string) => {
  switch (type) {
    case 'home': return 'home';
    case 'school': return 'school';
    case 'work': return 'briefcase';
    default: return 'location';
  }
};

export default function MapComponent(props: MapComponentProps) {
  const {
    myLocation,
    familyMembers,
    safePlaces = [],
    showGeofences = true,
    statusColor = '#34D399',
    currentMemberInitial = 'Y',
    // Legacy props
    latitude: legacyLat,
    longitude: legacyLng,
    markers: legacyMarkers,
  } = props;

  const allMarkers = familyMembers || legacyMarkers || [];
  const mapLat = myLocation?.latitude || legacyLat || 44.4268;
  const mapLng = myLocation?.longitude || legacyLng || 26.1025;

  // Determine initial to show
  const initial = allMarkers.length > 0 
    ? (allMarkers[0].name?.[0]?.toUpperCase() || 'Y') 
    : currentMemberInitial;

  return (
    <View style={styles.webMapContainer}>
      <LinearGradient
        colors={['#0c1929', '#162438', '#1a3045']}
        style={StyleSheet.absoluteFillObject}
      />
      
      {/* Map grid */}
      <View style={styles.mapOverlay}>
        <View style={[styles.road, styles.roadH1]} />
        <View style={[styles.road, styles.roadH2]} />
        <View style={[styles.road, styles.roadV1]} />
        <View style={[styles.road, styles.roadV2]} />
      </View>
      
      {/* Safe Places indicators */}
      {showGeofences && safePlaces.length > 0 && (
        <View style={styles.safePlacesIndicator}>
          <Text style={styles.safePlacesTitle}>Locuri Sigure:</Text>
          {safePlaces.slice(0, 3).map((place) => (
            <View key={place.id} style={styles.placeChip}>
              <Ionicons 
                name={getPlaceIcon(place.type) as any} 
                size={12} 
                color={getPlaceColor(place.type)} 
              />
              <Text style={[styles.placeChipText, { color: getPlaceColor(place.type) }]}>
                {place.name}
              </Text>
            </View>
          ))}
        </View>
      )}
      
      {/* Location Marker */}
      <View style={styles.markerContainer}>
        <View style={[styles.pulseRing, styles.pulseRing3, { borderColor: statusColor }]} />
        <View style={[styles.pulseRing, styles.pulseRing2, { borderColor: statusColor }]} />
        <View style={[styles.pulseRing, styles.pulseRing1, { borderColor: statusColor }]} />
        
        <View style={[styles.marker, { backgroundColor: statusColor }]}>
          <Text style={styles.markerInitial}>{initial}</Text>
        </View>
      </View>
      
      {/* Location label */}
      <View style={styles.placeLabel}>
        <Ionicons name="location" size={14} color={statusColor} />
        <Text style={styles.placeLabelText}>
          {mapLat.toFixed(4)}, {mapLng.toFixed(4)}
        </Text>
      </View>

      {/* Family members list (web only) */}
      {allMarkers.length > 0 && (
        <View style={styles.membersIndicator}>
          {allMarkers.map(m => (
            <View key={m.id} style={styles.memberChip}>
              <View style={[styles.memberDot, { backgroundColor: m.isOnline ? '#10B981' : '#6B7280' }]} />
              <Text style={styles.memberChipText}>{m.name}</Text>
              {m.battery !== undefined && (
                <Text style={styles.memberBattery}>{m.battery}%</Text>
              )}
            </View>
          ))}
        </View>
      )}

      {/* Web notice */}
      <View style={styles.webNotice}>
        <Ionicons name="information-circle" size={16} color="#64748B" />
        <Text style={styles.webNoticeText}>
          Scanează QR în Expo Go pentru Google Maps
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  webMapContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  mapOverlay: { ...StyleSheet.absoluteFillObject },
  road: { position: 'absolute', backgroundColor: 'rgba(71, 85, 105, 0.3)' },
  roadH1: { left: 0, right: 0, top: '30%', height: 3 },
  roadH2: { left: 0, right: 0, top: '60%', height: 2 },
  roadV1: { top: 0, bottom: 0, left: '25%', width: 2 },
  roadV2: { top: 0, bottom: 0, right: '30%', width: 3 },
  markerContainer: { alignItems: 'center', justifyContent: 'center' },
  pulseRing: { position: 'absolute', borderWidth: 2, borderRadius: 100, opacity: 0.3 },
  pulseRing1: { width: 70, height: 70, opacity: 0.4 },
  pulseRing2: { width: 100, height: 100, opacity: 0.25 },
  pulseRing3: { width: 130, height: 130, opacity: 0.15 },
  marker: { width: 52, height: 52, borderRadius: 26, justifyContent: 'center', alignItems: 'center', borderWidth: 4, borderColor: '#FFFFFF' },
  markerInitial: { fontSize: 20, fontWeight: '700', color: '#FFFFFF' },
  placeLabel: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(15, 23, 42, 0.95)', paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, marginTop: 16, gap: 6 },
  placeLabelText: { fontSize: 14, fontWeight: '600', color: '#F1F5F9' },
  webNotice: { position: 'absolute', bottom: 120, flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(15, 23, 42, 0.9)', paddingHorizontal: 16, paddingVertical: 10, borderRadius: 20, gap: 8 },
  webNoticeText: { color: '#64748B', fontSize: 13 },
  safePlacesIndicator: {
    position: 'absolute',
    top: 20,
    left: 20,
    backgroundColor: 'rgba(15, 23, 42, 0.9)',
    padding: 12,
    borderRadius: 12,
  },
  safePlacesTitle: {
    fontSize: 12,
    fontWeight: '600',
    color: '#94A3B8',
    marginBottom: 8,
  },
  placeChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 4,
  },
  placeChipText: {
    fontSize: 12,
    fontWeight: '500',
  },
  membersIndicator: {
    position: 'absolute',
    top: 20,
    right: 20,
    backgroundColor: 'rgba(15, 23, 42, 0.9)',
    padding: 12,
    borderRadius: 12,
    gap: 6,
  },
  memberChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  memberDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  memberChipText: {
    fontSize: 12,
    fontWeight: '500',
    color: '#E2E8F0',
  },
  memberBattery: {
    fontSize: 10,
    color: '#64748B',
  },
});
