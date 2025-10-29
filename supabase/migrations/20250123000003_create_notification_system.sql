-- =====================================================
-- SISTEMA COMPLETO DE NOTIFICAÇÕES
-- =====================================================
-- Criado em: 2025-01-23
-- Descrição: Tabelas e funções para sistema de notificações
--            com suporte a múltiplos canais (Email, SMS, WhatsApp)

-- =====================================================
-- TABELA: notification_providers
-- =====================================================
-- Armazena configurações de provedores de notificação
CREATE TABLE IF NOT EXISTS notification_providers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  provider VARCHAR(50) NOT NULL CHECK (provider IN ('smtp', 'twilio', 'whatsapp')),
  is_enabled BOOLEAN DEFAULT false,
  config JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Garantir um provedor por usuário
  UNIQUE(user_id, provider)
);

-- Índices
CREATE INDEX idx_notification_providers_user_id ON notification_providers(user_id);
CREATE INDEX idx_notification_providers_enabled ON notification_providers(user_id, is_enabled) WHERE is_enabled = true;

-- RLS Policies
ALTER TABLE notification_providers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own provider configs"
  ON notification_providers FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own provider configs"
  ON notification_providers FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own provider configs"
  ON notification_providers FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own provider configs"
  ON notification_providers FOR DELETE
  USING (auth.uid() = user_id);

-- Trigger para atualizar updated_at
CREATE TRIGGER update_notification_providers_updated_at
  BEFORE UPDATE ON notification_providers
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- =====================================================
-- ATUALIZAR TABELA: notification_logs
-- =====================================================
-- Adicionar campos extras se não existirem
DO $$ 
BEGIN
  -- Adicionar user_id se não existir
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'notification_logs' AND column_name = 'user_id'
  ) THEN
    ALTER TABLE notification_logs ADD COLUMN user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;
    CREATE INDEX idx_notification_logs_user_id ON notification_logs(user_id);
  END IF;

  -- Adicionar delivery_status se não existir
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'notification_logs' AND column_name = 'delivery_status'
  ) THEN
    ALTER TABLE notification_logs ADD COLUMN delivery_status VARCHAR(50) DEFAULT 'pending';
  END IF;

  -- Adicionar metadata se não existir
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'notification_logs' AND column_name = 'metadata'
  ) THEN
    ALTER TABLE notification_logs ADD COLUMN metadata JSONB DEFAULT '{}';
  END IF;
END $$;

-- Índices adicionais para performance
CREATE INDEX IF NOT EXISTS idx_notification_logs_status ON notification_logs(status);
CREATE INDEX IF NOT EXISTS idx_notification_logs_channel ON notification_logs(channel);
CREATE INDEX IF NOT EXISTS idx_notification_logs_created_at ON notification_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notification_logs_user_status ON notification_logs(user_id, status);

-- =====================================================
-- ATUALIZAR TABELA: notification_templates
-- =====================================================
-- Garantir que a tabela tenha todos os campos necessários
DO $$ 
BEGIN
  -- Adicionar is_active se não existir
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'notification_templates' AND column_name = 'is_active'
  ) THEN
    ALTER TABLE notification_templates ADD COLUMN is_active BOOLEAN DEFAULT true;
  END IF;

  -- Adicionar variables array se não existir
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'notification_templates' AND column_name = 'variables'
  ) THEN
    ALTER TABLE notification_templates ADD COLUMN variables TEXT[] DEFAULT '{}';
  END IF;

  -- Adicionar event_type se não existir
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'notification_templates' AND column_name = 'event_type'
  ) THEN
    ALTER TABLE notification_templates ADD COLUMN event_type VARCHAR(100);
  END IF;

  -- Adicionar channel se não existir
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'notification_templates' AND column_name = 'channel'
  ) THEN
    ALTER TABLE notification_templates ADD COLUMN channel VARCHAR(50) CHECK (channel IN ('email', 'sms', 'whatsapp'));
  END IF;
END $$;

-- Índices para templates
CREATE INDEX IF NOT EXISTS idx_notification_templates_user_id ON notification_templates(user_id);
CREATE INDEX IF NOT EXISTS idx_notification_templates_event_type ON notification_templates(event_type);
CREATE INDEX IF NOT EXISTS idx_notification_templates_active ON notification_templates(user_id, is_active) WHERE is_active = true;

