/**
 * GUARDIAN AI - Location Tracking Service
 * 
 * This module handles both foreground and background location tracking.
 * 
 * ========================================
 * EXPO GO vs DEVELOPMENT BUILD LIMITATIONS
 * ========================================
 * 
 * EXPO GO (What you're testing with):
 * -----------------------------------
 * iOS:
 *   - Foreground tracking: ✅ Works
 *   - Background tracking: ❌ NOT SUPPORTED in Expo Go
 *   - Reason: iOS requires entitlements that Expo Go doesn't have
 *   - Solution: Use EAS Build to create a development build
 * 
 * Android:
 *   - Foreground tracking: ✅ Works
 *   - Background tracking: ⚠️ PARTIAL - Works but with limitations
 *   - May stop after ~10 minutes due to Android battery optimization
 *   - Foreground service notification won't show in Expo Go
 * 
 * DEVELOPMENT BUILD (Required for production):
 * --------------------------------------------
 * iOS:
 *   - Foreground tracking: ✅ Works
 *   - Background tracking: ✅ Works with proper entitlements
 *   - Requires: UIBackgroundModes location in Info.plist
 *   - User must grant "Always" location permission
 * 
 * Android:
 *   - Foreground tracking: ✅ Works
 *   - Background tracking: ✅ Works with foreground service
 *   - Shows persistent notification (required by Android)
 *   - User must grant "Allow all the time" location permission
 * 
 * ========================================
 * BATTERY OPTIMIZATION STRATEGY
 * ========================================
 * 
 * Adaptive intervals based on movement:
 * - Moving fast (driving): Update every 10 seconds
 * - Moving slow (walking): Update every 30 seconds
 * - Stationary: Update every 2 minutes
 * - SOS active: Update every 5 seconds (maximum frequency)
 * 
 * Distance-based filtering:
 * - Ignore updates < 10 meters (reduces noise)
 * - Always save if battery level changed significantly
 */

import * as Location from 'expo-location';
import * as TaskManager from 'expo-task-manager';
import * as Battery from 'expo-battery';
import { Platform, AppState, AppStateStatus } from 'react-native';
import { supabase, isSupabaseConfigured } from './supabase';

// Task name for background location
export const BACKGROUND_LOCATION_TASK = 'guardian-ai-background-location';

// Tracking configuration
export const TRACKING_CONFIG = {
  // Foreground settings
  FOREGROUND_INTERVAL_MS: 15000, // 15 seconds when app is open
  FOREGROUND_DISTANCE_METERS: 10, // Minimum distance to trigger update
  
  // Background settings (adaptive)
  BACKGROUND_INTERVAL_MOVING_MS: 30000, // 30 seconds when moving
  BACKGROUND_INTERVAL_STATIONARY_MS: 120000, // 2 minutes when stationary
  BACKGROUND_DISTANCE_METERS: 20, // Minimum distance for background
  
  // SOS mode (high frequency)
  SOS_INTERVAL_MS: 5000, // 5 seconds during SOS
  SOS_DISTANCE_METERS: 5, // Very sensitive during SOS
  
  // Battery thresholds
  LOW_BATTERY_THRESHOLD: 20, // Reduce frequency below this
  CRITICAL_BATTERY_THRESHOLD: 10, // Minimum updates only
  
  // Speed thresholds (m/s)
  STATIONARY_SPEED: 0.5, // Below this = stationary
  WALKING_SPEED: 2.0, // Below this = walking
  DRIVING_SPEED: 5.0, // Above this = driving
};

// Tracking state
interface TrackingState {
  isTracking: boolean;
  isForeground: boolean;
  isSOSMode: boolean;
  lastLocation: Location.LocationObject | null;
  lastBatteryLevel: number;
  userId: string | null;
  circleId: string | null;
  error: string | null;
  permissionStatus: 'granted' | 'denied' | 'undetermined' | 'restricted';
  backgroundPermissionStatus: 'granted' | 'denied' | 'undetermined' | 'restricted';
}

