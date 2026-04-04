/**
 * Geofence Service
 * Auto-detects arrival/departure from Safe Places
 * Sends notifications to parents when children enter/leave geofences
 */

import * as Location from 'expo-location';
import * as TaskManager from 'expo-task-manager';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '../lib/supabase';
import { sendLocalNotification, getNotificationContent, notifyParentsInCircle } from './pushNotificationService';

// Task name for background geofencing
const GEOFENCE_TASK_NAME = 'guardian-geofence-task';

// Storage keys
const LAST_GEOFENCE_STATE_KEY = '@guardian_geofence_state';
const GEOFENCE_COOLDOWN_KEY = '@guardian_geofence_cooldown';
const GEOFENCE_CONFIRMATION_KEY = '@guardian_geofence_confirmation';

// Cooldown period to avoid spam notifications (10 minutes - increased from 5)
const NOTIFICATION_COOLDOWN_MS = 10 * 60 * 1000;

// Hysteresis buffer to prevent flickering at boundary (meters)
// Entry requires being INSIDE radius, exit requires being OUTSIDE radius + buffer
const GEOFENCE_HYSTERESIS_BUFFER = 30; // 30 meters buffer

// Confirmation checks - must be inside/outside for X consecutive checks
const CONFIRMATION_CHECKS_REQUIRED = 2;

export interface SafePlace {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
  radius: number;
  type: 'home' | 'school' | 'work' | 'custom';
  circle_id: string;
}

interface GeofenceState {
  placeId: string;
  placeName: string;
  isInside: boolean;
  enteredAt?: string;
  leftAt?: string;
}

interface GeofenceEvent {
  type: 'arrival' | 'departure';
  place: SafePlace;
  timestamp: string;
  userId: string;
  circleId: string;
}

/**
 * Calculate distance between two coordinates using Haversine formula
 */
function calculateDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371e3; // Earth's radius in meters
  const φ1 = (lat1 * Math.PI) / 180;
  const φ2 = (lat2 * Math.PI) / 180;
  const Δφ = ((lat2 - lat1) * Math.PI) / 180;
  const Δλ = ((lon2 - lon1) * Math.PI) / 180;

  const a =
    Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
    Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c; // Distance in meters
}

/**
 * Check if a location is inside a geofence (for ENTRY detection)
 */
function isInsideGeofence(
  latitude: number,
  longitude: number,
  place: SafePlace
): boolean {
  const distance = calculateDistance(
    latitude,
    longitude,
    place.latitude,
    place.longitude
  );
  return distance <= place.radius;
}

/**
 * Check if location is clearly outside geofence (for EXIT detection)
 * Uses hysteresis buffer to prevent flickering at boundary
 */
function isClearlyOutsideGeofence(
  latitude: number,
  longitude: number,
  place: SafePlace
): boolean {
  const distance = calculateDistance(
    latitude,
    longitude,
    place.latitude,
    place.longitude
  );
  // Must be outside radius + buffer to trigger exit
  return distance > (place.radius + GEOFENCE_HYSTERESIS_BUFFER);
}

/**
 * Get confirmation counts from storage
 */
async function getConfirmationCounts(): Promise<Record<string, { entry: number; exit: number }>> {
  try {
    const data = await AsyncStorage.getItem(GEOFENCE_CONFIRMATION_KEY);
    return data ? JSON.parse(data) : {};
  } catch {
    return {};
  }
}

/**
 * Save confirmation counts to storage
 */
async function saveConfirmationCounts(counts: Record<string, { entry: number; exit: number }>): Promise<void> {
  try {
    await AsyncStorage.setItem(GEOFENCE_CONFIRMATION_KEY, JSON.stringify(counts));
  } catch (error) {
    console.error('[Geofence] Error saving confirmation counts:', error);
  }
}

/**
 * Get the previous geofence state from storage
 */
async function getGeofenceState(): Promise<Record<string, GeofenceState>> {
  try {
    const state = await AsyncStorage.getItem(LAST_GEOFENCE_STATE_KEY);
    return state ? JSON.parse(state) : {};
  } catch {
    return {};
  }
}

/**
 * Save geofence state to storage
 */
async function saveGeofenceState(state: Record<string, GeofenceState>): Promise<void> {
  try {
    await AsyncStorage.setItem(LAST_GEOFENCE_STATE_KEY, JSON.stringify(state));
  } catch (error) {
    console.error('[Geofence] Error saving state:', error);
  }
}

