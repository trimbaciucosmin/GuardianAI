/**
 * Tamper Alert Service
 * Enhanced tamper detection with real-time parent notifications
 */

import * as Location from 'expo-location';
import * as Network from 'expo-network';
import * as Battery from 'expo-battery';
import { Platform, AppState, AppStateStatus } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '../lib/supabase';

// Tamper event types
export type TamperEventType = 
  | 'location_disabled'
  | 'gps_disabled'
  | 'internet_disabled'
  | 'app_force_closed'
  | 'permission_revoked'
  | 'background_restricted'
  | 'battery_saver_on'
  | 'airplane_mode'
  | 'mock_location';

export interface TamperEvent {
  id?: string;
  user_id: string;
  circle_id: string;
  event_type: TamperEventType;
  severity: 'low' | 'medium' | 'high' | 'critical';
  detected_at: string;
  resolved_at?: string;
  details?: Record<string, any>;
}

export interface TamperStatus {
  locationPermission: boolean;
  backgroundPermission: boolean;
  gpsEnabled: boolean;
  networkAvailable: boolean;
  isAirplaneMode: boolean;
  batteryOptimizationDisabled: boolean;
  mockLocationDetected: boolean;
  appInForeground: boolean;
  lastCheckTime: string;
}

// Previous status for comparison
let previousStatus: TamperStatus | null = null;
let monitoringInterval: NodeJS.Timeout | null = null;
let currentUserId: string | null = null;
let currentCircleId: string | null = null;
let appState: AppStateStatus = 'active';
let lastBackgroundTime: number = 0;

const TAMPER_CHECK_INTERVAL = 10000; // Check every 10 seconds
const APP_CLOSED_THRESHOLD = 60000; // Consider app closed after 60 seconds in background
const TAMPER_STATUS_KEY = '@guardian_tamper_status';

/**
 * Start tamper monitoring
 */
export async function startTamperMonitoring(
  userId: string,
  circleId: string
): Promise<void> {
  currentUserId = userId;
  currentCircleId = circleId;
  
  // Initial check
  const initialStatus = await checkTamperStatus();
  previousStatus = initialStatus;
  await saveTamperStatus(initialStatus);
  
  // Start periodic monitoring
  monitoringInterval = setInterval(async () => {
    await performTamperCheck();
  }, TAMPER_CHECK_INTERVAL);
  
  // Listen to app state changes
  const subscription = AppState.addEventListener('change', handleAppStateChange);
  
  console.log('[TamperAlert] Monitoring started');
}

/**
 * Stop tamper monitoring
 */
export function stopTamperMonitoring(): void {
  if (monitoringInterval) {
    clearInterval(monitoringInterval);
    monitoringInterval = null;
  }
  currentUserId = null;
  currentCircleId = null;
  console.log('[TamperAlert] Monitoring stopped');
}

/**
 * Perform a tamper check
 */
async function performTamperCheck(): Promise<void> {
  if (!currentUserId || !currentCircleId) return;
  
  const currentStatus = await checkTamperStatus();
  
  // Compare with previous status to detect changes
  if (previousStatus) {
    await detectTamperEvents(previousStatus, currentStatus);
  }
  
  previousStatus = currentStatus;
  await saveTamperStatus(currentStatus);
}

/**
 * Check current tamper status
 */
export async function checkTamperStatus(): Promise<TamperStatus> {
  const status: TamperStatus = {
    locationPermission: false,
    backgroundPermission: false,
    gpsEnabled: true,
    networkAvailable: true,
    isAirplaneMode: false,
    batteryOptimizationDisabled: true,
    mockLocationDetected: false,
    appInForeground: appState === 'active',
    lastCheckTime: new Date().toISOString(),
  };

  try {
    // Check foreground permission
    const { status: fgStatus } = await Location.getForegroundPermissionsAsync();
    status.locationPermission = fgStatus === 'granted';

    // Check background permission (native only)
    if (Platform.OS !== 'web') {
      try {
        const { status: bgStatus } = await Location.getBackgroundPermissionsAsync();
        status.backgroundPermission = bgStatus === 'granted';
      } catch {
        status.backgroundPermission = false;
      }
    } else {
      status.backgroundPermission = true;
    }

    // Check GPS enabled
    try {
      status.gpsEnabled = await Location.hasServicesEnabledAsync();
    } catch {
      status.gpsEnabled = false;
    }

    // Check network
    try {
      const networkState = await Network.getNetworkStateAsync();
      status.networkAvailable = networkState.isConnected ?? false;
      status.isAirplaneMode = !networkState.isConnected && !networkState.isInternetReachable;
    } catch {
      status.networkAvailable = false;
    }

    // Check for mock location (Android only)
    if (Platform.OS === 'android') {
      try {
        const location = await Location.getLastKnownPositionAsync();
        if (location && (location as any).mocked) {
          status.mockLocationDetected = true;
        }
      } catch {
        // Ignore
      }
    }

  } catch (error) {
    console.error('[TamperAlert] Status check error:', error);
  }

  return status;
}

