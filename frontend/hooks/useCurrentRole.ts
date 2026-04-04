/**
 * useCurrentRole Hook
 * Determines the user's role in the current circle
 * Roles are per-circle, not global
 */

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { useAuthStore, useCircleStore } from '../lib/store';

export type CircleRole = 'parent' | 'child' | 'teen' | null;

interface UseCurrentRoleResult {
  role: CircleRole;
  isParent: boolean;
  isChild: boolean;
  isLoading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

export function useCurrentRole(): UseCurrentRoleResult {
  const { user } = useAuthStore();
  const { currentCircle } = useCircleStore();
  
  const [role, setRole] = useState<CircleRole>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchRole = useCallback(async () => {
    if (!user?.id || !currentCircle?.id) {
      setRole(null);
      setIsLoading(false);
      return;
    }

    try {
      setIsLoading(true);
      setError(null);

      const { data, error: fetchError } = await supabase
        .from('circle_members')
        .select('role')
        .eq('user_id', user.id)
        .eq('circle_id', currentCircle.id)
        .single();

      if (fetchError) {
        // If no membership found, user might not be in a circle yet
        if (fetchError.code === 'PGRST116') {
          setRole(null);
        } else {
          throw fetchError;
        }
      } else if (data) {
        setRole(data.role as CircleRole);
      }
    } catch (err: any) {
      console.error('Error fetching role:', err);
      setError(err.message || 'Failed to fetch role');
      setRole(null);
    } finally {
      setIsLoading(false);
    }
  }, [user?.id, currentCircle?.id]);

  useEffect(() => {
    fetchRole();
  }, [fetchRole]);

  return {
    role,
    isParent: role === 'parent',
    isChild: role === 'child' || role === 'teen',
    isLoading,
    error,
    refetch: fetchRole,
  };
}

/**
 * Check if a specific user has parent role in a circle
 */
export async function checkIsParent(
  userId: string,
  circleId: string
): Promise<boolean> {
  try {
    const { data, error } = await supabase
      .from('circle_members')
      .select('role')
      .eq('user_id', userId)
      .eq('circle_id', circleId)
      .single();

    if (error || !data) return false;
    return data.role === 'parent';
  } catch {
    return false;
  }
}
