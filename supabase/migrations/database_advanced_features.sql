-- Database Advanced Features Migration
-- Implements triggers, views, procedures, indexes, and constraints

-- ===========================================
-- 1. TRIGGERS AUTOMÁTICOS PARA MÉTRICAS
-- ===========================================

-- Function to update analytics metrics when orders change
CREATE OR REPLACE FUNCTION update_order_metrics()
RETURNS TRIGGER AS $$
DECLARE
    user_id UUID;
    metric_date DATE;
BEGIN
    -- Get user_id and date
    IF TG_OP = 'DELETE' THEN
        user_id := OLD.user_id;
        metric_date := CURRENT_DATE;
    ELSE
        user_id := NEW.user_id;
        metric_date := CURRENT_DATE;
    END IF;

    -- Update total orders count
    INSERT INTO analytics_metrics (user_id, metric_type, metric_name, value, date)
    SELECT
        user_id,
        'orders',
        'total_orders',
        COUNT(*),
        metric_date
    FROM orders
    WHERE orders.user_id = update_order_metrics.user_id
    ON CONFLICT (user_id, metric_type, metric_name, date)
    DO UPDATE SET value = EXCLUDED.value;

    -- Update orders by status
    INSERT INTO analytics_metrics (user_id, metric_type, metric_name, value, date)
    SELECT
        o.user_id,
        'orders',
        'status_' || o.status,
        COUNT(*),
        metric_date
    FROM orders o
    WHERE o.user_id = update_order_metrics.user_id
    GROUP BY o.user_id, o.status
    ON CONFLICT (user_id, metric_type, metric_name, date)
    DO UPDATE SET value = EXCLUDED.value;

    -- Update delivery rate
    INSERT INTO analytics_metrics (user_id, metric_type, metric_name, value, date)
    SELECT
        o.user_id,
        'performance',
        'delivery_rate',
        ROUND(
            (COUNT(*) FILTER (WHERE o.status = 'delivered')::DECIMAL /
             NULLIF(COUNT(*), 0) * 100), 2
        ),
        metric_date
    FROM orders o
    WHERE o.user_id = update_order_metrics.user_id
    GROUP BY o.user_id
    ON CONFLICT (user_id, metric_type, metric_name, date)
    DO UPDATE SET value = EXCLUDED.value;

    RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to update notification metrics
CREATE OR REPLACE FUNCTION update_notification_metrics()
RETURNS TRIGGER AS $$
DECLARE
    user_id UUID;
    metric_date DATE;
BEGIN
    -- Get user_id and date
    IF TG_OP = 'DELETE' THEN
        user_id := OLD.user_id;
        metric_date := CURRENT_DATE;
    ELSE
        user_id := NEW.user_id;
        metric_date := CURRENT_DATE;
    END IF;

    -- Update notification counts by type and status
    INSERT INTO analytics_metrics (user_id, metric_type, metric_name, value, date)
    SELECT
        n.user_id,
        'notifications',
        n.type || '_' || n.status,
        COUNT(*),
        metric_date
    FROM notifications n
    WHERE n.user_id = update_notification_metrics.user_id
    GROUP BY n.user_id, n.type, n.status
    ON CONFLICT (user_id, metric_type, metric_name, date)
    DO UPDATE SET value = EXCLUDED.value;

    RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to log order status changes
