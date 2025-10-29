/**
 * Formulário de Configuração de Integração
 * 
 * Usa react-hook-form + Zod para validação de credenciais
 */

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { nuvemshopCredentialsSchema, smartenviosCredentialsSchema } from '@/schemas/integration.schema';
import { sanitizeIntegrationConfig } from '@/lib/sanitize';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { Loader2, Store } from 'lucide-react';

type NuvemshopFormData = z.infer<typeof nuvemshopCredentialsSchema>;

interface IntegrationFormProps {
  platform: 'nuvemshop' | 'smartenvios';
  onSuccess?: () => void;
  onCancel?: () => void;
}

export function IntegrationForm({ platform, onSuccess, onCancel }: IntegrationFormProps) {
  const schema = platform === 'nuvemshop' ? nuvemshopCredentialsSchema : smartenviosCredentialsSchema;
  
  const form = useForm<NuvemshopFormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      app_id: '',
      app_secret: '',
      store_id: '',
    },
  });

  const onSubmit = async (data: NuvemshopFormData) => {
    try {
      // Sanitizar configuração
      const sanitizedConfig = sanitizeIntegrationConfig(data);

      // Buscar user_id
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast.error('Usuário não autenticado');
        return;
      }

      // Salvar integração
      const { error } = await supabase
        .from('integrations')
        .upsert({
          user_id: user.id,
          platform,
          name: `${platform} - ${data.store_id || 'Nova Integração'}`,
          is_active: false, // Ativar após testar conexão
          config: sanitizedConfig,
          settings: {
            auto_sync: true,
            sync_interval: 300,
          },
        });

      if (error) throw error;

      toast.success('Integração configurada com sucesso!', {
        description: 'Teste a conexão para ativar.',
      });
      
      form.reset();
      onSuccess?.();
    } catch (error) {
      console.error('Erro ao configurar integração:', error);
      toast.error('Erro ao configurar integração', {
        description: error instanceof Error ? error.message : 'Erro desconhecido',
      });
    }
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="p-2 rounded-lg bg-primary/10">
            <Store className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h3 className="text-lg font-semibold capitalize">{platform}</h3>
            <p className="text-sm text-muted-foreground">
              Configure suas credenciais de API
            </p>
          </div>
        </div>

        {platform === 'nuvemshop' && (
          <>
            <FormField
              control={form.control}
              name="app_id"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>App ID *</FormLabel>
                  <FormControl>
                    <Input placeholder="12345" {...field} />
                  </FormControl>
                  <FormDescription>
                    ID da sua aplicação Nuvemshop
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="app_secret"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>App Secret *</FormLabel>
                  <FormControl>
                    <Input type="password" placeholder="••••••••••" {...field} />
                  </FormControl>
                  <FormDescription>
                    Secret key da sua aplicação
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="store_id"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Store ID *</FormLabel>
                  <FormControl>
                    <Input placeholder="1234567" {...field} />
                  </FormControl>
                  <FormDescription>
                    ID numérico da sua loja
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
          </>
        )}

        {platform === 'smartenvios' && (
          <>
            <FormField
              control={form.control}
              name="api_key"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>API Key *</FormLabel>
                  <FormControl>
                    <Input type="password" placeholder="sk_test_••••••••••" {...field} />
                  </FormControl>
                  <FormDescription>
                    Chave de API da Smartenvios
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="environment"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Ambiente</FormLabel>
                  <FormControl>
                    <select className="w-full border rounded-md p-2" {...field}>
                      <option value="sandbox">Sandbox (Teste)</option>
                      <option value="production">Production (Produção)</option>
                    </select>
                  </FormControl>
                  <FormDescription>
                    Use sandbox para testes
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
          </>
        )}

        <div className="flex gap-3 justify-end pt-4 border-t">
          {onCancel && (
            <Button type="button" variant="outline" onClick={onCancel}>
              Cancelar
            </Button>
          )}
          <Button 
            type="submit" 
            disabled={form.formState.isSubmitting}
          >
            {form.formState.isSubmitting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Salvando...
              </>
            ) : (
              'Salvar Configuração'
            )}
          </Button>
        </div>
      </form>
    </Form>
  );
}
