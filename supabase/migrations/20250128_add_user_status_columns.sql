-- =====================================================
-- ADICIONAR COLUNAS DE STATUS DO USUÁRIO
-- Data: 28/01/2025
-- =====================================================

-- Adicionar coluna is_active (usuário ativo/inativo)
ALTER TABLE profiles 
ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true;

-- Adicionar coluna is_blocked (usuário bloqueado)
ALTER TABLE profiles 
ADD COLUMN IF NOT EXISTS is_blocked BOOLEAN DEFAULT false;

-- Adicionar coluna block_reason (motivo do bloqueio)
ALTER TABLE profiles 
ADD COLUMN IF NOT EXISTS block_reason TEXT;

-- Criar índices para melhor performance
CREATE INDEX IF NOT EXISTS idx_profiles_is_active ON profiles(is_active);
CREATE INDEX IF NOT EXISTS idx_profiles_is_blocked ON profiles(is_blocked);

-- Comentários
COMMENT ON COLUMN profiles.is_active IS 'Indica se o usuário está ativo (pode inativar temporariamente)';
COMMENT ON COLUMN profiles.is_blocked IS 'Indica se o usuário está bloqueado (por inadimplência ou violação)';
COMMENT ON COLUMN profiles.block_reason IS 'Motivo do bloqueio do usuário';

-- Atualizar usuários existentes para ativos por padrão
UPDATE profiles SET is_active = true WHERE is_active IS NULL;
UPDATE profiles SET is_blocked = false WHERE is_blocked IS NULL;