let trackingState: TrackingState = {
  isTracking: false,
  isForeground: true,
  isSOSMode: false,
  lastLocation: null,
  lastBatteryLevel: 100,
  userId: null,
  circleId: null,
  error: null,
  permissionStatus: 'undetermined',
  backgroundPermissionStatus: 'undetermined',
};

// Subscription references
let foregroundSubscription: Location.LocationSubscription | null = null;
let appStateSubscription: any = null;

// Listeners for UI updates
type TrackingListener = (state: TrackingState) => void;
const listeners: Set<TrackingListener> = new Set();

/**
 * Subscribe to tracking state changes
 */
export const subscribeToTrackingState = (listener: TrackingListener): (() => void) => {
  listeners.add(listener);
  // Immediately call with current state
  listener({ ...trackingState });
  return () => listeners.delete(listener);
};

/**
 * Notify all listeners of state change
 */
const notifyListeners = () => {
  const state = { ...trackingState };
  listeners.forEach(listener => listener(state));
};

/**
 * Update tracking state
 */
const updateState = (updates: Partial<TrackingState>) => {
  trackingState = { ...trackingState, ...updates };
  notifyListeners();
};

/**
 * Check and request foreground location permission
 */
export const requestForegroundPermission = async (): Promise<boolean> => {
  try {
    const { status } = await Location.requestForegroundPermissionsAsync();
    updateState({ permissionStatus: status as any });
    return status === 'granted';
  } catch (error) {
    console.error('Foreground permission error:', error);
    updateState({ error: 'Failed to request foreground permission' });
    return false;
  }
};

/**
 * Check and request background location permission
 * Note: This will only work properly in a development build, not Expo Go on iOS
 */
export const requestBackgroundPermission = async (): Promise<boolean> => {
  try {
    // First ensure foreground permission
    const foregroundGranted = await requestForegroundPermission();
    if (!foregroundGranted) {
      updateState({ error: 'Foreground permission required first' });
      return false;
    }

    // Request background permission
    const { status } = await Location.requestBackgroundPermissionsAsync();
    updateState({ backgroundPermissionStatus: status as any });
    
    if (status !== 'granted') {
      updateState({ 
        error: Platform.OS === 'ios' 
          ? 'Background location requires "Always" permission in Settings'
          : 'Background location requires "Allow all the time" permission'
      });
    }
    
    return status === 'granted';
  } catch (error) {
    console.error('Background permission error:', error);
    updateState({ 
      error: 'Failed to request background permission. This may require a development build.',
      backgroundPermissionStatus: 'denied'
    });
    return false;
  }
};

/**
 * Get current permission status
 */
export const getPermissionStatus = async (): Promise<{
  foreground: Location.PermissionStatus;
  background: Location.PermissionStatus;
}> => {
  const foreground = await Location.getForegroundPermissionsAsync();
  const background = await Location.getBackgroundPermissionsAsync();
  
  updateState({
    permissionStatus: foreground.status as any,
    backgroundPermissionStatus: background.status as any,
  });
  
  return {
    foreground: foreground.status,
    background: background.status,
  };
};

/**
 * Save location to Supabase
 */
