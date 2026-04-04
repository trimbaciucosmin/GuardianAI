/**
 * Safe Route Service
 * Handles route learning, monitoring, and deviation detection
 */

import * as Location from 'expo-location';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '../lib/supabase';
import { LearnedRoute, RouteWaypoint, RouteDeviation, ActiveRouteMonitor } from '../types/safeRoute';

// Constants
const ROUTE_DEVIATION_THRESHOLD_METERS = 150; // Alert if > 150m from route
const UNUSUAL_STOP_DURATION_SECONDS = 180; // 3 minutes = unusual stop
const MIN_TRIPS_FOR_LEARNING = 3; // Need 3 trips to "learn" a route
const WAYPOINT_INTERVAL_METERS = 50; // Record waypoint every 50m

interface LocationPoint {
  latitude: number;
  longitude: number;
  timestamp: number;
}

// Calculate distance between two points (Haversine formula)
export function calculateDistance(
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

  const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
    Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c;
}

// Find minimum distance from a point to a route (array of waypoints)
export function distanceFromRoute(
  point: { latitude: number; longitude: number },
  waypoints: RouteWaypoint[]
): number {
  if (waypoints.length === 0) return Infinity;
  
  let minDistance = Infinity;
  
  for (const wp of waypoints) {
    const dist = calculateDistance(
      point.latitude,
      point.longitude,
      wp.latitude,
      wp.longitude
    );
    if (dist < minDistance) {
      minDistance = dist;
    }
  }
  
  return minDistance;
}

// Check if user is deviating from route
export function isDeviatingFromRoute(
  currentLocation: { latitude: number; longitude: number },
  route: LearnedRoute
): { isDeviating: boolean; distanceFromRoute: number } {
  const distance = distanceFromRoute(currentLocation, route.waypoints);
  return {
    isDeviating: distance > ROUTE_DEVIATION_THRESHOLD_METERS,
    distanceFromRoute: distance,
  };
}

// Detect unusual stop
export class UnusualStopDetector {
  private lastMovementTime: number = Date.now();
  private lastPosition: LocationPoint | null = null;
  private stopStartTime: number | null = null;
  
  checkForUnusualStop(
    currentLocation: LocationPoint,
    expectedRouteWaypoints: RouteWaypoint[]
  ): { isUnusualStop: boolean; durationSeconds: number; isOnRoute: boolean } {
    const now = Date.now();
    
    // Check if we've moved significantly
    if (this.lastPosition) {
      const distance = calculateDistance(
        this.lastPosition.latitude,
        this.lastPosition.longitude,
        currentLocation.latitude,
        currentLocation.longitude
      );
      
      if (distance > 10) { // Moved more than 10 meters
        this.lastMovementTime = now;
        this.stopStartTime = null;
      } else if (!this.stopStartTime) {
        this.stopStartTime = now;
      }
    }
    
    this.lastPosition = currentLocation;
    
    // Check if stopped for too long
    const stoppedDuration = this.stopStartTime 
      ? (now - this.stopStartTime) / 1000 
      : 0;
    
    // Check if stop location is on the expected route
    const distFromRoute = distanceFromRoute(
      { latitude: currentLocation.latitude, longitude: currentLocation.longitude },
      expectedRouteWaypoints
    );
    const isOnRoute = distFromRoute < ROUTE_DEVIATION_THRESHOLD_METERS;
    
    return {
      isUnusualStop: stoppedDuration > UNUSUAL_STOP_DURATION_SECONDS && !isOnRoute,
      durationSeconds: stoppedDuration,
      isOnRoute,
    };
  }
  
  reset() {
    this.lastMovementTime = Date.now();
    this.lastPosition = null;
    this.stopStartTime = null;
  }
}

// Route Learning Service
export class RouteLearningService {
  private tripWaypoints: RouteWaypoint[] = [];
  private lastRecordedPosition: LocationPoint | null = null;
  private tripStartTime: number = 0;
  
  startLearning() {
    this.tripWaypoints = [];
    this.lastRecordedPosition = null;
    this.tripStartTime = Date.now();
  }
  
