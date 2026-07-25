-- ============================================================================
-- Migration 18: Function to check for other active sessions
-- ============================================================================

CREATE OR REPLACE FUNCTION public.has_other_sessions()
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_count int;
  v_current_session_id uuid;
BEGIN
  -- Verify the user is authenticated
  IF auth.uid() IS NULL THEN
    RETURN false;
  END IF;

  -- Get current session ID from JWT
  v_current_session_id := (auth.jwt()->>'session_id')::uuid;

  -- Count other sessions for this user
  SELECT COUNT(*) INTO v_count
  FROM auth.sessions
  WHERE user_id = auth.uid()
    AND id != v_current_session_id;

  RETURN v_count > 0;
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION public.has_other_sessions() TO authenticated;
