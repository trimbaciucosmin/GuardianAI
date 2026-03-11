-- =============================================
-- GUARDIAN AI - SUPABASE DATABASE SCHEMA
-- =============================================
-- Run this in Supabase SQL Editor
-- https://supabase.com/dashboard/project/YOUR_PROJECT/sql

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =============================================
-- TABLE: profiles
-- Extends Supabase auth.users with app-specific data
-- =============================================
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

-- =============================================
-- TABLE: family_circles
-- Family groups that share location
-- =============================================
CREATE TABLE family_circles (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  invite_code TEXT UNIQUE NOT NULL,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================
-- TABLE: circle_members
-- Junction table: users <-> circles
-- =============================================
CREATE TABLE circle_members (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  circle_id UUID REFERENCES family_circles(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role TEXT CHECK (role IN ('parent', 'child', 'teen')) DEFAULT 'child',
  joined_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(circle_id, user_id)
);

-- =============================================
-- TABLE: places
-- Geofence locations (Home, School, Work, etc.)
-- =============================================
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

-- =============================================
-- TABLE: live_locations
-- Current real-time position of each user (upserted)
-- =============================================
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

-- =============================================
-- TABLE: location_history
-- Historical location points for route replay
-- =============================================
CREATE TABLE location_history (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  circle_id UUID REFERENCES family_circles(id) ON DELETE CASCADE NOT NULL,
  latitude DOUBLE PRECISION NOT NULL,
  longitude DOUBLE PRECISION NOT NULL,
  timestamp TIMESTAMPTZ DEFAULT NOW()
);

-- Index for faster history queries
CREATE INDEX idx_location_history_user_time ON location_history(user_id, timestamp DESC);

-- =============================================
-- TABLE: geofence_events
-- Arrive/depart events for places
-- =============================================
CREATE TABLE geofence_events (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  place_id UUID REFERENCES places(id) ON DELETE CASCADE NOT NULL,
  event_type TEXT CHECK (event_type IN ('arrive', 'depart')) NOT NULL,
  timestamp TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================
-- TABLE: sos_events
-- Emergency SOS alerts
-- =============================================
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

-- =============================================
-- TABLE: monitored_trips
-- "I'm Going Home" tracked trips
-- =============================================
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

-- =============================================
-- TABLE: anomaly_alerts
-- System-generated safety alerts
-- =============================================
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

-- =============================================
-- TABLE: device_status
-- Device health monitoring
-- =============================================
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

-- =============================================
-- TABLE: notifications
-- In-app notifications
-- =============================================
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

-- =============================================
-- ROW LEVEL SECURITY (RLS)
-- =============================================

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

-- =============================================
-- RLS POLICIES
-- =============================================

-- Profiles
CREATE POLICY "Users can view own profile" ON profiles FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can update own profile" ON profiles FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own profile" ON profiles FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Family circles
CREATE POLICY "Members can view their circles" ON family_circles FOR SELECT USING (
  id IN (SELECT circle_id FROM circle_members WHERE user_id = auth.uid())
);
CREATE POLICY "Users can create circles" ON family_circles FOR INSERT WITH CHECK (auth.uid() = created_by);

-- Circle members
CREATE POLICY "View circle members" ON circle_members FOR SELECT USING (
  circle_id IN (SELECT circle_id FROM circle_members WHERE user_id = auth.uid())
);
CREATE POLICY "Join circles" ON circle_members FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Places
CREATE POLICY "View places in circles" ON places FOR SELECT USING (
  circle_id IN (SELECT circle_id FROM circle_members WHERE user_id = auth.uid())
);
CREATE POLICY "Create places" ON places FOR INSERT WITH CHECK (
  circle_id IN (SELECT circle_id FROM circle_members WHERE user_id = auth.uid())
);

-- Live locations
CREATE POLICY "View live locations" ON live_locations FOR SELECT USING (
  circle_id IN (SELECT circle_id FROM circle_members WHERE user_id = auth.uid())
);
CREATE POLICY "Update own location" ON live_locations FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Upsert own location" ON live_locations FOR UPDATE USING (auth.uid() = user_id);

-- Location history
CREATE POLICY "View location history" ON location_history FOR SELECT USING (
  circle_id IN (SELECT circle_id FROM circle_members WHERE user_id = auth.uid())
);
CREATE POLICY "Insert own history" ON location_history FOR INSERT WITH CHECK (auth.uid() = user_id);

-- SOS events
CREATE POLICY "View SOS in circle" ON sos_events FOR SELECT USING (
  circle_id IN (SELECT circle_id FROM circle_members WHERE user_id = auth.uid())
);
CREATE POLICY "Create SOS" ON sos_events FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Update own SOS" ON sos_events FOR UPDATE USING (auth.uid() = user_id);

-- Monitored trips
CREATE POLICY "View trips in circle" ON monitored_trips FOR SELECT USING (
  circle_id IN (SELECT circle_id FROM circle_members WHERE user_id = auth.uid())
);
CREATE POLICY "Create trip" ON monitored_trips FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Update own trip" ON monitored_trips FOR UPDATE USING (auth.uid() = user_id);

-- Alerts
CREATE POLICY "View alerts" ON anomaly_alerts FOR SELECT USING (
  circle_id IN (SELECT circle_id FROM circle_members WHERE user_id = auth.uid())
);
CREATE POLICY "Create alerts" ON anomaly_alerts FOR INSERT WITH CHECK (
  circle_id IN (SELECT circle_id FROM circle_members WHERE user_id = auth.uid())
);
CREATE POLICY "Update alerts" ON anomaly_alerts FOR UPDATE USING (
  circle_id IN (SELECT circle_id FROM circle_members WHERE user_id = auth.uid())
);

-- Notifications
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

-- =============================================
-- REALTIME SUBSCRIPTIONS
-- =============================================
ALTER PUBLICATION supabase_realtime ADD TABLE live_locations;
ALTER PUBLICATION supabase_realtime ADD TABLE sos_events;
ALTER PUBLICATION supabase_realtime ADD TABLE anomaly_alerts;