-- =====================================================
-- FUNÇÃO: get_notification_stats
-- =====================================================
-- Retorna estatísticas de notificações
CREATE OR REPLACE FUNCTION get_notification_stats(
  p_user_id UUID,
  p_days INTEGER DEFAULT 30
)
RETURNS TABLE (
  total_notifications BIGINT,
  sent_notifications BIGINT,
  failed_notifications BIGINT,
  delivery_rate NUMERIC,
  email_count BIGINT,
  sms_count BIGINT,
  whatsapp_count BIGINT
) AS $$
BEGIN
  RETURN QUERY
  WITH stats AS (
    SELECT
      COUNT(*) as total,
      COUNT(*) FILTER (WHERE status IN ('sent', 'delivered')) as sent,
      COUNT(*) FILTER (WHERE status = 'failed') as failed,
      COUNT(*) FILTER (WHERE channel = 'email') as email,
      COUNT(*) FILTER (WHERE channel = 'sms') as sms,
      COUNT(*) FILTER (WHERE channel = 'whatsapp') as whatsapp
    FROM notification_logs
    WHERE user_id = p_user_id
      AND created_at >= NOW() - (p_days || ' days')::INTERVAL
  )
  SELECT
    total,
    sent,
    failed,
    CASE WHEN total > 0 THEN ROUND((sent::NUMERIC / total::NUMERIC) * 100, 2) ELSE 0 END,
    email,
    sms,
    whatsapp
  FROM stats;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- FUNÇÃO: process_scheduled_notifications
-- =====================================================
-- Processa notificações agendadas que estão prontas para envio
CREATE OR REPLACE FUNCTION process_scheduled_notifications()
RETURNS INTEGER AS $$
DECLARE
  processed_count INTEGER := 0;
  notification_record RECORD;
BEGIN
  -- Buscar notificações pendentes que já passaram do horário
  FOR notification_record IN
    SELECT *
    FROM scheduled_notifications
    WHERE status = 'pending'
      AND scheduled_at <= NOW()
    ORDER BY scheduled_at ASC
    LIMIT 100
  LOOP
    -- Marcar como processando
    UPDATE scheduled_notifications
    SET status = 'processing'
    WHERE id = notification_record.id;
    
    -- Aqui você integraria com o serviço de envio real
    -- Por enquanto, apenas marcamos como enviado
    UPDATE scheduled_notifications
    SET 
      status = 'sent',
      sent_at = NOW()
    WHERE id = notification_record.id;
    
    processed_count := processed_count + 1;
  END LOOP;
  
  RETURN processed_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- FUNÇÃO: cleanup_old_notification_logs
-- =====================================================
-- Remove logs antigos de notificações
CREATE OR REPLACE FUNCTION cleanup_old_notification_logs(
  p_days_to_keep INTEGER DEFAULT 90
)
RETURNS INTEGER AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  DELETE FROM notification_logs
  WHERE created_at < NOW() - (p_days_to_keep || ' days')::INTERVAL
    AND status IN ('sent', 'delivered');
  
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  
  RETURN deleted_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- VIEW: notification_summary
-- =====================================================
-- View materializada para dashboard de notificações
CREATE MATERIALIZED VIEW IF NOT EXISTS notification_summary AS
SELECT
  nl.user_id,
  DATE(nl.created_at) as notification_date,
  nl.channel,
  nl.status,
  COUNT(*) as count,
  AVG(EXTRACT(EPOCH FROM (nl.sent_at - nl.created_at))) as avg_send_time_seconds
FROM notification_logs nl
WHERE nl.created_at >= NOW() - INTERVAL '90 days'
GROUP BY nl.user_id, DATE(nl.created_at), nl.channel, nl.status;

-- Índice para a view
CREATE UNIQUE INDEX idx_notification_summary_unique 
  ON notification_summary(user_id, notification_date, channel, status);

-- =====================================================
-- TRIGGER: auto_refresh_notification_summary
-- =====================================================
-- Atualiza a view materializada periodicamente
CREATE OR REPLACE FUNCTION refresh_notification_summary()
RETURNS TRIGGER AS $$
BEGIN
  REFRESH MATERIALIZED VIEW CONCURRENTLY notification_summary;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Trigger para refresh (executar manualmente ou via cron)
-- CREATE TRIGGER trigger_refresh_notification_summary
--   AFTER INSERT OR UPDATE ON notification_logs
--   FOR EACH STATEMENT
--   EXECUTE FUNCTION refresh_notification_summary();

-- =====================================================
-- COMENTÁRIOS
-- =====================================================
COMMENT ON TABLE notification_providers IS 'Configurações de provedores de notificação (SMTP, Twilio, WhatsApp)';
COMMENT ON FUNCTION get_notification_stats IS 'Retorna estatísticas agregadas de notificações';
COMMENT ON FUNCTION process_scheduled_notifications IS 'Processa fila de notificações agendadas';
COMMENT ON FUNCTION cleanup_old_notification_logs IS 'Remove logs antigos de notificações para economizar espaço';
COMMENT ON MATERIALIZED VIEW notification_summary IS 'Sumário diário de notificações por canal e status';

-- =====================================================
-- DADOS INICIAIS (OPCIONAL)
-- =====================================================
-- Você pode adicionar templates padrão aqui se desejar
