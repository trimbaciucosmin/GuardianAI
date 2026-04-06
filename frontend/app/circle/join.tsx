
Pas 4: Editează al treilea (și ultimul) fișier
Mergi la: https://github.com/trimbaciucosmin/GuardianAI/tree/main/frontend/app
Click pe folder circle
Click pe fișierul join.tsx
Click pe iconița creion (Edit) din dreapta sus
Selectează tot (Ctrl+A) și șterge
Copiază tot textul de mai jos și lipește-l:
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
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '../../lib/supabase';
import { useAuthStore, useCircleStore } from '../../lib/store';

export default function JoinCircleScreen() {
  const router = useRouter();
  const { user, profile, setUser, setProfile } = useAuthStore();
  const { addCircle, setCurrentCircle, setCurrentRole } = useCircleStore();
  const [code, setCode] = useState('');
  const [isLoading, setIsLoading] = useState(false);

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

  const handleJoin = async () => {
    console.log('=== JOIN BUTTON PRESSED ===');
    const cleanCode = code.trim().toUpperCase();
    
    if (!cleanCode || cleanCode.length < 4) {
      if (typeof window !== 'undefined') {
        window.alert('Te rugăm să introduci codul de invitație (minim 4 caractere)');
      }
      return;
    }

    if (!user) {
      if (typeof window !== 'undefined') {
        window.alert('Eroare: Nu ești autentificat. Te rugăm să te loghezi din nou.');
      }
      return;
    }

    setIsLoading(true);

    try {
      const { data: rpcData, error: rpcError } = await supabase
        .rpc('lookup_circle_by_invite_code', { p_invite_code: cleanCode });

      if (rpcError) {
        if (typeof window !== 'undefined') {
          window.alert('Eroare la căutare: ' + rpcError.message);
        }
        setIsLoading(false);
        return;
      }

      const circleData = Array.isArray(rpcData) && rpcData.length > 0 ? rpcData[0] : null;

      if (!circleData) {
        if (typeof window !== 'undefined') {
          window.alert('Cercul nu a fost găsit. Verifică codul și încearcă din nou.');
        }
        setIsLoading(false);
        return;
      }

      const { data: existingMember } = await supabase
        .from('circle_members')
        .select('*')
        .eq('circle_id', circleData.id)
        .eq('user_id', user.id)
        .single();

      if (existingMember) {
        if (typeof window !== 'undefined') {
          window.alert('Ești deja membru al acestui cerc!');
        }
        setIsLoading(false);
        router.replace('/(main)/family');
        return;
      }

      const { error: memberError } = await supabase
        .from('circle_members')
        .insert({
          circle_id: circleData.id,
          user_id: user.id,
          role: profile?.role || 'child',
          joined_at: new Date().toISOString(),
        });

      if (memberError) {
        if (typeof window !== 'undefined') {
          window.alert('Eroare la adăugare: ' + memberError.message);
        }
        setIsLoading(false);
        return;
      }

      addCircle(circleData);
      setCurrentCircle(circleData);
      
      const memberRole = profile?.role || 'child';
      setCurrentRole(memberRole);
      
      try {
        await AsyncStorage.setItem('@guardian_cached_role', memberRole);
      } catch (e) {
        console.log('Cache write error:', e);
      }

      if (typeof window !== 'undefined') {
        window.alert('Felicitări! Te-ai alăturat cercului "' + circleData.name + '"');
      }
      
      const CHILD_ROLES = ['child', 'teen'];
      if (CHILD_ROLES.includes(memberRole.toLowerCase())) {
        console.log('[JOIN] Child role detected → /(child)/home');
        router.replace('/(child)/home');
      } else {
        console.log('[JOIN] Parent role detected → /(main)/family');
        router.replace('/(main)/family');
      }
    } catch (error: any) {
      if (typeof window !== 'undefined') {
        window.alert('Eroare neașteptată: ' + (error.message || JSON.stringify(error)));
      }
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
        <View style={styles.header}>
          <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
            <Ionicons name="arrow-back" size={24} color="#FFFFFF" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Join Circle</Text>
          <View style={{ width: 44 }} />
        </View>

        <View style={styles.content}>
          <View style={styles.iconWrapper}>
            <Ionicons name="enter" size={48} color="#10B981" />
          </View>
          <Text style={styles.title}>Join Family Circle</Text>
          <Text style={styles.subtitle}>
            Enter the invite code shared by a family member
          </Text>

          <View style={styles.inputContainer}>
            <Text style={styles.label}>Invite Code</Text>
            <View style={styles.inputWrapper}>
              <TextInput
                style={styles.input}
                placeholder="XXXXXX"
                placeholderTextColor="#64748B"
                value={code}
                onChangeText={(text) => setCode(text.toUpperCase())}
                autoCapitalize="characters"
                maxLength={6}
                autoCorrect={false}
              />
            </View>
          </View>

          <TouchableOpacity
            style={[styles.joinButton, isLoading && styles.buttonDisabled]}
            onPress={handleJoin}
            disabled={isLoading}
          >
            {isLoading ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <>
                <Text style={styles.joinButtonText}>Join Circle</Text>
                <Ionicons name="arrow-forward" size={20} color="#FFFFFF" />
              </>
            )}
          </TouchableOpacity>

          <View style={styles.divider}>
            <View style={styles.dividerLine} />
            <Text style={styles.dividerText}>or</Text>
            <View style={styles.dividerLine} />
          </View>

          <TouchableOpacity
            style={styles.createLink}
            onPress={() => router.replace('/circle/create')}
          >
            <Text style={styles.createLinkText}>Create a new circle</Text>
          </TouchableOpacity>

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
  content: {
    flex: 1,
    padding: 24,
    alignItems: 'center',
  },
  iconWrapper: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: 'rgba(16, 185, 129, 0.1)',
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
    textAlign: 'center',
  },
  inputWrapper: {
    backgroundColor: '#1E293B',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#334155',
  },
  input: {
    height: 60,
    fontSize: 28,
    fontWeight: '700',
    color: '#FFFFFF',
    textAlign: 'center',
    letterSpacing: 8,
  },
  joinButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#10B981',
    borderRadius: 12,
    height: 52,
    width: '100%',
    gap: 8,
  },
  buttonDisabled: {
    opacity: 0.7,
  },
  joinButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
    marginVertical: 32,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: '#334155',
  },
  dividerText: {
    color: '#64748B',
    paddingHorizontal: 16,
    fontSize: 14,
  },
  createLink: {
    padding: 12,
  },
  createLinkText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#6366F1',
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
