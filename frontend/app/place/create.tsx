import React, { useState, useEffect } from 'react';
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
  ScrollView,
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import { supabase } from '../../lib/supabase';
import { useAuthStore, useCircleStore, usePlacesStore } from '../../lib/store';
import { getPlaceColor } from '../../utils/helpers';

type PlaceType = 'home' | 'school' | 'work' | 'custom';

export default function CreatePlaceScreen() {
  const router = useRouter();
  const { user } = useAuthStore();
  const { currentCircle } = useCircleStore();
  const { addPlace } = usePlacesStore();
  
  const [name, setName] = useState('');
  const [type, setType] = useState<PlaceType>('home');
  const [radius, setRadius] = useState(100);
  const [isLoading, setIsLoading] = useState(false);
  const [location, setLocation] = useState<{ latitude: number; longitude: number } | null>(null);

  useEffect(() => {
    getCurrentLocation();
  }, []);

  const getCurrentLocation = async () => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') return;

      const loc = await Location.getCurrentPositionAsync({});
      setLocation({
        latitude: loc.coords.latitude,
        longitude: loc.coords.longitude,
      });
    } catch (error) {
      console.error('Get location error:', error);
    }
  };

  const placeTypes: { key: PlaceType; label: string; icon: string }[] = [
    { key: 'home', label: 'Home', icon: 'home' },
    { key: 'school', label: 'School', icon: 'school' },
    { key: 'work', label: 'Work', icon: 'briefcase' },
    { key: 'custom', label: 'Custom', icon: 'location' },
  ];

  const handleCreate = async () => {
    if (!name.trim()) {
      Alert.alert('Name Required', 'Please enter a name for this place');
      return;
    }

    if (!location) {
      Alert.alert('Location Required', 'Please wait for location to load');
      return;
    }

    if (!currentCircle) {
      Alert.alert('No Circle', 'You need to be in a family circle first');
      return;
    }

    setIsLoading(true);

    try {
      const placeData = {
        circle_id: currentCircle.id,
        name: name.trim(),
        type,
        latitude: location.latitude,
        longitude: location.longitude,
        radius,
        created_by: user?.id,
        created_at: new Date().toISOString(),
      };

      const { data, error } = await supabase
        .from('places')
        .insert(placeData)
        .select()
        .single();

      if (error) throw error;

      addPlace(data);
      Alert.alert('Place Created!', `${name} has been added`, [
        { text: 'OK', onPress: () => router.back() },
      ]);
    } catch (error: any) {
      console.error('Create place error:', error);
      Alert.alert('Error', error.message || 'Failed to create place');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color="#FFFFFF" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Add Place</Text>
        <View style={{ width: 44 }} />
      </View>

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardView}
      >
        <ScrollView showsVerticalScrollIndicator={false}>
          {/* Map Preview */}
          <View style={styles.mapContainer}>
            <View style={styles.mapPlaceholder}>
              <View style={[styles.marker, { backgroundColor: getPlaceColor(type) }]}>
                <Ionicons
                  name={placeTypes.find(p => p.key === type)?.icon as any || 'location'}
                  size={24}
                  color="#FFFFFF"
                />
              </View>
              <Text style={styles.mapText}>
                {location 
                  ? `${location.latitude.toFixed(4)}, ${location.longitude.toFixed(4)}`
                  : 'Loading location...'}
              </Text>
              <Text style={styles.mapHint}>Using your current location</Text>
            </View>
          </View>

          {/* Form */}
          <View style={styles.form}>
            <View style={styles.inputContainer}>
              <Text style={styles.label}>Place Name</Text>
              <View style={styles.inputWrapper}>
                <Ionicons name="location-outline" size={20} color="#64748B" style={styles.inputIcon} />
                <TextInput
                  style={styles.input}
                  placeholder="e.g., Home, School, Grandma's"
                  placeholderTextColor="#64748B"
                  value={name}
                  onChangeText={setName}
                  autoCapitalize="words"
                />
              </View>
            </View>

            <View style={styles.inputContainer}>
              <Text style={styles.label}>Place Type</Text>
              <View style={styles.typeGrid}>
                {placeTypes.map((pt) => (
                  <TouchableOpacity
                    key={pt.key}
                    style={[
                      styles.typeCard,
                      type === pt.key && { borderColor: getPlaceColor(pt.key), backgroundColor: `${getPlaceColor(pt.key)}15` },
                    ]}
                    onPress={() => setType(pt.key)}
                  >
                    <Ionicons
                      name={pt.icon as any}
                      size={24}
                      color={type === pt.key ? getPlaceColor(pt.key) : '#64748B'}
                    />
                    <Text style={[
                      styles.typeLabel,
                      type === pt.key && { color: getPlaceColor(pt.key) },
                    ]}>
                      {pt.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            <View style={styles.inputContainer}>
              <Text style={styles.label}>Radius: {radius}m</Text>
              <View style={styles.radiusButtons}>
                {[50, 100, 200, 500].map((r) => (
                  <TouchableOpacity
                    key={r}
                    style={[
                      styles.radiusButton,
                      radius === r && styles.radiusButtonActive,
                    ]}
                    onPress={() => setRadius(r)}
                  >
                    <Text style={[
                      styles.radiusButtonText,
                      radius === r && styles.radiusButtonTextActive,
                    ]}>
                      {r}m
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            <TouchableOpacity
              style={[styles.createButton, (isLoading || !location) && styles.buttonDisabled]}
              onPress={handleCreate}
              disabled={isLoading || !location}
            >
              {isLoading ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <>
                  <Text style={styles.createButtonText}>Save Place</Text>
                  <Ionicons name="checkmark" size={20} color="#FFFFFF" />
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
  keyboardView: {
    flex: 1,
  },
  mapContainer: {
    height: 200,
    marginHorizontal: 16,
    marginBottom: 8,
    borderRadius: 16,
    overflow: 'hidden',
  },
  mapPlaceholder: {
    flex: 1,
    backgroundColor: '#1E293B',
    justifyContent: 'center',
    alignItems: 'center',
  },
  marker: {
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 3,
    borderColor: '#FFFFFF',
    marginBottom: 12,
  },
  mapText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '500',
  },
  mapHint: {
    color: '#64748B',
    fontSize: 12,
    marginTop: 4,
  },
  form: {
    padding: 16,
  },
  inputContainer: {
    marginBottom: 20,
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
  typeGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  typeCard: {
    flex: 1,
    minWidth: '22%',
    backgroundColor: '#1E293B',
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#334155',
    padding: 12,
    alignItems: 'center',
    gap: 4,
  },
  typeLabel: {
    fontSize: 12,
    color: '#64748B',
    fontWeight: '500',
  },
  radiusButtons: {
    flexDirection: 'row',
    gap: 8,
  },
  radiusButton: {
    flex: 1,
    backgroundColor: '#1E293B',
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#334155',
  },
  radiusButtonActive: {
    backgroundColor: 'rgba(99, 102, 241, 0.1)',
    borderColor: '#6366F1',
  },
  radiusButtonText: {
    color: '#64748B',
    fontSize: 14,
    fontWeight: '600',
  },
  radiusButtonTextActive: {
    color: '#6366F1',
  },
  createButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#6366F1',
    borderRadius: 12,
    height: 52,
    gap: 8,
    marginTop: 8,
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
