/**
 * Adaptive Location Tracking Service V2
 * Features:
 * - Adaptive frequency based on movement state
 * - Offline queue for locations
 * - Tamper detection
 * - Battery-aware tracking
 */

import * as Location from 'expo-location';
import * as TaskManager from 'expo-task-manager';
import * as Battery from 'expo-battery';
import * as Network from 'expo-network';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform, AppState, AppStateStatus } from 'react-native';
import { supabase } from './supabase';
import { checkGeofences, SafePlace } from '../services/geofenceService';

const LOCATION_TASK_NAME = 'guardian-ai-adaptive-tracking';
const OFFLINE_QUEUE_KEY = '@guardian_offline_queue';
const MAX_QUEUE_SIZE = 500;

// Tracking intervals in milliseconds - OPTIMIZED FOR BATTERY
const TRACKING_CONFIG = {
  driving: { timeInterval: 5000, distanceInterval: 20 },     // 5 sec when driving
  walking: { timeInterval: 15000, distanceInterval: 10 },    // 15 sec when walking
  stationary: { timeInterval: 180000, distanceInterval: 50 }, // 3 MIN when stationary (was 60s)
  unknown: { timeInterval: 30000, distanceInterval: 25 },    // 30 sec unknown
};

interface TrackingOptions {
  userId: string;
  circleId: string;
}

interface QueuedLocation {
  latitude: number;
  longitude: number;
  accuracy: number | null;
  speed: number | null;
  heading: number | null;
  altitude: number | null;
  movementState: MovementState;
  recordedAt: string;
  batteryLevel: number;
  isCharging: boolean;
}

interface TamperStatus {
  locationPermission: boolean;
  backgroundPermission: boolean;
  gpsEnabled: boolean;
  batteryOptimizationDisabled: boolean;
  isAirplaneMode: boolean;
  networkAvailable: boolean;
}

type MovementState = 'stationary' | 'walking' | 'driving' | 'unknown';

let currentOptions: TrackingOptions | null = null;
let foregroundSubscription: Location.LocationSubscription | null = null;
let currentMovementState: MovementState = 'unknown';
let lastLocation: Location.LocationObject | null = null;
let lastSpeed = 0;
let appState: AppStateStatus = 'active';
let cachedSafePlaces: SafePlace[] = [];
let lastSafePlacesFetch = 0;
const SAFE_PLACES_CACHE_TTL = 60000; // 1 minute cache

// Battery and Offline alert tracking
let lastBatteryAlertTime = 0;
let lastOfflineAlertTime = 0;
let lastKnownBatteryLevel = 100;
let consecutiveOfflineChecks = 0;

// ALERT THRESHOLDS - Optimized to reduce false positives
const BATTERY_ALERT_THRESHOLD = 15; // 15% (was 20%)
const BATTERY_ALERT_COOLDOWN = 60 * 60 * 1000; // 1 HOUR between alerts (was 30 min)
const OFFLINE_ALERT_THRESHOLD = 6; // 6 consecutive checks = ~90 seconds (was 3)
const OFFLINE_ALERT_COOLDOWN = 10 * 60 * 1000; // 10 minutes between alerts (was 5 min)

// Listeners
const tamperListeners: ((status: TamperStatus) => void)[] = [];

/**
 * Initialize adaptive tracking
 */
export async function initializeAdaptiveTracking(options: TrackingOptions): Promise<boolean> {
  try {
    currentOptions = options;

    // Check permissions first
    const tamperStatus = await checkTamperStatus();
    notifyTamperListeners(tamperStatus);

    if (!tamperStatus.locationPermission) {
      // console.log('[Tracking] Location permission denied');
      await recordTamperEvent('permissions_revoked', options);
      return false;
    }

    // Start foreground tracking
    await startAdaptiveTracking();

    // Request background permission
    if (Platform.OS !== 'web') {
      const { status: bgStatus } = await Location.requestBackgroundPermissionsAsync();
      if (bgStatus === 'granted') {
        await startBackgroundTask();
      }
    }

    // Listen for app state changes
    AppState.addEventListener('change', handleAppStateChange);

    // Sync offline queue
    await syncOfflineQueue();

    return true;
  } catch (error) {
    // console.error('[Tracking] Init error:', error);
    return false;
  }
}

