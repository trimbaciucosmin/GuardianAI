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

interface FeatureItem {
  icon: string;
  iconColor: string;
  title: string;
  titleRo: string;
  description: string;
  descriptionRo: string;
  tag?: string;
}

const features: FeatureItem[] = [
  {
    icon: 'location',
    iconColor: '#10B981',
    title: 'Real-Time Location',
    titleRo: 'Locație în Timp Real',
    description: 'See where your family members are on the map at any moment',
    descriptionRo: 'Vezi unde sunt membrii familiei pe hartă în orice moment',
  },
  {
    icon: 'warning',
    iconColor: '#EF4444',
    title: 'SOS Emergency Button',
    titleRo: 'Buton SOS de Urgență',
    description: 'One-tap emergency alert that notifies all family members instantly',
    descriptionRo: 'Alertă de urgență cu o singură apăsare care notifică toată familia instant',
    tag: 'CRITICAL',
  },
  {
    icon: 'shield-checkmark',
    iconColor: '#6366F1',
    title: 'Safe Places & Geofences',
    titleRo: 'Locuri Sigure & Geofence',
    description: 'Set Home, School, Work as safe zones. Get notified when family arrives or leaves',
    descriptionRo: 'Setează Acasă, Școală, Muncă ca zone sigure. Primești notificare la sosire/plecare',
  },
  {
    icon: 'git-branch',
    iconColor: '#8B5CF6',
    title: 'Safe Routes Learning',
    titleRo: 'Învățare Trasee Sigure',
    description: 'App learns daily routes (Home↔School). Alerts you if child deviates from usual path',
    descriptionRo: 'Aplicația învață traseele zilnice (Acasă↔Școală). Te alertează dacă copilul deviază',
    tag: 'SMART',
  },
  {
    icon: 'alert-circle',
    iconColor: '#F59E0B',
    title: 'Tamper Detection',
    titleRo: 'Detectare Manipulare',
    description: 'Detects if GPS is disabled, permissions revoked, app closed, or fake location used',
    descriptionRo: 'Detectează dacă GPS-ul e oprit, permisiuni revocate, app închis sau locație falsă',
    tag: 'SECURITY',
  },
  {
    icon: 'battery-half',
    iconColor: '#F97316',
    title: 'Battery & Offline Alerts',
    titleRo: 'Alerte Baterie & Offline',
    description: 'Get notified when child\'s battery is low (<15%) or device goes offline',
    descriptionRo: 'Primești notificare când bateria copilului e scăzută (<15%) sau dispozitivul e offline',
  },
  {
    icon: 'analytics',
    iconColor: '#14B8A6',
    title: 'Weekly Safety Report',
    titleRo: 'Raport Săptămânal',
    description: 'Safety score, visited places stats, deviations, daily activity chart',
    descriptionRo: 'Scor siguranță, statistici locuri vizitate, devieri, grafic activitate zilnică',
    tag: 'NEW',
  },
  {
    icon: 'navigate',
    iconColor: '#34D399',
    title: 'Safe Trip Mode',
    titleRo: 'Mod Călătorie Sigură',
    description: 'Track trips in real-time with ETA. Family sees the entire journey',
    descriptionRo: 'Urmărește călătoriile în timp real cu ETA. Familia vede tot drumul',
  },
  {
    icon: 'people',
    iconColor: '#60A5FA',
    title: 'Parent & Child Modes',
    titleRo: 'Moduri Părinte & Copil',
    description: 'Simplified interface for children. Full control for parents',
    descriptionRo: 'Interfață simplificată pentru copii. Control complet pentru părinți',
  },
  {
    icon: 'notifications',
    iconColor: '#EC4899',
    title: 'Push Notifications',
    titleRo: 'Notificări Push',
    description: 'Instant alerts for SOS, arrivals, departures, deviations, and security events',
    descriptionRo: 'Alerte instant pentru SOS, sosiri, plecări, devieri și evenimente de securitate',
  },
  {
    icon: 'language',
    iconColor: '#A78BFA',
    title: 'Bilingual Support',
    titleRo: 'Suport Bilingv',
    description: 'Full English and Romanian language support',
    descriptionRo: 'Suport complet pentru limbile engleză și română',
  },
  {
    icon: 'cloud-offline',
    iconColor: '#64748B',
    title: 'Offline Mode',
    titleRo: 'Mod Offline',
    description: 'Locations are queued when offline and synced when connection returns',
    descriptionRo: 'Locațiile sunt salvate când ești offline și sincronizate la reconectare',
  },
];

