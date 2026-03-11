import { format, formatDistanceToNow, isToday, isYesterday, parseISO } from 'date-fns';
import { AlertSeverity, AlertType } from '../types';

// Generate random invite code
export const generateInviteCode = (): string => {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
};

// Format timestamp for display
export const formatTimestamp = (timestamp: string): string => {
  const date = parseISO(timestamp);
  if (isToday(date)) {
    return format(date, 'h:mm a');
  }
  if (isYesterday(date)) {
    return `Yesterday ${format(date, 'h:mm a')}`;
  }
  return format(date, 'MMM d, h:mm a');
};

// Format relative time
export const formatRelativeTime = (timestamp: string): string => {
  return formatDistanceToNow(parseISO(timestamp), { addSuffix: true });
};

// Calculate distance between two coordinates in meters
export const calculateDistance = (
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number => {
  const R = 6371e3; // Earth's radius in meters
  const φ1 = (lat1 * Math.PI) / 180;
  const φ2 = (lat2 * Math.PI) / 180;
  const Δφ = ((lat2 - lat1) * Math.PI) / 180;
  const Δλ = ((lon2 - lon1) * Math.PI) / 180;

  const a =
    Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
    Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c;
};

// Format distance for display
export const formatDistance = (meters: number): string => {
  if (meters < 1000) {
    return `${Math.round(meters)}m`;
  }
  return `${(meters / 1000).toFixed(1)}km`;
};

// Calculate ETA in minutes based on distance and average speed
export const calculateETA = (distanceMeters: number, speedKmh: number = 30): number => {
  const hours = distanceMeters / 1000 / speedKmh;
  return Math.ceil(hours * 60);
};

// Check if point is inside geofence
export const isInsideGeofence = (
  latitude: number,
  longitude: number,
  fenceLat: number,
  fenceLon: number,
  radiusMeters: number
): boolean => {
  const distance = calculateDistance(latitude, longitude, fenceLat, fenceLon);
  return distance <= radiusMeters;
};

// Get alert icon based on type
export const getAlertIcon = (type: AlertType): string => {
  const icons: Record<AlertType, string> = {
    route_deviation: 'alert-circle',
    unexpected_stop: 'stop-circle',
    eta_exceeded: 'clock',
    phone_offline: 'wifi-off',
    low_battery: 'battery-low',
    left_safe_zone: 'map-marker-off',
    unusual_location: 'help-circle',
    sos_triggered: 'alert-octagon',
  };
  return icons[type] || 'bell';
};

// Get alert color based on severity
export const getAlertColor = (severity: AlertSeverity): string => {
  const colors: Record<AlertSeverity, string> = {
    low: '#4CAF50',
    medium: '#FF9800',
    high: '#F44336',
    critical: '#D32F2F',
  };
  return colors[severity];
};

// Get battery icon based on level
export const getBatteryIcon = (level: number, isCharging: boolean = false): string => {
  if (isCharging) return 'battery-charging';
  if (level <= 10) return 'battery-outline';
  if (level <= 25) return 'battery-20';
  if (level <= 50) return 'battery-50';
  if (level <= 75) return 'battery-70';
  return 'battery-full';
};

// Get battery color based on level
export const getBatteryColor = (level: number): string => {
  if (level <= 10) return '#D32F2F';
  if (level <= 25) return '#F44336';
  if (level <= 50) return '#FF9800';
  return '#4CAF50';
};

// Get role display name
export const getRoleDisplayName = (role: 'parent' | 'child' | 'teen'): string => {
  const names: Record<string, string> = {
    parent: 'Parent',
    child: 'Child',
    teen: 'Teen',
  };
  return names[role] || role;
};

// Get place type icon
export const getPlaceIcon = (type: string): string => {
  const icons: Record<string, string> = {
    home: 'home',
    school: 'school',
    work: 'briefcase',
    custom: 'map-marker',
  };
  return icons[type] || 'map-marker';
};

// Get place type color
export const getPlaceColor = (type: string): string => {
  const colors: Record<string, string> = {
    home: '#4CAF50',
    school: '#2196F3',
    work: '#9C27B0',
    custom: '#FF9800',
  };
  return colors[type] || '#607D8B';
};

// Truncate text
export const truncateText = (text: string, maxLength: number): string => {
  if (text.length <= maxLength) return text;
  return text.slice(0, maxLength - 3) + '...';
};

// Validate email
export const isValidEmail = (email: string): boolean => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
};

// Get initials from name
export const getInitials = (name: string): string => {
  if (!name) return '?';
  const parts = name.trim().split(' ');
  if (parts.length === 1) return parts[0].charAt(0).toUpperCase();
  return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase();
};

// Generate avatar color from user ID
export const getAvatarColor = (userId: string): string => {
  const colors = [
    '#1976D2', '#388E3C', '#D32F2F', '#7B1FA2',
    '#1565C0', '#2E7D32', '#C62828', '#6A1B9A',
    '#0288D1', '#689F38', '#E64A19', '#8E24AA',
  ];
  let hash = 0;
  for (let i = 0; i < userId.length; i++) {
    hash = userId.charCodeAt(i) + ((hash << 5) - hash);
  }
  return colors[Math.abs(hash) % colors.length];
};
