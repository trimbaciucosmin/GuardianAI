/**
 * GUARDIAN AI - Supabase Realtime Service
 * 
 * Manages real-time subscriptions to Supabase tables for live updates.
 * 
 * ========================================
 * SUBSCRIPTION ARCHITECTURE
 * ========================================
 * 
 * Channel: guardian-{circleId}
 * 
 * Tables subscribed:
 * ┌─────────────────────┬──────────────────────────────────────┐
 * │ Table               │ Events                               │
 * ├─────────────────────┼──────────────────────────────────────┤
 * │ live_locations      │ INSERT, UPDATE (member positions)    │
 * │ sos_events          │ INSERT, UPDATE (emergency alerts)    │
 * │ anomaly_alerts      │ INSERT (new alerts)                  │
 * │ monitored_trips     │ INSERT, UPDATE (trip status)         │
 * │ geofence_events     │ INSERT (arrivals/departures)         │
 * └─────────────────────┴──────────────────────────────────────┘
 * 
 * ========================================
 * SCREEN SUBSCRIPTIONS
 * ========================================
 * 
 * Map Screen:
 *   - live_locations → Update member markers on map
 *   - sos_events → Show SOS alert overlay
 *   - monitored_trips → Show active trip indicators
 * 
 * Family Screen:
 *   - live_locations → Update member online status
 *   - geofence_events → Show arrival/departure badges
 * 
 * Alerts Screen:
 *   - anomaly_alerts → Add new alerts to feed
 *   - sos_events → Highlight critical alerts
 * 
 * Global (App-wide):
 *   - sos_events → Show emergency modal anywhere
 *   - anomaly_alerts → Update unread badge count
 */

import { RealtimeChannel, RealtimePostgresChangesPayload } from '@supabase/supabase-js';
import { supabase, isSupabaseConfigured } from './supabase';
import { 
  LiveLocation, 
  SOSEvent, 
  AnomalyAlert, 
  MonitoredTrip, 
  GeofenceEvent,
  MapMember 
} from '../types';

// Event types for listeners
export type RealtimeEventType = 
  | 'location_update'
  | 'sos_event'
  | 'alert'
  | 'trip_update'
  | 'geofence_event';

// Payload types
export interface RealtimePayload {
  type: RealtimeEventType;
  action: 'INSERT' | 'UPDATE' | 'DELETE';
  data: any;
  oldData?: any;
}

// Listener callback type
export type RealtimeListener = (payload: RealtimePayload) => void;

// Subscription state
interface SubscriptionState {
  channel: RealtimeChannel | null;
  circleId: string | null;
  isConnected: boolean;
  connectionError: string | null;
  listeners: Set<RealtimeListener>;
}

let state: SubscriptionState = {
  channel: null,
  circleId: null,
  isConnected: false,
  connectionError: null,
  listeners: new Set(),
};

// Status listeners for UI updates
type StatusListener = (status: { isConnected: boolean; error: string | null }) => void;
const statusListeners: Set<StatusListener> = new Set();

/**
 * Subscribe to connection status changes
 */
export const subscribeToConnectionStatus = (listener: StatusListener): (() => void) => {
  statusListeners.add(listener);
  listener({ isConnected: state.isConnected, error: state.connectionError });
  return () => statusListeners.delete(listener);
};

/**
 * Notify status listeners
 */
const notifyStatusListeners = () => {
  const status = { isConnected: state.isConnected, error: state.connectionError };
  statusListeners.forEach(listener => listener(status));
};

/**
 * Add a realtime event listener
 */
export const addRealtimeListener = (listener: RealtimeListener): (() => void) => {
  state.listeners.add(listener);
  return () => state.listeners.delete(listener);
};

/**
 * Notify all listeners of an event
 */
const notifyListeners = (payload: RealtimePayload) => {
  console.log(`[Realtime] ${payload.type} - ${payload.action}:`, payload.data);
  state.listeners.forEach(listener => {
    try {
      listener(payload);
    } catch (error) {
      console.error('[Realtime] Listener error:', error);
    }
  });
};

/**
 * Handle live_locations changes
 */
const handleLocationChange = (
  payload: RealtimePostgresChangesPayload<{ [key: string]: any }>
) => {
  const eventPayload: RealtimePayload = {
    type: 'location_update',
    action: payload.eventType as 'INSERT' | 'UPDATE' | 'DELETE',
    data: payload.new as LiveLocation,
    oldData: payload.old,
  };
  notifyListeners(eventPayload);
};

/**
 * Handle sos_events changes
 */
const handleSOSChange = (
  payload: RealtimePostgresChangesPayload<{ [key: string]: any }>
) => {
  const eventPayload: RealtimePayload = {
    type: 'sos_event',
    action: payload.eventType as 'INSERT' | 'UPDATE' | 'DELETE',
    data: payload.new as SOSEvent,
    oldData: payload.old,
  };
  notifyListeners(eventPayload);
};

