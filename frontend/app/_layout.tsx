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

// Helper function to load user's circle and role
async function loadUserCircle(userId: string): Promise<{ circle: any; role: string | null } | null> {
  try {
    // Find circles where user is a member - also get their role
    const { data: memberData, error: memberError } = await supabase
      .from('circle_members')
      .select('circle_id, role')
      .eq('user_id', userId)
      .limit(1)
      .single();
    
    if (memberError || !memberData) {
      console.log('[CIRCLE] User not in any circle yet');
      return null;
    }
    
    // Get the circle details
    const { data: circleData, error: circleError } = await supabase
      .from('family_circles')
      .select('*')
      .eq('id', memberData.circle_id)
      .single();
    
    if (circleError || !circleData) {
      console.log('[CIRCLE] Could not load circle details');
      return null;
    }
    
    console.log('[CIRCLE] Loaded circle:', circleData.name, 'role:', memberData.role);
    return { 
      circle: circleData,
      role: memberData.role || null
    };
  } catch (error) {
    console.log('[CIRCLE] Error loading circle:', error);
    return null;
  }
}

export default function RootLayout() {
  const router = useRouter();
  const { setUser, setProfile, setLoading, isLoading, user } = useAuthStore();
  const { currentCircle, members, setCurrentCircle, setCurrentRole } = useCircleStore();
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
    // Check initial session with retry
    const initAuth = async () => {
      let retries = 3;
      
      while (retries > 0) {
        try {
          // Try to get session
          const { data: { session }, error: sessionError } = await supabase.auth.getSession();
          
          if (sessionError) {
            console.log('[AUTH] Session error, retrying...', sessionError);
            retries--;
            if (retries > 0) {
              await new Promise(r => setTimeout(r, 1000));
              continue;
            }
          }
          
          setUser(session?.user ?? null);
          
          if (session?.user) {
            // Refresh the session to ensure it's valid
            const { data: refreshData } = await supabase.auth.refreshSession();
            if (refreshData.session) {
              setUser(refreshData.session.user);
            }
            
            // Fetch profile
            const { data: profile, error: profileError } = await supabase
              .from('profiles')
              .select('*')
              .eq('user_id', session.user.id)
              .single();
            
            if (!profileError && profile) {
              setProfile(profile);
            }
            
            // AUTO-LOAD USER'S CIRCLE AND ROLE
            const circleData = await loadUserCircle(session.user.id);
            if (circleData) {
              setCurrentCircle(circleData.circle);
              setCurrentRole(circleData.role);
              console.log('[AUTH] Auto-loaded circle and role for user');
            } else {
              // User has no circle - use profile role
              setCurrentRole(profile?.role || null);
            }
          }
          
          // Success - exit loop
          break;
        } catch (error) {
          console.error('[AUTH] Init error:', error);
          retries--;
          if (retries > 0) {
            await new Promise(r => setTimeout(r, 1000));
          }
        }
      }
      
      setLoading(false);
      setIsInitialized(true);
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
        
        // Also load circle and role on auth change
        const circleData = await loadUserCircle(session.user.id);
        if (circleData) {
          setCurrentCircle(circleData.circle);
          setCurrentRole(circleData.role);
        } else {
          setCurrentRole(profile?.role || null);
        }
      } else {
        setProfile(null);
        setCurrentCircle(null);
        setCurrentRole(null);
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
