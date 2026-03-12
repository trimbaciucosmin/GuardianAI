import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useAuthStore } from '../../lib/store';

export default function CircleChoiceScreen() {
  const router = useRouter();
  const { profile } = useAuthStore();
  const userName = profile?.name?.split(' ')[0] || 'there';

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.iconWrapper}>
            <Ionicons name="people" size={64} color="#6366F1" />
          </View>
          <Text style={styles.title}>Bine ai venit, {userName}!</Text>
          <Text style={styles.subtitle}>
            Cum vrei să continui?
          </Text>
        </View>

        {/* Options */}
        <View style={styles.options}>
          {/* Join Circle - PRIMARY for invited users */}
          <TouchableOpacity
            style={styles.primaryOption}
            onPress={() => router.push('/circle/join')}
          >
            <LinearGradient
              colors={['#6366F1', '#8B5CF6']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.primaryGradient}
            >
              <View style={styles.optionIcon}>
                <Ionicons name="enter" size={32} color="#FFFFFF" />
              </View>
              <View style={styles.optionText}>
                <Text style={styles.primaryTitle}>Am un cod de invitație</Text>
                <Text style={styles.primarySubtitle}>Alătură-te cercului familiei tale</Text>
              </View>
              <Ionicons name="chevron-forward" size={24} color="#FFFFFF" />
            </LinearGradient>
          </TouchableOpacity>

          {/* Create Circle - Secondary */}
          <TouchableOpacity
            style={styles.secondaryOption}
            onPress={() => router.push('/circle/create')}
          >
            <View style={styles.secondaryContent}>
              <View style={[styles.optionIcon, styles.secondaryIcon]}>
                <Ionicons name="add-circle" size={32} color="#6366F1" />
              </View>
              <View style={styles.optionText}>
                <Text style={styles.secondaryTitle}>Creează un cerc nou</Text>
                <Text style={styles.secondarySubtitle}>Începe propriul tău cerc de familie</Text>
              </View>
              <Ionicons name="chevron-forward" size={24} color="#64748B" />
            </View>
          </TouchableOpacity>
        </View>

        {/* Info */}
        <View style={styles.infoBox}>
          <Ionicons name="information-circle" size={20} color="#6366F1" />
          <Text style={styles.infoText}>
            Dacă ai primit un cod de invitație de la cineva, alege prima opțiune pentru a te alătura cercului lor.
          </Text>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0F172A',
  },
  content: {
    flex: 1,
    padding: 24,
    justifyContent: 'center',
  },
  header: {
    alignItems: 'center',
    marginBottom: 40,
  },
  iconWrapper: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: 'rgba(99, 102, 241, 0.15)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: 8,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 16,
    color: '#94A3B8',
    textAlign: 'center',
  },
  options: {
    gap: 16,
    marginBottom: 32,
  },
  primaryOption: {
    borderRadius: 16,
    overflow: 'hidden',
  },
  primaryGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 20,
    gap: 16,
  },
  optionIcon: {
    width: 56,
    height: 56,
    borderRadius: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  optionText: {
    flex: 1,
  },
  primaryTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: 4,
  },
  primarySubtitle: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.8)',
  },
  secondaryOption: {
    backgroundColor: '#1E293B',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#334155',
  },
  secondaryContent: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 20,
    gap: 16,
  },
  secondaryIcon: {
    backgroundColor: 'rgba(99, 102, 241, 0.15)',
  },
  secondaryTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#FFFFFF',
    marginBottom: 4,
  },
  secondarySubtitle: {
    fontSize: 14,
    color: '#64748B',
  },
  infoBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: 'rgba(99, 102, 241, 0.1)',
    borderRadius: 12,
    padding: 16,
    gap: 12,
  },
  infoText: {
    flex: 1,
    fontSize: 14,
    color: '#94A3B8',
    lineHeight: 20,
  },
});
