/**
 * PrivacyNotice Component
 * Displays the adult privacy message explaining that adults cannot see each other's location
 */

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useLanguage } from '../lib/i18n';
import { getAdultPrivacyMessage } from '../lib/familyRoles';

interface PrivacyNoticeProps {
  compact?: boolean;
  showContextualNote?: boolean;
}

export function PrivacyNotice({ compact = false, showContextualNote = true }: PrivacyNoticeProps) {
  const { language } = useLanguage();
  const lang = language as 'en' | 'ro';
  const privacy = getAdultPrivacyMessage(lang);

  if (compact) {
    return (
      <View style={styles.compactContainer}>
        <Ionicons name="shield-checkmark" size={16} color="#6366F1" />
        <Text style={styles.compactText}>{privacy.message}</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.iconContainer}>
        <Ionicons name="shield-checkmark" size={28} color="#6366F1" />
      </View>
      <View style={styles.content}>
        <Text style={styles.title}>{privacy.title}</Text>
        <Text style={styles.message}>{privacy.message}</Text>
        {showContextualNote && (
          <View style={styles.contextualContainer}>
            <Ionicons name="information-circle" size={14} color="#64748B" />
            <Text style={styles.contextualNote}>{privacy.contextualNote}</Text>
          </View>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    backgroundColor: 'rgba(99, 102, 241, 0.1)',
    borderRadius: 14,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: 'rgba(99, 102, 241, 0.2)',
  },
  iconContainer: {
    width: 48,
    height: 48,
    borderRadius: 12,
    backgroundColor: 'rgba(99, 102, 241, 0.15)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 14,
  },
  content: {
    flex: 1,
  },
  title: {
    fontSize: 14,
    fontWeight: '700',
    color: '#6366F1',
    marginBottom: 4,
  },
  message: {
    fontSize: 13,
    color: '#94A3B8',
    lineHeight: 18,
  },
  contextualContainer: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: 'rgba(99, 102, 241, 0.15)',
    gap: 6,
  },
  contextualNote: {
    flex: 1,
    fontSize: 12,
    color: '#64748B',
    lineHeight: 16,
  },
  compactContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(99, 102, 241, 0.1)',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    gap: 8,
  },
  compactText: {
    flex: 1,
    fontSize: 12,
    color: '#94A3B8',
  },
});
