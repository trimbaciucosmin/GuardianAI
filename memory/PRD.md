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

## Phase 1 Status

### ✅ Completed
- [x] New 4-tab navigation layout
- [x] Map screen with family cards, SOS, Going Home
- [x] Activity screen with safety score and timeline
- [x] Phone screen with screen time controls (mock data)
- [x] Family screen with members and settings
- [x] Logout functionality
- [x] Supabase auth integration
- [x] Database schema

### 🔄 Needs Testing
- [ ] Full auth flow (signup → onboarding → main)
- [ ] Real Supabase data integration
- [ ] Circle creation/joining

### ⏳ Next Steps
1. Fix auth flow (foreign key constraint issue)
2. Connect screens to real Supabase data
3. Implement "Going Home" mode with route tracking
4. Safe arrival notifications

---

## Files Reference

### Main Screens
- `/app/frontend/app/(main)/_layout.tsx` - 4-tab navigation
- `/app/frontend/app/(main)/map.tsx` - Map + family cards
- `/app/frontend/app/(main)/activity.tsx` - Safety report
- `/app/frontend/app/(main)/phone.tsx` - Screen time controls
- `/app/frontend/app/(main)/family.tsx` - Family management

### Auth Screens
- `/app/frontend/app/(auth)/login.tsx`
- `/app/frontend/app/(auth)/signup.tsx`
- `/app/frontend/app/(auth)/onboarding.tsx`

### Database
- `/app/supabase_schema.sql` - Complete schema

---

## Known Issues
1. **Auth foreign key error**: When user is deleted from auth.users but profile exists, onboarding fails
2. **Expo Go caching**: Session persists even after user deletion

## Environment Variables
```
EXPO_PUBLIC_SUPABASE_URL=https://nozwlzlaojjmciwjtuek.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=sb_publishable_aCw_U7ByBNO6SH5voYN3Dg_ZAdnAKWc
```

---

Last Updated: December 2025
