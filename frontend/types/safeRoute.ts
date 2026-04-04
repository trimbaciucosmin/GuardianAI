/**
 * Safe Route Types
 * Types for the Safe Route to School feature
 */

export interface LearnedRoute {
  id: string;
  user_id: string;
  circle_id: string;
  name: string; // "Home to School", "School to Home"
  route_type: 'home_to_school' | 'school_to_home' | 'custom';
  start_place_id: string;
  end_place_id: string;
  waypoints: RouteWaypoint[];
  route_polyline: string; // Encoded polyline
  average_duration_minutes: number;
  average_distance_meters: number;
  trip_count: number; // How many times this route was taken
  confidence_score: number; // 0-100, how confident we are in this route
  created_at: string;
  updated_at: string;
}

export interface RouteWaypoint {
  latitude: number;
  longitude: number;
  timestamp?: string;
  order: number;
}

export interface ActiveRouteMonitor {
  id: string;
  user_id: string;
  circle_id: string;
  learned_route_id: string;
  status: 'active' | 'completed' | 'deviated' | 'cancelled';
  started_at: string;
  expected_arrival_at: string;
  actual_arrival_at?: string;
  current_latitude?: number;
  current_longitude?: number;
  deviation_count: number;
  unusual_stop_count: number;
  last_update_at: string;
}

export interface RouteDeviation {
  id: string;
  monitor_id: string;
  user_id: string;
  circle_id: string;
  deviation_type: 'route_deviation' | 'unusual_stop' | 'wrong_direction' | 'late_arrival';
  latitude: number;
  longitude: number;
  address?: string;
  distance_from_route_meters: number;
  duration_seconds?: number; // For unusual stops
  detected_at: string;
  resolved_at?: string;
  notified_parents: boolean;
}

export interface RouteAlert {
  type: 'deviation' | 'unusual_stop' | 'late' | 'arrived';
  severity: 'info' | 'warning' | 'critical';
  title: string;
  message: string;
  location?: {
    latitude: number;
    longitude: number;
    address?: string;
  };
  timestamp: string;
  childName: string;
  childId: string;
}