/**
 * Check if we're in cooldown for a specific place
 */
async function isInCooldown(placeId: string, eventType: 'arrival' | 'departure'): Promise<boolean> {
  try {
    const cooldowns = await AsyncStorage.getItem(GEOFENCE_COOLDOWN_KEY);
    if (!cooldowns) return false;
    
    const parsed = JSON.parse(cooldowns);
    const key = `${placeId}_${eventType}`;
    const lastTime = parsed[key];
    
    if (!lastTime) return false;
    
    const elapsed = Date.now() - new Date(lastTime).getTime();
    return elapsed < NOTIFICATION_COOLDOWN_MS;
  } catch {
    return false;
  }
}

/**
 * Set cooldown for a specific place event
 */
async function setCooldown(placeId: string, eventType: 'arrival' | 'departure'): Promise<void> {
  try {
    const cooldowns = await AsyncStorage.getItem(GEOFENCE_COOLDOWN_KEY);
    const parsed = cooldowns ? JSON.parse(cooldowns) : {};
    
    const key = `${placeId}_${eventType}`;
    parsed[key] = new Date().toISOString();
    
    await AsyncStorage.setItem(GEOFENCE_COOLDOWN_KEY, JSON.stringify(parsed));
  } catch (error) {
    console.error('[Geofence] Error setting cooldown:', error);
  }
}

/**
 * Handle geofence event (arrival or departure)
 */
async function handleGeofenceEvent(event: GeofenceEvent): Promise<void> {
  const { type, place, userId, circleId } = event;
  
  console.log(`[Geofence] ${type.toUpperCase()} at ${place.name}`);
  
  // Check cooldown
  if (await isInCooldown(place.id, type)) {
    console.log(`[Geofence] Skipping notification - in cooldown for ${place.name}`);
    return;
  }
  
  // Set cooldown
  await setCooldown(place.id, type);
  
  try {
    // Get child's name
    const { data: profile } = await supabase
      .from('profiles')
      .select('name')
      .eq('id', userId)
      .single();
    
    const childName = profile?.name || 'Your child';
    
    // Create geofence event in database
    await supabase.from('geofence_events').insert({
      user_id: userId,
      circle_id: circleId,
      place_id: place.id,
      event_type: type,
      place_name: place.name,
      detected_at: new Date().toISOString(),
    }).catch(() => {
      // Table might not exist yet, that's okay
      console.log('[Geofence] Could not save event to database');
    });
    
    // Get notification content
    const notificationType = type === 'arrival' ? 'arrival' : 'departure';
    const content = getNotificationContent(notificationType, childName, 'en', {
      placeName: place.name,
    });
    
    // Send local notification
    await sendLocalNotification({
      type: notificationType,
      title: content.title,
      body: content.body,
      data: {
        placeId: place.id,
        placeName: place.name,
        placeType: place.type,
        childId: userId,
        childName,
        eventType: type,
      },
    });
    
    // Notify all parents in the circle
    await notifyParentsInCircle(circleId, {
      type: notificationType,
      title: content.title,
      body: content.body,
      data: {
        placeId: place.id,
        placeName: place.name,
        childId: userId,
        childName,
      },
    }, userId);
    
    console.log(`[Geofence] Notification sent for ${type} at ${place.name}`);
  } catch (error) {
    console.error('[Geofence] Error handling event:', error);
  }
}

/**
 * Check geofences for a given location
 * Uses hysteresis and confirmation to reduce false positives
 */
