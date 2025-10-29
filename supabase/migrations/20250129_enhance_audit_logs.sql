-- Enhanced Audit Trail Migration
-- Adiciona funcionalidade de Before/After e filtros avançados aos logs de auditoria

-- Step 1: Rename existing columns to standardized names
ALTER TABLE admin_logs 
RENAME COLUMN activity_type TO action_type;

ALTER TABLE admin_logs 
RENAME COLUMN target_entity_type TO entity_type;

ALTER TABLE admin_logs 
RENAME COLUMN target_entity_id TO entity_id;

-- Step 2: Add new columns to admin_logs for before/after tracking
ALTER TABLE admin_logs 
ADD COLUMN IF NOT EXISTS data_before JSONB,
ADD COLUMN IF NOT EXISTS data_after JSONB,
ADD COLUMN IF NOT EXISTS request_duration_ms INTEGER,
ADD COLUMN IF NOT EXISTS status_code INTEGER,
ADD COLUMN IF NOT EXISTS error_message TEXT,
ADD COLUMN IF NOT EXISTS tags TEXT[];

-- Step 2: Add indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_admin_logs_action_type ON admin_logs(action_type);
CREATE INDEX IF NOT EXISTS idx_admin_logs_entity_type ON admin_logs(entity_type);
CREATE INDEX IF NOT EXISTS idx_admin_logs_entity_id ON admin_logs(entity_id);
CREATE INDEX IF NOT EXISTS idx_admin_logs_ip_address ON admin_logs(ip_address);
CREATE INDEX IF NOT EXISTS idx_admin_logs_created_at_desc ON admin_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_admin_logs_tags ON admin_logs USING GIN(tags);
CREATE INDEX IF NOT EXISTS idx_admin_logs_data_before ON admin_logs USING GIN(data_before);
CREATE INDEX IF NOT EXISTS idx_admin_logs_data_after ON admin_logs USING GIN(data_after);

-- Step 3: Create a view for easy diff analysis
CREATE OR REPLACE VIEW admin_logs_with_changes AS
SELECT 
  al.*,
  CASE 
    WHEN al.data_before IS NOT NULL AND al.data_after IS NOT NULL THEN
      jsonb_object_agg(
        diff_keys.key,
        jsonb_build_object(
          'old_value', al.data_before -> diff_keys.key,
          'new_value', al.data_after -> diff_keys.key
        )
      ) FILTER (WHERE al.data_before -> diff_keys.key IS DISTINCT FROM al.data_after -> diff_keys.key)
    ELSE NULL
  END as changed_fields,
  p.name as admin_name,
  p.email as admin_email
FROM admin_logs al
LEFT JOIN profiles p ON al.admin_id = p.id
LEFT JOIN LATERAL (
  SELECT DISTINCT key
  FROM jsonb_object_keys(COALESCE(al.data_before, '{}'::jsonb)) AS key
  UNION
  SELECT DISTINCT key
  FROM jsonb_object_keys(COALESCE(al.data_after, '{}'::jsonb)) AS key
) diff_keys ON true
GROUP BY al.id, p.name, p.email;

