import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useScheduledReports, type CreateScheduledReportInput } from '@/hooks/useScheduledReports';
import { Calendar, Clock, Mail, FileText, Trash2, Play, Pause, Edit, Plus } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

const DAYS_OF_WEEK = [
  { value: 0, label: 'Domingo' },
  { value: 1, label: 'Segunda' },
  { value: 2, label: 'Terça' },
  { value: 3, label: 'Quarta' },
  { value: 4, label: 'Quinta' },
  { value: 5, label: 'Sexta' },
  { value: 6, label: 'Sábado' },
];

export function ScheduledReportsManager() {
  const { reports, isLoading, createReport, updateReport, toggleActive, deleteReport, sendNow } =
    useScheduledReports();

  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingReport, setEditingReport] = useState<string | null>(null);

  const [formData, setFormData] = useState<CreateScheduledReportInput>({
    name: '',
    report_type: 'pdf',
    frequency: 'weekly',
    time: '09:00',
    email_recipients: [''],
  });

  const handleSubmit = async () => {
    if (editingReport) {
      await updateReport(editingReport, formData);
    } else {
      await createReport(formData);
    }

    setIsDialogOpen(false);
    resetForm();
  };

  const resetForm = () => {
    setFormData({
      name: '',
      report_type: 'pdf',
      frequency: 'weekly',
      time: '09:00',
      email_recipients: [''],
    });
    setEditingReport(null);
  };

  const handleEdit = (reportId: string) => {
    const report = reports.find((r) => r.id === reportId);
    if (report) {
      setFormData({
        name: report.name,
        report_type: report.report_type,
        frequency: report.frequency,
        day_of_week: report.day_of_week,
        day_of_month: report.day_of_month,
        time: report.time,
        filters: report.filters,
        email_recipients: report.email_recipients,
      });
      setEditingReport(reportId);
      setIsDialogOpen(true);
    }
  };

  const addEmailRecipient = () => {
    setFormData({
      ...formData,
      email_recipients: [...formData.email_recipients, ''],
    });
  };

  const removeEmailRecipient = (index: number) => {
    setFormData({
      ...formData,
      email_recipients: formData.email_recipients.filter((_, i) => i !== index),
    });
  };

  const updateEmailRecipient = (index: number, value: string) => {
    const newRecipients = [...formData.email_recipients];
    newRecipients[index] = value;
    setFormData({ ...formData, email_recipients: newRecipients });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Relatórios Agendados</h2>
          <p className="text-muted-foreground">
            Agende relatórios para serem enviados automaticamente por email
          </p>
        </div>

        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={resetForm}>
              <Plus className="h-4 w-4 mr-2" />
              Novo Agendamento
            </Button>
          </DialogTrigger>

          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>
                {editingReport ? 'Editar' : 'Novo'} Relatório Agendado
              </DialogTitle>
              <DialogDescription>
                Configure um relatório para ser enviado automaticamente
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-6 py-4">
              {/* Nome */}
              <div className="space-y-2">
                <Label htmlFor="name">Nome do Relatório</Label>
                <Input
                  id="name"
                  placeholder="Ex: Relatório Mensal de Entregas"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                />
              </div>

              {/* Tipo de Relatório */}
              <div className="space-y-2">
                <Label>Tipo de Relatório</Label>
                <Select
                  value={formData.report_type}
                  onValueChange={(value) =>
                    setFormData({ ...formData, report_type: value as 'pdf' | 'excel' | 'csv' | 'complete' })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="pdf">PDF</SelectItem>
                    <SelectItem value="excel">Excel</SelectItem>
                    <SelectItem value="csv">CSV</SelectItem>
                    <SelectItem value="complete">Completo (PDF + Excel)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Frequência */}
              <div className="space-y-2">
                <Label>Frequência</Label>
                <Select
                  value={formData.frequency}
                  onValueChange={(value) =>
                    setFormData({ ...formData, frequency: value as 'daily' | 'weekly' | 'monthly' })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="daily">Diário</SelectItem>
                    <SelectItem value="weekly">Semanal</SelectItem>
                    <SelectItem value="monthly">Mensal</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Dia da Semana (apenas para semanal) */}
              {formData.frequency === 'weekly' && (
                <div className="space-y-2">
                  <Label>Dia da Semana</Label>
                  <Select
                    value={formData.day_of_week?.toString()}
                    onValueChange={(value) =>
                      setFormData({ ...formData, day_of_week: parseInt(value) })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione o dia" />
                    </SelectTrigger>
                    <SelectContent>
                      {DAYS_OF_WEEK.map((day) => (
                        <SelectItem key={day.value} value={day.value.toString()}>
                          {day.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {/* Dia do Mês (apenas para mensal) */}
              {formData.frequency === 'monthly' && (
                <div className="space-y-2">
                  <Label>Dia do Mês</Label>
                  <Input
                    type="number"
                    min="1"
                    max="31"
                    placeholder="1-31"
                    value={formData.day_of_month || ''}
                    onChange={(e) =>
                      setFormData({ ...formData, day_of_month: parseInt(e.target.value) })
                    }
                  />
                </div>
              )}

              {/* Horário */}
              <div className="space-y-2">
                <Label htmlFor="time">Horário</Label>
                <Input
                  id="time"
                  type="time"
                  value={formData.time}
                  onChange={(e) => setFormData({ ...formData, time: e.target.value })}
                />
              </div>

              {/* Destinatários */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label>Destinatários de Email</Label>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={addEmailRecipient}
                  >
                    <Plus className="h-3 w-3 mr-1" />
                    Adicionar
                  </Button>
                </div>
                <div className="space-y-2">
                  {formData.email_recipients.map((email, index) => (
                    <div key={index} className="flex gap-2">
                      <Input
                        type="email"
                        placeholder="email@example.com"
                        value={email}
                        onChange={(e) => updateEmailRecipient(index, e.target.value)}
                      />
                      {formData.email_recipients.length > 1 && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          onClick={() => removeEmailRecipient(index)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-3">
              <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
                Cancelar
              </Button>
              <Button onClick={handleSubmit} disabled={!formData.name || formData.email_recipients.some(e => !e)}>
                {editingReport ? 'Atualizar' : 'Criar'} Agendamento
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Lista de Relatórios */}
      <Card>
        <CardHeader>
          <CardTitle>Agendamentos Ativos</CardTitle>
          <CardDescription>
            {reports.filter((r) => r.is_active).length} relatório(s) agendado(s)
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center py-8 text-muted-foreground">Carregando...</div>
          ) : reports.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              Nenhum relatório agendado. Clique em "Novo Agendamento" para começar.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nome</TableHead>
                    <TableHead>Tipo</TableHead>
                    <TableHead>Frequência</TableHead>
                    <TableHead>Próximo Envio</TableHead>
                    <TableHead>Destinatários</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {reports.map((report) => (
                    <TableRow key={report.id}>
                      <TableCell className="font-medium">{report.name}</TableCell>
                      <TableCell>
                        <Badge variant="outline">{report.report_type.toUpperCase()}</Badge>
                      </TableCell>
                      <TableCell>
                        {report.frequency === 'daily' && 'Diário'}
                        {report.frequency === 'weekly' && `Semanal (${DAYS_OF_WEEK[report.day_of_week || 0].label})`}
                        {report.frequency === 'monthly' && `Mensal (dia ${report.day_of_month})`}
                      </TableCell>
                      <TableCell>
                        {report.next_run_at ? (
                          <div className="flex items-center gap-1 text-sm">
                            <Calendar className="h-3 w-3" />
                            {format(new Date(report.next_run_at), "dd/MM 'às' HH:mm", {
                              locale: ptBR,
                            })}
                          </div>
                        ) : (
                          '-'
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <Mail className="h-3 w-3" />
                          {report.email_recipients.length}
                        </div>
                      </TableCell>
                      <TableCell>
                        {report.is_active ? (
                          <Badge variant="success">Ativo</Badge>
                        ) : (
                          <Badge variant="secondary">Pausado</Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-2">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => sendNow(report.id)}
                            title="Enviar agora"
                          >
                            <Play className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => toggleActive(report.id, !report.is_active)}
                            title={report.is_active ? 'Pausar' : 'Ativar'}
                          >
                            {report.is_active ? (
                              <Pause className="h-4 w-4" />
                            ) : (
                              <Play className="h-4 w-4" />
                            )}
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleEdit(report.id)}
                            title="Editar"
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => deleteReport(report.id)}
                            title="Excluir"
                          >
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
