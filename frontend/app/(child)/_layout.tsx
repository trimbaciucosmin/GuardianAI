/**
 * Child Mode Layout — STRICT ROLE GUARD
 * 
 * Rules:
 * - role === child/teen     → show Child UI
 * - role === parent/owner/guardian → redirect to /(main)/map
 * - role === null/unknown   → loading (redirect to / for resolution)
 */

import React, { useEffect, useState } from 'react';
import { Stack, useRouter } from 'expo-router';
import { View, ActivityIndicator, Text, StyleSheet } from 'react-native';
import { useCircleStore, useAuthStore } from '../../lib/store';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { startTamperMonitoring, stopTamperMonitoring } from '../../services/tamperAlertService';

const CACHED_ROLE_KEY = '@guardian_cached_role';
const PARENT_ROLES = ['owner', 'parent', 'guardian'];
const CHILD_ROLES = ['child', 'teen'];

export default function ChildLayout() {
  const router = useRouter();
  const { currentRole, currentCircle } = useCircleStore();
  const { user } = useAuthStore();
  const [accessGranted, setAccessGranted] = useState(false);

  // Start tamper monitoring when child enters child mode
  useEffect(() => {
    if (accessGranted && user?.id && currentCircle?.id) {
      console.log('[TAMPER] Starting tamper monitoring for child...');
      startTamperMonitoring(user.id, currentCircle.id);
    }
    return () => {
      stopTamperMonitoring();
    };
  }, [accessGranted, user?.id, currentCircle?.id]);

  useEffect(() => {
    const validateAccess = async () => {
      const storeRole = currentRole?.toLowerCase()?.trim() || null;

      console.log(`[GUARD:CHILD] Store role="${storeRole}"`);

      // If store has a parent role → redirect to parent mode
      if (storeRole && PARENT_ROLES.includes(storeRole)) {
        console.log('[GUARD:CHILD] PARENT in store → redirect to /(main)/map');
        router.replace('/(main)/map');
        return;
      }

      // If store has a child role → grant access
      if (storeRole && CHILD_ROLES.includes(storeRole)) {
        console.log('[GUARD:CHILD] CHILD in store → access granted');
        setAccessGranted(true);
        return;
      }

      // Store role is null — check cache
      try {
        const cachedRole = await AsyncStorage.getItem(CACHED_ROLE_KEY);
        const normalized = cachedRole?.toLowerCase()?.trim() || null;

        console.log(`[GUARD:CHILD] Cache role="${normalized}"`);

        if (normalized && PARENT_ROLES.includes(normalized)) {
          console.log('[GUARD:CHILD] PARENT in cache → redirect to /(main)/map');
          router.replace('/(main)/map');
          return;
        }

        if (normalized && CHILD_ROLES.includes(normalized)) {
          console.log('[GUARD:CHILD] CHILD in cache → access granted');
          setAccessGranted(true);
          return;
        }
      } catch (e) {
        console.log('[GUARD:CHILD] Cache read error:', e);
      }

      // No valid role → redirect to splash for role resolution
      console.warn('[GUARD:CHILD] NO valid child role found. Redirecting to / for resolution.');
      router.replace('/');
    };

    validateAccess();
  }, [currentRole, user?.id]);

  if (!accessGranted) {
    return (
      <View style={styles.guardLoading}>
        <ActivityIndicator size="large" color="#6366F1" />
        <Text style={styles.guardText}>Loading Child Mode...</Text>
      </View>
    );
  }

  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: '#0F172A' },
        animation: 'slide_from_right',
      }}
    >
      <Stack.Screen name="home" />
    </Stack>
  );
}

const styles = StyleSheet.create({
  guardLoading: {
    flex: 1,
    backgroundColor: '#0F172A',
    justifyContent: 'center',
    alignItems: 'center',
  },
  guardText: {
    marginTop: 16,
    color: '#64748B',
    fontSize: 14,
  },
});