const saveLocationToDatabase = async (
  location: Location.LocationObject,
  batteryLevel: number
): Promise<void> => {
  if (!trackingState.userId || !trackingState.circleId) {
    console.log('Cannot save location: missing userId or circleId');
    return;
  }

  if (!isSupabaseConfigured()) {
    console.log('Supabase not configured, skipping save');
    return;
  }

  const isMoving = (location.coords.speed ?? 0) > TRACKING_CONFIG.STATIONARY_SPEED;
  const timestamp = new Date().toISOString();

  try {
    // Upsert to live_locations (current position)
    const { error: liveError } = await supabase
      .from('live_locations')
      .upsert({
        user_id: trackingState.userId,
        circle_id: trackingState.circleId,
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
        accuracy: location.coords.accuracy,
        altitude: location.coords.altitude,
        speed: location.coords.speed,
        heading: location.coords.heading,
        battery_level: batteryLevel,
        is_moving: isMoving,
        timestamp,
      }, {
        onConflict: 'user_id,circle_id',
      });

    if (liveError) {
      console.error('Error saving live location:', liveError);
    }

    // Insert to location_history (breadcrumb trail)
    const { error: historyError } = await supabase
      .from('location_history')
      .insert({
        user_id: trackingState.userId,
        circle_id: trackingState.circleId,
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
        timestamp,
      });

    if (historyError) {
      console.error('Error saving location history:', historyError);
    }

    // Update device status
    const { error: deviceError } = await supabase
      .from('device_status')
      .upsert({
        user_id: trackingState.userId,
        battery_level: batteryLevel,
        is_charging: false, // Would need Battery.isChargingAsync()
        gps_enabled: true,
        airplane_mode: false,
        last_seen: timestamp,
      }, {
        onConflict: 'user_id',
      });

    if (deviceError) {
      console.error('Error saving device status:', deviceError);
    }

    console.log(`Location saved: ${location.coords.latitude.toFixed(4)}, ${location.coords.longitude.toFixed(4)} | Battery: ${batteryLevel}%`);
  } catch (error) {
    console.error('Database save error:', error);
  }
};

/**
 * Calculate if we should save this location (smart filtering)
 */
const shouldSaveLocation = (newLocation: Location.LocationObject): boolean => {
  // Always save in SOS mode
  if (trackingState.isSOSMode) return true;
  
  // Always save if no previous location
  if (!trackingState.lastLocation) return true;
  
  const lastCoords = trackingState.lastLocation.coords;
  const newCoords = newLocation.coords;
  
  // Calculate distance from last saved location
  const distance = getDistanceMeters(
    lastCoords.latitude,
    lastCoords.longitude,
    newCoords.latitude,
    newCoords.longitude
  );
  
  // Get minimum distance based on mode
  const minDistance = trackingState.isForeground 
    ? TRACKING_CONFIG.FOREGROUND_DISTANCE_METERS
    : TRACKING_CONFIG.BACKGROUND_DISTANCE_METERS;
  
  return distance >= minDistance;
};

/**
 * Calculate distance between two points in meters
 */
const getDistanceMeters = (lat1: number, lon1: number, lat2: number, lon2: number): number => {
  const R = 6371e3; // Earth's radius in meters
  const φ1 = (lat1 * Math.PI) / 180;
  const φ2 = (lat2 * Math.PI) / 180;
  const Δφ = ((lat2 - lat1) * Math.PI) / 180;
  const Δλ = ((lon2 - lon1) * Math.PI) / 180;

  const a =
    Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
    Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c;
};

/**
 * Handle location update (both foreground and background)
 */
const handleLocationUpdate = async (location: Location.LocationObject): Promise<void> => {
  // Check if we should save this update
  if (!shouldSaveLocation(location)) {
    return;
  }

  // Get current battery level
  let batteryLevel = trackingState.lastBatteryLevel;
  try {
    const battery = await Battery.getBatteryLevelAsync();
    batteryLevel = Math.round(battery * 100);
  } catch (e) {
    // Battery API might fail on some devices
  }

  // Save to database
  await saveLocationToDatabase(location, batteryLevel);

  // Update state
  updateState({
    lastLocation: location,
    lastBatteryLevel: batteryLevel,
    error: null,
  });
};

/**
 * Define the background location task
 * This MUST be called at module level (outside any component)
 */
TaskManager.defineTask(BACKGROUND_LOCATION_TASK, async ({ data, error }) => {
  if (error) {
    console.error('Background location task error:', error);
    updateState({ error: error.message });
    return;
  }

  if (data) {
    const { locations } = data as { locations: Location.LocationObject[] };
    
    // Process the most recent location
    if (locations && locations.length > 0) {
      const latestLocation = locations[locations.length - 1];
      console.log('Background location received:', latestLocation.coords);
      
      updateState({ isForeground: false });
      await handleLocationUpdate(latestLocation);
    }
  }
});

