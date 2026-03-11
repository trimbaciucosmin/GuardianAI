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
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { SOSEvent } from '../types';
import { getInitials, getAvatarColor, formatRelativeTime } from '../utils/helpers';

interface SOSAlertOverlayProps {
  sosEvent: SOSEvent | null;
  memberName?: string;
  memberId?: string;
  onDismiss: () => void;
  onViewLocation: () => void;
}

export const SOSAlertOverlay: React.FC<SOSAlertOverlayProps> = ({
  sosEvent,
  memberName = 'Family Member',
  memberId = '',
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
              <TouchableOpacity 
                style={styles.viewButton}
                onPress={onViewLocation}
              >
                <Ionicons name="location" size={20} color="#FFFFFF" />
                <Text style={styles.viewButtonText}>View Location</Text>
              </TouchableOpacity>

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
