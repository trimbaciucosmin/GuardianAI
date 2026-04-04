/**
 * Auth Debug Utility
 * Provides visible logging for authentication flow debugging
 */

import { Alert, Platform } from 'react-native';
import { supabase } from './supabase';

// Debug mode - set to false in production to disable alerts
const SHOW_ALERTS = false;
const LOG_PREFIX = '[AUTH_DEBUG]';

type LogLevel = 'info' | 'success' | 'warning' | 'error';

/**
 * Log a debug message with optional alert
 */
export function debugLog(
  step: string,
  message: string,
  data?: any,
  level: LogLevel = 'info'
) {
  const timestamp = new Date().toISOString();
  const emoji = {
    info: 'ℹ️',
    success: '✅',
    warning: '⚠️',
    error: '❌',
  }[level];

  console.log(`\n${LOG_PREFIX} ${emoji} [${timestamp}]`);
  console.log(`Step: ${step}`);
  console.log(`Message: ${message}`);
  if (data !== undefined) {
    console.log('Data:', JSON.stringify(data, null, 2));
  }
  console.log('---');

  // Show alert for errors or important events
  if (SHOW_ALERTS && (level === 'error' || level === 'success')) {
    const title = level === 'error' ? `❌ ${step}` : `✅ ${step}`;
    const alertMessage = data 
      ? `${message}\n\nDetails: ${JSON.stringify(data, null, 2).substring(0, 500)}`
      : message;
    
    // Use setTimeout to avoid blocking
    setTimeout(() => {
      Alert.alert(title, alertMessage, [{ text: 'OK' }]);
    }, 100);
  }
}

/**
 * Log auth signup response
 */
export function logSignupResponse(response: {
  data: { user: any; session: any } | null;
  error: any;
}) {
  if (response.error) {
    debugLog(
      'SIGNUP',
      'Signup failed',
      {
        error_message: response.error.message,
        error_code: response.error.code,
        error_status: response.error.status,
      },
      'error'
    );
    return false;
  }

  debugLog(
    'SIGNUP',
    'Signup successful',
    {
      user_id: response.data?.user?.id,
      email: response.data?.user?.email,
      has_session: !!response.data?.session,
      session_expires_at: response.data?.session?.expires_at,
      created_at: response.data?.user?.created_at,
    },
    'success'
  );
  return true;
}

/**
 * Log login response
 */
export function logLoginResponse(response: {
  data: { user: any; session: any } | null;
  error: any;
}) {
  if (response.error) {
    debugLog(
      'LOGIN',
      'Login failed',
      {
        error_message: response.error.message,
        error_code: response.error.code,
      },
      'error'
    );
    return false;
  }

  debugLog(
    'LOGIN',
    'Login successful',
    {
      user_id: response.data?.user?.id,
      email: response.data?.user?.email,
      has_session: !!response.data?.session,
    },
    'success'
  );
  return true;
}

/**
 * Verify profile exists for user
 */
export async function verifyProfileExists(userId: string): Promise<{
  exists: boolean;
  profile: any;
  error: any;
}> {
  debugLog('PROFILE_CHECK', `Checking if profile exists for user: ${userId}`, null, 'info');

  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('user_id', userId);

  if (error) {
    debugLog(
      'PROFILE_CHECK',
      'Error checking profile',
      { error_message: error.message, error_code: error.code },
      'error'
    );
    return { exists: false, profile: null, error };
  }

  const profileCount = data?.length || 0;
  
  if (profileCount === 0) {
    debugLog('PROFILE_CHECK', 'No profile found for user', { user_id: userId }, 'warning');
    return { exists: false, profile: null, error: null };
  }

  if (profileCount > 1) {
    debugLog(
      'PROFILE_CHECK',
      'WARNING: Multiple profiles found!',
      { user_id: userId, profile_count: profileCount, profiles: data },
      'error'
    );
  } else {
    debugLog(
      'PROFILE_CHECK',
      'Profile exists',
      { 
        user_id: userId, 
        profile_id: data[0].id,
        name: data[0].name,
        role: data[0].role,
      },
      'success'
    );
  }

  return { exists: true, profile: data[0], error: null };
}