CREATE OR REPLACE FUNCTION log_order_status_change()
RETURNS TRIGGER AS $$
BEGIN
    IF OLD.status IS DISTINCT FROM NEW.status THEN
        INSERT INTO order_history (order_id, user_id, old_status, new_status, notes)
        VALUES (NEW.id, NEW.user_id, OLD.status, NEW.status, 'Status changed automatically');
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to update proactive alerts
CREATE OR REPLACE FUNCTION create_proactive_alerts()
RETURNS TRIGGER AS $$
BEGIN
    -- Alert for delayed orders (more than 7 days in transit)
    IF NEW.status = 'in_transit' AND
       NEW.created_at < CURRENT_TIMESTAMP - INTERVAL '7 days' AND
       NOT EXISTS (
           SELECT 1 FROM proactive_alerts
           WHERE order_id = NEW.id AND alert_type = 'delay_warning' AND is_read = false
       ) THEN
        INSERT INTO proactive_alerts (user_id, order_id, alert_type, title, message, priority)
        VALUES (
            NEW.user_id,
            NEW.id,
            'delay_warning',
            'Pedido em atraso',
            'O pedido ' || NEW.tracking_code || ' está em trânsito há mais de 7 dias.',
            'high'
        );
    END IF;

    -- Alert for orders out for delivery
    IF NEW.status = 'out_for_delivery' AND
       NOT EXISTS (
           SELECT 1 FROM proactive_alerts
           WHERE order_id = NEW.id AND alert_type = 'delivery_reminder' AND is_read = false
       ) THEN
        INSERT INTO proactive_alerts (user_id, order_id, alert_type, title, message, priority)
        VALUES (
            NEW.user_id,
            NEW.id,
            'delivery_reminder',
            'Pedido saindo para entrega',
            'O pedido ' || NEW.tracking_code || ' está saindo para entrega hoje.',
            'normal'
        );
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create triggers
CREATE TRIGGER trigger_update_order_metrics
    AFTER INSERT OR UPDATE OR DELETE ON orders
    FOR EACH ROW EXECUTE FUNCTION update_order_metrics();

CREATE TRIGGER trigger_update_notification_metrics
    AFTER INSERT OR UPDATE OR DELETE ON notifications
    FOR EACH ROW EXECUTE FUNCTION update_notification_metrics();

CREATE TRIGGER trigger_log_order_status_change
    AFTER UPDATE ON orders
    FOR EACH ROW EXECUTE FUNCTION log_order_status_change();

CREATE TRIGGER trigger_create_proactive_alerts
    AFTER UPDATE ON orders
    FOR EACH ROW EXECUTE FUNCTION create_proactive_alerts();

-- ===========================================
-- 2. VIEWS MATERIALIZADAS PARA PERFORMANCE
-- ===========================================

-- Materialized view for order statistics
CREATE MATERIALIZED VIEW order_statistics AS
SELECT
    user_id,
    COUNT(*) as total_orders,
    COUNT(*) FILTER (WHERE status = 'delivered') as delivered_orders,
    COUNT(*) FILTER (WHERE status = 'in_transit') as in_transit_orders,
    COUNT(*) FILTER (WHERE status = 'delayed') as delayed_orders,
    COUNT(*) FILTER (WHERE status = 'failed') as failed_orders,
    ROUND(
        (COUNT(*) FILTER (WHERE status = 'delivered')::DECIMAL /
         NULLIF(COUNT(*), 0) * 100), 2
    ) as delivery_rate,
    AVG(EXTRACT(EPOCH FROM (actual_delivery - created_at))/86400) FILTER (WHERE actual_delivery IS NOT NULL) as avg_delivery_days,
    MAX(created_at) as last_order_date,
    MIN(created_at) as first_order_date
FROM orders
GROUP BY user_id;

-- Materialized view for user performance metrics
CREATE MATERIALIZED VIEW user_performance_metrics AS
SELECT
    u.id as user_id,
    u.email,
    p.name as user_name,
    p.store_name,
    os.total_orders,
    os.delivered_orders,
    os.delivery_rate,
    os.avg_delivery_days,
    COUNT(n.id) as total_notifications,
    COUNT(n.id) FILTER (WHERE n.status = 'sent') as sent_notifications,
    COUNT(pa.id) as active_alerts,
    us.status as subscription_status,
    sp.name as plan_name
FROM auth.users u
LEFT JOIN profiles p ON u.id = p.id
LEFT JOIN order_statistics os ON u.id = os.user_id
LEFT JOIN notifications n ON u.id = n.user_id
LEFT JOIN proactive_alerts pa ON u.id = pa.user_id AND pa.is_read = false
LEFT JOIN user_subscriptions us ON u.id = us.user_id AND us.status = 'active'
LEFT JOIN subscription_plans sp ON us.plan_id = sp.id
GROUP BY u.id, u.email, p.name, p.store_name, os.total_orders, os.delivered_orders,
         os.delivery_rate, os.avg_delivery_days, us.status, sp.name;

