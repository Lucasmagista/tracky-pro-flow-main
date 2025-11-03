-- Tabela para armazenar sessões do WhatsApp
CREATE TABLE IF NOT EXISTS whatsapp_sessions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  session_id TEXT NOT NULL,
  is_connected BOOLEAN DEFAULT FALSE,
  qr_code TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Garantir que cada usuário tenha apenas uma sessão ativa
  UNIQUE(user_id)
);

-- Índice para busca por user_id
CREATE INDEX IF NOT EXISTS idx_whatsapp_sessions_user_id ON whatsapp_sessions(user_id);

-- Índice para busca por session_id
CREATE INDEX IF NOT EXISTS idx_whatsapp_sessions_session_id ON whatsapp_sessions(session_id);

-- RLS (Row Level Security)
ALTER TABLE whatsapp_sessions ENABLE ROW LEVEL SECURITY;

-- Política: Usuários podem ver apenas suas próprias sessões
CREATE POLICY "Usuários podem ver suas próprias sessões"
  ON whatsapp_sessions
  FOR SELECT
  USING (auth.uid() = user_id);

-- Política: Usuários podem criar suas próprias sessões
CREATE POLICY "Usuários podem criar suas próprias sessões"
  ON whatsapp_sessions
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Política: Usuários podem atualizar suas próprias sessões
CREATE POLICY "Usuários podem atualizar suas próprias sessões"
  ON whatsapp_sessions
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Política: Usuários podem deletar suas próprias sessões
CREATE POLICY "Usuários podem deletar suas próprias sessões"
  ON whatsapp_sessions
  FOR DELETE
  USING (auth.uid() = user_id);

-- Função para atualizar updated_at automaticamente
CREATE OR REPLACE FUNCTION update_whatsapp_sessions_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger para atualizar updated_at
DROP TRIGGER IF EXISTS update_whatsapp_sessions_updated_at_trigger ON whatsapp_sessions;
CREATE TRIGGER update_whatsapp_sessions_updated_at_trigger
  BEFORE UPDATE ON whatsapp_sessions
  FOR EACH ROW
  EXECUTE FUNCTION update_whatsapp_sessions_updated_at();

-- Comentários na tabela e colunas
COMMENT ON TABLE whatsapp_sessions IS 'Armazena sessões do WhatsApp Web de cada usuário';
COMMENT ON COLUMN whatsapp_sessions.user_id IS 'Referência ao usuário dono da sessão';
COMMENT ON COLUMN whatsapp_sessions.session_id IS 'ID único da sessão do WhatsApp';
COMMENT ON COLUMN whatsapp_sessions.is_connected IS 'Indica se o WhatsApp está conectado';
COMMENT ON COLUMN whatsapp_sessions.qr_code IS 'URL do QR Code para conexão (null após conectar)';
