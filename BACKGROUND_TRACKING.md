# Background Location Tracking - Implementation Guide

## Overview

Guardian AI implements real background location tracking using:
- **expo-location** - For GPS access and location updates
- **expo-task-manager** - For background task execution
- **expo-battery** - For battery monitoring

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    Location Service                          │
├─────────────────────────────────────────────────────────────┤
│  ┌──────────────────┐    ┌──────────────────┐               │
│  │  Foreground      │    │  Background      │               │
│  │  Tracking        │    │  Task            │               │
│  │                  │    │                  │               │
│  │  watchPosition   │    │  TaskManager     │               │
│  │  Async()         │    │  defineTask()    │               │
│  └────────┬─────────┘    └────────┬─────────┘               │
│           │                       │                          │
│           └───────────┬───────────┘                          │
│                       │                                      │
│              ┌────────▼────────┐                            │
│              │  handleLocation │                            │
│              │  Update()       │                            │
│              └────────┬────────┘                            │
│                       │                                      │
│           ┌───────────┼───────────┐                         │
│           │           │           │                         │
│  ┌────────▼────┐ ┌────▼────┐ ┌────▼────────┐               │
│  │ live_       │ │ location│ │ device_     │               │
│  │ locations   │ │ _history│ │ status      │               │
│  │ (current)   │ │ (trail) │ │ (battery)   │               │
│  └─────────────┘ └─────────┘ └─────────────┘               │
└─────────────────────────────────────────────────────────────┘
```

## Files Created

| File | Purpose |
|------|---------|
| `/lib/locationService.ts` | Core tracking service with foreground/background logic |
| `/hooks/useLocationTracking.ts` | React hook for using tracking in components |
| `/components/TrackingStatusCard.tsx` | UI component showing tracking status |

## Tracking Modes

### 1. Foreground Tracking
- **When**: App is open and visible
- **Interval**: Every 15 seconds OR 10 meters movement
- **Accuracy**: High
- **Works in**: Expo Go ✅

### 2. Background Tracking
- **When**: App is minimized or phone locked
- **Interval**: Every 30 seconds when moving, 2 minutes when stationary
- **Accuracy**: Balanced (better battery)
- **Works in**: See platform limitations below

### 3. SOS Mode
- **When**: Emergency triggered
- **Interval**: Every 5 seconds
- **Accuracy**: Highest
- **Distance**: 5 meters minimum

## Battery Optimization

The service adapts tracking frequency based on:

```typescript
TRACKING_CONFIG = {
  // Normal foreground
  FOREGROUND_INTERVAL_MS: 15000,      // 15 seconds
  FOREGROUND_DISTANCE_METERS: 10,     // 10 meters
  
  // Background (moving)
  BACKGROUND_INTERVAL_MOVING_MS: 30000,     // 30 seconds
  BACKGROUND_INTERVAL_STATIONARY_MS: 120000, // 2 minutes
  BACKGROUND_DISTANCE_METERS: 20,           // 20 meters
  
  // SOS (high frequency)
  SOS_INTERVAL_MS: 5000,              // 5 seconds
  SOS_DISTANCE_METERS: 5,             // 5 meters
  
  // Battery thresholds
  LOW_BATTERY_THRESHOLD: 20,          // Reduce frequency below 20%
  CRITICAL_BATTERY_THRESHOLD: 10,     // Minimum updates at 10%
}
```

### Smart Filtering
- Ignores updates < 10m from last saved position
- Always saves if battery level changed significantly
- Always saves in SOS mode regardless of distance

## Platform Support

### Expo Go (Development/Testing)

| Feature | iOS | Android |
|---------|-----|---------|
| Foreground tracking | ✅ Works | ✅ Works |
| Background tracking | ❌ Not supported | ⚠️ Limited (may stop after ~10 min) |
| Foreground service notification | N/A | ❌ Not visible |
| "Always" permission dialog | ❌ Not available | ✅ Works |

**Why iOS doesn't work in Expo Go:**
- iOS requires special entitlements (capabilities) for background location
- Expo Go app doesn't have these entitlements
- Only standalone/dev builds can have custom entitlements

**Android limitations in Expo Go:**
- Background task may be killed by battery optimization
- No persistent notification (required for reliable background)
- Works for short periods, may stop after ~10 minutes

### Development Build (EAS Build)

| Feature | iOS | Android |
|---------|-----|---------|
| Foreground tracking | ✅ Works | ✅ Works |
| Background tracking | ✅ Works | ✅ Works |
| Foreground service notification | N/A | ✅ Shows notification |
| "Always" permission dialog | ✅ Works | ✅ Works |
| Phone locked | ✅ Continues | ✅ Continues |
| App killed | ⚠️ Restarts on significant location change | ⚠️ Stops |

**To create a development build:**
```bash
# Install EAS CLI
npm install -g eas-cli