-- Step 4: Function to get log statistics
CREATE OR REPLACE FUNCTION get_audit_log_statistics(
  p_start_date TIMESTAMPTZ DEFAULT NULL,
  p_end_date TIMESTAMPTZ DEFAULT NULL
)
RETURNS TABLE (
  total_logs BIGINT,
  actions_by_type JSONB,
  entities_by_type JSONB,
  top_admins JSONB,
  actions_per_day JSONB,
  error_rate DECIMAL,
  avg_duration_ms DECIMAL
) 
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  WITH filtered_logs AS (
    SELECT *
    FROM admin_logs
    WHERE (p_start_date IS NULL OR created_at >= p_start_date)
      AND (p_end_date IS NULL OR created_at <= p_end_date)
  ),
  action_counts AS (
    SELECT 
      action_type,
      COUNT(*) as count
    FROM filtered_logs
    GROUP BY action_type
  ),
  entity_counts AS (
    SELECT 
      entity_type,
      COUNT(*) as count
    FROM filtered_logs
    GROUP BY entity_type
  ),
  admin_counts AS (
    SELECT 
      p.name,
      p.email,
      COUNT(*) as action_count
    FROM filtered_logs fl
    JOIN profiles p ON fl.admin_id = p.id
    GROUP BY p.id, p.name, p.email
    ORDER BY action_count DESC
    LIMIT 10
  ),
  daily_counts AS (
    SELECT 
      DATE(created_at) as log_date,
      COUNT(*) as count
    FROM filtered_logs
    GROUP BY DATE(created_at)
    ORDER BY log_date DESC
    LIMIT 30
  )
  SELECT
    (SELECT COUNT(*) FROM filtered_logs)::BIGINT,
    (SELECT jsonb_object_agg(action_type, count) FROM action_counts),
    (SELECT jsonb_object_agg(entity_type, count) FROM entity_counts),
    (SELECT jsonb_agg(jsonb_build_object('name', name, 'email', email, 'count', action_count)) FROM admin_counts),
    (SELECT jsonb_object_agg(log_date::TEXT, count) FROM daily_counts),
    (SELECT ROUND((COUNT(*) FILTER (WHERE error_message IS NOT NULL)::DECIMAL / NULLIF(COUNT(*), 0)) * 100, 2) FROM filtered_logs),
    (SELECT ROUND(AVG(request_duration_ms), 2) FROM filtered_logs WHERE request_duration_ms IS NOT NULL);
END;
$$;

