/**
 * Route Intelligence Service
 * - Learn usual routes
 * - Detect route deviations
 * - Unusual stop detection
 */

import { supabase } from './supabase';

interface RoutePoint {
  lat: number;
  lng: number;
  timestamp: string;
}

interface LearnedRoute {
  id: string;
  route_name: string;
  start_place_name: string;
  end_place_name: string;
  route_points: RoutePoint[];
  times_traveled: number;
  avg_duration_minutes: number;
  confidence_score: number;
}

interface DeviationAlert {
  type: 'unexpected_stop' | 'route_change' | 'unusual_speed' | 'extended_travel_time' | 'wrong_direction' | 'unknown_area';
  severity: 'info' | 'warning' | 'alert' | 'critical';
  latitude: number;
  longitude: number;
  message: string;
}

// Constants
const ROUTE_SIMILARITY_THRESHOLD = 0.7; // 70% similarity to consider same route
const MIN_STOP_DURATION_SECONDS = 180; // 3 minutes
const UNUSUAL_STOP_DURATION_SECONDS = 600; // 10 minutes
const DEVIATION_DISTANCE_METERS = 500; // 500m from expected route
const MIN_ROUTE_POINTS = 5;

/**
 * Calculate distance between two points (Haversine formula)
 */
function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
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

/**
 * Generate a simple hash for route comparison
 */
function generateRouteHash(points: RoutePoint[]): string {
  if (points.length < 2) return '';
  
  // Use start, middle, and end points
  const start = points[0];
  const mid = points[Math.floor(points.length / 2)];
  const end = points[points.length - 1];
  
  return `${start.lat.toFixed(3)},${start.lng.toFixed(3)}-${mid.lat.toFixed(3)},${mid.lng.toFixed(3)}-${end.lat.toFixed(3)},${end.lng.toFixed(3)}`;
}

/**
 * Calculate route similarity (0-1)
 */
function calculateRouteSimilarity(route1: RoutePoint[], route2: RoutePoint[]): number {
  if (route1.length < MIN_ROUTE_POINTS || route2.length < MIN_ROUTE_POINTS) {
    return 0;
  }

  // Normalize route lengths by sampling
  const sampleSize = Math.min(20, Math.min(route1.length, route2.length));
  const sampled1 = sampleRoute(route1, sampleSize);
  const sampled2 = sampleRoute(route2, sampleSize);

  // Calculate average distance between corresponding points
  let totalDistance = 0;
  for (let i = 0; i < sampleSize; i++) {
    totalDistance += calculateDistance(
      sampled1[i].lat, sampled1[i].lng,
      sampled2[i].lat, sampled2[i].lng
    );
  }

  const avgDistance = totalDistance / sampleSize;
  
  // Convert to similarity score (closer = higher score)
  // 100m = 1.0, 500m = 0.5, 1000m+ = 0
  const similarity = Math.max(0, 1 - avgDistance / 1000);
  
  return similarity;
}

/**
 * Sample route to fixed number of points
 */
function sampleRoute(route: RoutePoint[], sampleSize: number): RoutePoint[] {
  const sampled: RoutePoint[] = [];
  const step = (route.length - 1) / (sampleSize - 1);
  
  for (let i = 0; i < sampleSize; i++) {
    const index = Math.min(Math.floor(i * step), route.length - 1);
    sampled.push(route[index]);
  }
  
  return sampled;
}

/**
 * Detect if current position deviates from expected route
 */
function detectDeviation(
  currentLat: number,
  currentLng: number,
  expectedRoute: RoutePoint[],
  progress: number // 0-1, how far along the route
): { deviates: boolean; distance: number; nearestPoint: RoutePoint | null } {
  if (expectedRoute.length < 2) {
    return { deviates: false, distance: 0, nearestPoint: null };
  }

  // Find nearest point on expected route
  let minDistance = Infinity;
  let nearestPoint: RoutePoint | null = null;
  
  // Check points around expected progress
  const startIdx = Math.max(0, Math.floor(progress * expectedRoute.length) - 5);
  const endIdx = Math.min(expectedRoute.length, Math.floor(progress * expectedRoute.length) + 5);
  
  for (let i = startIdx; i < endIdx; i++) {
    const point = expectedRoute[i];
    const distance = calculateDistance(currentLat, currentLng, point.lat, point.lng);
    
    if (distance < minDistance) {
      minDistance = distance;
      nearestPoint = point;
    }
  }

  return {
    deviates: minDistance > DEVIATION_DISTANCE_METERS,
    distance: minDistance,
    nearestPoint,
  };
}

