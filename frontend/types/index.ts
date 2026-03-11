// User & Profile Types
export interface Profile {
  id: string;
  user_id: string;
  name: string;
  avatar_url?: string;
  phone?: string;
  role: 'parent' | 'child' | 'teen';
  created_at: string;
  updated_at: string;
}

// Family Circle Types
export interface FamilyCircle {
  id: string;
  name: string;
  invite_code: string;
  created_by: string;
  created_at: string;
}

export interface CircleMember {
  id: string;
  circle_id: string;
  user_id: string;
  role: 'parent' | 'child' | 'teen';
  joined_at: string;
  profile?: Profile;
}

// Location Types
export interface LiveLocation {
  id: string;
  user_id: string;
  circle_id: string;
  latitude: number;
  longitude: number;
  accuracy?: number;
  altitude?: number;
  speed?: number;
  heading?: number;
  battery_level?: number;
  is_moving: boolean;
  is_charging?: boolean;
  timestamp: string;
}

export interface LocationHistory {
  id: string;
  user_id: string;
  circle_id: string;
  latitude: number;
  longitude: number;
  timestamp: string;
}

// Place / Geofence Types
export interface Place {
  id: string;
  circle_id: string;
  name: string;
  latitude: number;
  longitude: number;
  radius: number; // meters
  address?: string;
  type: 'home' | 'school' | 'work' | 'custom';
  icon?: string;
  color?: string;
  created_by: string;
  created_at: string;
}

export interface GeofenceEvent {
  id: string;
  user_id: string;
  place_id: string;
  event_type: 'arrive' | 'depart';
  timestamp: string;
  place?: Place;
  profile?: Profile;
}

// SOS Types
export interface SOSEvent {
  id: string;
  user_id: string;
  circle_id: string;
  status: 'pending' | 'active' | 'cancelled' | 'resolved';
  latitude: number;
  longitude: number;
  message?: string;
  started_at: string;
  ended_at?: string;
  profile?: Profile;
}

// Monitored Trip Types
export interface MonitoredTrip {
  id: string;
  user_id: string;
  circle_id: string;
  destination_place_id?: string;
  destination_name?: string;
  destination_latitude: number;
  destination_longitude: number;
  eta_minutes: number;
  status: 'active' | 'completed' | 'cancelled' | 'delayed';
  started_at: string;
  ended_at?: string;
  destination?: Place;
  profile?: Profile;
}

// Anomaly Alert Types
export type AlertType = 
  | 'route_deviation'
  | 'unexpected_stop'
  | 'eta_exceeded'
  | 'phone_offline'
  | 'low_battery'
  | 'left_safe_zone'
  | 'unusual_location'
  | 'sos_triggered';

export type AlertSeverity = 'low' | 'medium' | 'high' | 'critical';

export interface AnomalyAlert {
  id: string;
  user_id: string;
  circle_id: string;
  alert_type: AlertType;
  title: string;
  message: string;
  severity: AlertSeverity;
  data?: any;
  is_read: boolean;
  created_at: string;
  profile?: Profile;
}

// Device Status Types
export interface DeviceStatus {
  id: string;
  user_id: string;
  battery_level: number;
  is_charging: boolean;
  gps_enabled: boolean;
  airplane_mode: boolean;
  network_type?: string;
  last_seen: string;
}

// Notification Types
export type NotificationType = 
  | 'arrival'
  | 'departure'
  | 'battery'
  | 'sos'
  | 'trip'
  | 'anomaly'
  | 'device'
  | 'circle'
  | 'general';

export interface Notification {
  id: string;
  user_id: string;
  type: NotificationType;
  title: string;
  body: string;
  data?: any;
  is_read: boolean;
  created_at: string;
}

// Map Member Display Type
export interface MapMember {
  id: string;
  user_id: string;
  name: string;
  avatar_url?: string;
  role: 'parent' | 'child' | 'teen';
  latitude: number;
  longitude: number;
  battery_level?: number;
  is_moving: boolean;
  is_online: boolean;
  last_seen: string;
}
