-- =====================================================
-- MIGRATION 005: Integração Smartenvios + Nuvemshop
-- =====================================================
-- Adiciona suporte para Nuvemshop e Smartenvios
-- =====================================================

-- 1. Adicionar suporte à Nuvemshop na tabela de integrações
-- =====================================================
ALTER TABLE marketplace_integrations 
  DROP CONSTRAINT IF EXISTS marketplace_integrations_marketplace_check;

ALTER TABLE marketplace_integrations
  ADD CONSTRAINT marketplace_integrations_marketplace_check
  CHECK (marketplace IN ('shopify', 'woocommerce', 'mercadolivre', 'nuvemshop'));

-- 2. Tabela de configurações de transportadoras
-- =====================================================
-- Verificar se a tabela existe e adicionar colunas se necessário
DO $$ 
BEGIN
  -- Criar tabela se não existir
  IF NOT EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'carrier_integrations') THEN
    CREATE TABLE carrier_integrations (
      id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
      carrier TEXT NOT NULL CHECK (carrier IN (
        'correios', 'fedex', 'ups', 'dhl', 'usps', 
        'smartenvios', 'jadlog', 'total_express', 'azul_cargo', 'loggi'
      )),
      name TEXT NOT NULL,
      api_key TEXT,
      api_secret TEXT,
      environment TEXT DEFAULT 'production' CHECK (environment IN ('production', 'sandbox')),
      webhook_url TEXT,
      webhook_secret TEXT,
      is_active BOOLEAN DEFAULT TRUE,
      last_sync TIMESTAMP WITH TIME ZONE,
      settings JSONB DEFAULT '{}',
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
      UNIQUE(user_id, carrier)
    );
  END IF;

  -- Adicionar colunas que possam não existir
  IF NOT EXISTS (SELECT FROM information_schema.columns 
                 WHERE table_name = 'carrier_integrations' AND column_name = 'environment') THEN
    ALTER TABLE carrier_integrations ADD COLUMN environment TEXT DEFAULT 'production';
  END IF;

  IF NOT EXISTS (SELECT FROM information_schema.columns 
                 WHERE table_name = 'carrier_integrations' AND column_name = 'is_active') THEN
    ALTER TABLE carrier_integrations ADD COLUMN is_active BOOLEAN DEFAULT TRUE;
  END IF;

  IF NOT EXISTS (SELECT FROM information_schema.columns 
                 WHERE table_name = 'carrier_integrations' AND column_name = 'settings') THEN
    ALTER TABLE carrier_integrations ADD COLUMN settings JSONB DEFAULT '{}';
  END IF;

  IF NOT EXISTS (SELECT FROM information_schema.columns 
                 WHERE table_name = 'carrier_integrations' AND column_name = 'webhook_url') THEN
    ALTER TABLE carrier_integrations ADD COLUMN webhook_url TEXT;
  END IF;

  IF NOT EXISTS (SELECT FROM information_schema.columns 
                 WHERE table_name = 'carrier_integrations' AND column_name = 'webhook_secret') THEN
    ALTER TABLE carrier_integrations ADD COLUMN webhook_secret TEXT;
  END IF;

  IF NOT EXISTS (SELECT FROM information_schema.columns 
                 WHERE table_name = 'carrier_integrations' AND column_name = 'last_sync') THEN
    ALTER TABLE carrier_integrations ADD COLUMN last_sync TIMESTAMP WITH TIME ZONE;
  END IF;

  -- Adicionar constraint no environment se não existir
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'carrier_integrations_environment_check'
  ) THEN
    ALTER TABLE carrier_integrations ADD CONSTRAINT carrier_integrations_environment_check
      CHECK (environment IN ('production', 'sandbox'));
  END IF;
END $$;

-- 3. Tabela de rastreamentos Smartenvios
-- =====================================================
CREATE TABLE IF NOT EXISTS smartenvios_trackings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  order_id UUID REFERENCES orders(id) ON DELETE CASCADE,
  tracking_code TEXT NOT NULL,
  status TEXT NOT NULL,
  carrier TEXT,
  service_type TEXT,
  current_location JSONB,
  origin JSONB,
  destination JSONB,
  estimated_delivery TIMESTAMP WITH TIME ZONE,
  actual_delivery TIMESTAMP WITH TIME ZONE,
  last_event JSONB,
  events JSONB DEFAULT '[]',
  package_info JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 4. Tabela de pedidos Nuvemshop (cache)
-- =====================================================
CREATE TABLE IF NOT EXISTS nuvemshop_orders_cache (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  order_id UUID REFERENCES orders(id) ON DELETE CASCADE,
  nuvemshop_order_id TEXT NOT NULL,
  nuvemshop_store_id TEXT NOT NULL,
  order_number TEXT,
  status TEXT,
  shipping_status TEXT,
  payment_status TEXT,
  total_amount NUMERIC(10, 2),
  customer_data JSONB,
  shipping_data JSONB,
  products JSONB DEFAULT '[]',
  raw_data JSONB,
  last_sync TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id, nuvemshop_order_id, nuvemshop_store_id)
);

-- 5. Índices para performance
-- =====================================================
CREATE INDEX IF NOT EXISTS idx_carrier_integrations_user_id ON carrier_integrations(user_id);
CREATE INDEX IF NOT EXISTS idx_carrier_integrations_carrier ON carrier_integrations(carrier);

