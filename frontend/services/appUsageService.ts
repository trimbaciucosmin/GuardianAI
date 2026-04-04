/**
 * App Usage Service
 * Handles app usage statistics - platform-specific implementations
 * 
 * IMPORTANT: Real usage data requires:
 * - Android: Development build + PACKAGE_USAGE_STATS permission
 * - iOS: Development build + Family Controls entitlement + Family Sharing
 * 
 * In Expo Go or without permissions, returns simulated data clearly marked as such.
 */

import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  AppInfo,
  AppUsageData,
  AppCategory,
  DailyUsageSummary,
  PlatformCapabilities,
  APP_CATEGORIES,
} from '../types/digitalSafety';

// Storage keys
const STORAGE_KEYS = {
  USAGE_CACHE: 'guardian_app_usage_cache',
  PERMISSION_STATUS: 'guardian_usage_permission',
};

// Check if we're in Expo Go (no native modules)
const isExpoGo = (): boolean => {
  // In Expo Go, certain native modules won't be available
  // This is a simple heuristic
  try {
    // @ts-ignore
    return !global.__NATIVE_MODULES_AVAILABLE__;
  } catch {
    return true; // Assume Expo Go if we can't check
  }
};

/**
 * Get platform capabilities for app usage tracking
 */
export function getPlatformCapabilities(): PlatformCapabilities {
  const platform = Platform.OS as 'android' | 'ios' | 'web';
  const inExpoGo = isExpoGo();

  if (platform === 'web') {
    return {
      platform: 'web',
      canGetRealUsageStats: false,
      canBlockApps: false,
      canShieldApps: false,
      canSetSchedules: true, // Can set schedules locally
      requiresNativeModule: false,
      requiresSpecialPermission: false,
      permissionStatus: 'not_available',
      limitations: [
        'Web browsers cannot access device app usage',
        'App blocking not possible on web',
        'Use mobile app for full functionality',
      ],
    };
  }

  if (platform === 'android') {
    return {
      platform: 'android',
      canGetRealUsageStats: !inExpoGo, // Only with dev build
      canBlockApps: false, // Would need Device Owner
      canShieldApps: !inExpoGo, // Overlay with dev build
      canSetSchedules: true,
      requiresNativeModule: true,
      requiresSpecialPermission: true,
      permissionStatus: inExpoGo ? 'not_available' : 'not_requested',
      limitations: inExpoGo ? [
        'Expo Go does not support native usage stats',
        'Create a development build for real data',
        'Currently showing simulated data',
      ] : [
        'Hard app blocking requires Device Owner mode',
        'Soft blocking via overlay available',
        'User can dismiss overlay warnings',
      ],
    };
  }

  // iOS
  return {
    platform: 'ios',
    canGetRealUsageStats: false, // Requires Family Controls entitlement
    canBlockApps: false,
    canShieldApps: false, // Requires Family Controls
    canSetSchedules: true,
    requiresNativeModule: true,
    requiresSpecialPermission: true,
    permissionStatus: 'not_available',
    limitations: [
      'Requires Family Controls entitlement from Apple',
      'Requires Family Sharing setup',
      'Child must have Apple ID under 18',
      'Currently showing simulated data',
    ],
  };
}

/**
 * Get simulated app usage data
 * Used when real data is not available
 */
