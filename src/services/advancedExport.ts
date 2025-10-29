import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

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

interface ExportOptions {
  title?: string;
  subtitle?: string;
  period?: string;
  includeMetrics?: boolean;
  includeCharts?: boolean;
  filters?: {
    search?: string;
    statuses?: string[];
    carriers?: string[];
    dateRange?: { start: Date | null; end: Date | null };
  };
}

const statusLabels: Record<string, string> = {
  pending: 'Aguardando',
  in_transit: 'Em Trânsito',
  out_for_delivery: 'Saiu p/ Entrega',
  delivered: 'Entregue',
  delayed: 'Atrasado',
  failed: 'Falha',
  returned: 'Devolvido',
};

/**
 * Serviço avançado de exportação de relatórios
 */
export class AdvancedExportService {
  /**
   * Exporta relatório profissional em PDF
   */
  static exportToPDF(
    orders: Order[],
    metrics?: ExportMetrics,
    options: ExportOptions = {}
  ): void {
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    let yPosition = 20;

    // Header com logo e título
    doc.setFontSize(24);
    doc.setTextColor(99, 102, 241); // Indigo
    doc.text(options.title || 'Relatório de Pedidos', pageWidth / 2, yPosition, {
      align: 'center',
    });

    yPosition += 10;
    doc.setFontSize(12);
    doc.setTextColor(100, 100, 100);
    doc.text('Tracky Pro Flow - Sistema de Rastreamento', pageWidth / 2, yPosition, {
      align: 'center',
    });

    yPosition += 5;
    if (options.subtitle) {
      doc.text(options.subtitle, pageWidth / 2, yPosition, { align: 'center' });
      yPosition += 5;
    }

    // Data de geração
    yPosition += 5;
    doc.setFontSize(10);
    doc.setTextColor(120, 120, 120);
    const now = new Date();
    doc.text(
      `Gerado em: ${format(now, "dd 'de' MMMM 'de' yyyy 'às' HH:mm", { locale: ptBR })}`,
      pageWidth / 2,
      yPosition,
      { align: 'center' }
    );

    yPosition += 10;

    // Linha separadora
    doc.setDrawColor(200, 200, 200);
    doc.line(15, yPosition, pageWidth - 15, yPosition);
    yPosition += 10;

    // Seção de Métricas
    if (options.includeMetrics && metrics) {
      doc.setFontSize(16);
      doc.setTextColor(0, 0, 0);
      doc.text('📊 Métricas do Período', 15, yPosition);
      yPosition += 10;

      // Grid de métricas
      const metricsData = [
        ['Total de Pedidos', metrics.total.toString()],
        ['Pedidos Entregues', metrics.delivered.toString()],
        ['Em Trânsito', metrics.inTransit.toString()],
        ['Atrasados', metrics.delayed.toString()],
        ['Pendentes', metrics.pending.toString()],
        ['Taxa de Entrega', `${metrics.deliveryRate}%`],
        [
          'Tempo Médio de Entrega',
          metrics.averageDeliveryTime > 0
            ? `${metrics.averageDeliveryTime} dias`
            : 'N/A',
        ],
      ];

      autoTable(doc, {
        startY: yPosition,
        head: [['Métrica', 'Valor']],
        body: metricsData,
        theme: 'grid',
        headStyles: {
          fillColor: [99, 102, 241],
          fontSize: 11,
          fontStyle: 'bold',
        },
        columnStyles: {
          0: { fontStyle: 'bold', cellWidth: 100 },
          1: { halign: 'right', cellWidth: 'auto' },
        },
        margin: { left: 15, right: 15 },
      });

      yPosition = (doc as any).lastAutoTable.finalY + 15;
    }

    // Filtros Aplicados
    if (options.filters) {
      const hasFilters =
        options.filters.search ||
        (options.filters.statuses && options.filters.statuses.length > 0) ||
        (options.filters.carriers && options.filters.carriers.length > 0) ||
        options.filters.dateRange?.start ||
        options.filters.dateRange?.end;

      if (hasFilters) {
        doc.setFontSize(14);
        doc.setTextColor(0, 0, 0);
        doc.text('🔍 Filtros Aplicados', 15, yPosition);
        yPosition += 8;

        doc.setFontSize(10);
        doc.setTextColor(80, 80, 80);

        if (options.filters.search) {
          doc.text(`• Busca: "${options.filters.search}"`, 20, yPosition);
          yPosition += 6;
        }

        if (options.filters.statuses && options.filters.statuses.length > 0) {
          const statusText = options.filters.statuses
            .map((s) => statusLabels[s] || s)
            .join(', ');
          doc.text(`• Status: ${statusText}`, 20, yPosition);
          yPosition += 6;
        }

        if (options.filters.carriers && options.filters.carriers.length > 0) {
          doc.text(`• Transportadoras: ${options.filters.carriers.join(', ')}`, 20, yPosition);
          yPosition += 6;
        }

        if (options.filters.dateRange?.start || options.filters.dateRange?.end) {
          const start = options.filters.dateRange.start
            ? format(options.filters.dateRange.start, 'dd/MM/yyyy')
            : 'início';
          const end = options.filters.dateRange.end
            ? format(options.filters.dateRange.end, 'dd/MM/yyyy')
            : 'fim';
          doc.text(`• Período: ${start} até ${end}`, 20, yPosition);
          yPosition += 6;
        }

        yPosition += 5;
      }
    }

    // Tabela de Pedidos
    if (yPosition > pageHeight - 60) {
      doc.addPage();
      yPosition = 20;
    }

    doc.setFontSize(16);
    doc.setTextColor(0, 0, 0);
    doc.text('📦 Lista de Pedidos', 15, yPosition);
    yPosition += 10;

    const tableData = orders.map((order) => [
      order.tracking_code,
      order.customer_name,
      order.carrier,
      statusLabels[order.status] || order.status,
      order.destination,
      format(new Date(order.created_at), 'dd/MM/yyyy', { locale: ptBR }),
    ]);

    autoTable(doc, {
      startY: yPosition,
      head: [['Código', 'Cliente', 'Transportadora', 'Status', 'Destino', 'Data']],
      body: tableData,
      theme: 'striped',
      headStyles: {
        fillColor: [99, 102, 241],
        fontSize: 10,
        fontStyle: 'bold',
      },
      styles: {
        fontSize: 9,
        cellPadding: 3,
      },
      columnStyles: {
        0: { fontStyle: 'bold', cellWidth: 30 },
        1: { cellWidth: 35 },
        2: { cellWidth: 30 },
        3: { cellWidth: 25 },
        4: { cellWidth: 35 },
        5: { cellWidth: 25 },
      },
      margin: { left: 15, right: 15 },
      didDrawPage: (data) => {
        // Footer em cada página
        const pageCount = doc.getNumberOfPages();
        doc.setFontSize(8);
        doc.setTextColor(150, 150, 150);
        doc.text(
          `Página ${data.pageNumber} de ${pageCount}`,
          pageWidth / 2,
          pageHeight - 10,
          { align: 'center' }
        );
        doc.text(
          'Tracky Pro Flow - tracky-pro-flow.com',
          pageWidth - 15,
          pageHeight - 10,
          { align: 'right' }
        );
      },
    });

    // Salvar PDF
    const filename = `relatorio-pedidos-${format(new Date(), 'yyyy-MM-dd-HHmmss')}.pdf`;
    doc.save(filename);
  }

