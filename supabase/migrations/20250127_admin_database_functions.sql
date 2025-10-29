-- ============================================================================
-- ADMIN DATABASE FUNCTIONS
-- Funções RPC para operações administrativas de banco de dados
-- ============================================================================

-- Função para obter estatísticas do banco de dados
CREATE OR REPLACE FUNCTION get_database_stats()
RETURNS JSON AS $$
DECLARE
  result JSON;
  db_size TEXT;
  table_count INTEGER;
  total_rows BIGINT;
  cache_ratio NUMERIC;
  active_conn INTEGER;
  max_conn INTEGER;
BEGIN
  -- Tamanho do banco de dados
  SELECT pg_size_pretty(pg_database_size(current_database())) INTO db_size;
  
  -- Número de tabelas no schema public
  SELECT COUNT(*)::INTEGER
  FROM information_schema.tables
  WHERE table_schema = 'public'
  INTO table_count;
  
  -- Total de linhas (aproximado)
  SELECT SUM(reltuples)::BIGINT
  FROM pg_class
  WHERE relkind = 'r' AND relnamespace = 'public'::regnamespace
  INTO total_rows;
  
  -- Cache hit ratio
  SELECT 
    ROUND(
      100.0 * sum(blks_hit) / NULLIF(sum(blks_hit) + sum(blks_read), 0),
      2
    )
  FROM pg_stat_database
  WHERE datname = current_database()
  INTO cache_ratio;
  
  -- Conexões ativas
  SELECT COUNT(*)::INTEGER
  FROM pg_stat_activity
  WHERE state = 'active'
  INTO active_conn;
  
  -- Máximo de conexões
  SELECT setting::INTEGER
  FROM pg_settings
  WHERE name = 'max_connections'
  INTO max_conn;
  
  -- Construir resultado JSON
  result := json_build_object(
    'total_size', db_size,
    'total_tables', table_count,
    'total_rows', COALESCE(total_rows, 0),
    'cache_hit_ratio', COALESCE(cache_ratio, 0),
    'active_connections', active_conn,
    'max_connections', max_conn
  );
  
  RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Função para obter informações sobre tabelas
