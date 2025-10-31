import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  Save,
  FileText,
  Trash2,
  Download,
  Upload,
  Plus,
  Edit,
  Check,
  X,
  AlertTriangle
} from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

export interface MappingTemplate {
  id: string;
  name: string;
  description?: string;
  client_name?: string;
  file_type: 'csv' | 'excel';
  field_mappings: Record<string, string>;
  created_at: string;
  updated_at: string;
  usage_count: number;
  last_used?: string;
}

interface MappingTemplatesManagerProps {
  currentMappings: Record<string, string>;
  csvHeaders: string[];
  onApplyTemplate: (template: MappingTemplate) => void;
  onSaveTemplate: (template: Omit<MappingTemplate, 'id' | 'created_at' | 'updated_at' | 'usage_count'>) => void;
}

export const MappingTemplatesManager: React.FC<MappingTemplatesManagerProps> = ({
  currentMappings,
  csvHeaders,
  onApplyTemplate,
  onSaveTemplate
}) => {
  const { user } = useAuth();
  const [templates, setTemplates] = useState<MappingTemplate[]>([]);
  const [loading, setLoading] = useState(false);
  const [showSaveDialog, setShowSaveDialog] = useState(false);
  const [showTemplatesDialog, setShowTemplatesDialog] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<MappingTemplate | null>(null);

  const [newTemplate, setNewTemplate] = useState({
    name: '',
    description: '',
    client_name: '',
    file_type: 'csv' as 'csv' | 'excel'
  });


  // Carregar templates do usuário
  useEffect(() => {
    if (user && showTemplatesDialog) {
      console.log('Loading templates for user:', user.id);
      loadTemplates();
    } else if (!user) {
      console.log('No user found, cannot load templates');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, showTemplatesDialog]);

  const loadTemplates = useCallback(async () => {
    if (!user) {
      console.log('loadTemplates called but no user available');
      return;
    }

    console.log('Loading templates for user ID:', user.id);
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('mapping_templates')
        .select('*')
        .eq('user_id', user.id)
        .order('updated_at', { ascending: false });

      if (error) {
        console.error('Supabase error loading templates:', error);
        throw error;
      }

      console.log('Templates loaded successfully:', data?.length || 0, 'templates');
  setTemplates((data as MappingTemplate[]) || []);
    } catch (error) {
      console.error('Error loading templates:', error);
      toast.error('Erro ao carregar templates');
    } finally {
      setLoading(false);
    }
  }, [user]);

  const saveTemplate = async () => {
    if (!user || !newTemplate.name.trim()) {
      console.log('saveTemplate: user available?', !!user, 'template name:', newTemplate.name.trim());
      if (!user) {
        toast.error('Usuário não autenticado');
        return;
      }
      toast.error('Nome do template é obrigatório');
      return;
    }

    console.log('Saving template for user:', user.id);
    const templateData = {
      name: newTemplate.name.trim(),
      description: newTemplate.description.trim(),
      client_name: newTemplate.client_name.trim(),
      file_type: newTemplate.file_type,
      field_mappings: currentMappings
    };

    try {
      const { data, error } = await supabase
        .from('mapping_templates')
        .insert({
          user_id: user.id,
          ...templateData
        })
        .select()
        .single();

      if (error) {
        console.error('Supabase error saving template:', error);
        throw error;
      }

      console.log('Template saved successfully:', data);
      toast.success('Template salvo com sucesso!');
      setShowSaveDialog(false);
      setNewTemplate({
        name: '',
        description: '',
        client_name: '',
        file_type: 'csv'
      });

      // Recarregar templates
      loadTemplates();
    } catch (error) {
      console.error('Error saving template:', error);
      toast.error('Erro ao salvar template');
    }
  };


  // Atualizar apenas o mapeamento do template (não incrementa uso)
  const updateTemplate = async (template: MappingTemplate) => {
    if (!user) {
      console.log('updateTemplate: no user available');
      toast.error('Usuário não autenticado');
      return;
    }

    console.log('Updating template:', template.id, 'for user:', user.id);
    try {
      const { error } = await supabase
        .from('mapping_templates')
        .update({
          field_mappings: currentMappings,
          updated_at: new Date().toISOString()
        })
        .eq('id', template.id);

      if (error) {
        console.error('Supabase error updating template:', error);
        throw error;
      }

      console.log('Template updated successfully');
      toast.success('Template atualizado!');
      loadTemplates();
    } catch (error) {
      console.error('Error updating template:', error);
      toast.error('Erro ao atualizar template');
    }
  };

  // Aplicar template e incrementar uso
  const applyTemplate = async (template: MappingTemplate) => {
    onApplyTemplate(template);
    setShowTemplatesDialog(false);
    toast.success(`Template "${template.name}" aplicado!`);
    // Incrementar uso e atualizar last_used
    if (!user) return;
    try {
      await supabase
        .from('mapping_templates')
        .update({
          usage_count: template.usage_count + 1,
          last_used: new Date().toISOString()
        })
        .eq('id', template.id);
      loadTemplates();
    } catch (error) {
      // Silencioso
    }
  };

  const deleteTemplate = async (templateId: string) => {
    if (!user) {
      console.log('deleteTemplate: no user available');
      toast.error('Usuário não autenticado');
      return;
    }

    console.log('Deleting template:', templateId, 'for user:', user.id);
    try {
      const { error } = await supabase
        .from('mapping_templates')
        .delete()
        .eq('id', templateId);

      if (error) {
        console.error('Supabase error deleting template:', error);
        throw error;
      }

      console.log('Template deleted successfully');
      toast.success('Template excluído!');
      loadTemplates();
    } catch (error) {
      console.error('Error deleting template:', error);
      toast.error('Erro ao excluir template');
    }
  };



  const exportTemplate = (template: MappingTemplate) => {
    const dataStr = JSON.stringify(template, null, 2);
    const dataUri = 'data:application/json;charset=utf-8,'+ encodeURIComponent(dataStr);

    const exportFileDefaultName = `template-${template.name.replace(/\s+/g, '_')}.json`;

    const linkElement = document.createElement('a');
    linkElement.setAttribute('href', dataUri);
    linkElement.setAttribute('download', exportFileDefaultName);
    linkElement.click();
  };


  // Ref para resetar input de importação
  const importInputRef = React.useRef<HTMLInputElement>(null);
  const importTemplate = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !user) return;

    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const template = JSON.parse(e.target?.result as string);
        // Validação robusta
        if (
          typeof template !== 'object' ||
          !template.name ||
          typeof template.name !== 'string' ||
          !template.field_mappings ||
          typeof template.field_mappings !== 'object' ||
          Array.isArray(template.field_mappings)
        ) {
          throw new Error('Template inválido');
        }

        const { error } = await supabase
          .from('mapping_templates')
          .insert({
            user_id: user.id,
            name: `${template.name} (Importado)` ,
            description: template.description,
            client_name: template.client_name,
            file_type: template.file_type,
            field_mappings: template.field_mappings
          })
          .select()
          .single();

        if (error) throw error;

        toast.success('Template importado com sucesso!');
        loadTemplates();
      } catch (error) {
        console.error('Error importing template:', error);
        toast.error('Erro ao importar template');
      }
      // Resetar input
      if (importInputRef.current) importInputRef.current.value = '';
    };
    reader.readAsText(file);
  };

  const getMatchingScore = (template: MappingTemplate): number => {
    const templateHeaders = Object.keys(template.field_mappings);
    const matchingHeaders = templateHeaders.filter(header => csvHeaders.includes(header));
    return Math.round((matchingHeaders.length / templateHeaders.length) * 100);
  };

  return (
    <div className="space-y-4">
      {/* Verificação de autenticação */}
      {!user && (
        <Alert className="border-yellow-200 bg-yellow-50">
          <AlertTriangle className="h-4 w-4 text-yellow-600" />
          <AlertDescription className="text-yellow-800">
            Você precisa estar logado para usar templates de mapeamento.
          </AlertDescription>
        </Alert>
      )}

      {/* Botões de ação */}
      <div className="flex gap-2">
        <Dialog open={showSaveDialog} onOpenChange={setShowSaveDialog}>
          <DialogTrigger asChild>
            <Button variant="outline" size="sm" disabled={!user}>
              <Save className="h-4 w-4 mr-2" />
              Salvar Template
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Salvar Template de Mapeamento</DialogTitle>
              <DialogDescription>
                Salve este mapeamento para reutilizar em futuras importações
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label htmlFor="template-name">Nome do Template *</Label>
                <Input
                  id="template-name"
                  value={newTemplate.name}
                  onChange={(e) => setNewTemplate({...newTemplate, name: e.target.value})}
                  placeholder="Ex: NuvemShop - Cliente ABC"
                />
              </div>
              <div>
                <Label htmlFor="template-description">Descrição</Label>
                <Input
                  id="template-description"
                  value={newTemplate.description}
                  onChange={(e) => setNewTemplate({...newTemplate, description: e.target.value})}
                  placeholder="Descrição opcional do template"
                />
              </div>
              <div>
                <Label htmlFor="client-name">Nome do Cliente</Label>
                <Input
                  id="client-name"
                  value={newTemplate.client_name}
                  onChange={(e) => setNewTemplate({...newTemplate, client_name: e.target.value})}
                  placeholder="Nome do cliente ou empresa"
                />
              </div>
              <div>
                <Label htmlFor="file-type">Tipo de Arquivo</Label>
                <Select
                  value={newTemplate.file_type}
                  onValueChange={(value: 'csv' | 'excel') => setNewTemplate({...newTemplate, file_type: value})}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="csv">CSV</SelectItem>
                    <SelectItem value="excel">Excel</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setShowSaveDialog(false)}>
                  Cancelar
                </Button>
                <Button onClick={saveTemplate}>
                  <Save className="h-4 w-4 mr-2" />
                  Salvar
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        <Dialog open={showTemplatesDialog} onOpenChange={setShowTemplatesDialog}>
          <DialogTrigger asChild>
            <Button variant="outline" size="sm" disabled={!user}>
              <FileText className="h-4 w-4 mr-2" />
              Aplicar Template
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-4xl max-h-[80vh] overflow-hidden flex flex-col">
            <DialogHeader>
              <DialogTitle>Templates de Mapeamento Salvos</DialogTitle>
              <DialogDescription>
                Selecione um template para aplicar ao mapeamento atual
              </DialogDescription>
            </DialogHeader>

            <div className="flex-1 overflow-y-auto">
              {loading ? (
                <div className="text-center py-8">Carregando templates...</div>
              ) : templates.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <FileText className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>Nenhum template salvo ainda</p>
                  <p className="text-sm">Salve seu primeiro template após configurar um mapeamento</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {templates.map((template) => {
                    const matchingScore = getMatchingScore(template);
                    return (
                      <Card key={template.id} className="p-4">
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-2">
                              <h4 className="font-medium">{template.name}</h4>
                              <Badge variant="outline">{template.file_type.toUpperCase()}</Badge>
                              {matchingScore >= 80 && (
                                <Badge variant="default" className="bg-green-600">
                                  {matchingScore}% compatível
                                </Badge>
                              )}
                              {matchingScore >= 50 && matchingScore < 80 && (
                                <Badge variant="secondary">
                                  {matchingScore}% compatível
                                </Badge>
                              )}
                              {matchingScore < 50 && (
                                <Badge variant="outline">
                                  {matchingScore}% compatível
                                </Badge>
                              )}
                            </div>

                            {template.description && (
                              <p className="text-sm text-muted-foreground mb-2">
                                {template.description}
                              </p>
                            )}

                            {template.client_name && (
                              <p className="text-sm text-muted-foreground mb-2">
                                Cliente: {template.client_name}
                              </p>
                            )}

                            <div className="flex items-center gap-4 text-xs text-muted-foreground">
                              <span>Usado {template.usage_count}x</span>
                              {template.last_used && (
                                <span>Último uso: {new Date(template.last_used).toLocaleDateString('pt-BR')}</span>
                              )}
                              <span>Criado: {new Date(template.created_at).toLocaleDateString('pt-BR')}</span>
                            </div>

                            <div className="mt-2">
                              <p className="text-xs text-muted-foreground mb-1">
                                Campos mapeados: {Object.keys(template.field_mappings).length}
                              </p>
                              <div className="flex flex-wrap gap-1">
                                {Object.entries(template.field_mappings).slice(0, 5).map(([csvField, systemField]) => (
                                  <Badge key={`${csvField}-${systemField}`} variant="outline" className="text-xs">
                                    {csvField} → {systemField}
                                  </Badge>
                                ))}
                                {Object.keys(template.field_mappings).length > 5 && (
                                  <Badge variant="outline" className="text-xs">
                                    +{Object.keys(template.field_mappings).length - 5} mais
                                  </Badge>
                                )}
                              </div>
                            </div>
                          </div>

                          <div className="flex flex-col gap-2 ml-4">
                            <Button
                              size="sm"
                              onClick={() => applyTemplate(template)}
                              disabled={matchingScore === 0}
                            >
                              <Check className="h-4 w-4 mr-1" />
                              Aplicar
                            </Button>

                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => updateTemplate(template)}
                            >
                              <Edit className="h-4 w-4 mr-1" />
                              Atualizar
                            </Button>

                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => exportTemplate(template)}
                            >
                              <Download className="h-4 w-4 mr-1" />
                              Exportar
                            </Button>

                            <Button
                              size="sm"
                              variant="destructive"
                              onClick={() => deleteTemplate(template.id)}
                            >
                              <Trash2 className="h-4 w-4 mr-1" />
                              Excluir
                            </Button>
                          </div>
                        </div>

                        {matchingScore < 50 && (
                          <Alert className="mt-3 border-yellow-200 bg-yellow-50">
                            <AlertTriangle className="h-4 w-4 text-yellow-600" />
                            <AlertDescription className="text-yellow-800 text-sm">
                              Este template tem baixa compatibilidade com os cabeçalhos atuais.
                              Alguns campos podem precisar de remapeamento.
                            </AlertDescription>
                          </Alert>
                        )}
                      </Card>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="flex justify-between items-center pt-4 border-t">
              <div>
                <Label htmlFor="import-template" className="cursor-pointer">
                  <Button variant="outline" size="sm" asChild tabIndex={0}>
                    <span>
                      <Upload className="h-4 w-4 mr-2" />
                      Importar Template
                    </span>
                  </Button>
                </Label>
                <input
                  id="import-template"
                  type="file"
                  accept=".json"
                  onChange={importTemplate}
                  className="hidden"
                  ref={importInputRef}
                  tabIndex={-1}
                />
              </div>

              <Button variant="outline" onClick={() => setShowTemplatesDialog(false)}>
                Fechar
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Resumo dos mapeamentos atuais */}
      {Object.keys(currentMappings).length > 0 && (
        <Card className="p-4">
          <h4 className="font-medium mb-2">Mapeamento Atual</h4>
          <div className="flex flex-wrap gap-1">
            {Object.entries(currentMappings).map(([csvField, systemField]) => (
              <Badge key={`${csvField}-${systemField}`} variant="secondary" className="text-xs">
                {csvField} → {systemField}
              </Badge>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
};