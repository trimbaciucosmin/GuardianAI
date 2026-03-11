# Guardian AI - Family Safety App

A production-ready mobile app for parents and children that combines real-time location sharing, AI-based anomaly detection, SOS emergency workflows, safe zone alerts, and strong privacy controls.

## Features

### Phase 1 MVP (Current)
- **Authentication**: Email/password login with Supabase Auth
- **Family Circles**: Create/join family groups with invite codes
- **Live Map**: Real-time location tracking with family member markers
- **Places/Geofencing**: Create safe zones (Home, School, Work, Custom)
- **Alerts**: In-app notification feed with filtering
- **Battery/Device Status**: Monitor family members' device health
- **Location History**: Track movement patterns
- **Simple SOS**: One-tap emergency alert with countdown
- **Monitored Trips**: "I'm Going Home" feature with ETA tracking

### Phase 2 (Planned)
- Route replay on map
- Advanced AI anomaly detection
- Community safety layer
- Push notifications

### Phase 3 (Planned)
- Teen privacy mode
- Subscription management
- Admin moderation tools

## Tech Stack

- **Frontend**: Expo / React Native
- **Backend**: Supabase (Auth, Database, Realtime, Storage)
- **Maps**: react-native-maps with Google Maps (OpenStreetMap fallback)
- **State**: Zustand
- **Anomaly Detection**: Rule-based (no LLM required)

## Setup Instructions

### 1. Prerequisites

- Node.js 18+ 
- Yarn
- Expo CLI (`npm install -g expo-cli`)
- Supabase account (free tier works)

### 2. Supabase Setup

