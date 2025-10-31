-- Criar tabela para templates de mapeamento de campos CSV
CREATE TABLE IF NOT EXISTS public.mapping_templates (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    description TEXT,
    client_name TEXT,
    file_type TEXT NOT NULL CHECK (file_type IN ('csv', 'excel')),
    field_mappings JSONB NOT NULL DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
    usage_count INTEGER DEFAULT 0 NOT NULL,
    last_used TIMESTAMP WITH TIME ZONE
);

-- Criar índices para melhor performance
CREATE INDEX IF NOT EXISTS idx_mapping_templates_user_id ON public.mapping_templates(user_id);
CREATE INDEX IF NOT EXISTS idx_mapping_templates_created_at ON public.mapping_templates(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_mapping_templates_updated_at ON public.mapping_templates(updated_at DESC);

-- Criar função para atualizar updated_at automaticamente
CREATE OR REPLACE FUNCTION update_mapping_templates_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = TIMEZONE('utc'::text, NOW());
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Criar trigger para updated_at
DROP TRIGGER IF EXISTS trigger_update_mapping_templates_updated_at ON public.mapping_templates;
CREATE TRIGGER trigger_update_mapping_templates_updated_at
    BEFORE UPDATE ON public.mapping_templates
    FOR EACH ROW
    EXECUTE FUNCTION update_mapping_templates_updated_at();

-- Habilitar RLS (Row Level Security)
ALTER TABLE public.mapping_templates ENABLE ROW LEVEL SECURITY;

-- Criar política RLS para que usuários só vejam seus próprios templates
CREATE POLICY "Users can view their own mapping templates" ON public.mapping_templates
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own mapping templates" ON public.mapping_templates
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own mapping templates" ON public.mapping_templates
    FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own mapping templates" ON public.mapping_templates
    FOR DELETE USING (auth.uid() = user_id);

-- Conceder permissões para authenticated users
GRANT ALL ON public.mapping_templates TO authenticated;
GRANT USAGE ON SCHEMA public TO authenticated;