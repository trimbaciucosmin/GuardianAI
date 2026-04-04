/**
 * App Control Service
 * Manages app limits, schedules, and focus lock
 * 
 * IMPORTANT: Actual enforcement requires:
 * - Android: Development build + native module
 * - iOS: Development build + Family Controls entitlement
 * 
 * This service stores settings and provides UI state.
 * Real enforcement happens through platform-specific native modules.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import {
  AppLimit,
  RestrictionSchedule,
  FocusLockSession,
  ChildAppControls,
  AppCategory,
  ALWAYS_ALLOWED_APPS,
} from '../types/digitalSafety';
import { supabase } from '../lib/supabase';

const STORAGE_KEYS = {
  CONTROLS: 'guardian_app_controls_',
  FOCUS_LOCK: 'guardian_focus_lock',
};

/**
 * Get app controls for a child
 */
export async function getChildAppControls(childId: string): Promise<ChildAppControls> {
  try {
    // Try to get from Supabase first
    const { data, error } = await supabase
      .from('child_app_controls')
      .select('*')
      .eq('child_id', childId)
      .single();

    if (data && !error) {
      return {
        childId: data.child_id,
        limits: data.limits || [],
        schedules: data.schedules || [],
        blockedApps: data.blocked_apps || [],
        alwaysAllowedApps: [...ALWAYS_ALLOWED_APPS, ...(data.always_allowed_apps || [])],
        focusLock: data.focus_lock || undefined,
        lastSyncedAt: data.updated_at,
      };
    }

    // Fallback to local storage
    const local = await AsyncStorage.getItem(STORAGE_KEYS.CONTROLS + childId);
    if (local) {
      return JSON.parse(local);
    }

    // Return default
    return {
      childId,
      limits: [],
      schedules: getDefaultSchedules(),
      blockedApps: [],
      alwaysAllowedApps: [...ALWAYS_ALLOWED_APPS],
      lastSyncedAt: new Date().toISOString(),
    };
  } catch (error) {
    console.error('[AppControl] Error getting controls:', error);
    return {
      childId,
      limits: [],
      schedules: getDefaultSchedules(),
      blockedApps: [],
      alwaysAllowedApps: [...ALWAYS_ALLOWED_APPS],
      lastSyncedAt: new Date().toISOString(),
    };
  }
}

/**
 * Save app controls for a child
 */
export async function saveChildAppControls(controls: ChildAppControls): Promise<boolean> {
  try {
    controls.lastSyncedAt = new Date().toISOString();

    // Save to local storage
    await AsyncStorage.setItem(
      STORAGE_KEYS.CONTROLS + controls.childId,
      JSON.stringify(controls)
    );

    // Try to sync to Supabase
    try {
      await supabase
        .from('child_app_controls')
        .upsert({
          child_id: controls.childId,
          limits: controls.limits,
          schedules: controls.schedules,
          blocked_apps: controls.blockedApps,
          always_allowed_apps: controls.alwaysAllowedApps,
          focus_lock: controls.focusLock,
          updated_at: controls.lastSyncedAt,
        }, { onConflict: 'child_id' });
    } catch (e) {
      console.log('[AppControl] Supabase sync failed, local only');
    }

    return true;
  } catch (error) {
    console.error('[AppControl] Error saving controls:', error);
    return false;
  }
}

/**
 * Add or update app limit
 */
export async function setAppLimit(
  childId: string,
  limit: Omit<AppLimit, 'id' | 'createdAt' | 'updatedAt'>
): Promise<boolean> {
  const controls = await getChildAppControls(childId);
  const now = new Date().toISOString();

  // Check if limit exists for this target
  const existingIndex = controls.limits.findIndex(
    l => l.targetType === limit.targetType && l.targetId === limit.targetId
  );

  const newLimit: AppLimit = {
    ...limit,
    id: existingIndex >= 0 ? controls.limits[existingIndex].id : `limit_${Date.now()}`,
    createdAt: existingIndex >= 0 ? controls.limits[existingIndex].createdAt : now,
    updatedAt: now,
  };

  if (existingIndex >= 0) {
    controls.limits[existingIndex] = newLimit;
  } else {
    controls.limits.push(newLimit);
  }

  return saveChildAppControls(controls);
}

/**
 * Remove app limit
 */
export async function removeAppLimit(childId: string, limitId: string): Promise<boolean> {
  const controls = await getChildAppControls(childId);
  controls.limits = controls.limits.filter(l => l.id !== limitId);
  return saveChildAppControls(controls);
}

/**
 * Block an app
 */
export async function blockApp(childId: string, packageName: string): Promise<boolean> {
  // Don't allow blocking essential apps
  if (ALWAYS_ALLOWED_APPS.includes(packageName)) {
    console.log('[AppControl] Cannot block essential app:', packageName);
    return false;
  }

  const controls = await getChildAppControls(childId);
  if (!controls.blockedApps.includes(packageName)) {
    controls.blockedApps.push(packageName);
  }
  return saveChildAppControls(controls);
}

/**
 * Unblock an app
 */
