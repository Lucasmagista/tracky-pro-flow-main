/**
 * Nuvemshop OAuth Callback
 * 
 * Processa o retorno do OAuth da Nuvemshop após autorização
 */

import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader2, CheckCircle, XCircle, ArrowLeft } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { NuvemshopService } from '@/services/nuvemshop';
import { useToast } from '@/hooks/use-toast';

type CallbackStatus = 'processing' | 'success' | 'error';

export default function NuvemshopCallback() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [status, setStatus] = useState<CallbackStatus>('processing');
  const [message, setMessage] = useState('Processando autorização...');
  const [storeName, setStoreName] = useState<string>('');

  useEffect(() => {
    processCallback();
  }, []);

  const processCallback = async () => {
    try {
      // 1. Extrair parâmetros da URL
      const code = searchParams.get('code');
      const state = searchParams.get('state');
      const error = searchParams.get('error');
      const errorDescription = searchParams.get('error_description');

      // 2. Verificar se houve erro na autorização
      if (error) {
        throw new Error(errorDescription || error);
      }

      // 3. Validar parâmetros obrigatórios
      if (!code || !state) {
        throw new Error('Parâmetros de callback inválidos');
      }

      // 4. Verificar state (CSRF protection)
      const storedState = sessionStorage.getItem('nuvemshop_oauth_state');
      if (storedState !== state) {
        throw new Error('Estado OAuth inválido. Possível tentativa de ataque CSRF.');
      }

      // 5. Buscar user_id da sessão
      const userId = sessionStorage.getItem('nuvemshop_oauth_user_id');
      if (!userId) {
        throw new Error('Sessão expirada. Por favor, tente novamente.');
      }

      // 6. Buscar credenciais do app
      const appId = import.meta.env.VITE_NUVEMSHOP_APP_ID;
      const appSecret = import.meta.env.VITE_NUVEMSHOP_APP_SECRET;

      if (!appId || !appSecret) {
        throw new Error('Configuração do app Nuvemshop não encontrada');
      }

      setMessage('Trocando código por token de acesso...');

      // 7. Trocar código por access_token
      const redirectUri = `${window.location.origin}/integrations/nuvemshop/callback`;
      const authResponse = await NuvemshopService.authenticate(
        appId,
        appSecret,
        code,
        redirectUri
      );

      if (!authResponse.access_token) {
        throw new Error('Falha ao obter token de acesso');
      }

      setMessage('Buscando informações da loja...');

      // 8. Buscar informações da loja
      const config = {
        app_id: appId,
        app_secret: appSecret,
        access_token: authResponse.access_token,
        user_id: userId,
        store_id: '', // Será preenchido
        store_url: '', // Será preenchido
      };

      const storeInfo = await NuvemshopService.getStoreInfo(config as any);
      setStoreName(storeInfo.name || 'Sua loja');

      setMessage('Salvando configuração...');

      // 9. Salvar integração no banco de dados
      const { error: upsertError } = await supabase
        .from('integrations')
        .upsert({
          user_id: userId,
          platform: 'nuvemshop',
          name: `Nuvemshop - ${storeInfo.name}`,
          is_active: true,
          config: {
            app_id: appId,
            app_secret: appSecret,
            access_token: authResponse.access_token,
            store_id: storeInfo.id,
            store_url: storeInfo.url,
            store_name: storeInfo.name,
            token_expires_at: authResponse.expires_in
              ? new Date(Date.now() + authResponse.expires_in * 1000).toISOString()
              : null,
          },
          settings: {
            auto_sync: true,
            sync_interval: 300, // 5 minutos
            webhook_enabled: true,
          },
          last_sync: new Date().toISOString(),
        });

      if (upsertError) {
        throw new Error('Erro ao salvar configuração: ' + upsertError.message);
      }

      // 10. Registrar webhooks (opcional, não bloquear se falhar)
      try {
        setMessage('Registrando webhooks...');
        const webhookUrl = `${import.meta.env.VITE_API_URL || window.location.origin}/api/webhooks/nuvemshop`;
        
        await NuvemshopService.registerWebhooks(
          config as any,
          webhookUrl,
          ['order/created', 'order/updated', 'order/paid', 'order/fulfilled', 'order/cancelled']
        );
      } catch (webhookError) {
        console.warn('Erro ao registrar webhooks:', webhookError);
        // Não falhar o fluxo por causa dos webhooks
      }

      // 11. Limpar sessão
      sessionStorage.removeItem('nuvemshop_oauth_state');
      sessionStorage.removeItem('nuvemshop_oauth_user_id');

      // 12. Sucesso!
      setStatus('success');
      setMessage('Nuvemshop conectado com sucesso!');

      toast({
        title: 'Sucesso!',
        description: `${storeInfo.name} foi conectado com sucesso.`,
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
      sessionStorage.removeItem('nuvemshop_oauth_state');
      sessionStorage.removeItem('nuvemshop_oauth_user_id');
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
            {status === 'processing' && 'Conectando Nuvemshop'}
            {status === 'success' && 'Conexão Estabelecida'}
            {status === 'error' && 'Erro na Conexão'}
          </CardTitle>
          
          <CardDescription>
            {storeName && status === 'success' ? storeName : 'Processando autorização OAuth'}
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

          {status === 'processing' && (
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <div className="h-2 w-2 rounded-full bg-primary animate-pulse" />
                Validando autorização
              </div>
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <div className="h-2 w-2 rounded-full bg-primary animate-pulse delay-100" />
                Obtendo token de acesso
              </div>
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <div className="h-2 w-2 rounded-full bg-primary animate-pulse delay-200" />
                Configurando integração
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