  recordWaypoint(location: LocationPoint) {
    // Only record if moved enough distance from last waypoint
    if (this.lastRecordedPosition) {
      const distance = calculateDistance(
        this.lastRecordedPosition.latitude,
        this.lastRecordedPosition.longitude,
        location.latitude,
        location.longitude
      );
      
      if (distance < WAYPOINT_INTERVAL_METERS) {
        return; // Too close to last waypoint
      }
    }
    
    this.tripWaypoints.push({
      latitude: location.latitude,
      longitude: location.longitude,
      timestamp: new Date(location.timestamp).toISOString(),
      order: this.tripWaypoints.length,
    });
    
    this.lastRecordedPosition = location;
  }
  
  finishLearning(): { waypoints: RouteWaypoint[]; durationMinutes: number } {
    const durationMinutes = (Date.now() - this.tripStartTime) / 60000;
    return {
      waypoints: this.tripWaypoints,
      durationMinutes,
    };
  }
}

// Save learned route to Supabase
export async function saveLearnedRoute(
  userId: string,
  circleId: string,
  routeType: 'home_to_school' | 'school_to_home' | 'custom',
  startPlaceId: string,
  endPlaceId: string,
  waypoints: RouteWaypoint[],
  durationMinutes: number
): Promise<LearnedRoute | null> {
  try {
    // Calculate total distance
    let totalDistance = 0;
    for (let i = 1; i < waypoints.length; i++) {
      totalDistance += calculateDistance(
        waypoints[i-1].latitude,
        waypoints[i-1].longitude,
        waypoints[i].latitude,
        waypoints[i].longitude
      );
    }
    
    // Check if similar route exists
    const { data: existingRoutes } = await supabase
      .from('learned_routes')
      .select('*')
      .eq('user_id', userId)
      .eq('route_type', routeType)
      .eq('start_place_id', startPlaceId)
      .eq('end_place_id', endPlaceId);
    
    if (existingRoutes && existingRoutes.length > 0) {
      // Update existing route with new data (merge waypoints)
      const existing = existingRoutes[0];
      const newTripCount = existing.trip_count + 1;
      const newAvgDuration = (
        (existing.average_duration_minutes * existing.trip_count) + durationMinutes
      ) / newTripCount;
      const newAvgDistance = (
        (existing.average_distance_meters * existing.trip_count) + totalDistance
      ) / newTripCount;
      
      // Increase confidence with more trips
      const newConfidence = Math.min(100, existing.confidence_score + 10);
      
      const { data, error } = await supabase
        .from('learned_routes')
        .update({
          waypoints: waypoints, // Use latest waypoints
          average_duration_minutes: newAvgDuration,
          average_distance_meters: newAvgDistance,
          trip_count: newTripCount,
          confidence_score: newConfidence,
          updated_at: new Date().toISOString(),
        })
        .eq('id', existing.id)
        .select()
        .single();
      
      if (error) throw error;
      return data;
    } else {
      // Create new route
      const routeName = routeType === 'home_to_school' 
        ? 'Home to School' 
        : routeType === 'school_to_home' 
          ? 'School to Home' 
          : 'Custom Route';
      
      const { data, error } = await supabase
        .from('learned_routes')
        .insert({
          user_id: userId,
          circle_id: circleId,
          name: routeName,
          route_type: routeType,
          start_place_id: startPlaceId,
          end_place_id: endPlaceId,
          waypoints: waypoints,
          route_polyline: '', // Can be generated later
          average_duration_minutes: durationMinutes,
          average_distance_meters: totalDistance,
          trip_count: 1,
          confidence_score: 30, // Start with 30% confidence
        })
        .select()
        .single();
      
      if (error) throw error;
      return data;
    }
  } catch (error) {
    console.error('Error saving learned route:', error);
    return null;
  }
}

// Get learned routes for a user
export async function getLearnedRoutes(
  userId: string,
  circleId: string
): Promise<LearnedRoute[]> {
  try {
    const { data, error } = await supabase
      .from('learned_routes')
      .select('*')
      .eq('user_id', userId)
      .eq('circle_id', circleId)
      .order('trip_count', { ascending: false });
    
    if (error) throw error;
    return data || [];
  } catch (error) {
    console.error('Error getting learned routes:', error);
    return [];
  }
}