/**
 * Start adaptive foreground tracking
 */
async function startAdaptiveTracking(): Promise<void> {
  if (foregroundSubscription) {
    foregroundSubscription.remove();
  }

  const config = TRACKING_CONFIG[currentMovementState];
  
  foregroundSubscription = await Location.watchPositionAsync(
    {
      accuracy: Location.Accuracy.BestForNavigation,
      timeInterval: config.timeInterval,
      distanceInterval: config.distanceInterval,
    },
    async (location) => {
      await processLocationUpdate(location);
    }
  );

  // console.log(`[Tracking] Started with ${currentMovementState} config`);
}

/**
 * Process a location update
 */
async function processLocationUpdate(location: Location.LocationObject): Promise<void> {
  if (!currentOptions) return;

  // Detect movement state
  const newMovementState = detectMovementState(location);
  
  // If movement state changed significantly, restart tracking with new interval
  if (newMovementState !== currentMovementState) {
    // console.log(`[Tracking] Movement changed: ${currentMovementState} -> ${newMovementState}`);
    currentMovementState = newMovementState;
    
    // Restart with new config
    if (foregroundSubscription && appState === 'active') {
      await startAdaptiveTracking();
    }
  }

  lastLocation = location;

  // Get device status
  const deviceStatus = await getDeviceStatus();

  // Check if online
  const networkState = await Network.getNetworkStateAsync();
  const isOnline = networkState.isConnected && networkState.isInternetReachable;

  const locationData: QueuedLocation = {
    latitude: location.coords.latitude,
    longitude: location.coords.longitude,
    accuracy: location.coords.accuracy,
    speed: location.coords.speed,
    heading: location.coords.heading,
    altitude: location.coords.altitude,
    movementState: currentMovementState,
    recordedAt: new Date().toISOString(),
    batteryLevel: deviceStatus.batteryLevel,
    isCharging: deviceStatus.isCharging,
  };

  if (isOnline) {
    await sendLocationToSupabase(locationData, currentOptions);
    // Also try to sync any queued locations
    await syncOfflineQueue();
    
    // Check geofences for arrival/departure detection
    await checkGeofencesForLocation(location, currentOptions);
    
    // Reset offline counter when online
    consecutiveOfflineChecks = 0;
    
    // Check for low battery alert
    await checkBatteryAlert(deviceStatus.batteryLevel, currentOptions);
  } else {
    // Queue for later
    await queueLocation(locationData);
    
    // Track consecutive offline checks
    consecutiveOfflineChecks++;
    
    // Send offline alert if threshold reached
    await checkOfflineAlert(currentOptions);
  }
}

/**
 * Fetch safe places with caching
 */
async function getSafePlacesForCircle(circleId: string): Promise<SafePlace[]> {
  const now = Date.now();
  
  // Return cached if still valid
  if (cachedSafePlaces.length > 0 && now - lastSafePlacesFetch < SAFE_PLACES_CACHE_TTL) {
    return cachedSafePlaces;
  }
  
  try {
    const { data: places } = await supabase
      .from('places')
      .select('*')
      .eq('circle_id', circleId)
      .eq('is_active', true);
    
    if (places) {
      cachedSafePlaces = places.map((p: any) => ({
        id: p.id,
        name: p.name,
        latitude: p.latitude,
        longitude: p.longitude,
        radius: p.radius || 100,
        type: p.category || 'custom',
        circle_id: p.circle_id,
      }));
      lastSafePlacesFetch = now;
    }
  } catch (error) {
    console.log('[Tracking] Error fetching safe places:', error);
  }
  
  return cachedSafePlaces;
}

/**
 * Check geofences for the current location
 */
async function checkGeofencesForLocation(
  location: Location.LocationObject,
  options: TrackingOptions
): Promise<void> {
  try {
    const safePlaces = await getSafePlacesForCircle(options.circleId);
    
    if (safePlaces.length > 0) {
      await checkGeofences(
        location.coords.latitude,
        location.coords.longitude,
        options.userId,
        options.circleId,
        safePlaces
      );
    }
  } catch (error) {
    console.log('[Tracking] Geofence check error:', error);
  }
}

/**
 * Check and send battery low alert to parents
 */
