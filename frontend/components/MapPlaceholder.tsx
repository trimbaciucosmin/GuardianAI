import React from 'react';
import { View, Text, StyleSheet, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

interface MapPlaceholderProps {
  latitude?: number;
  longitude?: number;
  children?: React.ReactNode;
}

export default function MapPlaceholder({ latitude, longitude, children }: MapPlaceholderProps) {
  return (
    <View style={styles.container}>
      <View style={styles.content}>
        <Ionicons name="map-outline" size={48} color="#6366F1" />
        <Text style={styles.title}>Map View</Text>
        <Text style={styles.subtitle}>
          {Platform.OS === 'web' 
            ? 'Maps available on mobile app'
            : 'Loading map...'}
        </Text>
        {latitude && longitude && (
          <Text style={styles.coords}>
            {latitude.toFixed(4)}, {longitude.toFixed(4)}
          </Text>
        )}
      </View>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1E293B',
    borderRadius: 16,
    overflow: 'hidden',
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  title: {
    fontSize: 18,
    fontWeight: '600',
    color: '#FFFFFF',
    marginTop: 12,
  },
  subtitle: {
    fontSize: 14,
    color: '#94A3B8',
    marginTop: 4,
    textAlign: 'center',
  },
  coords: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 8,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
});
