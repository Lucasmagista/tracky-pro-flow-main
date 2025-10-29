-- =====================================================
-- TRIGGERS AUTOMÁTICOS PARA ATUALIZAR MÉTRICAS
-- =====================================================

-- Trigger para atualizar updated_at automaticamente
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Aplicar trigger em todas as tabelas relevantes
CREATE TRIGGER update_orders_updated_at BEFORE UPDATE ON orders
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_customers_updated_at BEFORE UPDATE ON customers
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON profiles
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_notification_templates_updated_at BEFORE UPDATE ON notification_templates
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Trigger para criar registro de histórico automaticamente
CREATE OR REPLACE FUNCTION create_order_history()
RETURNS TRIGGER AS $$
BEGIN
    IF (TG_OP = 'UPDATE' AND OLD.status IS DISTINCT FROM NEW.status) THEN
        INSERT INTO order_history (
            order_id,
            status,
            location,
            description,
            occurred_at
        ) VALUES (
            NEW.id,
            NEW.status,
            NEW.destination,
            'Status atualizado automaticamente',
            NOW()
        );
    END IF;
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER track_order_status_changes AFTER UPDATE ON orders
    FOR EACH ROW EXECUTE FUNCTION create_order_history();

-- Trigger para atualizar métricas em tempo real
CREATE OR REPLACE FUNCTION update_analytics_metrics()
RETURNS TRIGGER AS $$
DECLARE
    metric_date DATE;
    user_uuid UUID;
BEGIN
    metric_date := CURRENT_DATE;
    user_uuid := NEW.user_id;

    -- Atualizar total de pedidos
    INSERT INTO analytics_metrics (user_id, metric_type, metric_name, value, period_start, period_end)
    VALUES (
        user_uuid,
        'orders',
        'total_orders',
        1,
        metric_date,
        metric_date
    )
    ON CONFLICT (user_id, metric_type, metric_name, period_start, period_end)
    DO UPDATE SET 
        value = analytics_metrics.value + 1,
        updated_at = NOW();

    -- Atualizar por status
    INSERT INTO analytics_metrics (user_id, metric_type, metric_name, value, period_start, period_end, metadata)
    VALUES (
        user_uuid,
        'status',
        NEW.status,
        1,
        metric_date,
        metric_date,
        jsonb_build_object('status', NEW.status)
    )
    ON CONFLICT (user_id, metric_type, metric_name, period_start, period_end)
    DO UPDATE SET 
        value = analytics_metrics.value + 1,
        updated_at = NOW();

    -- Atualizar por transportadora
    INSERT INTO analytics_metrics (user_id, metric_type, metric_name, value, period_start, period_end, metadata)
    VALUES (
        user_uuid,
        'carrier',
        NEW.carrier,
        1,
        metric_date,
        metric_date,
        jsonb_build_object('carrier', NEW.carrier)
    )
    ON CONFLICT (user_id, metric_type, metric_name, period_start, period_end)
    DO UPDATE SET 
        value = analytics_metrics.value + 1,
        updated_at = NOW();

    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER calculate_metrics_on_order_insert AFTER INSERT ON orders
    FOR EACH ROW EXECUTE FUNCTION update_analytics_metrics();

-- Trigger para limpar cache de tracking expirado
CREATE OR REPLACE FUNCTION clean_expired_tracking_cache()
RETURNS TRIGGER AS $$
BEGIN
    DELETE FROM tracking_cache 
    WHERE expires_at < NOW() - INTERVAL '1 hour';
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER cleanup_tracking_cache AFTER INSERT ON tracking_cache
    FOR EACH STATEMENT EXECUTE FUNCTION clean_expired_tracking_cache();

-- =====================================================
-- VIEWS MATERIALIZADAS PARA PERFORMANCE
-- =====================================================

-- View materializada: Dashboard summary por usuário
CREATE MATERIALIZED VIEW IF NOT EXISTS dashboard_summary AS
SELECT 
    o.user_id,
    COUNT(*) as total_orders,
    COUNT(*) FILTER (WHERE o.status = 'delivered') as delivered_orders,
    COUNT(*) FILTER (WHERE o.status = 'in_transit') as in_transit_orders,
    COUNT(*) FILTER (WHERE o.status = 'delayed') as delayed_orders,
    COUNT(*) FILTER (WHERE o.status = 'pending') as pending_orders,
    ROUND(
        (COUNT(*) FILTER (WHERE o.status = 'delivered')::numeric / NULLIF(COUNT(*), 0)) * 100,
        2
    ) as delivery_rate,
    AVG(
        EXTRACT(EPOCH FROM (o.delivered_at - o.created_at)) / 86400
    ) FILTER (WHERE o.status = 'delivered') as avg_delivery_days,
    MAX(o.updated_at) as last_updated
