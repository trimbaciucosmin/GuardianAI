-- =============================================
-- GUARDIAN AI - TEST DATA SEED SCRIPT
-- =============================================
-- Run this AFTER running the main schema fix
-- This creates test data for development and testing
-- 
-- NOTE: You must create the auth users manually in Supabase Auth first,
-- then update the UUIDs below to match
-- =============================================

-- =============================================
-- OPTION A: If you want to test with EXISTING auth users
-- Replace these UUIDs with your actual user IDs from auth.users
-- =============================================

-- Example: Get your user IDs from Supabase Auth dashboard
-- Parent user ID: xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
-- Child user ID: yyyyyyyy-yyyy-yyyy-yyyy-yyyyyyyyyyyy

-- =============================================
-- OPTION B: Create test profiles for existing auth users
-- Run this after you've signed up test users through the app
-- =============================================

-- First, let's create a function to easily seed test data
-- This function takes two user_ids and creates a complete test family

CREATE OR REPLACE FUNCTION seed_test_family(
  p_parent_user_id UUID,
  p_child_user_id UUID DEFAULT NULL
)
RETURNS TABLE(
  family_circle_id UUID,
  invite_code TEXT
)
LANGUAGE PLPGSQL
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_circle_id UUID;
  v_invite_code TEXT;
BEGIN
  -- Generate invite code
  v_invite_code := 'TEST' || UPPER(SUBSTRING(MD5(RANDOM()::TEXT) FROM 1 FOR 6));
  
  -- Create family circle
  INSERT INTO family_circles (name, invite_code, created_by)
  VALUES ('Test Family', v_invite_code, p_parent_user_id)
  RETURNING id INTO v_circle_id;
  
  -- Add parent as member
  INSERT INTO circle_members (circle_id, user_id, role)
  VALUES (v_circle_id, p_parent_user_id, 'parent')
  ON CONFLICT (circle_id, user_id) DO NOTHING;
  
  -- Add child as member if provided
  IF p_child_user_id IS NOT NULL THEN
    INSERT INTO circle_members (circle_id, user_id, role)
    VALUES (v_circle_id, p_child_user_id, 'child')
    ON CONFLICT (circle_id, user_id) DO NOTHING;
  END IF;
  
  -- Create default places
  INSERT INTO places (circle_id, name, type, latitude, longitude, radius, address, created_by)
  VALUES 
    (v_circle_id, 'Home', 'home', 40.7128, -74.0060, 100, '123 Main Street, New York', p_parent_user_id),
    (v_circle_id, 'School', 'school', 40.7580, -73.9855, 150, 'Oak Elementary School', p_parent_user_id);
  
  -- Return the created circle info
  RETURN QUERY SELECT v_circle_id, v_invite_code;
END;
$$;

-- =============================================
-- HELPER: Seed device status for a user
-- =============================================

CREATE OR REPLACE FUNCTION seed_device_status(
  p_user_id UUID,
  p_battery_level INTEGER DEFAULT 85,
  p_is_online BOOLEAN DEFAULT TRUE
)
RETURNS VOID
LANGUAGE PLPGSQL
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO device_status (user_id, battery_level, is_charging, gps_enabled, last_seen)
  VALUES (
    p_user_id, 
    p_battery_level, 
    FALSE, 
    TRUE, 
    CASE WHEN p_is_online THEN NOW() ELSE NOW() - INTERVAL '2 hours' END
  )
  ON CONFLICT (user_id) 
  DO UPDATE SET 
    battery_level = EXCLUDED.battery_level,
    last_seen = EXCLUDED.last_seen;
END;
$$;

-- =============================================
-- HELPER: Seed live location for a user
-- =============================================

CREATE OR REPLACE FUNCTION seed_live_location(
  p_user_id UUID,
  p_circle_id UUID,
  p_latitude DOUBLE PRECISION DEFAULT 40.7128,
  p_longitude DOUBLE PRECISION DEFAULT -74.0060,
  p_battery_level INTEGER DEFAULT 85
)
RETURNS VOID
LANGUAGE PLPGSQL
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO live_locations (user_id, circle_id, latitude, longitude, accuracy, battery_level, is_moving, timestamp)
  VALUES (p_user_id, p_circle_id, p_latitude, p_longitude, 10, p_battery_level, FALSE, NOW())
  ON CONFLICT (user_id, circle_id) 
  DO UPDATE SET 
    latitude = EXCLUDED.latitude,
    longitude = EXCLUDED.longitude,
    battery_level = EXCLUDED.battery_level,
    timestamp = NOW();
END;
$$;

-- =============================================
-- HELPER: Seed geofence events (arrivals/departures)
-- =============================================

CREATE OR REPLACE FUNCTION seed_geofence_events(
  p_user_id UUID,
  p_circle_id UUID
)
RETURNS VOID
LANGUAGE PLPGSQL
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_home_place_id UUID;
  v_school_place_id UUID;
BEGIN
  -- Get place IDs
  SELECT id INTO v_home_place_id FROM places WHERE circle_id = p_circle_id AND type = 'home' LIMIT 1;
  SELECT id INTO v_school_place_id FROM places WHERE circle_id = p_circle_id AND type = 'school' LIMIT 1;
  
  -- Create sample geofence events (arrival at school, departure from home, etc.)
  IF v_school_place_id IS NOT NULL THEN
    INSERT INTO geofence_events (user_id, place_id, event_type, timestamp)
    VALUES 
      (p_user_id, v_school_place_id, 'arrive', NOW() - INTERVAL '3 hours'),
      (p_user_id, v_school_place_id, 'depart', NOW() - INTERVAL '30 minutes');
  END IF;
  
  IF v_home_place_id IS NOT NULL THEN
    INSERT INTO geofence_events (user_id, place_id, event_type, timestamp)
    VALUES 
      (p_user_id, v_home_place_id, 'depart', NOW() - INTERVAL '4 hours'),
      (p_user_id, v_home_place_id, 'arrive', NOW() - INTERVAL '15 minutes');
  END IF;
END;
$$;

-- =============================================
-- USAGE INSTRUCTIONS
-- =============================================

-- STEP 1: Sign up two users through the app (parent and child)
-- STEP 2: Get their user IDs from Supabase Auth dashboard
-- STEP 3: Run the following (replace UUIDs):

-- SELECT * FROM seed_test_family(
--   'PARENT_USER_ID_HERE'::UUID,
--   'CHILD_USER_ID_HERE'::UUID
-- );

-- STEP 4: Seed additional data:
-- SELECT seed_device_status('PARENT_USER_ID'::UUID, 92, TRUE);
-- SELECT seed_device_status('CHILD_USER_ID'::UUID, 45, TRUE);

-- SELECT seed_live_location('CHILD_USER_ID'::UUID, 'CIRCLE_ID'::UUID, 40.7580, -73.9855, 45);

-- SELECT seed_geofence_events('CHILD_USER_ID'::UUID, 'CIRCLE_ID'::UUID);

-- =============================================
-- QUICK TEST: Verify data was created
-- =============================================

-- SELECT * FROM family_circles;
-- SELECT * FROM circle_members;
-- SELECT * FROM places;
-- SELECT * FROM device_status;
-- SELECT * FROM live_locations;
-- SELECT * FROM geofence_events;