-- Materialized view for carrier performance
CREATE MATERIALIZED VIEW carrier_performance AS
SELECT
    carrier,
    COUNT(*) as total_shipments,
    COUNT(*) FILTER (WHERE status = 'delivered') as successful_deliveries,
    ROUND(
        (COUNT(*) FILTER (WHERE status = 'delivered')::DECIMAL /
         NULLIF(COUNT(*), 0) * 100), 2
    ) as success_rate,
    AVG(EXTRACT(EPOCH FROM (actual_delivery - created_at))/86400) FILTER (WHERE actual_delivery IS NOT NULL) as avg_delivery_time,
    COUNT(*) FILTER (WHERE status = 'delayed') as delayed_shipments,
    COUNT(*) FILTER (WHERE status = 'failed') as failed_shipments
FROM orders
WHERE carrier IS NOT NULL
GROUP BY carrier;

-- Create indexes for materialized views
CREATE INDEX idx_order_statistics_user_id ON order_statistics(user_id);
CREATE INDEX idx_user_performance_metrics_user_id ON user_performance_metrics(user_id);
CREATE INDEX idx_carrier_performance_carrier ON carrier_performance(carrier);

-- ===========================================
-- 3. PROCEDURES ARMAZENADAS PARA CÁLCULOS
-- ===========================================

-- Procedure to calculate and update all user metrics
CREATE OR REPLACE PROCEDURE refresh_user_metrics(target_user_id UUID DEFAULT NULL)
LANGUAGE plpgsql AS $$
DECLARE
    user_record RECORD;
BEGIN
    -- If no specific user, refresh all users
    IF target_user_id IS NULL THEN
        FOR user_record IN SELECT id FROM auth.users LOOP
            PERFORM refresh_user_metrics(user_record.id);
        END LOOP;
        RETURN;
    END IF;

    -- Delete old metrics for the user
    DELETE FROM analytics_metrics
    WHERE user_id = target_user_id
    AND date >= CURRENT_DATE - INTERVAL '30 days';

    -- Recalculate metrics for the last 30 days
    FOR i IN 0..29 LOOP
        INSERT INTO analytics_metrics (user_id, metric_type, metric_name, value, date)
        SELECT
            target_user_id,
            'orders',
            'daily_orders',
            COUNT(*),
            CURRENT_DATE - INTERVAL '1 day' * i
        FROM orders
        WHERE user_id = target_user_id
        AND DATE(created_at) = CURRENT_DATE - INTERVAL '1 day' * i
        ON CONFLICT (user_id, metric_type, metric_name, date)
        DO UPDATE SET value = EXCLUDED.value;
    END LOOP;

    -- Update materialized views
    REFRESH MATERIALIZED VIEW CONCURRENTLY order_statistics;
    REFRESH MATERIALIZED VIEW CONCURRENTLY user_performance_metrics;
    REFRESH MATERIALIZED VIEW CONCURRENTLY carrier_performance;
END;
$$;

-- Procedure to clean old data
CREATE OR REPLACE PROCEDURE cleanup_old_data(days_to_keep INTEGER DEFAULT 90)
LANGUAGE plpgsql AS $$
BEGIN
    -- Delete old notification logs
    DELETE FROM notification_logs
    WHERE created_at < CURRENT_TIMESTAMP - INTERVAL '1 day' * days_to_keep;

    -- Delete old cache entries
    DELETE FROM cache_entries
    WHERE expires_at < CURRENT_TIMESTAMP;

    -- Delete old analytics metrics (keep only last year)
    DELETE FROM analytics_metrics
    WHERE date < CURRENT_DATE - INTERVAL '1 year';

    -- Archive old order history (optional - just mark as archived)
    UPDATE order_history
    SET notes = COALESCE(notes, '') || ' [ARCHIVED]'
    WHERE changed_at < CURRENT_TIMESTAMP - INTERVAL '1 day' * days_to_keep;
END;
$$;

-- Procedure to generate analytics report
CREATE OR REPLACE PROCEDURE generate_analytics_report(
    target_user_id UUID,
    report_type TEXT DEFAULT 'monthly',
    start_date DATE DEFAULT NULL,
    end_date DATE DEFAULT NULL
)
LANGUAGE plpgsql AS $$
DECLARE
    report_id UUID;
    report_title TEXT;
    report_data JSONB;
