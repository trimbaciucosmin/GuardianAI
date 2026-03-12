import React, { useEffect } from 'react';
import { View, Text, StyleSheet, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { useAuthStore } from '../lib/store';
import { Ionicons } from '@expo/vector-icons';

export default function SplashScreen() {
  const router = useRouter();
  const { isAuthenticated, isLoading, profile } = useAuthStore();

  useEffect(() => {
    if (!isLoading) {
      // Navigate based on auth state
      setTimeout(() => {
        // Profile is complete if it exists AND has a real name (not placeholder)
        const isProfileComplete = profile && profile.name && profile.name !== 'New User';
        
        if (isAuthenticated && isProfileComplete) {
          router.replace('/(main)/map');
        } else if (isAuthenticated && !isProfileComplete) {
          router.replace('/(auth)/onboarding');
        } else {
          router.replace('/(auth)/login');
        }
      }, 1000);
    }
  }, [isAuthenticated, isLoading, profile]);

  return (
    <View style={styles.container}>
      <View style={styles.logoContainer}>
        <View style={styles.iconWrapper}>
          <Ionicons name="shield-checkmark" size={80} color="#6366F1" />
        </View>
        <Text style={styles.title}>Guardian AI</Text>
        <Text style={styles.subtitle}>Family Safety, Reimagined</Text>
      </View>
      <ActivityIndicator size="large" color="#6366F1" style={styles.loader} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0F172A',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  logoContainer: {
    alignItems: 'center',
  },
  iconWrapper: {
    width: 140,
    height: 140,
    borderRadius: 70,
    backgroundColor: 'rgba(99, 102, 241, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
  },
  title: {
    fontSize: 36,
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: '#94A3B8',
    letterSpacing: 1,
  },
  loader: {
    marginTop: 60,
  },
});
