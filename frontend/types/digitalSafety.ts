/**
 * Digital Safety Types
 * Types for app usage tracking and parental controls
 */

// App information
export interface AppInfo {
  packageName: string; // Android: com.example.app, iOS: bundle ID
  appName: string;
  iconUri?: string; // Base64 or URI
  category: AppCategory;
  isSystemApp: boolean;
}

// App categories
export type AppCategory =
  | 'social'
  | 'games'
  | 'entertainment'
  | 'education'
  | 'productivity'
  | 'communication'
  | 'shopping'
  | 'news'
  | 'health'
  | 'finance'
  | 'travel'
  | 'utilities'
  | 'other';

// Risk level for apps
export type RiskLevel = 'safe' | 'moderate' | 'high';

// App usage data
export interface AppUsageData {
  app: AppInfo;
  usageToday: number; // milliseconds
  usageYesterday: number;
  usageLast7Days: number;
  lastUsed: string; // ISO timestamp
  launchCount: number;
  riskLevel: RiskLevel;
}

// App control status
export type AppControlStatus = 'allowed' | 'limited' | 'blocked';

// App limit configuration
export interface AppLimit {
  id: string;
  targetType: 'app' | 'category';
  targetId: string; // packageName or category
  targetName: string;
  dailyLimitMinutes: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

// Schedule for restrictions
export interface RestrictionSchedule {
  id: string;
  name: string;
  type: 'school' | 'homework' | 'sleep' | 'custom';
  daysOfWeek: number[]; // 0-6, Sunday = 0
  startTime: string; // HH:MM
  endTime: string; // HH:MM
  restrictedApps: string[]; // packageNames
  restrictedCategories: AppCategory[];
  isActive: boolean;
}

// Focus Lock session
export interface FocusLockSession {
  id: string;
  name: string;
  type: 'study' | 'sleep' | 'focus' | 'custom';
  allowedApps: string[]; // Apps that remain accessible
  blockedApps: string[]; // Apps that are blocked
  startedAt: string;
  endsAt?: string; // null = until manually stopped
  isActive: boolean;
}

// Daily usage summary
export interface DailyUsageSummary {
  date: string;
  totalScreenTime: number; // milliseconds
  topApps: AppUsageData[];
  usageByCategory: Record<AppCategory, number>;
  firstUsage: string; // Time of first unlock
  lastUsage: string; // Time of last app close
  lateNightUsage: number; // Usage between 10pm-6am
  pickupCount: number; // Number of times device was unlocked
}

// Platform capabilities
export interface PlatformCapabilities {
  platform: 'android' | 'ios' | 'web';
  canGetRealUsageStats: boolean;
  canBlockApps: boolean;
  canShieldApps: boolean;
  canSetSchedules: boolean;
  requiresNativeModule: boolean;
  requiresSpecialPermission: boolean;
  permissionStatus: 'granted' | 'denied' | 'not_requested' | 'not_available';
  limitations: string[];
}

// Child app control settings (stored per child)
export interface ChildAppControls {
  childId: string;
  limits: AppLimit[];
  schedules: RestrictionSchedule[];
  blockedApps: string[];
  alwaysAllowedApps: string[]; // e.g., Phone, Guardian AI
  focusLock?: FocusLockSession;
  lastSyncedAt: string;
}

// Categories with metadata
export const APP_CATEGORIES: Record<AppCategory, { label: string; labelRo: string; icon: string; riskLevel: RiskLevel }> = {
  social: { label: 'Social Media', labelRo: 'Rețele Sociale', icon: 'people', riskLevel: 'moderate' },
  games: { label: 'Games', labelRo: 'Jocuri', icon: 'game-controller', riskLevel: 'moderate' },
  entertainment: { label: 'Entertainment', labelRo: 'Divertisment', icon: 'film', riskLevel: 'moderate' },
  education: { label: 'Education', labelRo: 'Educație', icon: 'school', riskLevel: 'safe' },
  productivity: { label: 'Productivity', labelRo: 'Productivitate', icon: 'briefcase', riskLevel: 'safe' },
  communication: { label: 'Communication', labelRo: 'Comunicare', icon: 'chatbubbles', riskLevel: 'safe' },
  shopping: { label: 'Shopping', labelRo: 'Cumpărături', icon: 'cart', riskLevel: 'moderate' },
  news: { label: 'News', labelRo: 'Știri', icon: 'newspaper', riskLevel: 'safe' },
  health: { label: 'Health', labelRo: 'Sănătate', icon: 'fitness', riskLevel: 'safe' },
  finance: { label: 'Finance', labelRo: 'Finanțe', icon: 'card', riskLevel: 'safe' },
  travel: { label: 'Travel', labelRo: 'Călătorii', icon: 'airplane', riskLevel: 'safe' },
  utilities: { label: 'Utilities', labelRo: 'Utilitare', icon: 'settings', riskLevel: 'safe' },
  other: { label: 'Other', labelRo: 'Altele', icon: 'apps', riskLevel: 'safe' },
};

// Always allowed apps (cannot be blocked)
export const ALWAYS_ALLOWED_APPS = [
  'com.guardianai.app', // Guardian AI
  'com.android.phone', // Phone (Android)
  'com.apple.mobilephone', // Phone (iOS)
  'com.android.contacts', // Contacts (Android)
  'com.apple.MobileSMS', // Messages (iOS)
  'com.android.dialer', // Dialer
];
