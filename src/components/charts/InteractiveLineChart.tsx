import { useState, useRef } from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  Brush,
  ReferenceLine,
  Area,
  ComposedChart,
} from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  Download,
  Maximize2,
  Minimize2,
  ZoomIn,
  ZoomOut,
  RotateCcw,
} from 'lucide-react';
import { AdvancedExportService } from '@/services/advancedExport';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface TimeSeriesData {
  date: string;
  total: number;
  delivered: number;
  inTransit: number;
  delayed: number;
  average?: number;
}

interface InteractiveLineChartProps {
  data: TimeSeriesData[];
  title?: string;
  onPointClick?: (data: TimeSeriesData) => void;
}

export function InteractiveLineChart({
  data,
  title = 'Evolução Temporal',
  onPointClick,
}: InteractiveLineChartProps) {
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showBrush, setShowBrush] = useState(true);
  const [zoomLevel, setZoomLevel] = useState(1);
  const [zoomDomain, setZoomDomain] = useState<[number, number] | null>(null);
  const [selectedMetrics, setSelectedMetrics] = useState({
    total: true,
    delivered: true,
    inTransit: true,
    delayed: true,
  });
  const chartRef = useRef<HTMLDivElement>(null);

  const handleExport = async () => {
    if (chartRef.current) {
      try {
        await AdvancedExportService.exportChartAsImage(
          chartRef.current,
          'grafico-temporal'
        );
      } catch (error) {
        console.error('Erro ao exportar gráfico:', error);
      }
    }
  };

  const toggleFullscreen = () => {
    setIsFullscreen(!isFullscreen);
  };

  const toggleMetric = (metric: keyof typeof selectedMetrics) => {
    setSelectedMetrics((prev) => ({
      ...prev,
      [metric]: !prev[metric],
    }));
  };

  const handleZoomIn = () => {
    setZoomLevel((prev) => Math.min(prev * 1.2, 5));
  };

  const handleZoomOut = () => {
    setZoomLevel((prev) => Math.max(prev / 1.2, 1));
    if (zoomLevel <= 1.2) {
      setZoomDomain(null); // Reset domain when zoom out to base level
    }
  };

  const handleResetZoom = () => {
    setZoomLevel(1);
    setZoomDomain(null);
  };

  const handleBrushChange = (domain: { startIndex?: number; endIndex?: number }) => {
    if (domain && domain.startIndex !== undefined && domain.endIndex !== undefined) {
      setZoomDomain([domain.startIndex, domain.endIndex]);
    }
  };

  // Calcular média móvel
  const calculateMovingAverage = (data: TimeSeriesData[], window = 7) => {
    return data.map((item, index) => {
      const start = Math.max(0, index - window + 1);
      const subset = data.slice(start, index + 1);
      const avg =
        subset.reduce((sum, d) => sum + d.total, 0) / subset.length;
      return {
        ...item,
        average: Math.round(avg),
      };
    });
  };

  const dataWithAverage = calculateMovingAverage(data);

  interface TooltipProps {
    active?: boolean;
    payload?: Array<{
      name: string;
      value: number;
      color: string;
      dataKey: string;
    }>;
    label?: string;
  }

  const CustomTooltip = ({ active, payload, label }: TooltipProps) => {
    if (active && payload && payload.length) {
      const date = new Date(label || '');
      return (
        <div className="bg-white dark:bg-gray-800 p-4 border rounded-lg shadow-lg">
          <p className="font-bold text-sm mb-2">
            {format(date, "dd 'de' MMMM", { locale: ptBR })}
          </p>
          <div className="space-y-1 text-xs">
            {payload.map((entry, index: number) => (
              <p
                key={index}
                className="flex justify-between gap-4"
                style={{ color: entry.color }}
              >
                <span>{entry.name}:</span>
                <span className="font-semibold">{entry.value}</span>
              </p>
            ))}
          </div>
        </div>
      );
    }
    return null;
  };

  const formatXAxis = (dateStr: string) => {
    const date = new Date(dateStr);
    return format(date, 'dd/MM', { locale: ptBR });
  };

  return (
    <Card
      className={`transition-all ${
        isFullscreen ? 'fixed inset-4 z-50 shadow-2xl overflow-auto' : 'relative'
      }`}
    >
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-lg font-semibold">{title}</CardTitle>
        <div className="flex gap-2 flex-wrap">
          <Button
            variant="outline"
            size="sm"
            onClick={handleZoomIn}
            className="gap-2"
            disabled={zoomLevel >= 5}
          >
            <ZoomIn className="h-4 w-4" />
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={handleZoomOut}
            className="gap-2"
            disabled={zoomLevel <= 1}
          >
            <ZoomOut className="h-4 w-4" />
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={handleResetZoom}
            className="gap-2"
            disabled={zoomLevel === 1}
          >
            <RotateCcw className="h-4 w-4" />
          </Button>
          <Button variant="outline" size="sm" onClick={handleExport} className="gap-2">
            <Download className="h-4 w-4" />
            Exportar
          </Button>
          <Button variant="outline" size="sm" onClick={toggleFullscreen} className="gap-2">
            {isFullscreen ? (
              <Minimize2 className="h-4 w-4" />
            ) : (
              <Maximize2 className="h-4 w-4" />
            )}
          </Button>
        </div>
      </CardHeader>
      <CardContent ref={chartRef}>
        {/* Controles de Métricas */}
        <div className="flex gap-2 mb-4 flex-wrap">
          <Button
            variant={selectedMetrics.total ? 'default' : 'outline'}
            size="sm"
            onClick={() => toggleMetric('total')}
            className="text-xs"
          >
            <span className="w-3 h-3 rounded-full bg-blue-500 mr-2" />
            Total
          </Button>
          <Button
            variant={selectedMetrics.delivered ? 'default' : 'outline'}
            size="sm"
            onClick={() => toggleMetric('delivered')}
            className="text-xs"
          >
            <span className="w-3 h-3 rounded-full bg-green-500 mr-2" />
            Entregues
          </Button>
          <Button
            variant={selectedMetrics.inTransit ? 'default' : 'outline'}
            size="sm"
            onClick={() => toggleMetric('inTransit')}
            className="text-xs"
          >
            <span className="w-3 h-3 rounded-full bg-yellow-500 mr-2" />
            Em Trânsito
          </Button>
          <Button
            variant={selectedMetrics.delayed ? 'default' : 'outline'}
            size="sm"
            onClick={() => toggleMetric('delayed')}
            className="text-xs"
          >
            <span className="w-3 h-3 rounded-full bg-red-500 mr-2" />
            Atrasados
          </Button>
        </div>

        <ResponsiveContainer
          width="100%"
          height={isFullscreen ? 600 : 350}
          className="transition-all"
        >
          <ComposedChart
            data={dataWithAverage}
            margin={{
              top: 20,
              right: 30,
              left: 20,
              bottom: showBrush ? 40 : 5,
            }}
          >
            <defs>
              <linearGradient id="colorTotal" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
                <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
            <XAxis
              dataKey="date"
              tickFormatter={formatXAxis}
              tick={{ fontSize: 11 }}
            />
            <YAxis tick={{ fontSize: 11 }} />
            <Tooltip content={<CustomTooltip />} />
            <Legend
              wrapperStyle={{ fontSize: '12px' }}
              onClick={(e) => {
                const metric = e.dataKey as keyof typeof selectedMetrics;
                if (Object.prototype.hasOwnProperty.call(selectedMetrics, metric)) {
                  toggleMetric(metric);
                }
              }}
            />

            {/* Área de fundo para Total */}
            {selectedMetrics.total && (
              <Area
                type="monotone"
                dataKey="total"
                fill="url(#colorTotal)"
                stroke="none"
              />
            )}

            {/* Média Móvel */}
            <Line
              type="monotone"
              dataKey="average"
              name="Média Móvel (7d)"
              stroke="#94a3b8"
              strokeWidth={2}
              strokeDasharray="5 5"
              dot={false}
            />

            {/* Linhas principais */}
            {selectedMetrics.total && (
              <Line
                type="monotone"
                dataKey="total"
                name="Total"
                stroke="#3b82f6"
                strokeWidth={3}
                dot={{ r: 4, fill: '#3b82f6' }}
                activeDot={{ r: 6 }}
                animationBegin={0}
                animationDuration={1000}
              />
            )}

            {selectedMetrics.delivered && (
              <Line
                type="monotone"
                dataKey="delivered"
                name="Entregues"
                stroke="#10b981"
                strokeWidth={2}
                dot={{ r: 3, fill: '#10b981' }}
              />
            )}

            {selectedMetrics.inTransit && (
              <Line
                type="monotone"
                dataKey="inTransit"
                name="Em Trânsito"
                stroke="#f59e0b"
                strokeWidth={2}
                dot={{ r: 3, fill: '#f59e0b' }}
              />
            )}

            {selectedMetrics.delayed && (
              <Line
                type="monotone"
                dataKey="delayed"
                name="Atrasados"
                stroke="#ef4444"
                strokeWidth={2}
                dot={{ r: 3, fill: '#ef4444' }}
              />
            )}

            {/* Linha de referência */}
            <ReferenceLine
              y={dataWithAverage.reduce((sum, d) => sum + d.total, 0) / dataWithAverage.length}
              label="Média Geral"
              stroke="#94a3b8"
              strokeDasharray="3 3"
            />

            {/* Brush para zoom */}
            {showBrush && (
              <Brush
                dataKey="date"
                height={30}
                stroke="#6366f1"
                tickFormatter={formatXAxis}
              />
            )}
          </ComposedChart>
        </ResponsiveContainer>

        {/* Info sobre zoom */}
        {zoomLevel > 1 && (
          <div className="mt-2 text-center text-sm text-gray-600 dark:text-gray-400">
            Zoom: {Math.round(zoomLevel * 100)}%
          </div>
        )}
      </CardContent>
    </Card>
  );
}