export default function TipsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { language } = useLanguage();

  const getTagColor = (tag?: string) => {
    switch (tag) {
      case 'CRITICAL': return '#EF4444';
      case 'SECURITY': return '#F59E0B';
      case 'SMART': return '#8B5CF6';
      case 'NEW': return '#10B981';
      default: return '#6366F1';
    }
  };

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
          {language === 'ro' ? 'Funcționalități' : 'Features & Tips'}
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
          <Ionicons name="shield-checkmark" size={48} color="#6366F1" />
          <Text style={styles.heroTitle}>Guardian AI</Text>
          <Text style={styles.heroSubtitle}>
            {language === 'ro' 
              ? 'Siguranța familiei tale, simplificată'
              : 'Your family\'s safety, simplified'}
          </Text>
          <View style={styles.statsRow}>
            <View style={styles.statBadge}>
              <Text style={styles.statNumber}>12</Text>
              <Text style={styles.statLabel}>
                {language === 'ro' ? 'Funcții' : 'Features'}
              </Text>
            </View>
            <View style={styles.statBadge}>
              <Text style={styles.statNumber}>24/7</Text>
              <Text style={styles.statLabel}>
                {language === 'ro' ? 'Protecție' : 'Protection'}
              </Text>
            </View>
            <View style={styles.statBadge}>
              <Text style={styles.statNumber}>2</Text>
              <Text style={styles.statLabel}>
                {language === 'ro' ? 'Limbi' : 'Languages'}
              </Text>
            </View>
          </View>
        </LinearGradient>

        {/* Features List */}
        <Text style={styles.sectionTitle}>
          {language === 'ro' ? 'Toate funcționalitățile' : 'All Features'}
        </Text>

        {features.map((feature, index) => (
          <View key={index} style={styles.featureCard}>
            <View style={[styles.featureIcon, { backgroundColor: `${feature.iconColor}20` }]}>
              <Ionicons name={feature.icon as any} size={24} color={feature.iconColor} />
            </View>
            <View style={styles.featureContent}>
              <View style={styles.featureTitleRow}>
                <Text style={styles.featureTitle}>
                  {language === 'ro' ? feature.titleRo : feature.title}
                </Text>
                {feature.tag && (
                  <View style={[styles.featureTag, { backgroundColor: `${getTagColor(feature.tag)}20` }]}>
                    <Text style={[styles.featureTagText, { color: getTagColor(feature.tag) }]}>
                      {feature.tag}
                    </Text>
                  </View>
                )}
              </View>
              <Text style={styles.featureDescription}>
                {language === 'ro' ? feature.descriptionRo : feature.description}
              </Text>
            </View>
          </View>
        ))}

        {/* Pro Tips Section */}
        <Text style={styles.sectionTitle}>
          {language === 'ro' ? 'Sfaturi Pro' : 'Pro Tips'}
        </Text>

        <View style={styles.tipCard}>
          <Ionicons name="bulb" size={20} color="#F59E0B" />
          <Text style={styles.tipText}>
            {language === 'ro' 
              ? 'Setează "Locație Mereu" în permisiuni pentru cele mai bune rezultate'
              : 'Set "Location Always" in permissions for best results'}
          </Text>
        </View>

        <View style={styles.tipCard}>
          <Ionicons name="bulb" size={20} color="#F59E0B" />
          <Text style={styles.tipText}>
            {language === 'ro' 
              ? 'Dezactivează economisirea bateriei pentru Guardian AI în setările Android'
              : 'Disable battery optimization for Guardian AI in Android settings'}
          </Text>
        </View>

        <View style={styles.tipCard}>
          <Ionicons name="bulb" size={20} color="#F59E0B" />
          <Text style={styles.tipText}>
            {language === 'ro' 
              ? 'Adaugă locuri sigure pentru a primi notificări automate de sosire/plecare'
              : 'Add safe places to receive automatic arrival/departure notifications'}
          </Text>
        </View>

        <View style={styles.tipCard}>
          <Ionicons name="bulb" size={20} color="#F59E0B" />
          <Text style={styles.tipText}>
            {language === 'ro' 
              ? 'Verifică Raportul Săptămânal pentru statistici detaliate despre siguranță'
              : 'Check the Weekly Report for detailed safety statistics'}
          </Text>
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
    paddingHorizontal: 16,
  },
  heroSection: {
    borderRadius: 20,
    padding: 24,
    alignItems: 'center',
    marginBottom: 24,
    borderWidth: 1,
    borderColor: 'rgba(99, 102, 241, 0.3)',
  },
  heroTitle: {
    fontSize: 28,
    fontWeight: '800',
    color: '#FFFFFF',
    marginTop: 12,
  },
  heroSubtitle: {
    fontSize: 15,
    color: '#94A3B8',
    marginTop: 8,
    textAlign: 'center',
  },
  statsRow: {
    flexDirection: 'row',
    marginTop: 20,
    gap: 16,
  },
  statBadge: {
    alignItems: 'center',
    backgroundColor: 'rgba(30, 41, 59, 0.6)',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 12,
  },
  statNumber: {
    fontSize: 20,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  statLabel: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 2,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: 16,
    marginTop: 8,
  },
  featureCard: {
    flexDirection: 'row',
    backgroundColor: 'rgba(30, 41, 59, 0.6)',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
  },
  featureIcon: {
    width: 48,
    height: 48,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
  },
  featureContent: {
    flex: 1,
    marginLeft: 14,
  },
  featureTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 8,
  },
  featureTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  featureTag: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
  },
  featureTagText: {
    fontSize: 9,
    fontWeight: '700',
  },
  featureDescription: {
    fontSize: 13,
    color: '#94A3B8',
    marginTop: 6,
    lineHeight: 19,
  },
  tipCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: 'rgba(245, 158, 11, 0.1)',
    borderRadius: 12,
    padding: 14,
    marginBottom: 10,
    gap: 12,
    borderLeftWidth: 3,
    borderLeftColor: '#F59E0B',
  },
  tipText: {
    flex: 1,
    fontSize: 13,
    color: '#E2E8F0',
    lineHeight: 19,
  },
});