export async function unblockApp(childId: string, packageName: string): Promise<boolean> {
  const controls = await getChildAppControls(childId);
  controls.blockedApps = controls.blockedApps.filter(p => p !== packageName);
  return saveChildAppControls(controls);
}

/**
 * Add or update schedule
 */
export async function setSchedule(
  childId: string,
  schedule: Omit<RestrictionSchedule, 'id'>
): Promise<boolean> {
  const controls = await getChildAppControls(childId);

  const existingIndex = controls.schedules.findIndex(s => s.type === schedule.type);
  const newSchedule: RestrictionSchedule = {
    ...schedule,
    id: existingIndex >= 0 ? controls.schedules[existingIndex].id : `schedule_${Date.now()}`,
  };

  if (existingIndex >= 0) {
    controls.schedules[existingIndex] = newSchedule;
  } else {
    controls.schedules.push(newSchedule);
  }

  return saveChildAppControls(controls);
}

/**
 * Start focus lock
 */
export async function startFocusLock(
  childId: string,
  session: Omit<FocusLockSession, 'id' | 'startedAt' | 'isActive'>
): Promise<boolean> {
  const controls = await getChildAppControls(childId);

  controls.focusLock = {
    ...session,
    id: `focus_${Date.now()}`,
    startedAt: new Date().toISOString(),
    isActive: true,
    // Always include essential apps
    allowedApps: [
      ...ALWAYS_ALLOWED_APPS,
      ...session.allowedApps.filter(app => !ALWAYS_ALLOWED_APPS.includes(app)),
    ],
  };

  return saveChildAppControls(controls);
}

/**
 * Stop focus lock
 */
export async function stopFocusLock(childId: string): Promise<boolean> {
  const controls = await getChildAppControls(childId);
  controls.focusLock = undefined;
  return saveChildAppControls(controls);
}

/**
 * Get current focus lock status
 */
export async function getFocusLockStatus(childId: string): Promise<FocusLockSession | null> {
  const controls = await getChildAppControls(childId);
  
  if (!controls.focusLock?.isActive) {
    return null;
  }

  // Check if focus lock has expired
  if (controls.focusLock.endsAt) {
    const endsAt = new Date(controls.focusLock.endsAt);
    if (endsAt < new Date()) {
      // Expired, stop it
      await stopFocusLock(childId);
      return null;
    }
  }

  return controls.focusLock;
}

/**
 * Check if an app is currently restricted
 */
export async function isAppRestricted(
  childId: string,
  packageName: string
): Promise<{ restricted: boolean; reason?: string }> {
  const controls = await getChildAppControls(childId);

  // Check if always allowed
  if (controls.alwaysAllowedApps.includes(packageName)) {
    return { restricted: false };
  }

  // Check if blocked
  if (controls.blockedApps.includes(packageName)) {
    return { restricted: true, reason: 'blocked' };
  }

  // Check focus lock
  if (controls.focusLock?.isActive) {
    if (!controls.focusLock.allowedApps.includes(packageName)) {
      return { restricted: true, reason: 'focus_lock' };
    }
  }

  // TODO: Check schedules and limits
  // This would require current usage data and time checking

  return { restricted: false };
}

/**
 * Get default schedules
 */
function getDefaultSchedules(): RestrictionSchedule[] {
  return [
    {
      id: 'schedule_school',
      name: 'School Hours',
      type: 'school',
      daysOfWeek: [1, 2, 3, 4, 5], // Mon-Fri
      startTime: '08:00',
      endTime: '15:00',
      restrictedApps: [],
      restrictedCategories: ['games', 'social', 'entertainment'],
      isActive: false,
    },
    {
      id: 'schedule_homework',
      name: 'Homework Time',
      type: 'homework',
      daysOfWeek: [1, 2, 3, 4, 5],
      startTime: '16:00',
      endTime: '18:00',
      restrictedApps: [],
      restrictedCategories: ['games', 'social'],
      isActive: false,
    },
    {
      id: 'schedule_sleep',
      name: 'Sleep Time',
      type: 'sleep',
      daysOfWeek: [0, 1, 2, 3, 4, 5, 6], // Every day
      startTime: '21:00',
      endTime: '07:00',
      restrictedApps: [],
      restrictedCategories: ['games', 'social', 'entertainment'],
      isActive: false,
    },
  ];
}

/**
 * Get focus lock presets
 */
export function getFocusLockPresets(): Omit<FocusLockSession, 'id' | 'startedAt' | 'isActive'>[] {
  return [
    {
      name: 'Study Mode',
      type: 'study',
      allowedApps: [...ALWAYS_ALLOWED_APPS, 'com.google.android.apps.docs', 'com.microsoft.office.word'],
      blockedApps: [],
    },
    {
      name: 'Sleep Mode',
      type: 'sleep',
      allowedApps: [...ALWAYS_ALLOWED_APPS],
      blockedApps: [],
    },
    {
      name: 'Focus Mode',
      type: 'focus',
      allowedApps: [...ALWAYS_ALLOWED_APPS],
      blockedApps: [],
    },
  ];
}
