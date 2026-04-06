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
  Share,
  ScrollView,
} from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { supabase } from '../../lib/supabase';
import { useAuthStore, useCircleStore } from '../../lib/store';
import { generateInviteCode } from '../../utils/helpers';

export default function CreateCircleScreen() {
  const router = useRouter();
  const { user, profile, setUser, setProfile } = useAuthStore();
  const { addCircle, setCurrentCircle } = useCircleStore();
  const [name, setName] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [createdCircle, setCreatedCircle] = useState<{ id: string; invite_code: string } | null>(null);

  const handleSignOut = async () => {
    if (typeof window !== 'undefined') {
      const confirmed = window.confirm('Ești sigur că vrei să te deconectezi?');
      if (confirmed) {
        await supabase.auth.signOut();
        setUser(null);
        setProfile(null);
        router.replace('/(auth)/login');
      }
    }
  };

  const handleCreate = async () => {
    if (!name.trim()) {
      if (typeof window !== 'undefined') {
        window.alert('Te rugăm să introduci un nume pentru cercul familiei');
      }
      return;
    }

    if (!user) {
      if (typeof window !== 'undefined') {
        window.alert('Trebuie să fii autentificat');
      }
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
      setCreatedCircle({ id: circleData.id, invite_code: inviteCode });

    } catch (error: any) {
      console.error('Create circle error:', error);
      if (typeof window !== 'undefined') {
        window.alert('Eroare: ' + (error.message || 'Nu s-a putut crea cercul'));
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleShare = async () => {
    if (!createdCircle) return;
    
    const appUrl = 'https://guardian-mobile-app.preview.emergentagent.com';
    const inviteMessage = `Join my Family Circle on Guardian AI!

Open this link in your browser:
${appUrl}

Then:
1. Tap "Create Account" 
2. Sign up with your email
3. After signing in, go to Family tab
4. Tap "Join Circle"
5. Enter code: ${createdCircle.invite_code}

This app lets us share locations and stay safe!`;

    try {
      await Share.share({
        message: inviteMessage,
      });
    } catch (error) {
      console.error('Share error:', error);
      await handleCopyCode();
    }
  };

  const handleCopyCode = async () => {
    if (!createdCircle) return;
    
    const appUrl = 'https://guardian-mobile-app.preview.emergentagent.com';
    const fullMessage = `Join Guardian AI!\n\nApp: ${appUrl}\nCode: ${createdCircle.invite_code}`;
    
    try {
      await Clipboard.setStringAsync(fullMessage);
      if (typeof window !== 'undefined') {
        window.alert(`Copiat!\n\nCod: ${createdCircle.invite_code}\n\nLink-ul și codul au fost copiate în clipboard.`);
      }
    } catch (error) {
      if (typeof window !== 'undefined') {
        window.alert(`Cod de invitație: ${createdCircle.invite_code}\n\nApp: ${appUrl}`);
      }
    }
  };

  const handleDone = () => {
    // Go directly to Family screen (main dashboard) - NOT map
    router.replace('/(main)/family');
  };

  // Remove handleSkip - no longer needed after creating circle

  // Show invite screen after circle is created
  if (createdCircle) {
    return (
      <SafeAreaView style={styles.container}>
        <ScrollView 
          style={styles.successScrollView}
          contentContainerStyle={styles.successScrollContent}
          showsVerticalScrollIndicator={false}
        >
          {/* Success Icon */}
          <View style={styles.successIcon}>
            <Ionicons name="checkmark-circle" size={64} color="#10B981" />
          </View>
          
          <Text style={styles.successTitle}>Circle Created!</Text>
          <Text style={styles.successSubtitle}>
            Codul de invitație este mai jos
          </Text>

          {/* Invite Code Card */}
          <View style={styles.inviteCard}>
            <Text style={styles.inviteLabel}>Cod de Invitație</Text>
            <TouchableOpacity style={styles.codeBox} onPress={handleCopyCode}>
              <Text style={styles.codeText}>{createdCircle.invite_code}</Text>
              <Ionicons name="copy" size={20} color="#6366F1" />
            </TouchableOpacity>
            <Text style={styles.inviteHint}>Apasă pentru a copia</Text>
          </View>

          {/* PRIMARY ACTION - Continue to App */}
          <TouchableOpacity style={styles.continueButton} onPress={handleDone}>
            <LinearGradient
              colors={['#10B981', '#059669']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.primaryGradient}
            >
              <Ionicons name="home" size={22} color="#FFFFFF" />
              <Text style={styles.primaryButtonText}>Continuă în Aplicație</Text>
            </LinearGradient>
          </TouchableOpacity>

          {/* Secondary - Invite now */}
          <TouchableOpacity style={styles.primaryButton} onPress={handleShare}>
            <LinearGradient
              colors={['#6366F1', '#8B5CF6']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.primaryGradient}
            >
              <Ionicons name="person-add" size={22} color="#FFFFFF" />
              <Text style={styles.primaryButtonText}>Invită Acum</Text>
            </LinearGradient>
          </TouchableOpacity>

          {/* Info */}
          <View style={styles.warningBox}>
            <Ionicons name="information-circle" size={18} color="#6366F1" />
            <Text style={styles.infoText}>
              Poți invita membrii familiei oricând din ecranul Family.
            </Text>
          </View>
        </ScrollView>
      </SafeAreaView>
    );
  }

  // Initial create form
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
            <Ionicons name="people" size={56} color="#6366F1" />
          </View>
          <Text style={styles.title}>Create Your Family Circle</Text>
          <Text style={styles.subtitle}>
            Start your family safety network. You'll be able to see each other's locations and get alerts when family members arrive safely.
          </Text>

          <View style={styles.inputContainer}>
            <Text style={styles.label}>Circle Name</Text>
            <View style={styles.inputWrapper}>
              <Ionicons name="shield" size={20} color="#64748B" style={styles.inputIcon} />
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

          {/* Or join existing */}
          <View style={styles.orDivider}>
            <View style={styles.dividerLine} />
            <Text style={styles.orText}>or</Text>
            <View style={styles.dividerLine} />
          </View>

          <TouchableOpacity
            style={styles.joinButton}
            onPress={() => router.push('/circle/join')}
          >
            <Ionicons name="enter" size={20} color="#6366F1" />
            <Text style={styles.joinButtonText}>Join Existing Circle</Text>
          </TouchableOpacity>

          {/* Sign Out Button - Only shown for parents */}
          {profile?.role === 'parent' && (
            <TouchableOpacity style={styles.signOutButton} onPress={handleSignOut}>
              <Ionicons name="log-out" size={18} color="#EF4444" />
              <Text style={styles.signOutText}>Sign Out</Text>
            </TouchableOpacity>
          )}
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
  skipText: {
    fontSize: 16,
    color: '#64748B',
  },
  content: {
    flex: 1,
    padding: 24,
    alignItems: 'center',
  },
  iconWrapper: {
    width: 110,
    height: 110,
    borderRadius: 55,
    backgroundColor: 'rgba(99, 102, 241, 0.15)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
    marginTop: 20,
  },
  title: {
    fontSize: 26,
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: 12,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 15,
    color: '#94A3B8',
    textAlign: 'center',
    marginBottom: 32,
    paddingHorizontal: 10,
    lineHeight: 22,
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
  orDivider: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
    marginVertical: 24,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: '#334155',
  },
  orText: {
    color: '#64748B',
    marginHorizontal: 16,
    fontSize: 14,
  },
  joinButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(99, 102, 241, 0.15)',
    borderRadius: 12,
    height: 52,
    width: '100%',
    gap: 10,
  },
  joinButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#6366F1',
  },
  // Success screen styles
  successContent: {
    flex: 1,
    padding: 24,
    alignItems: 'center',
  },
  successIcon: {
    marginTop: 40,
    marginBottom: 24,
  },
  successTitle: {
    fontSize: 28,
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: 12,
  },
  successSubtitle: {
    fontSize: 16,
    color: '#94A3B8',
    textAlign: 'center',
    marginBottom: 32,
  },
  inviteCard: {
    backgroundColor: '#1E293B',
    borderRadius: 16,
    padding: 20,
    width: '100%',
    alignItems: 'center',
    marginBottom: 16,
  },
  inviteLabel: {
    fontSize: 14,
    color: '#64748B',
    marginBottom: 12,
  },
  codeBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(99, 102, 241, 0.1)',
    borderRadius: 12,
    paddingVertical: 16,
    paddingHorizontal: 24,
    gap: 12,
  },
  codeText: {
    fontSize: 28,
    fontWeight: '800',
    color: '#6366F1',
    letterSpacing: 3,
  },
  inviteHint: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 12,
  },
  warningBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(99, 102, 241, 0.1)',
    borderRadius: 12,
    padding: 16,
    width: '100%',
    gap: 12,
    marginTop: 16,
  },
  infoText: {
    flex: 1,
    fontSize: 13,
    color: '#94A3B8',
    lineHeight: 18,
  },
  successScrollView: {
    flex: 1,
  },
  successScrollContent: {
    flexGrow: 1,
    padding: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  shareSection: {
    width: '100%',
    marginBottom: 24,
  },
  shareTitle: {
    fontSize: 14,
    color: '#64748B',
    marginBottom: 12,
  },
  shareButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  shareButton: {
    flex: 1,
    backgroundColor: '#1E293B',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    gap: 8,
  },
  shareButtonText: {
    fontSize: 12,
    color: '#94A3B8',
  },
  primaryButton: {
    width: '100%',
    borderRadius: 14,
    overflow: 'hidden',
    marginBottom: 12,
  },
  continueButton: {
    width: '100%',
    borderRadius: 14,
    overflow: 'hidden',
    marginBottom: 12,
  },
  primaryGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 18,
    gap: 10,
  },
  primaryButtonText: {
    fontSize: 17,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  secondaryButton: {
    paddingVertical: 16,
  },
  secondaryButtonText: {
    fontSize: 16,
    color: '#64748B',
  },
  signOutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 24,
    gap: 8,
  },
  signOutText: {
    fontSize: 14,
    color: '#EF4444',
  },
});
