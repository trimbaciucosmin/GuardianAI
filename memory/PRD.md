# Guardian AI - Product Requirements Document

## Overview
A production-ready mobile app for family safety combining real-time location sharing, AI-based anomaly detection, SOS workflows, safe zone alerts, and community safety features with strong privacy focus.

## Tech Stack
- **Frontend**: Expo/React Native with Expo Router (file-based routing)
- **Backend**: Supabase (Auth, Postgres Database, Realtime subscriptions)
- **State Management**: Zustand
- **Maps**: react-native-maps (mobile only)
- **Location**: expo-location, expo-task-manager for background tracking

## Phase 1 MVP Status

### ✅ COMPLETED

#### Core Architecture
- [x] Complete Expo project setup with proper configuration
- [x] File-based routing structure with 29+ screens
- [x] Supabase client with web-compatible storage adapter
- [x] Zustand stores for all app state (Auth, Circle, Location, Alerts, SOS, Trips, Device, Realtime)

#### Authentication
- [x] Login screen with email/password
- [x] Signup screen with name/role selection
- [x] Onboarding flow
- [x] Session persistence with SecureStore

#### Family Circles
- [x] Create circle screen
- [x] Join circle screen (invite code)
- [x] Circle selector on map and family screens
- [x] Member listing with profiles

#### Real-time Location Tracking
- [x] Background location tracking service (`lib/locationService.ts`)
- [x] `useLocationTracking` hook for components
- [x] Location permission handling (foreground & background)
- [x] Battery level monitoring
- [x] TrackingStatusCard component

#### Supabase Realtime Integration (COMPLETED Dec 2025)
- [x] `realtimeService.ts` - Core realtime subscription logic
- [x] `useRealtimeSubscription` hook with specialized hooks:
  - `useRealtimeLocations` - Location updates
  - `useRealtimeSOS` - SOS events
  - `useRealtimeAlerts` - Alert notifications
  - `useRealtimeTrips` - Trip status
- [x] **Map Screen Integration**: Live location updates, member position updates, realtime status indicator
- [x] **Alerts Screen Integration**: Real-time alert display, new alert animations, SOS & geofence event handling
- [x] **Family Screen Integration**: Live member status, online/offline indicators, battery levels, trip indicators
- [x] **Global SOS Overlay**: `SOSAlertOverlay` component visible across all screens
- [x] `useRealtimeStore` for global realtime connection state

#### UI Features
- [x] Member cards with online/offline status
- [x] Last location update timestamps
- [x] Battery level indicators with color coding
- [x] Moving indicator badges
- [x] Active SOS alert banners
- [x] Active trip indicators
- [x] Realtime connection status indicators

#### Places/Geofencing (Scaffolded)
- [x] Place creation screen structure
- [x] Place detail screen structure
- [x] Place icons and colors by type

#### SOS System
- [x] SOS trigger button on map
- [x] Active SOS screen (`/sos/active.tsx`)
- [x] SOSAlertOverlay for family SOS notifications
- [x] SOS event realtime subscription

#### Monitored Trips
- [x] "I'm Going Home" button
- [x] Active trip screen structure
- [x] Trip status realtime updates

### 🔄 IN PROGRESS / SCAFFOLDED

#### Needs Implementation
- [ ] Actual Google Maps rendering (currently placeholder on web)
- [ ] Place detail screen functionality
- [ ] Circle detail screen functionality
- [ ] Full trip monitoring with ETA calculation
- [ ] Route deviation detection
- [ ] Push notification configuration

### ⏳ UPCOMING (Phase 1 Completion)
- Implement detail screens (`circle/[id].tsx`, `place/[id].tsx`)
- Complete monitored trip logic with ETA and alerts
- Connect rule-based anomaly detection (`utils/anomaly.ts`)
- Push notification setup

### 🔮 FUTURE (Phase 2-3)
- AI anomaly detection (advanced, LLM-based)
- Route replay on map
- Community safety layer
- Teen privacy mode
- Subscription architecture
- Admin panel

## Database Schema
Full schema in `/app/supabase_schema.sql`:
- `profiles` - User profiles
- `family_circles` - Family groups
- `circle_members` - User-circle relationships
- `places` - Geofenced locations
- `live_locations` - Current positions
- `location_history` - Position log
- `sos_events` - Emergency alerts
- `monitored_trips` - Active trips
- `anomaly_alerts` - Safety notifications
- `geofence_events` - Arrival/departure log
- `device_status` - Device info
- `notifications` - User notifications

## Environment Variables Required
```
EXPO_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
```

## Key Files Reference
- `/app/frontend/lib/realtimeService.ts` - Supabase realtime logic
- `/app/frontend/hooks/useRealtimeSubscription.ts` - Realtime React hooks
- `/app/frontend/lib/locationService.ts` - Background location
- `/app/frontend/hooks/useLocationTracking.ts` - Location hook
- `/app/frontend/components/SOSAlertOverlay.tsx` - Global SOS modal
- `/app/frontend/lib/store.ts` - All Zustand stores
- `/app/supabase_schema.sql` - Complete DB schema

## Testing Notes
- Web preview shows placeholder map (react-native-maps limitation)
- Background location requires development build for iOS testing
- Full testing requires Supabase credentials
- UI can be tested without credentials (will show "not configured" states)

---
Last Updated: December 2025