export async function checkGeofences(
  latitude: number,
  longitude: number,
  userId: string,
  circleId: string,
  safePlaces: SafePlace[]
): Promise<void> {
  if (!safePlaces || safePlaces.length === 0) {
    return;
  }
  
  const previousState = await getGeofenceState();
  const confirmationCounts = await getConfirmationCounts();
  const newState: Record<string, GeofenceState> = {};
  const newConfirmations: Record<string, { entry: number; exit: number }> = { ...confirmationCounts };
  
  for (const place of safePlaces) {
    const isInside = isInsideGeofence(latitude, longitude, place);
    const isClearlyOutside = isClearlyOutsideGeofence(latitude, longitude, place);
    const wasInside = previousState[place.id]?.isInside || false;
    
    // Initialize confirmation counter if not exists
    if (!newConfirmations[place.id]) {
      newConfirmations[place.id] = { entry: 0, exit: 0 };
    }
    
    // ENTRY detection with confirmation
    if (isInside && !wasInside) {
      newConfirmations[place.id].entry++;
      newConfirmations[place.id].exit = 0; // Reset exit counter
      
      // Only trigger arrival after consecutive confirmations
      if (newConfirmations[place.id].entry >= CONFIRMATION_CHECKS_REQUIRED) {
        await handleGeofenceEvent({
          type: 'arrival',
          place,
          timestamp: new Date().toISOString(),
          userId,
          circleId,
        });
        newConfirmations[place.id].entry = 0; // Reset after triggering
      }
    } else if (isInside) {
      // Still inside - reset exit counter
      newConfirmations[place.id].exit = 0;
    }
    
    // EXIT detection with hysteresis and confirmation
    if (isClearlyOutside && wasInside) {
      newConfirmations[place.id].exit++;
      newConfirmations[place.id].entry = 0; // Reset entry counter
      
      // Only trigger departure after consecutive confirmations
      if (newConfirmations[place.id].exit >= CONFIRMATION_CHECKS_REQUIRED) {
        await handleGeofenceEvent({
          type: 'departure',
          place,
          timestamp: new Date().toISOString(),
          userId,
          circleId,
        });
        newConfirmations[place.id].exit = 0; // Reset after triggering
      }
    } else if (!isClearlyOutside && wasInside) {
      // In buffer zone - don't reset yet
    }
    
    // Update state - only change isInside after confirmation
    const confirmedInside = isInside && (wasInside || newConfirmations[place.id].entry >= CONFIRMATION_CHECKS_REQUIRED);
    const confirmedOutside = isClearlyOutside && (!wasInside || newConfirmations[place.id].exit >= CONFIRMATION_CHECKS_REQUIRED);
    
    newState[place.id] = {
      placeId: place.id,
      placeName: place.name,
      isInside: confirmedInside || (wasInside && !confirmedOutside),
      enteredAt: confirmedInside && !wasInside 
        ? new Date().toISOString() 
        : previousState[place.id]?.enteredAt,
      leftAt: confirmedOutside && wasInside 
        ? new Date().toISOString() 
        : previousState[place.id]?.leftAt,
    };
  }
  
  await saveGeofenceState(newState);
  await saveConfirmationCounts(newConfirmations);
}

/**
 * Get current geofence status for all places
 */
export async function getCurrentGeofenceStatus(): Promise<Record<string, GeofenceState>> {
  return await getGeofenceState();
}

/**
 * Check which place (if any) the user is currently at
 */
export async function getCurrentPlace(
  latitude: number,
  longitude: number,
  safePlaces: SafePlace[]
): Promise<SafePlace | null> {
  for (const place of safePlaces) {
    if (isInsideGeofence(latitude, longitude, place)) {
      return place;
    }
  }
  return null;
}

/**
 * Start geofence monitoring (called from adaptive tracking service)
 */
export async function startGeofenceMonitoring(
  userId: string,
  circleId: string
): Promise<void> {
  console.log('[Geofence] Starting geofence monitoring');
  
  // The actual monitoring is done through the adaptive tracking service
  // which calls checkGeofences on each location update
}

/**
 * Stop geofence monitoring
 */
export async function stopGeofenceMonitoring(): Promise<void> {
  console.log('[Geofence] Stopping geofence monitoring');
  // Clear stored state
  await AsyncStorage.removeItem(LAST_GEOFENCE_STATE_KEY);
}

/**
 * Clear geofence cooldowns (useful for testing)
 */
export async function clearGeofenceCooldowns(): Promise<void> {
  await AsyncStorage.removeItem(GEOFENCE_COOLDOWN_KEY);
  console.log('[Geofence] Cooldowns cleared');
}

/**
 * Get distance to nearest safe place
 */
export function getDistanceToPlace(
  latitude: number,
  longitude: number,
  place: SafePlace
): number {
  return calculateDistance(latitude, longitude, place.latitude, place.longitude);
}

/**
 * Format distance for display
 */
export function formatDistance(meters: number): string {
  if (meters < 1000) {
    return `${Math.round(meters)}m`;
  }
  return `${(meters / 1000).toFixed(1)}km`;
}
