# Guardian AI - Auth/RLS Fix Instructions

## 🚨 IMPORTANT: These steps must be done BEFORE testing the app

The app's authentication and data access were broken due to recursive RLS policies. This document provides the steps to fix it.

---

## Step 1: Clean Up Supabase (Fresh Start)

Go to your Supabase Dashboard: https://supabase.com/dashboard

### 1.1 Delete All Existing Users
1. Go to **Authentication** > **Users**
2. Select all users and delete them
3. Confirm deletion

### 1.2 Delete All Data from Tables
1. Go to **Table Editor**
2. For each table below, select all rows and delete them:
   - `profiles`
   - `family_circles`
   - `circle_members`
   - `places`
   - `live_locations`
   - `location_history`
   - `geofence_events`
   - `sos_events`
   - `monitored_trips`
   - `anomaly_alerts`
   - `device_status`
   - `notifications`

---

## Step 2: Apply the Fixed SQL Schema

1. Go to **SQL Editor** in Supabase Dashboard
2. Copy the entire contents of `/app/supabase_schema_v2_fixed.sql`
3. Paste it into the SQL Editor
4. Click **Run**
5. Verify no errors appear

### What the SQL does:
- Drops all broken RLS policies
- Creates a helper function `get_user_circle_ids()` that bypasses RLS to check circle membership (this fixes the infinite recursion)
- Creates an auth trigger to auto-create a basic profile when users sign up
- Creates simple, non-recursive RLS policies for all tables

---

## Step 3: Verify the Fix

After running the SQL, verify:

1. Go to **Database** > **Functions**
   - Check that `get_user_circle_ids` and `handle_new_user` functions exist

2. Go to **Database** > **Triggers**
   - Check that `on_auth_user_created` trigger exists on `auth.users`

3. Go to **Authentication** > **Policies**
   - Check that each table has policies (profiles, family_circles, etc.)

---

## Step 4: Test the App

### Test Flow:
1. Open the app in mobile browser: https://guardian-mobile-app.preview.emergentagent.com
2. Click "Create Account"
3. Enter a real email and password (min 6 characters)
4. You should be redirected to the Onboarding screen
5. Enter your name, select your role, click "Get Started"
6. You should reach the main Map screen

### Verify in Supabase:
- Check **Authentication** > **Users** - your user should appear
- Check **Table Editor** > **profiles** - your profile should exist with the name you entered

---

## Step 5: Create a Family Circle

1. In the app, go to the **Family** tab
2. If no circle exists, you'll see options to create or join
3. Tap "Create Circle" and enter a family name
4. The circle should be created and you become the first member

### Verify in Supabase:
- Check **family_circles** table - your circle should exist
- Check **circle_members** table - you should be listed as a member

---

## Troubleshooting

### "Infinite recursion" error
The SQL was not applied correctly. Run it again.

### "Profile already exists" error
The auth trigger worked, but there's stale data. Delete users from Auth and profiles table, then try again.

### "Foreign key constraint" error
The user doesn't exist in auth.users. Sign up again with a fresh email.

### App shows "Session Expired" 
Clear browser cache/localStorage and try again.

---

## Quick Reference: New RLS Policy Pattern

The key fix uses a `SECURITY DEFINER` function to check circle membership:

```sql
-- This function runs with elevated privileges, bypassing RLS
CREATE OR REPLACE FUNCTION get_user_circle_ids(p_user_id UUID)
RETURNS SETOF UUID
LANGUAGE SQL
SECURITY DEFINER
STABLE
AS $$
  SELECT circle_id FROM circle_members WHERE user_id = p_user_id;
$$;

-- Policies now use this function instead of recursive subqueries
CREATE POLICY "View places in circles" ON places
  FOR SELECT USING (circle_id IN (SELECT get_user_circle_ids(auth.uid())));
```

This pattern prevents the infinite recursion that occurred with the old policies.