  /**
   * Exporta para Excel com formatação avançada
   */
  static exportToExcel(
    orders: Order[],
    metrics?: ExportMetrics,
    options: ExportOptions = {}
  ): void {
    const workbook = XLSX.utils.book_new();

    // Aba 1: Métricas
    if (options.includeMetrics && metrics) {
      const metricsData = [
        ['TRACKY PRO FLOW - RELATÓRIO DE MÉTRICAS'],
        [`Gerado em: ${format(new Date(), "dd/MM/yyyy 'às' HH:mm")}`],
        [options.period || ''],
        [],
        ['Métrica', 'Valor'],
        ['Total de Pedidos', metrics.total],
        ['Pedidos Entregues', metrics.delivered],
        ['Em Trânsito', metrics.inTransit],
        ['Atrasados', metrics.delayed],
        ['Pendentes', metrics.pending],
        ['Taxa de Entrega', `${metrics.deliveryRate}%`],
        [
          'Tempo Médio de Entrega',
          metrics.averageDeliveryTime > 0 ? `${metrics.averageDeliveryTime} dias` : 'N/A',
        ],
      ];

      const metricsSheet = XLSX.utils.aoa_to_sheet(metricsData);

      // Largura das colunas
      metricsSheet['!cols'] = [{ wch: 30 }, { wch: 20 }];

      XLSX.utils.book_append_sheet(workbook, metricsSheet, 'Métricas');
    }

    // Aba 2: Pedidos
    const ordersData = orders.map((order) => ({
      'Código de Rastreio': order.tracking_code,
      Cliente: order.customer_name,
      Email: order.customer_email,
      Telefone: order.customer_phone || '',
      Transportadora: order.carrier,
      Status: statusLabels[order.status] || order.status,
      Origem: order.origin || '',
      Destino: order.destination,
      'Data de Criação': format(new Date(order.created_at), 'dd/MM/yyyy HH:mm'),
      'Última Atualização': format(new Date(order.updated_at), 'dd/MM/yyyy HH:mm'),
      'Previsão de Entrega': order.estimated_delivery
        ? format(new Date(order.estimated_delivery), 'dd/MM/yyyy')
        : '',
      'Data de Entrega': order.delivered_at
        ? format(new Date(order.delivered_at), 'dd/MM/yyyy HH:mm')
        : '',
    }));

    const ordersSheet = XLSX.utils.json_to_sheet(ordersData);

    // Largura das colunas
    ordersSheet['!cols'] = [
      { wch: 20 }, // Código
      { wch: 25 }, // Cliente
      { wch: 30 }, // Email
      { wch: 15 }, // Telefone
      { wch: 15 }, // Transportadora
      { wch: 15 }, // Status
      { wch: 20 }, // Origem
      { wch: 20 }, // Destino
      { wch: 18 }, // Data Criação
      { wch: 18 }, // Última Atualização
      { wch: 18 }, // Previsão
      { wch: 18 }, // Entrega
    ];

    XLSX.utils.book_append_sheet(workbook, ordersSheet, 'Pedidos');

    // Aba 3: Estatísticas por Status
    const statusStats = orders.reduce((acc, order) => {
      acc[order.status] = (acc[order.status] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    const statusData = Object.entries(statusStats).map(([status, count]) => ({
      Status: statusLabels[status] || status,
      Quantidade: count,
      Percentual: `${((count / orders.length) * 100).toFixed(1)}%`,
    }));

    const statusSheet = XLSX.utils.json_to_sheet(statusData);
    statusSheet['!cols'] = [{ wch: 20 }, { wch: 15 }, { wch: 15 }];
    XLSX.utils.book_append_sheet(workbook, statusSheet, 'Por Status');

    // Aba 4: Estatísticas por Transportadora
    const carrierStats = orders.reduce((acc, order) => {
      acc[order.carrier] = (acc[order.carrier] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    const carrierData = Object.entries(carrierStats)
      .map(([carrier, count]) => ({
        Transportadora: carrier,
        Quantidade: count,
        Percentual: `${((count / orders.length) * 100).toFixed(1)}%`,
      }))
      .sort((a, b) => b.Quantidade - a.Quantidade);

    const carrierSheet = XLSX.utils.json_to_sheet(carrierData);
    carrierSheet['!cols'] = [{ wch: 20 }, { wch: 15 }, { wch: 15 }];
    XLSX.utils.book_append_sheet(workbook, carrierSheet, 'Por Transportadora');

    // Salvar Excel
    const filename = `relatorio-pedidos-${format(new Date(), 'yyyy-MM-dd-HHmmss')}.xlsx`;
    XLSX.writeFile(workbook, filename);
  }

  /**
   * Exporta dados para CSV
   */
  static exportToCSV(orders: Order[], options: ExportOptions = {}): void {
    const csvData = orders.map((order) => ({
      codigo: order.tracking_code,
      cliente: order.customer_name,
      email: order.customer_email,
      telefone: order.customer_phone || '',
      transportadora: order.carrier,
      status: statusLabels[order.status] || order.status,
      origem: order.origin || '',
      destino: order.destination,
      criado_em: format(new Date(order.created_at), 'dd/MM/yyyy HH:mm'),
      atualizado_em: format(new Date(order.updated_at), 'dd/MM/yyyy HH:mm'),
    }));

    const worksheet = XLSX.utils.json_to_sheet(csvData);
    const csv = XLSX.utils.sheet_to_csv(worksheet);
    
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    
    link.setAttribute('href', url);
    link.setAttribute('download', `pedidos-${format(new Date(), 'yyyy-MM-dd-HHmmss')}.csv`);
    link.style.visibility = 'hidden';
    
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  /**
   * Exporta gráfico como imagem
   */
  static async exportChartAsImage(chartElement: HTMLElement, filename: string): Promise<void> {
    try {
      const html2canvas = (await import('html2canvas')).default;
      
      const canvas = await html2canvas(chartElement, {
        backgroundColor: '#ffffff',
        scale: 2, // Alta qualidade
      });

      canvas.toBlob((blob) => {
        if (blob) {
          const url = URL.createObjectURL(blob);
          const link = document.createElement('a');
          link.href = url;
          link.download = `${filename}-${format(new Date(), 'yyyy-MM-dd-HHmmss')}.png`;
          link.click();
          URL.revokeObjectURL(url);
        }
      });
    } catch (error) {
      console.error('Erro ao exportar gráfico:', error);
      throw new Error('Falha ao exportar gráfico como imagem');
    }
  }

  /**
   * Gera relatório completo com todas as abas
   */
  static exportCompleteReport(
    orders: Order[],
    metrics: ExportMetrics,
    options: ExportOptions = {}
  ): void {
    this.exportToExcel(orders, metrics, {
      ...options,
      includeMetrics: true,
      includeCharts: true,
    });
  }
}
