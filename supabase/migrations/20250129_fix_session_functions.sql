-- Fix: Drop and recreate session management functions with correct admin_logs structure
-- This fixes the "column user_id does not exist" error

-- Drop existing functions
DROP FUNCTION IF EXISTS revoke_session(UUID, UUID, TEXT);
DROP FUNCTION IF EXISTS revoke_all_other_sessions(UUID, UUID, TEXT);

-- Recreate with correct structure
CREATE OR REPLACE FUNCTION revoke_session(
  p_session_id UUID,
  p_revoked_by UUID,
  p_reason TEXT DEFAULT NULL
)
RETURNS void AS $$
BEGIN
  UPDATE admin_sessions
  SET 
    is_active = false,
    revoked_at = now(),
    revoked_by = p_revoked_by,
    revoke_reason = p_reason
  WHERE id = p_session_id;
  
  -- Log the revocation (using correct admin_logs structure)
  INSERT INTO admin_logs (
    admin_id,
    action,
    activity_type,
    target_entity_type,
    target_entity_id,
    description
  ) VALUES (
    p_revoked_by,
    'revoke_session',
    'admin_action',
    'session',
    p_session_id,
    COALESCE(p_reason, 'Session revoked manually')
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION revoke_all_other_sessions(
  p_user_id UUID,
  p_current_session_id UUID,
  p_reason TEXT DEFAULT 'All other sessions revoked by user'
)
RETURNS INTEGER AS $$
DECLARE
  revoked_count INTEGER;
BEGIN
  UPDATE admin_sessions
  SET 
    is_active = false,
    revoked_at = now(),
    revoked_by = p_user_id,
    revoke_reason = p_reason
  WHERE user_id = p_user_id
    AND id != p_current_session_id
    AND is_active = true;
  
  GET DIAGNOSTICS revoked_count = ROW_COUNT;
  
  -- Log the mass revocation (using correct admin_logs structure)
  INSERT INTO admin_logs (
    admin_id,
    action,
    activity_type,
    target_entity_type,
    target_entity_id,
    description
  ) VALUES (
    p_user_id,
    'revoke_all_sessions',
    'admin_action',
    'session',
    p_user_id,
    format('Revoked %s sessions: %s', revoked_count, p_reason)
  );
  
  RETURN revoked_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION revoke_session IS 'Revoke a specific admin session';
COMMENT ON FUNCTION revoke_all_other_sessions IS 'Revoke all sessions except the current one';
