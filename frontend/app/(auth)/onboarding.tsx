import React, { useState, useRef } from 'react';
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
  Dimensions,
  FlatList,
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { supabase } from '../../lib/supabase';
import { useAuthStore } from '../../lib/store';

const { width } = Dimensions.get('window');

type Role = 'parent' | 'child' | 'teen';

// Value proposition slides
const VALUE_SLIDES = [
  {
    id: '1',
    icon: 'location',
    iconColor: '#6366F1',
    title: 'Real-Time Location',
    subtitle: 'See where your child is at any moment',
    description: 'Always know your family\'s location on a live map. Peace of mind, wherever you are.',
  },
  {
    id: '2',
    icon: 'notifications',
    iconColor: '#10B981',
    title: 'Safe Arrival Alerts',
    subtitle: 'Automatic notifications when they arrive',
    description: 'Get instant alerts when your child arrives at school, home, or any safe place you set.',
  },
  {
    id: '3',
    icon: 'phone-portrait',
    iconColor: '#F59E0B',
    title: 'Digital Safety',
    subtitle: 'Protect their online experience',
    description: 'Monitor screen time, set app limits, and ensure healthy digital habits for your family.',
  },
];

export default function OnboardingScreen() {
  const router = useRouter();
  const { user, setProfile } = useAuthStore();
  const [currentSlide, setCurrentSlide] = useState(0);
  const [showProfileForm, setShowProfileForm] = useState(false);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [role, setRole] = useState<Role>('parent');
  const [isLoading, setIsLoading] = useState(false);
  const flatListRef = useRef<FlatList>(null);

  const roles: { key: Role; label: string; icon: string; description: string }[] = [
    { key: 'parent', label: 'Parent', icon: 'people', description: 'Manage your family circle' },
    { key: 'teen', label: 'Teen (13-17)', icon: 'person', description: 'Privacy-aware tracking' },
    { key: 'child', label: 'Child (6-12)', icon: 'happy', description: 'Simple safety features' },
  ];

  const handleNext = () => {
    if (currentSlide < VALUE_SLIDES.length - 1) {
      const nextSlide = currentSlide + 1;
      setCurrentSlide(nextSlide);
      flatListRef.current?.scrollToIndex({ index: nextSlide, animated: true });
    } else {
      setShowProfileForm(true);
    }
  };

  const handleSkip = () => {
    setShowProfileForm(true);
  };

  const handleComplete = async () => {
    if (!name.trim()) {
      Alert.alert('Name Required', 'Please enter your name');
      return;
    }

    // Phone is required for children
    if ((role === 'child' || role === 'teen') && !phone.trim()) {
      Alert.alert('Phone Required', 'Please enter a phone number so parents can contact you in emergencies');
      return;
    }

    if (!user) {
      Alert.alert('Error', 'User session not found');
      return;
    }

    setIsLoading(true);

    try {
      // First try to UPDATE existing profile (created by auth trigger)
      const { data: updatedProfile, error: updateError } = await supabase
        .from('profiles')
        .update({
          name: name.trim(),
          phone: phone.trim() || null,
          role,
          updated_at: new Date().toISOString(),
        })
        .eq('user_id', user.id)
        .select()
        .single();

      if (updateError) {
        // If update fails (no profile exists), try INSERT
        if (updateError.code === 'PGRST116') {
          const { data: newProfile, error: insertError } = await supabase
            .from('profiles')
            .insert({
              user_id: user.id,
              name: name.trim(),
              phone: phone.trim() || null,
              role,
            })
            .select()
            .single();

          if (insertError) {
            throw insertError;
          }
          setProfile(newProfile);
        } else {
          throw updateError;
        }
      } else {
        setProfile(updatedProfile);
      }
      
      // Navigate to circle choice (join or create)
      router.replace('/circle/choice');
    } catch (error: any) {
      console.error('Onboarding error:', error);
      
      if (error.code === '23503') {
        Alert.alert(
          'Session Expired',
          'Your session is invalid. Please sign up again.',
          [{
            text: 'OK',
            onPress: async () => {
              await supabase.auth.signOut();
              router.replace('/(auth)/login');
            }
          }]
        );
      } else {
        Alert.alert('Error', error.message || 'Failed to save profile');
      }
    } finally {
      setIsLoading(false);
    }
  };

  const renderSlide = ({ item }: { item: typeof VALUE_SLIDES[0] }) => (
    <View style={styles.slide}>
      <View style={[styles.iconCircle, { backgroundColor: `${item.iconColor}20` }]}>
        <Ionicons name={item.icon as any} size={64} color={item.iconColor} />
      </View>
      <Text style={styles.slideTitle}>{item.title}</Text>
      <Text style={styles.slideSubtitle}>{item.subtitle}</Text>
      <Text style={styles.slideDescription}>{item.description}</Text>
    </View>
  );

  // Value proposition slides
  if (!showProfileForm) {
    return (
      <SafeAreaView style={styles.container}>
        {/* Skip button */}
        <TouchableOpacity style={styles.skipButton} onPress={handleSkip}>
          <Text style={styles.skipText}>Skip</Text>
        </TouchableOpacity>

        {/* Slides */}
        <FlatList
          ref={flatListRef}
          data={VALUE_SLIDES}
          renderItem={renderSlide}
          keyExtractor={(item) => item.id}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          onMomentumScrollEnd={(e) => {
            const index = Math.round(e.nativeEvent.contentOffset.x / width);
            setCurrentSlide(index);
          }}
          scrollEnabled={true}
        />

        {/* Pagination dots */}
        <View style={styles.pagination}>
          {VALUE_SLIDES.map((_, index) => (
            <View
              key={index}
              style={[
                styles.dot,
                currentSlide === index && styles.dotActive,
              ]}
            />
          ))}
        </View>

        {/* Next button */}
        <TouchableOpacity style={styles.nextButton} onPress={handleNext}>
          <LinearGradient
            colors={['#6366F1', '#8B5CF6']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.nextGradient}
          >
            <Text style={styles.nextText}>
              {currentSlide === VALUE_SLIDES.length - 1 ? 'Get Started' : 'Next'}
            </Text>
            <Ionicons name="arrow-forward" size={20} color="#FFFFFF" />
          </LinearGradient>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  // Profile form
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
              <Ionicons name="person-circle" size={48} color="#6366F1" />
            </View>
            <Text style={styles.title}>Complete Your Profile</Text>
            <Text style={styles.subtitle}>Tell us about yourself to get started</Text>
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
              <Text style={styles.label}>
                Phone Number {(role === 'child' || role === 'teen') ? '(Required)' : '(Optional)'}
              </Text>
              <View style={styles.inputWrapper}>
                <Ionicons name="call-outline" size={20} color="#64748B" style={styles.inputIcon} />
                <TextInput
                  style={styles.input}
                  placeholder="+40 7XX XXX XXX"
                  placeholderTextColor="#64748B"
                  value={phone}
                  onChangeText={setPhone}
                  keyboardType="phone-pad"
                />
              </View>
              {(role === 'child' || role === 'teen') && (
                <Text style={styles.phoneHint}>Parents will use this number to call you in emergencies</Text>
              )}
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
                  <Text style={styles.completeButtonText}>Continue</Text>
                  <Ionicons name="arrow-forward" size={20} color="#FFFFFF" />
                </>
              )}
            </TouchableOpacity>

            {/* Sign out option */}
            <TouchableOpacity 
              style={styles.logoutButton} 
              onPress={async () => {
                await supabase.auth.signOut();
                router.replace('/(auth)/login');
              }}
            >
              <Ionicons name="log-out" size={18} color="#EF4444" />
              <Text style={styles.logoutText}>Sign Out & Start Over</Text>
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
  // Slide styles
  slide: {
    width: width,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 40,
    paddingTop: 60,
  },
  iconCircle: {
    width: 140,
    height: 140,
    borderRadius: 70,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 40,
  },
  slideTitle: {
    fontSize: 28,
    fontWeight: '700',
    color: '#FFFFFF',
    textAlign: 'center',
    marginBottom: 12,
  },
  slideSubtitle: {
    fontSize: 18,
    fontWeight: '500',
    color: '#94A3B8',
    textAlign: 'center',
    marginBottom: 16,
  },
  slideDescription: {
    fontSize: 15,
    color: '#64748B',
    textAlign: 'center',
    lineHeight: 22,
  },
  skipButton: {
    position: 'absolute',
    top: 60,
    right: 24,
    zIndex: 10,
  },
  skipText: {
    fontSize: 16,
    color: '#64748B',
    fontWeight: '500',
  },
  pagination: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
    marginBottom: 24,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#334155',
  },
  dotActive: {
    width: 24,
    backgroundColor: '#6366F1',
  },
  nextButton: {
    marginHorizontal: 24,
    marginBottom: 40,
    borderRadius: 14,
    overflow: 'hidden',
  },
  nextGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 18,
    gap: 10,
  },
  nextText: {
    fontSize: 17,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  // Profile form styles
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
  logoutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
    borderRadius: 12,
    padding: 16,
    gap: 8,
    marginTop: 16,
  },
  logoutText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#EF4444',
  },
  phoneHint: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 8,
    fontStyle: 'italic',
  },
});
