import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { useLanguage } from '../../lib/i18n';

export default function AboutScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { language } = useLanguage();

  const features = [
    {
      icon: 'location',
      text: language === 'ro' 
        ? 'Localizare în timp real a membrilor familiei'
        : 'Real-time location of family members',
    },
    {
      icon: 'git-branch',
      text: language === 'ro'
        ? 'Monitorizare trasee (Safe Routes)'
        : 'Route monitoring (Safe Routes)',
    },
    {
      icon: 'notifications',
      text: language === 'ro'
        ? 'Alerte automate (SOS, baterie scăzută, offline, deviații de traseu)'
        : 'Automatic alerts (SOS, low battery, offline, route deviations)',
    },
    {
      icon: 'alert-circle',
      text: language === 'ro'
        ? 'Detectarea situațiilor neobișnuite'
        : 'Detection of unusual situations',
    },
    {
      icon: 'analytics',
      text: language === 'ro'
        ? 'Rapoarte de siguranță'
        : 'Safety reports',
    },
  ];

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
        <TouchableOpacity 
          style={styles.backButton}
          onPress={() => router.back()}
        >
          <Ionicons name="arrow-back" size={24} color="#FFFFFF" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>
          {language === 'ro' ? 'Despre Guardian AI' : 'About Guardian AI'}
        </Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView 
        style={styles.content}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 40 }}
      >
        {/* Hero Section */}
        <LinearGradient
          colors={['rgba(99, 102, 241, 0.2)', 'rgba(99, 102, 241, 0.05)']}
          style={styles.heroSection}
        >
          <View style={styles.logoContainer}>
            <Ionicons name="shield-checkmark" size={56} color="#6366F1" />
          </View>
          <Text style={styles.appName}>Guardian AI</Text>
          <View style={styles.versionBadge}>
            <Text style={styles.versionText}>Versiune 1.0 (Beta)</Text>
          </View>
        </LinearGradient>

        {/* Main Description */}
        <View style={styles.section}>
          <Text style={styles.description}>
            {language === 'ro'
              ? 'Guardian AI este o aplicație de siguranță pentru familie, creată pentru a ajuta părinții să își protejeze copiii în viața de zi cu zi.'
              : 'Guardian AI is a family safety app designed to help parents protect their children in everyday life.'}
          </Text>
        </View>

        {/* Features */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>
            {language === 'ro' ? 'Aplicația oferă:' : 'The app offers:'}
          </Text>
          
          {features.map((feature, index) => (
            <View key={index} style={styles.featureItem}>
              <View style={styles.featureIcon}>
                <Ionicons name={feature.icon as any} size={18} color="#6366F1" />
              </View>
              <Text style={styles.featureText}>{feature.text}</Text>
            </View>
          ))}
        </View>

        {/* Purpose */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>
            {language === 'ro' ? 'Scopul nostru' : 'Our Purpose'}
          </Text>
          <Text style={styles.purposeText}>
            {language === 'ro'
              ? 'Scopul Guardian AI este de a oferi liniște părinților și suport copiilor în situații reale.'
              : 'The purpose of Guardian AI is to provide peace of mind to parents and support to children in real situations.'}
          </Text>
        </View>

        {/* Privacy Note */}
        <View style={styles.privacySection}>
          <Ionicons name="heart" size={24} color="#10B981" />
          <Text style={styles.privacyText}>
            {language === 'ro'
              ? 'Guardian AI NU este un sistem de supraveghere invazivă, ci un instrument de siguranță bazat pe transparență și încredere.'
              : 'Guardian AI is NOT an invasive surveillance system, but a safety tool based on transparency and trust.'}
          </Text>
        </View>

        {/* Footer */}
        <View style={styles.footer}>
          <Text style={styles.footerText}>
            {language === 'ro' ? 'Construit cu' : 'Built with'} ❤️ {language === 'ro' ? 'pentru familii' : 'for families'}
          </Text>
          <Text style={styles.copyrightText}>© 2025 Guardian AI</Text>
        </View>

      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0F172A',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 16,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: 'rgba(30, 41, 59, 0.8)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  content: {
    flex: 1,
    paddingHorizontal: 20,
  },
  heroSection: {
    borderRadius: 20,
    padding: 32,
    alignItems: 'center',
    marginBottom: 24,
    borderWidth: 1,
    borderColor: 'rgba(99, 102, 241, 0.3)',
  },
  logoContainer: {
    width: 100,
    height: 100,
    borderRadius: 28,
    backgroundColor: 'rgba(99, 102, 241, 0.15)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  appName: {
    fontSize: 32,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: -0.5,
  },
  versionBadge: {
    marginTop: 12,
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 20,
  },
  versionText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#10B981',
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: 14,
  },
  description: {
    fontSize: 16,
    color: '#E2E8F0',
    lineHeight: 26,
  },
  featureItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 12,
    gap: 12,
  },
  featureIcon: {
    width: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor: 'rgba(99, 102, 241, 0.15)',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 2,
  },
  featureText: {
    flex: 1,
    fontSize: 15,
    color: '#CBD5E1',
    lineHeight: 22,
  },
  purposeText: {
    fontSize: 15,
    color: '#CBD5E1',
    lineHeight: 24,
    fontStyle: 'italic',
  },
  privacySection: {
    backgroundColor: 'rgba(16, 185, 129, 0.1)',
    borderRadius: 16,
    padding: 20,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 14,
    marginBottom: 32,
    borderLeftWidth: 4,
    borderLeftColor: '#10B981',
  },
  privacyText: {
    flex: 1,
    fontSize: 14,
    color: '#E2E8F0',
    lineHeight: 22,
  },
  footer: {
    alignItems: 'center',
    paddingVertical: 20,
    borderTopWidth: 1,
    borderTopColor: 'rgba(100, 116, 139, 0.2)',
  },
  footerText: {
    fontSize: 14,
    color: '#94A3B8',
  },
  copyrightText: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 8,
  },
});