# Login to Expo
eas login

# Create development build for iOS
eas build --profile development --platform ios

# Create development build for Android
eas build --profile development --platform android

# OR run locally (requires Xcode/Android Studio)
npx expo run:ios
npx expo run:android
```

## Permissions Flow

### iOS Permission Flow
```
1. requestForegroundPermission()
   └── Shows "Allow While Using App" dialog
   
2. requestBackgroundPermission()
   └── Shows "Change to Always Allow" dialog
   └── User must go to Settings → Guardian AI → Location → Always
```

### Android Permission Flow
```
1. requestForegroundPermission()
   └── Shows "Allow only while using the app" / "Allow all the time" dialog
   
2. requestBackgroundPermission() (Android 10+)
   └── Shows "Allow all the time" dialog
   └── May redirect to Settings on some devices
```

## Database Updates

Every location update saves to:

### `live_locations` table (UPSERT)
- Current position of user
- Overwrites previous position
- One row per user per circle

```sql
{
  user_id, circle_id,
  latitude, longitude, accuracy,
  speed, heading, altitude,
  battery_level, is_moving,
  timestamp
}
```

### `location_history` table (INSERT)
- Breadcrumb trail
- Keeps all historical positions
- Used for route replay

```sql
{
  user_id, circle_id,
  latitude, longitude,
  timestamp
}
```

### `device_status` table (UPSERT)
- Battery level
- Last seen timestamp
- GPS enabled status

## Usage in Components

```typescript
import { useLocationTracking } from '../hooks/useLocationTracking';

function MapScreen() {
  const {
    isTracking,
    isForeground,
    lastLocation,
    lastBatteryLevel,
    error,
    statusText,
    startTracking,
    stopTracking,
  } = useLocationTracking(userId, circleId, {
    autoStart: true,
    enableBackground: true,
  });

  return (
    <View>
      <Text>Status: {statusText}</Text>
      {lastLocation && (
        <Text>
          {lastLocation.latitude}, {lastLocation.longitude}
        </Text>
      )}
      <Button onPress={startTracking} title="Start" />
      <Button onPress={stopTracking} title="Stop" />
    </View>
  );
}
```

## Tracking Status UI

The `TrackingStatusCard` component shows:
- Current tracking status (Active/Background/Paused)
- Last known coordinates
- Permission status
- Battery level
- Start/Stop controls
- Error messages

To show it in your screen:
```typescript
import TrackingStatusCard from '../components/TrackingStatusCard';

<TrackingStatusCard
  isTracking={isTracking}
  isForeground={isForeground}
  // ... other props from useLocationTracking
  onStartTracking={startTracking}
  onStopTracking={stopTracking}
  onRequestPermissions={requestPermissions}
/>
```

## Testing Checklist

### Expo Go Testing
- [ ] Foreground tracking updates while app is open
- [ ] Location saves to `live_locations` table
- [ ] Location saves to `location_history` table
- [ ] Battery level updates in `device_status`
- [ ] SOS mode increases update frequency
- [ ] Status UI shows correct state

### Development Build Testing
- [ ] All Expo Go tests pass
- [ ] Background tracking continues when app minimized
- [ ] Background tracking continues when phone locked
- [ ] Android shows foreground notification
- [ ] iOS shows location indicator in status bar
- [ ] Updates continue for 30+ minutes in background

## Troubleshooting

### "Background location not working"
1. Check if using Expo Go on iOS (won't work)
2. Check if "Always" permission granted
3. Check if battery optimization disabled for app (Android)
4. Check Supabase connection (locations may be tracking but not saving)

### "Location updates stop after a few minutes"
1. Android: Check battery optimization settings
2. iOS: Create a development build
3. Check if app was force-closed by user

### "Permission denied errors"
1. User denied permission - show UI to explain why it's needed
2. Permission revoked in Settings - prompt user to re-enable
3. iOS restricted - parental controls may block location

### "High battery drain"
1. Check if SOS mode accidentally enabled
2. Reduce foreground update frequency
3. Increase background distance threshold