async function checkBatteryAlert(
  batteryLevel: number,
  options: TrackingOptions
): Promise<void> {
  const now = Date.now();
  
  // Only alert if battery dropped below threshold and wasn't already low
  const shouldAlert = 
    batteryLevel <= BATTERY_ALERT_THRESHOLD && 
    lastKnownBatteryLevel > BATTERY_ALERT_THRESHOLD &&
    now - lastBatteryAlertTime > BATTERY_ALERT_COOLDOWN;
  
  lastKnownBatteryLevel = batteryLevel;
  
  if (!shouldAlert) return;
  
  lastBatteryAlertTime = now;
  
  try {
    // Import push notification service
    const { sendLocalNotification, getNotificationContent, notifyParentsInCircle } = 
      await import('../services/pushNotificationService');
    
    // Get child's name
    const { data: profile } = await supabase
      .from('profiles')
      .select('name')
      .eq('id', options.userId)
      .single();
    
    const childName = profile?.name || 'Your child';
    
    // Get notification content
    const content = getNotificationContent('low_battery', childName, 'en', {
      level: batteryLevel,
    });
    
    // Send push notification
    await sendLocalNotification({
      type: 'low_battery',
      title: content.title,
      body: content.body,
      data: {
        childId: options.userId,
        childName,
        batteryLevel,
      },
    });
    
    // Notify all parents
    await notifyParentsInCircle(options.circleId, {
      type: 'low_battery',
      title: content.title,
      body: content.body,
      data: {
        childId: options.userId,
        childName,
        batteryLevel,
      },
    }, options.userId);
    
    console.log(`[Tracking] Battery alert sent: ${batteryLevel}%`);
  } catch (error) {
    console.log('[Tracking] Battery alert error:', error);
  }
}

/**
 * Check and send offline alert to parents
 */
async function checkOfflineAlert(options: TrackingOptions): Promise<void> {
  const now = Date.now();
  
  // Only alert after threshold consecutive offline checks and respecting cooldown
  const shouldAlert = 
    consecutiveOfflineChecks >= OFFLINE_ALERT_THRESHOLD &&
    now - lastOfflineAlertTime > OFFLINE_ALERT_COOLDOWN;
  
  if (!shouldAlert) return;
  
  lastOfflineAlertTime = now;
  
  try {
    // Import push notification service
    const { sendLocalNotification, getNotificationContent, notifyParentsInCircle } = 
      await import('../services/pushNotificationService');
    
    // Get child's name
    const { data: profile } = await supabase
      .from('profiles')
      .select('name')
      .eq('id', options.userId)
      .single();
    
    const childName = profile?.name || 'Your child';
    
    // Get notification content
    const content = getNotificationContent('child_offline', childName, 'en');
    
    // Create notification in database for parents
    const { data: parents } = await supabase
      .from('circle_members')
      .select('user_id')
      .eq('circle_id', options.circleId)
      .eq('role', 'parent');
    
    if (parents) {
      for (const parent of parents) {
        if (parent.user_id === options.userId) continue;
        
        await supabase.from('notifications').insert({
          user_id: parent.user_id,
          circle_id: options.circleId,
          type: 'child_offline',
          title: content.title,
          message: content.body,
          data: {
            child_id: options.userId,
            child_name: childName,
            offline_since: new Date().toISOString(),
          },
          is_read: false,
        }).catch(() => {});
      }
    }
    
    console.log(`[Tracking] Offline alert sent for ${childName}`);
  } catch (error) {
    console.log('[Tracking] Offline alert error:', error);
  }
}

/**
 * Detect movement state based on speed
 */
function detectMovementState(location: Location.LocationObject): MovementState {
  const speed = location.coords.speed || 0;
  lastSpeed = speed;

  // Speed in m/s
  if (speed < 0.5) {
    return 'stationary';
  } else if (speed < 2.5) {
    // 0.5-2.5 m/s = ~2-9 km/h = walking
    return 'walking';
  } else if (speed > 5) {
    // > 5 m/s = ~18 km/h = driving
    return 'driving';
  }
  
  return 'walking';
}

/**
 * Send location to Supabase
 */
