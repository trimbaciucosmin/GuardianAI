import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../../lib/supabase';
import { useAuthStore } from '../../lib/store';

type Role = 'parent' | 'child' | 'teen';

export default function OnboardingScreen() {
  const router = useRouter();
  const { user, setProfile } = useAuthStore();
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [role, setRole] = useState<Role>('parent');
  const [isLoading, setIsLoading] = useState(false);

  const roles: { key: Role; label: string; icon: string; description: string }[] = [
    { key: 'parent', label: 'Parent', icon: 'people', description: 'Manage your family circle' },
    { key: 'teen', label: 'Teen (13-17)', icon: 'person', description: 'Privacy-aware tracking' },
    { key: 'child', label: 'Child (6-12)', icon: 'happy', description: 'Simple safety features' },
  ];

  const handleComplete = async () => {
    if (!name.trim()) {
      Alert.alert('Name Required', 'Please enter your name');
      return;
    }

    if (!user) {
      Alert.alert('Error', 'User session not found');
      return;
    }

    setIsLoading(true);

    try {
      const profileData = {
        user_id: user.id,
        name: name.trim(),
        phone: phone.trim() || null,
        role,
        updated_at: new Date().toISOString(),
      };

      // Use upsert to handle both insert and update cases
      const { data, error } = await supabase
        .from('profiles')
        .upsert(profileData, { onConflict: 'user_id' })
        .select()
        .single();

      if (error) {
        throw error;
      }
      
      setProfile(data);
      router.replace('/(main)/map');
    } catch (error: any) {
      console.error('Onboarding error:', error);
      Alert.alert('Error', error.message || 'Failed to save profile');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardView}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.iconWrapper}>
              <Ionicons name="rocket" size={48} color="#6366F1" />
            </View>
            <Text style={styles.title}>Complete Your Profile</Text>
            <Text style={styles.subtitle}>Tell us about yourself</Text>
          </View>

          {/* Form */}
          <View style={styles.form}>
            <View style={styles.inputContainer}>
              <Text style={styles.label}>Your Name</Text>
              <View style={styles.inputWrapper}>
                <Ionicons name="person-outline" size={20} color="#64748B" style={styles.inputIcon} />
                <TextInput
                  style={styles.input}
                  placeholder="Enter your name"
                  placeholderTextColor="#64748B"
                  value={name}
                  onChangeText={setName}
                  autoCapitalize="words"
                />
              </View>
            </View>

            <View style={styles.inputContainer}>
              <Text style={styles.label}>Phone Number (Optional)</Text>
              <View style={styles.inputWrapper}>
                <Ionicons name="call-outline" size={20} color="#64748B" style={styles.inputIcon} />
                <TextInput
                  style={styles.input}
                  placeholder="+1 (555) 000-0000"
                  placeholderTextColor="#64748B"
                  value={phone}
                  onChangeText={setPhone}
                  keyboardType="phone-pad"
                />
              </View>
            </View>

            <View style={styles.inputContainer}>
              <Text style={styles.label}>I am a...</Text>
              <View style={styles.roleContainer}>
                {roles.map((r) => (
                  <TouchableOpacity
                    key={r.key}
                    style={[
                      styles.roleCard,
                      role === r.key && styles.roleCardSelected,
                    ]}
                    onPress={() => setRole(r.key)}
                  >
                    <View style={[
                      styles.roleIconWrapper,
                      role === r.key && styles.roleIconWrapperSelected,
                    ]}>
                      <Ionicons
                        name={r.icon as any}
                        size={24}
                        color={role === r.key ? '#6366F1' : '#64748B'}
                      />
                    </View>
                    <View style={styles.roleTextContainer}>
                      <Text style={[
                        styles.roleLabel,
                        role === r.key && styles.roleLabelSelected,
                      ]}>
                        {r.label}
                      </Text>
                      <Text style={styles.roleDescription}>{r.description}</Text>
                    </View>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            <TouchableOpacity
              style={[styles.completeButton, isLoading && styles.buttonDisabled]}
              onPress={handleComplete}
              disabled={isLoading}
            >
              {isLoading ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <>
                  <Text style={styles.completeButtonText}>Get Started</Text>
                  <Ionicons name="arrow-forward" size={20} color="#FFFFFF" />
                </>
              )}
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0F172A',
  },
  keyboardView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    padding: 24,
  },
  header: {
    alignItems: 'center',
    marginBottom: 32,
    marginTop: 20,
  },
  iconWrapper: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: 'rgba(99, 102, 241, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: '#94A3B8',
  },
  form: {
    flex: 1,
  },
  inputContainer: {
    marginBottom: 24,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#E2E8F0',
    marginBottom: 12,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1E293B',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#334155',
    paddingHorizontal: 16,
  },
  inputIcon: {
    marginRight: 12,
  },
  input: {
    flex: 1,
    height: 52,
    fontSize: 16,
    color: '#FFFFFF',
  },
  roleContainer: {
    gap: 12,
  },
  roleCard: {
    backgroundColor: '#1E293B',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#334155',
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
  },
  roleCardSelected: {
    borderColor: '#6366F1',
    backgroundColor: 'rgba(99, 102, 241, 0.1)',
  },
  roleIconWrapper: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#0F172A',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  roleIconWrapperSelected: {
    backgroundColor: 'rgba(99, 102, 241, 0.2)',
  },
  roleTextContainer: {
    flex: 1,
  },
  roleLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#E2E8F0',
  },
  roleLabelSelected: {
    color: '#FFFFFF',
  },
  roleDescription: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 2,
  },
  completeButton: {
    backgroundColor: '#6366F1',
    borderRadius: 12,
    height: 52,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
    marginTop: 20,
  },
  buttonDisabled: {
    opacity: 0.7,
  },
  completeButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
});
