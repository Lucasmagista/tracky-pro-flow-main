-- =====================================================
-- MIGRATION 004: Sistema de Importação e Rollback
-- =====================================================
-- Cria tabelas para gerenciar importações de pedidos,
-- rastreamento de batches, rollback e integrações com APIs
-- =====================================================

-- 1. Tabela de batches de importação
-- =====================================================
CREATE TABLE IF NOT EXISTS import_batches (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  source TEXT NOT NULL CHECK (source IN ('csv', 'shopify', 'woocommerce', 'mercadolivre', 'manual')),
  total_records INTEGER NOT NULL,
  successful_records INTEGER DEFAULT 0,
  failed_records INTEGER DEFAULT 0,
  status TEXT NOT NULL CHECK (status IN ('pending', 'completed', 'rolled_back', 'partially_rolled_back')),
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  rolled_back_at TIMESTAMP WITH TIME ZONE,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. Tabela de registros individuais de importação
-- =====================================================
CREATE TABLE IF NOT EXISTS import_records (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  batch_id UUID NOT NULL REFERENCES import_batches(id) ON DELETE CASCADE,
  order_id UUID REFERENCES orders(id) ON DELETE SET NULL,
  tracking_code TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('imported', 'failed', 'rolled_back')),
  error_message TEXT,
  original_data JSONB NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. Tabela de configurações de integrações
-- =====================================================
CREATE TABLE IF NOT EXISTS integrations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  platform TEXT NOT NULL CHECK (platform IN ('shopify', 'woocommerce', 'mercadolivre')),
  config JSONB NOT NULL,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id, platform)
);

-- 4. Índices para performance
-- =====================================================
CREATE INDEX IF NOT EXISTS idx_import_batches_user_id ON import_batches(user_id);
CREATE INDEX IF NOT EXISTS idx_import_batches_status ON import_batches(status);
CREATE INDEX IF NOT EXISTS idx_import_batches_created_at ON import_batches(created_at);
CREATE INDEX IF NOT EXISTS idx_import_batches_source ON import_batches(source);

CREATE INDEX IF NOT EXISTS idx_import_records_batch_id ON import_records(batch_id);
CREATE INDEX IF NOT EXISTS idx_import_records_order_id ON import_records(order_id);
CREATE INDEX IF NOT EXISTS idx_import_records_status ON import_records(status);
CREATE INDEX IF NOT EXISTS idx_import_records_tracking_code ON import_records(tracking_code);

CREATE INDEX IF NOT EXISTS idx_integrations_user_id ON integrations(user_id);
CREATE INDEX IF NOT EXISTS idx_integrations_platform ON integrations(platform);
CREATE INDEX IF NOT EXISTS idx_integrations_is_active ON integrations(is_active);

-- 5. Row Level Security (RLS)
-- =====================================================
ALTER TABLE import_batches ENABLE ROW LEVEL SECURITY;
ALTER TABLE import_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE integrations ENABLE ROW LEVEL SECURITY;

-- 6. Políticas de segurança para import_batches
-- =====================================================
CREATE POLICY "Users can view own import batches"
  ON import_batches FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create own import batches"
  ON import_batches FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own import batches"
  ON import_batches FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own import batches"
  ON import_batches FOR DELETE
  USING (auth.uid() = user_id);

-- 7. Políticas de segurança para import_records
-- =====================================================
CREATE POLICY "Users can view own import records"
  ON import_records FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM import_batches 
    WHERE import_batches.id = import_records.batch_id 
    AND import_batches.user_id = auth.uid()
  ));

CREATE POLICY "Users can create own import records"
  ON import_records FOR INSERT
  WITH CHECK (EXISTS (
    SELECT 1 FROM import_batches 
    WHERE import_batches.id = import_records.batch_id 
    AND import_batches.user_id = auth.uid()
  ));

CREATE POLICY "Users can update own import records"
  ON import_records FOR UPDATE
  USING (EXISTS (
    SELECT 1 FROM import_batches 
    WHERE import_batches.id = import_records.batch_id 
    AND import_batches.user_id = auth.uid()
  ));

CREATE POLICY "Users can delete own import records"
  ON import_records FOR DELETE
  USING (EXISTS (
    SELECT 1 FROM import_batches 
    WHERE import_batches.id = import_records.batch_id 
    AND import_batches.user_id = auth.uid()
  ));

-- 8. Políticas de segurança para integrations
-- =====================================================
CREATE POLICY "Users can view own integrations"
  ON integrations FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create own integrations"
  ON integrations FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own integrations"
  ON integrations FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own integrations"
  ON integrations FOR DELETE
  USING (auth.uid() = user_id);

-- 9. Função para atualizar updated_at
-- =====================================================
-- Cria a função se ela não existir
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 10. Triggers para updated_at
-- =====================================================
DROP TRIGGER IF EXISTS update_import_batches_updated_at ON import_batches;
CREATE TRIGGER update_import_batches_updated_at
  BEFORE UPDATE ON import_batches
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_integrations_updated_at ON integrations;
CREATE TRIGGER update_integrations_updated_at
  BEFORE UPDATE ON integrations
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- 11. Comentários para documentação
-- =====================================================
COMMENT ON TABLE import_batches IS 'Armazena batches de importação de pedidos com estatísticas e metadados';
COMMENT ON TABLE import_records IS 'Registros individuais de cada pedido importado, permitindo rollback granular';
COMMENT ON TABLE integrations IS 'Configurações de integrações com plataformas de e-commerce (Shopify, WooCommerce, Mercado Livre)';

COMMENT ON COLUMN import_batches.source IS 'Origem da importação: csv, shopify, woocommerce, mercadolivre ou manual';
COMMENT ON COLUMN import_batches.status IS 'Status do batch: pending, completed, rolled_back ou partially_rolled_back';
COMMENT ON COLUMN import_batches.metadata IS 'Dados adicionais como nome do arquivo, IDs externos, etc';

COMMENT ON COLUMN import_records.original_data IS 'Dados originais do pedido antes da importação, usado para rollback';
COMMENT ON COLUMN import_records.status IS 'Status do registro: imported (sucesso), failed (erro) ou rolled_back (desfeito)';

COMMENT ON COLUMN integrations.config IS 'Configuração JSON da integração (tokens, URLs, credenciais)';
COMMENT ON COLUMN integrations.is_active IS 'Se a integração está ativa e sincronizando';

-- =====================================================
-- FIM DA MIGRATION 004
-- =====================================================
