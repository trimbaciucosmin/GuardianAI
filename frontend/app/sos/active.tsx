import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Animated,
  Alert,
  Vibration,
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import * as Haptics from 'expo-haptics';
import { supabase } from '../../lib/supabase';
import { useAuthStore, useCircleStore, useSOSStore } from '../../lib/store';
import { enableSOSMode, disableSOSMode } from '../../lib/locationService';

const COUNTDOWN_SECONDS = 5;

export default function SOSActiveScreen() {
  const router = useRouter();
  const { user } = useAuthStore();
  const { currentCircle } = useCircleStore();
  const { setMyActiveSOS } = useSOSStore();
  
  const [countdown, setCountdown] = useState(COUNTDOWN_SECONDS);
  const [isActive, setIsActive] = useState(false);
  const [isCancelled, setIsCancelled] = useState(false);
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const countdownInterval = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    // Start countdown
    startCountdown();
    startPulseAnimation();

    return () => {
      if (countdownInterval.current) {
        clearInterval(countdownInterval.current);
      }
    };
  }, []);

  const startCountdown = () => {
    countdownInterval.current = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(countdownInterval.current!);
          activateSOS();
          return 0;
        }
        // Haptic feedback on each count
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        return prev - 1;
      });
    }, 1000);
  };

  const startPulseAnimation = () => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.2,
          duration: 500,
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 500,
          useNativeDriver: true,
        }),
      ])
    ).start();
  };

  const activateSOS = async () => {
    if (isCancelled) return;

    setIsActive(true);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    Vibration.vibrate([0, 500, 200, 500]);

    // Enable high-frequency location tracking
    await enableSOSMode();

    try {
      // Get current location
      const location = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.High,
      });

      if (!user || !currentCircle) {
        Alert.alert('Error', 'No active circle. SOS cannot be sent.');
        return;
      }

      // Create SOS event in database
      const sosData = {
        user_id: user.id,
        circle_id: currentCircle.id,
        status: 'active',
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
        started_at: new Date().toISOString(),
      };

      const { data, error } = await supabase
        .from('sos_events')
        .insert(sosData)
        .select()
        .single();

      if (error) throw error;

      setMyActiveSOS(data);

      // Create alert for all circle members
      await supabase
        .from('anomaly_alerts')
        .insert({
          user_id: user.id,
          circle_id: currentCircle.id,
          alert_type: 'sos_triggered',
          title: 'SOS Alert!',
          message: 'Emergency help requested. Check location immediately.',
          severity: 'critical',
          data: {
            latitude: location.coords.latitude,
            longitude: location.coords.longitude,
            sos_id: data.id,
          },
          is_read: false,
          created_at: new Date().toISOString(),
        });

    } catch (error) {
      console.error('SOS activation error:', error);
      Alert.alert('Error', 'Failed to send SOS. Please call emergency services.');
    }
  };

  const cancelSOS = () => {
    setIsCancelled(true);
    if (countdownInterval.current) {
      clearInterval(countdownInterval.current);
    }
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    router.back();
  };

  const resolveSOS = async () => {
    try {
      // Disable high-frequency tracking
      await disableSOSMode();
      
      if (user) {
        await supabase
          .from('sos_events')
          .update({ status: 'resolved', ended_at: new Date().toISOString() })
          .eq('user_id', user.id)
          .eq('status', 'active');
      }
      setMyActiveSOS(null);
      router.back();
    } catch (error) {
      console.error('Resolve SOS error:', error);
    }
  };

  if (isActive) {
    return (
      <View style={styles.activeContainer}>
        <SafeAreaView style={styles.activeContent}>
          <View style={styles.activeHeader}>
            <View style={styles.pulseWrapper}>
              <Animated.View style={[styles.pulseRing, { transform: [{ scale: pulseAnim }] }]} />
              <View style={styles.activeIcon}>
                <Ionicons name="alert" size={64} color="#FFFFFF" />
              </View>
            </View>
            <Text style={styles.activeTitle}>SOS ACTIVE</Text>
            <Text style={styles.activeSubtitle}>Your family has been alerted</Text>
          </View>

          <View style={styles.activeInfo}>
            <View style={styles.infoCard}>
              <Ionicons name="location" size={24} color="#EF4444" />
              <Text style={styles.infoText}>Sharing live location</Text>
            </View>
            <View style={styles.infoCard}>
              <Ionicons name="people" size={24} color="#EF4444" />
              <Text style={styles.infoText}>Family members notified</Text>
            </View>
          </View>

          <TouchableOpacity style={styles.resolveButton} onPress={resolveSOS}>
            <Text style={styles.resolveText}>I'm Safe - End SOS</Text>
          </TouchableOpacity>
        </SafeAreaView>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <SafeAreaView style={styles.content}>
        {/* Countdown */}
        <View style={styles.countdownContainer}>
          <Animated.View style={[styles.countdownCircle, { transform: [{ scale: pulseAnim }] }]}>
            <Text style={styles.countdownNumber}>{countdown}</Text>
          </Animated.View>
          <Text style={styles.countdownLabel}>Sending SOS in...</Text>
        </View>

        {/* Warning */}
        <View style={styles.warningContainer}>
          <Ionicons name="warning" size={32} color="#F59E0B" />
          <Text style={styles.warningText}>
            This will alert all family members and share your location continuously.
          </Text>
        </View>

        {/* Cancel Button */}
        <TouchableOpacity style={styles.cancelButton} onPress={cancelSOS}>
          <Text style={styles.cancelText}>Cancel</Text>
        </TouchableOpacity>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#7F1D1D',
  },
  content: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
  },
  countdownContainer: {
    alignItems: 'center',
    marginBottom: 48,
  },
  countdownCircle: {
    width: 180,
    height: 180,
    borderRadius: 90,
    backgroundColor: '#DC2626',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 4,
    borderColor: '#FFFFFF',
    marginBottom: 24,
  },
  countdownNumber: {
    fontSize: 72,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  countdownLabel: {
    fontSize: 24,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  warningContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
    borderRadius: 16,
    padding: 20,
    gap: 16,
    marginBottom: 48,
  },
  warningText: {
    flex: 1,
    fontSize: 14,
    color: '#FEF3C7',
    lineHeight: 20,
  },
  cancelButton: {
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    borderRadius: 16,
    paddingVertical: 18,
    paddingHorizontal: 64,
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
  cancelText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  activeContainer: {
    flex: 1,
    backgroundColor: '#DC2626',
  },
  activeContent: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
  },
  activeHeader: {
    alignItems: 'center',
    marginBottom: 48,
  },
  pulseWrapper: {
    position: 'relative',
    marginBottom: 24,
  },
  pulseRing: {
    position: 'absolute',
    width: 160,
    height: 160,
    borderRadius: 80,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    top: -16,
    left: -16,
  },
  activeIcon: {
    width: 128,
    height: 128,
    borderRadius: 64,
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  activeTitle: {
    fontSize: 32,
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: 8,
  },
  activeSubtitle: {
    fontSize: 16,
    color: 'rgba(255, 255, 255, 0.8)',
  },
  activeInfo: {
    gap: 12,
    marginBottom: 48,
  },
  infoCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    borderRadius: 12,
    padding: 16,
    gap: 12,
    minWidth: 280,
  },
  infoText: {
    fontSize: 16,
    color: '#FFFFFF',
    fontWeight: '500',
  },
  resolveButton: {
    backgroundColor: '#10B981',
    borderRadius: 16,
    paddingVertical: 18,
    paddingHorizontal: 48,
  },
  resolveText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#FFFFFF',
  },
});