-- Step 5: Function to compare two log entries (for rollback scenarios)
CREATE OR REPLACE FUNCTION compare_log_entries(
  p_log_id_1 UUID,
  p_log_id_2 UUID
)
RETURNS TABLE (
  field_name TEXT,
  value_in_log_1 JSONB,
  value_in_log_2 JSONB,
  values_differ BOOLEAN
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  WITH log_1 AS (
    SELECT data_after FROM admin_logs WHERE id = p_log_id_1
  ),
  log_2 AS (
    SELECT data_after FROM admin_logs WHERE id = p_log_id_2
  ),
  all_keys AS (
    SELECT DISTINCT key
    FROM (
      SELECT jsonb_object_keys(data_after) as key FROM log_1
      UNION
      SELECT jsonb_object_keys(data_after) as key FROM log_2
    ) keys
  )
  SELECT 
    ak.key,
    l1.data_after -> ak.key,
    l2.data_after -> ak.key,
    (l1.data_after -> ak.key) IS DISTINCT FROM (l2.data_after -> ak.key)
  FROM all_keys ak
  CROSS JOIN log_1 l1
  CROSS JOIN log_2 l2;
END;
$$;

-- Step 6: Function to get changes summary for an entity
CREATE OR REPLACE FUNCTION get_entity_change_history(
  p_entity_type TEXT,
  p_entity_id UUID,
  p_limit INTEGER DEFAULT 50
)
RETURNS TABLE (
  log_id UUID,
  action_type TEXT,
  admin_name TEXT,
  admin_email TEXT,
  changed_fields JSONB,
  created_at TIMESTAMPTZ,
  ip_address VARCHAR(45)
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    al.id,
    al.action_type,
    p.name,
    p.email,
    jsonb_object_agg(
      diff_keys.key,
      jsonb_build_object(
        'old', al.data_before -> diff_keys.key,
        'new', al.data_after -> diff_keys.key
      )
    ) FILTER (WHERE al.data_before -> diff_keys.key IS DISTINCT FROM al.data_after -> diff_keys.key),
    al.created_at,
    al.ip_address
  FROM admin_logs al
  LEFT JOIN profiles p ON al.admin_id = p.id
  LEFT JOIN LATERAL (
    SELECT key
    FROM jsonb_object_keys(COALESCE(al.data_before, '{}'::jsonb)) AS key
    UNION
    SELECT key
    FROM jsonb_object_keys(COALESCE(al.data_after, '{}'::jsonb)) AS key
  ) diff_keys ON true
  WHERE al.entity_type = p_entity_type 
    AND al.entity_id = p_entity_id
  GROUP BY al.id, p.name, p.email
  ORDER BY al.created_at DESC
  LIMIT p_limit;
END;
$$;

-- Step 7: Function to export logs as CSV format
CREATE OR REPLACE FUNCTION export_audit_logs_csv(
  p_start_date TIMESTAMPTZ DEFAULT NULL,
  p_end_date TIMESTAMPTZ DEFAULT NULL,
  p_action_types TEXT[] DEFAULT NULL,
  p_entity_types TEXT[] DEFAULT NULL
)
RETURNS TABLE (
  csv_row TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Header row
  RETURN QUERY
  SELECT 'ID,Timestamp,Admin,Action Type,Entity Type,Entity ID,IP Address,Duration (ms),Status Code,Error,Description'::TEXT;
  
  -- Data rows
  RETURN QUERY
  SELECT 
    al.id::TEXT || ',' ||
    al.created_at::TEXT || ',' ||
    COALESCE(p.email, 'Unknown') || ',' ||
    COALESCE(al.action_type, '') || ',' ||
    COALESCE(al.entity_type, '') || ',' ||
    COALESCE(al.entity_id::TEXT, '') || ',' ||
    COALESCE(al.ip_address, '') || ',' ||
    COALESCE(al.request_duration_ms::TEXT, '') || ',' ||
    COALESCE(al.status_code::TEXT, '') || ',' ||
    COALESCE(REPLACE(al.error_message, ',', ';'), '') || ',' ||
    COALESCE(REPLACE(al.description, ',', ';'), '')
  FROM admin_logs al
  LEFT JOIN profiles p ON al.admin_id = p.id
  WHERE (p_start_date IS NULL OR al.created_at >= p_start_date)
    AND (p_end_date IS NULL OR al.created_at <= p_end_date)
    AND (p_action_types IS NULL OR al.action_type = ANY(p_action_types))
    AND (p_entity_types IS NULL OR al.entity_type = ANY(p_entity_types))
  ORDER BY al.created_at DESC;
END;
$$;

-- Step 8: Update RLS policies to allow admins to read extended log data
DROP POLICY IF EXISTS "Admins can view logs" ON admin_logs;
CREATE POLICY "Admins can view all logs with details"
  ON admin_logs FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE profiles.id = auth.uid() 
      AND (profiles.role = 'admin' OR profiles.role = 'super_admin')
    )
  );

-- Step 9: Create indexes for the new view
CREATE INDEX IF NOT EXISTS idx_admin_logs_with_changes 
  ON admin_logs(id, admin_id, entity_type, entity_id, created_at DESC)
  WHERE data_before IS NOT NULL OR data_after IS NOT NULL;

-- Step 10: Add comments for documentation
COMMENT ON COLUMN admin_logs.data_before IS 'Snapshot of entity data before the action (JSONB)';
COMMENT ON COLUMN admin_logs.data_after IS 'Snapshot of entity data after the action (JSONB)';
COMMENT ON COLUMN admin_logs.ip_address IS 'IP address of the admin who performed the action';
COMMENT ON COLUMN admin_logs.user_agent IS 'Browser/client user agent string';
COMMENT ON COLUMN admin_logs.request_duration_ms IS 'Time taken to complete the action in milliseconds';
COMMENT ON COLUMN admin_logs.status_code IS 'HTTP status code of the action result';
COMMENT ON COLUMN admin_logs.error_message IS 'Error message if the action failed';
COMMENT ON COLUMN admin_logs.tags IS 'Array of tags for categorizing logs (e.g., critical, security, bulk-operation)';

COMMENT ON VIEW admin_logs_with_changes IS 'View that automatically calculates changed fields by comparing before/after data';
COMMENT ON FUNCTION get_audit_log_statistics IS 'Returns comprehensive statistics about audit logs for a date range';
COMMENT ON FUNCTION compare_log_entries IS 'Compares two log entries field by field to identify differences';
COMMENT ON FUNCTION get_entity_change_history IS 'Returns the complete change history for a specific entity';
COMMENT ON FUNCTION export_audit_logs_csv IS 'Exports audit logs in CSV format with optional filters';
