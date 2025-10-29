import { FileDown, FileSpreadsheet, FileText, Printer } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useExport } from '@/hooks/useExport';

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

interface ExportMenuProps {
  orders: Order[];
  metrics?: ExportMetrics;
  filters?: ExportFilters;
  title?: string;
}

export function ExportMenu({ orders, metrics, filters, title }: ExportMenuProps) {
  const {
    isExporting,
    exportToPDF,
    exportToExcel,
    exportToCSV,
    exportCompleteReport,
  } = useExport();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" disabled={isExporting || orders.length === 0}>
          <FileDown className="mr-2 h-4 w-4" />
          {isExporting ? 'Exportando...' : 'Exportar'}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel>Formato de Exportação</DropdownMenuLabel>
        <DropdownMenuSeparator />
        
        <DropdownMenuItem
          onClick={() => exportToPDF(orders, metrics, filters, title)}
          className="cursor-pointer"
        >
          <FileText className="mr-2 h-4 w-4 text-red-600" />
          <div className="flex flex-col">
            <span className="font-semibold">PDF Profissional</span>
            <span className="text-xs text-gray-500">
              Relatório formatado para impressão
            </span>
          </div>
        </DropdownMenuItem>

        <DropdownMenuItem
          onClick={() => exportToExcel(orders, metrics, filters, title)}
          className="cursor-pointer"
        >
          <FileSpreadsheet className="mr-2 h-4 w-4 text-green-600" />
          <div className="flex flex-col">
            <span className="font-semibold">Excel Completo</span>
            <span className="text-xs text-gray-500">
              Múltiplas abas com análises
            </span>
          </div>
        </DropdownMenuItem>

        <DropdownMenuItem
          onClick={() => exportToCSV(orders, filters)}
          className="cursor-pointer"
        >
          <FileText className="mr-2 h-4 w-4 text-blue-600" />
          <div className="flex flex-col">
            <span className="font-semibold">CSV Simples</span>
            <span className="text-xs text-gray-500">
              Para importação em outros sistemas
            </span>
          </div>
        </DropdownMenuItem>

        {metrics && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={() => exportCompleteReport(orders, metrics, filters)}
              className="cursor-pointer bg-indigo-50 dark:bg-indigo-900/20"
            >
              <Printer className="mr-2 h-4 w-4 text-indigo-600" />
              <div className="flex flex-col">
                <span className="font-semibold text-indigo-900 dark:text-indigo-100">
                  Relatório Completo
                </span>
                <span className="text-xs text-indigo-700 dark:text-indigo-300">
                  Excel com métricas e gráficos
                </span>
              </div>
            </DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