// Start monitoring a route
export async function startRouteMonitoring(
  userId: string,
  circleId: string,
  learnedRouteId: string,
  expectedDurationMinutes: number
): Promise<ActiveRouteMonitor | null> {
  try {
    const expectedArrival = new Date(
      Date.now() + expectedDurationMinutes * 60000
    ).toISOString();
    
    const { data, error } = await supabase
      .from('active_route_monitors')
      .insert({
        user_id: userId,
        circle_id: circleId,
        learned_route_id: learnedRouteId,
        status: 'active',
        expected_arrival_at: expectedArrival,
        deviation_count: 0,
        unusual_stop_count: 0,
      })
      .select()
      .single();
    
    if (error) throw error;
    return data;
  } catch (error) {
    console.error('Error starting route monitoring:', error);
    return null;
  }
}

// Record a deviation
export async function recordDeviation(
  monitorId: string,
  userId: string,
  circleId: string,
  deviationType: RouteDeviation['deviation_type'],
  location: { latitude: number; longitude: number },
  distanceFromRoute: number,
  durationSeconds?: number
): Promise<void> {
  try {
    // Get address for the location
    let address = '';
    try {
      const results = await Location.reverseGeocodeAsync(location);
      if (results && results.length > 0) {
        const addr = results[0];
        address = [addr.street, addr.city].filter(Boolean).join(', ');
      }
    } catch (e) {
      // Ignore geocoding errors
    }
    
    await supabase.from('route_deviations').insert({
      monitor_id: monitorId,
      user_id: userId,
      circle_id: circleId,
      deviation_type: deviationType,
      latitude: location.latitude,
      longitude: location.longitude,
      address: address,
      distance_from_route_meters: distanceFromRoute,
      duration_seconds: durationSeconds,
      notified_parents: true,
    });
    
    // Update monitor counts
    const updateField = deviationType === 'unusual_stop' 
      ? 'unusual_stop_count' 
      : 'deviation_count';
    
    await supabase.rpc('increment_deviation_count', {
      monitor_id: monitorId,
      field_name: updateField,
    });
  } catch (error) {
    console.error('Error recording deviation:', error);
  }
}

// Notify parents about deviation
export async function notifyParentsAboutDeviation(
  circleId: string,
  childName: string,
  deviationType: RouteDeviation['deviation_type'],
  location: { latitude: number; longitude: number; address?: string }
): Promise<void> {
  try {
    // Import push notification service dynamically to avoid circular deps
    const { sendLocalNotification, getNotificationContent } = await import('./pushNotificationService');
    
    // Create notification in database
    const title = deviationType === 'unusual_stop' 
      ? '⚠️ Unusual Stop Detected'
      : deviationType === 'route_deviation'
        ? '🚨 Route Deviation Detected'
        : deviationType === 'late_arrival'
          ? '⏰ Late Arrival'
          : '📍 Route Alert';
    
    const message = deviationType === 'unusual_stop'
      ? `${childName} has stopped at an unusual location${location.address ? `: ${location.address}` : ''}`
      : deviationType === 'route_deviation'
        ? `${childName} has deviated from their usual route${location.address ? ` near ${location.address}` : ''}`
        : `Route alert for ${childName}`;
    
    // Insert notification for all parents in the circle
    const { data: parents } = await supabase
      .from('circle_members')
      .select('user_id')
      .eq('circle_id', circleId)
      .eq('role', 'parent');
    
    if (parents) {
      for (const parent of parents) {
        await supabase.from('notifications').insert({
          user_id: parent.user_id,
          circle_id: circleId,
          type: 'route_deviation',
          title: title,
          message: message,
          data: {
            deviation_type: deviationType,
            latitude: location.latitude,
            longitude: location.longitude,
            address: location.address,
            child_name: childName,
          },
        });
      }
    }
    
    // Send local push notification
    const notificationType = deviationType === 'unusual_stop' ? 'unusual_stop' 
      : deviationType === 'late_arrival' ? 'late_arrival' : 'route_deviation';
    
    await sendLocalNotification({
      type: notificationType,
      title: title,
      body: message,
      data: {
        deviation_type: deviationType,
        latitude: location.latitude,
        longitude: location.longitude,
        address: location.address,
        child_name: childName,
      },
    });
    
    console.log(`[SafeRoute] Push notification sent for ${deviationType}`);
  } catch (error) {
    console.error('Error notifying parents:', error);
  }
}
