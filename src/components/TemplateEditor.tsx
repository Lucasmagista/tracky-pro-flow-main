import React, { useState, useEffect } from 'react'
import { supabase } from '@/integrations/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { AlertCircle, Save, Eye, EyeOff } from 'lucide-react'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { useToast } from '@/components/ui/use-toast'
import type { Json } from '@/integrations/supabase/types'

interface NotificationTemplate {
  id?: string
  name?: string
  type?: string
  subject?: string
  content?: string
  variables?: string[]
  is_active?: boolean
}

interface TemplateEditorProps {
  templateId?: string
  onSave?: (template: NotificationTemplate) => void
  onCancel?: () => void
}

export function TemplateEditor({ templateId, onSave, onCancel }: TemplateEditorProps) {
  const [template, setTemplate] = useState<Partial<NotificationTemplate>>({
    name: '',
    type: 'email',
    subject: '',
    content: '',
    variables: [],
    is_active: true
  })
  const [loading, setLoading] = useState(false)
  const [previewMode, setPreviewMode] = useState(false)
  const [previewData, setPreviewData] = useState<Record<string, string>>({})
  const { toast } = useToast()

  useEffect(() => {
    if (templateId) {
      loadTemplate(templateId)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [templateId])

  const loadTemplate = async (id: string) => {
    try {
      setLoading(true)
      const { data, error } = await supabase
        .from('notification_templates')
        .select('*')
        .eq('id', id)
        .single()

      if (error) throw error

      // Convert variables from JSONB to string array
      const variables = Array.isArray(data.variables) 
        ? data.variables as string[] 
        : []

      setTemplate({
        ...data,
        variables
      })
    } catch (error) {
      console.error('Error loading template:', error)
      toast({
        title: "Erro ao carregar template",
        description: "Não foi possível carregar o template",
        variant: "destructive"
      })
    } finally {
      setLoading(false)
    }
  }

  const saveTemplate = async () => {
    try {
      setLoading(true)

      // Validações
      if (!template.name?.trim()) {
        toast({
          title: "Nome obrigatório",
          description: "Por favor, informe um nome para o template",
          variant: "destructive"
        })
        return
      }

      if (!template.content?.trim()) {
        toast({
          title: "Conteúdo obrigatório",
          description: "Por favor, informe o conteúdo do template",
          variant: "destructive"
        })
        return
      }

      if (template.type === 'email' && !template.subject?.trim()) {
        toast({
          title: "Assunto obrigatório",
          description: "Por favor, informe o assunto do email",
          variant: "destructive"
        })
        return
      }

      // Get current user
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        toast({
          title: "Erro de autenticação",
          description: "Você precisa estar autenticado para salvar templates",
          variant: "destructive"
        })
        return
      }

      const templateData = {
        name: template.name!,
        type: template.type!,
        content: template.content!,
        subject: template.subject,
        user_id: user.id,
        is_active: template.is_active ?? true,
        variables: extractVariables(template.content || '') as Json
      }

      let result
      if (templateId) {
        result = await supabase
          .from('notification_templates')
          .update(templateData)
          .eq('id', templateId)
          .select()
          .single()
      } else {
        result = await supabase
          .from('notification_templates')
          .insert([templateData])
          .select()
          .single()
      }

      if (result.error) throw result.error

      toast({
        title: "Template salvo!",
        description: `O template "${template.name}" foi salvo com sucesso`
      })

      onSave?.(result.data)
    } catch (error) {
      console.error('Error saving template:', error)
      toast({
        title: "Erro ao salvar template",
        description: error instanceof Error ? error.message : "Não foi possível salvar o template",
        variant: "destructive"
      })
    } finally {
      setLoading(false)
    }
  }

  const extractVariables = (content: string): string[] => {
    const variableRegex = /\{\{(\w+)\}\}/g
    const variables = new Set<string>()
    let match

    while ((match = variableRegex.exec(content)) !== null) {
      variables.add(match[1])
    }

    return Array.from(variables)
  }

  const insertVariable = (variable: string) => {
    const textArea = document.getElementById('template-content') as HTMLTextAreaElement
    if (textArea) {
      const start = textArea.selectionStart
      const end = textArea.selectionEnd
      const text = textArea.value
      const before = text.substring(0, start)
      const after = text.substring(end, text.length)
      const newText = `${before}{{${variable}}}${after}`

      setTemplate(prev => ({ ...prev, content: newText }))

      // Restore cursor position
      setTimeout(() => {
        textArea.selectionStart = textArea.selectionEnd = start + variable.length + 4
        textArea.focus()
      }, 0)
    }
  }

  const renderPreview = () => {
    if (!template.content) return ''

    let content = template.content
    Object.entries(previewData).forEach(([key, value]) => {
      content = content.replace(new RegExp(`\\{\\{${key}\\}\\}`, 'g'), value)
    })

    if (template.type === 'email') {
      return content.replace(/\n/g, '<br>')
    }

    return content
  }

  const variables = extractVariables(template.content || '')

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>
            {templateId ? 'Editar Template' : 'Novo Template'}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium">Nome do Template</label>
              <Input
                value={template.name || ''}
                onChange={(e) => setTemplate(prev => ({ ...prev, name: e.target.value }))}
                placeholder="Ex: Pedido Confirmado"
              />
            </div>
            <div>
              <label className="text-sm font-medium">Tipo</label>
              <Select
                value={template.type}
                onValueChange={(value: 'email' | 'whatsapp') =>
                  setTemplate(prev => ({ ...prev, type: value }))
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="email">Email</SelectItem>
                  <SelectItem value="whatsapp">WhatsApp</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {template.type === 'email' && (
            <div>
              <label className="text-sm font-medium">Assunto</label>
              <Input
                value={template.subject || ''}
                onChange={(e) => setTemplate(prev => ({ ...prev, subject: e.target.value }))}
                placeholder="Assunto do email"
              />
            </div>
          )}

          <div>
            <label className="text-sm font-medium">Conteúdo</label>
            <Textarea
              id="template-content"
              value={template.content || ''}
              onChange={(e) => setTemplate(prev => ({ ...prev, content: e.target.value }))}
              placeholder={template.type === 'email'
                ? 'Digite o conteúdo do email...'
                : 'Digite a mensagem do WhatsApp...'
              }
              rows={10}
              className="font-mono text-sm"
            />
          </div>

          {variables.length > 0 && (
            <div>
              <label className="text-sm font-medium">Variáveis Detectadas</label>
              <div className="flex flex-wrap gap-2 mt-2">
                {variables.map(variable => (
                  <Badge key={variable} variant="secondary">
                    {variable}
                  </Badge>
                ))}
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                Clique em uma variável para inseri-la no conteúdo
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      <Tabs value={previewMode ? 'preview' : 'edit'} onValueChange={(value) => setPreviewMode(value === 'preview')}>
        <TabsList>
          <TabsTrigger value="edit">Editar</TabsTrigger>
          <TabsTrigger value="preview">Visualizar</TabsTrigger>
        </TabsList>

        <TabsContent value="edit" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <AlertCircle className="h-4 w-4" />
                Variáveis Disponíveis
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                {['nome', 'pedido_id', 'status', 'data', 'valor', 'produto'].map(variable => (
                  <Button
                    key={variable}
                    variant="outline"
                    size="sm"
                    onClick={() => insertVariable(variable)}
                  >
                    {`{{${variable}}}`}
                  </Button>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="preview" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Pré-visualização</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {template.type === 'email' && template.subject && (
                <div>
                  <label className="text-sm font-medium">Assunto:</label>
                  <p className="text-sm bg-muted p-2 rounded">{template.subject}</p>
                </div>
              )}

              <div>
                <label className="text-sm font-medium">Conteúdo:</label>
                <div className="border rounded p-4 bg-muted/50">
                  {template.type === 'email' ? (
                    <div dangerouslySetInnerHTML={{ __html: renderPreview() }} />
                  ) : (
                    <pre className="whitespace-pre-wrap font-sans">{renderPreview()}</pre>
                  )}
                </div>
              </div>

              <Alert>
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  Esta é uma pré-visualização. As variáveis serão substituídas pelos valores reais quando a notificação for enviada.
                </AlertDescription>
              </Alert>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <div className="flex justify-end gap-2">
        {onCancel && (
          <Button variant="outline" onClick={onCancel}>
            Cancelar
          </Button>
        )}
        <Button onClick={saveTemplate} disabled={loading}>
          <Save className="h-4 w-4 mr-2" />
          {loading ? 'Salvando...' : 'Salvar Template'}
        </Button>
      </div>
    </div>
  )
}