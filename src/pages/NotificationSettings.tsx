import React, { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import EmptyState from '@/components/EmptyState'
import { TemplateEditor } from '@/components/TemplateEditor'
import { useScheduledNotifications } from '@/hooks/useScheduledNotifications'
import { supabase } from '@/integrations/supabase/client'
import { Plus, Calendar, Mail, MessageSquare, Edit, Trash2, ArrowLeft, Clock } from 'lucide-react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog'
import { useNavigate } from 'react-router-dom'
import type { Json } from '@/integrations/supabase/types'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { useToast } from '@/components/ui/use-toast'

interface LocalNotificationTemplate {
  id?: string
  name?: string
  type?: string
  subject?: string
  content?: string
  variables?: string[]
  is_active?: boolean
}

interface NotificationTemplate {
  id: string
  name: string
  type: string
  subject?: string
  content: string
  variables: Json
  is_active: boolean
  created_at: string
}

export default function NotificationSettings() {
  const [templates, setTemplates] = useState<NotificationTemplate[]>([])
  const [selectedTemplate, setSelectedTemplate] = useState<string | null>(null)
  const [showTemplateEditor, setShowTemplateEditor] = useState(false)
  const [showScheduleDialog, setShowScheduleDialog] = useState(false)
  const { scheduledNotifications, loading: scheduledLoading, cancelScheduledNotification, scheduleNotification, refresh } = useScheduledNotifications()
  const navigate = useNavigate()
  const { toast } = useToast()

  // Form state for scheduling
  const [scheduleForm, setScheduleForm] = useState({
    type: 'email' as 'email' | 'whatsapp',
    template_id: '',
    recipient: '',
    scheduled_at: '',
    variables: {} as Record<string, string>
  })

  React.useEffect(() => {
    loadTemplates()
  }, [])

  const loadTemplates = async () => {
    try {
      const { data, error } = await supabase
        .from('notification_templates')
        .select('*')
        .order('created_at', { ascending: false })

      if (error) throw error

      setTemplates(data || [])
    } catch (error) {
      console.error('Error loading templates:', error)
    }
  }

  const deleteTemplate = async (templateId: string) => {
    try {
      const { error } = await supabase
        .from('notification_templates')
        .delete()
        .eq('id', templateId)

      if (error) throw error

      setTemplates(prev => prev.filter(t => t.id !== templateId))
    } catch (error) {
      console.error('Error deleting template:', error)
    }
  }

  const handleTemplateSave = (template: LocalNotificationTemplate) => {
    setShowTemplateEditor(false)
    setSelectedTemplate(null)
    loadTemplates()
  }

  const getTypeIcon = (type: string) => {
    return type === 'email' ? <Mail className="h-4 w-4" /> : <MessageSquare className="h-4 w-4" />
  }

  const getTypeLabel = (type: string) => {
    return type === 'email' ? 'Email' : 'WhatsApp'
  }

  const handleScheduleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!scheduleForm.recipient || !scheduleForm.scheduled_at) {
      toast({
        title: "Campos obrigatórios",
        description: "Preencha todos os campos obrigatórios",
        variant: "destructive"
      })
      return
    }

    const result = await scheduleNotification({
      type: scheduleForm.type,
      template_id: scheduleForm.template_id || undefined,
      recipient: scheduleForm.recipient,
      scheduled_at: scheduleForm.scheduled_at,
      variables: scheduleForm.variables
    })

    if (result.success) {
      toast({
        title: "Notificação agendada!",
        description: "A notificação foi agendada com sucesso"
      })
      setShowScheduleDialog(false)
      setScheduleForm({
        type: 'email',
        template_id: '',
        recipient: '',
        scheduled_at: '',
        variables: {}
      })
      refresh()
    } else {
      toast({
        title: "Erro ao agendar",
        description: result.error || "Não foi possível agendar a notificação",
        variant: "destructive"
      })
    }
  }

  const resetScheduleForm = () => {
    setScheduleForm({
      type: 'email',
      template_id: '',
      recipient: '',
      scheduled_at: '',
      variables: {}
    })
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate('/dashboard')}
            className="flex items-center gap-2"
          >
            <ArrowLeft className="h-4 w-4" />
            Voltar ao Dashboard
          </Button>
        </div>
        <h1 className="text-3xl font-bold">Configurações de Notificação</h1>
      </div>

      <Tabs defaultValue="templates" className="space-y-6">
        <TabsList>
          <TabsTrigger value="templates">Templates</TabsTrigger>
          <TabsTrigger value="scheduled">Agendadas</TabsTrigger>
        </TabsList>

        <TabsContent value="templates" className="space-y-6">
          <div className="flex justify-between items-center">
            <h2 className="text-xl font-semibold">Templates de Notificação</h2>
            <Dialog open={showTemplateEditor} onOpenChange={setShowTemplateEditor}>
              <DialogTrigger asChild>
                <Button onClick={() => setSelectedTemplate(null)}>
                  <Plus className="h-4 w-4 mr-2" />
                  Novo Template
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle>
                    {selectedTemplate ? 'Editar Template' : 'Novo Template'}
                  </DialogTitle>
                </DialogHeader>
                <TemplateEditor
                  templateId={selectedTemplate || undefined}
                  onSave={handleTemplateSave}
                  onCancel={() => {
                    setShowTemplateEditor(false)
                    setSelectedTemplate(null)
                  }}
                />
              </DialogContent>
            </Dialog>
          </div>

          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {templates.map(template => (
              <Card key={template.id} className="relative">
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      {getTypeIcon(template.type)}
                      <Badge variant={template.type === 'email' ? 'default' : 'secondary'}>
                        {getTypeLabel(template.type)}
                      </Badge>
                    </div>
                    <div className="flex gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          setSelectedTemplate(template.id)
                          setShowTemplateEditor(true)
                        }}
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button variant="ghost" size="sm">
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Excluir Template</AlertDialogTitle>
                            <AlertDialogDescription>
                              Tem certeza que deseja excluir este template? Esta ação não pode ser desfeita.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancelar</AlertDialogCancel>
                            <AlertDialogAction onClick={() => deleteTemplate(template.id)}>
                              Excluir
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                  </div>
                  <CardTitle className="text-lg">{template.name}</CardTitle>
                </CardHeader>
                <CardContent>
                  {template.subject && (
                    <p className="text-sm text-muted-foreground mb-2">
                      <strong>Assunto:</strong> {template.subject}
                    </p>
                  )}
                  <p className="text-sm text-muted-foreground line-clamp-3">
                    {template.content}
                  </p>
                  {template.variables && Array.isArray(template.variables) && template.variables.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-2">
                      {template.variables.map((variable, index) => (
                        <Badge key={index} variant="outline" className="text-xs">
                          {String(variable)}
                        </Badge>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>

          {templates.length === 0 && (
            <EmptyState
              variant="notifications"
              title="Nenhum template de notificação criado"
              description="Crie templates personalizados para enviar notificações por email e WhatsApp aos seus clientes em diferentes situações do processo de entrega."
              actions={[
                {
                  label: "Criar Primeiro Template",
                  onClick: () => setShowTemplateEditor(true),
                  variant: "hero",
                  icon: Plus
                }
              ]}
              badge={{ text: "Templates", variant: "secondary" }}
              metrics={[
                { label: "Templates Criados", value: "0", icon: Mail },
                { label: "Tipos Disponíveis", value: "2", icon: MessageSquare },
                { label: "Personalização", value: "100%", icon: Edit }
              ]}
              tips={[
                "Templates ajudam a manter consistência nas comunicações",
                "Use variáveis para personalizar mensagens automaticamente",
                "Crie templates para diferentes status de entrega"
              ]}
            />
          )}
        </TabsContent>

        <TabsContent value="scheduled" className="space-y-6">
          <div className="flex justify-between items-center">
            <h2 className="text-xl font-semibold">Notificações Agendadas</h2>
            <Dialog open={showScheduleDialog} onOpenChange={(open) => {
              setShowScheduleDialog(open)
              if (!open) resetScheduleForm()
            }}>
              <DialogTrigger asChild>
                <Button>
                  <Calendar className="h-4 w-4 mr-2" />
                  Agendar Notificação
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-2xl">
                <DialogHeader>
                  <DialogTitle>Agendar Nova Notificação</DialogTitle>
                </DialogHeader>
                <form onSubmit={handleScheduleSubmit} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="type">Tipo de Notificação</Label>
                    <Select
                      value={scheduleForm.type}
                      onValueChange={(value: 'email' | 'whatsapp') => 
                        setScheduleForm(prev => ({ ...prev, type: value }))
                      }
                    >
                      <SelectTrigger id="type">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="email">
                          <div className="flex items-center gap-2">
                            <Mail className="h-4 w-4" />
                            Email
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

                  <div className="space-y-2">
                    <Label htmlFor="template">Template (Opcional)</Label>
                    <Select
                      value={scheduleForm.template_id || undefined}
                      onValueChange={(value) => 
                        setScheduleForm(prev => ({ ...prev, template_id: value === 'none' ? '' : value }))
                      }
                    >
                      <SelectTrigger id="template">
                        <SelectValue placeholder="Selecione um template ou deixe vazio" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">Sem template (mensagem manual)</SelectItem>
                        {templates
                          .filter(t => t.type === scheduleForm.type && t.is_active)
                          .map(template => (
                            <SelectItem key={template.id} value={template.id}>
                              {template.name}
                            </SelectItem>
                          ))
                        }
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="recipient">
                      {scheduleForm.type === 'email' ? 'Email do Destinatário' : 'Número do WhatsApp'}
                    </Label>
                    <Input
                      id="recipient"
                      type={scheduleForm.type === 'email' ? 'email' : 'tel'}
                      value={scheduleForm.recipient}
                      onChange={(e) => 
                        setScheduleForm(prev => ({ ...prev, recipient: e.target.value }))
                      }
                      placeholder={scheduleForm.type === 'email' ? 'cliente@email.com' : '5511999999999'}
                      required
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="scheduled_at">Data e Hora do Envio</Label>
                    <Input
                      id="scheduled_at"
                      type="datetime-local"
                      value={scheduleForm.scheduled_at}
                      onChange={(e) => 
                        setScheduleForm(prev => ({ ...prev, scheduled_at: e.target.value }))
                      }
                      min={new Date().toISOString().slice(0, 16)}
                      required
                    />
                  </div>

                  {scheduleForm.template_id && scheduleForm.template_id !== 'none' && (
                    <div className="space-y-2">
                      <Label>Variáveis do Template</Label>
                      <div className="p-4 border rounded-md bg-muted/50">
                        {(() => {
                          const selectedTemplate = templates.find(t => t.id === scheduleForm.template_id)
                          const variables = selectedTemplate?.variables as string[] | null
                          
                          if (!variables || variables.length === 0) {
                            return (
                              <p className="text-sm text-muted-foreground">
                                Este template não possui variáveis
                              </p>
                            )
                          }

                          return (
                            <div className="space-y-3">
                              {variables.map((variable) => (
                                <div key={variable} className="space-y-1">
                                  <Label htmlFor={`var-${variable}`} className="text-sm">
                                    {variable}
                                  </Label>
                                  <Input
                                    id={`var-${variable}`}
                                    value={scheduleForm.variables[variable] || ''}
                                    onChange={(e) => 
                                      setScheduleForm(prev => ({
                                        ...prev,
                                        variables: {
                                          ...prev.variables,
                                          [variable]: e.target.value
                                        }
                                      }))
                                    }
                                    placeholder={`Valor para ${variable}`}
                                  />
                                </div>
                              ))}
                            </div>
                          )
                        })()}
                      </div>
                    </div>
                  )}

                  <div className="flex justify-end gap-2 pt-4">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => {
                        setShowScheduleDialog(false)
                        resetScheduleForm()
                      }}
                    >
                      Cancelar
                    </Button>
                    <Button type="submit">
                      <Clock className="h-4 w-4 mr-2" />
                      Agendar
                    </Button>
                  </div>
                </form>
              </DialogContent>
            </Dialog>
          </div>

          <div className="space-y-4">
            {scheduledLoading ? (
              <EmptyState
                variant="info"
                title="Carregando notificações agendadas..."
                description="Estamos buscando suas notificações programadas e campanhas ativas."
                badge={{ text: "Carregando", variant: "secondary" }}
                tips={[
                  "Notificações agendadas ajudam a manter clientes informados",
                  "Campanhas automáticas melhoram a comunicação",
                  "Aguarde enquanto sincronizamos seus dados"
                ]}
              />
            ) : scheduledNotifications.length === 0 ? (
              <EmptyState
                variant="data"
                title="Nenhuma notificação agendada"
                description="Agende notificações automáticas para serem enviadas em datas específicas ou crie campanhas de comunicação com seus clientes."
                actions={[
                  {
                    label: "Agendar Notificação",
                    onClick: () => setShowScheduleDialog(true),
                    variant: "hero",
                    icon: Calendar
                  },
                  {
                    label: "Criar Template Primeiro",
                    onClick: () => {
                      const templatesTab = document.querySelector('[value="templates"]') as HTMLElement;
                      templatesTab?.click();
                    },
                    variant: "outline",
                    icon: Edit
                  }
                ]}
                badge={{ text: "Agendadas", variant: "secondary" }}
                metrics={[
                  { label: "Notificações Agendadas", value: "0", icon: Calendar },
                  { label: "Pendentes de Envio", value: "0", icon: Mail },
                  { label: "Taxa de Entrega", value: "0%", icon: MessageSquare }
                ]}
                tips={[
                  "Agende lembretes automáticos para entregas em atraso",
                  "Crie campanhas sazonais de comunicação",
                  "Monitore o desempenho das notificações enviadas"
                ]}
              />
            ) : (
              scheduledNotifications.map(notification => (
                <Card key={notification.id}>
                  <CardContent className="pt-6">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        {getTypeIcon(notification.type)}
                        <div>
                          <p className="font-medium">
                            {getTypeLabel(notification.type)} para {notification.recipient}
                          </p>
                          <p className="text-sm text-muted-foreground">
                            Agendado para {new Date(notification.scheduled_at).toLocaleString('pt-BR')}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant={
                          notification.status === 'pending' ? 'default' :
                          notification.status === 'sent' ? 'secondary' :
                          'destructive'
                        }>
                          {notification.status === 'pending' ? 'Pendente' :
                           notification.status === 'sent' ? 'Enviada' :
                           notification.status === 'failed' ? 'Falhou' : 'Cancelada'}
                        </Badge>
                        {notification.status === 'pending' && (
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button variant="outline" size="sm">
                                Cancelar
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>Cancelar Notificação</AlertDialogTitle>
                                <AlertDialogDescription>
                                  Tem certeza que deseja cancelar esta notificação agendada?
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Manter</AlertDialogCancel>
                                <AlertDialogAction onClick={() => cancelScheduledNotification(notification.id)}>
                                  Cancelar
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  )
}