/**
 * Log onboarding/profile save response
 */
export function logProfileSaveResponse(
  operation: 'insert' | 'update' | 'upsert',
  response: { data: any; error: any }
) {
  if (response.error) {
    debugLog(
      'PROFILE_SAVE',
      `Profile ${operation} failed`,
      {
        operation,
        error_message: response.error.message,
        error_code: response.error.code,
        error_details: response.error.details,
        error_hint: response.error.hint,
      },
      'error'
    );
    return false;
  }

  debugLog(
    'PROFILE_SAVE',
    `Profile ${operation} successful`,
    {
      operation,
      profile_id: response.data?.id,
      user_id: response.data?.user_id,
      name: response.data?.name,
      role: response.data?.role,
      updated_at: response.data?.updated_at,
    },
    'success'
  );
  return true;
}

/**
 * Log redirect decision
 */
export function logRedirectDecision(decision: {
  hasUser: boolean;
  hasProfile: boolean;
  profileComplete: boolean;
  destination: 'login' | 'onboarding' | 'map';
  reason: string;
}) {
  debugLog(
    'REDIRECT',
    `Redirecting to: ${decision.destination}`,
    decision,
    'info'
  );
}

/**
 * Check auth trigger (handle_new_user)
 * This checks if a profile was auto-created by the trigger
 */
export async function checkAuthTrigger(userId: string): Promise<boolean> {
  debugLog('AUTH_TRIGGER', 'Checking if handle_new_user trigger fired...', { user_id: userId }, 'info');
  
  // Wait a moment for the trigger to execute
  await new Promise(resolve => setTimeout(resolve, 1000));
  
  const { exists, profile, error } = await verifyProfileExists(userId);
  
  if (exists && profile) {
    debugLog(
      'AUTH_TRIGGER',
      'Trigger appears to have fired - profile exists',
      { profile_created_at: profile.created_at },
      'success'
    );
    return true;
  } else {
    debugLog(
      'AUTH_TRIGGER',
      'Trigger may not have fired - no profile found',
      { error },
      'warning'
    );
    return false;
  }
}

/**
 * Verify RLS allows profile update
 */
export async function verifyRLSProfileUpdate(userId: string): Promise<boolean> {
  debugLog('RLS_CHECK', 'Verifying RLS allows profile update...', { user_id: userId }, 'info');
  
  // Try to read the profile first
  const { data: readData, error: readError } = await supabase
    .from('profiles')
    .select('id, user_id, name')
    .eq('user_id', userId)
    .single();

  if (readError) {
    debugLog(
      'RLS_CHECK',
      'Cannot read own profile - RLS may be blocking',
      { error: readError.message },
      'error'
    );
    return false;
  }

  debugLog('RLS_CHECK', 'Can read own profile', { profile_id: readData?.id }, 'success');

  // Try a no-op update to verify write access
  const { error: updateError } = await supabase
    .from('profiles')
    .update({ updated_at: new Date().toISOString() })
    .eq('user_id', userId);

  if (updateError) {
    debugLog(
      'RLS_CHECK',
      'Cannot update own profile - RLS may be blocking',
      { error: updateError.message },
      'error'
    );
    return false;
  }

  debugLog('RLS_CHECK', 'Can update own profile - RLS working correctly', null, 'success');
  return true;
}

/**
 * Run full auth diagnostics
 */
export async function runAuthDiagnostics(): Promise<void> {
  debugLog('DIAGNOSTICS', '=== Starting Auth Diagnostics ===', null, 'info');

  // Check current session
  const { data: { session }, error: sessionError } = await supabase.auth.getSession();
  
  if (sessionError || !session) {
    debugLog('DIAGNOSTICS', 'No active session', { error: sessionError?.message }, 'warning');
    return;
  }

  debugLog('DIAGNOSTICS', 'Active session found', {
    user_id: session.user.id,
    email: session.user.email,
    expires_at: session.expires_at,
  }, 'info');

  // Verify profile
  await verifyProfileExists(session.user.id);

  // Verify RLS
  await verifyRLSProfileUpdate(session.user.id);

  debugLog('DIAGNOSTICS', '=== Diagnostics Complete ===', null, 'info');
}