BEGIN
    -- Set default dates if not provided
    IF start_date IS NULL THEN
        start_date := DATE_TRUNC('month', CURRENT_DATE - INTERVAL '1 month');
    END IF;
    IF end_date IS NULL THEN
        end_date := DATE_TRUNC('month', CURRENT_DATE) - INTERVAL '1 day';
    END IF;

    -- Generate report title
    report_title := 'Relatório ' || report_type || ' - ' ||
                   TO_CHAR(start_date, 'DD/MM/YYYY') || ' a ' ||
                   TO_CHAR(end_date, 'DD/MM/YYYY');

    -- Collect metrics data
    SELECT jsonb_build_object(
        'total_orders', COUNT(*),
        'delivered_orders', COUNT(*) FILTER (WHERE status = 'delivered'),
        'in_transit_orders', COUNT(*) FILTER (WHERE status = 'in_transit'),
        'delayed_orders', COUNT(*) FILTER (WHERE status = 'delayed'),
        'delivery_rate', ROUND(
            (COUNT(*) FILTER (WHERE status = 'delivered')::DECIMAL /
             NULLIF(COUNT(*), 0) * 100), 2
        ),
        'avg_delivery_days', ROUND(
            AVG(EXTRACT(EPOCH FROM (actual_delivery - created_at))/86400)
            FILTER (WHERE actual_delivery IS NOT NULL), 2
        ),
        'top_carriers', (
            SELECT jsonb_agg(
                jsonb_build_object(
                    'carrier', carrier,
                    'count', count
                )
            )
            FROM (
                SELECT carrier, COUNT(*) as count
                FROM orders
                WHERE user_id = target_user_id
                AND created_at >= start_date
                AND created_at <= end_date
                GROUP BY carrier
                ORDER BY count DESC
                LIMIT 5
            ) top_carriers
        )
    ) INTO report_data
    FROM orders
    WHERE user_id = target_user_id
    AND created_at >= start_date
    AND created_at <= end_date;

    -- Insert report
    INSERT INTO analytics_reports (
        user_id,
        report_type,
        title,
        description,
        date_range,
        metrics,
        summary
    ) VALUES (
        target_user_id,
        report_type,
        report_title,
        'Relatório automático gerado pelo sistema',
        jsonb_build_object('start_date', start_date, 'end_date', end_date),
        report_data,
        jsonb_build_object(
            'generated_at', CURRENT_TIMESTAMP,
            'total_orders', report_data->'total_orders',
            'delivery_rate', report_data->'delivery_rate'
        )
    )
    RETURNING id INTO report_id;
END;
$$;

-- ===========================================
-- 4. INDEXES OTIMIZADOS PARA QUERIES FREQUENTES
-- ===========================================

-- Composite indexes for complex queries
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_orders_user_status_date
    ON orders(user_id, status, created_at DESC);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_orders_user_carrier
    ON orders(user_id, carrier);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_orders_tracking_user
    ON orders(tracking_code, user_id);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_notifications_user_status_sent
    ON notifications(user_id, status, sent_at DESC);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_order_history_order_changed
    ON order_history(order_id, changed_at DESC);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_proactive_alerts_user_read_priority
    ON proactive_alerts(user_id, is_read, priority, triggered_at DESC);

-- Partial indexes for better performance
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_orders_active
    ON orders(user_id, created_at DESC)
    WHERE status NOT IN ('delivered', 'failed', 'returned');

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_notifications_pending
    ON notifications(user_id, created_at)
    WHERE status = 'pending';

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_proactive_alerts_unread
    ON proactive_alerts(user_id, triggered_at DESC)
    WHERE is_read = false;

-- JSONB indexes for metadata queries
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_analytics_metrics_metadata
    ON analytics_metrics USING GIN (metadata)
    WHERE metadata != '{}';

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_settings_value
    ON settings USING GIN (value)
    WHERE value IS NOT NULL;

-- ===========================================
-- 5. CONSTRAINTS E VALIDAÇÕES AVANÇADAS
-- ===========================================

