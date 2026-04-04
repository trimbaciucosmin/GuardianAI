/**
 * Push Notification Service
 * Handles push notifications for all safety events:
 * - Route deviations
 * - Tamper alerts
 * - SOS events
 * - Arrival/Departure
 * 
 * NOTE: expo-notifications is NOT supported in Expo Go since SDK 53.
 * Push notifications only work in development builds.
 */

import * as Device from 'expo-device';
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';
import { supabase } from '../lib/supabase';

// Storage key for push token
const PUSH_TOKEN_KEY = '@guardian_push_token';

// Check if running in Expo Go (notifications not supported since SDK 53)
const isExpoGo = Constants.appOwnership === 'expo';

// Lazy load notifications module to avoid error on Expo Go
let Notifications: any = null;
let notificationsAvailable: boolean | null = null;

const getNotificationsModule = async () => {
  // Skip entirely in Expo Go - not supported since SDK 53
  if (isExpoGo) {
    return null;
  }
  
  // Return cached result
  if (notificationsAvailable === false) {
    return null;
  }
  
  if (!Notifications) {
    try {
      Notifications = await import('expo-notifications');
      notificationsAvailable = true;
    } catch (e) {
      console.log('[PushNotification] Module not available');
      notificationsAvailable = false;
      return null;
    }
  }
  return Notifications;
};

// Notification types
export type NotificationType = 
  | 'route_deviation'
  | 'unusual_stop'
  | 'late_arrival'
  | 'tamper_alert'
  | 'sos_triggered'
  | 'sos_resolved'
  | 'arrival'
  | 'departure'
  | 'low_battery'
  | 'child_offline';

export interface PushNotificationData {
  type: NotificationType;
  title: string;
  body: string;
  data?: Record<string, any>;
  circleId?: string;
  childId?: string;
  childName?: string;
}

// Initialize notification handler (called once)
const initHandler = async () => {
  if (isExpoGo) return;
  
  const notif = await getNotificationsModule();
  if (!notif) return;
  
  try {
    notif.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowAlert: true,
        shouldPlaySound: true,
        shouldSetBadge: true,
        shouldShowBanner: true,
        shouldShowList: true,
      }),
    });
  } catch (error) {
    // Silently ignore
  }
};

// Call init (non-blocking)
initHandler();

/**
 * Initialize push notifications
 */
export async function initializePushNotifications(): Promise<string | null> {
  try {
    // Skip on Expo Go - push notifications not supported since SDK 53
    if (isExpoGo) {
      console.log('[PushNotification] Skipped - Expo Go (not supported since SDK 53)');
      return null;
    }
    
    const notif = await getNotificationsModule();
    if (!notif) return null;
    
    // Check if it's a physical device
    if (!Device.isDevice) {
      console.log('[PushNotification] Must use physical device for push notifications');
      return null;
    }

    // Request permissions
    const { status: existingStatus } = await notif.getPermissionsAsync();
    let finalStatus = existingStatus;

    if (existingStatus !== 'granted') {
      const { status } = await notif.requestPermissionsAsync();
      finalStatus = status;
    }

    if (finalStatus !== 'granted') {
      console.log('[PushNotification] Permission not granted');
      return null;
    }

    // Get push token
    const tokenData = await notif.getExpoPushTokenAsync({
      projectId: '356b7ae5-0f30-41f1-808f-cf5dfb51c0cc', // From app.json
    });
    const token = tokenData.data;

    // Save token locally
    await AsyncStorage.setItem(PUSH_TOKEN_KEY, token);

    // Configure Android channel
    if (Platform.OS === 'android') {
      await notif.setNotificationChannelAsync('safety-alerts', {
        name: 'Safety Alerts',
        importance: notif.AndroidImportance.MAX,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#EF4444',
        sound: 'default',
        enableVibrate: true,
        showBadge: true,
      });

      await notif.setNotificationChannelAsync('general', {
        name: 'General',
        importance: notif.AndroidImportance.DEFAULT,
        sound: 'default',
      });
    }

    console.log('[PushNotification] Initialized with token:', token);
    return token;
  } catch (error) {
    console.error('[PushNotification] Initialization error:', error);
    return null;
  }
}

