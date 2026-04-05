/**
 * SOSAlertOverlay Component
 * 
 * Global overlay that appears when any family member triggers SOS.
 * Shows on top of all screens.
 */

import React, { useEffect, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Animated,
  Vibration,
  Modal,
  Linking,
  Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { SOSEvent } from '../types';
import { getInitials, getAvatarColor, formatRelativeTime } from '../utils/helpers';
import { supabase } from '../lib/supabase';

interface SOSAlertOverlayProps {
  sosEvent: SOSEvent | null;
  memberName?: string;
  memberId?: string;
  memberPhone?: string;
  onDismiss: () => void;
  onViewLocation: () => void;
}

export const SOSAlertOverlay: React.FC<SOSAlertOverlayProps> = ({
  sosEvent,
  memberName = 'Family Member',
  memberId = '',
  memberPhone,
  onDismiss,
  onViewLocation,
}) => {
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const slideAnim = useRef(new Animated.Value(-200)).current;

  useEffect(() => {
    if (sosEvent && sosEvent.status === 'active') {
      // Vibrate and haptic feedback
      Vibration.vibrate([0, 500, 200, 500, 200, 500]);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);

      // Slide in animation
      Animated.spring(slideAnim, {
        toValue: 0,
        useNativeDriver: true,
        tension: 50,
        friction: 8,
      }).start();

      // Pulse animation
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 1.1,
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
    } else {
      // Slide out
      Animated.timing(slideAnim, {
        toValue: -200,
        duration: 300,
        useNativeDriver: true,
      }).start();
    }
  }, [sosEvent]);

  // Call the child who sent SOS
  const handleCallChild = async () => {
    try {
      // Try to get phone number from profile
      const { data: profile } = await supabase
        .from('profiles')
        .select('phone')
        .eq('user_id', memberId)
        .single();
      
      const phoneNumber = profile?.phone || memberPhone;
      
      if (phoneNumber) {
        const phoneUrl = Platform.OS === 'ios' 
          ? `telprompt:${phoneNumber}` 
          : `tel:${phoneNumber}`;
        await Linking.openURL(phoneUrl);
      } else {
        // Alert that no phone number is available
        if (typeof window !== 'undefined') {
          window.alert('Numărul de telefon nu este disponibil pentru acest membru.');
        }
      }
    } catch (error) {
      console.error('Call error:', error);
    }
  };

  // Mark the person as safe (resolve SOS)
  const handleMarkSafe = async () => {
    try {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      
      // Update SOS status to resolved
      await supabase
        .from('sos_events')
        .update({ 
          status: 'resolved', 
          ended_at: new Date().toISOString(),
          resolved_by: 'parent' 
        })
        .eq('id', sosEvent?.id);

      // Create notification that SOS was marked safe by parent
      await supabase
        .from('anomaly_alerts')
        .insert({
          user_id: memberId,
          circle_id: sosEvent?.circle_id,
          alert_type: 'sos_resolved',
          title: 'SOS Resolved',
          message: 'A parent has confirmed you are safe.',
          severity: 'info',
          is_read: false,
          created_at: new Date().toISOString(),
        });

      onDismiss();
    } catch (error) {
      console.error('Mark safe error:', error);
    }
  };

  if (!sosEvent || sosEvent.status !== 'active') {
    return null;
  }

  return (
    <Modal
      visible={true}
      transparent={true}
      animationType="none"
      statusBarTranslucent={true}
    >
      <View style={styles.overlay}>
        <Animated.View 
          style={[
            styles.container,
            { transform: [{ translateY: slideAnim }] }
          ]}
        >
          {/* Pulsing Icon */}
          <Animated.View 
            style={[
              styles.iconContainer,
              { transform: [{ scale: pulseAnim }] }
            ]}
          >
            <View style={styles.iconInner}>
              <Ionicons name="alert" size={32} color="#FFFFFF" />
            </View>
          </Animated.View>

          {/* Alert Content */}
          <View style={styles.content}>
            <Text style={styles.title}>SOS ALERT</Text>
            
            <View style={styles.memberRow}>
              <View style={[styles.avatar, { backgroundColor: getAvatarColor(memberId) }]}>
                <Text style={styles.avatarText}>{getInitials(memberName)}</Text>
              </View>
              <View style={styles.memberInfo}>
                <Text style={styles.memberName}>{memberName}</Text>
                <Text style={styles.alertTime}>
                  {formatRelativeTime(sosEvent.started_at)}
                </Text>
              </View>
            </View>

            <Text style={styles.message}>
              needs help! Tap to view their location.
            </Text>

            {/* Actions */}
            <View style={styles.actions}>
              {/* View Location Button */}
              <TouchableOpacity 
                style={styles.viewButton}
                onPress={onViewLocation}
              >
                <Ionicons name="location" size={20} color="#DC2626" />
                <Text style={styles.viewButtonText}>View Location</Text>
              </TouchableOpacity>

              {/* Call and Safe buttons row */}
              <View style={styles.actionRow}>
                {/* Call Child Button */}
                <TouchableOpacity 
                  style={styles.callButton}
                  onPress={handleCallChild}
                >
                  <Ionicons name="call" size={20} color="#FFFFFF" />
                  <Text style={styles.callButtonText}>Call</Text>
                </TouchableOpacity>

                {/* I'm Safe / Mark Safe Button */}
                <TouchableOpacity 
                  style={styles.safeButton}
                  onPress={handleMarkSafe}
                >
                  <Ionicons name="checkmark-circle" size={20} color="#FFFFFF" />
                  <Text style={styles.safeButtonText}>Mark Safe</Text>
                </TouchableOpacity>
              </View>

              <TouchableOpacity 
                style={styles.dismissButton}
                onPress={onDismiss}
              >
                <Text style={styles.dismissText}>Dismiss</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Animated.View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'flex-start',
    paddingTop: 60,
  },
  container: {
    marginHorizontal: 16,
    backgroundColor: '#DC2626',
    borderRadius: 20,
    padding: 20,
    shadowColor: '#DC2626',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.5,
    shadowRadius: 16,
    elevation: 10,
  },
  iconContainer: {
    position: 'absolute',
    top: -30,
    alignSelf: 'center',
  },
  iconInner: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#DC2626',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 4,
    borderColor: '#FFFFFF',
  },
  content: {
    marginTop: 20,
  },
  title: {
    fontSize: 24,
    fontWeight: '800',
    color: '#FFFFFF',
    textAlign: 'center',
    letterSpacing: 2,
    marginBottom: 16,
  },
  memberRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '600',
  },
  memberInfo: {
    marginLeft: 12,
    flex: 1,
  },
  memberName: {
    fontSize: 18,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  alertTime: {
    fontSize: 13,
    color: 'rgba(255, 255, 255, 0.7)',
    marginTop: 2,
  },
  message: {
    fontSize: 16,
    color: '#FFFFFF',
    textAlign: 'center',
    marginBottom: 20,
  },
  actions: {
    gap: 10,
  },
  actionRow: {
    flexDirection: 'row',
    gap: 10,
  },
  viewButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    paddingVertical: 14,
    gap: 8,
  },
  viewButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#DC2626',
  },
  callButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#2563EB',
    borderRadius: 12,
    paddingVertical: 14,
    gap: 8,
  },
  callButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  safeButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#10B981',
    borderRadius: 12,
    paddingVertical: 14,
    gap: 8,
  },
  safeButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  dismissButton: {
    alignItems: 'center',
    paddingVertical: 10,
  },
  dismissText: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.7)',
  },
});

export default SOSAlertOverlay;
