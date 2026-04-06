
Pas 3: Editează al doilea fișier
Mergi înapoi la: https://github.com/trimbaciucosmin/GuardianAI/tree/main/frontend/app
Click pe folder (main)
Click pe fișierul _layout.tsx
Click pe iconița creion (Edit) din dreapta sus
Selectează tot (Ctrl+A) și șterge
Copiază tot textul de mai jos și lipește-l:
import React, { useEffect, useState } from 'react';
import { Tabs, useRouter } from 'expo-router';
import { View, StyleSheet, ActivityIndicator, Text } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BlurView } from 'expo-blur';
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
  
  const tabBarHeight = 56 + insets.bottom;

  useEffect(() => {
    const validateAccess = async () => {
      const storeRole = currentRole?.toLowerCase()?.trim() || null;
      const profileRole = profile?.role?.toLowerCase()?.trim() || null;
      
      let cachedRole: string | null = null;
      try {
        cachedRole = await AsyncStorage.getItem(CACHED_ROLE_KEY);
        cachedRole = cachedRole?.toLowerCase()?.trim() || null;
      } catch (e) {
        console.log('[GUARD:MAIN] Cache read error:', e);
      }
      
      const effectiveRole = storeRole || profileRole || cachedRole;
      console.log(`[GUARD:MAIN] Role check: store=${storeRole}, profile=${profileRole}, cache=${cachedRole}, effective=${effectiveRole}`);
      
      if (effectiveRole && CHILD_ROLES.includes(effectiveRole)) {
        console.log('[GUARD:MAIN] CHILD detected in parent mode → redirect to /(child)/home');
        router.replace('/(child)/home');
        return;
      }
      
      console.log('[GUARD:MAIN] Access granted for parent mode');
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
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          position: 'absolute',
          bottom: 0,
          left: 0,
          right: 0,
          height: tabBarHeight,
          backgroundColor: 'rgba(15, 23, 42, 0.92)',
          borderTopWidth: 0.5,
          borderTopColor: 'rgba(148, 163, 184, 0.1)',
          paddingTop: 6,
          paddingBottom: insets.bottom + 6,
          elevation: 0,
        },
        tabBarActiveTintColor: '#818CF8',
        tabBarInactiveTintColor: 'rgba(148, 163, 184, 0.6)',
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: '500',
          marginTop: 2,
          letterSpacing: 0.2,
        },
        tabBarIconStyle: {
          marginBottom: -2,
        },
      }}
    >
      <Tabs.Screen
        name="map"
        options={{
          title: 'Map',
          tabBarIcon: ({ color, focused }) => (
            <View style={focused ? styles.activeIconContainer : undefined}>
              <Ionicons name={focused ? "location" : "location-outline"} size={22} color={color} />
            </View>
          ),
        }}
      />
      <Tabs.Screen
        name="activity"
        options={{
          title: 'Activity',
          tabBarIcon: ({ color, focused }) => (
            <View style={focused ? styles.activeIconContainer : undefined}>
              <Ionicons name={focused ? "pulse" : "pulse-outline"} size={22} color={color} />
            </View>
          ),
        }}
      />
      <Tabs.Screen
        name="phone"
        options={{
          title: 'Phone',
          tabBarIcon: ({ color, focused }) => (
            <View style={focused ? styles.activeIconContainer : undefined}>
              <Ionicons name={focused ? "phone-portrait" : "phone-portrait-outline"} size={22} color={color} />
            </View>
          ),
        }}
      />
      <Tabs.Screen
        name="family"
        options={{
          title: 'Family',
          tabBarIcon: ({ color, focused }) => (
            <View style={focused ? styles.activeIconContainer : undefined}>
              <Ionicons name={focused ? "people" : "people-outline"} size={22} color={color} />
            </View>
          ),
        }}
      />
      <Tabs.Screen
        name="alerts"
        options={{
          href: null,
        }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  activeIconContainer: {
    backgroundColor: 'rgba(129, 140, 248, 0.15)',
    borderRadius: 12,
    padding: 6,
    marginBottom: -6,
  },
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
