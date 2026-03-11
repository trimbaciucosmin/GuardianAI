import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../../lib/supabase';
import { useAuthStore, useCircleStore } from '../../lib/store';
import { generateInviteCode } from '../../utils/helpers';

export default function CreateCircleScreen() {
  const router = useRouter();
  const { user, profile } = useAuthStore();
  const { addCircle, setCurrentCircle } = useCircleStore();
  const [name, setName] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleCreate = async () => {
    if (!name.trim()) {
      Alert.alert('Name Required', 'Please enter a name for your family circle');
      return;
    }

    if (!user) {
      Alert.alert('Error', 'You must be logged in');
      return;
    }

    setIsLoading(true);

    try {
      const inviteCode = generateInviteCode();
      
      // Create circle
      const { data: circleData, error: circleError } = await supabase
        .from('family_circles')
        .insert({
          name: name.trim(),
          invite_code: inviteCode,
          created_by: user.id,
          created_at: new Date().toISOString(),
        })
        .select()
        .single();

      if (circleError) throw circleError;

      // Add creator as member (parent role)
      const { error: memberError } = await supabase
        .from('circle_members')
        .insert({
          circle_id: circleData.id,
          user_id: user.id,
          role: profile?.role || 'parent',
          joined_at: new Date().toISOString(),
        });

      if (memberError) throw memberError;

      addCircle(circleData);
      setCurrentCircle(circleData);

      Alert.alert(
        'Circle Created!',
        `Share this code with your family:\n\n${inviteCode}`,
        [{ text: 'OK', onPress: () => router.replace('/(main)/family') }]
      );
    } catch (error: any) {
      console.error('Create circle error:', error);
      Alert.alert('Error', error.message || 'Failed to create circle');
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
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
            <Ionicons name="arrow-back" size={24} color="#FFFFFF" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Create Circle</Text>
          <View style={{ width: 44 }} />
        </View>

        {/* Content */}
        <View style={styles.content}>
          <View style={styles.iconWrapper}>
            <Ionicons name="shield" size={48} color="#6366F1" />
          </View>
          <Text style={styles.title}>Create Family Circle</Text>
          <Text style={styles.subtitle}>
            Start your family safety network. Invite members with a unique code.
          </Text>

          <View style={styles.inputContainer}>
            <Text style={styles.label}>Circle Name</Text>
            <View style={styles.inputWrapper}>
              <Ionicons name="people-outline" size={20} color="#64748B" style={styles.inputIcon} />
              <TextInput
                style={styles.input}
                placeholder="e.g., Smith Family"
                placeholderTextColor="#64748B"
                value={name}
                onChangeText={setName}
                autoCapitalize="words"
              />
            </View>
          </View>

          <TouchableOpacity
            style={[styles.createButton, isLoading && styles.buttonDisabled]}
            onPress={handleCreate}
            disabled={isLoading}
          >
            {isLoading ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <>
                <Text style={styles.createButtonText}>Create Circle</Text>
                <Ionicons name="arrow-forward" size={20} color="#FFFFFF" />
              </>
            )}
          </TouchableOpacity>
        </View>
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
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  backButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#1E293B',
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  content: {
    flex: 1,
    padding: 24,
    alignItems: 'center',
  },
  iconWrapper: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: 'rgba(99, 102, 241, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
    marginTop: 40,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: 8,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 14,
    color: '#94A3B8',
    textAlign: 'center',
    marginBottom: 40,
    paddingHorizontal: 20,
  },
  inputContainer: {
    width: '100%',
    marginBottom: 24,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#E2E8F0',
    marginBottom: 8,
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
  createButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#6366F1',
    borderRadius: 12,
    height: 52,
    width: '100%',
    gap: 8,
  },
  buttonDisabled: {
    opacity: 0.7,
  },
  createButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
});