-- Criar índice em is_active apenas se a coluna existir
DO $$ 
BEGIN
  IF EXISTS (SELECT FROM information_schema.columns 
             WHERE table_name = 'carrier_integrations' AND column_name = 'is_active') THEN
    CREATE INDEX IF NOT EXISTS idx_carrier_integrations_active ON carrier_integrations(is_active) WHERE is_active = TRUE;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_smartenvios_trackings_user_id ON smartenvios_trackings(user_id);
CREATE INDEX IF NOT EXISTS idx_smartenvios_trackings_tracking_code ON smartenvios_trackings(tracking_code);
CREATE INDEX IF NOT EXISTS idx_smartenvios_trackings_order_id ON smartenvios_trackings(order_id);
CREATE INDEX IF NOT EXISTS idx_smartenvios_trackings_status ON smartenvios_trackings(status);

CREATE INDEX IF NOT EXISTS idx_nuvemshop_orders_user_id ON nuvemshop_orders_cache(user_id);
CREATE INDEX IF NOT EXISTS idx_nuvemshop_orders_order_id ON nuvemshop_orders_cache(order_id);
CREATE INDEX IF NOT EXISTS idx_nuvemshop_orders_nuvemshop_id ON nuvemshop_orders_cache(nuvemshop_order_id);
CREATE INDEX IF NOT EXISTS idx_nuvemshop_orders_store_id ON nuvemshop_orders_cache(nuvemshop_store_id);

-- 6. RLS Policies
-- =====================================================
ALTER TABLE carrier_integrations ENABLE ROW LEVEL SECURITY;
ALTER TABLE smartenvios_trackings ENABLE ROW LEVEL SECURITY;
ALTER TABLE nuvemshop_orders_cache ENABLE ROW LEVEL SECURITY;

-- Policies para carrier_integrations
DROP POLICY IF EXISTS "Users can view own carrier integrations" ON carrier_integrations;
CREATE POLICY "Users can view own carrier integrations"
  ON carrier_integrations FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own carrier integrations" ON carrier_integrations;
CREATE POLICY "Users can insert own carrier integrations"
  ON carrier_integrations FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own carrier integrations" ON carrier_integrations;
CREATE POLICY "Users can update own carrier integrations"
  ON carrier_integrations FOR UPDATE
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own carrier integrations" ON carrier_integrations;
CREATE POLICY "Users can delete own carrier integrations"
  ON carrier_integrations FOR DELETE
  USING (auth.uid() = user_id);

-- Policies para smartenvios_trackings
DROP POLICY IF EXISTS "Users can view own smartenvios trackings" ON smartenvios_trackings;
CREATE POLICY "Users can view own smartenvios trackings"
  ON smartenvios_trackings FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own smartenvios trackings" ON smartenvios_trackings;
CREATE POLICY "Users can insert own smartenvios trackings"
  ON smartenvios_trackings FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own smartenvios trackings" ON smartenvios_trackings;
CREATE POLICY "Users can update own smartenvios trackings"
  ON smartenvios_trackings FOR UPDATE
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own smartenvios trackings" ON smartenvios_trackings;
CREATE POLICY "Users can delete own smartenvios trackings"
  ON smartenvios_trackings FOR DELETE
  USING (auth.uid() = user_id);

-- Policies para nuvemshop_orders_cache
DROP POLICY IF EXISTS "Users can view own nuvemshop orders" ON nuvemshop_orders_cache;
CREATE POLICY "Users can view own nuvemshop orders"
  ON nuvemshop_orders_cache FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own nuvemshop orders" ON nuvemshop_orders_cache;
CREATE POLICY "Users can insert own nuvemshop orders"
  ON nuvemshop_orders_cache FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own nuvemshop orders" ON nuvemshop_orders_cache;
CREATE POLICY "Users can update own nuvemshop orders"
  ON nuvemshop_orders_cache FOR UPDATE
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own nuvemshop orders" ON nuvemshop_orders_cache;
CREATE POLICY "Users can delete own nuvemshop orders"
  ON nuvemshop_orders_cache FOR DELETE
  USING (auth.uid() = user_id);

-- 7. Triggers para updated_at
-- =====================================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

DROP TRIGGER IF EXISTS update_carrier_integrations_updated_at ON carrier_integrations;
CREATE TRIGGER update_carrier_integrations_updated_at
  BEFORE UPDATE ON carrier_integrations
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_smartenvios_trackings_updated_at ON smartenvios_trackings;
CREATE TRIGGER update_smartenvios_trackings_updated_at
  BEFORE UPDATE ON smartenvios_trackings
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_nuvemshop_orders_updated_at ON nuvemshop_orders_cache;
CREATE TRIGGER update_nuvemshop_orders_updated_at
  BEFORE UPDATE ON nuvemshop_orders_cache
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- 8. Comentários nas tabelas
-- =====================================================
COMMENT ON TABLE carrier_integrations IS 'Configurações de integração com transportadoras (Smartenvios, Correios, etc)';
COMMENT ON TABLE smartenvios_trackings IS 'Cache de rastreamentos do Smartenvios';
COMMENT ON TABLE nuvemshop_orders_cache IS 'Cache de pedidos importados da Nuvemshop';

COMMENT ON COLUMN carrier_integrations.environment IS 'Ambiente de API: production ou sandbox';
COMMENT ON COLUMN smartenvios_trackings.events IS 'Histórico de eventos de rastreamento em formato JSON';
COMMENT ON COLUMN nuvemshop_orders_cache.raw_data IS 'Dados completos do pedido retornados pela API da Nuvemshop';