/**
 * Detect unusual stops
 */
function detectUnusualStop(
  locationHistory: RoutePoint[],
  knownPlaces: Array<{ lat: number; lng: number; name: string; radius: number }>
): { isUnusual: boolean; duration: number; nearKnownPlace: boolean } {
  if (locationHistory.length < 3) {
    return { isUnusual: false, duration: 0, nearKnownPlace: false };
  }

  // Check if stationary (last few points very close together)
  const recentPoints = locationHistory.slice(-5);
  let totalMovement = 0;
  
  for (let i = 1; i < recentPoints.length; i++) {
    totalMovement += calculateDistance(
      recentPoints[i - 1].lat, recentPoints[i - 1].lng,
      recentPoints[i].lat, recentPoints[i].lng
    );
  }

  const isStationary = totalMovement < 50; // Less than 50m movement
  
  if (!isStationary) {
    return { isUnusual: false, duration: 0, nearKnownPlace: false };
  }

  // Calculate stop duration
  const firstTime = new Date(recentPoints[0].timestamp).getTime();
  const lastTime = new Date(recentPoints[recentPoints.length - 1].timestamp).getTime();
  const duration = (lastTime - firstTime) / 1000; // seconds

  if (duration < MIN_STOP_DURATION_SECONDS) {
    return { isUnusual: false, duration, nearKnownPlace: false };
  }

  // Check if near a known place
  const currentPos = recentPoints[recentPoints.length - 1];
  let nearKnownPlace = false;
  
  for (const place of knownPlaces) {
    const distance = calculateDistance(currentPos.lat, currentPos.lng, place.lat, place.lng);
    if (distance < place.radius) {
      nearKnownPlace = true;
      break;
    }
  }

  return {
    isUnusual: duration > UNUSUAL_STOP_DURATION_SECONDS && !nearKnownPlace,
    duration,
    nearKnownPlace,
  };
}

/**
 * Learn and store a new route
 */