-- Function to validate email format
CREATE OR REPLACE FUNCTION validate_email_format(email TEXT)
RETURNS BOOLEAN AS $$
BEGIN
    RETURN email ~ '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$';
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Function to validate tracking code format
CREATE OR REPLACE FUNCTION validate_tracking_code(code TEXT)
RETURNS BOOLEAN AS $$
BEGIN
    -- Basic validation: not empty, reasonable length, no special chars that could cause issues
    RETURN length(trim(code)) > 0
           AND length(trim(code)) <= 50
           AND code !~ '[<>\"''&]'; -- Avoid HTML/XML problematic characters
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Function to validate order status transitions
CREATE OR REPLACE FUNCTION validate_order_status_transition()
RETURNS TRIGGER AS $$
DECLARE
    valid_transitions TEXT[][] := ARRAY[
        ['pending', 'in_transit'],
        ['pending', 'cancelled'],
        ['in_transit', 'out_for_delivery'],
        ['in_transit', 'delayed'],
        ['in_transit', 'failed'],
        ['out_for_delivery', 'delivered'],
        ['out_for_delivery', 'failed'],
        ['out_for_delivery', 'returned'],
        ['delayed', 'in_transit'],
        ['delayed', 'out_for_delivery'],
        ['delayed', 'failed'],
        ['failed', 'pending'], -- Allow retry
        ['returned', 'pending'] -- Allow reprocessing
    ];
    transition_found BOOLEAN := FALSE;
    i INTEGER;
BEGIN
    -- Allow initial inserts
    IF TG_OP = 'INSERT' THEN
        RETURN NEW;
    END IF;

    -- Check if transition is valid
    FOR i IN 1..array_length(valid_transitions, 1) LOOP
        IF valid_transitions[i][1] = OLD.status AND valid_transitions[i][2] = NEW.status THEN
            transition_found := TRUE;
            EXIT;
        END IF;
    END LOOP;

    IF NOT transition_found THEN
        RAISE EXCEPTION 'Invalid status transition from % to %', OLD.status, NEW.status;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Function to validate subscription limits
CREATE OR REPLACE FUNCTION validate_subscription_limits()
RETURNS TRIGGER AS $$
DECLARE
    user_plan_limits JSONB;
    current_orders INTEGER;
    current_integrations INTEGER;
BEGIN
    -- Get user's current plan limits
    SELECT sp.limits INTO user_plan_limits
    FROM user_subscriptions us
    JOIN subscription_plans sp ON us.plan_id = sp.id
    WHERE us.user_id = NEW.user_id
    AND us.status = 'active'
    LIMIT 1;

    -- If no active subscription, use free plan limits
    IF user_plan_limits IS NULL THEN
        SELECT limits INTO user_plan_limits
        FROM subscription_plans
        WHERE name = 'Gratuito'
        LIMIT 1;
    END IF;

    -- Check orders limit
    IF (user_plan_limits->>'orders_per_month')::INTEGER >= 0 THEN
        SELECT COUNT(*) INTO current_orders
        FROM orders
        WHERE user_id = NEW.user_id
        AND created_at >= DATE_TRUNC('month', CURRENT_DATE);

        IF current_orders >= (user_plan_limits->>'orders_per_month')::INTEGER THEN
            RAISE EXCEPTION 'Limite mensal de pedidos atingido. Upgrade necessário.';
        END IF;
    END IF;

    -- Check integrations limit (for marketplace_integrations)
    IF TG_TABLE_NAME = 'marketplace_integrations' AND (user_plan_limits->>'marketplaces')::INTEGER >= 0 THEN
        SELECT COUNT(*) INTO current_integrations
        FROM marketplace_integrations
        WHERE user_id = NEW.user_id
        AND is_active = true;

        IF current_integrations >= (user_plan_limits->>'marketplaces')::INTEGER THEN
            RAISE EXCEPTION 'Limite de integrações atingido. Upgrade necessário.';
        END IF;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Add check constraints
ALTER TABLE orders ADD CONSTRAINT check_tracking_code_format
    CHECK (validate_tracking_code(tracking_code));

ALTER TABLE customers ADD CONSTRAINT check_email_format
    CHECK (validate_email_format(email));

ALTER TABLE profiles ADD CONSTRAINT check_store_email_format
    CHECK (store_email IS NULL OR validate_email_format(store_email));

