
Pas 2: Editează primul fișier
Click pe folder frontend
Click pe folder app
Click pe fișierul index.tsx
Click pe iconița creion (Edit) din dreapta sus
Selectează tot (Ctrl+A) și șterge
Copiază tot textul de mai jos și lipește-l:
import React, { useEffect } from 'react';
import { View, Text, StyleSheet, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { useAuthStore, useCircleStore } from '../lib/store';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';

const CACHED_ROLE_KEY = '@guardian_cached_role';
const CHILD_ROLES = ['child', 'teen'];
const PARENT_ROLES = ['parent', 'owner', 'guardian'];

export default function SplashScreen() {
  const router = useRouter();
  const { isAuthenticated, isLoading, profile } = useAuthStore();
  const { currentRole, currentCircle } = useCircleStore();

  useEffect(() => {
    if (!isLoading) {
      setTimeout(async () => {
        const isProfileComplete = profile && profile.name && profile.name !== 'New User';
        
        if (isAuthenticated && isProfileComplete) {
          const storeRole = currentRole?.toLowerCase()?.trim() || null;
          const profileRole = profile?.role?.toLowerCase()?.trim() || null;
          let cachedRole: string | null = null;
          
          try {
            cachedRole = await AsyncStorage.getItem(CACHED_ROLE_KEY);
            cachedRole = cachedRole?.toLowerCase()?.trim() || null;
          } catch (e) {
            console.log('[SPLASH] Cache read error:', e);
          }
          
          const effectiveRole = storeRole || profileRole || cachedRole;
          console.log(`[SPLASH] Role routing: store=${storeRole}, profile=${profileRole}, cache=${cachedRole}, effective=${effectiveRole}`);
          
          if (effectiveRole) {
            try {
              await AsyncStorage.setItem(CACHED_ROLE_KEY, effectiveRole);
            } catch (e) {
              console.log('[SPLASH] Cache write error:', e);
            }
          }
          
          if (effectiveRole && CHILD_ROLES.includes(effectiveRole)) {
            console.log('[SPLASH] CHILD detected → /(child)/home');
            router.replace('/(child)/home');
          } else {
            console.log('[SPLASH] PARENT/default detected → /(main)/map');
            router.replace('/(main)/map');
          }
        } else if (isAuthenticated && !isProfileComplete) {
          router.replace('/(auth)/onboarding');
        } else {
          router.replace('/(auth)/login');
        }
      }, 1000);
    }
  }, [isAuthenticated, isLoading, profile, currentRole]);

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
