/**
 * Live Location Tracking Service
 * Handles real-time location updates to Supabase
 */

import * as Location from 'expo-location';
import * as TaskManager from 'expo-task-manager';
import * as Battery from 'expo-battery';
import { Platform } from 'react-native';
import { supabase } from './supabase';

const LOCATION_TASK_NAME = 'guardian-ai-background-location';

interface LocationUpdateOptions {
  userId: string;
  circleId: string;
}

let currentOptions: LocationUpdateOptions | null = null;
let foregroundSubscription: Location.LocationSubscription | null = null;

/**
 * Initialize location tracking
 */
export async function initializeLocationTracking(options: LocationUpdateOptions): Promise<boolean> {
  try {
    currentOptions = options;

    // Request foreground permission first
    const { status: foregroundStatus } = await Location.requestForegroundPermissionsAsync();
    if (foregroundStatus !== 'granted') {
      console.log('[Location] Foreground permission denied');
      return false;
    }

    // Start foreground tracking
    await startForegroundTracking(options);

    // Request background permission for native platforms
    if (Platform.OS !== 'web') {
      const { status: backgroundStatus } = await Location.requestBackgroundPermissionsAsync();
      if (backgroundStatus === 'granted') {
        await startBackgroundTracking(options);
      } else {
        console.log('[Location] Background permission denied, using foreground only');
      }
    }

    return true;
  } catch (error) {
    console.error('[Location] Error initializing tracking:', error);
    return false;
  }
}

/**
 * Start foreground location tracking
 */
async function startForegroundTracking(options: LocationUpdateOptions): Promise<void> {
  // Stop any existing subscription
  if (foregroundSubscription) {
    foregroundSubscription.remove();
  }

  foregroundSubscription = await Location.watchPositionAsync(
    {
      accuracy: Location.Accuracy.Balanced,
      timeInterval: 15000, // Update every 15 seconds
      distanceInterval: 20, // Or when moved 20 meters
    },
    async (location) => {
      await updateLocationToSupabase(location, options);
    }
  );

  console.log('[Location] Foreground tracking started');
}

/**
 * Start background location tracking
 */
async function startBackgroundTracking(options: LocationUpdateOptions): Promise<void> {
  // Check if task is already running
  const isTaskRunning = await Location.hasStartedLocationUpdatesAsync(LOCATION_TASK_NAME);
  if (isTaskRunning) {
    console.log('[Location] Background task already running');
    return;
  }

  await Location.startLocationUpdatesAsync(LOCATION_TASK_NAME, {
    accuracy: Location.Accuracy.Balanced,
    timeInterval: 30000, // Update every 30 seconds in background
    distanceInterval: 50, // Or when moved 50 meters
    foregroundService: {
      notificationTitle: 'Guardian AI',
      notificationBody: 'Tracking location for family safety',
      notificationColor: '#6366F1',
    },
    pausesUpdatesAutomatically: false,
    showsBackgroundLocationIndicator: true,
  });

  console.log('[Location] Background tracking started');
}

/**
 * Stop all location tracking
 */
export async function stopLocationTracking(): Promise<void> {
  try {
    // Stop foreground tracking
    if (foregroundSubscription) {
      foregroundSubscription.remove();
      foregroundSubscription = null;
    }

    // Stop background tracking
    if (Platform.OS !== 'web') {
      const isTaskRunning = await Location.hasStartedLocationUpdatesAsync(LOCATION_TASK_NAME);
      if (isTaskRunning) {
        await Location.stopLocationUpdatesAsync(LOCATION_TASK_NAME);
      }
    }

    currentOptions = null;
    console.log('[Location] Tracking stopped');
  } catch (error) {
    console.error('[Location] Error stopping tracking:', error);
  }
}

/**
 * Update location to Supabase
 */
