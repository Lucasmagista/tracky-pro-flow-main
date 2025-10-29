-- Migration para adicionar suporte ao WPPConnect na tabela profiles
-- Execute este SQL no Supabase SQL Editor

-- Adicionar colunas para configuração do WhatsApp com WPPConnect
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS whatsapp_enabled BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS whatsapp_session_name TEXT,
ADD COLUMN IF NOT EXISTS whatsapp_status TEXT CHECK (whatsapp_status IN ('connected', 'disconnected', 'connecting', 'qr')),
ADD COLUMN IF NOT EXISTS whatsapp_phone TEXT,
ADD COLUMN IF NOT EXISTS whatsapp_last_activity TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS whatsapp_auto_reply BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS whatsapp_business_hours BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS whatsapp_daily_limit INTEGER DEFAULT 1000,
ADD COLUMN IF NOT EXISTS whatsapp_templates_enabled BOOLEAN DEFAULT true;

-- Criar índice para melhorar performance nas consultas
CREATE INDEX IF NOT EXISTS idx_profiles_whatsapp_session 
ON public.profiles(whatsapp_session_name) 
WHERE whatsapp_session_name IS NOT NULL;

-- Comentários para documentação
COMMENT ON COLUMN public.profiles.whatsapp_enabled IS 'Se as notificações via WhatsApp estão ativadas';
COMMENT ON COLUMN public.profiles.whatsapp_session_name IS 'Nome único da sessão do WPPConnect';
COMMENT ON COLUMN public.profiles.whatsapp_status IS 'Status atual da conexão: connected, disconnected, connecting, qr';
COMMENT ON COLUMN public.profiles.whatsapp_phone IS 'Número de telefone conectado';
COMMENT ON COLUMN public.profiles.whatsapp_last_activity IS 'Data e hora da última atividade do WhatsApp';
COMMENT ON COLUMN public.profiles.whatsapp_auto_reply IS 'Se deve enviar resposta automática';
COMMENT ON COLUMN public.profiles.whatsapp_business_hours IS 'Se deve enviar apenas em horário comercial (8h-18h)';
COMMENT ON COLUMN public.profiles.whatsapp_daily_limit IS 'Limite diário de mensagens (padrão: 1000)';
COMMENT ON COLUMN public.profiles.whatsapp_templates_enabled IS 'Se deve usar templates pré-definidos';
