/**
 * Premium Badge Component
 * Shows "Premium" badge on premium-only features
 */

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';

interface PremiumBadgeProps {
  size?: 'small' | 'medium' | 'large';
  variant?: 'solid' | 'outline' | 'gradient';
  showIcon?: boolean;
  label?: string;
}

export function PremiumBadge({ 
  size = 'small', 
  variant = 'solid',
  showIcon = true,
  label = 'Premium'
}: PremiumBadgeProps) {
  const sizeStyles = {
    small: { paddingHorizontal: 6, paddingVertical: 2, fontSize: 10, iconSize: 10 },
    medium: { paddingHorizontal: 8, paddingVertical: 4, fontSize: 11, iconSize: 12 },
    large: { paddingHorizontal: 12, paddingVertical: 6, fontSize: 13, iconSize: 14 },
  };

  const config = sizeStyles[size];

  if (variant === 'gradient') {
    return (
      <LinearGradient
        colors={['#F59E0B', '#D97706']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={[
          styles.badge,
          { paddingHorizontal: config.paddingHorizontal, paddingVertical: config.paddingVertical }
        ]}
      >
        {showIcon && (
          <Ionicons name="star" size={config.iconSize} color="#FFFFFF" style={styles.icon} />
        )}
        <Text style={[styles.text, { fontSize: config.fontSize }]}>{label}</Text>
      </LinearGradient>
    );
  }

  if (variant === 'outline') {
    return (
      <View style={[
        styles.badge, 
        styles.outlineBadge,
        { paddingHorizontal: config.paddingHorizontal, paddingVertical: config.paddingVertical }
      ]}>
        {showIcon && (
          <Ionicons name="star" size={config.iconSize} color="#F59E0B" style={styles.icon} />
        )}
        <Text style={[styles.outlineText, { fontSize: config.fontSize }]}>{label}</Text>
      </View>
    );
  }

  return (
    <View style={[
      styles.badge, 
      styles.solidBadge,
      { paddingHorizontal: config.paddingHorizontal, paddingVertical: config.paddingVertical }
    ]}>
      {showIcon && (
        <Ionicons name="star" size={config.iconSize} color="#0F172A" style={styles.icon} />
      )}
      <Text style={[styles.solidText, { fontSize: config.fontSize }]}>{label}</Text>
    </View>
  );
}

/**
 * Inline premium indicator for list items
 */
export function PremiumIndicator() {
  return (
    <View style={styles.indicator}>
      <Ionicons name="lock-closed" size={12} color="#F59E0B" />
    </View>
  );
}

/**
 * Status badge for subscription status display
 */
interface StatusBadgeProps {
  status: 'free' | 'trial_active' | 'premium_active' | 'premium_expired' | 'billing_issue' | 'cancelled';
  lang?: 'en' | 'ro';
}

export function StatusBadge({ status, lang = 'en' }: StatusBadgeProps) {
  const config: Record<string, { bg: string; text: string; icon: string; labelEn: string; labelRo: string }> = {
    free: { bg: 'rgba(100, 116, 139, 0.2)', text: '#94A3B8', icon: 'shield-outline', labelEn: 'Free', labelRo: 'Gratuit' },
    trial_active: { bg: 'rgba(16, 185, 129, 0.2)', text: '#10B981', icon: 'time', labelEn: 'Trial', labelRo: 'Trial' },
    premium_active: { bg: 'rgba(245, 158, 11, 0.2)', text: '#F59E0B', icon: 'shield-checkmark', labelEn: 'Premium', labelRo: 'Premium' },
    premium_expired: { bg: 'rgba(239, 68, 68, 0.2)', text: '#EF4444', icon: 'close-circle', labelEn: 'Expired', labelRo: 'Expirat' },
    billing_issue: { bg: 'rgba(239, 68, 68, 0.2)', text: '#EF4444', icon: 'alert-circle', labelEn: 'Billing Issue', labelRo: 'Problemă Plată' },
    cancelled: { bg: 'rgba(251, 191, 36, 0.2)', text: '#FCD34D', icon: 'time-outline', labelEn: 'Cancelled', labelRo: 'Anulat' },
  };

  const c = config[status] || config.free;
  const label = lang === 'ro' ? c.labelRo : c.labelEn;

  return (
    <View style={[styles.statusBadge, { backgroundColor: c.bg }]}>
      <Ionicons name={c.icon as any} size={14} color={c.text} />
      <Text style={[styles.statusText, { color: c.text }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 6,
  },
  solidBadge: {
    backgroundColor: '#F59E0B',
  },
  outlineBadge: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: '#F59E0B',
  },
  icon: {
    marginRight: 3,
  },
  text: {
    fontWeight: '700',
    color: '#FFFFFF',
  },
  solidText: {
    fontWeight: '700',
    color: '#0F172A',
  },
  outlineText: {
    fontWeight: '600',
    color: '#F59E0B',
  },
  indicator: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: 'rgba(245, 158, 11, 0.15)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    gap: 5,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '600',
  },
});

export default PremiumBadge;
