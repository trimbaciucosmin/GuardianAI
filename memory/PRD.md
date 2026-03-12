# Guardian AI - Product Requirements Document

## Overview
A family safety app combining **Child Safety + Digital Safety**. The app helps parents monitor children's location, arrivals/departures, and screen time.

## Tech Stack
- **Frontend**: Expo/React Native with Expo Router
- **Backend**: Supabase (Auth, Database, Realtime)
- **State Management**: Zustand
- **Maps**: react-native-maps (native), styled fallback (web)

---

## Navigation Structure (4-Tab)

| Tab | Screen | Purpose |
|-----|--------|---------|
| **Map** | `map.tsx` | Live family locations, member markers, Start Trip Home, SOS |
| **Activity** | `activity.tsx` | Daily safety report, arrivals/departures, safety score with labels |
| **Phone** | `phone.tsx` | Screen time, app limits, blocked apps, sleep mode |
| **Family** | `family.tsx` | Members with details, safe places, settings, logout |

---

## Completed Features (December 2025)

### Part 1: Data Layer Stability ✅
- [x] Auth flow fixed with proper profile trigger
- [x] Non-recursive RLS policies implemented
- [x] Profile creation/update working
- [x] Family circle creation working
- [x] Real data integration in Family screen
- [x] Test data seed script created

### Part 2: Core Product Improvements ✅
- [x] Real map with react-native-maps (native) + styled fallback (web)
- [x] Renamed "I'm Going Home" to "Start Trip Home"
- [x] Enhanced Family screen with member details:
  - Name, role, avatar
  - Online/offline status indicator
  - Last seen time
  - Battery level
  - Current/last known location

### Part 3: Auto Check-In (Activity Timeline) ✅
- [x] Activity screen with timeline showing arrivals/departures
- [x] Event cards with icons, times, and "NEW" badges
- [x] Integration ready for geofence_events table

### Part 4: Safety Score Clarity ✅
- [x] Clear labels: Safe (green), Attention (yellow), Risk (red)
- [x] Score explanation message
- [x] Factors breakdown showing what affects the score

### Part 5: Onboarding Clarity ✅
- [x] 3-step value proposition slides:
  1. Real-Time Location
  2. Safe Arrival Alerts  
  3. Digital Safety
- [x] Pagination dots and Next/Skip buttons
- [x] Profile completion form after slides

### Part 6: Viral Growth - Family Invite ✅
- [x] Circle creation with invite code generation
- [x] Post-creation invite screen with:
  - Invite code display (tap to copy)
  - Share options (Share, Message, QR Code)
  - Warning: "Circle needs 2+ members for all features"
  - Primary CTA: "Invite Family Members"
- [x] Network effect encouragement

---

## Key Files

### Main Screens
- `/app/frontend/app/(main)/_layout.tsx` - 4-tab navigation
- `/app/frontend/app/(main)/map.tsx` - Map with real data + member selection
- `/app/frontend/app/(main)/activity.tsx` - Safety score + timeline
- `/app/frontend/app/(main)/family.tsx` - Members with details
- `/app/frontend/app/(main)/phone.tsx` - Screen time (mock data)

### Auth Screens
- `/app/frontend/app/(auth)/login.tsx`
- `/app/frontend/app/(auth)/signup.tsx`
- `/app/frontend/app/(auth)/onboarding.tsx` - 3-step + profile form

### Circle Management
- `/app/frontend/app/circle/create.tsx` - Create + invite flow
- `/app/frontend/app/circle/join.tsx` - Join existing circle

### Database
- `/app/supabase_schema_v2_fixed.sql` - FIXED schema with RLS
- `/app/supabase_seed_test_data.sql` - Test data functions

---

## SQL Files for User

### Required: `/app/supabase_schema_v2_fixed.sql`
Must be run in Supabase SQL Editor. Contains:
- DROP statements for old policies
- `get_user_circle_ids()` SECURITY DEFINER function
- `handle_new_user()` auth trigger
- Non-recursive RLS policies for all 12 tables

### Optional: `/app/supabase_seed_test_data.sql`
Helper functions to quickly seed test data:
- `seed_test_family(parent_id, child_id)` - Creates circle + members + places
- `seed_device_status(user_id, battery, is_online)`
- `seed_live_location(user_id, circle_id, lat, lng, battery)`
- `seed_geofence_events(user_id, circle_id)`

---

## User Flow

```
Login/Signup
    ↓
Onboarding (3 value slides → Profile form)
    ↓
Create Circle (or Join existing)
    ↓
Invite Screen (encourage adding family)
    ↓
Main App (Map tab)
```

---

## Design System

### Colors
- Background: #0F172A (dark slate)
- Card: #1E293B
- Primary: #6366F1 (indigo)
- Success/Safe: #10B981 (green)
- Warning/Attention: #F59E0B (amber)
- Error/Risk: #EF4444 (red)
- Text Primary: #FFFFFF
- Text Secondary: #94A3B8

### Safety Status Colors
- 🟢 Safe: #10B981
- 🟡 Attention: #F59E0B  
- 🔴 Risk: #EF4444

---

## Environment Variables
```
EXPO_PUBLIC_SUPABASE_URL=https://nozwlzlaojjmciwjtuek.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=sb_publishable_aCw_U7ByBNO6SH5voYN3Dg_ZAdnAKWc
```

---

## Remaining Work / Backlog

### P1 - Important
- [ ] Push notifications for arrivals/departures
- [ ] Real geofence detection (background location)
- [ ] QR code generation for invite flow

### P2 - Nice to Have
- [ ] Real screen time integration
- [ ] APK build for mobile testing
- [ ] Profile photos/avatars

### Future
- [ ] AI-based anomaly detection
- [ ] Route tracking during trips
- [ ] Emergency contact integration

---

Last Updated: December 12, 2025
