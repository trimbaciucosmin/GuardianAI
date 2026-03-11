/**
 * useLocationTracking Hook
 * 
 * React hook for managing location tracking in components.
 * Provides reactive state and control functions.
 */

import { useState, useEffect, useCallback } from 'react';
import {
  subscribeToTrackingState,
  startForegroundTracking,
  startBackgroundTracking,
  stopAllTracking,
  enableSOSMode,
  disableSOSMode,
  getPermissionStatus,
  requestForegroundPermission,
  requestBackgroundPermission,
  getTrackingStatusText,
  isBackgroundTrackingAvailable,
  initializeAppStateListener,
  removeAppStateListener,
  TRACKING_CONFIG,
} from '../lib/locationService';

interface UseLocationTrackingOptions {
  autoStart?: boolean;
  enableBackground?: boolean;
}

interface LocationTrackingHook {
  // State
  isTracking: boolean;
  isForeground: boolean;
  isSOSMode: boolean;
  permissionStatus: string;
  backgroundPermissionStatus: string;
  lastLocation: {
    latitude: number;
    longitude: number;
    accuracy: number | null;
    speed: number | null;
    timestamp: Date;
  } | null;
  lastBatteryLevel: number;
  error: string | null;
  statusText: string;
  
  // Actions
  startTracking: () => Promise<boolean>;
  stopTracking: () => Promise<void>;
  requestPermissions: () => Promise<boolean>;
  enableSOS: () => Promise<void>;
  disableSOS: () => Promise<void>;
  
  // Info
  isBackgroundAvailable: boolean;
  backgroundAvailabilityReason: string;
}

export const useLocationTracking = (
  userId: string | null,
  circleId: string | null,
  options: UseLocationTrackingOptions = {}
): LocationTrackingHook => {
  const { autoStart = false, enableBackground = true } = options;

  // State from location service
  const [isTracking, setIsTracking] = useState(false);
  const [isForeground, setIsForeground] = useState(true);
  const [isSOSMode, setIsSOSMode] = useState(false);
  const [permissionStatus, setPermissionStatus] = useState('undetermined');
  const [backgroundPermissionStatus, setBackgroundPermissionStatus] = useState('undetermined');
  const [lastLocation, setLastLocation] = useState<LocationTrackingHook['lastLocation']>(null);
  const [lastBatteryLevel, setLastBatteryLevel] = useState(100);
  const [error, setError] = useState<string | null>(null);
  const [statusText, setStatusText] = useState('Location tracking off');
  
  // Background availability
  const [isBackgroundAvailable, setIsBackgroundAvailable] = useState(false);
  const [backgroundAvailabilityReason, setBackgroundAvailabilityReason] = useState('');

  // Subscribe to tracking state changes
  useEffect(() => {
    const unsubscribe = subscribeToTrackingState((state) => {
      setIsTracking(state.isTracking);
      setIsForeground(state.isForeground);
      setIsSOSMode(state.isSOSMode);
      setPermissionStatus(state.permissionStatus);
      setBackgroundPermissionStatus(state.backgroundPermissionStatus);
      setLastBatteryLevel(state.lastBatteryLevel);
      setError(state.error);
      setStatusText(getTrackingStatusText());
      
      if (state.lastLocation) {
        setLastLocation({
          latitude: state.lastLocation.coords.latitude,
          longitude: state.lastLocation.coords.longitude,
          accuracy: state.lastLocation.coords.accuracy,
          speed: state.lastLocation.coords.speed,
          timestamp: new Date(state.lastLocation.timestamp),
        });
      }
    });

    // Initialize app state listener
    initializeAppStateListener();

    // Check background availability
    isBackgroundTrackingAvailable().then(({ available, reason }) => {
      setIsBackgroundAvailable(available);
      setBackgroundAvailabilityReason(reason);
    });

    // Get initial permission status
    getPermissionStatus();

    return () => {
      unsubscribe();
      removeAppStateListener();
    };
  }, []);

  // Auto-start tracking when userId and circleId are available
  useEffect(() => {
    if (autoStart && userId && circleId && !isTracking) {
      startTracking();
    }
  }, [autoStart, userId, circleId]);

  // Request permissions
  const requestPermissions = useCallback(async (): Promise<boolean> => {
    const foreground = await requestForegroundPermission();
    if (!foreground) return false;
    
    if (enableBackground) {
      await requestBackgroundPermission();
    }
    
    return true;
  }, [enableBackground]);

  // Start tracking
  const startTracking = useCallback(async (): Promise<boolean> => {
    if (!userId || !circleId) {
      setError('User ID and Circle ID required');
      return false;
    }

    if (enableBackground) {
      return await startBackgroundTracking(userId, circleId);
    } else {
      return await startForegroundTracking(userId, circleId);
    }
  }, [userId, circleId, enableBackground]);

  // Stop tracking
  const stopTracking = useCallback(async (): Promise<void> => {
    await stopAllTracking();
  }, []);

  // Enable SOS mode
  const enableSOS = useCallback(async (): Promise<void> => {
    await enableSOSMode();
  }, []);

  // Disable SOS mode
  const disableSOS = useCallback(async (): Promise<void> => {
    await disableSOSMode();
  }, []);

  return {
    // State
    isTracking,
    isForeground,
    isSOSMode,
    permissionStatus,
    backgroundPermissionStatus,
    lastLocation,
    lastBatteryLevel,
    error,
    statusText,
    
    // Actions
    startTracking,
    stopTracking,
    requestPermissions,
    enableSOS,
    disableSOS,
    
    // Info
    isBackgroundAvailable,
    backgroundAvailabilityReason,
  };
};

export default useLocationTracking;
