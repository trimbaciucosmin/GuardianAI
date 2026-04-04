/**
 * Supabase Helper Service
 * Provides utility functions for common Supabase operations
 * Uses RPC functions to bypass RLS where needed
 */

import { supabase } from './supabase';

/**
 * Create a new family circle and automatically add the creator as a member
 */
export async function createFamilyCircle(name: string, role: string = 'parent') {
  // Generate a unique invite code
  const inviteCode = generateInviteCode();
  
  const { data, error } = await supabase.rpc('create_family_circle', {
    p_name: name,
    p_invite_code: inviteCode,
    p_role: role,
  });
  
  if (error) {
    throw error;
  }
  
  return data;
}

/**
 * Join an existing family circle using an invite code
 */
export async function joinCircleByCode(inviteCode: string, role: string = 'child') {
  const { data, error } = await supabase.rpc('join_circle_by_code', {
    p_invite_code: inviteCode.trim().toUpperCase(),
    p_role: role,
  });
  
  if (error) {
    throw error;
  }
  
  return data;
}

/**
 * Get circle members with their profiles
 */
export async function getCircleMembersWithProfiles(circleId: string) {
  const { data, error } = await supabase.rpc('get_circle_members_with_profiles', {
    p_circle_id: circleId,
  });
  
  if (error) {
    throw error;
  }
  
  return data || [];
}

/**
 * Get user's circles
 */
export async function getUserCircles() {
  const { data, error } = await supabase
    .from('family_circles')
    .select('*')
    .order('created_at', { ascending: false });
  
  if (error) {
    throw error;
  }
  
  return data || [];
}

/**
 * Get user's profile
 */
export async function getUserProfile(userId: string) {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('user_id', userId)
    .single();
  
  if (error && error.code !== 'PGRST116') { // Ignore "no rows" error
    throw error;
  }
  
  return data;
}

/**
 * Create or update user profile
 */
export async function upsertProfile(profileData: {
  user_id: string;
  name: string;
  phone?: string | null;
  role?: string;
}) {
  const { data, error } = await supabase
    .from('profiles')
    .upsert({
      ...profileData,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'user_id' })
    .select()
    .single();
  
  if (error) {
    throw error;
  }
  
  return data;
}

/**
 * Update live location
 */
export async function updateLiveLocation(locationData: {
  user_id: string;
  circle_id: string;
  latitude: number;
  longitude: number;
  accuracy?: number;
  altitude?: number;
  speed?: number;
  heading?: number;
  battery_level?: number;
  is_moving?: boolean;
  is_charging?: boolean;
}) {
  const { data, error } = await supabase
    .from('live_locations')
    .upsert({
      ...locationData,
      timestamp: new Date().toISOString(),
    }, { onConflict: 'user_id,circle_id' })
    .select()
    .single();
  
  if (error) {
    throw error;
  }
  
  return data;
}

/**
 * Get live locations for a circle
 */
export async function getCircleLiveLocations(circleId: string) {
  const { data, error } = await supabase
    .from('live_locations')
    .select('*, profiles:user_id(name, avatar_url)')
    .eq('circle_id', circleId);
  
  if (error) {
    throw error;
  }
  
  return data || [];
}

/**
 * Create an SOS event
 */
export async function createSOSEvent(eventData: {
  user_id: string;
  circle_id: string;
  latitude: number;
  longitude: number;
  message?: string;
}) {
  const { data, error } = await supabase
    .from('sos_events')
    .insert({
      ...eventData,
      status: 'active',
    })
    .select()
    .single();
  
  if (error) {
    throw error;
  }
  
  return data;
}

/**
 * Cancel/resolve an SOS event
 */
export async function updateSOSEvent(sosId: string, status: 'cancelled' | 'resolved') {
  const { data, error } = await supabase
    .from('sos_events')
    .update({
      status,
      ended_at: new Date().toISOString(),
    })
    .eq('id', sosId)
    .select()
    .single();
  
  if (error) {
    throw error;
  }
  
  return data;
}

/**
 * Create a place (geofence)
 */
export async function createPlace(placeData: {
  circle_id: string;
  name: string;
  latitude: number;
  longitude: number;
  radius?: number;
  address?: string;
  type?: 'home' | 'school' | 'work' | 'custom';
  icon?: string;
  color?: string;
  created_by: string;
}) {
  const { data, error } = await supabase
    .from('places')
    .insert(placeData)
    .select()
    .single();
  
  if (error) {
    throw error;
  }
  
  return data;
}

/**
 * Get places for a circle
 */
export async function getCirclePlaces(circleId: string) {
  const { data, error } = await supabase
    .from('places')
    .select('*')
    .eq('circle_id', circleId)
    .order('type', { ascending: true });
  
  if (error) {
    throw error;
  }
  
  return data || [];
}

/**
 * Start a monitored trip
 */
export async function startMonitoredTrip(tripData: {
  user_id: string;
  circle_id: string;
  destination_place_id?: string;
  destination_name: string;
  destination_latitude: number;
  destination_longitude: number;
  eta_minutes: number;
}) {
  const { data, error } = await supabase
    .from('monitored_trips')
    .insert({
      ...tripData,
      status: 'active',
    })
    .select()
    .single();
  
  if (error) {
    throw error;
  }
  
  return data;
}

/**
 * Update trip status
 */
export async function updateTripStatus(tripId: string, status: 'completed' | 'cancelled' | 'delayed') {
  const { data, error } = await supabase
    .from('monitored_trips')
    .update({
      status,
      ended_at: status !== 'delayed' ? new Date().toISOString() : undefined,
    })
    .eq('id', tripId)
    .select()
    .single();
  
  if (error) {
    throw error;
  }
  
  return data;
}

/**
 * Generate a random invite code
 */
function generateInviteCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // Avoiding confusing chars like 0/O, 1/I
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

/**
 * Check if user is member of any circle
 */
export async function hasCircleMembership(userId: string): Promise<boolean> {
  const { data, error } = await supabase
    .from('circle_members')
    .select('id')
    .eq('user_id', userId)
    .limit(1);
  
  if (error) {
    console.error('Error checking circle membership:', error);
    return false;
  }
  
  return data && data.length > 0;
}
