import { useState } from 'react';
import { useToast } from '@/hooks/use-toast';
import { AdvancedExportService } from '@/services/advancedExport';

interface Order {
  id: string;
  tracking_code: string;
  customer_name: string;
  customer_email: string;
  customer_phone?: string;
  carrier: string;
  status: string;
  destination: string;
  origin?: string;
  created_at: string;
  updated_at: string;
  estimated_delivery?: string;
  delivered_at?: string;
}

interface ExportMetrics {
  total: number;
  delivered: number;
  inTransit: number;
  delayed: number;
  pending: number;
  deliveryRate: number;
  averageDeliveryTime: number;
}

interface ExportFilters {
  search?: string;
  statuses?: string[];
  carriers?: string[];
  dateRange?: { start: Date | null; end: Date | null };
}

export function useExport() {
  const [isExporting, setIsExporting] = useState(false);
  const { toast } = useToast();

  const exportToPDF = async (
    orders: Order[],
    metrics?: ExportMetrics,
    filters?: ExportFilters,
    title?: string
  ) => {
    try {
      setIsExporting(true);
      
      AdvancedExportService.exportToPDF(orders, metrics, {
        title: title || 'Relatório de Pedidos',
        subtitle: `${orders.length} pedidos selecionados`,
        includeMetrics: !!metrics,
        filters,
      });

      toast({
        title: '✅ PDF Exportado',
        description: 'O relatório foi baixado com sucesso!',
      });
    } catch (error) {
      console.error('Erro ao exportar PDF:', error);
      toast({
        title: '❌ Erro na Exportação',
        description: 'Não foi possível exportar o PDF. Tente novamente.',
        variant: 'destructive',
      });
    } finally {
      setIsExporting(false);
    }
  };

  const exportToExcel = async (
    orders: Order[],
    metrics?: ExportMetrics,
    filters?: ExportFilters,
    title?: string
  ) => {
    try {
      setIsExporting(true);
      
      AdvancedExportService.exportToExcel(orders, metrics, {
        title: title || 'Relatório de Pedidos',
        subtitle: `${orders.length} pedidos selecionados`,
        includeMetrics: !!metrics,
        filters,
      });

      toast({
        title: '✅ Excel Exportado',
        description: 'A planilha foi baixada com sucesso!',
      });
    } catch (error) {
      console.error('Erro ao exportar Excel:', error);
      toast({
        title: '❌ Erro na Exportação',
        description: 'Não foi possível exportar a planilha. Tente novamente.',
        variant: 'destructive',
      });
    } finally {
      setIsExporting(false);
    }
  };

  const exportToCSV = async (
    orders: Order[],
    filters?: ExportFilters
  ) => {
    try {
      setIsExporting(true);
      
      AdvancedExportService.exportToCSV(orders, { filters });

      toast({
        title: '✅ CSV Exportado',
        description: 'O arquivo CSV foi baixado com sucesso!',
      });
    } catch (error) {
      console.error('Erro ao exportar CSV:', error);
      toast({
        title: '❌ Erro na Exportação',
        description: 'Não foi possível exportar o CSV. Tente novamente.',
        variant: 'destructive',
      });
    } finally {
      setIsExporting(false);
    }
  };

  const exportCompleteReport = async (
    orders: Order[],
    metrics: ExportMetrics,
    filters?: ExportFilters
  ) => {
    try {
      setIsExporting(true);
      
      AdvancedExportService.exportCompleteReport(orders, metrics, {
        title: 'Relatório Completo',
        subtitle: `Análise de ${orders.length} pedidos`,
        includeMetrics: true,
        includeCharts: true,
        filters,
      });

      toast({
        title: '✅ Relatório Completo Gerado',
        description: 'O relatório completo foi exportado com sucesso!',
      });
    } catch (error) {
      console.error('Erro ao exportar relatório completo:', error);
      toast({
        title: '❌ Erro na Exportação',
        description: 'Não foi possível gerar o relatório. Tente novamente.',
        variant: 'destructive',
      });
    } finally {
      setIsExporting(false);
    }
  };

  const exportChartAsImage = async (
    chartElement: HTMLElement,
    filename: string
  ) => {
    try {
      setIsExporting(true);
      
      await AdvancedExportService.exportChartAsImage(chartElement, filename);

      toast({
        title: '✅ Gráfico Exportado',
        description: 'A imagem do gráfico foi baixada com sucesso!',
      });
    } catch (error) {
      console.error('Erro ao exportar gráfico:', error);
      toast({
        title: '❌ Erro na Exportação',
        description: 'Não foi possível exportar o gráfico. Tente novamente.',
        variant: 'destructive',
      });
    } finally {
      setIsExporting(false);
    }
  };

  return {
    isExporting,
    exportToPDF,
    exportToExcel,
    exportToCSV,
    exportCompleteReport,
    exportChartAsImage,
  };
}
