import { useState, useCallback, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Mail,
  MessageSquare,
  Smartphone,
  Save,
  Plus,
  Edit,
  Trash2,
  Eye,
  Copy,
} from 'lucide-react';

interface NotificationTemplate {
  id: string;
  name: string;
  event_type: string;
  channel: 'email' | 'sms' | 'whatsapp';
  subject?: string;
  body: string;
  variables: string[];
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

const AVAILABLE_VARIABLES = {
  order: [
    { key: '{{order_id}}', description: 'ID do pedido' },
    { key: '{{tracking_code}}', description: 'Código de rastreamento' },
    { key: '{{status}}', description: 'Status do pedido' },
    { key: '{{carrier}}', description: 'Transportadora' },
    { key: '{{customer_name}}', description: 'Nome do cliente' },
    { key: '{{order_date}}', description: 'Data do pedido' },
    { key: '{{estimated_delivery}}', description: 'Data prevista de entrega' },
  ],
  general: [
    { key: '{{store_name}}', description: 'Nome da loja' },
    { key: '{{current_date}}', description: 'Data atual' },
    { key: '{{support_email}}', description: 'Email de suporte' },
    { key: '{{support_phone}}', description: 'Telefone de suporte' },
  ],
};

const EVENT_TYPES = [
  { value: 'order_created', label: 'Pedido Criado' },
  { value: 'order_shipped', label: 'Pedido Enviado' },
  { value: 'order_in_transit', label: 'Pedido em Trânsito' },
  { value: 'order_out_for_delivery', label: 'Saiu para Entrega' },
  { value: 'order_delivered', label: 'Pedido Entregue' },
  { value: 'order_delayed', label: 'Pedido Atrasado' },
  { value: 'order_exception', label: 'Exceção no Pedido' },
];

export function NotificationTemplateEditor() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [templates, setTemplates] = useState<NotificationTemplate[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<NotificationTemplate | null>(null);
  const [previewData, setPreviewData] = useState<Record<string, string>>({});

  // Form state
  const [formData, setFormData] = useState({
    name: '',
    event_type: 'order_shipped',
    channel: 'email' as 'email' | 'sms' | 'whatsapp',
    subject: '',
    body: '',
  });

  // Load templates
  const loadTemplates = useCallback(async () => {
    if (!user) return;

    setIsLoading(true);
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (supabase as any)
        .from('notification_templates')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (error) throw error;

      setTemplates((data || []) as NotificationTemplate[]);
    } catch (err) {
      console.error('Error loading templates:', err);
      toast({
        title: 'Erro',
        description: 'Não foi possível carregar os templates.',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  }, [user, toast]);

  useEffect(() => {
    loadTemplates();
  }, [loadTemplates]);

  // Extract variables from template body
  const extractVariables = (text: string): string[] => {
    const regex = /\{\{([^}]+)\}\}/g;
    const matches = text.match(regex) || [];
    return [...new Set(matches)];
  };

  // Save template
  const handleSave = async () => {
    if (!user) return;

    if (!formData.name || !formData.body) {
      toast({
        title: 'Campos obrigatórios',
        description: 'Preencha o nome e o corpo do template.',
        variant: 'destructive',
      });
      return;
    }

    if (formData.channel === 'email' && !formData.subject) {
      toast({
        title: 'Campo obrigatório',
        description: 'Email precisa de um assunto.',
        variant: 'destructive',
      });
      return;
    }

    setIsLoading(true);
    try {
      const variables = extractVariables(formData.body);

      const templateData = {
        user_id: user.id,
        name: formData.name,
        event_type: formData.event_type,
        channel: formData.channel,
        subject: formData.channel === 'email' ? formData.subject : null,
        body: formData.body,
        variables: variables,
        is_active: true,
      };

      if (editingTemplate) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { error } = await (supabase as any)
          .from('notification_templates')
          .update(templateData)
          .eq('id', editingTemplate.id);

        if (error) throw error;

        toast({
          title: 'Template atualizado!',
          description: 'O template foi atualizado com sucesso.',
        });
      } else {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { error } = await (supabase as any)
          .from('notification_templates')
          .insert(templateData);

        if (error) throw error;

        toast({
          title: 'Template criado!',
          description: 'O template foi criado com sucesso.',
        });
      }

      setIsDialogOpen(false);
      setFormData({
        name: '',
        event_type: 'order_shipped',
        channel: 'email',
        subject: '',
        body: '',
      });
      setEditingTemplate(null);
      loadTemplates();
    } catch (err) {
      console.error('Error saving template:', err);
      toast({
        title: 'Erro',
        description: 'Não foi possível salvar o template.',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Delete template
  const handleDelete = async (id: string) => {
    if (!confirm('Tem certeza que deseja excluir este template?')) return;

    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error } = await (supabase as any)
        .from('notification_templates')
        .delete()
        .eq('id', id);

      if (error) throw error;

      toast({
        title: 'Template excluído',
        description: 'O template foi removido com sucesso.',
      });

      loadTemplates();
    } catch (err) {
      console.error('Error deleting template:', err);
      toast({
        title: 'Erro',
        description: 'Não foi possível excluir o template.',
        variant: 'destructive',
      });
    }
  };

  // Duplicate template
  const handleDuplicate = (template: NotificationTemplate) => {
    setFormData({
      name: `${template.name} (Cópia)`,
      event_type: template.event_type,
      channel: template.channel,
      subject: template.subject || '',
      body: template.body,
    });
    setEditingTemplate(null);
    setIsDialogOpen(true);
  };

  // Edit template
  const handleEdit = (template: NotificationTemplate) => {
    setFormData({
      name: template.name,
      event_type: template.event_type,
      channel: template.channel,
      subject: template.subject || '',
      body: template.body,
    });
    setEditingTemplate(template);
    setIsDialogOpen(true);
  };

  // Toggle active status
  const toggleActive = async (id: string, currentStatus: boolean) => {
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error } = await (supabase as any)
        .from('notification_templates')
        .update({ is_active: !currentStatus })
        .eq('id', id);

      if (error) throw error;

      toast({
        title: currentStatus ? 'Template desativado' : 'Template ativado',
        description: `O template foi ${currentStatus ? 'desativado' : 'ativado'}.`,
      });

      loadTemplates();
    } catch (err) {
      console.error('Error toggling template:', err);
      toast({
        title: 'Erro',
        description: 'Não foi possível alterar o status.',
        variant: 'destructive',
      });
    }
  };

  // Insert variable into body
  const insertVariable = (variable: string) => {
    const textarea = document.querySelector('textarea[name="body"]') as HTMLTextAreaElement;
    if (!textarea) return;

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const text = formData.body;
    const before = text.substring(0, start);
    const after = text.substring(end);

    setFormData({
      ...formData,
      body: before + variable + after,
    });

    // Set cursor position after inserted variable
    setTimeout(() => {
      textarea.focus();
      textarea.setSelectionRange(start + variable.length, start + variable.length);
    }, 0);
  };

  // Generate preview
  const generatePreview = () => {
    let preview = formData.body;

    // Replace variables with preview data
    Object.entries(previewData).forEach(([key, value]) => {
      preview = preview.replace(new RegExp(key.replace(/[{}]/g, '\\$&'), 'g'), value);
    });

    return preview;
  };

  // Get channel icon
  const getChannelIcon = (channel: string) => {
    switch (channel) {
      case 'email':
        return <Mail className="h-4 w-4" />;
      case 'sms':
        return <Smartphone className="h-4 w-4" />;
      case 'whatsapp':
        return <MessageSquare className="h-4 w-4" />;
      default:
        return null;
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold">Templates de Notificação</h2>
          <p className="text-muted-foreground">
            Crie e gerencie templates personalizados para suas notificações
          </p>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={() => {
              setFormData({
                name: '',
                event_type: 'order_shipped',
                channel: 'email',
                subject: '',
                body: '',
              });
              setEditingTemplate(null);
            }}>
              <Plus className="h-4 w-4 mr-2" />
              Novo Template
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-4xl max-h-[90vh]">
            <DialogHeader>
              <DialogTitle>
                {editingTemplate ? 'Editar Template' : 'Novo Template'}
              </DialogTitle>
              <DialogDescription>
                Crie um template personalizado com variáveis dinâmicas
              </DialogDescription>
            </DialogHeader>

            <Tabs defaultValue="editor" className="w-full">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="editor">Editor</TabsTrigger>
                <TabsTrigger value="preview">Preview</TabsTrigger>
              </TabsList>

              <TabsContent value="editor" className="space-y-4">
                <ScrollArea className="h-[500px] pr-4">
                  <div className="space-y-4">
                    <div>
                      <Label htmlFor="name">Nome do Template</Label>
                      <Input
                        id="name"
                        value={formData.name}
                        onChange={(e) =>
                          setFormData({ ...formData, name: e.target.value })
                        }
                        placeholder="Ex: Notificação de envio"
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label htmlFor="event_type">Tipo de Evento</Label>
                        <Select
                          value={formData.event_type}
                          onValueChange={(value) =>
                            setFormData({ ...formData, event_type: value })
                          }
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {EVENT_TYPES.map((type) => (
                              <SelectItem key={type.value} value={type.value}>
                                {type.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      <div>
                        <Label htmlFor="channel">Canal</Label>
                        <Select
                          value={formData.channel}
                          onValueChange={(value: 'email' | 'sms' | 'whatsapp') =>
                            setFormData({ ...formData, channel: value })
                          }
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="email">
                              <div className="flex items-center gap-2">
                                <Mail className="h-4 w-4" />
                                Email
                              </div>
                            </SelectItem>
                            <SelectItem value="sms">
                              <div className="flex items-center gap-2">
                                <Smartphone className="h-4 w-4" />
                                SMS
                              </div>
                            </SelectItem>
                            <SelectItem value="whatsapp">
                              <div className="flex items-center gap-2">
                                <MessageSquare className="h-4 w-4" />
                                WhatsApp
                              </div>
                            </SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>

                    {formData.channel === 'email' && (
                      <div>
                        <Label htmlFor="subject">Assunto</Label>
                        <Input
                          id="subject"
                          value={formData.subject}
                          onChange={(e) =>
                            setFormData({ ...formData, subject: e.target.value })
                          }
                          placeholder="Ex: Seu pedido {{order_id}} foi enviado"
                        />
                      </div>
                    )}

                    <div>
                      <Label htmlFor="body">Corpo da Mensagem</Label>
                      <Textarea
                        id="body"
                        name="body"
                        value={formData.body}
                        onChange={(e) =>
                          setFormData({ ...formData, body: e.target.value })
                        }
                        placeholder="Digite sua mensagem aqui..."
                        rows={8}
                        className="font-mono"
                      />
                    </div>

                    <div>
                      <Label>Variáveis Disponíveis</Label>
                      <div className="mt-2 space-y-4">
                        <div>
                          <p className="text-sm font-medium mb-2">Pedido</p>
                          <div className="flex flex-wrap gap-2">
                            {AVAILABLE_VARIABLES.order.map((variable) => (
                              <Badge
                                key={variable.key}
                                variant="secondary"
                                className="cursor-pointer hover:bg-primary hover:text-primary-foreground"
                                onClick={() => insertVariable(variable.key)}
                              >
                                {variable.key}
                                <span className="ml-2 text-xs opacity-70">
                                  {variable.description}
                                </span>
                              </Badge>
                            ))}
                          </div>
                        </div>

                        <div>
                          <p className="text-sm font-medium mb-2">Geral</p>
                          <div className="flex flex-wrap gap-2">
                            {AVAILABLE_VARIABLES.general.map((variable) => (
                              <Badge
                                key={variable.key}
                                variant="secondary"
                                className="cursor-pointer hover:bg-primary hover:text-primary-foreground"
                                onClick={() => insertVariable(variable.key)}
                              >
                                {variable.key}
                                <span className="ml-2 text-xs opacity-70">
                                  {variable.description}
                                </span>
                              </Badge>
                            ))}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </ScrollArea>
              </TabsContent>

              <TabsContent value="preview" className="space-y-4">
                <div className="space-y-4">
                  <div>
                    <Label>Dados para Preview (opcional)</Label>
                    <p className="text-sm text-muted-foreground mb-2">
                      Preencha valores para testar o template
                    </p>
                    <div className="grid grid-cols-2 gap-2">
                      {extractVariables(formData.body).map((variable) => (
                        <div key={variable}>
                          <Label className="text-xs">{variable}</Label>
                          <Input
                            placeholder="Valor de teste"
                            value={previewData[variable] || ''}
                            onChange={(e) =>
                              setPreviewData({
                                ...previewData,
                                [variable]: e.target.value,
                              })
                            }
                          />
                        </div>
                      ))}
                    </div>
                  </div>

                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <Eye className="h-5 w-5" />
                        Preview
                      </CardTitle>
                      {formData.channel === 'email' && formData.subject && (
                        <CardDescription>
                          <strong>Assunto:</strong> {formData.subject}
                        </CardDescription>
                      )}
                    </CardHeader>
                    <CardContent>
                      <div className="whitespace-pre-wrap bg-muted p-4 rounded-lg">
                        {generatePreview() || (
                          <span className="text-muted-foreground">
                            Digite algo no corpo da mensagem...
                          </span>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                </div>
              </TabsContent>
            </Tabs>

            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => setIsDialogOpen(false)}
              >
                Cancelar
              </Button>
              <Button onClick={handleSave} disabled={isLoading}>
                <Save className="h-4 w-4 mr-2" />
                {isLoading ? 'Salvando...' : 'Salvar Template'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* Templates List */}
      <div className="grid gap-4">
        {isLoading && templates.length === 0 ? (
          <Card>
            <CardContent className="py-8 text-center text-muted-foreground">
              Carregando templates...
            </CardContent>
          </Card>
        ) : templates.length === 0 ? (
          <Card>
            <CardContent className="py-8 text-center">
              <p className="text-muted-foreground mb-4">
                Nenhum template criado ainda
              </p>
              <Button onClick={() => setIsDialogOpen(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Criar Primeiro Template
              </Button>
            </CardContent>
          </Card>
        ) : (
          templates.map((template) => (
            <Card key={template.id}>
              <CardHeader>
                <div className="flex justify-between items-start">
                  <div className="space-y-1">
                    <CardTitle className="flex items-center gap-2">
                      {getChannelIcon(template.channel)}
                      {template.name}
                      {!template.is_active && (
                        <Badge variant="secondary">Inativo</Badge>
                      )}
                    </CardTitle>
                    <CardDescription>
                      {EVENT_TYPES.find((t) => t.value === template.event_type)
                        ?.label || template.event_type}
                    </CardDescription>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => toggleActive(template.id, template.is_active)}
                    >
                      {template.is_active ? 'Desativar' : 'Ativar'}
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDuplicate(template)}
                    >
                      <Copy className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleEdit(template)}
                    >
                      <Edit className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDelete(template.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {template.subject && (
                  <p className="text-sm mb-2">
                    <strong>Assunto:</strong> {template.subject}
                  </p>
                )}
                <p className="text-sm text-muted-foreground line-clamp-3">
                  {template.body}
                </p>
                {template.variables.length > 0 && (
                  <div className="mt-3 flex flex-wrap gap-1">
                    {template.variables.map((variable) => (
                      <Badge key={variable} variant="outline" className="text-xs">
                        {variable}
                      </Badge>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}
