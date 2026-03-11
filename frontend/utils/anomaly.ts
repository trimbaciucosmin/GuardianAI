import { LiveLocation, Place, MonitoredTrip, AnomalyAlert, AlertType, AlertSeverity } from '../types';
import { calculateDistance, isInsideGeofence } from './helpers';
import { v4 as uuidv4 } from 'uuid';

// Rule-based anomaly detection configuration
const ANOMALY_CONFIG = {
  // Unexpected stop detection
  STATIONARY_THRESHOLD_MINUTES: 15,
  MIN_STOP_DURATION_MS: 15 * 60 * 1000, // 15 minutes
  
  // Route deviation detection
  ROUTE_DEVIATION_THRESHOLD_METERS: 500, // 500m from expected route
  
  // ETA exceeded detection  
  ETA_BUFFER_PERCENTAGE: 0.5, // 50% buffer before alerting
  
  // Phone offline detection
  OFFLINE_THRESHOLD_MINUTES: 10,
  
  // Low battery threshold
  LOW_BATTERY_THRESHOLD: 15,
  CRITICAL_BATTERY_THRESHOLD: 5,
  
  // Speed anomaly detection
  MAX_WALKING_SPEED_KMH: 7,
  MAX_VEHICLE_SPEED_KMH: 150,
};

// Store for tracking location history (in memory for simplicity)
const locationHistory: Map<string, LiveLocation[]> = new Map();
const lastAlerts: Map<string, Map<AlertType, number>> = new Map(); // userId -> alertType -> timestamp

// Add location to history
export const trackLocation = (userId: string, location: LiveLocation): void => {
  const history = locationHistory.get(userId) || [];
  history.push(location);
  
  // Keep only last 100 locations per user
  if (history.length > 100) {
    history.shift();
  }
  
  locationHistory.set(userId, history);
};

// Check if enough time has passed since last alert of same type (debounce)
const canTriggerAlert = (userId: string, alertType: AlertType, debounceMs: number = 5 * 60 * 1000): boolean => {
  const userAlerts = lastAlerts.get(userId);
  if (!userAlerts) return true;
  
  const lastAlertTime = userAlerts.get(alertType);
  if (!lastAlertTime) return true;
  
  return Date.now() - lastAlertTime > debounceMs;
};

// Record that an alert was triggered
const recordAlertTriggered = (userId: string, alertType: AlertType): void => {
  if (!lastAlerts.has(userId)) {
    lastAlerts.set(userId, new Map());
  }
  lastAlerts.get(userId)!.set(alertType, Date.now());
};

// Create alert object
const createAlert = (
  userId: string,
  circleId: string,
  alertType: AlertType,
  title: string,
  message: string,
  severity: AlertSeverity,
  data?: any
): AnomalyAlert => {
  recordAlertTriggered(userId, alertType);
  
  return {
    id: uuidv4(),
    user_id: userId,
    circle_id: circleId,
    alert_type: alertType,
    title,
    message,
    severity,
    data,
    is_read: false,
    created_at: new Date().toISOString(),
  };
};

// Check for unexpected long stop
export const detectUnexpectedStop = (
  userId: string,
  circleId: string,
  currentLocation: LiveLocation,
  places: Place[]
): AnomalyAlert | null => {
  if (!canTriggerAlert(userId, 'unexpected_stop')) return null;
  
  const history = locationHistory.get(userId) || [];
  if (history.length < 5) return null;
  
  // Check if user has been stationary
  const recentLocations = history.slice(-10);
  const firstLocation = recentLocations[0];
  const timeDiff = new Date(currentLocation.timestamp).getTime() - new Date(firstLocation.timestamp).getTime();
  
  if (timeDiff < ANOMALY_CONFIG.MIN_STOP_DURATION_MS) return null;
  
  // Check if all recent locations are within a small radius
  const isStationary = recentLocations.every(loc => 
    calculateDistance(loc.latitude, loc.longitude, currentLocation.latitude, currentLocation.longitude) < 50
  );
  
  if (!isStationary) return null;
  
  // Check if the stop is at a known place
  const atKnownPlace = places.some(place => 
    isInsideGeofence(currentLocation.latitude, currentLocation.longitude, place.latitude, place.longitude, place.radius)
  );
  
  if (atKnownPlace) return null;
  
  const minutes = Math.round(timeDiff / 60000);
  
  return createAlert(
    userId,
    circleId,
    'unexpected_stop',
    'Unexpected Stop Detected',
    `Stopped in an unfamiliar location for ${minutes} minutes`,
    minutes > 30 ? 'high' : 'medium',
    { latitude: currentLocation.latitude, longitude: currentLocation.longitude, duration_minutes: minutes }
  );
};

// Check if device went offline during active trip
export const detectPhoneOffline = (
  userId: string,
  circleId: string,
  lastSeenTimestamp: string,
  hasActiveTrip: boolean
): AnomalyAlert | null => {
  if (!canTriggerAlert(userId, 'phone_offline')) return null;
  
  const now = Date.now();
  const lastSeen = new Date(lastSeenTimestamp).getTime();
  const offlineMinutes = (now - lastSeen) / 60000;
  
  if (offlineMinutes < ANOMALY_CONFIG.OFFLINE_THRESHOLD_MINUTES) return null;
  
  const severity: AlertSeverity = hasActiveTrip ? 'high' : offlineMinutes > 30 ? 'medium' : 'low';
  
  return createAlert(
    userId,
    circleId,
    'phone_offline',
    'Phone Appears Offline',
    `No location update for ${Math.round(offlineMinutes)} minutes${hasActiveTrip ? ' during active trip' : ''}`,
    severity,
    { offline_minutes: Math.round(offlineMinutes), has_active_trip: hasActiveTrip }
  );
};

