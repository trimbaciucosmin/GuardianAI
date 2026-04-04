/**
 * MemberCard Component
 * Displays family member information in a card format
 * With clear UX messages for each status
 */

import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useLanguage } from '../lib/i18n';
import {
  FamilyRole,
  MemberStatus,
  Relationship,
  ROLE_INFO,
  RELATIONSHIP_INFO,
  getRoleLabel,
  getRelationshipLabel,
} from '../lib/familyRoles';

interface MemberCardProps {
  id: string;
  userId: string;
  name: string;
  role: FamilyRole;
  relationship?: Relationship;
  status: MemberStatus;
  isOnline: boolean;
  lastSeen?: string | null;
  batteryLevel?: number;
  isCurrentUser?: boolean;
  onPress?: () => void;
  onEdit?: () => void;
  onRemove?: () => void;
  canEdit?: boolean;
  canRemove?: boolean;
}

// Clear UX messages for each status
const getStatusDisplay = (status: MemberStatus, isOnline: boolean, lang: 'en' | 'ro') => {
  const displays: Record<MemberStatus, { icon: string; text: string; textRo: string; color: string; description?: string; descriptionRo?: string }> = {
    active: {
      icon: isOnline ? 'radio-button-on' : 'time-outline',
      text: isOnline ? 'Online now' : 'Offline',
      textRo: isOnline ? 'Online acum' : 'Deconectat',
      color: isOnline ? '#10B981' : '#64748B',
    },
    invited: {
      icon: 'mail-outline',
      text: 'Invitation sent',
      textRo: 'Invitație trimisă',
      color: '#F59E0B',
      description: 'Waiting to accept',
      descriptionRo: 'Așteaptă acceptarea',
    },
    pending: {
      icon: 'hourglass-outline',
      text: 'Connecting...',
      textRo: 'Se conectează...',
      color: '#F59E0B',
      description: 'Setting up device',
      descriptionRo: 'Configurare dispozitiv',
    },
    device_paired: {
      icon: 'phone-portrait-outline',
      text: 'Device ready',
      textRo: 'Dispozitiv pregătit',
      color: '#3B82F6',
      description: 'Waiting for permissions',
      descriptionRo: 'Așteaptă permisiuni',
    },
    permissions_incomplete: {
      icon: 'warning-outline',
      text: 'Permissions needed',
      textRo: 'Permisiuni necesare',
      color: '#EF4444',
      description: 'Location access required',
      descriptionRo: 'Acces locație necesar',
    },
    offline: {
      icon: 'cloud-offline-outline',
      text: 'Offline',
      textRo: 'Deconectat',
      color: '#64748B',
    },
  };
  
  return displays[status] || displays.offline;
};

// Format last seen time with clear messages
const formatLastSeen = (timestamp?: string | null, lang: 'en' | 'ro' = 'en'): string => {
  if (!timestamp) return '';
  
  const now = new Date();
  const then = new Date(timestamp);
  const diffMs = now.getTime() - then.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  
  if (diffMins < 1) return lang === 'ro' ? 'Chiar acum' : 'Just now';
  if (diffMins < 60) return lang === 'ro' ? `Acum ${diffMins} min` : `${diffMins}m ago`;
  
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return lang === 'ro' ? `Acum ${diffHours}h` : `${diffHours}h ago`;
  
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays === 1) return lang === 'ro' ? 'Ieri' : 'Yesterday';
  if (diffDays < 7) return lang === 'ro' ? `Acum ${diffDays} zile` : `${diffDays}d ago`;
  
  return lang === 'ro' ? `Acum ${Math.floor(diffDays / 7)} săpt.` : `${Math.floor(diffDays / 7)}w ago`;
};