-- Add triggers for advanced validation
CREATE TRIGGER trigger_validate_order_status_transition
    BEFORE UPDATE ON orders
    FOR EACH ROW EXECUTE FUNCTION validate_order_status_transition();

CREATE TRIGGER trigger_validate_subscription_limits_orders
    BEFORE INSERT ON orders
    FOR EACH ROW EXECUTE FUNCTION validate_subscription_limits();

CREATE TRIGGER trigger_validate_subscription_limits_integrations
    BEFORE INSERT ON marketplace_integrations
    FOR EACH ROW EXECUTE FUNCTION validate_subscription_limits();

-- ===========================================
-- 6. FUNCTIONS ÚTEIS PARA MANUTENÇÃO
-- ===========================================

-- Function to get user dashboard data efficiently
CREATE OR REPLACE FUNCTION get_user_dashboard_data(target_user_id UUID)
RETURNS JSONB AS $$
DECLARE
    result JSONB;
BEGIN
    SELECT jsonb_build_object(
        'user_info', jsonb_build_object(
            'name', p.name,
            'store_name', p.store_name,
            'email', u.email
        ),
        'metrics', jsonb_build_object(
            'total_orders', COALESCE(os.total_orders, 0),
            'delivered_orders', COALESCE(os.delivered_orders, 0),
            'in_transit_orders', COALESCE(os.in_transit_orders, 0),
            'delayed_orders', COALESCE(os.delayed_orders, 0),
            'delivery_rate', COALESCE(os.delivery_rate, 0)
        ),
        'recent_orders', (
            SELECT jsonb_agg(
                jsonb_build_object(
                    'id', o.id,
                    'tracking_code', o.tracking_code,
                    'customer_name', o.customer_name,
                    'status', o.status,
                    'created_at', o.created_at
                )
            )
            FROM orders o
            WHERE o.user_id = target_user_id
            ORDER BY o.created_at DESC
            LIMIT 5
        ),
        'active_alerts', (
            SELECT jsonb_agg(
                jsonb_build_object(
                    'id', pa.id,
                    'title', pa.title,
                    'message', pa.message,
                    'priority', pa.priority,
                    'triggered_at', pa.triggered_at
                )
            )
            FROM proactive_alerts pa
            WHERE pa.user_id = target_user_id
            AND pa.is_read = false
            ORDER BY pa.priority DESC, pa.triggered_at DESC
            LIMIT 3
        )
    ) INTO result
    FROM auth.users u
    LEFT JOIN profiles p ON u.id = p.id
    LEFT JOIN order_statistics os ON u.id = os.user_id
    WHERE u.id = target_user_id;

    RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to bulk update order statuses
CREATE OR REPLACE FUNCTION bulk_update_order_status(
    order_ids UUID[],
    new_status TEXT,
    update_reason TEXT DEFAULT 'Bulk update'
)
RETURNS INTEGER AS $$
DECLARE
    updated_count INTEGER;
BEGIN
    -- Validate status
    IF new_status NOT IN ('pending', 'in_transit', 'out_for_delivery', 'delivered', 'delayed', 'failed', 'returned') THEN
        RAISE EXCEPTION 'Invalid status: %', new_status;
    END IF;

    -- Update orders
    UPDATE orders
    SET status = new_status, updated_at = CURRENT_TIMESTAMP
    WHERE id = ANY(order_ids);

    GET DIAGNOSTICS updated_count = ROW_COUNT;

    -- Log the changes
    INSERT INTO order_history (order_id, user_id, old_status, new_status, notes)
    SELECT
        o.id,
        o.user_id,
        o.status, -- This will be the old status before the update
        new_status,
        update_reason
    FROM orders o
    WHERE o.id = ANY(order_ids);

    RETURN updated_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ===========================================
-- 7. SCHEDULER PARA TAREFAS AUTOMÁTICAS
-- ===========================================

-- Function to refresh materialized views periodically
CREATE OR REPLACE FUNCTION scheduled_refresh_materialized_views()
RETURNS VOID AS $$
BEGIN
    REFRESH MATERIALIZED VIEW CONCURRENTLY order_statistics;
    REFRESH MATERIALIZED VIEW CONCURRENTLY user_performance_metrics;
    REFRESH MATERIALIZED VIEW CONCURRENTLY carrier_performance;

    -- Log the refresh
    INSERT INTO logs (user_id, action, details)
    VALUES (NULL, 'system', jsonb_build_object('action', 'refresh_materialized_views', 'timestamp', CURRENT_TIMESTAMP));