1. Create a new project at [https://supabase.com](https://supabase.com)
2. Go to Project Settings > API to get your URL and anon key
3. Run the SQL schema below in SQL Editor

### 3. Environment Variables

Update `/app/frontend/.env`:

```env
EXPO_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
```

### 4. Run the App

```bash
cd frontend
yarn install
yarn start
```

## Supabase SQL Schema

Run this in your Supabase SQL Editor:

```sql
-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Profiles table (extends auth.users)
CREATE TABLE profiles (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE NOT NULL,
  name TEXT NOT NULL,
  avatar_url TEXT,
  phone TEXT,
  role TEXT CHECK (role IN ('parent', 'child', 'teen')) DEFAULT 'parent',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Family circles
CREATE TABLE family_circles (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  invite_code TEXT UNIQUE NOT NULL,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Circle members
CREATE TABLE circle_members (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  circle_id UUID REFERENCES family_circles(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role TEXT CHECK (role IN ('parent', 'child', 'teen')) DEFAULT 'child',
  joined_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(circle_id, user_id)
);

-- Places (geofences)
CREATE TABLE places (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  circle_id UUID REFERENCES family_circles(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  latitude DOUBLE PRECISION NOT NULL,
  longitude DOUBLE PRECISION NOT NULL,
  radius INTEGER DEFAULT 100,
  address TEXT,
  type TEXT CHECK (type IN ('home', 'school', 'work', 'custom')) DEFAULT 'custom',
  icon TEXT,
  color TEXT,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Live locations (current position)
CREATE TABLE live_locations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  circle_id UUID REFERENCES family_circles(id) ON DELETE CASCADE NOT NULL,
  latitude DOUBLE PRECISION NOT NULL,
  longitude DOUBLE PRECISION NOT NULL,
  accuracy DOUBLE PRECISION,
  altitude DOUBLE PRECISION,
  speed DOUBLE PRECISION,
  heading DOUBLE PRECISION,
  battery_level INTEGER,
  is_moving BOOLEAN DEFAULT FALSE,
  is_charging BOOLEAN DEFAULT FALSE,
  timestamp TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, circle_id)
);

-- Location history
CREATE TABLE location_history (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  circle_id UUID REFERENCES family_circles(id) ON DELETE CASCADE NOT NULL,
  latitude DOUBLE PRECISION NOT NULL,
  longitude DOUBLE PRECISION NOT NULL,
  timestamp TIMESTAMPTZ DEFAULT NOW()
);

-- Create index for faster history queries
CREATE INDEX idx_location_history_user_time ON location_history(user_id, timestamp DESC);

-- Geofence events
CREATE TABLE geofence_events (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  place_id UUID REFERENCES places(id) ON DELETE CASCADE NOT NULL,
  event_type TEXT CHECK (event_type IN ('arrive', 'depart')) NOT NULL,
  timestamp TIMESTAMPTZ DEFAULT NOW()
);

-- SOS events
CREATE TABLE sos_events (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  circle_id UUID REFERENCES family_circles(id) ON DELETE CASCADE NOT NULL,
  status TEXT CHECK (status IN ('pending', 'active', 'cancelled', 'resolved')) DEFAULT 'pending',
  latitude DOUBLE PRECISION NOT NULL,
  longitude DOUBLE PRECISION NOT NULL,
  message TEXT,
  started_at TIMESTAMPTZ DEFAULT NOW(),
  ended_at TIMESTAMPTZ
);

-- Monitored trips
CREATE TABLE monitored_trips (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  circle_id UUID REFERENCES family_circles(id) ON DELETE CASCADE NOT NULL,
  destination_place_id UUID REFERENCES places(id) ON DELETE SET NULL,
  destination_name TEXT,
  destination_latitude DOUBLE PRECISION NOT NULL,
  destination_longitude DOUBLE PRECISION NOT NULL,
  eta_minutes INTEGER NOT NULL,
  status TEXT CHECK (status IN ('active', 'completed', 'cancelled', 'delayed')) DEFAULT 'active',
  started_at TIMESTAMPTZ DEFAULT NOW(),
  ended_at TIMESTAMPTZ
);

-- Anomaly alerts
CREATE TABLE anomaly_alerts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  circle_id UUID REFERENCES family_circles(id) ON DELETE CASCADE NOT NULL,
  alert_type TEXT CHECK (alert_type IN (
    'route_deviation', 'unexpected_stop', 'eta_exceeded', 
    'phone_offline', 'low_battery', 'left_safe_zone', 
    'unusual_location', 'sos_triggered'
  )) NOT NULL,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  severity TEXT CHECK (severity IN ('low', 'medium', 'high', 'critical')) DEFAULT 'medium',
  data JSONB,
  is_read BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Device status
CREATE TABLE device_status (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE NOT NULL,
  battery_level INTEGER,
  is_charging BOOLEAN DEFAULT FALSE,
  gps_enabled BOOLEAN DEFAULT TRUE,
  airplane_mode BOOLEAN DEFAULT FALSE,
  network_type TEXT,
  last_seen TIMESTAMPTZ DEFAULT NOW()
);

-- Notifications
CREATE TABLE notifications (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  type TEXT CHECK (type IN (
    'arrival', 'departure', 'battery', 'sos', 
    'trip', 'anomaly', 'device', 'circle', 'general'
  )) NOT NULL,
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  data JSONB,
  is_read BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable Row Level Security
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE family_circles ENABLE ROW LEVEL SECURITY;
ALTER TABLE circle_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE places ENABLE ROW LEVEL SECURITY;
ALTER TABLE live_locations ENABLE ROW LEVEL SECURITY;
ALTER TABLE location_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE geofence_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE sos_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE monitored_trips ENABLE ROW LEVEL SECURITY;
ALTER TABLE anomaly_alerts ENABLE ROW LEVEL SECURITY;
ALTER TABLE device_status ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

-- RLS Policies

-- Profiles: Users can read all profiles in their circles, edit own
CREATE POLICY "Users can view own profile" ON profiles FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can update own profile" ON profiles FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own profile" ON profiles FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Family circles: Members can view their circles
CREATE POLICY "Members can view their circles" ON family_circles FOR SELECT USING (
  id IN (SELECT circle_id FROM circle_members WHERE user_id = auth.uid())
);
CREATE POLICY "Users can create circles" ON family_circles FOR INSERT WITH CHECK (auth.uid() = created_by);

-- Circle members: Members can view members in their circles
CREATE POLICY "View circle members" ON circle_members FOR SELECT USING (
  circle_id IN (SELECT circle_id FROM circle_members WHERE user_id = auth.uid())
);
CREATE POLICY "Join circles" ON circle_members FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Places: Circle members can manage places
CREATE POLICY "View places in circles" ON places FOR SELECT USING (
  circle_id IN (SELECT circle_id FROM circle_members WHERE user_id = auth.uid())
);
CREATE POLICY "Create places" ON places FOR INSERT WITH CHECK (
  circle_id IN (SELECT circle_id FROM circle_members WHERE user_id = auth.uid())
);

-- Live locations: Circle members can view/update locations
CREATE POLICY "View live locations" ON live_locations FOR SELECT USING (
  circle_id IN (SELECT circle_id FROM circle_members WHERE user_id = auth.uid())
);
CREATE POLICY "Update own location" ON live_locations FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Upsert own location" ON live_locations FOR UPDATE USING (auth.uid() = user_id);

-- Location history: Circle members can view history
CREATE POLICY "View location history" ON location_history FOR SELECT USING (
  circle_id IN (SELECT circle_id FROM circle_members WHERE user_id = auth.uid())
);
CREATE POLICY "Insert own history" ON location_history FOR INSERT WITH CHECK (auth.uid() = user_id);

-- SOS events: Circle members can view, user can create
CREATE POLICY "View SOS in circle" ON sos_events FOR SELECT USING (
  circle_id IN (SELECT circle_id FROM circle_members WHERE user_id = auth.uid())
);
CREATE POLICY "Create SOS" ON sos_events FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Update own SOS" ON sos_events FOR UPDATE USING (auth.uid() = user_id);

-- Monitored trips: Similar pattern
CREATE POLICY "View trips in circle" ON monitored_trips FOR SELECT USING (
  circle_id IN (SELECT circle_id FROM circle_members WHERE user_id = auth.uid())
);
CREATE POLICY "Create trip" ON monitored_trips FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Update own trip" ON monitored_trips FOR UPDATE USING (auth.uid() = user_id);

-- Alerts: Circle members can view all alerts in their circles
CREATE POLICY "View alerts" ON anomaly_alerts FOR SELECT USING (
  circle_id IN (SELECT circle_id FROM circle_members WHERE user_id = auth.uid())
);
CREATE POLICY "Create alerts" ON anomaly_alerts FOR INSERT WITH CHECK (
  circle_id IN (SELECT circle_id FROM circle_members WHERE user_id = auth.uid())
);
CREATE POLICY "Update alerts" ON anomaly_alerts FOR UPDATE USING (
  circle_id IN (SELECT circle_id FROM circle_members WHERE user_id = auth.uid())
);

-- Notifications: Users can only see their own
CREATE POLICY "View own notifications" ON notifications FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Create notifications" ON notifications FOR INSERT WITH CHECK (true);
CREATE POLICY "Update own notifications" ON notifications FOR UPDATE USING (auth.uid() = user_id);

-- Device status
CREATE POLICY "View device status" ON device_status FOR SELECT USING (
  user_id IN (
    SELECT cm2.user_id FROM circle_members cm1 
    JOIN circle_members cm2 ON cm1.circle_id = cm2.circle_id 
    WHERE cm1.user_id = auth.uid()
  )
);
CREATE POLICY "Update own device status" ON device_status FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Upsert own device status" ON device_status FOR UPDATE USING (auth.uid() = user_id);

-- Geofence events
CREATE POLICY "View geofence events" ON geofence_events FOR SELECT USING (
  place_id IN (
    SELECT p.id FROM places p 
    JOIN circle_members cm ON p.circle_id = cm.circle_id 
    WHERE cm.user_id = auth.uid()
  )
);
CREATE POLICY "Create geofence events" ON geofence_events FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Enable Realtime for live locations
ALTER PUBLICATION supabase_realtime ADD TABLE live_locations;
ALTER PUBLICATION supabase_realtime ADD TABLE sos_events;
ALTER PUBLICATION supabase_realtime ADD TABLE anomaly_alerts;
```

## Project Structure

```
/app
├── frontend/
│   ├── app/                    # Expo Router pages
│   │   ├── (auth)/            # Auth screens
│   │   │   ├── login.tsx
│   │   │   ├── signup.tsx
│   │   │   └── onboarding.tsx
│   │   ├── (main)/            # Main tab screens
│   │   │   ├── map.tsx
│   │   │   ├── family.tsx
│   │   │   └── alerts.tsx
│   │   ├── circle/            # Circle management
│   │   ├── place/             # Place management
│   │   ├── sos/               # SOS screen
│   │   ├── trip/              # Monitored trip
│   │   └── settings/          # Settings
│   ├── lib/
│   │   ├── supabase.ts        # Supabase client
│   │   └── store.ts           # Zustand stores
│   ├── types/
│   │   └── index.ts           # TypeScript types
│   ├── utils/
│   │   ├── helpers.ts         # Utility functions
│   │   └── anomaly.ts         # Rule-based anomaly detection
│   └── components/            # Reusable components
└── README.md
```

## Rule-Based Anomaly Detection

The app includes rule-based anomaly detection that runs locally:

- **Unexpected Stop**: Detects when user is stationary in unfamiliar location for 15+ minutes
- **Phone Offline**: Alerts when no location update received for 10+ minutes
- **Low Battery**: Warns when battery drops below 15%
- **ETA Exceeded**: Alerts when monitored trip takes 50% longer than expected
- **Left Safe Zone**: Notifies when user leaves a defined place

## Test Accounts

After setting up Supabase and running the schema, create test accounts:

1. Parent account: parent@test.com / password123
2. Child account: child@test.com / password123

## Roadmap

### Phase 2
- [ ] Route replay on map
- [ ] LLM-based anomaly detection
- [ ] Community safety layer
- [ ] Push notifications (Expo)

### Phase 3
- [ ] Teen privacy mode
- [ ] Subscription tiers
- [ ] Admin panel
- [ ] Incident reports

## License

MIT