/**
 * Handle anomaly_alerts changes
 */
const handleAlertChange = (
  payload: RealtimePostgresChangesPayload<{ [key: string]: any }>
) => {
  const eventPayload: RealtimePayload = {
    type: 'alert',
    action: payload.eventType as 'INSERT' | 'UPDATE' | 'DELETE',
    data: payload.new as AnomalyAlert,
    oldData: payload.old,
  };
  notifyListeners(eventPayload);
};

/**
 * Handle monitored_trips changes
 */
const handleTripChange = (
  payload: RealtimePostgresChangesPayload<{ [key: string]: any }>
) => {
  const eventPayload: RealtimePayload = {
    type: 'trip_update',
    action: payload.eventType as 'INSERT' | 'UPDATE' | 'DELETE',
    data: payload.new as MonitoredTrip,
    oldData: payload.old,
  };
  notifyListeners(eventPayload);
};

/**
 * Handle geofence_events changes
 */
const handleGeofenceChange = (
  payload: RealtimePostgresChangesPayload<{ [key: string]: any }>
) => {
  const eventPayload: RealtimePayload = {
    type: 'geofence_event',
    action: payload.eventType as 'INSERT' | 'UPDATE' | 'DELETE',
    data: payload.new as GeofenceEvent,
    oldData: payload.old,
  };
  notifyListeners(eventPayload);
};

/**
 * Subscribe to all realtime updates for a circle
 */
export const subscribeToCircle = async (circleId: string): Promise<boolean> => {
  if (!isSupabaseConfigured()) {
    console.log('[Realtime] Supabase not configured, skipping subscription');
    state.connectionError = 'Supabase not configured';
    notifyStatusListeners();
    return false;
  }

  // Unsubscribe from previous circle if different
  if (state.channel && state.circleId !== circleId) {
    await unsubscribeFromCircle();
  }

  // Already subscribed to this circle
  if (state.channel && state.circleId === circleId && state.isConnected) {
    console.log('[Realtime] Already subscribed to circle:', circleId);
    return true;
  }

  console.log('[Realtime] Subscribing to circle:', circleId);

  try {
    // Create a unique channel for this circle
    const channelName = `guardian-${circleId}`;
    
    state.channel = supabase
      .channel(channelName)
      // Live locations - member position updates
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'live_locations',
          filter: `circle_id=eq.${circleId}`,
        },
        handleLocationChange
      )
      // SOS events - emergency alerts
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'sos_events',
          filter: `circle_id=eq.${circleId}`,
        },
        handleSOSChange
      )
      // Anomaly alerts - safety notifications
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'anomaly_alerts',
          filter: `circle_id=eq.${circleId}`,
        },
        handleAlertChange
      )
      // Monitored trips - trip status changes
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'monitored_trips',
          filter: `circle_id=eq.${circleId}`,
        },
        handleTripChange
      )
      // Geofence events - arrivals/departures
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'geofence_events',
        },
        handleGeofenceChange
      );

    // Subscribe and wait for connection
    const status = await state.channel.subscribe((status) => {
      console.log('[Realtime] Subscription status:', status);
      
      if (status === 'SUBSCRIBED') {
        state.isConnected = true;
        state.connectionError = null;
        state.circleId = circleId;
        notifyStatusListeners();
      } else if (status === 'CLOSED' || status === 'CHANNEL_ERROR') {
        state.isConnected = false;
        state.connectionError = `Connection ${status.toLowerCase()}`;
        notifyStatusListeners();
      }
    });

    return state.isConnected;
  } catch (error: any) {
    console.error('[Realtime] Subscription error:', error);
    state.connectionError = error.message;
    state.isConnected = false;
    notifyStatusListeners();
    return false;
  }
};

/**
 * Unsubscribe from current circle
 */
export const unsubscribeFromCircle = async (): Promise<void> => {
  if (state.channel) {
    console.log('[Realtime] Unsubscribing from circle:', state.circleId);
    
    try {
      await supabase.removeChannel(state.channel);
    } catch (error) {
      console.error('[Realtime] Unsubscribe error:', error);
    }
    
    state.channel = null;
    state.circleId = null;
    state.isConnected = false;
    state.connectionError = null;
    notifyStatusListeners();
  }
};

/**
 * Get current subscription state
 */
export const getRealtimeState = () => ({
  circleId: state.circleId,
  isConnected: state.isConnected,
  connectionError: state.connectionError,
});

/**
 * Check if connected to realtime
 */
export const isRealtimeConnected = (): boolean => state.isConnected;

/**
 * Reconnect to realtime (useful after network issues)
 */
export const reconnect = async (): Promise<boolean> => {
  if (state.circleId) {
    await unsubscribeFromCircle();
    return await subscribeToCircle(state.circleId);
  }
  return false;
};
