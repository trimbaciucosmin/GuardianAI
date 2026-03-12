-- =============================================
-- GUARDIAN AI - SUPABASE DATABASE SCHEMA v2 (FIXED)
-- =============================================
-- This is a CLEAN, WORKING schema with non-recursive RLS policies
-- 
-- INSTRUCTIONS:
-- 1. Go to Supabase Dashboard > SQL Editor
-- 2. First run the DROP section to clean up old policies
-- 3. Then run the CREATE section
-- =============================================

-- =============================================
-- STEP 1: DROP ALL EXISTING POLICIES (Run this first)
-- =============================================

-- Drop all policies from all tables
DROP POLICY IF EXISTS "Users can view own profile" ON profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON profiles;
DROP POLICY IF EXISTS "Users can insert own profile" ON profiles;
DROP POLICY IF EXISTS "Service role can manage profiles" ON profiles;
DROP POLICY IF EXISTS "Allow profile creation" ON profiles;
DROP POLICY IF EXISTS "Allow own profile access" ON profiles;

DROP POLICY IF EXISTS "Members can view their circles" ON family_circles;
DROP POLICY IF EXISTS "Users can create circles" ON family_circles;
DROP POLICY IF EXISTS "View own created circles" ON family_circles;
DROP POLICY IF EXISTS "View circles you belong to" ON family_circles;

DROP POLICY IF EXISTS "View circle members" ON circle_members;
DROP POLICY IF EXISTS "Join circles" ON circle_members;
DROP POLICY IF EXISTS "View own memberships" ON circle_members;
DROP POLICY IF EXISTS "Insert own membership" ON circle_members;
DROP POLICY IF EXISTS "Delete own membership" ON circle_members;

DROP POLICY IF EXISTS "View places in circles" ON places;
DROP POLICY IF EXISTS "Create places" ON places;
DROP POLICY IF EXISTS "Update places" ON places;
DROP POLICY IF EXISTS "Delete places" ON places;

DROP POLICY IF EXISTS "View live locations" ON live_locations;
DROP POLICY IF EXISTS "Update own location" ON live_locations;
DROP POLICY IF EXISTS "Upsert own location" ON live_locations;
DROP POLICY IF EXISTS "Insert own location" ON live_locations;

DROP POLICY IF EXISTS "View location history" ON location_history;
DROP POLICY IF EXISTS "Insert own history" ON location_history;

DROP POLICY IF EXISTS "View geofence events" ON geofence_events;
DROP POLICY IF EXISTS "Create geofence events" ON geofence_events;

DROP POLICY IF EXISTS "View SOS in circle" ON sos_events;
DROP POLICY IF EXISTS "Create SOS" ON sos_events;
DROP POLICY IF EXISTS "Update own SOS" ON sos_events;

DROP POLICY IF EXISTS "View trips in circle" ON monitored_trips;
DROP POLICY IF EXISTS "Create trip" ON monitored_trips;
DROP POLICY IF EXISTS "Update own trip" ON monitored_trips;

DROP POLICY IF EXISTS "View alerts" ON anomaly_alerts;
DROP POLICY IF EXISTS "Create alerts" ON anomaly_alerts;
DROP POLICY IF EXISTS "Update alerts" ON anomaly_alerts;

DROP POLICY IF EXISTS "View device status" ON device_status;
DROP POLICY IF EXISTS "Update own device status" ON device_status;
DROP POLICY IF EXISTS "Upsert own device status" ON device_status;
DROP POLICY IF EXISTS "Insert own device" ON device_status;
DROP POLICY IF EXISTS "Update own device" ON device_status;

DROP POLICY IF EXISTS "View own notifications" ON notifications;
DROP POLICY IF EXISTS "Create notifications" ON notifications;
DROP POLICY IF EXISTS "Update own notifications" ON notifications;

-- Drop helper functions if they exist
DROP FUNCTION IF EXISTS get_user_circle_ids(UUID);
DROP FUNCTION IF EXISTS get_circle_members(UUID);
DROP FUNCTION IF EXISTS is_circle_member(UUID, UUID);

-- Drop old trigger if exists
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP FUNCTION IF EXISTS handle_new_user();

-- =============================================
-- STEP 2: CREATE HELPER FUNCTION (SECURITY DEFINER)
-- This bypasses RLS to check circle membership safely
-- =============================================

CREATE OR REPLACE FUNCTION get_user_circle_ids(p_user_id UUID)
RETURNS SETOF UUID
LANGUAGE SQL
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT circle_id FROM circle_members WHERE user_id = p_user_id;
$$;

-- =============================================
-- STEP 3: CREATE PROFILE TRIGGER
-- Auto-creates a minimal profile when user signs up
-- =============================================

CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER
LANGUAGE PLPGSQL
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO profiles (user_id, name, role)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'name', 'New User'),
    'parent'
  );
  RETURN NEW;
EXCEPTION
  WHEN unique_violation THEN
    -- Profile already exists, ignore
    RETURN NEW;
  WHEN OTHERS THEN
    -- Log but don't fail auth
    RAISE LOG 'Failed to create profile for user %: %', NEW.id, SQLERRM;
    RETURN NEW;