export function MemberCard({
  name,
  role,
  relationship,
  status,
  isOnline,
  lastSeen,
  batteryLevel,
  isCurrentUser,
  onPress,
  onEdit,
  onRemove,
  canEdit,
  canRemove,
}: MemberCardProps) {
  const { language } = useLanguage();
  const lang = language as 'en' | 'ro';
  
  const roleInfo = ROLE_INFO[role];
  const statusDisplay = getStatusDisplay(status, isOnline, lang);

  // Get battery icon and color
  const getBatteryInfo = (level?: number): { icon: string; color: string } => {
    if (level === undefined || level === null) {
      return { icon: 'battery-dead', color: '#64748B' };
    }
    if (level > 75) return { icon: 'battery-full', color: '#10B981' };
    if (level > 50) return { icon: 'battery-half', color: '#10B981' };
    if (level > 25) return { icon: 'battery-half', color: '#F59E0B' };
    if (level > 10) return { icon: 'battery-low', color: '#EF4444' };
    return { icon: 'battery-dead', color: '#EF4444' };
  };

  const batteryInfo = getBatteryInfo(batteryLevel);
  const isSetupPhase = ['invited', 'pending', 'device_paired', 'permissions_incomplete'].includes(status);

  return (
    <TouchableOpacity
      style={[styles.container, isSetupPhase && styles.containerSetup]}
      onPress={onPress}
      activeOpacity={onPress ? 0.7 : 1}
    >
      {/* Avatar */}
      <View style={styles.avatarContainer}>
        <View style={[styles.avatar, { backgroundColor: roleInfo.badgeColor }]}>
          <Text style={[styles.avatarText, { color: roleInfo.color }]}>
            {name?.[0]?.toUpperCase() || '?'}
          </Text>
        </View>
        {/* Status indicator dot */}
        <View
          style={[
            styles.statusDot,
            { backgroundColor: statusDisplay.color },
          ]}
        />
      </View>

      {/* Member Info */}
      <View style={styles.infoContainer}>
        {/* Name Row */}
        <View style={styles.nameRow}>
          <Text style={styles.name} numberOfLines={1}>
            {name || (lang === 'ro' ? 'Necunoscut' : 'Unknown')}
            {isCurrentUser && (
              <Text style={styles.youBadge}> ({lang === 'ro' ? 'Tu' : 'You'})</Text>
            )}
          </Text>
        </View>

        {/* Role & Relationship Row */}
        <View style={styles.badgeRow}>
          {/* Role Badge */}
          <View style={[styles.badge, { backgroundColor: roleInfo.badgeColor }]}>
            <Ionicons name={roleInfo.icon as any} size={12} color={roleInfo.color} />
            <Text style={[styles.badgeText, { color: roleInfo.color }]}>
              {getRoleLabel(role, lang)}
            </Text>
          </View>

          {/* Relationship Badge */}
          {relationship && (
            <View style={[styles.badge, styles.relationshipBadge]}>
              <Text style={styles.relationshipText}>
                {getRelationshipLabel(relationship, lang)}
              </Text>
            </View>
          )}
        </View>

        {/* Status Row - Different display for setup vs active */}
        <View style={styles.statusRow}>
          {/* Main Status */}
          <View style={styles.statusItem}>
            <Ionicons name={statusDisplay.icon as any} size={14} color={statusDisplay.color} />
            <Text style={[styles.statusText, { color: statusDisplay.color }]}>
              {lang === 'ro' ? statusDisplay.textRo : statusDisplay.text}
            </Text>
          </View>

          {/* Setup phase description */}
          {isSetupPhase && statusDisplay.description && (
            <>
              <Text style={styles.separator}>-</Text>
              <Text style={styles.statusDescription}>
                {lang === 'ro' ? statusDisplay.descriptionRo : statusDisplay.description}
              </Text>
            </>
          )}

          {/* Active member: Last seen + Battery */}
          {status === 'active' && !isOnline && lastSeen && (
            <>
              <Text style={styles.separator}>•</Text>
              <Text style={styles.statusTextGray}>
                {formatLastSeen(lastSeen, lang)}
              </Text>
            </>
          )}

          {/* Battery for active/offline members */}
          {(status === 'active' || status === 'offline') && batteryLevel !== undefined && (
            <>
              <Text style={styles.separator}>•</Text>
              <View style={styles.statusItem}>
                <Ionicons name={batteryInfo.icon as any} size={14} color={batteryInfo.color} />
                <Text style={[styles.statusText, { color: batteryInfo.color }]}>
                  {batteryLevel}%
                </Text>
              </View>
            </>
          )}
        </View>
      </View>

      {/* Action Buttons */}
      {(canEdit || canRemove) && !isCurrentUser && (
        <View style={styles.actions}>
          {canEdit && (
            <TouchableOpacity
              style={styles.actionButton}
              onPress={(e) => {
                e.stopPropagation();
                onEdit?.();
              }}
            >
              <Ionicons name="create-outline" size={18} color="#6366F1" />
            </TouchableOpacity>
          )}
          {canRemove && (
            <TouchableOpacity
              style={[styles.actionButton, styles.removeButton]}
              onPress={(e) => {
                e.stopPropagation();
                onRemove?.();
              }}
            >
              <Ionicons name="trash-outline" size={18} color="#EF4444" />
            </TouchableOpacity>
          )}
        </View>
      )}

      {/* Chevron for navigation (when no edit/remove buttons) */}
      {onPress && !canEdit && !canRemove && (
        <Ionicons name="chevron-forward" size={20} color="#64748B" />
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1E293B',
    borderRadius: 14,
    padding: 14,
    marginBottom: 10,
  },
  containerSetup: {
    borderWidth: 1,
    borderColor: '#334155',
    borderStyle: 'dashed',
  },
  avatarContainer: {
    position: 'relative',
  },
  avatar: {
    width: 52,
    height: 52,
    borderRadius: 26,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: {
    fontSize: 22,
    fontWeight: '700',
  },
  statusDot: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 16,
    height: 16,
    borderRadius: 8,
    borderWidth: 3,
    borderColor: '#1E293B',
  },
  infoContainer: {
    flex: 1,
    marginLeft: 14,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  name: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
    flex: 1,
  },
  youBadge: {
    fontSize: 14,
    fontWeight: '400',
    color: '#64748B',
  },
  badgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: 6,
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    gap: 4,
  },
  badgeText: {
    fontSize: 11,
    fontWeight: '600',
  },
  relationshipBadge: {
    backgroundColor: 'rgba(148, 163, 184, 0.15)',
  },
  relationshipText: {
    fontSize: 11,
    fontWeight: '500',
    color: '#94A3B8',
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
  },
  statusItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '500',
  },
  statusTextGray: {
    fontSize: 12,
    color: '#64748B',
  },
  statusDescription: {
    fontSize: 11,
    color: '#94A3B8',
    fontStyle: 'italic',
  },
  separator: {
    color: '#475569',
    marginHorizontal: 6,
    fontSize: 10,
  },
  actions: {
    flexDirection: 'row',
    gap: 8,
    marginLeft: 8,
  },
  actionButton: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: 'rgba(99, 102, 241, 0.15)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  removeButton: {
    backgroundColor: 'rgba(239, 68, 68, 0.15)',
  },
});
