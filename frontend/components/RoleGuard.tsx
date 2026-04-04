/**
 * RoleGuard Component
 * Restricts access to certain screens based on user role
 * Used to enforce role-based access control in the UI
 */

import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useCircleStore } from '../lib/store';

type AllowedRole = 'parent' | 'child' | 'teen' | 'any';

interface RoleGuardProps {
  children: React.ReactNode;
  allowedRoles: AllowedRole[];
  fallbackMessage?: string;
  redirectTo?: string;
}

export function RoleGuard({
  children,
  allowedRoles,
  fallbackMessage = 'Nu ai permisiunea să accesezi această pagină',
  redirectTo,
}: RoleGuardProps) {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { currentRole } = useCircleStore();

  // If 'any' is in allowed roles, let everyone through
  if (allowedRoles.includes('any')) {
    return <>{children}</>;
  }

  // If no role is set yet, let through (role will be checked on next render)
  if (!currentRole) {
    return <>{children}</>;
  }

  // Parents always have access
  if (currentRole === 'parent') {
    return <>{children}</>;
  }

  // Check if current role is allowed
  if (allowedRoles.includes(currentRole)) {
    return <>{children}</>;
  }

  // Access denied - show message or redirect
  return (
    <View style={[styles.container, { paddingTop: insets.top + 20 }]}>
      <View style={styles.iconContainer}>
        <Ionicons name="lock-closed" size={64} color="#6366F1" />
      </View>
      <Text style={styles.title}>Acces restricționat</Text>
      <Text style={styles.message}>{fallbackMessage}</Text>
      
      <TouchableOpacity
        style={styles.backButton}
        onPress={() => {
          if (redirectTo) {
            router.replace(redirectTo);
          } else if (currentRole === 'child' || currentRole === 'teen') {
            router.replace('/(child)/home');
          } else {
            router.back();
          }
        }}
      >
        <Ionicons name="arrow-back" size={20} color="#FFFFFF" />
        <Text style={styles.backButtonText}>Înapoi</Text>
      </TouchableOpacity>
    </View>
  );
}

// HOC version for easier use
export function withRoleGuard<P extends object>(
  Component: React.ComponentType<P>,
  allowedRoles: AllowedRole[],
  fallbackMessage?: string
) {
  return function GuardedComponent(props: P) {
    return (
      <RoleGuard allowedRoles={allowedRoles} fallbackMessage={fallbackMessage}>
        <Component {...props} />
      </RoleGuard>
    );
  };
}

// Hook to check role permissions
export function useRolePermissions() {
  const { currentRole } = useCircleStore();

  return {
    isParent: currentRole === 'parent',
    isChild: currentRole === 'child' || currentRole === 'teen',
    canManageFamily: currentRole === 'parent',
    canEditPlaces: currentRole === 'parent',
    canViewAllLocations: currentRole === 'parent',
    canStartSafeTrip: true, // Both roles can start trips
    canTriggerSOS: true, // Both roles can trigger SOS
  };
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0F172A',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  iconContainer: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: 'rgba(99, 102, 241, 0.15)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: 12,
  },
  message: {
    fontSize: 16,
    color: '#94A3B8',
    textAlign: 'center',
    marginBottom: 32,
    lineHeight: 24,
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#6366F1',
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: 12,
    gap: 8,
  },
  backButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
});
