import React, { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Calendar } from '@/components/ui/calendar'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Badge } from '@/components/ui/badge'
import { Download, FileText, FileSpreadsheet, Loader2, BarChart3 } from 'lucide-react'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { AnalyticsService, AnalyticsReport } from '@/services/analytics'
import { useToast } from '@/hooks/use-toast'
import EmptyState from '@/components/EmptyState'

interface ReportGeneratorProps {
  userId: string
}

type ReportType = 'daily' | 'weekly' | 'monthly' | 'custom'

export const ReportGenerator: React.FC<ReportGeneratorProps> = ({ userId }) => {
  const [reportType, setReportType] = useState<ReportType | ''>('')
  const [dateRange, setDateRange] = useState<{ start: string; end: string }>({
    start: '',
    end: ''
  })
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [isGenerating, setIsGenerating] = useState(false)
  const [generatedReport, setGeneratedReport] = useState<AnalyticsReport | null>(null)
  const { toast } = useToast()

  const handleReportTypeChange = (value: string) => {
    setReportType(value as ReportType)
  }

  const reportTypes = [
    { value: 'daily', label: 'Relatório Diário', description: 'Resumo das atividades do dia' },
    { value: 'weekly', label: 'Relatório Semanal', description: 'Análise semanal de performance' },
    { value: 'monthly', label: 'Relatório Mensal', description: 'Relatório mensal completo' },
    { value: 'custom', label: 'Relatório Personalizado', description: 'Período personalizado' }
  ]

  const handleGenerateReport = async () => {
    if (!reportType || !dateRange.start || !dateRange.end || !title.trim()) {
      toast({
        title: 'Campos obrigatórios',
        description: 'Preencha todos os campos obrigatórios.',
        variant: 'destructive'
      })
      return
    }

    setIsGenerating(true)
    try {
      const report = await AnalyticsService.generateReport(
        userId,
        reportType,
        title.trim(),
        dateRange,
        description.trim() || undefined
      )

      setGeneratedReport(report)
      toast({
        title: 'Relatório gerado',
        description: 'O relatório foi gerado com sucesso.',
      })
    } catch (error) {
      console.error('Erro ao gerar relatório:', error)
      toast({
        title: 'Erro',
        description: 'Não foi possível gerar o relatório.',
        variant: 'destructive'
      })
    } finally {
      setIsGenerating(false)
    }
  }

  const handleExportPDF = async () => {
    if (!generatedReport) return

    try {
      // TODO: Implementar exportação PDF real
      toast({
        title: 'Exportação PDF',
        description: 'Funcionalidade em desenvolvimento.',
      })
    } catch (error) {
      toast({
        title: 'Erro',
        description: 'Não foi possível exportar o PDF.',
        variant: 'destructive'
      })
    }
  }

  const handleExportExcel = async () => {
    if (!generatedReport) return

    try {
      // TODO: Implementar exportação Excel real
      toast({
        title: 'Exportação Excel',
        description: 'Funcionalidade em desenvolvimento.',
      })
    } catch (error) {
      toast({
        title: 'Erro',
        description: 'Não foi possível exportar o Excel.',
        variant: 'destructive'
      })
    }
  }

  const selectedReportType = reportTypes.find(type => type.value === reportType)

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Gerador de Relatórios</CardTitle>
          <CardDescription>
            Gere relatórios analíticos em PDF ou Excel com dados personalizados
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="report-type">Tipo de Relatório</Label>
              <Select value={reportType} onValueChange={handleReportTypeChange}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione o tipo" />
                </SelectTrigger>
                <SelectContent>
                  {reportTypes.map((type) => (
                    <SelectItem key={type.value} value={type.value}>
                      <div>
                        <div className="font-medium">{type.label}</div>
                        <div className="text-sm text-muted-foreground">{type.description}</div>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="title">Título do Relatório *</Label>
              <Input
                id="title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Ex: Relatório de Performance - Janeiro 2024"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Descrição (opcional)</Label>
            <Input
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Descrição adicional do relatório"
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Data Inicial *</Label>
              <Input
                type="date"
                value={dateRange.start}
                onChange={(e) => setDateRange(prev => ({ ...prev, start: e.target.value }))}
              />
            </div>

            <div className="space-y-2">
              <Label>Data Final *</Label>
              <Input
                type="date"
                value={dateRange.end}
                onChange={(e) => setDateRange(prev => ({ ...prev, end: e.target.value }))}
              />
            </div>
          </div>

          <Button
            onClick={handleGenerateReport}
            disabled={isGenerating || !reportType || !dateRange.start || !dateRange.end || !title.trim()}
            className="w-full"
          >
            {isGenerating ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Gerando Relatório...
              </>
            ) : (
              <>
                <FileText className="mr-2 h-4 w-4" />
                Gerar Relatório
              </>
            )}
          </Button>
        </CardContent>
      </Card>

      {generatedReport ? (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span>Relatório Gerado</span>
              <Badge variant="secondary">
                {selectedReportType?.label}
              </Badge>
            </CardTitle>
            <CardDescription>
              Relatório gerado em {format(new Date(generatedReport.generated_at), 'dd/MM/yyyy HH:mm', { locale: ptBR })}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="font-medium">Período:</span> {generatedReport.date_range.start} - {generatedReport.date_range.end}
              </div>
              <div>
                <span className="font-medium">Expira em:</span> {format(new Date(generatedReport.expires_at), 'dd/MM/yyyy', { locale: ptBR })}
              </div>
            </div>

            <div className="flex gap-2">
              <Button onClick={handleExportPDF} variant="outline" size="sm">
                <Download className="mr-2 h-4 w-4" />
                Exportar PDF
              </Button>
              <Button onClick={handleExportExcel} variant="outline" size="sm">
                <FileSpreadsheet className="mr-2 h-4 w-4" />
                Exportar Excel
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : (
        <EmptyState
          variant="reports"
          title="Nenhum relatório gerado ainda"
          description="Gere seu primeiro relatório analítico para acompanhar a performance da sua operação logística com dados detalhados e insights valiosos."
          actions={[
            {
              label: "Gerar Primeiro Relatório",
              onClick: () => document.getElementById('report-type')?.scrollIntoView({ behavior: 'smooth' }),
              variant: "hero",
              icon: FileText
            }
          ]}
          badge={{ text: "Relatórios", variant: "secondary" }}
          metrics={[
            { label: "Relatórios Disponíveis", value: "4", icon: FileText },
            { label: "Formatos de Exportação", value: "2", icon: Download },
            { label: "Análises Incluídas", value: "∞", icon: BarChart3 }
          ]}
          tips={[
            "Escolha o período ideal para sua análise",
            "Relatórios personalizados oferecem mais flexibilidade",
            "Exporte em PDF para apresentações profissionais"
          ]}
        />
      )}
    </div>
  )
}