async function sendLocationToSupabase(
  location: QueuedLocation,
  options: TrackingOptions
): Promise<boolean> {
  try {
    const tamperStatus = await checkTamperStatus();

    const { error } = await supabase.rpc('update_member_status', {
      p_circle_id: options.circleId,
      p_latitude: location.latitude,
      p_longitude: location.longitude,
      p_accuracy: location.accuracy,
      p_speed: location.speed,
      p_heading: location.heading,
      p_movement_state: location.movementState,
      p_battery_level: location.batteryLevel,
      p_is_charging: location.isCharging,
      p_gps_enabled: tamperStatus.gpsEnabled,
      p_location_permission: tamperStatus.locationPermission,
      p_background_permission: tamperStatus.backgroundPermission,
      p_battery_optimization_disabled: tamperStatus.batteryOptimizationDisabled,
    });

    if (error) {
      // console.error('[Tracking] Supabase error:', error);
      return false;
    }

    // console.log(`[Tracking] Sent: ${location.movementState} @ ${location.latitude.toFixed(4)},${location.longitude.toFixed(4)}`);
    return true;
  } catch (error) {
    // console.error('[Tracking] Send error:', error);
    return false;
  }
}

/**
 * Queue location for offline sync
 */
async function queueLocation(location: QueuedLocation): Promise<void> {
  try {
    const queueStr = await AsyncStorage.getItem(OFFLINE_QUEUE_KEY);
    let queue: QueuedLocation[] = queueStr ? JSON.parse(queueStr) : [];
    
    queue.push(location);
    
    // Limit queue size
    if (queue.length > MAX_QUEUE_SIZE) {
      queue = queue.slice(-MAX_QUEUE_SIZE);
    }
    
    await AsyncStorage.setItem(OFFLINE_QUEUE_KEY, JSON.stringify(queue));
  } catch (error) {
    // console.error('[Tracking] Queue error:', error);
  }
}

/**
 * Sync offline queue when back online
 */
async function syncOfflineQueue(): Promise<void> {
  if (!currentOptions) return;

  try {
    const queueStr = await AsyncStorage.getItem(OFFLINE_QUEUE_KEY);
    if (!queueStr) return;

    const queue: QueuedLocation[] = JSON.parse(queueStr);
    if (queue.length === 0) return;

    // console.log(`[Tracking] Syncing ${queue.length} queued locations`);

    // Send in batches
    const batchSize = 10;
    const failedLocations: QueuedLocation[] = [];

    for (let i = 0; i < queue.length; i += batchSize) {
      const batch = queue.slice(i, i + batchSize);
      
      for (const location of batch) {
        const success = await sendLocationToSupabase(location, currentOptions);
        if (!success) {
          failedLocations.push(location);
        }
      }
    }

    // Keep only failed locations in queue
    await AsyncStorage.setItem(OFFLINE_QUEUE_KEY, JSON.stringify(failedLocations));
    
    if (failedLocations.length > 0) {
      // console.log(`[Tracking] ${failedLocations.length} locations failed to sync`);
    } else {
      // console.log('[Tracking] Queue synced successfully');
    }
  } catch (error) {
    // console.error('[Tracking] Sync error:', error);
  }
}

/**
 * Get current device status
 */
async function getDeviceStatus(): Promise<{ batteryLevel: number; isCharging: boolean }> {
  let batteryLevel = 100;
  let isCharging = false;

  if (Platform.OS !== 'web') {
    try {
      batteryLevel = Math.round((await Battery.getBatteryLevelAsync()) * 100);
      const batteryState = await Battery.getBatteryStateAsync();
      isCharging = batteryState === Battery.BatteryState.CHARGING;
    } catch (e) {
      // Battery API not available
    }
  }

  return { batteryLevel, isCharging };
}

/**
 * Check tamper status
 */
