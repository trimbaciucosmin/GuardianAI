import React, { useState } from 'react';
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
import { useLanguage } from '../../lib/i18n';

interface FAQItem {
  question: string;
  questionRo: string;
  answer: string;
  answerRo: string;
  icon: string;
}

const faqItems: FAQItem[] = [
  {
    question: 'How does the app work?',
    questionRo: 'Cum funcționează aplicația?',
    answer: 'Guardian AI uses GPS and internet connection to display family members\' location and send safety alerts.',
    answerRo: 'Guardian AI folosește GPS și conexiunea la internet pentru a afișa locația membrilor familiei și pentru a trimite alerte de siguranță.',
    icon: 'help-circle',
  },
  {
    question: 'Why do I need to enable "Allow all the time" location?',
    questionRo: 'De ce trebuie să activez locația "Allow all the time"?',
    answer: 'For the app to work correctly in background and send real-time alerts.',
    answerRo: 'Pentru ca aplicația să funcționeze corect în background și să trimită alerte în timp real.',
    icon: 'location',
  },
  {
    question: 'Why do I need to disable battery optimization?',
    questionRo: 'De ce trebuie să dezactivez battery optimization?',
    answer: 'Some phones stop background apps, which can affect Guardian AI\'s functionality.',
    answerRo: 'Unele telefoane opresc aplicațiile în fundal, ceea ce poate afecta funcționarea Guardian AI.',
    icon: 'battery-charging',
  },
  {
    question: 'What does "offline" mean?',
    questionRo: 'Ce înseamnă "offline"?',
    answer: 'The child\'s device is no longer transmitting location. This can be due to lack of internet, battery, or disabled permissions.',
    answerRo: 'Dispozitivul copilului nu mai transmite locație. Poate fi din cauza lipsei de internet, bateriei sau dezactivării permisiunilor.',
    icon: 'cloud-offline',
  },
  {
    question: 'What is Safe Route?',
    questionRo: 'Ce este Safe Route?',
    answer: 'The app learns usual routes (e.g., Home → School) and detects deviations or unusual stops.',
    answerRo: 'Aplicația învață traseele obișnuite (ex: Acasă → Școală) și detectează deviații sau opriri neobișnuite.',
    icon: 'git-branch',
  },
];

const alertTypes = [
  {
    text: 'when child arrives or leaves a safe place',
    textRo: 'când copilul ajunge sau pleacă dintr-un loc sigur',
    icon: 'location',
    color: '#10B981',
  },
  {
    text: 'when battery is low',
    textRo: 'când bateria este scăzută',
    icon: 'battery-dead',
    color: '#F59E0B',
  },
  {
    text: 'when device is offline',
    textRo: 'când dispozitivul este offline',
    icon: 'cloud-offline',
    color: '#64748B',
  },
  {
    text: 'when there are route deviations',
    textRo: 'când există deviații de traseu',
    icon: 'alert-circle',
    color: '#F97316',
  },
  {
    text: 'when SOS button is pressed',
    textRo: 'când este apăsat butonul SOS',
    icon: 'warning',
    color: '#EF4444',
  },
];

export default function HelpScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { language } = useLanguage();
  const [expandedIndex, setExpandedIndex] = useState<number | null>(null);

  const toggleExpand = (index: number) => {
    setExpandedIndex(expandedIndex === index ? null : index);
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
          {language === 'ro' ? 'Ajutor & FAQ' : 'Help & FAQ'}
        </Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView 
        style={styles.content}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 40 }}
      >
        {/* FAQ Section */}
        <Text style={styles.sectionTitle}>
          {language === 'ro' ? 'Întrebări frecvente' : 'Frequently Asked Questions'}
        </Text>

        {faqItems.map((item, index) => (
          <TouchableOpacity 
            key={index} 
            style={styles.faqItem}
            onPress={() => toggleExpand(index)}
            activeOpacity={0.7}
          >
            <View style={styles.faqHeader}>
              <View style={styles.faqIconContainer}>
                <Ionicons name={item.icon as any} size={20} color="#6366F1" />
              </View>
              <Text style={styles.faqQuestion}>
                {language === 'ro' ? item.questionRo : item.question}
              </Text>
              <Ionicons 
                name={expandedIndex === index ? "chevron-up" : "chevron-down"} 
                size={20} 
                color="#64748B" 
              />
            </View>
            {expandedIndex === index && (
              <View style={styles.faqAnswer}>
                <Text style={styles.faqAnswerText}>
                  {language === 'ro' ? item.answerRo : item.answer}
                </Text>
              </View>
            )}
          </TouchableOpacity>
        ))}

        {/* When do I receive alerts? */}
        <Text style={[styles.sectionTitle, { marginTop: 32 }]}>
          {language === 'ro' ? 'Când primesc alerte?' : 'When do I receive alerts?'}
        </Text>

        <View style={styles.alertsContainer}>
          {alertTypes.map((alert, index) => (
            <View key={index} style={styles.alertItem}>
              <View style={[styles.alertIcon, { backgroundColor: `${alert.color}20` }]}>
                <Ionicons name={alert.icon as any} size={18} color={alert.color} />
              </View>
              <Text style={styles.alertText}>
                {language === 'ro' ? alert.textRo : alert.text}
              </Text>
            </View>
          ))}
        </View>

        {/* Need more help? */}
        <View style={styles.moreHelpSection}>
          <Ionicons name="chatbubbles" size={32} color="#6366F1" />
          <Text style={styles.moreHelpTitle}>
            {language === 'ro' ? 'Ai nevoie de mai mult ajutor?' : 'Need more help?'}
          </Text>
          <Text style={styles.moreHelpText}>
            {language === 'ro' 
              ? 'Contactează-ne la support@guardianai.app'
              : 'Contact us at support@guardianai.app'}
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
    paddingHorizontal: 20,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: 16,
  },
  faqItem: {
    backgroundColor: 'rgba(30, 41, 59, 0.6)',
    borderRadius: 14,
    marginBottom: 10,
    overflow: 'hidden',
  },
  faqHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    gap: 12,
  },
  faqIconContainer: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: 'rgba(99, 102, 241, 0.15)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  faqQuestion: {
    flex: 1,
    fontSize: 14,
    fontWeight: '600',
    color: '#F1F5F9',
    lineHeight: 20,
  },
  faqAnswer: {
    paddingHorizontal: 16,
    paddingBottom: 16,
    paddingTop: 4,
    marginLeft: 48,
  },
  faqAnswerText: {
    fontSize: 14,
    color: '#94A3B8',
    lineHeight: 22,
  },
  alertsContainer: {
    backgroundColor: 'rgba(30, 41, 59, 0.6)',
    borderRadius: 14,
    padding: 16,
  },
  alertItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 14,
  },
  alertIcon: {
    width: 32,
    height: 32,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  alertText: {
    flex: 1,
    fontSize: 14,
    color: '#E2E8F0',
    lineHeight: 20,
  },
  moreHelpSection: {
    marginTop: 32,
    alignItems: 'center',
    backgroundColor: 'rgba(99, 102, 241, 0.1)',
    borderRadius: 16,
    padding: 24,
    borderWidth: 1,
    borderColor: 'rgba(99, 102, 241, 0.2)',
  },
  moreHelpTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
    marginTop: 12,
  },
  moreHelpText: {
    fontSize: 14,
    color: '#94A3B8',
    marginTop: 8,
  },
});
