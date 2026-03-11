/**
 * TrackingStatusCard Component
 * 
 * Displays current location tracking status with controls.
 * Shows different states: tracking, paused, permissions needed.
 */

import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Platform,
  Linking,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

interface TrackingStatusCardProps {
  isTracking: boolean;
  isForeground: boolean;
  isSOSMode: boolean;
  permissionStatus: string;
  backgroundPermissionStatus: string;
  lastLocation: {
    latitude: number;
    longitude: number;
    accuracy: number | null;
    timestamp: Date;
  } | null;
  lastBatteryLevel: number;
  error: string | null;
  statusText: string;
  isBackgroundAvailable: boolean;
  backgroundAvailabilityReason: string;
  onStartTracking: () => void;
  onStopTracking: () => void;
  onRequestPermissions: () => void;
}

export const TrackingStatusCard: React.FC<TrackingStatusCardProps> = ({
  isTracking,
  isForeground,
  isSOSMode,
  permissionStatus,
  backgroundPermissionStatus,
  lastLocation,
  lastBatteryLevel,
  error,
  statusText,
  isBackgroundAvailable,
  backgroundAvailabilityReason,
  onStartTracking,
  onStopTracking,
  onRequestPermissions,
}) => {
  // Determine status color and icon
  const getStatusConfig = () => {
    if (isSOSMode) {
      return { color: '#DC2626', icon: 'alert-circle', pulse: true };
    }
    if (isTracking && isForeground) {
      return { color: '#10B981', icon: 'locate', pulse: false };
    }
    if (isTracking && !isForeground) {
      return { color: '#6366F1', icon: 'cloud-upload', pulse: false };
    }
    if (permissionStatus !== 'granted') {
      return { color: '#F59E0B', icon: 'warning', pulse: false };
    }
    return { color: '#64748B', icon: 'location-outline', pulse: false };
  };

  const { color, icon, pulse } = getStatusConfig();

  // Open device settings
  const openSettings = () => {
    if (Platform.OS === 'ios') {
      Linking.openURL('app-settings:');
    } else {
      Linking.openSettings();
    }
  };

  // Show background tracking info
  const showBackgroundInfo = () => {
    Alert.alert(
      'Background Tracking',
      `${backgroundAvailabilityReason}\n\n` +
      `Current status:\n` +
      `• Foreground permission: ${permissionStatus}\n` +
      `• Background permission: ${backgroundPermissionStatus}\n\n` +
      `For full background tracking on iOS, you need to create a development build using:\n` +
      `npx expo run:ios\n` +
      `or\n` +
      `eas build --profile development`,
      [
        { text: 'OK' },
        { text: 'Open Settings', onPress: openSettings },
      ]
    );
  };

  return (
    <View style={styles.container}>
      {/* Status Header */}
      <View style={styles.header}>
        <View style={[styles.statusIcon, { backgroundColor: `${color}20` }]}>
          <Ionicons name={icon as any} size={20} color={color} />
          {pulse && <View style={[styles.pulse, { backgroundColor: color }]} />}
        </View>
        <View style={styles.statusInfo}>
          <Text style={styles.statusText}>{statusText}</Text>
          {lastLocation && (
            <Text style={styles.locationText}>
              {lastLocation.latitude.toFixed(4)}, {lastLocation.longitude.toFixed(4)}
              {lastLocation.accuracy && ` (±${Math.round(lastLocation.accuracy)}m)`}
            </Text>
          )}
        </View>
        <TouchableOpacity onPress={showBackgroundInfo} style={styles.infoButton}>
          <Ionicons name="information-circle-outline" size={20} color="#64748B" />
        </TouchableOpacity>
      </View>

      {/* Error Message */}
      {error && (
        <View style={styles.errorContainer}>
          <Ionicons name="alert-circle" size={16} color="#F59E0B" />
          <Text style={styles.errorText}>{error}</Text>
        </View>
      )}

      {/* Permission Warning */}
      {permissionStatus !== 'granted' && (
        <TouchableOpacity style={styles.permissionBanner} onPress={onRequestPermissions}>
          <Ionicons name="lock-closed" size={16} color="#F59E0B" />
          <Text style={styles.permissionText}>Location permission needed</Text>
          <Ionicons name="chevron-forward" size={16} color="#F59E0B" />
        </TouchableOpacity>
      )}

      {/* Background Warning (iOS) */}
      {permissionStatus === 'granted' && 
       backgroundPermissionStatus !== 'granted' && 
       Platform.OS === 'ios' && (
        <TouchableOpacity style={styles.backgroundBanner} onPress={showBackgroundInfo}>
          <Ionicons name="moon" size={16} color="#6366F1" />
          <Text style={styles.backgroundText}>Background tracking limited</Text>
          <Ionicons name="chevron-forward" size={16} color="#6366F1" />
        </TouchableOpacity>
      )}

      {/* Controls */}
      <View style={styles.controls}>
        {!isTracking ? (
          <TouchableOpacity
            style={[styles.button, styles.startButton]}
            onPress={onStartTracking}
          >
            <Ionicons name="play" size={18} color="#FFFFFF" />
            <Text style={styles.buttonText}>Start Sharing</Text>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity
            style={[styles.button, styles.stopButton]}
            onPress={onStopTracking}
          >
            <Ionicons name="pause" size={18} color="#FFFFFF" />
            <Text style={styles.buttonText}>Pause Sharing</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Tracking Mode Indicator */}
      {isTracking && (
        <View style={styles.modeIndicator}>
          <View style={styles.modeItem}>
            <View style={[
              styles.modeDot,
              { backgroundColor: isForeground ? '#10B981' : '#6366F1' }
            ]} />
            <Text style={styles.modeText}>
              {isForeground ? 'Active' : 'Background'}
            </Text>
          </View>
          {Platform.OS === 'android' && !isForeground && (
            <View style={styles.modeItem}>
              <Ionicons name="notifications" size={12} color="#64748B" />
              <Text style={styles.modeText}>Notification active</Text>
            </View>
          )}
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#1E293B',
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statusIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
  },
  pulse: {
    position: 'absolute',
    width: 40,
    height: 40,
    borderRadius: 20,
    opacity: 0.3,
  },
  statusInfo: {
    flex: 1,
    marginLeft: 12,
  },
  statusText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  locationText: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 2,
  },
  infoButton: {
    padding: 8,
  },
  errorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(245, 158, 11, 0.1)',
    borderRadius: 8,
    padding: 10,
    marginTop: 12,
    gap: 8,
  },
  errorText: {
    flex: 1,
    fontSize: 12,
    color: '#F59E0B',
  },
  permissionBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(245, 158, 11, 0.1)',
    borderRadius: 8,
    padding: 10,
    marginTop: 12,
    gap: 8,
  },
  permissionText: {
    flex: 1,
    fontSize: 12,
    color: '#F59E0B',
  },
  backgroundBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(99, 102, 241, 0.1)',
    borderRadius: 8,
    padding: 10,
    marginTop: 12,
    gap: 8,
  },
  backgroundText: {
    flex: 1,
    fontSize: 12,
    color: '#6366F1',
  },
  controls: {
    marginTop: 16,
  },
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
    paddingVertical: 12,
    gap: 8,
  },
  startButton: {
    backgroundColor: '#10B981',
  },
  stopButton: {
    backgroundColor: '#64748B',
  },
  buttonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  modeIndicator: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 16,
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#334155',
  },
  modeItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  modeDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  modeText: {
    fontSize: 11,
    color: '#64748B',
  },
});

export default TrackingStatusCard;