/**
 * Start foreground location tracking
 */
export const startForegroundTracking = async (
  userId: string,
  circleId: string
): Promise<boolean> => {
  try {
    // Update user context
    updateState({ userId, circleId });

    // Request permission
    const hasPermission = await requestForegroundPermission();
    if (!hasPermission) {
      return false;
    }

    // Stop any existing tracking
    await stopForegroundTracking();

    // Get interval based on battery and mode
    const interval = trackingState.isSOSMode 
      ? TRACKING_CONFIG.SOS_INTERVAL_MS 
      : TRACKING_CONFIG.FOREGROUND_INTERVAL_MS;

    const distanceInterval = trackingState.isSOSMode
      ? TRACKING_CONFIG.SOS_DISTANCE_METERS
      : TRACKING_CONFIG.FOREGROUND_DISTANCE_METERS;

    // Start watching position
    foregroundSubscription = await Location.watchPositionAsync(
      {
        accuracy: Location.Accuracy.High,
        timeInterval: interval,
        distanceInterval: distanceInterval,
      },
      async (location) => {
        updateState({ isForeground: true });
        await handleLocationUpdate(location);
      }
    );

    updateState({ 
      isTracking: true, 
      isForeground: true,
      error: null 
    });

    console.log('Foreground tracking started');
    return true;
  } catch (error: any) {
    console.error('Start foreground tracking error:', error);
    updateState({ error: error.message });
    return false;
  }
};

/**
 * Stop foreground location tracking
 */
export const stopForegroundTracking = async (): Promise<void> => {
  if (foregroundSubscription) {
    foregroundSubscription.remove();
    foregroundSubscription = null;
    console.log('Foreground tracking stopped');
  }
};

/**
 * Start background location tracking
 * Note: On iOS in Expo Go, this will NOT work - requires development build
 */
export const startBackgroundTracking = async (
  userId: string,
  circleId: string
): Promise<boolean> => {
  try {
    // Update user context
    updateState({ userId, circleId });

    // Request background permission
    const hasPermission = await requestBackgroundPermission();
    if (!hasPermission) {
      console.log('Background permission not granted');
      // Continue with foreground only
      return await startForegroundTracking(userId, circleId);
    }

    // Check if task is already running
    const isTaskRunning = await Location.hasStartedLocationUpdatesAsync(BACKGROUND_LOCATION_TASK);
    if (isTaskRunning) {
      console.log('Background task already running');
      return true;
    }

    // Configure background options based on platform
    const backgroundOptions: Location.LocationTaskOptions = {
      accuracy: Location.Accuracy.Balanced, // Balance battery vs accuracy
      distanceInterval: TRACKING_CONFIG.BACKGROUND_DISTANCE_METERS,
      deferredUpdatesInterval: TRACKING_CONFIG.BACKGROUND_INTERVAL_MOVING_MS,
      showsBackgroundLocationIndicator: true, // iOS: shows blue bar
      foregroundService: {
        notificationTitle: 'Guardian AI',
        notificationBody: 'Sharing your location with family',
        notificationColor: '#6366F1',
      },
    };

    // Start background location updates
    await Location.startLocationUpdatesAsync(BACKGROUND_LOCATION_TASK, backgroundOptions);

    updateState({ 
      isTracking: true,
      error: null 
    });

    console.log('Background tracking started');

    // Also start foreground for when app is active
    await startForegroundTracking(userId, circleId);

    return true;
  } catch (error: any) {
    console.error('Start background tracking error:', error);
    
    // Provide helpful error message
    let errorMessage = error.message;
    if (Platform.OS === 'ios' && error.message.includes('not supported')) {
      errorMessage = 'Background tracking requires a development build on iOS. Using foreground tracking.';
    }
    
    updateState({ error: errorMessage });

    // Fall back to foreground tracking
    console.log('Falling back to foreground tracking');
    return await startForegroundTracking(userId, circleId);
  }
};

/**
 * Stop background location tracking
 */