CREATE OR REPLACE FUNCTION get_table_info()
RETURNS TABLE(
  name TEXT,
  rows BIGINT,
  size TEXT,
  last_vacuum TEXT
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    c.relname::TEXT,
    c.reltuples::BIGINT,
    pg_size_pretty(pg_total_relation_size(c.oid))::TEXT,
    COALESCE(
      to_char(s.last_vacuum, 'YYYY-MM-DD HH24:MI:SS'),
      'Never'
    )::TEXT
  FROM pg_class c
  LEFT JOIN pg_stat_user_tables s ON s.relname = c.relname
  WHERE c.relkind = 'r'
    AND c.relnamespace = 'public'::regnamespace
  ORDER BY pg_total_relation_size(c.oid) DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Função para criar backup (placeholder - implementação depende do ambiente)
CREATE OR REPLACE FUNCTION create_database_backup()
RETURNS TEXT AS $$
DECLARE
  backup_id TEXT;
BEGIN
  -- Gerar ID do backup
  backup_id := 'backup_' || to_char(NOW(), 'YYYYMMDD_HH24MISS');
  
  -- Em produção, isso dispararia um processo de backup real
  -- Por enquanto, apenas registra a solicitação
  INSERT INTO admin_logs (
    action,
    activity_type,
    description,
    severity,
    metadata
  ) VALUES (
    'CREATE_BACKUP',
    'admin_action',
    'Database backup requested',
    'info',
    json_build_object('backup_id', backup_id)::jsonb
  );
  
  RETURN backup_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Função para otimizar tabela
CREATE OR REPLACE FUNCTION optimize_table(table_name TEXT)
RETURNS VOID AS $$
BEGIN
  -- VACUUM e ANALYZE na tabela especificada
  EXECUTE format('VACUUM ANALYZE %I', table_name);
  
  -- Registrar a operação
  INSERT INTO admin_logs (
    action,
    activity_type,
    description,
    severity,
    metadata
  ) VALUES (
    'OPTIMIZE_TABLE',
    'admin_action',
    format('Table %s optimized', table_name),
    'info',
    json_build_object('table_name', table_name)::jsonb
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Função para limpar dados antigos
CREATE OR REPLACE FUNCTION clean_old_data(days_old INTEGER DEFAULT 90)
RETURNS JSON AS $$
DECLARE
  deleted_logs INTEGER;
  deleted_activities INTEGER;
  result JSON;
BEGIN
  -- Deletar logs antigos
  DELETE FROM admin_logs
  WHERE created_at < NOW() - INTERVAL '1 day' * days_old
    AND severity NOT IN ('critical', 'error');
  
  GET DIAGNOSTICS deleted_logs = ROW_COUNT;
  
  -- Deletar atividades antigas
  DELETE FROM user_activities
  WHERE created_at < NOW() - INTERVAL '1 day' * days_old;
  
  GET DIAGNOSTICS deleted_activities = ROW_COUNT;
  
  -- Registrar a limpeza
  INSERT INTO admin_logs (
    action,
    activity_type,
    description,
    severity,
    metadata
  ) VALUES (
    'CLEAN_OLD_DATA',
    'admin_action',
    format('Cleaned data older than %s days', days_old),
    'info',
    json_build_object(
      'days_old', days_old,
      'deleted_logs', deleted_logs,
      'deleted_activities', deleted_activities
    )::jsonb
  );
  
  result := json_build_object(
    'deleted_logs', deleted_logs,
    'deleted_activities', deleted_activities
  );
  
  RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Função para obter métricas de performance
CREATE OR REPLACE FUNCTION get_performance_metrics()
RETURNS JSON AS $$
DECLARE
  result JSON;
  queries_per_sec NUMERIC;
  avg_query_time NUMERIC;
  slow_queries INTEGER;
BEGIN
  -- Queries por segundo (aproximado das últimas 24h)
  SELECT 
    ROUND((xact_commit + xact_rollback) / 
          EXTRACT(EPOCH FROM (NOW() - stats_reset)) * 1.0, 2)
  FROM pg_stat_database
  WHERE datname = current_database()
  INTO queries_per_sec;
  
  -- Tempo médio de query (em ms)
  SELECT ROUND(mean_exec_time, 2)
  FROM pg_stat_statements
  ORDER BY mean_exec_time DESC
  LIMIT 1
  INTO avg_query_time;
  
  -- Queries lentas (> 1s)
  SELECT COUNT(*)::INTEGER
  FROM pg_stat_statements
  WHERE mean_exec_time > 1000
  INTO slow_queries;
  
  result := json_build_object(
    'queries_per_second', COALESCE(queries_per_sec, 0),
    'avg_query_time_ms', COALESCE(avg_query_time, 0),
    'slow_queries', COALESCE(slow_queries, 0)
  );
  
  RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Conceder permissões para authenticated users (admins)
GRANT EXECUTE ON FUNCTION get_database_stats() TO authenticated;
GRANT EXECUTE ON FUNCTION get_table_info() TO authenticated;
GRANT EXECUTE ON FUNCTION create_database_backup() TO authenticated;
GRANT EXECUTE ON FUNCTION optimize_table(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION clean_old_data(INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION get_performance_metrics() TO authenticated;

-- Comentários
COMMENT ON FUNCTION get_database_stats() IS 'Retorna estatísticas gerais do banco de dados';
COMMENT ON FUNCTION get_table_info() IS 'Retorna informações sobre todas as tabelas';
COMMENT ON FUNCTION create_database_backup() IS 'Cria um backup do banco de dados';
COMMENT ON FUNCTION optimize_table(TEXT) IS 'Otimiza uma tabela específica (VACUUM ANALYZE)';
COMMENT ON FUNCTION clean_old_data(INTEGER) IS 'Remove dados antigos baseado em dias';
COMMENT ON FUNCTION get_performance_metrics() IS 'Retorna métricas de performance do banco';