// Check for low battery during trip
export const detectLowBattery = (
  userId: string,
  circleId: string,
  batteryLevel: number,
  hasActiveTrip: boolean
): AnomalyAlert | null => {
  if (!canTriggerAlert(userId, 'low_battery', 30 * 60 * 1000)) return null; // 30 min debounce
  
  if (batteryLevel > ANOMALY_CONFIG.LOW_BATTERY_THRESHOLD) return null;
  
  const isCritical = batteryLevel <= ANOMALY_CONFIG.CRITICAL_BATTERY_THRESHOLD;
  const severity: AlertSeverity = isCritical ? 'high' : hasActiveTrip ? 'medium' : 'low';
  
  return createAlert(
    userId,
    circleId,
    'low_battery',
    isCritical ? 'Critical Battery Level' : 'Low Battery',
    `Battery at ${batteryLevel}%${hasActiveTrip ? ' during active trip' : ''}`,
    severity,
    { battery_level: batteryLevel, has_active_trip: hasActiveTrip }
  );
};

// Check if ETA exceeded for monitored trip
export const detectETAExceeded = (
  userId: string,
  circleId: string,
  trip: MonitoredTrip,
  currentLocation: LiveLocation
): AnomalyAlert | null => {
  if (!canTriggerAlert(userId, 'eta_exceeded')) return null;
  
  const startTime = new Date(trip.started_at).getTime();
  const expectedEndTime = startTime + (trip.eta_minutes * 60 * 1000);
  const bufferTime = trip.eta_minutes * ANOMALY_CONFIG.ETA_BUFFER_PERCENTAGE * 60 * 1000;
  
  if (Date.now() < expectedEndTime + bufferTime) return null;
  
  // Check if user is close to destination
  const distanceToDestination = calculateDistance(
    currentLocation.latitude,
    currentLocation.longitude,
    trip.destination_latitude,
    trip.destination_longitude
  );
  
  // If within 200m of destination, they're almost there
  if (distanceToDestination < 200) return null;
  
  const minutesOverdue = Math.round((Date.now() - expectedEndTime) / 60000);
  
  return createAlert(
    userId,
    circleId,
    'eta_exceeded',
    'Trip Taking Longer Than Expected',
    `Expected arrival was ${minutesOverdue} minutes ago, still ${Math.round(distanceToDestination)}m away`,
    minutesOverdue > 30 ? 'high' : 'medium',
    { 
      minutes_overdue: minutesOverdue, 
      distance_remaining: distanceToDestination,
      destination: trip.destination_name 
    }
  );
};

// Check if left a safe zone unexpectedly
export const detectLeftSafeZone = (
  userId: string,
  circleId: string,
  currentLocation: LiveLocation,
  places: Place[],
  expectedPlaceId?: string
): AnomalyAlert | null => {
  if (!canTriggerAlert(userId, 'left_safe_zone')) return null;
  
  const history = locationHistory.get(userId) || [];
  if (history.length < 2) return null;
  
  const previousLocation = history[history.length - 2];
  
  // Find places user was previously inside
  const wasInsidePlaces = places.filter(place => 
    isInsideGeofence(previousLocation.latitude, previousLocation.longitude, place.latitude, place.longitude, place.radius)
  );
  
  if (wasInsidePlaces.length === 0) return null;
  
  // Check if user left any of those places
  for (const place of wasInsidePlaces) {
    const stillInside = isInsideGeofence(
      currentLocation.latitude, 
      currentLocation.longitude, 
      place.latitude, 
      place.longitude, 
      place.radius
    );
    
    if (!stillInside && (!expectedPlaceId || place.id !== expectedPlaceId)) {
      return createAlert(
        userId,
        circleId,
        'left_safe_zone',
        `Left ${place.name}`,
        `Departed from ${place.name}`,
        'low',
        { place_id: place.id, place_name: place.name }
      );
    }
  }
  
  return null;
};

// Run all anomaly checks
export const runAnomalyDetection = (
  userId: string,
  circleId: string,
  currentLocation: LiveLocation,
  places: Place[],
  activeTrip: MonitoredTrip | null,
  batteryLevel: number,
  lastSeenTimestamp: string
): AnomalyAlert[] => {
  const alerts: AnomalyAlert[] = [];
  
  // Track the new location
  trackLocation(userId, currentLocation);
  
  // Run detection checks
  const stopAlert = detectUnexpectedStop(userId, circleId, currentLocation, places);
  if (stopAlert) alerts.push(stopAlert);
  
  const offlineAlert = detectPhoneOffline(userId, circleId, lastSeenTimestamp, !!activeTrip);
  if (offlineAlert) alerts.push(offlineAlert);
  
  const batteryAlert = detectLowBattery(userId, circleId, batteryLevel, !!activeTrip);
  if (batteryAlert) alerts.push(batteryAlert);
  
  if (activeTrip) {
    const etaAlert = detectETAExceeded(userId, circleId, activeTrip, currentLocation);
    if (etaAlert) alerts.push(etaAlert);
  }
  
  const zoneAlert = detectLeftSafeZone(userId, circleId, currentLocation, places);
  if (zoneAlert) alerts.push(zoneAlert);
  
  return alerts;
};