FROM orders o
GROUP BY o.user_id;

CREATE UNIQUE INDEX ON dashboard_summary (user_id);

-- View materializada: Performance por transportadora
CREATE MATERIALIZED VIEW IF NOT EXISTS carrier_performance AS
SELECT 
    o.user_id,
    o.carrier,
    COUNT(*) as total_deliveries,
    COUNT(*) FILTER (WHERE o.status = 'delivered') as successful_deliveries,
    COUNT(*) FILTER (WHERE o.status = 'delayed') as delayed_deliveries,
    ROUND(
        (COUNT(*) FILTER (WHERE o.status = 'delivered')::numeric / NULLIF(COUNT(*), 0)) * 100,
        2
    ) as success_rate,
    AVG(
        EXTRACT(EPOCH FROM (o.delivered_at - o.created_at)) / 86400
    ) FILTER (WHERE o.status = 'delivered') as avg_delivery_days,
    MAX(o.updated_at) as last_updated
FROM orders o
WHERE o.carrier IS NOT NULL
GROUP BY o.user_id, o.carrier;

CREATE UNIQUE INDEX ON carrier_performance (user_id, carrier);

-- View materializada: Tendências temporais (últimos 30 dias)
CREATE MATERIALIZED VIEW IF NOT EXISTS temporal_trends AS
SELECT 
    o.user_id,
    DATE(o.created_at) as date,
    COUNT(*) as orders_count,
    COUNT(*) FILTER (WHERE o.status = 'delivered') as delivered_count,
    COUNT(*) FILTER (WHERE o.status = 'in_transit') as in_transit_count,
    COUNT(*) FILTER (WHERE o.status = 'delayed') as delayed_count
FROM orders o
WHERE o.created_at >= CURRENT_DATE - INTERVAL '30 days'
GROUP BY o.user_id, DATE(o.created_at);

CREATE UNIQUE INDEX ON temporal_trends (user_id, date);

-- View materializada: Top customers
CREATE MATERIALIZED VIEW IF NOT EXISTS top_customers AS
SELECT 
    o.user_id,
    o.customer_name,
    o.customer_email,
    COUNT(*) as total_orders,
    MAX(o.created_at) as last_order_date
FROM orders o
WHERE o.customer_name IS NOT NULL
GROUP BY o.user_id, o.customer_name, o.customer_email
ORDER BY total_orders DESC;

CREATE INDEX ON top_customers (user_id, total_orders DESC);

-- =====================================================
-- PROCEDURES ARMAZENADAS PARA CÁLCULOS COMPLEXOS
-- =====================================================

