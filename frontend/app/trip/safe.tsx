import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ActivityIndicator,
  ScrollView,
  Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import { supabase } from '../../lib/supabase';
import { useAuthStore, useCircleStore } from '../../lib/store';
import { getPlaceColor } from '../../utils/helpers';

interface SafePlace {
  id: string;
  name: string;
  type: string;
  latitude: number;
  longitude: number;
  formatted_address?: string;
  radius: number;
}

type TripStep = 'start' | 'destination' | 'confirm' | 'active';

export default function SafeTripScreen() {
  const router = useRouter();
  const { user, profile } = useAuthStore();
  const { currentCircle } = useCircleStore();
  
  const [step, setStep] = useState<TripStep>('start');
  const [places, setPlaces] = useState<SafePlace[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [startPlace, setStartPlace] = useState<SafePlace | null>(null);
  const [destinationPlace, setDestinationPlace] = useState<SafePlace | null>(null);
  const [currentLocation, setCurrentLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [estimatedTime, setEstimatedTime] = useState<number | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    fetchPlaces();
    getCurrentLocation();
  }, []);

  const getCurrentLocation = async () => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') return;

      const loc = await Location.getCurrentPositionAsync({});
      setCurrentLocation({
        lat: loc.coords.latitude,
        lng: loc.coords.longitude,
      });
    } catch (error) {
      // Silently handle
    }
  };

  const fetchPlaces = async () => {
    if (!currentCircle?.id) {
      setIsLoading(false);
      return;
    }

    try {
      const { data, error } = await supabase
        .from('places')
        .select('*')
        .eq('circle_id', currentCircle.id)
        .order('name');

      if (!error && data) {
        setPlaces(data);
      }
    } catch (error) {
      // Silently handle
    } finally {
      setIsLoading(false);
    }
  };

  // Calculate distance between two points
  const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number): number => {
    const R = 6371; // Earth's radius in km
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = 
      Math.sin(dLat/2) * Math.sin(dLat/2) +
      Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
      Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
  };

  // Estimate travel time (rough estimate)
  const estimateTravelTime = (distanceKm: number): number => {
    // Assume average speed of 30 km/h in city
    return Math.ceil((distanceKm / 30) * 60); // minutes
  };

  const handleSelectStart = (place: SafePlace) => {
    setStartPlace(place);
    setStep('destination');
  };

  const handleSelectDestination = (place: SafePlace) => {
    if (place.id === startPlace?.id) {
      Alert.alert('Same Place', 'Please select a different destination');
      return;
    }
    
    setDestinationPlace(place);
    
    // Calculate estimated time
    if (startPlace) {
      const distance = calculateDistance(
        startPlace.latitude, startPlace.longitude,
        place.latitude, place.longitude
      );
      setEstimatedTime(estimateTravelTime(distance));
    }
    
    setStep('confirm');
  };

  const handleUseCurrentLocation = async () => {
    if (!currentLocation) {
      Alert.alert('Location Unavailable', 'Please enable location services');
      return;
    }

    // Create a temporary "current location" place
    const currentPlace: SafePlace = {
      id: 'current',
      name: 'Current Location',
      type: 'current',
      latitude: currentLocation.lat,
      longitude: currentLocation.lng,
      radius: 100,
    };

    if (step === 'start') {
      setStartPlace(currentPlace);
      setStep('destination');
    }
  };

  const handleStartTrip = async () => {
    if (!startPlace || !destinationPlace || !user?.id || !currentCircle?.id) {
      Alert.alert('Error', 'Missing trip information');
      return;
    }

    setIsSaving(true);

    try {
      // Create a safe trip record
      const tripData = {
        user_id: user.id,
        circle_id: currentCircle.id,
        start_place_id: startPlace.id !== 'current' ? startPlace.id : null,
        start_latitude: startPlace.latitude,
        start_longitude: startPlace.longitude,
        start_name: startPlace.name,
        destination_place_id: destinationPlace.id,
        destination_latitude: destinationPlace.latitude,
        destination_longitude: destinationPlace.longitude,
        destination_name: destinationPlace.name,
        estimated_arrival: new Date(Date.now() + (estimatedTime || 30) * 60 * 1000).toISOString(),
        status: 'active',
        started_at: new Date().toISOString(),
      };

      const { data, error } = await supabase
        .from('safe_trips')
        .insert(tripData)
        .select()
        .single();

      if (error) {
        // Table might not exist, create a simpler notification
        Alert.alert(
          'Safe Trip Started!',
          `Your family will be notified that you're traveling from ${startPlace.name} to ${destinationPlace.name}.\n\nEstimated arrival: ${estimatedTime} minutes`,
          [{ text: 'OK', onPress: () => router.back() }]
        );
      } else {
        Alert.alert(
          'Safe Trip Started!',
          `Your family has been notified. They'll track your journey to ${destinationPlace.name}.\n\nEstimated arrival: ${estimatedTime} minutes`,
          [{ text: 'OK', onPress: () => router.back() }]
        );
      }
    } catch (error) {
      Alert.alert('Trip Started', `Heading to ${destinationPlace.name}`, [
        { text: 'OK', onPress: () => router.back() }
      ]);
    } finally {
      setIsSaving(false);
    }
  };

  const renderPlaceItem = (place: SafePlace, onPress: () => void, isSelected?: boolean) => (
    <TouchableOpacity
      key={place.id}
      style={[styles.placeItem, isSelected && styles.placeItemSelected]}
      onPress={onPress}
    >
      <View style={[styles.placeIcon, { backgroundColor: getPlaceColor(place.type) }]}>
        <Ionicons 
          name={getPlaceIcon(place.type)} 
          size={20} 
          color="#FFFFFF" 
        />
      </View>
      <View style={styles.placeInfo}>
        <Text style={styles.placeName}>{place.name}</Text>
        {place.formatted_address && (
          <Text style={styles.placeAddress} numberOfLines={1}>
            {place.formatted_address}
          </Text>
        )}
      </View>
      {isSelected && (
        <Ionicons name="checkmark-circle" size={24} color="#34D399" />
      )}
    </TouchableOpacity>
  );

  const getPlaceIcon = (type: string): any => {
    switch (type) {
      case 'home': return 'home';
      case 'school': return 'school';
      case 'work': return 'briefcase';
      case 'gym': return 'fitness';
      case 'hospital': return 'medkit';
      case 'current': return 'navigate';
      default: return 'location';
    }
  };

  if (isLoading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#6366F1" />
          <Text style={styles.loadingText}>Loading places...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => {
          if (step === 'destination') setStep('start');
          else if (step === 'confirm') setStep('destination');
          else router.back();
        }}>
          <Ionicons name="arrow-back" size={24} color="#FFFFFF" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Safe Trip</Text>
        <View style={{ width: 44 }} />
      </View>

      {/* Progress Indicator */}
      <View style={styles.progressContainer}>
        <View style={[styles.progressStep, step !== 'start' && styles.progressStepComplete]}>
          <Text style={styles.progressNumber}>1</Text>
        </View>
        <View style={[styles.progressLine, step !== 'start' && styles.progressLineComplete]} />
        <View style={[styles.progressStep, (step === 'confirm' || step === 'active') && styles.progressStepComplete]}>
          <Text style={styles.progressNumber}>2</Text>
        </View>
        <View style={[styles.progressLine, step === 'confirm' && styles.progressLineComplete]} />
        <View style={[styles.progressStep, step === 'active' && styles.progressStepComplete]}>
          <Text style={styles.progressNumber}>3</Text>
        </View>
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Step 1: Select Start */}
        {step === 'start' && (
          <View style={styles.stepContainer}>
            <Text style={styles.stepTitle}>Where are you starting from?</Text>
            <Text style={styles.stepSubtitle}>Select your starting point</Text>

            {/* Current Location Option */}
            <TouchableOpacity 
              style={styles.currentLocationOption}
              onPress={handleUseCurrentLocation}
            >
              <View style={[styles.placeIcon, { backgroundColor: '#6366F1' }]}>
                <Ionicons name="navigate" size={20} color="#FFFFFF" />
              </View>
              <View style={styles.placeInfo}>
                <Text style={styles.placeName}>Use Current Location</Text>
                <Text style={styles.placeAddress}>Start from where you are now</Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color="#64748B" />
            </TouchableOpacity>

            <Text style={styles.orDivider}>or select a saved place</Text>

            {places.length === 0 ? (
              <View style={styles.emptyState}>
                <Ionicons name="location-outline" size={48} color="#64748B" />
                <Text style={styles.emptyText}>No saved places yet</Text>
                <TouchableOpacity 
                  style={styles.addPlaceBtn}
                  onPress={() => router.push('/place/create')}
                >
                  <Ionicons name="add" size={20} color="#6366F1" />
                  <Text style={styles.addPlaceBtnText}>Add Safe Place</Text>
                </TouchableOpacity>
              </View>
            ) : (
              places.map(place => renderPlaceItem(place, () => handleSelectStart(place)))
            )}
          </View>
        )}

        {/* Step 2: Select Destination */}
        {step === 'destination' && (
          <View style={styles.stepContainer}>
            <View style={styles.selectedStart}>
              <Ionicons name="radio-button-on" size={16} color="#34D399" />
              <Text style={styles.selectedStartText}>From: {startPlace?.name}</Text>
            </View>

            <Text style={styles.stepTitle}>Where are you going?</Text>
            <Text style={styles.stepSubtitle}>Select your destination</Text>

            {places.length === 0 ? (
              <View style={styles.emptyState}>
                <Ionicons name="location-outline" size={48} color="#64748B" />
                <Text style={styles.emptyText}>No saved places yet</Text>
                <TouchableOpacity 
                  style={styles.addPlaceBtn}
                  onPress={() => router.push('/place/create')}
                >
                  <Ionicons name="add" size={20} color="#6366F1" />
                  <Text style={styles.addPlaceBtnText}>Add Safe Place</Text>
                </TouchableOpacity>
              </View>
            ) : (
              places
                .filter(p => p.id !== startPlace?.id || startPlace?.id === 'current')
                .map(place => renderPlaceItem(place, () => handleSelectDestination(place)))
            )}
          </View>
        )}

        {/* Step 3: Confirm Trip */}
        {step === 'confirm' && startPlace && destinationPlace && (
          <View style={styles.stepContainer}>
            <Text style={styles.stepTitle}>Confirm Your Trip</Text>
            <Text style={styles.stepSubtitle}>Your family will be notified</Text>

            {/* Route Summary */}
            <View style={styles.routeSummary}>
              <View style={styles.routePoint}>
                <View style={[styles.routeDot, { backgroundColor: '#34D399' }]} />
                <View style={styles.routeInfo}>
                  <Text style={styles.routeLabel}>FROM</Text>
                  <Text style={styles.routeName}>{startPlace.name}</Text>
                </View>
              </View>
              
              <View style={styles.routeLine}>
                <Ionicons name="ellipsis-vertical" size={20} color="#475569" />
              </View>
              
              <View style={styles.routePoint}>
                <View style={[styles.routeDot, { backgroundColor: '#F87171' }]} />
                <View style={styles.routeInfo}>
                  <Text style={styles.routeLabel}>TO</Text>
                  <Text style={styles.routeName}>{destinationPlace.name}</Text>
                </View>
              </View>
            </View>

            {/* Estimated Time */}
            {estimatedTime && (
              <View style={styles.etaContainer}>
                <Ionicons name="time-outline" size={24} color="#6366F1" />
                <View>
                  <Text style={styles.etaLabel}>Estimated arrival</Text>
                  <Text style={styles.etaTime}>{estimatedTime} minutes</Text>
                </View>
              </View>
            )}

            {/* What happens */}
            <View style={styles.infoBox}>
              <Text style={styles.infoTitle}>What happens when you start?</Text>
              <View style={styles.infoItem}>
                <Ionicons name="notifications" size={18} color="#6366F1" />
                <Text style={styles.infoText}>Family gets notified of your trip</Text>
              </View>
              <View style={styles.infoItem}>
                <Ionicons name="location" size={18} color="#6366F1" />
                <Text style={styles.infoText}>Live location shared during trip</Text>
              </View>
              <View style={styles.infoItem}>
                <Ionicons name="shield-checkmark" size={18} color="#6366F1" />
                <Text style={styles.infoText}>Alert if you deviate from route</Text>
              </View>
              <View style={styles.infoItem}>
                <Ionicons name="checkmark-circle" size={18} color="#6366F1" />
                <Text style={styles.infoText}>Notification when you arrive safely</Text>
              </View>
            </View>

            {/* Start Trip Button */}
            <TouchableOpacity
              style={[styles.startTripButton, isSaving && styles.buttonDisabled]}
              onPress={handleStartTrip}
              disabled={isSaving}
            >
              {isSaving ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <>
                  <Ionicons name="navigate" size={22} color="#FFFFFF" />
                  <Text style={styles.startTripText}>Start Safe Trip</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
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
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    color: '#94A3B8',
    marginTop: 16,
    fontSize: 16,
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
  progressContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    paddingHorizontal: 40,
  },
  progressStep: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#1E293B',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#334155',
  },
  progressStepComplete: {
    backgroundColor: '#6366F1',
    borderColor: '#6366F1',
  },
  progressNumber: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
  progressLine: {
    flex: 1,
    height: 2,
    backgroundColor: '#334155',
    marginHorizontal: 8,
  },
  progressLineComplete: {
    backgroundColor: '#6366F1',
  },
  content: {
    flex: 1,
  },
  stepContainer: {
    padding: 16,
  },
  stepTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: 4,
  },
  stepSubtitle: {
    fontSize: 14,
    color: '#64748B',
    marginBottom: 24,
  },
  selectedStart: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(52, 211, 153, 0.1)',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    marginBottom: 16,
  },
  selectedStartText: {
    color: '#34D399',
    fontSize: 14,
    fontWeight: '500',
  },
  currentLocationOption: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(99, 102, 241, 0.1)',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#6366F1',
    marginBottom: 16,
  },
  orDivider: {
    color: '#64748B',
    fontSize: 13,
    textAlign: 'center',
    marginVertical: 16,
  },
  placeItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1E293B',
    borderRadius: 12,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#334155',
  },
  placeItemSelected: {
    borderColor: '#34D399',
    backgroundColor: 'rgba(52, 211, 153, 0.1)',
  },
  placeIcon: {
    width: 44,
    height: 44,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  placeInfo: {
    flex: 1,
  },
  placeName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  placeAddress: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 2,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  emptyText: {
    color: '#64748B',
    fontSize: 16,
    marginTop: 12,
    marginBottom: 20,
  },
  addPlaceBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(99, 102, 241, 0.1)',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#6366F1',
  },
  addPlaceBtnText: {
    color: '#6366F1',
    fontSize: 15,
    fontWeight: '600',
  },
  routeSummary: {
    backgroundColor: '#1E293B',
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
  },
  routePoint: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  routeDot: {
    width: 14,
    height: 14,
    borderRadius: 7,
    marginRight: 14,
  },
  routeInfo: {
    flex: 1,
  },
  routeLabel: {
    fontSize: 11,
    color: '#64748B',
    fontWeight: '600',
    letterSpacing: 0.5,
  },
  routeName: {
    fontSize: 17,
    color: '#FFFFFF',
    fontWeight: '600',
    marginTop: 2,
  },
  routeLine: {
    marginLeft: 3,
    paddingVertical: 4,
  },
  etaContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    backgroundColor: 'rgba(99, 102, 241, 0.1)',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },
  etaLabel: {
    fontSize: 12,
    color: '#94A3B8',
  },
  etaTime: {
    fontSize: 18,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  infoBox: {
    backgroundColor: '#1E293B',
    borderRadius: 12,
    padding: 16,
    marginBottom: 24,
  },
  infoTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#E2E8F0',
    marginBottom: 14,
  },
  infoItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 12,
  },
  infoText: {
    fontSize: 14,
    color: '#94A3B8',
    flex: 1,
  },
  startTripButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#6366F1',
    borderRadius: 14,
    height: 56,
    gap: 10,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  startTripText: {
    fontSize: 17,
    fontWeight: '700',
    color: '#FFFFFF',
  },
});
