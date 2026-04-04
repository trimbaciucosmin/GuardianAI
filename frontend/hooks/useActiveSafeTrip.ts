/**
 * useActiveSafeTrip Hook
 * Fetches the user's active safe trip for Child Mode display
 */

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { useAuthStore, useCircleStore } from '../lib/store';

export interface SafeTrip {
  id: string;
  user_id: string;
  circle_id: string;
  start_place_id: string | null;
  destination_place_id: string | null;
  status: 'active' | 'completed' | 'cancelled' | 'delayed';
  started_at: string;
  expected_arrival_at: string | null;
  route_polyline: string | null;
  start_place?: {
    id: string;
    name: string;
    latitude: number;
    longitude: number;
  };
  destination_place?: {
    id: string;
    name: string;
    latitude: number;
    longitude: number;
  };
}

interface UseActiveSafeTripResult {
  activeTrip: SafeTrip | null;
  isLoading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

export function useActiveSafeTrip(): UseActiveSafeTripResult {
  const { user } = useAuthStore();
  const { currentCircle } = useCircleStore();
  
  const [activeTrip, setActiveTrip] = useState<SafeTrip | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchActiveTrip = useCallback(async () => {
    if (!user?.id || !currentCircle?.id) {
      setActiveTrip(null);
      setIsLoading(false);
      return;
    }

    try {
      setIsLoading(true);
      setError(null);

      // Try safe_trips table first (new schema)
      const { data, error: fetchError } = await supabase
        .from('safe_trips')
        .select(`
          *,
          start_place:start_place_id(id, name, latitude, longitude),
          destination_place:destination_place_id(id, name, latitude, longitude)
        `)
        .eq('user_id', user.id)
        .eq('circle_id', currentCircle.id)
        .eq('status', 'active')
        .order('started_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (fetchError && fetchError.code !== 'PGRST116') {
        // Table might not exist, try monitored_trips
        const { data: monitoredData, error: monitoredError } = await supabase
          .from('monitored_trips')
          .select('*')
          .eq('user_id', user.id)
          .eq('circle_id', currentCircle.id)
          .eq('status', 'active')
          .order('started_at', { ascending: false })
          .limit(1)
          .maybeSingle();

        if (!monitoredError && monitoredData) {
          // Convert to SafeTrip format
          setActiveTrip({
            id: monitoredData.id,
            user_id: monitoredData.user_id,
            circle_id: monitoredData.circle_id,
            start_place_id: null,
            destination_place_id: monitoredData.destination_place_id,
            status: monitoredData.status,
            started_at: monitoredData.started_at,
            expected_arrival_at: null,
            route_polyline: null,
            destination_place: monitoredData.destination_place_id ? {
              id: monitoredData.destination_place_id,
              name: monitoredData.destination_name || 'Destination',
              latitude: monitoredData.destination_latitude,
              longitude: monitoredData.destination_longitude,
            } : undefined,
          });
        } else {
          setActiveTrip(null);
        }
      } else {
        setActiveTrip(data);
      }
    } catch (err: any) {
      console.error('Error fetching active trip:', err);
      setError(err.message || 'Failed to fetch trip');
      setActiveTrip(null);
    } finally {
      setIsLoading(false);
    }
  }, [user?.id, currentCircle?.id]);

  useEffect(() => {
    fetchActiveTrip();
    
    // Poll for updates every 30 seconds
    const interval = setInterval(fetchActiveTrip, 30000);
    return () => clearInterval(interval);
  }, [fetchActiveTrip]);

  return {
    activeTrip,
    isLoading,
    error,
    refetch: fetchActiveTrip,
  };
}
