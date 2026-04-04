/**
 * Active Route Monitoring Screen
 * Real-time tracking during a trip with deviation detection
 */

import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  Vibration,
  Platform,
} from 'react-native';
import { useRouter, useLocalSearchParams, Stack } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import * as Location from 'expo-location';
import { supabase } from '../../lib/supabase';
import { useAuthStore, useCircleStore } from '../../lib/store';
import { useLanguage } from '../../lib/i18n';
import MapComponent from '../../components/MapComponent';
import {
  RouteLearningService,
  UnusualStopDetector,
  isDeviatingFromRoute,
  saveLearnedRoute,
  startRouteMonitoring,
  recordDeviation,
  notifyParentsAboutDeviation,
  calculateDistance,
} from '../../services/safeRouteService';
import { LearnedRoute } from '../../types/safeRoute';

export default function ActiveRouteScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{
    routeType: string;
    routeId: string;
    startPlaceId: string;
    endPlaceId: string;
  }>();
  const insets = useSafeAreaInsets();
  const { t, language } = useLanguage();
  const { user, profile } = useAuthStore();
  const { currentCircle } = useCircleStore();
  
  const [currentLocation, setCurrentLocation] = useState<Location.LocationObject | null>(null);
  const [tripStatus, setTripStatus] = useState<'active' | 'deviated' | 'arrived'>('active');
  const [elapsedTime, setElapsedTime] = useState(0);
  const [distanceTraveled, setDistanceTraveled] = useState(0);
  const [deviationCount, setDeviationCount] = useState(0);
  const [isDeviating, setIsDeviating] = useState(false);
  const [deviationDistance, setDeviationDistance] = useState(0);
  const [learnedRoute, setLearnedRoute] = useState<LearnedRoute | null>(null);
  const [monitorId, setMonitorId] = useState<string | null>(null);
  const [destinationPlace, setDestinationPlace] = useState<{ name: string; latitude: number; longitude: number } | null>(null);
  
  // Refs for services
  const learningService = useRef(new RouteLearningService());
  const stopDetector = useRef(new UnusualStopDetector());
  const locationSubscription = useRef<Location.LocationSubscription | null>(null);
  const timerInterval = useRef<NodeJS.Timeout | null>(null);
  const lastLocation = useRef<{ latitude: number; longitude: number } | null>(null);
  const startTime = useRef(Date.now());
  
  // Translations
  const texts = {
    en: {
      title: 'Trip Active',
      learning: 'Learning route...',
      monitoring: 'Monitoring route',
      onTrack: 'On Track',
      deviating: 'DEVIATION DETECTED',
      unusualStop: 'UNUSUAL STOP',
      arrived: 'Arrived!',
      elapsed: 'Elapsed',
      distance: 'Distance',
      deviations: 'Deviations',
      destination: 'Destination',
      eta: 'ETA',
      endTrip: 'End Trip',
      confirmEnd: 'End this trip?',
      confirmEndDesc: 'Your route data will be saved to improve future monitoring.',
      cancel: 'Cancel',
      end: 'End',
      routeSaved: 'Route Saved!',
      routeSavedDesc: 'This route has been learned and will be monitored in the future.',
      ok: 'OK',
      deviationAlert: 'Route Deviation!',
      deviationAlertDesc: 'You have deviated from your usual route. Parents have been notified.',
      backOnTrack: 'Back on track!',
    },
    ro: {
      title: 'Călătorie Activă',
      learning: 'Se învață traseul...',
      monitoring: 'Se monitorizează traseul',
      onTrack: 'Pe traseu',
      deviating: 'DEVIERE DETECTATĂ',
      unusualStop: 'OPRIRE NEOBIȘNUITĂ',
      arrived: 'Ai ajuns!',
      elapsed: 'Timp',
      distance: 'Distanță',
      deviations: 'Devieri',
      destination: 'Destinație',
      eta: 'ETA',
      endTrip: 'Termină',
      confirmEnd: 'Termini călătoria?',
      confirmEndDesc: 'Datele traseului vor fi salvate pentru a îmbunătăți monitorizarea viitoare.',
      cancel: 'Anulează',
      end: 'Termină',
      routeSaved: 'Traseu Salvat!',
      routeSavedDesc: 'Acest traseu a fost învățat și va fi monitorizat în viitor.',
      ok: 'OK',
      deviationAlert: 'Deviere de la traseu!',
      deviationAlertDesc: 'Te-ai abătut de la traseul obișnuit. Părinții au fost notificați.',
      backOnTrack: 'Înapoi pe traseu!',
    },
  };
  
  const txt = texts[language];

  useEffect(() => {
    initializeTrip();
    return () => cleanup();
  }, []);

  const initializeTrip = async () => {
    // Get destination place info
    if (params.endPlaceId) {
      const { data } = await supabase
        .from('places')
        .select('name, latitude, longitude')
        .eq('id', params.endPlaceId)
        .single();
      if (data) {
        setDestinationPlace(data);
      }
    }
    
    // Load existing learned route if available
    if (params.routeId) {
      const { data } = await supabase
        .from('learned_routes')
        .select('*')
        .eq('id', params.routeId)
        .single();
      if (data) {
        setLearnedRoute(data);
        // Start monitoring
        const monitor = await startRouteMonitoring(
          user?.id || '',
          currentCircle?.id || '',
          params.routeId,
          data.average_duration_minutes || 30
        );
        if (monitor) {
          setMonitorId(monitor.id);
        }
      }
    }
    
    // Start learning service
    learningService.current.startLearning();
    
    // Start timer
    startTime.current = Date.now();
    timerInterval.current = setInterval(() => {
      setElapsedTime(Math.floor((Date.now() - startTime.current) / 1000));
    }, 1000);
    
    // Start location tracking
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission needed', 'Location permission is required for route tracking');
      return;
    }
    
    locationSubscription.current = await Location.watchPositionAsync(
      {
        accuracy: Location.Accuracy.High,
        timeInterval: 3000,
        distanceInterval: 10,
      },
      handleLocationUpdate
    );
  };

  const handleLocationUpdate = (location: Location.LocationObject) => {
    setCurrentLocation(location);
    
    const point = {
      latitude: location.coords.latitude,
      longitude: location.coords.longitude,
      timestamp: location.timestamp,
    };
    
    // Record for learning
    learningService.current.recordWaypoint(point);
    
    // Calculate distance traveled
    if (lastLocation.current) {
      const dist = calculateDistance(
        lastLocation.current.latitude,
        lastLocation.current.longitude,
        point.latitude,
        point.longitude
      );
      setDistanceTraveled(prev => prev + dist);
    }
    lastLocation.current = { latitude: point.latitude, longitude: point.longitude };
    
    // Check for destination arrival
    if (destinationPlace) {
      const distToDestination = calculateDistance(
        point.latitude,
        point.longitude,
        destinationPlace.latitude,
        destinationPlace.longitude
      );
      
      if (distToDestination < 100) { // Within 100m of destination
        handleArrival();
        return;
      }
    }
    
    // Check for deviation if we have a learned route
    if (learnedRoute && learnedRoute.waypoints.length > 0) {
      const deviation = isDeviatingFromRoute(point, learnedRoute);
      
      if (deviation.isDeviating && !isDeviating) {
        // New deviation detected
        setIsDeviating(true);
        setDeviationDistance(deviation.distanceFromRoute);
        setDeviationCount(prev => prev + 1);
        setTripStatus('deviated');
        
        // Vibrate to alert
        if (Platform.OS !== 'web') {
          Vibration.vibrate([500, 200, 500]);
        }
        
        // Record and notify
        if (monitorId) {
          recordDeviation(
            monitorId,
            user?.id || '',
            currentCircle?.id || '',
            'route_deviation',
            point,
            deviation.distanceFromRoute
          );
          
          notifyParentsAboutDeviation(
            currentCircle?.id || '',
            profile?.name || 'Child',
            'route_deviation',
            point
          );
        }
        
        Alert.alert(txt.deviationAlert, txt.deviationAlertDesc);
      } else if (!deviation.isDeviating && isDeviating) {
        // Back on track
        setIsDeviating(false);
        setTripStatus('active');
        Alert.alert('✅', txt.backOnTrack);
      }
    }
    
    // Check for unusual stops
    if (learnedRoute) {
      const stopCheck = stopDetector.current.checkForUnusualStop(
        point,
        learnedRoute.waypoints
      );
      
      if (stopCheck.isUnusualStop && !stopCheck.isOnRoute) {
        // Unusual stop detected
        if (monitorId) {
          recordDeviation(
            monitorId,
            user?.id || '',
            currentCircle?.id || '',
            'unusual_stop',
            point,
            0,
            stopCheck.durationSeconds
          );
          
          notifyParentsAboutDeviation(
            currentCircle?.id || '',
            profile?.name || 'Child',
            'unusual_stop',
            point
          );
        }
      }
    }
  };

  const handleArrival = async () => {
    setTripStatus('arrived');
    cleanup();
    
    // Save learned route
    const { waypoints, durationMinutes } = learningService.current.finishLearning();
    
    if (waypoints.length > 5 && user?.id && currentCircle?.id) {
      await saveLearnedRoute(
        user.id,
        currentCircle.id,
        params.routeType as any || 'custom',
        params.startPlaceId || '',
        params.endPlaceId || '',
        waypoints,
        durationMinutes
      );
      
      Alert.alert(txt.routeSaved, txt.routeSavedDesc, [
        { text: txt.ok, onPress: () => router.back() }
      ]);
    } else {
      router.back();
    }
  };

  const handleEndTrip = () => {
    Alert.alert(txt.confirmEnd, txt.confirmEndDesc, [
      { text: txt.cancel, style: 'cancel' },
      {
        text: txt.end,
        onPress: async () => {
          const { waypoints, durationMinutes } = learningService.current.finishLearning();
          
          if (waypoints.length > 5 && user?.id && currentCircle?.id) {
            await saveLearnedRoute(
              user.id,
              currentCircle.id,
              params.routeType as any || 'custom',
              params.startPlaceId || '',
              params.endPlaceId || '',
              waypoints,
              durationMinutes
            );
          }
          
          cleanup();
          router.back();
        },
      },
    ]);
  };

  const cleanup = () => {
    if (locationSubscription.current) {
      locationSubscription.current.remove();
    }
    if (timerInterval.current) {
      clearInterval(timerInterval.current);
    }
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const formatDistance = (meters: number) => {
    if (meters < 1000) {
      return `${Math.round(meters)}m`;
    }
    return `${(meters / 1000).toFixed(1)}km`;
  };

  const getStatusColor = () => {
    switch (tripStatus) {
      case 'deviated': return '#EF4444';
      case 'arrived': return '#10B981';
      default: return isDeviating ? '#EF4444' : '#10B981';
    }
  };

  const getStatusText = () => {
    if (tripStatus === 'arrived') return txt.arrived;
    if (isDeviating) return txt.deviating;
    if (learnedRoute) return txt.monitoring;
    return txt.learning;
  };

  return (
    <View style={styles.container}>
      <Stack.Screen
        options={{
          headerShown: true,
          title: txt.title,
          headerStyle: { backgroundColor: getStatusColor() },
          headerTintColor: '#FFFFFF',
          headerShadowVisible: false,
        }}
      />
      
      {/* Status Banner */}
      <View style={[styles.statusBanner, { backgroundColor: getStatusColor() }]}>
        <View style={styles.statusContent}>
          <Ionicons 
            name={isDeviating ? 'warning' : tripStatus === 'arrived' ? 'checkmark-circle' : 'navigate'} 
            size={32} 
            color="#FFFFFF" 
          />
          <View style={styles.statusTextContainer}>
            <Text style={styles.statusTitle}>{getStatusText()}</Text>
            {isDeviating && (
              <Text style={styles.statusSubtext}>
                {Math.round(deviationDistance)}m from route
              </Text>
            )}
            {destinationPlace && !isDeviating && (
              <Text style={styles.statusSubtext}>
                {txt.destination}: {destinationPlace.name}
              </Text>
            )}
          </View>
        </View>
      </View>

      {/* Map */}
      <View style={styles.mapContainer}>
        {currentLocation && (
          <MapComponent
            latitude={currentLocation.coords.latitude}
            longitude={currentLocation.coords.longitude}
            markers={[
              {
                id: 'current',
                name: profile?.name || 'Me',
                latitude: currentLocation.coords.latitude,
                longitude: currentLocation.coords.longitude,
                status: isDeviating ? 'warning' : 'safe',
              },
              ...(destinationPlace ? [{
                id: 'destination',
                name: destinationPlace.name,
                latitude: destinationPlace.latitude,
                longitude: destinationPlace.longitude,
                status: 'destination' as any,
              }] : []),
            ]}
            statusColor={getStatusColor()}
            currentMemberInitial={profile?.name?.[0] || 'M'}
            onMarkerPress={() => {}}
          />
        )}
      </View>

      {/* Stats */}
      <View style={styles.statsContainer}>
        <View style={styles.statCard}>
          <Ionicons name="time-outline" size={24} color="#6366F1" />
          <Text style={styles.statValue}>{formatTime(elapsedTime)}</Text>
          <Text style={styles.statLabel}>{txt.elapsed}</Text>
        </View>
        <View style={styles.statCard}>
          <Ionicons name="speedometer-outline" size={24} color="#10B981" />
          <Text style={styles.statValue}>{formatDistance(distanceTraveled)}</Text>
          <Text style={styles.statLabel}>{txt.distance}</Text>
        </View>
        <View style={styles.statCard}>
          <Ionicons name="warning-outline" size={24} color={deviationCount > 0 ? '#EF4444' : '#64748B'} />
          <Text style={[styles.statValue, deviationCount > 0 && { color: '#EF4444' }]}>
            {deviationCount}
          </Text>
          <Text style={styles.statLabel}>{txt.deviations}</Text>
        </View>
      </View>

      {/* End Trip Button */}
      <View style={[styles.bottomContainer, { paddingBottom: insets.bottom + 20 }]}>
        <TouchableOpacity style={styles.endTripBtn} onPress={handleEndTrip}>
          <LinearGradient
            colors={['#64748B', '#475569']}
            style={styles.endTripBtnGradient}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
          >
            <Ionicons name="stop-circle" size={24} color="#FFFFFF" />
            <Text style={styles.endTripBtnText}>{txt.endTrip}</Text>
          </LinearGradient>
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
  statusBanner: {
    paddingVertical: 16,
    paddingHorizontal: 20,
  },
  statusContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statusTextContainer: {
    marginLeft: 16,
  },
  statusTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  statusSubtext: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.8)',
    marginTop: 4,
  },
  mapContainer: {
    flex: 1,
    backgroundColor: '#1E293B',
  },
  statsContainer: {
    flexDirection: 'row',
    padding: 20,
    gap: 12,
  },
  statCard: {
    flex: 1,
    backgroundColor: '#1E293B',
    borderRadius: 16,
    padding: 16,
    alignItems: 'center',
  },
  statValue: {
    fontSize: 24,
    fontWeight: '700',
    color: '#FFFFFF',
    marginTop: 8,
  },
  statLabel: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 4,
  },
  bottomContainer: {
    paddingHorizontal: 20,
  },
  endTripBtn: {
    borderRadius: 16,
    overflow: 'hidden',
  },
  endTripBtnGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 18,
    gap: 10,
  },
  endTripBtnText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#FFFFFF',
  },
});
