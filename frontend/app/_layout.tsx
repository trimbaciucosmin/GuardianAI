import React, { useEffect, useState } from 'react';
import { Tabs, useRouter } from 'expo-router';
import { View, StyleSheet, ActivityIndicator, Text } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useCircleStore, useAuthStore } from '../../lib/store';
import AsyncStorage from '@react-native-async-storage/async-storage';

const CACHED_ROLE_KEY = '@guardian_cached_role';
const CHILD_ROLES = ['child', 'teen'];

export default function MainLayout() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { currentRole } = useCircleStore();
  const { user, profile } = useAuthStore();
  const [accessGranted, setAccessGranted] = useState(false);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    const validateAccess = async () => {
      const storeRole = currentRole?.toLowerCase()?.trim() || null;
      const profileRole = profile?.role?.toLowerCase()?.trim() || null;
      
      let cachedRole = null;
      try {
        cachedRole = await AsyncStorage.getItem(CACHED_ROLE_KEY);
        cachedRole = cachedRole?.toLowerCase()?.trim() || null;
      } catch (e) {}
      
      const effectiveRole = storeRole || profileRole || cachedRole;
      
      if (effectiveRole && CHILD_ROLES.includes(effectiveRole)) {
        setChecking(false);
        router.replace('/(child)/home');
        return;
      }
      
      if (!effectiveRole) {
        setChecking(false);
        router.replace('/circle/choice');
        return;
      }
      
      setAccessGranted(true);
      setChecking(false);
    };
    
    validateAccess();
  }, [currentRole, profile?.role, user?.id]);

  if (checking && !accessGranted) {
    return (
      <View style={styles.guardLoading}>
        <ActivityIndicator size="large" color="#6366F1" />
        <Text style={styles.guardText}>Loading...</Text>
      </View>
    );
  }

  return (
    <Tabs screenOptions={{ headerShown: false }}>
      <Tabs.Screen name="map" />
      <Tabs.Screen name="activity" />
      <Tabs.Screen name="phone" />
      <Tabs.Screen name="family" />
    </Tabs>
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
  },
});
