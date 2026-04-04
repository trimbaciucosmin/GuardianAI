-- =============================================
-- GUARDIAN AI - RPC FUNCTION FOR CIRCLE LOOKUP BY INVITE CODE
-- =============================================
-- This function allows users to lookup a circle by invite_code
-- even when they're not yet members (bypasses RLS safely)
--
-- INSTRUCTIONS:
-- 1. Go to Supabase Dashboard > SQL Editor
-- 2. Run this SQL to create the function
-- =============================================

-- Drop if exists
DROP FUNCTION IF EXISTS lookup_circle_by_invite_code(TEXT);

-- Create the function
CREATE OR REPLACE FUNCTION lookup_circle_by_invite_code(p_invite_code TEXT)
RETURNS TABLE (
  id UUID,
  name TEXT,
  invite_code TEXT,
  created_by UUID,
  created_at TIMESTAMPTZ
)
LANGUAGE SQL
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT id, name, invite_code, created_by, created_at
  FROM family_circles
  WHERE invite_code = UPPER(p_invite_code)
  LIMIT 1;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION lookup_circle_by_invite_code(TEXT) TO authenticated;

-- =============================================
-- VERIFICATION: Test the function
-- =============================================
-- Run this to test: SELECT * FROM lookup_circle_by_invite_code('YOUR_CODE_HERE');