END;
$$;

-- Create the trigger
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- =============================================
-- STEP 4: CREATE SIMPLE, NON-RECURSIVE RLS POLICIES
-- =============================================

-- PROFILES: Users can only access their own profile
CREATE POLICY "Allow own profile access" ON profiles
  FOR ALL USING (auth.uid() = user_id);

-- FAMILY CIRCLES: 
-- View: circles you created OR circles you're a member of
CREATE POLICY "View own created circles" ON family_circles
  FOR SELECT USING (created_by = auth.uid());

CREATE POLICY "View circles you belong to" ON family_circles
  FOR SELECT USING (id IN (SELECT get_user_circle_ids(auth.uid())));

CREATE POLICY "Users can create circles" ON family_circles
  FOR INSERT WITH CHECK (auth.uid() = created_by);

-- CIRCLE MEMBERS:
-- This is the CRITICAL fix - use SECURITY DEFINER function to avoid recursion
CREATE POLICY "View own memberships" ON circle_members
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "View other members in my circles" ON circle_members
  FOR SELECT USING (circle_id IN (SELECT get_user_circle_ids(auth.uid())));

CREATE POLICY "Insert own membership" ON circle_members
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Delete own membership" ON circle_members
  FOR DELETE USING (auth.uid() = user_id);

-- PLACES: Access places in your circles
CREATE POLICY "View places in circles" ON places
  FOR SELECT USING (circle_id IN (SELECT get_user_circle_ids(auth.uid())));

CREATE POLICY "Create places" ON places
  FOR INSERT WITH CHECK (circle_id IN (SELECT get_user_circle_ids(auth.uid())));

CREATE POLICY "Update places" ON places
  FOR UPDATE USING (circle_id IN (SELECT get_user_circle_ids(auth.uid())));

CREATE POLICY "Delete places" ON places
  FOR DELETE USING (circle_id IN (SELECT get_user_circle_ids(auth.uid())));

-- LIVE LOCATIONS
CREATE POLICY "View live locations" ON live_locations
  FOR SELECT USING (circle_id IN (SELECT get_user_circle_ids(auth.uid())));

CREATE POLICY "Insert own location" ON live_locations
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Upsert own location" ON live_locations
  FOR UPDATE USING (auth.uid() = user_id);

-- LOCATION HISTORY
CREATE POLICY "View location history" ON location_history
  FOR SELECT USING (circle_id IN (SELECT get_user_circle_ids(auth.uid())));

CREATE POLICY "Insert own history" ON location_history
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- GEOFENCE EVENTS
CREATE POLICY "View geofence events" ON geofence_events
  FOR SELECT USING (user_id = auth.uid() OR user_id IN (
    SELECT cm.user_id FROM circle_members cm 
    WHERE cm.circle_id IN (SELECT get_user_circle_ids(auth.uid()))
  ));

CREATE POLICY "Create geofence events" ON geofence_events
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- SOS EVENTS
CREATE POLICY "View SOS in circle" ON sos_events
  FOR SELECT USING (circle_id IN (SELECT get_user_circle_ids(auth.uid())));

CREATE POLICY "Create SOS" ON sos_events
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Update own SOS" ON sos_events
  FOR UPDATE USING (auth.uid() = user_id);

-- MONITORED TRIPS
CREATE POLICY "View trips in circle" ON monitored_trips
  FOR SELECT USING (circle_id IN (SELECT get_user_circle_ids(auth.uid())));

CREATE POLICY "Create trip" ON monitored_trips
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Update own trip" ON monitored_trips
  FOR UPDATE USING (auth.uid() = user_id);

-- ANOMALY ALERTS
CREATE POLICY "View alerts" ON anomaly_alerts
  FOR SELECT USING (circle_id IN (SELECT get_user_circle_ids(auth.uid())));

CREATE POLICY "Create alerts" ON anomaly_alerts
  FOR INSERT WITH CHECK (circle_id IN (SELECT get_user_circle_ids(auth.uid())));

CREATE POLICY "Update alerts" ON anomaly_alerts
  FOR UPDATE USING (circle_id IN (SELECT get_user_circle_ids(auth.uid())));

-- DEVICE STATUS
CREATE POLICY "View device status" ON device_status
  FOR SELECT USING (
    user_id = auth.uid() OR 
    user_id IN (
      SELECT cm.user_id FROM circle_members cm 
      WHERE cm.circle_id IN (SELECT get_user_circle_ids(auth.uid()))
    )
  );

CREATE POLICY "Insert own device" ON device_status
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Update own device" ON device_status
  FOR UPDATE USING (auth.uid() = user_id);

-- NOTIFICATIONS
CREATE POLICY "View own notifications" ON notifications
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Create notifications" ON notifications
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Update own notifications" ON notifications
  FOR UPDATE USING (auth.uid() = user_id);

-- =============================================
-- VERIFICATION: Check that all policies are created
-- =============================================
-- Run this to verify: SELECT tablename, policyname FROM pg_policies WHERE schemaname = 'public';
