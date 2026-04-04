import React, { useEffect, useState } from 'react';
import { Stack, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { supabase } from '../lib/supabase';
import { useAuthStore, useCircleStore, useRealtimeStore } from '../lib/store';
import { SOSAlertOverlay } from '../components/SOSAlertOverlay';
import { useRealtimeSubscription } from '../hooks/useRealtimeSubscription';
import { LanguageProvider } from '../lib/i18n';
import 'react-native-url-polyfill/auto';

export default function RootLayout() {
  const router = useRouter();
  const { setUser, setProfile, setLoading, isLoading, user } = useAuthStore();
  const { currentCircle, members } = useCircleStore();
  const { 
    globalSOSEvent, 
    sosEventMemberName, 
    dismissSOS, 
    setGlobalSOSEvent,
    setConnectionState 
  } = useRealtimeStore();
  const [isInitialized, setIsInitialized] = useState(false);

  // Global realtime subscription for SOS events
  const { 
    isConnected, 
    connectionError, 
    lastSOSEvent 
  } = useRealtimeSubscription(currentCircle?.id || null);

  // Update connection state in global store
  useEffect(() => {
    setConnectionState(isConnected, connectionError);
  }, [isConnected, connectionError]);

  // Handle global SOS events from realtime
  useEffect(() => {
    if (lastSOSEvent?.data && user) {
      const sosEvent = lastSOSEvent.data;
      
      // Only show overlay for other family members' SOS, not your own
      if (sosEvent.status === 'active' && sosEvent.user_id !== user.id) {
        // Find member name
        const member = members.find(m => m.user_id === sosEvent.user_id);
        const memberName = (member as any)?.profiles?.name || 'Family Member';
        setGlobalSOSEvent(sosEvent, memberName);
      } else if (sosEvent.status === 'cancelled' || sosEvent.status === 'resolved') {
        // Clear the global SOS if it matches
        if (globalSOSEvent?.id === sosEvent.id) {
          setGlobalSOSEvent(null, null);
        }
      }
    }
  }, [lastSOSEvent, user, members]);

  useEffect(() => {
    // Check initial session
    const initAuth = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        setUser(session?.user ?? null);
        
        if (session?.user) {
          // Fetch profile
          const { data: profile } = await supabase
            .from('profiles')
            .select('*')
            .eq('user_id', session.user.id)
            .single();
          setProfile(profile);
        }
      } catch (error) {
        console.error('Auth init error:', error);
      } finally {
        setLoading(false);
        setIsInitialized(true);
      }
    };

    initAuth();

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      setUser(session?.user ?? null);
      
      if (session?.user) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('*')
          .eq('user_id', session.user.id)
          .single();
        setProfile(profile);
      } else {
        setProfile(null);
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  // Handle SOS overlay actions
  const handleDismissSOS = () => {
    if (globalSOSEvent) {
      dismissSOS(globalSOSEvent.id);
    }
  };

  const handleViewSOSLocation = () => {
    // Navigate to map and dismiss overlay
    if (globalSOSEvent) {
      dismissSOS(globalSOSEvent.id);
      router.push('/(main)/map');
    }
  };

  if (!isInitialized || isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#6366F1" />
      </View>
    );
  }

  return (
    <LanguageProvider>
      <SafeAreaProvider>
        <StatusBar style="light" />
        <Stack
          screenOptions={{
            headerShown: false,
            contentStyle: { backgroundColor: '#0F172A' },
            animation: 'slide_from_right',
          }}
        >
          <Stack.Screen name="language-select" />
          <Stack.Screen name="index" />
          <Stack.Screen name="(auth)" options={{ headerShown: false }} />
          <Stack.Screen name="(main)" options={{ headerShown: false }} />
          <Stack.Screen name="circle" options={{ headerShown: false }} />
          <Stack.Screen name="place" options={{ headerShown: false }} />
          <Stack.Screen name="sos" options={{ headerShown: false, presentation: 'fullScreenModal' }} />
          <Stack.Screen name="trip" options={{ headerShown: false }} />
          <Stack.Screen name="settings" options={{ headerShown: false }} />
          <Stack.Screen name="(child)" options={{ headerShown: false }} />
        </Stack>

        {/* Global SOS Alert Overlay - shows on top of all screens */}
        <SOSAlertOverlay
          sosEvent={globalSOSEvent}
          memberName={sosEventMemberName || 'Family Member'}
          memberId={globalSOSEvent?.user_id || ''}
          onDismiss={handleDismissSOS}
          onViewLocation={handleViewSOSLocation}
        />
      </SafeAreaProvider>
    </LanguageProvider>
  );
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#0F172A',
  },
});