/**
 * Detect tamper events by comparing status changes
 */
async function detectTamperEvents(
  oldStatus: TamperStatus,
  newStatus: TamperStatus
): Promise<void> {
  if (!currentUserId || !currentCircleId) return;

  const events: TamperEvent[] = [];

  // Location permission revoked
  if (oldStatus.locationPermission && !newStatus.locationPermission) {
    events.push({
      user_id: currentUserId,
      circle_id: currentCircleId,
      event_type: 'permission_revoked',
      severity: 'critical',
      detected_at: new Date().toISOString(),
      details: { permission: 'location' },
    });
  }

  // GPS disabled
  if (oldStatus.gpsEnabled && !newStatus.gpsEnabled) {
    events.push({
      user_id: currentUserId,
      circle_id: currentCircleId,
      event_type: 'gps_disabled',
      severity: 'high',
      detected_at: new Date().toISOString(),
    });
  }

  // Internet disabled
  if (oldStatus.networkAvailable && !newStatus.networkAvailable) {
    events.push({
      user_id: currentUserId,
      circle_id: currentCircleId,
      event_type: 'internet_disabled',
      severity: 'medium',
      detected_at: new Date().toISOString(),
    });
  }

  // Airplane mode enabled
  if (!oldStatus.isAirplaneMode && newStatus.isAirplaneMode) {
    events.push({
      user_id: currentUserId,
      circle_id: currentCircleId,
      event_type: 'airplane_mode',
      severity: 'high',
      detected_at: new Date().toISOString(),
    });
  }

  // Background permission revoked
  if (oldStatus.backgroundPermission && !newStatus.backgroundPermission) {
    events.push({
      user_id: currentUserId,
      circle_id: currentCircleId,
      event_type: 'background_restricted',
      severity: 'high',
      detected_at: new Date().toISOString(),
    });
  }

  // Mock location detected
  if (!oldStatus.mockLocationDetected && newStatus.mockLocationDetected) {
    events.push({
      user_id: currentUserId,
      circle_id: currentCircleId,
      event_type: 'mock_location',
      severity: 'critical',
      detected_at: new Date().toISOString(),
    });
  }

  // Record events and notify parents
  for (const event of events) {
    await recordTamperEvent(event);
    await notifyParentsAboutTamper(event);
  }
}

/**
 * Handle app state change
 */
function handleAppStateChange(nextAppState: AppStateStatus): void {
  const prevAppState = appState;
  appState = nextAppState;
  
  if (nextAppState === 'background') {
    lastBackgroundTime = Date.now();
  } else if (nextAppState === 'active' && prevAppState === 'background') {
    // Check if app was in background for too long (potential force close)
    const backgroundDuration = Date.now() - lastBackgroundTime;
    if (backgroundDuration > APP_CLOSED_THRESHOLD && currentUserId && currentCircleId) {
      // This could indicate app was force closed and reopened
      recordTamperEvent({
        user_id: currentUserId,
        circle_id: currentCircleId,
        event_type: 'app_force_closed',
        severity: 'medium',
        detected_at: new Date(lastBackgroundTime).toISOString(),
        details: { background_duration_ms: backgroundDuration },
      });
    }
  }
}

/**
 * Record tamper event to database
 */
async function recordTamperEvent(event: TamperEvent): Promise<void> {
  try {
    const { error } = await supabase.from('tamper_events').insert({
      user_id: event.user_id,
      circle_id: event.circle_id,
      event_type: event.event_type,
      severity: event.severity,
      detected_at: event.detected_at,
      details: event.details,
    });

    if (error) {
      console.error('[TamperAlert] Failed to record event:', error);
    } else {
      console.log(`[TamperAlert] Recorded: ${event.event_type}`);
    }
  } catch (error) {
    console.error('[TamperAlert] Record error:', error);
  }
}

/**
 * Notify parents about tamper event
 */
