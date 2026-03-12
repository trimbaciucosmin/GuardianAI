# Guardian AI - Product Requirements Document

## Overview
A family safety app combining **Child Safety + Digital Safety**. The app helps parents monitor children's location, arrivals/departures, and screen time.

## Tech Stack
- **Frontend**: Expo/React Native with Expo Router
- **Backend**: Supabase (Auth, Database, Realtime)
- **State Management**: Zustand

---

## New 4-Tab Navigation Structure

| Tab | Screen | Purpose |
|-----|--------|---------|
| **Map** | `map.tsx` | Live family locations, safe zones, SOS, Going Home |
| **Activity** | `activity.tsx` | Daily safety report, arrivals/departures, safety score |
| **Phone** | `phone.tsx` | Screen time, app limits, blocked apps, sleep mode |
| **Family** | `family.tsx` | Members, safe places, settings, logout |

---

## Core Features

### 1. Map Screen
- Family member cards with status (Safe/Moving/Alert)
- Large SOS button (red, 80px)
- "I'm Going Home" button
- Safe places quick view (Home, School)
- Safety status banner

### 2. Activity Screen (Daily Safety Report)
- **Safety Score**: 0-100 with status (Safe/Attention/Risk)
  - Factors: School arrival, Home arrival, Route issues, SOS events, Screen time
- **Quick Stats**: Arrivals, Departures, Alerts counts
- **Timeline**: Chronological activity feed with icons

### 3. Phone Screen (Digital Safety)
- Child selector (switch between children)
- Total screen time with daily limit progress
- Sleep mode toggle (9 PM - 7 AM)
- App usage list with time limits
- Blocked apps management
- Quick actions: Pause Phone, Lock Now
- **Note**: Using mock/placeholder data for now

### 4. Family Screen
- Family card with invite button
- Members list with online status
- Safe places management
- Settings shortcuts
- Sign out button

---

## Design Principles
- Mobile-first, large touch targets (min 48px)
- Minimal text, icon-first UI
- Color-coded safety status:
  - 🟢 Green (#10B981) = Safe
  - 🟡 Yellow (#F59E0B) = Attention/Moving
  - 🔴 Red (#EF4444) = Alert/Emergency
- Dark theme (#0F172A background)

---

## Current Status (December 2025)

### ✅ Completed
- [x] New 4-tab navigation layout
- [x] Map screen with family cards, SOS, Going Home
- [x] Activity screen with safety score and timeline
- [x] Phone screen with screen time controls (mock data)
- [x] Family screen with real data integration
- [x] Logout functionality
- [x] Supabase auth integration
- [x] Database schema with fixed RLS policies

### 🔧 Recently Fixed (This Session)
- [x] **Auth/RLS Blocker**: Created new SQL schema (`/app/supabase_schema_v2_fixed.sql`) with non-recursive RLS policies
- [x] **Onboarding Flow**: Fixed profile update logic to work with auth trigger
- [x] **Login Flow**: Updated to check for complete profile (name != 'New User')
- [x] **Family Screen**: Now fetches real data from Supabase instead of mock data

### ⚠️ Requires User Action
**The user must apply the SQL fix to their Supabase project:**
1. Read `/app/AUTH_RLS_FIX_INSTRUCTIONS.md` for step-by-step guide
2. Run `/app/supabase_schema_v2_fixed.sql` in Supabase SQL Editor
3. Clean existing auth users and profiles before testing

### ⏳ Upcoming Tasks (After Auth Fix Verified)
1. **P0**: 3-Step Onboarding Flow - Explain app value proposition
2. **P1**: Real Map Component - Replace placeholder with react-native-maps
3. **P1**: Enhanced Family Screen - Show location, last seen, battery, online status
4. **P2**: Safe Arrival/Departure Events - Show in Activity timeline
5. **P2**: Clear Safety Score - Add labels (Safe/Attention/Risk) with explanation
6. **P2**: Rename "I'm Going Home" - Change to "Start Trip Home"

---

## Files Reference

### Main Screens
- `/app/frontend/app/(main)/_layout.tsx` - 4-tab navigation
- `/app/frontend/app/(main)/map.tsx` - Map + family cards
- `/app/frontend/app/(main)/activity.tsx` - Safety report
- `/app/frontend/app/(main)/phone.tsx` - Screen time controls
- `/app/frontend/app/(main)/family.tsx` - Family management (REAL DATA)

### Auth Screens
- `/app/frontend/app/(auth)/login.tsx`
- `/app/frontend/app/(auth)/signup.tsx`
- `/app/frontend/app/(auth)/onboarding.tsx`

### Database
- `/app/supabase_schema.sql` - Original schema (DEPRECATED - has recursive RLS)
- `/app/supabase_schema_v2_fixed.sql` - **FIXED schema to use**
- `/app/AUTH_RLS_FIX_INSTRUCTIONS.md` - Step-by-step fix instructions

### Circle Management
- `/app/frontend/app/circle/create.tsx` - Create family circle
- `/app/frontend/app/circle/join.tsx` - Join existing circle

---

## Key Technical Fixes

### RLS Recursion Fix
The original RLS policies caused infinite recursion because they queried `circle_members` while enforcing RLS on the same table:

```sql
-- BAD (causes recursion):
CREATE POLICY "View circle members" ON circle_members FOR SELECT USING (
  circle_id IN (SELECT circle_id FROM circle_members WHERE user_id = auth.uid())
);

-- GOOD (uses SECURITY DEFINER function to bypass RLS):
CREATE OR REPLACE FUNCTION get_user_circle_ids(p_user_id UUID)
RETURNS SETOF UUID
LANGUAGE SQL
SECURITY DEFINER
STABLE
AS $$
  SELECT circle_id FROM circle_members WHERE user_id = p_user_id;
$$;

CREATE POLICY "View circle members in my circles" ON circle_members
  FOR SELECT USING (circle_id IN (SELECT get_user_circle_ids(auth.uid())));
```

### Auth Trigger
A database trigger auto-creates a profile when a user signs up:

```sql
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();
```

The frontend checks if `profile.name !== 'New User'` to determine if onboarding is complete.

---

## Environment Variables
```
EXPO_PUBLIC_SUPABASE_URL=https://nozwlzlaojjmciwjtuek.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=sb_publishable_aCw_U7ByBNO6SH5voYN3Dg_ZAdnAKWc
```

---

## Future Tasks (Backlog)
- Push notifications setup
- Real screen time integration  
- Full "Going Home" route tracking with ETA
- AI-based anomaly detection
- APK build for real mobile testing

---

Last Updated: December 12, 2025
