-- Migration: Update get_system_stats function
-- Description: Updates the get_system_stats RPC to include new metrics
-- Date: 2025-01-28

CREATE OR REPLACE FUNCTION get_system_stats()
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  result JSON;
  total_users_count INT;
  active_users_count INT;
  active_users_today_count INT;
  total_orders_count INT;
  orders_today_count INT;
  total_subscriptions_count INT;
  active_subscriptions_count INT;
  revenue_this_month_value DECIMAL;
  total_integrations_count INT;
  system_errors_today_count INT;
  conversion_rate_value DECIMAL;
BEGIN
  -- Total users
  SELECT COUNT(*) INTO total_users_count FROM profiles;
  
  -- Active users (users with at least one order or active subscription)
  SELECT COUNT(DISTINCT profile_id) INTO active_users_count
  FROM (
    SELECT profile_id FROM orders WHERE status != 'cancelled'
    UNION
    SELECT user_id FROM subscriptions WHERE status = 'active'
  ) AS active;
  
  -- Active users today (users who logged in or made an order today)
  SELECT COUNT(DISTINCT user_id) INTO active_users_today_count
  FROM user_activities
  WHERE DATE(created_at) = CURRENT_DATE;
  
  -- Total orders
  SELECT COUNT(*) INTO total_orders_count FROM orders;
  
  -- Orders today
  SELECT COUNT(*) INTO orders_today_count
  FROM orders
  WHERE DATE(created_at) = CURRENT_DATE;
  
  -- Total subscriptions
  SELECT COUNT(*) INTO total_subscriptions_count FROM subscriptions;
  
  -- Active subscriptions
  SELECT COUNT(*) INTO active_subscriptions_count
  FROM subscriptions
  WHERE status = 'active';
  
  -- Revenue this month
  SELECT COALESCE(SUM(total_amount), 0) INTO revenue_this_month_value
  FROM orders
  WHERE status = 'completed'
    AND DATE_TRUNC('month', created_at) = DATE_TRUNC('month', CURRENT_DATE);
  
  -- Total integrations (approximate - count unique integration types)
  SELECT COUNT(*) INTO total_integrations_count
  FROM integration_monitoring
  WHERE status = 'healthy';
  
  -- System errors today
  SELECT COUNT(*) INTO system_errors_today_count
  FROM admin_logs
  WHERE severity IN ('error', 'critical')
    AND DATE(created_at) = CURRENT_DATE;
  
  -- Conversion rate (active subscriptions / total users * 100)
  IF total_users_count > 0 THEN
    conversion_rate_value := (active_subscriptions_count::DECIMAL / total_users_count::DECIMAL) * 100;
  ELSE
    conversion_rate_value := 0;
  END IF;
  
  -- Build JSON result
  result := json_build_object(
    'total_users', total_users_count,
    'active_users', active_users_count,
    'active_users_today', active_users_today_count,
    'total_orders', total_orders_count,
    'orders_today', orders_today_count,
    'total_subscriptions', total_subscriptions_count,
    'active_subscriptions', active_subscriptions_count,
    'revenue_this_month', revenue_this_month_value,
    'total_integrations', total_integrations_count,
    'system_errors_today', system_errors_today_count,
    'conversion_rate', ROUND(conversion_rate_value, 2)
  );
  
  RETURN result;
END;
$$;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION get_system_stats() TO authenticated;
GRANT EXECUTE ON FUNCTION get_system_stats() TO service_role;

COMMENT ON FUNCTION get_system_stats() IS 'Returns comprehensive system statistics for admin dashboard';