/**
 * Save push token to Supabase for the user
 */
export async function savePushTokenToDatabase(userId: string, token: string): Promise<void> {
  try {
    // Upsert the push token
    const { error } = await supabase
      .from('push_tokens')
      .upsert({
        user_id: userId,
        token: token,
        platform: Platform.OS,
        updated_at: new Date().toISOString(),
      }, {
        onConflict: 'user_id',
      });

    if (error) {
      // If table doesn't exist, we'll use local notifications only
      console.log('[PushNotification] Could not save token to database:', error.message);
    } else {
      console.log('[PushNotification] Token saved to database');
    }
  } catch (error) {
    console.error('[PushNotification] Save token error:', error);
  }
}

/**
 * Send a local notification (for immediate display on this device)
 */
export async function sendLocalNotification(notification: PushNotificationData): Promise<void> {
  try {
    // Skip on Expo Go
    if (isExpoGo) {
      console.log(`[PushNotification] Skipped in Expo Go: ${notification.type}`);
      return;
    }
    
    const notif = await getNotificationsModule();
    if (!notif) return;
    
    const { title, body, data, type } = notification;

    // Determine channel and priority based on type
    const isUrgent = ['route_deviation', 'unusual_stop', 'tamper_alert', 'sos_triggered'].includes(type);

    await notif.scheduleNotificationAsync({
      content: {
        title,
        body,
        data: { ...data, type },
        sound: isUrgent ? 'default' : undefined,
        priority: isUrgent ? notif.AndroidNotificationPriority.HIGH : notif.AndroidNotificationPriority.DEFAULT,
        vibrate: isUrgent ? [0, 250, 250, 250] : undefined,
      },
      trigger: null, // Send immediately
    });

    console.log(`[PushNotification] Local notification sent: ${type}`);
  } catch (error) {
    // Silently handle errors in Expo Go
    if (!isExpoGo) {
      console.error('[PushNotification] Send local notification error:', error);
    }
  }
}

/**
 * Get notification content based on event type
 */