-- Procedure: Calcular métricas do dashboard
CREATE OR REPLACE FUNCTION calculate_dashboard_metrics(p_user_id UUID, p_start_date DATE, p_end_date DATE)
RETURNS TABLE (
    total_orders BIGINT,
    delivered_orders BIGINT,
    in_transit_orders BIGINT,
    delayed_orders BIGINT,
    pending_orders BIGINT,
    delivery_rate NUMERIC,
    avg_delivery_days NUMERIC
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        COUNT(*)::BIGINT as total_orders,
        COUNT(*) FILTER (WHERE o.status = 'delivered')::BIGINT as delivered_orders,
        COUNT(*) FILTER (WHERE o.status = 'in_transit')::BIGINT as in_transit_orders,
        COUNT(*) FILTER (WHERE o.status = 'delayed')::BIGINT as delayed_orders,
        COUNT(*) FILTER (WHERE o.status = 'pending')::BIGINT as pending_orders,
        ROUND(
            (COUNT(*) FILTER (WHERE o.status = 'delivered')::numeric / NULLIF(COUNT(*), 0)) * 100,
            2
        ) as delivery_rate,
        ROUND(
            AVG(EXTRACT(EPOCH FROM (o.delivered_at - o.created_at)) / 86400) 
            FILTER (WHERE o.status = 'delivered'),
            2
        ) as avg_delivery_days
    FROM orders o
    WHERE o.user_id = p_user_id
        AND o.created_at::DATE BETWEEN p_start_date AND p_end_date;
END;
$$ LANGUAGE plpgsql STABLE;

-- Procedure: Obter performance por transportadora
CREATE OR REPLACE FUNCTION get_carrier_performance(p_user_id UUID, p_days INTEGER DEFAULT 30)
RETURNS TABLE (
    carrier VARCHAR,
    total_deliveries BIGINT,
    successful_deliveries BIGINT,
    delayed_deliveries BIGINT,
    success_rate NUMERIC,
    avg_delivery_days NUMERIC
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        o.carrier,
        COUNT(*)::BIGINT as total_deliveries,
        COUNT(*) FILTER (WHERE o.status = 'delivered')::BIGINT as successful_deliveries,
        COUNT(*) FILTER (WHERE o.status = 'delayed')::BIGINT as delayed_deliveries,
        ROUND(
            (COUNT(*) FILTER (WHERE o.status = 'delivered')::numeric / NULLIF(COUNT(*), 0)) * 100,
            2
        ) as success_rate,
        ROUND(
            AVG(EXTRACT(EPOCH FROM (o.delivered_at - o.created_at)) / 86400) 
            FILTER (WHERE o.status = 'delivered'),
            2
        ) as avg_delivery_days
    FROM orders o
    WHERE o.user_id = p_user_id
        AND o.carrier IS NOT NULL
        AND o.created_at >= CURRENT_DATE - (p_days || ' days')::INTERVAL
    GROUP BY o.carrier
    ORDER BY total_deliveries DESC;
END;
$$ LANGUAGE plpgsql STABLE;

-- Procedure: Obter tendência temporal
CREATE OR REPLACE FUNCTION get_temporal_trend(p_user_id UUID, p_days INTEGER DEFAULT 30)
RETURNS TABLE (
    date DATE,
    orders_count BIGINT,
    delivered_count BIGINT,
    in_transit_count BIGINT,
    delayed_count BIGINT
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        DATE(o.created_at) as date,
        COUNT(*)::BIGINT as orders_count,
        COUNT(*) FILTER (WHERE o.status = 'delivered')::BIGINT as delivered_count,
        COUNT(*) FILTER (WHERE o.status = 'in_transit')::BIGINT as in_transit_count,
        COUNT(*) FILTER (WHERE o.status = 'delayed')::BIGINT as delayed_count
    FROM orders o
    WHERE o.user_id = p_user_id
        AND o.created_at >= CURRENT_DATE - (p_days || ' days')::INTERVAL
    GROUP BY DATE(o.created_at)
    ORDER BY date DESC;
END;
$$ LANGUAGE plpgsql STABLE;

-- Procedure: Refresh todas as materialized views
CREATE OR REPLACE FUNCTION refresh_all_materialized_views()
RETURNS void AS $$
BEGIN
    REFRESH MATERIALIZED VIEW CONCURRENTLY dashboard_summary;
    REFRESH MATERIALIZED VIEW CONCURRENTLY carrier_performance;
    REFRESH MATERIALIZED VIEW CONCURRENTLY temporal_trends;
    REFRESH MATERIALIZED VIEW CONCURRENTLY top_customers;
END;
$$ LANGUAGE plpgsql;

-- Procedure: Detectar pedidos com atraso
CREATE OR REPLACE FUNCTION detect_delayed_orders(p_user_id UUID)
RETURNS TABLE (
    order_id UUID,
    tracking_code VARCHAR,
    customer_name VARCHAR,
    carrier VARCHAR,
    days_delayed INTEGER,
    estimated_delivery TIMESTAMP
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        o.id as order_id,
        o.tracking_code,
        o.customer_name,
        o.carrier,
        EXTRACT(DAY FROM (NOW() - o.estimated_delivery))::INTEGER as days_delayed,
        o.estimated_delivery
    FROM orders o
    WHERE o.user_id = p_user_id
        AND o.status IN ('in_transit', 'pending')
        AND o.estimated_delivery < NOW()
    ORDER BY days_delayed DESC;
END;
$$ LANGUAGE plpgsql STABLE;

-- Procedure: Importar pedidos em lote com validação
CREATE OR REPLACE FUNCTION bulk_import_orders(
    p_user_id UUID,
    p_orders JSONB
)
RETURNS TABLE (
    success BOOLEAN,
    inserted_count INTEGER,
    failed_count INTEGER,
    errors JSONB
) AS $$
DECLARE
    v_order JSONB;
    v_inserted INTEGER := 0;
    v_failed INTEGER := 0;
    v_errors JSONB := '[]'::JSONB;
    v_order_id UUID;
BEGIN
    -- Iterar sobre cada pedido
    FOR v_order IN SELECT * FROM jsonb_array_elements(p_orders)
    LOOP
        BEGIN
            -- Tentar inserir o pedido
            INSERT INTO orders (
                user_id,
                tracking_code,
                customer_name,
                customer_email,
                customer_phone,
                carrier,
                status,
                destination,
                origin
            ) VALUES (
                p_user_id,
                v_order->>'tracking_code',
                v_order->>'customer_name',
                v_order->>'customer_email',
                v_order->>'customer_phone',
                v_order->>'carrier',
                COALESCE(v_order->>'status', 'pending'),
                v_order->>'destination',
                v_order->>'origin'
            )
            RETURNING id INTO v_order_id;
            
            v_inserted := v_inserted + 1;
            
        EXCEPTION WHEN OTHERS THEN
            v_failed := v_failed + 1;
            v_errors := v_errors || jsonb_build_object(
                'tracking_code', v_order->>'tracking_code',
                'error', SQLERRM
            );
        END;
    END LOOP;

    RETURN QUERY SELECT 
        (v_failed = 0) as success,
        v_inserted as inserted_count,
        v_failed as failed_count,
        v_errors as errors;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- INDEXES OTIMIZADOS PARA QUERIES FREQUENTES
-- =====================================================

-- Indexes compostos para filtros comuns
CREATE INDEX IF NOT EXISTS idx_orders_user_status ON orders(user_id, status);
CREATE INDEX IF NOT EXISTS idx_orders_user_carrier ON orders(user_id, carrier);
CREATE INDEX IF NOT EXISTS idx_orders_user_created ON orders(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_orders_user_updated ON orders(user_id, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_orders_tracking_code ON orders(tracking_code);

-- Indexes para busca full-text
CREATE INDEX IF NOT EXISTS idx_orders_customer_name ON orders USING gin(to_tsvector('portuguese', customer_name));
CREATE INDEX IF NOT EXISTS idx_orders_customer_email ON orders USING gin(to_tsvector('simple', customer_email));

-- Indexes para analytics
CREATE INDEX IF NOT EXISTS idx_analytics_metrics_user_period ON analytics_metrics(user_id, period_start, period_end);
CREATE INDEX IF NOT EXISTS idx_analytics_metrics_type ON analytics_metrics(metric_type, metric_name);

-- Indexes para notificações
CREATE INDEX IF NOT EXISTS idx_notifications_user_sent ON notifications(user_id, sent_at DESC);
CREATE INDEX IF NOT EXISTS idx_notification_logs_notification ON notification_logs(notification_id);

-- =====================================================
-- FUNÇÕES AUXILIARES
-- =====================================================

-- Função para gerar relatório completo
CREATE OR REPLACE FUNCTION generate_report(p_user_id UUID, p_start_date DATE, p_end_date DATE)
RETURNS JSONB AS $$
DECLARE
    v_report JSONB;
BEGIN
    SELECT jsonb_build_object(
        'period', jsonb_build_object(
            'start', p_start_date,
            'end', p_end_date
        ),
        'summary', (
            SELECT to_jsonb(r.*) 
            FROM calculate_dashboard_metrics(p_user_id, p_start_date, p_end_date) r
        ),
        'carriers', (
            SELECT jsonb_agg(to_jsonb(c.*))
            FROM get_carrier_performance(p_user_id, p_end_date - p_start_date) c
        ),
        'trend', (
            SELECT jsonb_agg(to_jsonb(t.*))
            FROM get_temporal_trend(p_user_id, p_end_date - p_start_date) t
        ),
        'delayed_orders', (
            SELECT jsonb_agg(to_jsonb(d.*))
            FROM detect_delayed_orders(p_user_id) d
        )
    ) INTO v_report;
    
    RETURN v_report;
END;
$$ LANGUAGE plpgsql STABLE;

-- Comentários nas funções
COMMENT ON FUNCTION calculate_dashboard_metrics IS 'Calcula métricas principais do dashboard para um período';
COMMENT ON FUNCTION get_carrier_performance IS 'Retorna performance detalhada por transportadora';
COMMENT ON FUNCTION get_temporal_trend IS 'Retorna tendência temporal de pedidos';
COMMENT ON FUNCTION detect_delayed_orders IS 'Detecta pedidos com atraso baseado na data estimada';
COMMENT ON FUNCTION bulk_import_orders IS 'Importa múltiplos pedidos em lote com validação e tratamento de erros';
COMMENT ON FUNCTION generate_report IS 'Gera relatório completo em formato JSON';