async function notifyParentsAboutTamper(event: TamperEvent): Promise<void> {
  try {
    // Import push notification service dynamically
    const { sendLocalNotification } = await import('./pushNotificationService');
    
    // Get child's name
    const { data: childProfile } = await supabase
      .from('profiles')
      .select('name')
      .eq('id', event.user_id)
      .single();

    const childName = childProfile?.name || 'Your child';

    // Get notification details
    const { title, message, icon } = getTamperNotificationContent(event.event_type, childName);

    // Get all parents in the circle
    const { data: parents } = await supabase
      .from('circle_members')
      .select('user_id')
      .eq('circle_id', event.circle_id)
      .eq('role', 'parent');

    if (!parents) return;

    // Create notification for each parent
    for (const parent of parents) {
      if (parent.user_id === event.user_id) continue; // Don't notify self

      await supabase.from('notifications').insert({
        user_id: parent.user_id,
        circle_id: event.circle_id,
        type: 'tamper_alert',
        title,
        message,
        data: {
          event_type: event.event_type,
          severity: event.severity,
          child_id: event.user_id,
          child_name: childName,
          detected_at: event.detected_at,
        },
        is_read: false,
      });
    }
    
    // Send local push notification
    await sendLocalNotification({
      type: 'tamper_alert',
      title,
      body: message,
      data: {
        eventType: event.event_type,
        severity: event.severity,
        childId: event.user_id,
        childName: childName,
      },
    });

    console.log(`[TamperAlert] Parents notified about ${event.event_type}`);
  } catch (error) {
    console.error('[TamperAlert] Notification error:', error);
  }
}

/**
 * Get notification content based on tamper type
 */
function getTamperNotificationContent(
  eventType: TamperEventType,
  childName: string
): { title: string; message: string; icon: string } {
  const content: Record<TamperEventType, { title: string; message: string; icon: string }> = {
    location_disabled: {
      title: '🚨 Location Disabled',
      message: `${childName} has disabled location services`,
      icon: 'location-off',
    },
    gps_disabled: {
      title: '📍 GPS Turned Off',
      message: `${childName}'s device GPS has been turned off`,
      icon: 'navigate-off',
    },
    internet_disabled: {
      title: '📶 Internet Disconnected',
      message: `${childName}'s device lost internet connection`,
      icon: 'wifi-off',
    },
    app_force_closed: {
      title: '⚠️ App Closed',
      message: `Guardian AI was closed on ${childName}'s device`,
      icon: 'close-circle',
    },
    permission_revoked: {
      title: '🔒 Permission Revoked',
      message: `${childName} revoked location permission`,
      icon: 'lock-closed',
    },
    background_restricted: {
      title: '⏸️ Background Tracking Disabled',
      message: `Background location was disabled on ${childName}'s device`,
      icon: 'pause-circle',
    },
    battery_saver_on: {
      title: '🔋 Battery Saver Active',
      message: `Battery saver may affect tracking on ${childName}'s device`,
      icon: 'battery-half',
    },
    airplane_mode: {
      title: '✈️ Airplane Mode',
      message: `${childName}'s device is in airplane mode`,
      icon: 'airplane',
    },
    mock_location: {
      title: '🚨 Fake Location Detected',
      message: `${childName} may be using a fake location app`,
      icon: 'warning',
    },
  };

  return content[eventType];
}

/**
 * Save tamper status locally
 */
async function saveTamperStatus(status: TamperStatus): Promise<void> {
  try {
    await AsyncStorage.setItem(TAMPER_STATUS_KEY, JSON.stringify(status));
  } catch (error) {
    console.error('[TamperAlert] Save status error:', error);
  }
}

/**
 * Get last tamper status
 */
export async function getLastTamperStatus(): Promise<TamperStatus | null> {
  try {
    const statusStr = await AsyncStorage.getItem(TAMPER_STATUS_KEY);
    return statusStr ? JSON.parse(statusStr) : null;
  } catch {
    return null;
  }
}

/**
 * Get tamper events for a circle (for parents)
 */
export async function getTamperEvents(
  circleId: string,
  limit: number = 50
): Promise<TamperEvent[]> {
  try {
    const { data, error } = await supabase
      .from('tamper_events')
      .select('*, profiles:user_id(name)')
      .eq('circle_id', circleId)
      .order('detected_at', { ascending: false })
      .limit(limit);

    if (error) throw error;
    return data || [];
  } catch (error) {
    console.error('[TamperAlert] Get events error:', error);
    return [];
  }
}

/**
 * Get unresolved tamper events count
 */
export async function getUnresolvedTamperCount(circleId: string): Promise<number> {
  try {
    const { count, error } = await supabase
      .from('tamper_events')
      .select('*', { count: 'exact', head: true })
      .eq('circle_id', circleId)
      .is('resolved_at', null);

    if (error) throw error;
    return count || 0;
  } catch {
    return 0;
  }
}

/**
 * Mark tamper event as resolved
 */
export async function resolveTamperEvent(eventId: string): Promise<boolean> {
  try {
    const { error } = await supabase
      .from('tamper_events')
      .update({ resolved_at: new Date().toISOString() })
      .eq('id', eventId);

    return !error;
  } catch {
    return false;
  }
}