export async function checkTamperStatus(): Promise<TamperStatus> {
  const status: TamperStatus = {
    locationPermission: false,
    backgroundPermission: false,
    gpsEnabled: true,
    batteryOptimizationDisabled: true,
    isAirplaneMode: false,
    networkAvailable: true,
  };

  try {
    // Check foreground permission
    const { status: fgStatus } = await Location.getForegroundPermissionsAsync();
    status.locationPermission = fgStatus === 'granted';

    // Check background permission
    if (Platform.OS !== 'web') {
      const { status: bgStatus } = await Location.getBackgroundPermissionsAsync();
      status.backgroundPermission = bgStatus === 'granted';
    } else {
      status.backgroundPermission = true;
    }

    // Check GPS enabled
    const gpsEnabled = await Location.hasServicesEnabledAsync();
    status.gpsEnabled = gpsEnabled;

    // Check network
    const networkState = await Network.getNetworkStateAsync();
    status.networkAvailable = networkState.isConnected ?? false;
    status.isAirplaneMode = !networkState.isConnected && !networkState.isInternetReachable;

  } catch (error) {
    // console.error('[Tracking] Tamper check error:', error);
  }

  return status;
}

/**
 * Record tamper event
 */
async function recordTamperEvent(
  tamperType: string,
  options: TrackingOptions
): Promise<void> {
  try {
    await supabase.from('tamper_events').insert({
      user_id: options.userId,
      circle_id: options.circleId,
      tamper_type: tamperType,
    });
  } catch (error) {
    // console.error('[Tracking] Tamper record error:', error);
  }
}

/**
 * Handle app state change
 */
function handleAppStateChange(nextAppState: AppStateStatus): void {
  appState = nextAppState;
  
  if (nextAppState === 'active') {
    // App came to foreground - restart tracking
    startAdaptiveTracking();
    syncOfflineQueue();
  }
}

/**
 * Start background task
 */
async function startBackgroundTask(): Promise<void> {
  if (Platform.OS === 'web') return;

  try {
    const isRunning = await Location.hasStartedLocationUpdatesAsync(LOCATION_TASK_NAME);
    if (isRunning) return;

    await Location.startLocationUpdatesAsync(LOCATION_TASK_NAME, {
      accuracy: Location.Accuracy.Balanced,
      timeInterval: 30000,
      distanceInterval: 50,
      foregroundService: {
        notificationTitle: 'Guardian AI',
        notificationBody: 'Keeping your family safe',
        notificationColor: '#6366F1',
      },
      pausesUpdatesAutomatically: false,
      showsBackgroundLocationIndicator: true,
    });

    // console.log('[Tracking] Background task started');
  } catch (error) {
    // Silently ignore background tracking errors - not supported in Expo Go
    // This will work in standalone builds
  }
}

/**
 * Stop all tracking
 */
export async function stopAdaptiveTracking(): Promise<void> {
  try {
    if (foregroundSubscription) {
      foregroundSubscription.remove();
      foregroundSubscription = null;
    }

    if (Platform.OS !== 'web') {
      const isRunning = await Location.hasStartedLocationUpdatesAsync(LOCATION_TASK_NAME);
      if (isRunning) {
        await Location.stopLocationUpdatesAsync(LOCATION_TASK_NAME);
      }
    }

    currentOptions = null;
    // console.log('[Tracking] Stopped');
  } catch (error) {
    // console.error('[Tracking] Stop error:', error);
  }
}

/**
 * Get current movement state
 */
export function getCurrentMovementState(): MovementState {
  return currentMovementState;
}

/**
 * Get offline queue size
 */
export async function getOfflineQueueSize(): Promise<number> {
  try {
    const queueStr = await AsyncStorage.getItem(OFFLINE_QUEUE_KEY);
    if (!queueStr) return 0;
    const queue = JSON.parse(queueStr);
    return queue.length;
  } catch {
    return 0;
  }
}

/**
 * Add tamper listener
 */
export function addTamperListener(listener: (status: TamperStatus) => void): () => void {
  tamperListeners.push(listener);
  return () => {
    const index = tamperListeners.indexOf(listener);
    if (index > -1) tamperListeners.splice(index, 1);
  };
}

/**
 * Notify tamper listeners
 */
function notifyTamperListeners(status: TamperStatus): void {
  tamperListeners.forEach(listener => listener(status));
}

// Define background task (native only)
if (Platform.OS !== 'web') {
  TaskManager.defineTask(LOCATION_TASK_NAME, async ({ data, error }) => {
    if (error || !data || !currentOptions) return;

    const { locations } = data as { locations: Location.LocationObject[] };
    if (!locations || locations.length === 0) return;

    const location = locations[locations.length - 1];
    await processLocationUpdate(location);
  });
}
