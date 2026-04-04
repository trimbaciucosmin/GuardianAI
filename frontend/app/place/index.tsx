import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  ActivityIndicator,
  Alert,
  RefreshControl,
} from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../../lib/supabase';
import { useCircleStore } from '../../lib/store';
import { getPlaceColor } from '../../utils/helpers';

interface SafePlace {
  id: string;
  name: string;
  type: string;
  latitude: number;
  longitude: number;
  formatted_address?: string;
  radius: number;
  created_at: string;
}

export default function SafePlacesListScreen() {
  const router = useRouter();
  const { currentCircle } = useCircleStore();
  
  const [places, setPlaces] = useState<SafePlace[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const fetchPlaces = async () => {
    if (!currentCircle?.id) {
      setIsLoading(false);
      return;
    }

    try {
      const { data, error } = await supabase
        .from('places')
        .select('*')
        .eq('circle_id', currentCircle.id)
        .order('created_at', { ascending: false });

      if (!error && data) {
        setPlaces(data);
      }
    } catch (error) {
      // Silently handle
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  // Refresh when screen comes into focus
  useFocusEffect(
    useCallback(() => {
      fetchPlaces();
    }, [currentCircle?.id])
  );

  const handleRefresh = () => {
    setIsRefreshing(true);
    fetchPlaces();
  };

  const handleDelete = (place: SafePlace) => {
    Alert.alert(
      'Delete Place',
      `Are you sure you want to delete "${place.name}"?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              const { error } = await supabase
                .from('places')
                .delete()
                .eq('id', place.id);

              if (!error) {
                setPlaces(prev => prev.filter(p => p.id !== place.id));
              }
            } catch (error) {
              Alert.alert('Error', 'Failed to delete place');
            }
          },
        },
      ]
    );
  };

  const getPlaceIcon = (type: string): any => {
    switch (type) {
      case 'home': return 'home';
      case 'school': return 'school';
      case 'work': return 'briefcase';
      case 'gym': return 'fitness';
      case 'hospital': return 'medkit';
      default: return 'location';
    }
  };

  const renderPlace = ({ item }: { item: SafePlace }) => (
    <TouchableOpacity
      style={styles.placeCard}
      onPress={() => router.push(`/place/${item.id}`)}
      activeOpacity={0.7}
    >
      <View style={[styles.placeIcon, { backgroundColor: getPlaceColor(item.type) }]}>
        <Ionicons name={getPlaceIcon(item.type)} size={22} color="#FFFFFF" />
      </View>
      
      <View style={styles.placeInfo}>
        <Text style={styles.placeName}>{item.name}</Text>
        {item.formatted_address ? (
          <Text style={styles.placeAddress} numberOfLines={1}>
            {item.formatted_address}
          </Text>
        ) : (
          <Text style={styles.placeCoords}>
            {item.latitude.toFixed(4)}, {item.longitude.toFixed(4)}
          </Text>
        )}
        <View style={styles.placeMetaRow}>
          <View style={styles.radiusBadge}>
            <Ionicons name="radio-button-on" size={10} color="#6366F1" />
            <Text style={styles.radiusText}>{item.radius}m radius</Text>
          </View>
          <Text style={styles.placeType}>{item.type}</Text>
        </View>
      </View>
      
      <View style={styles.placeActions}>
        <TouchableOpacity
          style={styles.editBtn}
          onPress={() => router.push(`/place/${item.id}`)}
        >
          <Ionicons name="create-outline" size={20} color="#6366F1" />
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.deleteBtn}
          onPress={() => handleDelete(item)}
        >
          <Ionicons name="trash-outline" size={20} color="#EF4444" />
        </TouchableOpacity>
      </View>
    </TouchableOpacity>
  );

  if (isLoading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#6366F1" />
          <Text style={styles.loadingText}>Loading places...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color="#FFFFFF" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Safe Places</Text>
        <TouchableOpacity
          style={styles.addButton}
          onPress={() => router.push('/place/create')}
        >
          <Ionicons name="add" size={24} color="#FFFFFF" />
        </TouchableOpacity>
      </View>

      {/* Places List */}
      {places.length === 0 ? (
        <View style={styles.emptyContainer}>
          <View style={styles.emptyIcon}>
            <Ionicons name="location-outline" size={64} color="#475569" />
          </View>
          <Text style={styles.emptyTitle}>No Safe Places Yet</Text>
          <Text style={styles.emptyText}>
            Add places like Home, School, or Work to get arrival/departure alerts
          </Text>
          <TouchableOpacity
            style={styles.emptyButton}
            onPress={() => router.push('/place/create')}
          >
            <Ionicons name="add-circle" size={22} color="#FFFFFF" />
            <Text style={styles.emptyButtonText}>Add First Place</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={places}
          renderItem={renderPlace}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContainer}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={isRefreshing}
              onRefresh={handleRefresh}
              tintColor="#6366F1"
              colors={['#6366F1']}
            />
          }
          ListHeaderComponent={
            <Text style={styles.listHeader}>
              {places.length} place{places.length !== 1 ? 's' : ''} saved
            </Text>
          }
        />
      )}

      {/* Floating Add Button (when list has items) */}
      {places.length > 0 && (
        <TouchableOpacity
          style={styles.fab}
          onPress={() => router.push('/place/create')}
        >
          <Ionicons name="add" size={28} color="#FFFFFF" />
        </TouchableOpacity>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0F172A',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    color: '#94A3B8',
    marginTop: 16,
    fontSize: 16,
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
  addButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#6366F1',
    justifyContent: 'center',
    alignItems: 'center',
  },
  listContainer: {
    padding: 16,
    paddingBottom: 100,
  },
  listHeader: {
    color: '#64748B',
    fontSize: 13,
    marginBottom: 12,
    marginLeft: 4,
  },
  placeCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1E293B',
    borderRadius: 16,
    padding: 14,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#334155',
  },
  placeIcon: {
    width: 48,
    height: 48,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
  },
  placeInfo: {
    flex: 1,
    marginLeft: 14,
  },
  placeName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
    marginBottom: 2,
  },
  placeAddress: {
    fontSize: 13,
    color: '#94A3B8',
    marginBottom: 6,
  },
  placeCoords: {
    fontSize: 12,
    color: '#64748B',
    fontFamily: 'monospace',
    marginBottom: 6,
  },
  placeMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  radiusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(99, 102, 241, 0.15)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  radiusText: {
    fontSize: 11,
    color: '#6366F1',
    fontWeight: '500',
  },
  placeType: {
    fontSize: 11,
    color: '#64748B',
    textTransform: 'capitalize',
  },
  placeActions: {
    flexDirection: 'row',
    gap: 8,
  },
  editBtn: {
    width: 38,
    height: 38,
    borderRadius: 10,
    backgroundColor: 'rgba(99, 102, 241, 0.15)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  deleteBtn: {
    width: 38,
    height: 38,
    borderRadius: 10,
    backgroundColor: 'rgba(239, 68, 68, 0.15)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
  },
  emptyIcon: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: '#1E293B',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
  },
  emptyTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: 8,
  },
  emptyText: {
    fontSize: 15,
    color: '#64748B',
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 28,
  },
  emptyButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#6366F1',
    paddingHorizontal: 24,
    paddingVertical: 14,
    borderRadius: 14,
  },
  emptyButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  fab: {
    position: 'absolute',
    bottom: 24,
    right: 24,
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#6366F1',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#6366F1',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
    elevation: 8,
  },
});
