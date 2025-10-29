/**
 * Shopify OAuth Callback
 * 
 * Processa o retorno do OAuth do Shopify após autorização
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

export default function ShopifyCallback() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [status, setStatus] = useState<CallbackStatus>('processing');
  const [message, setMessage] = useState('Processando autorização...');
  const [shopName, setShopName] = useState<string>('');

  useEffect(() => {
    processCallback();
  }, []);

  const processCallback = async () => {
    try {
      // 1. Extrair parâmetros da URL
      const code = searchParams.get('code');
      const shop = searchParams.get('shop');
      const hmac = searchParams.get('hmac');
      const state = searchParams.get('state');

      // 2. Validar parâmetros
      if (!code || !shop || !hmac) {
        throw new Error('Parâmetros de callback inválidos');
      }

      // 3. Verificar state (CSRF protection)
      const storedState = sessionStorage.getItem('shopify_oauth_state');
      if (state && storedState !== state) {
        throw new Error('Estado OAuth inválido. Possível tentativa de ataque CSRF.');
      }

      // 4. Buscar user_id da sessão
      const userId = sessionStorage.getItem('shopify_oauth_user_id');
      if (!userId) {
        throw new Error('Sessão expirada. Por favor, tente novamente.');
      }

      setMessage('Validando autorização...');
      setShopName(shop);

      // 5. Trocar código por token via Edge Function
      const { data: tokenData, error: tokenError } = await supabase.functions.invoke(
        'shopify-oauth',
        {
          body: {
            code,
            shop,
            hmac,
          },
        }
      );

      if (tokenError || !tokenData?.access_token) {
        throw new Error('Falha ao obter token de acesso');
      }

      setMessage('Salvando configuração...');

      // 6. Salvar integração no banco de dados
      const { error: upsertError } = await supabase
        .from('integrations')
        .upsert({
          user_id: userId,
          platform: 'shopify',
          name: `Shopify - ${shop}`,
          is_active: true,
          config: {
            shop_domain: shop,
            access_token: tokenData.access_token,
            scope: tokenData.scope,
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

      // 7. Registrar webhooks (opcional)
      try {
        setMessage('Registrando webhooks...');
        
        await fetch(`https://${shop}/admin/api/2024-01/webhooks.json`, {
          method: 'POST',
          headers: {
            'X-Shopify-Access-Token': tokenData.access_token,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            webhook: {
              topic: 'orders/create',
              address: `${import.meta.env.VITE_API_URL || window.location.origin}/api/webhooks/shopify`,
              format: 'json',
            },
          }),
        });
      } catch (webhookError) {
        console.warn('Erro ao registrar webhooks:', webhookError);
        // Não falhar o fluxo por causa dos webhooks
      }

      // 8. Limpar sessão
      sessionStorage.removeItem('shopify_oauth_state');
      sessionStorage.removeItem('shopify_oauth_user_id');

      // 9. Sucesso!
      setStatus('success');
      setMessage('Shopify conectado com sucesso!');

      toast({
        title: 'Sucesso!',
        description: `${shop} foi conectado com sucesso.`,
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
      sessionStorage.removeItem('shopify_oauth_state');
      sessionStorage.removeItem('shopify_oauth_user_id');
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
            {status === 'processing' && 'Conectando Shopify'}
            {status === 'success' && 'Conexão Estabelecida'}
            {status === 'error' && 'Erro na Conexão'}
          </CardTitle>
          
          <CardDescription>
            {shopName || 'Processando autorização OAuth'}
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
