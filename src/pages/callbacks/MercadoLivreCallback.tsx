/**
 * Mercado Livre OAuth Callback
 * 
 * Processa o retorno do OAuth do Mercado Livre após autorização
 */

import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader2, CheckCircle, XCircle, ArrowLeft } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

type CallbackStatus = 'processing' | 'success' | 'error';

export default function MercadoLivreCallback() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [status, setStatus] = useState<CallbackStatus>('processing');
  const [message, setMessage] = useState('Processando autorização...');

  useEffect(() => {
    processCallback();
  }, []);

  const processCallback = async () => {
    try {
      // 1. Extrair parâmetros da URL
      const code = searchParams.get('code');
      const state = searchParams.get('state');
      const error = searchParams.get('error');

      // 2. Verificar se houve erro
      if (error) {
        throw new Error('Autorização negada pelo usuário');
      }

      // 3. Validar parâmetros
      if (!code || !state) {
        throw new Error('Parâmetros de callback inválidos');
      }

      // 4. Verificar state (CSRF protection)
      const storedState = sessionStorage.getItem('mercadolivre_oauth_state');
      if (storedState !== state) {
        throw new Error('Estado OAuth inválido. Possível tentativa de ataque CSRF.');
      }

      // 5. Buscar user_id da sessão
      const userId = sessionStorage.getItem('mercadolivre_oauth_user_id');
      if (!userId) {
        throw new Error('Sessão expirada. Por favor, tente novamente.');
      }

      setMessage('Trocando código por token de acesso...');

      // 6. Trocar código por token via Edge Function
      const { data: tokenData, error: tokenError } = await supabase.functions.invoke(
        'mercadolivre-oauth',
        {
          body: {
            code,
            redirect_uri: `${window.location.origin}/integrations/mercadolivre/callback`,
          },
        }
      );

      if (tokenError || !tokenData?.access_token) {
        throw new Error('Falha ao obter token de acesso');
      }

      setMessage('Salvando configuração...');

      // 7. Salvar integração no banco de dados
      const { error: upsertError } = await supabase
        .from('integrations')
        .upsert({
          user_id: userId,
          platform: 'mercadolivre',
          name: 'Mercado Livre',
          is_active: true,
          config: {
            access_token: tokenData.access_token,
            refresh_token: tokenData.refresh_token,
            expires_at: new Date(Date.now() + tokenData.expires_in * 1000).toISOString(),
            user_id: tokenData.user_id,
          },
          settings: {
            auto_sync: true,
            sync_interval: 300,
            webhook_enabled: true,
          },
          last_sync: new Date().toISOString(),
        });

      if (upsertError) {
        throw new Error('Erro ao salvar configuração: ' + upsertError.message);
      }

      // 8. Limpar sessão
      sessionStorage.removeItem('mercadolivre_oauth_state');
      sessionStorage.removeItem('mercadolivre_oauth_user_id');

      // 9. Sucesso!
      setStatus('success');
      setMessage('Mercado Livre conectado com sucesso!');

      toast({
        title: 'Sucesso!',
        description: 'Mercado Livre foi conectado com sucesso.',
      });

      // Redirecionar após 2 segundos
      setTimeout(() => {
        navigate('/settings?tab=integrations');
      }, 2000);

    } catch (error) {
      console.error('Erro no callback OAuth:', error);
      
      setStatus('error');
      setMessage(
        error instanceof Error 
          ? error.message 
          : 'Erro desconhecido ao processar autorização'
      );

      toast({
        title: 'Erro na autorização',
        description: message,
        variant: 'destructive',
      });

      // Limpar sessão mesmo em erro
      sessionStorage.removeItem('mercadolivre_oauth_state');
      sessionStorage.removeItem('mercadolivre_oauth_user_id');
    }
  };

  const handleBackToSettings = () => {
    navigate('/settings?tab=integrations');
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background to-muted p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="flex justify-center mb-4">
            {status === 'processing' && (
              <Loader2 className="h-12 w-12 animate-spin text-primary" />
            )}
            {status === 'success' && (
              <CheckCircle className="h-12 w-12 text-green-500" />
            )}
            {status === 'error' && (
              <XCircle className="h-12 w-12 text-destructive" />
            )}
          </div>
          
          <CardTitle>
            {status === 'processing' && 'Conectando Mercado Livre'}
            {status === 'success' && 'Conexão Estabelecida'}
            {status === 'error' && 'Erro na Conexão'}
          </CardTitle>
          
          <CardDescription>
            Processando autorização OAuth
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-4">
          <Alert variant={status === 'error' ? 'destructive' : 'default'}>
            <AlertDescription className="text-center">
              {message}
            </AlertDescription>
          </Alert>

          {status === 'success' && (
            <p className="text-sm text-muted-foreground text-center">
              Redirecionando para configurações...
            </p>
          )}

          {status === 'error' && (
            <Button 
              onClick={handleBackToSettings} 
              className="w-full"
              variant="outline"
            >
              <ArrowLeft className="mr-2 h-4 w-4" />
              Voltar para Configurações
            </Button>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