export async function learnRoute(
  userId: string,
  circleId: string,
  routePoints: RoutePoint[],
  startPlaceName?: string,
  endPlaceName?: string
): Promise<LearnedRoute | null> {
  if (routePoints.length < MIN_ROUTE_POINTS) {
    console.log('[RouteIntel] Not enough points to learn route');
    return null;
  }

  try {
    const routeHash = generateRouteHash(routePoints);
    
    // Check for similar existing routes
    const { data: existingRoutes } = await supabase
      .from('learned_routes')
      .select('*')
      .eq('user_id', userId)
      .eq('circle_id', circleId);

    let matchedRoute: any = null;
    let bestSimilarity = 0;

    for (const route of existingRoutes || []) {
      const similarity = calculateRouteSimilarity(routePoints, route.route_points);
      if (similarity > ROUTE_SIMILARITY_THRESHOLD && similarity > bestSimilarity) {
        matchedRoute = route;
        bestSimilarity = similarity;
      }
    }

    if (matchedRoute) {
      // Update existing route
      const newTimesTravel = matchedRoute.times_traveled + 1;
      const newConfidence = Math.min(1, matchedRoute.confidence_score + 0.1);
      
      // Calculate duration
      const startTime = new Date(routePoints[0].timestamp).getTime();
      const endTime = new Date(routePoints[routePoints.length - 1].timestamp).getTime();
      const durationMinutes = Math.round((endTime - startTime) / 60000);
      
      const newAvgDuration = Math.round(
        (matchedRoute.avg_duration_minutes * matchedRoute.times_traveled + durationMinutes) / newTimesTravel
      );

      const { data, error } = await supabase
        .from('learned_routes')
        .update({
          times_traveled: newTimesTravel,
          confidence_score: newConfidence,
          avg_duration_minutes: newAvgDuration,
          last_traveled_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', matchedRoute.id)
        .select()
        .single();

      if (error) throw error;
      console.log(`[RouteIntel] Updated route: ${matchedRoute.route_name} (traveled ${newTimesTravel}x)`);
      return data;
    } else {
      // Create new route
      const routeName = startPlaceName && endPlaceName 
        ? `${startPlaceName} to ${endPlaceName}`
        : `Route ${(existingRoutes?.length || 0) + 1}`;

      const startTime = new Date(routePoints[0].timestamp).getTime();
      const endTime = new Date(routePoints[routePoints.length - 1].timestamp).getTime();
      const durationMinutes = Math.round((endTime - startTime) / 60000);

      const { data, error } = await supabase
        .from('learned_routes')
        .insert({
          user_id: userId,
          circle_id: circleId,
          route_name: routeName,
          start_place_name: startPlaceName,
          end_place_name: endPlaceName,
          route_points: routePoints,
          route_hash: routeHash,
          avg_duration_minutes: durationMinutes,
          confidence_score: 0.3,
          last_traveled_at: new Date().toISOString(),
        })
        .select()
        .single();

      if (error) throw error;
      console.log(`[RouteIntel] Learned new route: ${routeName}`);
      return data;
    }
  } catch (error) {
    console.error('[RouteIntel] Error learning route:', error);
    return null;
  }
}

/**
 * Check current location against learned routes
 */
export async function checkRouteDeviation(
  userId: string,
  circleId: string,
  currentLat: number,
  currentLng: number,
  recentHistory: RoutePoint[]
): Promise<DeviationAlert | null> {
  try {
    // Get active routes (frequently traveled)
    const { data: routes } = await supabase
      .from('learned_routes')
      .select('*')
      .eq('user_id', userId)
      .eq('circle_id', circleId)
      .gte('confidence_score', 0.5)
      .order('last_traveled_at', { ascending: false })
      .limit(5);

    if (!routes || routes.length === 0) {
      return null;
    }

    // Check if currently on any known route
    for (const route of routes) {
      const similarity = calculateRouteSimilarity(recentHistory, route.route_points);
      
      if (similarity > 0.3) {
        // Seems to be on this route, check for deviation
        const progress = recentHistory.length / route.route_points.length;
        const deviation = detectDeviation(currentLat, currentLng, route.route_points, progress);
        
        if (deviation.deviates) {
          // Record deviation
          await supabase.from('route_deviations').insert({
            user_id: userId,
            circle_id: circleId,
            learned_route_id: route.id,
            deviation_type: 'route_change',
            severity: deviation.distance > 1000 ? 'alert' : 'warning',
            latitude: currentLat,
            longitude: currentLng,
            expected_location: deviation.nearestPoint,
            deviation_distance_meters: Math.round(deviation.distance),
          });

          return {
            type: 'route_change',
            severity: deviation.distance > 1000 ? 'alert' : 'warning',
            latitude: currentLat,
            longitude: currentLng,
            message: `Deviated ${Math.round(deviation.distance)}m from usual route "${route.route_name}"`,
          };
        }
      }
    }

    return null;
  } catch (error) {
    console.error('[RouteIntel] Error checking deviation:', error);
    return null;
  }
}

/**
 * Check for unusual stops
 */
export async function checkUnusualStop(
  userId: string,
  circleId: string,
  recentHistory: RoutePoint[]
): Promise<DeviationAlert | null> {
  try {
    // Get known places
    const { data: places } = await supabase
      .from('places')
      .select('latitude, longitude, name, radius')
      .eq('circle_id', circleId);

    const knownPlaces = (places || []).map(p => ({
      lat: p.latitude,
      lng: p.longitude,
      name: p.name,
      radius: p.radius || 100,
    }));

    const stopCheck = detectUnusualStop(recentHistory, knownPlaces);

    if (stopCheck.isUnusual) {
      const lastPoint = recentHistory[recentHistory.length - 1];
      
      // Record unusual stop
      await supabase.from('route_deviations').insert({
        user_id: userId,
        circle_id: circleId,
        deviation_type: 'unexpected_stop',
        severity: stopCheck.duration > 1800 ? 'alert' : 'warning', // 30+ minutes = alert
        latitude: lastPoint.lat,
        longitude: lastPoint.lng,
        stop_duration_seconds: Math.round(stopCheck.duration),
      });

      const durationMinutes = Math.round(stopCheck.duration / 60);

      return {
        type: 'unexpected_stop',
        severity: stopCheck.duration > 1800 ? 'alert' : 'warning',
        latitude: lastPoint.lat,
        longitude: lastPoint.lng,
        message: `Stopped at unknown location for ${durationMinutes} minutes`,
      };
    }

    return null;
  } catch (error) {
    console.error('[RouteIntel] Error checking unusual stop:', error);
    return null;
  }
}

/**
 * Get user's learned routes
 */
export async function getLearnedRoutes(userId: string, circleId: string): Promise<LearnedRoute[]> {
  try {
    const { data, error } = await supabase
      .from('learned_routes')
      .select('*')
      .eq('user_id', userId)
      .eq('circle_id', circleId)
      .order('times_traveled', { ascending: false });

    if (error) throw error;
    return data || [];
  } catch (error) {
    console.error('[RouteIntel] Error fetching routes:', error);
    return [];
  }
}