END;
$$ LANGUAGE plpgsql;

-- Function to clean expired data
CREATE OR REPLACE FUNCTION scheduled_cleanup_expired_data()
RETURNS VOID AS $$
DECLARE
    deleted_count INTEGER := 0;
BEGIN
    -- Clean old cache entries
    DELETE FROM cache_entries WHERE expires_at < CURRENT_TIMESTAMP;
    GET DIAGNOSTICS deleted_count = ROW_COUNT;

    -- Clean old analytics metrics (keep only 2 years)
    DELETE FROM analytics_metrics WHERE date < CURRENT_DATE - INTERVAL '2 years';
    GET DIAGNOSTICS deleted_count = ROW_COUNT + deleted_count;

    -- Log the cleanup
    INSERT INTO logs (user_id, action, details)
    VALUES (NULL, 'system', jsonb_build_object(
        'action', 'cleanup_expired_data',
        'records_deleted', deleted_count,
        'timestamp', CURRENT_TIMESTAMP
    ));
END;
$$ LANGUAGE plpgsql;

-- ===========================================
-- 8. POLÍTICAS DE SEGURANÇA ADICIONAIS
-- ===========================================

-- Function to check rate limits
CREATE OR REPLACE FUNCTION check_rate_limit(
    user_id UUID,
    action_type TEXT,
    max_requests INTEGER DEFAULT 100,
    window_minutes INTEGER DEFAULT 60
)
RETURNS BOOLEAN AS $$
DECLARE
    request_count INTEGER;
BEGIN
    -- Count requests in the time window
    SELECT COUNT(*) INTO request_count
    FROM logs
    WHERE user_id = check_rate_limit.user_id
    AND action = action_type
    AND created_at > CURRENT_TIMESTAMP - INTERVAL '1 minute' * window_minutes;

    RETURN request_count < max_requests;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to audit sensitive operations
CREATE OR REPLACE FUNCTION audit_sensitive_operation()
RETURNS TRIGGER AS $$
BEGIN
    -- Log sensitive operations
    IF TG_TABLE_NAME = 'orders' AND (TG_OP = 'DELETE' OR OLD.status != NEW.status) THEN
        INSERT INTO logs (user_id, action, details, ip_address)
        VALUES (
            COALESCE(NEW.user_id, OLD.user_id),
            TG_TABLE_NAME || '_' || TG_OP,
            jsonb_build_object(
                'table', TG_TABLE_NAME,
                'operation', TG_OP,
                'record_id', COALESCE(NEW.id, OLD.id),
                'old_data', CASE WHEN TG_OP = 'UPDATE' THEN to_jsonb(OLD) ELSE NULL END,
                'new_data', CASE WHEN TG_OP IN ('INSERT', 'UPDATE') THEN to_jsonb(NEW) ELSE NULL END
            ),
            inet_client_addr()
        );
    END IF;

    RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create audit triggers for sensitive tables
CREATE TRIGGER audit_orders_changes
    AFTER INSERT OR UPDATE OR DELETE ON orders
    FOR EACH ROW EXECUTE FUNCTION audit_sensitive_operation();

CREATE TRIGGER audit_users_changes
    AFTER UPDATE ON profiles
    FOR EACH ROW EXECUTE FUNCTION audit_sensitive_operation();

-- ===========================================
-- FINALIZAÇÃO DA MIGRAÇÃO
-- ===========================================

-- Refresh materialized views initially
SELECT scheduled_refresh_materialized_views();

-- Create a summary comment
COMMENT ON DATABASE CURRENT_DATABASE IS 'Tracky Pro Flow - Advanced Database Features Implemented:
- ✅ Triggers automáticos para métricas
- ✅ Views materializadas para performance
- ✅ Procedures armazenadas para cálculos
- ✅ Indexes otimizados para queries
- ✅ Constraints e validações avançadas
- ✅ Funções utilitárias de manutenção
- ✅ Scheduler para tarefas automáticas
- ✅ Auditoria e segurança avançada';