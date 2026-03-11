import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ScrollView,
  ActivityIndicator,
  Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import { supabase } from '../../lib/supabase';
import { useAuthStore, useCircleStore, usePlacesStore, useTripStore } from '../../lib/store';
import { calculateDistance, calculateETA, formatDistance, getPlaceColor, getPlaceIcon } from '../../utils/helpers';
import { Place } from '../../types';

export default function TripActiveScreen() {
  const router = useRouter();
  const { user } = useAuthStore();
  const { currentCircle } = useCircleStore();
  const { places } = usePlacesStore();
  const { setMyActiveTrip, myActiveTrip } = useTripStore();
  
  const [currentLocation, setCurrentLocation] = useState<{ latitude: number; longitude: number } | null>(null);
  const [selectedPlace, setSelectedPlace] = useState<Place | null>(null);
  const [isStarting, setIsStarting] = useState(false);
  const [tripStarted, setTripStarted] = useState(false);
  const [eta, setEta] = useState<number>(0);
  const [distanceRemaining, setDistanceRemaining] = useState<number>(0);

  useEffect(() => {
    getCurrentLocation();
  }, []);

  useEffect(() => {
    if (myActiveTrip) {
      setTripStarted(true);
      const destination = places.find(p => p.id === myActiveTrip.destination_place_id);
      if (destination) {
        setSelectedPlace(destination);
      }
    }
  }, [myActiveTrip]);

  const getCurrentLocation = async () => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') return;

      const loc = await Location.getCurrentPositionAsync({});
      const coords = {
        latitude: loc.coords.latitude,
        longitude: loc.coords.longitude,
      };
      setCurrentLocation(coords);

      // Auto-select home if available
      const homePlace = places.find(p => p.type === 'home');
      if (homePlace && !selectedPlace) {
        setSelectedPlace(homePlace);
        updateDistanceAndETA(coords, homePlace);
      }
    } catch (error) {
      console.error('Get location error:', error);
    }
  };

  const updateDistanceAndETA = (from: { latitude: number; longitude: number }, to: Place) => {
    const distance = calculateDistance(from.latitude, from.longitude, to.latitude, to.longitude);
    setDistanceRemaining(distance);
    setEta(calculateETA(distance));
  };

  const selectPlace = (place: Place) => {
    setSelectedPlace(place);
    if (currentLocation) {
      updateDistanceAndETA(currentLocation, place);
    }
  };

  const startTrip = async () => {
    if (!selectedPlace || !currentLocation || !user || !currentCircle) {
      Alert.alert('Error', 'Please select a destination');
      return;
    }

    setIsStarting(true);

    try {
      const tripData = {
        user_id: user.id,
        circle_id: currentCircle.id,
        destination_place_id: selectedPlace.id,
        destination_name: selectedPlace.name,
        destination_latitude: selectedPlace.latitude,
        destination_longitude: selectedPlace.longitude,
        eta_minutes: eta,
        status: 'active',
        started_at: new Date().toISOString(),
      };

      const { data, error } = await supabase
        .from('monitored_trips')
        .insert(tripData)
        .select()
        .single();

      if (error) throw error;

      setMyActiveTrip(data);
      setTripStarted(true);

    } catch (error: any) {
      console.error('Start trip error:', error);
      Alert.alert('Error', error.message || 'Failed to start trip');
    } finally {
      setIsStarting(false);
    }
  };

  const completeTrip = async () => {
    try {
      if (myActiveTrip) {
        await supabase
          .from('monitored_trips')
          .update({ status: 'completed', ended_at: new Date().toISOString() })
          .eq('id', myActiveTrip.id);
      }
      setMyActiveTrip(null);
      Alert.alert('Arrived!', `You've arrived at ${selectedPlace?.name}`, [
        { text: 'OK', onPress: () => router.back() },
      ]);
    } catch (error) {
      console.error('Complete trip error:', error);
    }
  };

  const cancelTrip = async () => {
    Alert.alert('Cancel Trip', 'Are you sure you want to cancel this trip?', [
      { text: 'No', style: 'cancel' },
      {
        text: 'Yes',
        onPress: async () => {
          try {
            if (myActiveTrip) {
              await supabase
                .from('monitored_trips')
                .update({ status: 'cancelled', ended_at: new Date().toISOString() })
                .eq('id', myActiveTrip.id);
            }
            setMyActiveTrip(null);
            router.back();
          } catch (error) {
            console.error('Cancel trip error:', error);
          }
        },
      },
    ]);
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <Ionicons name="close" size={24} color="#FFFFFF" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>
          {tripStarted ? 'Trip in Progress' : "I'm Going Home"}
        </Text>
        <View style={{ width: 44 }} />
      </View>

      {/* Map Placeholder */}
      <View style={styles.mapContainer}>
        <View style={styles.mapPlaceholder}>
          <Ionicons name="navigate" size={48} color="#10B981" />
          <Text style={styles.mapTitle}>
            {tripStarted ? 'Trip Active' : 'Select Destination'}
          </Text>
          {currentLocation && (
            <Text style={styles.mapCoords}>
              Current: {currentLocation.latitude.toFixed(4)}, {currentLocation.longitude.toFixed(4)}
            </Text>
          )}
          {selectedPlace && (
            <Text style={styles.mapDest}>
              Destination: {selectedPlace.name}
            </Text>
          )}
        </View>
      </View>

      {/* Trip Info */}
      {tripStarted ? (
        <View style={styles.tripInfo}>
          <View style={styles.tripHeader}>
            <View style={styles.tripDestination}>
              <View style={[styles.destIcon, { backgroundColor: getPlaceColor(selectedPlace?.type || 'home') }]}>
                <Ionicons name={getPlaceIcon(selectedPlace?.type || 'home') as any} size={20} color="#FFFFFF" />
              </View>
              <View>
                <Text style={styles.tripLabel}>Heading to</Text>
                <Text style={styles.tripDestName}>{selectedPlace?.name}</Text>
              </View>
            </View>
            <View style={styles.tripStats}>
              <View style={styles.statItem}>
                <Ionicons name="time" size={16} color="#10B981" />
                <Text style={styles.statValue}>{eta} min</Text>
              </View>
              <View style={styles.statItem}>
                <Ionicons name="navigate" size={16} color="#6366F1" />
                <Text style={styles.statValue}>{formatDistance(distanceRemaining)}</Text>
              </View>
            </View>
          </View>

          <TouchableOpacity style={styles.arrivedButton} onPress={completeTrip}>
            <Text style={styles.arrivedText}>I've Arrived</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.cancelTripButton} onPress={cancelTrip}>
            <Text style={styles.cancelTripText}>Cancel Trip</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <View style={styles.selectionArea}>
          <Text style={styles.selectLabel}>Select destination</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.placesRow}>
            {places.map((place) => (
              <TouchableOpacity
                key={place.id}
                style={[
                  styles.placeCard,
                  selectedPlace?.id === place.id && styles.placeCardSelected,
                ]}
                onPress={() => selectPlace(place)}
              >
                <View style={[styles.placeIcon, { backgroundColor: `${getPlaceColor(place.type)}20` }]}>
                  <Ionicons name={getPlaceIcon(place.type) as any} size={24} color={getPlaceColor(place.type)} />
                </View>
                <Text style={styles.placeName}>{place.name}</Text>
              </TouchableOpacity>
            ))}
            {places.length === 0 && (
              <View style={styles.noPlaces}>
                <Ionicons name="location-outline" size={24} color="#64748B" />
                <Text style={styles.noPlacesText}>No places added yet</Text>
              </View>
            )}
          </ScrollView>

          {selectedPlace && (
            <View style={styles.etaPreview}>
              <View style={styles.etaInfo}>
                <Text style={styles.etaLabel}>Estimated arrival</Text>
                <Text style={styles.etaValue}>{eta} minutes ({formatDistance(distanceRemaining)})</Text>
              </View>
            </View>
          )}

          <TouchableOpacity
            style={[styles.startButton, (!selectedPlace || isStarting) && styles.buttonDisabled]}
            onPress={startTrip}
            disabled={!selectedPlace || isStarting}
          >
            {isStarting ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <>
                <Ionicons name="navigate" size={24} color="#FFFFFF" />
                <Text style={styles.startButtonText}>Start Monitored Trip</Text>
              </>
            )}
          </TouchableOpacity>
        </View>
      )}
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
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  backButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#1E293B',
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  mapContainer: {
    flex: 1,
    marginHorizontal: 16,
    marginBottom: 16,
    borderRadius: 16,
    overflow: 'hidden',
  },
  mapPlaceholder: {
    flex: 1,
    backgroundColor: '#1E293B',
    justifyContent: 'center',
    alignItems: 'center',
  },
  mapTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#FFFFFF',
    marginTop: 16,
  },
  mapCoords: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 8,
  },
  mapDest: {
    fontSize: 14,
    color: '#10B981',
    marginTop: 4,
    fontWeight: '500',
  },
  selectionArea: {
    padding: 16,
  },
  selectLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#94A3B8',
    marginBottom: 12,
  },
  placesRow: {
    marginBottom: 16,
  },
  placeCard: {
    backgroundColor: '#1E293B',
    borderRadius: 12,
    padding: 16,
    marginRight: 12,
    alignItems: 'center',
    minWidth: 100,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  placeCardSelected: {
    borderColor: '#10B981',
    backgroundColor: 'rgba(16, 185, 129, 0.1)',
  },
  placeIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  placeName: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '500',
  },
  noPlaces: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 16,
  },
  noPlacesText: {
    color: '#64748B',
    fontSize: 14,
  },
  etaPreview: {
    backgroundColor: '#1E293B',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },
  etaInfo: {
    alignItems: 'center',
  },
  etaLabel: {
    fontSize: 12,
    color: '#64748B',
    marginBottom: 4,
  },
  etaValue: {
    fontSize: 18,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  startButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#10B981',
    borderRadius: 12,
    height: 56,
    gap: 10,
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  startButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  tripInfo: {
    padding: 16,
    backgroundColor: '#1E293B',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
  },
  tripHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  tripDestination: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  destIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
  },
  tripLabel: {
    fontSize: 12,
    color: '#64748B',
  },
  tripDestName: {
    fontSize: 18,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  tripStats: {
    flexDirection: 'row',
    gap: 16,
  },
  statItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  statValue: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  arrivedButton: {
    backgroundColor: '#10B981',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    marginBottom: 8,
  },
  arrivedText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  cancelTripButton: {
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  cancelTripText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#EF4444',
  },
});