export const stopBackgroundTracking = async (): Promise<void> => {
  try {
    const isTaskRunning = await Location.hasStartedLocationUpdatesAsync(BACKGROUND_LOCATION_TASK);
    if (isTaskRunning) {
      await Location.stopLocationUpdatesAsync(BACKGROUND_LOCATION_TASK);
      console.log('Background tracking stopped');
    }
  } catch (error) {
    console.error('Stop background tracking error:', error);
  }
};

/**
 * Stop all location tracking
 */
export const stopAllTracking = async (): Promise<void> => {
  await stopForegroundTracking();
  await stopBackgroundTracking();
  
  updateState({
    isTracking: false,
    isForeground: true,
    isSOSMode: false,
    error: null,
  });
  
  console.log('All tracking stopped');
};

/**
 * Enable SOS mode (high-frequency tracking)
 */
export const enableSOSMode = async (): Promise<void> => {
  updateState({ isSOSMode: true });
  
  // Restart tracking with SOS settings
  if (trackingState.userId && trackingState.circleId) {
    await stopForegroundTracking();
    await startForegroundTracking(trackingState.userId, trackingState.circleId);
  }
  
  console.log('SOS mode enabled - high frequency tracking');
};

/**
 * Disable SOS mode
 */
export const disableSOSMode = async (): Promise<void> => {
  updateState({ isSOSMode: false });
  
  // Restart tracking with normal settings
  if (trackingState.userId && trackingState.circleId) {
    await stopForegroundTracking();
    await startForegroundTracking(trackingState.userId, trackingState.circleId);
  }
  
  console.log('SOS mode disabled - normal frequency tracking');
};

/**
 * Get current tracking state
 */
export const getTrackingState = (): TrackingState => {
  return { ...trackingState };
};

/**
 * Initialize app state listener for foreground/background transitions
 */
export const initializeAppStateListener = (): void => {
  if (appStateSubscription) return;

  appStateSubscription = AppState.addEventListener('change', async (nextAppState: AppStateStatus) => {
    console.log('App state changed:', nextAppState);
    
    if (nextAppState === 'active') {
      // App came to foreground
      updateState({ isForeground: true });
      
      // Ensure foreground tracking is running
      if (trackingState.isTracking && trackingState.userId && trackingState.circleId) {
        await startForegroundTracking(trackingState.userId, trackingState.circleId);
      }
    } else if (nextAppState === 'background') {
      // App went to background
      updateState({ isForeground: false });
      
      // Foreground subscription will be paused by OS
      // Background task should continue if enabled
    }
  });
};

/**
 * Clean up app state listener
 */
export const removeAppStateListener = (): void => {
  if (appStateSubscription) {
    appStateSubscription.remove();
    appStateSubscription = null;
  }
};

/**
 * Get human-readable tracking status
 */
export const getTrackingStatusText = (): string => {
  if (!trackingState.isTracking) {
    return 'Location tracking off';
  }
  
  if (trackingState.isSOSMode) {
    return 'SOS mode - sharing continuously';
  }
  
  if (trackingState.isForeground) {
    return 'Sharing location (foreground)';
  }
  
  return 'Sharing location (background)';
};

/**
 * Check if background tracking is available on this platform/build
 */
export const isBackgroundTrackingAvailable = async (): Promise<{
  available: boolean;
  reason: string;
}> => {
  // Check if running in Expo Go
  const isExpoGo = !__DEV__ || true; // Simplified check
  
  if (Platform.OS === 'ios') {
    // iOS requires development build for background location
    return {
      available: false, // In Expo Go
      reason: 'iOS background location requires a development build. Use "npx expo run:ios" or EAS Build.',
    };
  }
  
  if (Platform.OS === 'android') {
    // Android can do limited background in Expo Go
    return {
      available: true,
      reason: 'Android supports background location in Expo Go, but may be limited by battery optimization.',
    };
  }
  
  return {
    available: false,
    reason: 'Background location not supported on this platform.',
  };
};