function getSimulatedUsageData(): AppUsageData[] {
  const now = Date.now();
  const hour = 60 * 60 * 1000;
  const day = 24 * hour;

  // Realistic simulated data
  const simulatedApps: AppUsageData[] = [
    {
      app: {
        packageName: 'com.instagram.android',
        appName: 'Instagram',
        category: 'social',
        isSystemApp: false,
      },
      usageToday: 2.5 * hour,
      usageYesterday: 1.8 * hour,
      usageLast7Days: 12 * hour,
      lastUsed: new Date(now - 30 * 60000).toISOString(),
      launchCount: 15,
      riskLevel: 'moderate',
    },
    {
      app: {
        packageName: 'com.zhiliaoapp.musically',
        appName: 'TikTok',
        category: 'entertainment',
        isSystemApp: false,
      },
      usageToday: 1.8 * hour,
      usageYesterday: 2.2 * hour,
      usageLast7Days: 14 * hour,
      lastUsed: new Date(now - 2 * hour).toISOString(),
      launchCount: 12,
      riskLevel: 'high',
    },
    {
      app: {
        packageName: 'com.google.android.youtube',
        appName: 'YouTube',
        category: 'entertainment',
        isSystemApp: false,
      },
      usageToday: 1.2 * hour,
      usageYesterday: 1.5 * hour,
      usageLast7Days: 8 * hour,
      lastUsed: new Date(now - 4 * hour).toISOString(),
      launchCount: 8,
      riskLevel: 'moderate',
    },
    {
      app: {
        packageName: 'com.whatsapp',
        appName: 'WhatsApp',
        category: 'communication',
        isSystemApp: false,
      },
      usageToday: 45 * 60000,
      usageYesterday: 50 * 60000,
      usageLast7Days: 5 * hour,
      lastUsed: new Date(now - 15 * 60000).toISOString(),
      launchCount: 25,
      riskLevel: 'safe',
    },
    {
      app: {
        packageName: 'com.supercell.clashofclans',
        appName: 'Clash of Clans',
        category: 'games',
        isSystemApp: false,
      },
      usageToday: 1 * hour,
      usageYesterday: 1.3 * hour,
      usageLast7Days: 7 * hour,
      lastUsed: new Date(now - 6 * hour).toISOString(),
      launchCount: 5,
      riskLevel: 'moderate',
    },
    {
      app: {
        packageName: 'com.spotify.music',
        appName: 'Spotify',
        category: 'entertainment',
        isSystemApp: false,
      },
      usageToday: 30 * 60000,
      usageYesterday: 45 * 60000,
      usageLast7Days: 3 * hour,
      lastUsed: new Date(now - 1 * hour).toISOString(),
      launchCount: 6,
      riskLevel: 'safe',
    },
    {
      app: {
        packageName: 'com.snapchat.android',
        appName: 'Snapchat',
        category: 'social',
        isSystemApp: false,
      },
      usageToday: 40 * 60000,
      usageYesterday: 35 * 60000,
      usageLast7Days: 4 * hour,
      lastUsed: new Date(now - 3 * hour).toISOString(),
      launchCount: 10,
      riskLevel: 'moderate',
    },
    {
      app: {
        packageName: 'com.duolingo',
        appName: 'Duolingo',
        category: 'education',
        isSystemApp: false,
      },
      usageToday: 20 * 60000,
      usageYesterday: 25 * 60000,
      usageLast7Days: 2 * hour,
      lastUsed: new Date(now - 8 * hour).toISOString(),
      launchCount: 3,
      riskLevel: 'safe',
    },
  ];

  return simulatedApps.sort((a, b) => b.usageToday - a.usageToday);
}

/**
 * Get app usage data
 * Returns real data if available, simulated data otherwise
 */
export async function getAppUsageData(): Promise<{
  data: AppUsageData[];
  isSimulated: boolean;
  capabilities: PlatformCapabilities;
}> {
  const capabilities = getPlatformCapabilities();

  // For now, always return simulated data
  // Real implementation would check capabilities and call native modules
  const data = getSimulatedUsageData();

  return {
    data,
    isSimulated: true,
    capabilities,
  };
}

/**
 * Get daily usage summary
 */
export async function getDailyUsageSummary(): Promise<DailyUsageSummary> {
  const { data } = await getAppUsageData();
  const now = new Date();

  // Calculate totals
  const totalScreenTime = data.reduce((sum, app) => sum + app.usageToday, 0);

  // Group by category
  const usageByCategory: Record<AppCategory, number> = {} as any;
  for (const category of Object.keys(APP_CATEGORIES) as AppCategory[]) {
    usageByCategory[category] = data
      .filter(app => app.app.category === category)
      .reduce((sum, app) => sum + app.usageToday, 0);
  }

  // Simulated late night usage (10pm-6am)
  const lateNightUsage = Math.floor(totalScreenTime * 0.15); // ~15% late night

  return {
    date: now.toISOString().split('T')[0],
    totalScreenTime,
    topApps: data.slice(0, 5),
    usageByCategory,
    firstUsage: '07:30',
    lastUsage: '22:15',
    lateNightUsage,
    pickupCount: 45,
  };
}

/**
 * Format duration in human readable format
 */
export function formatDuration(ms: number, lang: 'en' | 'ro' = 'en'): string {
  const hours = Math.floor(ms / (60 * 60 * 1000));
  const minutes = Math.floor((ms % (60 * 60 * 1000)) / (60 * 1000));

  if (hours === 0) {
    return lang === 'ro' ? `${minutes} min` : `${minutes}m`;
  }
  if (minutes === 0) {
    return lang === 'ro' ? `${hours} ore` : `${hours}h`;
  }
  return lang === 'ro' ? `${hours} ore ${minutes} min` : `${hours}h ${minutes}m`;
}

/**
 * Get risk color based on risk level
 */
export function getRiskColor(risk: string): string {
  switch (risk) {
    case 'high': return '#EF4444';
    case 'moderate': return '#F59E0B';
    case 'safe': return '#10B981';
    default: return '#64748B';
  }
}

/**
 * Get category icon
 */
export function getCategoryIcon(category: AppCategory): string {
  return APP_CATEGORIES[category]?.icon || 'apps';
}