async function updateLocationToSupabase(
  location: Location.LocationObject,
  options: LocationUpdateOptions
): Promise<void> {
  try {
    // Get battery info
    let batteryLevel = 100;
    let isCharging = false;
    
    if (Platform.OS !== 'web') {
      try {
        batteryLevel = Math.round((await Battery.getBatteryLevelAsync()) * 100);
        const batteryState = await Battery.getBatteryStateAsync();
        isCharging = batteryState === Battery.BatteryState.CHARGING;
      } catch (e) {
        // Battery API might not be available
      }
    }

    // Determine if moving based on speed
    const isMoving = (location.coords.speed || 0) > 0.5; // More than 0.5 m/s

    const locationData = {
      user_id: options.userId,
      circle_id: options.circleId,
      latitude: location.coords.latitude,
      longitude: location.coords.longitude,
      accuracy: location.coords.accuracy,
      altitude: location.coords.altitude,
      speed: location.coords.speed,
      heading: location.coords.heading,
      battery_level: batteryLevel,
      is_moving: isMoving,
      is_charging: isCharging,
      timestamp: new Date().toISOString(),
    };

    // Upsert to live_locations (most recent location)
    const { error: liveError } = await supabase
      .from('live_locations')
      .upsert(locationData, { onConflict: 'user_id,circle_id' });

    if (liveError) {
      console.error('[Location] Error updating live location:', liveError);
      return;
    }

    // Also insert to location_history for route tracking
    const { error: historyError } = await supabase
      .from('location_history')
      .insert({
        user_id: options.userId,
        circle_id: options.circleId,
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
        timestamp: new Date().toISOString(),
      });

    if (historyError) {
      // History errors are less critical
      console.warn('[Location] Error inserting history:', historyError);
    }

    console.log('[Location] Updated:', {
      lat: location.coords.latitude.toFixed(4),
      lng: location.coords.longitude.toFixed(4),
      battery: batteryLevel,
      moving: isMoving,
    });
  } catch (error) {
    console.error('[Location] Error in updateLocationToSupabase:', error);
  }
}

/**
 * Get current location once
 */
export async function getCurrentLocation(): Promise<Location.LocationObject | null> {
  try {
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== 'granted') {
      return null;
    }

    const location = await Location.getCurrentPositionAsync({
      accuracy: Location.Accuracy.Balanced,
    });

    return location;
  } catch (error) {
    console.error('[Location] Error getting current location:', error);
    return null;
  }
}

/**
 * Check if location tracking is active
 */
export async function isTrackingActive(): Promise<boolean> {
  if (foregroundSubscription) return true;

  if (Platform.OS !== 'web') {
    try {
      return await Location.hasStartedLocationUpdatesAsync(LOCATION_TASK_NAME);
    } catch {
      return false;
    }
  }

  return false;
}

// Define background task
if (Platform.OS !== 'web') {
  TaskManager.defineTask(LOCATION_TASK_NAME, async ({ data, error }) => {
    if (error) {
      console.error('[Location] Background task error:', error);
      return;
    }

    if (data && currentOptions) {
      const { locations } = data as { locations: Location.LocationObject[] };
      if (locations && locations.length > 0) {
        // Use the most recent location
        const location = locations[locations.length - 1];
        await updateLocationToSupabase(location, currentOptions);
      }
    }
  });
}

/**
 * Update device status (separate from location)
 */
export async function updateDeviceStatus(userId: string): Promise<void> {
  try {
    let batteryLevel = 100;
    let isCharging = false;

    if (Platform.OS !== 'web') {
      try {
        batteryLevel = Math.round((await Battery.getBatteryLevelAsync()) * 100);
        const batteryState = await Battery.getBatteryStateAsync();
        isCharging = batteryState === Battery.BatteryState.CHARGING;
      } catch (e) {
        // Battery API might not be available
      }
    }

    const { error } = await supabase
      .from('device_status')
      .upsert({
        user_id: userId,
        battery_level: batteryLevel,
        is_charging: isCharging,
        gps_enabled: true,
        airplane_mode: false,
        network_type: 'wifi', // Simplified for now
        last_seen: new Date().toISOString(),
      }, { onConflict: 'user_id' });

    if (error) {
      console.error('[Device] Error updating status:', error);
    }
  } catch (error) {
    console.error('[Device] Error in updateDeviceStatus:', error);
  }
}
