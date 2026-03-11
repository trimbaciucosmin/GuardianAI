/**
 * useRealtimeSubscription Hook
 * 
 * React hook for subscribing to Supabase realtime updates.
 * Automatically manages subscription lifecycle based on circleId.
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import {
  subscribeToCircle,
  unsubscribeFromCircle,
  addRealtimeListener,
  subscribeToConnectionStatus,
  getRealtimeState,
  reconnect,
  RealtimePayload,
  RealtimeEventType,
} from '../lib/realtimeService';

interface UseRealtimeOptions {
  // Filter events by type
  eventTypes?: RealtimeEventType[];
  // Auto-subscribe when circleId is provided
  autoSubscribe?: boolean;
}

interface UseRealtimeReturn {
  // Connection state
  isConnected: boolean;
  connectionError: string | null;
  
  // Last received events (by type)
  lastLocationUpdate: RealtimePayload | null;
  lastSOSEvent: RealtimePayload | null;
  lastAlert: RealtimePayload | null;
  lastTripUpdate: RealtimePayload | null;
  lastGeofenceEvent: RealtimePayload | null;
  
  // All events (for debugging)
  recentEvents: RealtimePayload[];
  
  // Actions
  subscribe: () => Promise<boolean>;
  unsubscribe: () => Promise<void>;
  reconnect: () => Promise<boolean>;
}

export const useRealtimeSubscription = (
  circleId: string | null,
  options: UseRealtimeOptions = {}
): UseRealtimeReturn => {
  const { eventTypes, autoSubscribe = true } = options;

  // Connection state
  const [isConnected, setIsConnected] = useState(false);
  const [connectionError, setConnectionError] = useState<string | null>(null);

  // Last events by type
  const [lastLocationUpdate, setLastLocationUpdate] = useState<RealtimePayload | null>(null);
  const [lastSOSEvent, setLastSOSEvent] = useState<RealtimePayload | null>(null);
  const [lastAlert, setLastAlert] = useState<RealtimePayload | null>(null);
  const [lastTripUpdate, setLastTripUpdate] = useState<RealtimePayload | null>(null);
  const [lastGeofenceEvent, setLastGeofenceEvent] = useState<RealtimePayload | null>(null);

  // Recent events buffer (for debugging)
  const [recentEvents, setRecentEvents] = useState<RealtimePayload[]>([]);
  const MAX_RECENT_EVENTS = 50;

  // Track if we should filter events
  const eventTypesRef = useRef(eventTypes);
  eventTypesRef.current = eventTypes;

  // Handle incoming realtime events
  const handleEvent = useCallback((payload: RealtimePayload) => {
    // Filter by event type if specified
    if (eventTypesRef.current && !eventTypesRef.current.includes(payload.type)) {
      return;
    }

    // Update the appropriate state based on event type
    switch (payload.type) {
      case 'location_update':
        setLastLocationUpdate(payload);
        break;
      case 'sos_event':
        setLastSOSEvent(payload);
        break;
      case 'alert':
        setLastAlert(payload);
        break;
      case 'trip_update':
        setLastTripUpdate(payload);
        break;
      case 'geofence_event':
        setLastGeofenceEvent(payload);
        break;
    }

    // Add to recent events buffer
    setRecentEvents(prev => {
      const updated = [payload, ...prev];
      return updated.slice(0, MAX_RECENT_EVENTS);
    });
  }, []);

  // Subscribe to connection status
  useEffect(() => {
    const unsubscribe = subscribeToConnectionStatus(({ isConnected: connected, error }) => {
      setIsConnected(connected);
      setConnectionError(error);
    });

    return unsubscribe;
  }, []);

  // Subscribe to realtime events
  useEffect(() => {
    const unsubscribe = addRealtimeListener(handleEvent);
    return unsubscribe;
  }, [handleEvent]);

  // Auto-subscribe when circleId changes
  useEffect(() => {
    if (autoSubscribe && circleId) {
      subscribeToCircle(circleId);
    }

    return () => {
      // Don't unsubscribe on unmount if other components might be using it
      // The subscription is managed globally
    };
  }, [circleId, autoSubscribe]);

  // Manual subscribe
  const subscribe = useCallback(async (): Promise<boolean> => {
    if (!circleId) {
      setConnectionError('No circle ID provided');
      return false;
    }
    return await subscribeToCircle(circleId);
  }, [circleId]);

  // Manual unsubscribe
  const unsubscribe = useCallback(async (): Promise<void> => {
    await unsubscribeFromCircle();
  }, []);

  // Reconnect
  const handleReconnect = useCallback(async (): Promise<boolean> => {
    return await reconnect();
  }, []);

  return {
    isConnected,
    connectionError,
    lastLocationUpdate,
    lastSOSEvent,
    lastAlert,
    lastTripUpdate,
    lastGeofenceEvent,
    recentEvents,
    subscribe,
    unsubscribe,
    reconnect: handleReconnect,
  };
};

/**
 * Hook specifically for location updates
 */
export const useRealtimeLocations = (circleId: string | null) => {
  const { isConnected, lastLocationUpdate } = useRealtimeSubscription(circleId, {
    eventTypes: ['location_update'],
  });

  return {
    isConnected,
    lastUpdate: lastLocationUpdate,
    location: lastLocationUpdate?.data || null,
    userId: lastLocationUpdate?.data?.user_id || null,
  };
};

/**
 * Hook specifically for SOS events
 */
export const useRealtimeSOS = (circleId: string | null) => {
  const { isConnected, lastSOSEvent } = useRealtimeSubscription(circleId, {
    eventTypes: ['sos_event'],
  });

  const isActiveSOSInCircle = lastSOSEvent?.data?.status === 'active';

  return {
    isConnected,
    lastEvent: lastSOSEvent,
    sosEvent: lastSOSEvent?.data || null,
    isActiveSOSInCircle,
    sosUserId: lastSOSEvent?.data?.user_id || null,
  };
};

/**
 * Hook specifically for alerts
 */
export const useRealtimeAlerts = (circleId: string | null) => {
  const [newAlerts, setNewAlerts] = useState<RealtimePayload[]>([]);

  const { isConnected, lastAlert } = useRealtimeSubscription(circleId, {
    eventTypes: ['alert'],
  });

  // Accumulate new alerts
  useEffect(() => {
    if (lastAlert && lastAlert.action === 'INSERT') {
      setNewAlerts(prev => [lastAlert, ...prev].slice(0, 20));
    }
  }, [lastAlert]);

  // Clear new alerts
  const clearNewAlerts = useCallback(() => {
    setNewAlerts([]);
  }, []);

  return {
    isConnected,
    lastAlert,
    newAlerts,
    newAlertCount: newAlerts.length,
    clearNewAlerts,
  };
};

/**
 * Hook specifically for trip updates
 */
export const useRealtimeTrips = (circleId: string | null) => {
  const { isConnected, lastTripUpdate } = useRealtimeSubscription(circleId, {
    eventTypes: ['trip_update'],
  });

  return {
    isConnected,
    lastUpdate: lastTripUpdate,
    trip: lastTripUpdate?.data || null,
    tripStatus: lastTripUpdate?.data?.status || null,
  };
};

export default useRealtimeSubscription;
