/**
 * Language Selection Screen
 * Shown after permissions, before main app
 */

import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useLanguage } from '../lib/i18n';
import type { Language } from '../lib/i18n';

export default function LanguageSelectScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { setLanguage } = useLanguage();
  const [selected, setSelected] = useState<Language | null>(null);

  const handleContinue = async () => {
    if (selected) {
      await setLanguage(selected);
      router.replace('/');
    }
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top + 40 }]}>
      {/* Title */}
      <View style={styles.header}>
        <View style={styles.iconWrapper}>
          <Ionicons name="globe-outline" size={48} color="#6366F1" />
        </View>
        <Text style={styles.title}>Choose Language</Text>
        <Text style={styles.titleRo}>Alege Limba</Text>
      </View>

      {/* Language Options */}
      <View style={styles.optionsContainer}>
        {/* English - UK */}
        <TouchableOpacity
          style={[
            styles.languageOption,
            selected === 'en' && styles.languageOptionSelected,
          ]}
          onPress={() => setSelected('en')}
          activeOpacity={0.8}
        >
          <View style={styles.flagContainer}>
            <Text style={styles.flagEmoji}>🇬🇧</Text>
          </View>
          <View style={styles.languageInfo}>
            <Text style={styles.languageName}>English</Text>
            <Text style={styles.languageNative}>English</Text>
          </View>
          {selected === 'en' && (
            <View style={styles.checkmark}>
              <Ionicons name="checkmark-circle" size={28} color="#6366F1" />
            </View>
          )}
        </TouchableOpacity>

        {/* Romanian */}
        <TouchableOpacity
          style={[
            styles.languageOption,
            selected === 'ro' && styles.languageOptionSelected,
          ]}
          onPress={() => setSelected('ro')}
          activeOpacity={0.8}
        >
          <View style={styles.flagContainer}>
            <Text style={styles.flagEmoji}>🇷🇴</Text>
          </View>
          <View style={styles.languageInfo}>
            <Text style={styles.languageName}>Romanian</Text>
            <Text style={styles.languageNative}>Română</Text>
          </View>
          {selected === 'ro' && (
            <View style={styles.checkmark}>
              <Ionicons name="checkmark-circle" size={28} color="#6366F1" />
            </View>
          )}
        </TouchableOpacity>
      </View>

      {/* Continue Button */}
      <View style={[styles.footer, { paddingBottom: insets.bottom + 20 }]}>
        <TouchableOpacity
          style={[styles.continueButton, !selected && styles.continueButtonDisabled]}
          onPress={handleContinue}
          disabled={!selected}
          activeOpacity={0.8}
        >
          <LinearGradient
            colors={selected ? ['#6366F1', '#4F46E5'] : ['#334155', '#1E293B']}
            style={styles.continueGradient}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
          >
            <Text style={[styles.continueText, !selected && styles.continueTextDisabled]}>
              Continue / Continuă
            </Text>
            <Ionicons 
              name="arrow-forward" 
              size={22} 
              color={selected ? '#FFFFFF' : '#64748B'} 
            />
          </LinearGradient>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0F172A',
  },
  header: {
    alignItems: 'center',
    paddingHorizontal: 24,
    marginBottom: 48,
  },
  iconWrapper: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: 'rgba(99, 102, 241, 0.15)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
  },
  title: {
    fontSize: 32,
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: 8,
  },
  titleRo: {
    fontSize: 24,
    fontWeight: '500',
    color: '#94A3B8',
  },
  optionsContainer: {
    paddingHorizontal: 24,
    gap: 16,
  },
  languageOption: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1E293B',
    borderRadius: 20,
    padding: 20,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  languageOptionSelected: {
    borderColor: '#6366F1',
    backgroundColor: 'rgba(99, 102, 241, 0.1)',
  },
  flagContainer: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  flagEmoji: {
    fontSize: 40,
  },
  languageInfo: {
    flex: 1,
    marginLeft: 16,
  },
  languageName: {
    fontSize: 20,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  languageNative: {
    fontSize: 16,
    color: '#94A3B8',
    marginTop: 4,
  },
  checkmark: {
    marginLeft: 12,
  },
  footer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 24,
  },
  continueButton: {
    borderRadius: 16,
    overflow: 'hidden',
  },
  continueButtonDisabled: {
    opacity: 0.7,
  },
  continueGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 18,
    gap: 10,
  },
  continueText: {
    fontSize: 18,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  continueTextDisabled: {
    color: '#64748B',
  },
});
