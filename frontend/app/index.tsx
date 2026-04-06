import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { useAuthStore, useCircleStore } from '../lib/store';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';

const CACHED_ROLE_KEY = '@guardian_cached_role';
const CHILD_ROLES = ['child', 'teen'];

export default function SplashScreen() {
  const router = useRouter();
  const { isAuthenticated, isLoading, profile } = useAuthStore();
  const { currentRole, currentCircle } = useCircleStore();
  const hasNavigated = useRef(false);

  useEffect(() => {
    if (isLoading || hasNavigated.current) return;

    const performNavigation = async () => {
      const isProfileComplete = profile && profile.name && profile.name !== 'New User';
      
      if (!isAuthenticated) {
        hasNavigated.current = true;
        router.replace('/(auth)/login');
        return;
      }
      
      if (!isProfileComplete) {
        hasNavigated.current = true;
        router.replace('/(auth)/onboarding');
        return;
      }
      
      const hasCircle = !!currentCircle?.id;
      if (!hasCircle) {
        hasNavigated.current = true;
        router.replace('/circle/choice');
        return;
      }
      
      const storeRole = currentRole?.toLowerCase()?.trim() || null;
      const profileRole = profile?.role?.toLowerCase()?.trim() || null;
      
      let cachedRole = null;
      try {
        cachedRole = await AsyncStorage.getItem(CACHED_ROLE_KEY);
        cachedRole = cachedRole?.toLowerCase()?.trim() || null;
      } catch (e) {}
      
      const effectiveRole = storeRole || profileRole || cachedRole;
      
      if (effectiveRole) {
        try { 
          await AsyncStorage.setItem(CACHED_ROLE_KEY, effectiveRole); 
        } catch (e) {}
      }
      
      hasNavigated.current = true;
      
      if (effectiveRole && CHILD_ROLES.includes(effectiveRole)) {
        router.replace('/(child)/home');
        return;
      }
      
      if (effectiveRole) {
        router.replace('/(main)/map');
        return;
      }
      
      router.replace('/circle/choice');
    };

    performNavigation();
  }, [isAuthenticated, isLoading, profile, currentRole, currentCircle]);

  return (
    <View style={styles.container}>
      <View style={styles.logoContainer}>
        <View style={styles.iconWrapper}>
          <Ionicons name="shield-checkmark" size={80} color="#6366F1" />
        </View>
        <Text style={styles.title}>Guardian AI</Text>
        <Text style={styles.subtitle}>Family Safety</Text>
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
  },
  subtitle: {
    fontSize: 16,
    color: '#94A3B8',
  },
  loader: {
    marginTop: 40,
  },
});