export function getNotificationContent(
  type: NotificationType,
  childName: string,
  language: 'en' | 'ro' = 'en',
  extraData?: Record<string, any>
): { title: string; body: string } {
  const content: Record<NotificationType, Record<'en' | 'ro', { title: string; body: string }>> = {
    route_deviation: {
      en: {
        title: '🚨 Route Deviation',
        body: `${childName} has deviated from their usual route${extraData?.address ? ` near ${extraData.address}` : ''}`,
      },
      ro: {
        title: '🚨 Deviere de traseu',
        body: `${childName} s-a abătut de la traseul obișnuit${extraData?.address ? ` lângă ${extraData.address}` : ''}`,
      },
    },
    unusual_stop: {
      en: {
        title: '⚠️ Unusual Stop',
        body: `${childName} has stopped at an unusual location for ${extraData?.duration || 'several'} minutes`,
      },
      ro: {
        title: '⚠️ Oprire neobișnuită',
        body: `${childName} s-a oprit într-o locație neobișnuită de ${extraData?.duration || 'câteva'} minute`,
      },
    },
    late_arrival: {
      en: {
        title: '⏰ Late Arrival',
        body: `${childName} hasn't arrived at the destination yet`,
      },
      ro: {
        title: '⏰ Întârziere',
        body: `${childName} nu a ajuns încă la destinație`,
      },
    },
    tamper_alert: {
      en: {
        title: `🔒 ${extraData?.eventType || 'Security Alert'}`,
        body: getTamperAlertBody(extraData?.eventType, childName, 'en'),
      },
      ro: {
        title: `🔒 ${getTamperAlertTitle(extraData?.eventType, 'ro')}`,
        body: getTamperAlertBody(extraData?.eventType, childName, 'ro'),
      },
    },
    sos_triggered: {
      en: {
        title: '🆘 SOS ALERT!',
        body: `${childName} triggered an emergency SOS!`,
      },
      ro: {
        title: '🆘 ALERTĂ SOS!',
        body: `${childName} a declanșat o alertă SOS de urgență!`,
      },
    },
    sos_resolved: {
      en: {
        title: '✅ SOS Resolved',
        body: `${childName}'s SOS alert has been resolved`,
      },
      ro: {
        title: '✅ SOS Rezolvat',
        body: `Alerta SOS a lui ${childName} a fost rezolvată`,
      },
    },
    arrival: {
      en: {
        title: '📍 Arrived',
        body: `${childName} has arrived at ${extraData?.placeName || 'destination'}`,
      },
      ro: {
        title: '📍 A ajuns',
        body: `${childName} a ajuns la ${extraData?.placeName || 'destinație'}`,
      },
    },
    departure: {
      en: {
        title: '🚶 Left',
        body: `${childName} has left ${extraData?.placeName || 'location'}`,
      },
      ro: {
        title: '🚶 A plecat',
        body: `${childName} a plecat de la ${extraData?.placeName || 'locație'}`,
      },
    },
    low_battery: {
      en: {
        title: '🔋 Low Battery',
        body: `${childName}'s phone battery is at ${extraData?.level || 'low'}%`,
      },
      ro: {
        title: '🔋 Baterie scăzută',
        body: `Telefonul lui ${childName} are ${extraData?.level || 'puțină'}% baterie`,
      },
    },
    child_offline: {
      en: {
        title: '📵 Device Offline',
        body: `${childName}'s device went offline`,
      },
      ro: {
        title: '📵 Dispozitiv offline',
        body: `Dispozitivul lui ${childName} s-a deconectat`,
      },
    },
  };

  return content[type]?.[language] || { title: 'Alert', body: 'New safety event' };
}

/**
 * Get tamper alert title based on event type
 */
function getTamperAlertTitle(eventType: string | undefined, language: 'en' | 'ro'): string {
  const titles: Record<string, Record<'en' | 'ro', string>> = {
    location_disabled: { en: 'Location Disabled', ro: 'Locație dezactivată' },
    gps_disabled: { en: 'GPS Turned Off', ro: 'GPS oprit' },
    internet_disabled: { en: 'Internet Disconnected', ro: 'Internet deconectat' },
    app_force_closed: { en: 'App Closed', ro: 'Aplicație închisă' },
    permission_revoked: { en: 'Permission Revoked', ro: 'Permisiune revocată' },
    background_restricted: { en: 'Background Restricted', ro: 'Fundal restricționat' },
    battery_saver_on: { en: 'Battery Saver On', ro: 'Economisire baterie' },
    airplane_mode: { en: 'Airplane Mode', ro: 'Mod avion' },
    mock_location: { en: 'Fake Location', ro: 'Locație falsă' },
  };

  return titles[eventType || '']?.[language] || (language === 'ro' ? 'Alertă securitate' : 'Security Alert');
}

/**
 * Get tamper alert body based on event type
 */
