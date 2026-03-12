import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Dimensions, Platform } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

const { width } = Dimensions.get('window');

interface WebMapProps {
  familyMembers: Array<{
    id: string;
    name: string;
    latitude: number;
    longitude: number;
  }>;
  selectedMemberId?: string;
  onSelectMember: (id: string) => void;
  myLocation?: { latitude: number; longitude: number } | null;
}

export default function WebMapFallback({ 
  familyMembers, 
  selectedMemberId, 
  onSelectMember,
  myLocation 
}: WebMapProps) {
  return (
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
          onPress={() => onSelectMember(member.id)}
        >
          <View style={[
            styles.markerBubble,
            selectedMemberId === member.id && styles.markerBubbleSelected
          ]}>
            <Text style={styles.markerInitial}>{member.name[0]}</Text>
          </View>
          <Text style={styles.markerName}>{member.name}</Text>
        </TouchableOpacity>
      ))}
      
      {myLocation && (
        <View style={styles.locationInfo}>
          <Text style={styles.locationText}>
            Your location: {myLocation.latitude.toFixed(4)}, {myLocation.longitude.toFixed(4)}
          </Text>
        </View>
      )}
      
      <Text style={styles.webMapNote}>Full map available on mobile app</Text>
    </View>
  );
}

const styles = StyleSheet.create({
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
  markerInitial: {
    fontSize: 18,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  markerName: {
    color: '#FFFFFF',
    fontSize: 12,
    marginTop: 4,
    fontWeight: '600',
  },
  locationInfo: {
    position: 'absolute',
    top: 120,
    backgroundColor: 'rgba(99, 102, 241, 0.2)',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
  },
  locationText: {
    color: '#94A3B8',
    fontSize: 12,
  },
  webMapNote: {
    position: 'absolute',
    bottom: 100,
    color: '#64748B',
    fontSize: 12,
  },
});
