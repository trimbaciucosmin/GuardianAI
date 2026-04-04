// Native version - uses Google Maps with address display
import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import MapView, { Marker, Circle, PROVIDER_GOOGLE, Callout } from 'react-native-maps';
import * as Location from 'expo-location';

interface MapMarkerData {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
  status: 'safe' | 'moving' | 'alert' | 'offline' | string;
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

const getStatusColor = (status: string) => {
  switch (status) {
    case 'safe': return '#34D399';
    case 'moving': return '#60A5FA';
    case 'alert': return '#F87171';
    case 'offline': return '#6B7280';
    default: return '#94A3B8';
  }
};

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
    case 'home': return '🏠';
    case 'school': return '🏫';
    case 'work': return '💼';
    default: return '📍';
  }
};

const darkMapStyle = [
  { elementType: 'geometry', stylers: [{ color: '#1d2c4d' }] },
  { elementType: 'labels.text.fill', stylers: [{ color: '#8ec3b9' }] },
  { elementType: 'labels.text.stroke', stylers: [{ color: '#1a3646' }] },
  { featureType: 'administrative.country', elementType: 'geometry.stroke', stylers: [{ color: '#4b6878' }] },
  { featureType: 'landscape.man_made', elementType: 'geometry.stroke', stylers: [{ color: '#334e87' }] },
  { featureType: 'landscape.natural', elementType: 'geometry', stylers: [{ color: '#023e58' }] },
  { featureType: 'poi', elementType: 'geometry', stylers: [{ color: '#283d6a' }] },
  { featureType: 'poi', elementType: 'labels.text.fill', stylers: [{ color: '#6f9ba5' }] },
  { featureType: 'poi.park', elementType: 'geometry.fill', stylers: [{ color: '#023e58' }] },
  { featureType: 'road', elementType: 'geometry', stylers: [{ color: '#304a7d' }] },
  { featureType: 'road', elementType: 'labels.text.fill', stylers: [{ color: '#98a5be' }] },
  { featureType: 'road.highway', elementType: 'geometry', stylers: [{ color: '#2c6675' }] },
  { featureType: 'road.highway', elementType: 'geometry.stroke', stylers: [{ color: '#255763' }] },
  { featureType: 'transit', elementType: 'labels.text.fill', stylers: [{ color: '#98a5be' }] },
  { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#0e1626' }] },
  { featureType: 'water', elementType: 'labels.text.fill', stylers: [{ color: '#4e6d70' }] },
];

// Default fallback location (Bucharest center)
const DEFAULT_LAT = 44.4268;
const DEFAULT_LNG = 26.1025;

export default function MapComponent(props: MapComponentProps) {
  const {
    myLocation,
    familyMembers,
    safePlaces = [],
    selectedMemberId,
    centerOn,
    showGeofences = true,
    // Legacy props
    latitude: legacyLat,
    longitude: legacyLng,
    markers: legacyMarkers,
    onMarkerPress,
    onPlacePress,
  } = props;

  const mapRef = useRef<MapView>(null);

  // Resolve actual values - support both old and new interface
  const allMarkers = familyMembers || legacyMarkers || [];
  const mapLat = centerOn?.latitude || myLocation?.latitude || legacyLat || DEFAULT_LAT;
  const mapLng = centerOn?.longitude || myLocation?.longitude || legacyLng || DEFAULT_LNG;

  const [markerAddresses, setMarkerAddresses] = useState<Record<string, string>>({});

  // Animate to center when centerOn changes
  useEffect(() => {
    if (centerOn && mapRef.current) {
      mapRef.current.animateToRegion({
        latitude: centerOn.latitude,
        longitude: centerOn.longitude,
        latitudeDelta: 0.01,
        longitudeDelta: 0.01,
      }, 800);
    }
  }, [centerOn?.latitude, centerOn?.longitude]);

  // Reverse geocode for markers
  useEffect(() => {
    const fetchAddresses = async () => {
      const addresses: Record<string, string> = {};
      for (const marker of allMarkers) {
        if (marker.latitude && marker.longitude && !marker.address) {
          try {
            const result = await Location.reverseGeocodeAsync({
              latitude: marker.latitude,
              longitude: marker.longitude,
            });
            if (result && result.length > 0) {
              const addr = result[0];
              const parts = [];
              if (addr.street) parts.push(addr.street);
              if (addr.city) parts.push(addr.city);
              addresses[marker.id] = parts.length > 0 ? parts.join(', ') : '';
            }
          } catch {
            addresses[marker.id] = '';
          }
        }
      }
      if (Object.keys(addresses).length > 0) {
        setMarkerAddresses(addresses);
      }
    };

    if (allMarkers.length > 0) {
      fetchAddresses();
    }
  }, [allMarkers.length]);

  return (
    <MapView
      ref={mapRef}
      provider={PROVIDER_GOOGLE}
      style={StyleSheet.absoluteFillObject}
      initialRegion={{
        latitude: mapLat,
        longitude: mapLng,
        latitudeDelta: 0.01,
        longitudeDelta: 0.01,
      }}
      showsUserLocation={true}
      showsMyLocationButton={false}
      customMapStyle={darkMapStyle}
    >
      {/* Geofence Circles */}
      {showGeofences && safePlaces.map((place) => (
        <Circle
          key={`circle-${place.id}`}
          center={{ latitude: place.latitude, longitude: place.longitude }}
          radius={place.radius}
          fillColor={`${getPlaceColor(place.type)}20`}
          strokeColor={getPlaceColor(place.type)}
          strokeWidth={2}
        />
      ))}
      
      {/* Safe Place Markers */}
      {showGeofences && safePlaces.map((place) => (
        <Marker
          key={`place-${place.id}`}
          coordinate={{ latitude: place.latitude, longitude: place.longitude }}
          onPress={() => onPlacePress?.(place)}
        >
          <View style={styles.placeMarkerContainer}>
            <View style={[styles.placeMarker, { backgroundColor: getPlaceColor(place.type) }]}>
              <Text style={styles.placeMarkerIcon}>{getPlaceIcon(place.type)}</Text>
            </View>
            <View style={[styles.placeLabel, { borderColor: getPlaceColor(place.type) }]}>
              <Text style={styles.placeLabelText}>{place.name}</Text>
            </View>
          </View>
        </Marker>
      ))}
      
      {/* Family Member / Child Markers */}
      {allMarkers.map((marker) => (
        marker.latitude && marker.longitude ? (
          <Marker
            key={marker.id}
            coordinate={{ latitude: marker.latitude, longitude: marker.longitude }}
            onPress={() => onMarkerPress?.(marker)}
          >
            <View style={styles.markerContainer}>
              <View style={[
                styles.mapMarker, 
                { backgroundColor: getStatusColor(marker.status) },
                selectedMemberId === marker.id && styles.mapMarkerSelected
              ]}>
                <Text style={styles.mapMarkerText}>
                  {marker.name ? marker.name[0]?.toUpperCase() : '?'}
                </Text>
              </View>
              <View style={styles.addressContainer}>
                <Text style={styles.nameText} numberOfLines={1}>{marker.name || 'Unknown'}</Text>
                {marker.address || markerAddresses[marker.id] ? (
                  <Text style={styles.addressText} numberOfLines={1}>
                    {marker.address || markerAddresses[marker.id]}
                  </Text>
                ) : null}
              </View>
            </View>
          </Marker>
        ) : null
      ))}
    </MapView>
  );
}

const styles = StyleSheet.create({
  markerContainer: {
    alignItems: 'center',
    width: 120,
  },
  mapMarker: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 3,
    borderColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 5,
  },
  mapMarkerSelected: {
    borderColor: '#6366F1',
    borderWidth: 4,
    width: 50,
    height: 50,
    borderRadius: 25,
  },
  mapMarkerText: {
    fontSize: 18,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  addressContainer: {
    backgroundColor: 'rgba(15, 23, 42, 0.9)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    marginTop: 4,
    maxWidth: 120,
    alignItems: 'center',
  },
  nameText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#FFFFFF',
    textAlign: 'center',
  },
  addressText: {
    fontSize: 9,
    color: '#94A3B8',
    textAlign: 'center',
  },
  placeMarkerContainer: {
    alignItems: 'center',
  },
  placeMarker: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 4,
  },
  placeMarkerIcon: {
    fontSize: 16,
  },
  placeLabel: {
    backgroundColor: 'rgba(15, 23, 42, 0.85)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    marginTop: 4,
    borderWidth: 1,
  },
  placeLabelText: {
    fontSize: 10,
    fontWeight: '600',
    color: '#FFFFFF',
  },
});