function getTamperAlertBody(eventType: string | undefined, childName: string, language: 'en' | 'ro'): string {
  const bodies: Record<string, Record<'en' | 'ro', string>> = {
    location_disabled: {
      en: `${childName} has disabled location services`,
      ro: `${childName} a dezactivat serviciile de locație`,
    },
    gps_disabled: {
      en: `${childName}'s GPS has been turned off`,
      ro: `GPS-ul lui ${childName} a fost oprit`,
    },
    internet_disabled: {
      en: `${childName}'s device lost internet connection`,
      ro: `Dispozitivul lui ${childName} a pierdut conexiunea`,
    },
    app_force_closed: {
      en: `Guardian AI was closed on ${childName}'s device`,
      ro: `Guardian AI a fost închis pe dispozitivul lui ${childName}`,
    },
    permission_revoked: {
      en: `${childName} revoked location permission`,
      ro: `${childName} a revocat permisiunea de locație`,
    },
    background_restricted: {
      en: `Background tracking disabled on ${childName}'s device`,
      ro: `Tracking-ul în fundal dezactivat pe dispozitivul lui ${childName}`,
    },
    battery_saver_on: {
      en: `Battery saver may affect tracking on ${childName}'s device`,
      ro: `Economisirea bateriei poate afecta tracking-ul lui ${childName}`,
    },
    airplane_mode: {
      en: `${childName}'s device is in airplane mode`,
      ro: `Dispozitivul lui ${childName} este în mod avion`,
    },
    mock_location: {
      en: `${childName} may be using a fake location app`,
      ro: `${childName} ar putea folosi o aplicație de locație falsă`,
    },
  };

  return bodies[eventType || '']?.[language] || 
    (language === 'ro' ? `Alertă de securitate pentru ${childName}` : `Security alert for ${childName}`);
}

/**
 * Send notification to all parents in a circle
 */
export async function notifyParentsInCircle(
  circleId: string,
  notification: Omit<PushNotificationData, 'circleId'>,
  excludeUserId?: string
): Promise<void> {
  try {
    // Get all parents in the circle
    const { data: parents } = await supabase
      .from('circle_members')
      .select('user_id')
      .eq('circle_id', circleId)
      .eq('role', 'parent');

    if (!parents || parents.length === 0) return;

    // Create in-app notifications for each parent
    for (const parent of parents) {
      if (parent.user_id === excludeUserId) continue;

      // Store notification in database
      await supabase.from('notifications').insert({
        user_id: parent.user_id,
        circle_id: circleId,
        type: notification.type,
        title: notification.title,
        body: notification.body,
        data: notification.data,
        is_read: false,
      });
    }

    console.log(`[PushNotification] Notified ${parents.length} parents in circle`);
  } catch (error) {
    console.error('[PushNotification] Notify parents error:', error);
  }
}

/**
 * Add notification listeners
 */
export function addNotificationListeners(
  onNotificationReceived?: (notification: any) => void,
  onNotificationResponse?: (response: any) => void
): () => void {
  // Skip on Expo Go
  if (isExpoGo) {
    return () => {}; // Return empty cleanup function
  }
  
  // Use async IIFE to set up listeners
  let cleanup = () => {};
  
  (async () => {
    const notif = await getNotificationsModule();
    if (!notif) return;
    
    try {
      const receivedSubscription = notif.addNotificationReceivedListener((notification: any) => {
        console.log('[PushNotification] Notification received:', notification.request.content.title);
        onNotificationReceived?.(notification);
      });

      const responseSubscription = notif.addNotificationResponseReceivedListener((response: any) => {
        console.log('[PushNotification] Notification response:', response.notification.request.content.data);
        onNotificationResponse?.(response);
      });

      cleanup = () => {
        receivedSubscription.remove();
        responseSubscription.remove();
      };
    } catch (error) {
      // Silently ignore
    }
  })();
  
  return () => cleanup();
}

/**
 * Get notification badge count
 */
export async function getBadgeCount(): Promise<number> {
  if (isExpoGo) return 0;
  try {
    const notif = await getNotificationsModule();
    if (!notif) return 0;
    return await notif.getBadgeCountAsync();
  } catch {
    return 0;
  }
}

/**
 * Set notification badge count
 */
export async function setBadgeCount(count: number): Promise<void> {
  if (isExpoGo) return;
  try {
    const notif = await getNotificationsModule();
    if (!notif) return;
    await notif.setBadgeCountAsync(count);
  } catch {
    // Ignore errors
  }
}

/**
 * Clear all notifications
 */
export async function clearAllNotifications(): Promise<void> {
  if (isExpoGo) return;
  try {
    const notif = await getNotificationsModule();
    if (!notif) return;
    await notif.dismissAllNotificationsAsync();
    await setBadgeCount(0);
  } catch {
    // Ignore errors
  }
}
